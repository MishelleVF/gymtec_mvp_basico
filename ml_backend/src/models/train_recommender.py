"""
Modelo 2 — RF-02: scoring de recomendación de horarios.

Mientras RF-01 predice "cuánta gente habrá", este modelo aprende a estimar
"qué tan bueno es un slot para que un estudiante vaya al gym ahora".

## Diseño

Sin feedback real de usuarios todavía, generamos una **etiqueta sintética**
(score objetivo entre 0 y 1) basada en heurísticas de dominio razonables.
Cuando exista feedback (clicks, asistencias, ratings), reemplazamos la label
sintética por la real y el resto del pipeline sigue funcionando igual.

### Variables del modelo (X)

Usa columnas que ya existen en `predicciones_aforo` + `features_aforo_rf01`:
- aforo_predicho, ratio_ocupacion_predicho
- ratio_libres, carga_academica
- hora_dec, dia_num
- es_finde, es_dia_academico
- modalidad_predominante (one-hot)

### Etiqueta sintética (y)

`score_objetivo = 0.55 * (1 - ratio_ocupacion_predicho)
              + 0.20 * carga_academica
              + 0.15 * preferencia_horaria(hora_dec)
              + 0.10 * (1 - es_finde)`

- Penaliza fuerte el aforo alto (queremos gym vacío).
- Premia carga académica alta (la gente está en clase, no compite por el gym).
- Sutilmente premia mañanas (8-11) y tarde-noche (17-20).
- Levemente penaliza fin de semana (capacidad reducida).

### Modelo

Ridge regression. Es la elección razonable cuando:
- la relación lineal entre features y score es fuerte (lo es por construcción
  de la etiqueta sintética),
- queremos coeficientes interpretables para Bienestar Universitario,
- el dataset es chico.

Si más adelante agregamos features no-lineales (preferencias categóricas del
estudiante, contexto temporal complejo), migramos a LightGBM.

## Métricas

- MAE / RMSE / R² del score (regresión).
- NDCG@3: cuán bien rankea los top-3 contra el ranking ideal por
  `score_objetivo`. Es la métrica que importa porque el recomendador devuelve
  top-3.

Trazabilidad: RF-02, T5.
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.utils.paths import (
    FEATURES_AFORO_PARQUET,
    MODEL_RECO_JOBLIB,
    MODEL_RECO_METRICS_JSON,
    ensure_dirs,
)

logger = logging.getLogger(__name__)


# Features que el modelo ve.
NUMERIC_FEATURES_RECO: list[str] = [
    "aforo_lag1",                # proxy de aforo_predicho cuando entrenamos
    "aforo_prom_hist",
    "ratio_libres",
    "carga_academica",
    "hora_dec",
    "dia_num",
    "es_finde",
    "es_dia_academico",
]
CATEGORICAL_FEATURES_RECO: list[str] = ["modalidad_predominante"]
TARGET_COL_RECO: str = "score_objetivo"


@dataclass
class TrainRecoMetrics:
    """Métricas del modelo de scoring de recomendación."""
    model_kind: str
    n_train: int
    n_test: int
    mae: float
    rmse: float
    r2: float
    ndcg_at_3: float
    coef: dict[str, float] | None = None


# =============================================================================
#  Construcción de la etiqueta sintética
# =============================================================================
def _preferencia_horaria(hora_dec: float) -> float:
    """
    Premia mañanas tempranas y tarde-noche, penaliza mediodía.
    Heurística simple basada en EDA: el pico es 12-14h, los valles son 8-11
    y 16-18.
    """
    if 8.0 <= hora_dec < 11.0:
        return 1.0
    if 16.5 <= hora_dec < 19.0:
        return 0.85
    if 14.5 <= hora_dec < 16.5:
        return 0.55
    if 11.0 <= hora_dec < 12.5:
        return 0.45
    if 12.5 <= hora_dec < 14.5:
        return 0.25  # mediodía cargado
    return 0.40


def construir_score_objetivo(features: pd.DataFrame) -> pd.Series:
    """
    Genera score sintético en [0, 1] para entrenar el modelo de recomendación.
    """
    ratio_ocupacion = (features["aforo"] / features["aforo_max"]).clip(0, 1)
    pref = features["hora_dec"].apply(_preferencia_horaria)
    score = (
        0.55 * (1.0 - ratio_ocupacion)
        + 0.20 * features["carga_academica"]
        + 0.15 * pref
        + 0.10 * (1 - features["es_finde"])
    )
    return score.clip(0, 1).rename(TARGET_COL_RECO)


# =============================================================================
#  Métrica NDCG@3
# =============================================================================
def _dcg(scores: np.ndarray) -> float:
    return float(
        np.sum(scores / np.log2(np.arange(2, scores.size + 2)))
    )


def ndcg_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int = 3) -> float:
    """
    Normalized Discounted Cumulative Gain a top-k. Mide si los slots con
    mayor `y_pred` son también los de mayor `y_true`.
    """
    if y_true.size == 0:
        return float("nan")
    k = min(k, y_true.size)
    idx_pred = np.argsort(-y_pred)[:k]
    idx_ideal = np.argsort(-y_true)[:k]
    dcg = _dcg(y_true[idx_pred])
    idcg = _dcg(y_true[idx_ideal])
    return dcg / idcg if idcg > 0 else 0.0


# =============================================================================
#  Entrenamiento
# =============================================================================
def _build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES_RECO),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES_RECO,
            ),
        ]
    )
    return Pipeline([("prep", preprocessor), ("model", Ridge(alpha=1.0))])


def train_recomendador(
    features_path: Path = FEATURES_AFORO_PARQUET,
    model_path: Path = MODEL_RECO_JOBLIB,
    metrics_path: Path = MODEL_RECO_METRICS_JSON,
    frac_train: float = 0.8,
) -> TrainRecoMetrics:
    """
    Entrena el modelo de scoring de recomendación y persiste artefactos.
    """
    ensure_dirs()
    df = pd.read_parquet(features_path)
    df["fecha"] = pd.to_datetime(df["fecha"])
    df["score_objetivo"] = construir_score_objetivo(df)

    # Split temporal idéntico al de RF-01 para que sean comparables.
    fechas = sorted(df["fecha"].unique())
    corte = fechas[max(1, int(len(fechas) * frac_train))]
    train = df[df["fecha"] < corte].copy()
    test = df[df["fecha"] >= corte].copy()

    feat_cols = NUMERIC_FEATURES_RECO + CATEGORICAL_FEATURES_RECO
    X_train, y_train = train[feat_cols], train[TARGET_COL_RECO]
    X_test, y_test = test[feat_cols], test[TARGET_COL_RECO]

    pipe = _build_pipeline()
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)

    metrics = TrainRecoMetrics(
        model_kind="ridge",
        n_train=len(X_train),
        n_test=len(X_test),
        mae=float(mean_absolute_error(y_test, y_pred)),
        rmse=float(np.sqrt(mean_squared_error(y_test, y_pred))),
        r2=float(r2_score(y_test, y_pred)),
        ndcg_at_3=float(ndcg_at_k(y_test.values, y_pred, k=3)),
    )

    # Coeficientes interpretables
    cat_names = (
        pipe.named_steps["prep"]
        .named_transformers_["cat"]
        .get_feature_names_out(CATEGORICAL_FEATURES_RECO)
        .tolist()
    )
    feat_names = NUMERIC_FEATURES_RECO + cat_names
    metrics.coef = dict(
        sorted(
            zip(feat_names, pipe.named_steps["model"].coef_.tolist()),
            key=lambda kv: abs(kv[1]),
            reverse=True,
        )
    )

    joblib.dump(pipe, model_path)
    metrics_path.write_text(json.dumps(asdict(metrics), indent=2, ensure_ascii=False))
    logger.info(
        "Modelo RF-02 | MAE=%.4f RMSE=%.4f R2=%.3f NDCG@3=%.3f (n_train=%d, n_test=%d)",
        metrics.mae, metrics.rmse, metrics.r2, metrics.ndcg_at_3,
        metrics.n_train, metrics.n_test,
    )
    logger.info("Modelo persistido en %s", model_path)
    return metrics


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    train_recomendador()


if __name__ == "__main__":
    main()

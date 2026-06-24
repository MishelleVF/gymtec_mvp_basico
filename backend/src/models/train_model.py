"""
Entrenamiento del modelo RF-01 — predicción de aforo del gimnasio.

Modelos disponibles (configurable via `model_kind`):
- 'linear'         : LinearRegression
- 'random_forest'  : RandomForestRegressor (default, sin dependencias extra)
- 'lightgbm'       : LightGBM Regressor (requiere lightgbm instalado)

Por qué el default es RandomForest:
- Dataset pequeño (~370 filas). LightGBM brilla con miles+ filas; aquí el
  error de varianza domina y RF suele empatar/ganar.
- Sin dependencias extra: sklearn ya está en requirements.txt.
- Funciona razonable con hiperparámetros default; LightGBM requiere tuning.

Estrategia:
- Split temporal: las primeras 80% de fechas a train, último 20% a test.
- Métricas: MAE, RMSE, R^2.
- Persiste modelo + métricas + feature names en `models_artifacts/`.

Trazabilidad: RF-01, T2.
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
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from src.utils.paths import (
    FEATURES_AFORO_PARQUET,
    MODEL_AFORO_JOBLIB,
    MODEL_METRICS_JSON,
    ensure_dirs,
)

logger = logging.getLogger(__name__)


# Columnas de features usadas por el modelo (sin identificadores ni target).
NUMERIC_FEATURES: list[str] = [
    "dia_num", "hora_dec",
    "aforo_lag1", "aforo_lag2", "aforo_prom_hist", "aforo_max_hist",
    "hora_sin", "hora_cos", "dia_sin", "dia_cos", "es_finde",
    "es_dia_academico",
    "estudiantes_presencial", "estudiantes_virtual", "estudiantes_libres",
    "ratio_libres", "carga_academica", "ratio_virtual",
    "n_secciones_activas", "n_cursos_activos", "n_facultades_activas",
    "duracion_prom_clases",
]
CATEGORICAL_FEATURES: list[str] = ["modalidad_predominante"]
TARGET_COL: str = "aforo"


@dataclass
class TrainMetrics:
    """Métricas de evaluación temporal del modelo."""
    model_kind: str
    n_train: int
    n_test: int
    fecha_corte: str
    mae: float
    rmse: float
    r2: float
    feature_importances: dict[str, float] | None = None


def _train_test_split_temporal(
    df: pd.DataFrame, frac_train: float = 0.8
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Timestamp]:
    """
    Split temporal por fechas. No mezclamos pasado/futuro.

    Toma frac_train del rango de fechas único como train y el resto como test.
    """
    fechas_unicas = sorted(df["fecha"].unique())
    if len(fechas_unicas) < 5:
        raise ValueError("Muy pocas fechas únicas para split temporal.")
    corte_idx = max(1, int(len(fechas_unicas) * frac_train))
    fecha_corte = fechas_unicas[corte_idx]
    train = df[df["fecha"] < fecha_corte].copy()
    test = df[df["fecha"] >= fecha_corte].copy()
    return train, test, pd.Timestamp(fecha_corte)


def _build_pipeline(model_kind: str) -> Pipeline:
    """Construye el pipeline sklearn (preprocessor + estimator)."""
    if model_kind == "linear":
        estimator = LinearRegression()
    elif model_kind == "random_forest":
        estimator = RandomForestRegressor(
            n_estimators=200,
            max_depth=None,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
    elif model_kind == "lightgbm":
        try:
            from lightgbm import LGBMRegressor
        except ImportError as exc:
            raise ImportError(
                "lightgbm no está instalado. Instálalo con `pip install lightgbm`."
            ) from exc
        estimator = LGBMRegressor(
            n_estimators=300,
            learning_rate=0.05,
            num_leaves=31,
            min_data_in_leaf=5,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
    else:
        raise ValueError(f"model_kind no soportado: {model_kind}")

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    return Pipeline([("prep", preprocessor), ("model", estimator)])


def train_baseline(
    features_path: Path = FEATURES_AFORO_PARQUET,
    model_kind: str = "random_forest",
    model_path: Path = MODEL_AFORO_JOBLIB,
    metrics_path: Path = MODEL_METRICS_JSON,
    frac_train: float = 0.8,
) -> TrainMetrics:
    """
    Entrena el modelo baseline y persiste artefactos.
    """
    ensure_dirs()
    df = pd.read_parquet(features_path)
    df["fecha"] = pd.to_datetime(df["fecha"])
    df = df.dropna(subset=[TARGET_COL]).reset_index(drop=True)

    train, test, fecha_corte = _train_test_split_temporal(df, frac_train)
    feat_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X_train, y_train = train[feat_cols], train[TARGET_COL]
    X_test, y_test = test[feat_cols], test[TARGET_COL]

    pipe = _build_pipeline(model_kind)
    pipe.fit(X_train, y_train)

    y_pred = pipe.predict(X_test)
    metrics = TrainMetrics(
        model_kind=model_kind,
        n_train=len(X_train),
        n_test=len(X_test),
        fecha_corte=fecha_corte.strftime("%Y-%m-%d"),
        mae=float(mean_absolute_error(y_test, y_pred)),
        rmse=float(np.sqrt(mean_squared_error(y_test, y_pred))),
        r2=float(r2_score(y_test, y_pred)),
    )

    # Feature importances solo si el estimador las soporta
    estimator = pipe.named_steps["model"]
    if hasattr(estimator, "feature_importances_"):
        # Recuperar nombres post one-hot
        cat_names = (
            pipe.named_steps["prep"]
            .named_transformers_["cat"]
            .get_feature_names_out(CATEGORICAL_FEATURES)
            .tolist()
        )
        all_names = NUMERIC_FEATURES + cat_names
        metrics.feature_importances = dict(
            sorted(
                zip(all_names, estimator.feature_importances_.tolist()),
                key=lambda kv: kv[1],
                reverse=True,
            )
        )

    joblib.dump(pipe, model_path)
    metrics_path.write_text(json.dumps(asdict(metrics), indent=2, ensure_ascii=False))
    logger.info(
        "Modelo entrenado | MAE=%.2f RMSE=%.2f R2=%.3f (n_train=%d, n_test=%d)",
        metrics.mae, metrics.rmse, metrics.r2, metrics.n_train, metrics.n_test,
    )
    logger.info("Modelo persistido en %s", model_path)
    return metrics


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    train_baseline()


if __name__ == "__main__":
    main()

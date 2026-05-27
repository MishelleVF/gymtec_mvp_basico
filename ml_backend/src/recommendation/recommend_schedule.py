"""
Recomendador personalizado de horarios para asistir al gimnasio (RF-02).

Lógica T5:
  1. Recibe predicciones_aforo (GOLD) — ya sabemos la ocupación esperada.
  2. Recibe la disponibilidad del estudiante (de sus clases).
  3. Filtra los slots en los que el estudiante está libre.
  4. Aplica el modelo de scoring (`rf02_recomendador_score.joblib`) para
     ordenar los candidatos. Si el modelo no está entrenado todavía, cae al
     fallback heurístico (ordenar por menor aforo predicho).
  5. Devuelve top N (default 3).

Output: tabla `recomendaciones_horario` con razón explicable.

Trazabilidad: RF-02, RF-04, T4, T5.
"""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.features.build_features import construir_disponibilidad_estudiante
from src.models.train_recommender import (
    CATEGORICAL_FEATURES_RECO,
    NUMERIC_FEATURES_RECO,
)
from src.utils.paths import (
    FEATURES_AFORO_PARQUET,
    HORARIOS_SLOTS_PARQUET,
    MODEL_RECO_JOBLIB,
    PREDICCIONES_AFORO_PARQUET,
    RECOMENDACIONES_CSV,
    RECOMENDACIONES_PARQUET,
    ensure_dirs,
)

logger = logging.getLogger(__name__)


def _enriquecer_con_features_academicas(
    cand: pd.DataFrame,
    features_path: Path = FEATURES_AFORO_PARQUET,
) -> pd.DataFrame:
    """
    Trae a los candidatos las columnas académicas (ratio_libres,
    carga_academica, modalidad_predominante, etc.) que necesita el modelo
    de scoring. Si la columna ya existe, no la pisa.
    """
    feats = pd.read_parquet(features_path)
    feats_grp = (
        feats.groupby(["dia", "slot"])
        .agg(
            aforo_lag1=("aforo_lag1", "mean"),
            aforo_prom_hist=("aforo_prom_hist", "mean"),
            ratio_libres=("ratio_libres", "first"),
            carga_academica=("carga_academica", "first"),
            es_finde=("es_finde", "first"),
            es_dia_academico=("es_dia_academico", "first"),
            modalidad_predominante=("modalidad_predominante", "first"),
        )
        .reset_index()
    )
    return cand.merge(feats_grp, on=["dia", "slot"], how="left")


def _puntuar_con_modelo(
    cand: pd.DataFrame,
    model_path: Path = MODEL_RECO_JOBLIB,
) -> pd.DataFrame:
    """
    Aplica el modelo Ridge entrenado para puntuar cada candidato. Devuelve
    el mismo DataFrame con una columna `score_recomendacion` en [0, 1].
    """
    pipe = joblib.load(model_path)
    cols_modelo = NUMERIC_FEATURES_RECO + CATEGORICAL_FEATURES_RECO
    # Defaults para cuando no hay actividad académica en el slot
    for c in NUMERIC_FEATURES_RECO:
        if c not in cand.columns:
            cand[c] = 0
        cand[c] = cand[c].fillna(0)
    if "modalidad_predominante" not in cand.columns:
        cand["modalidad_predominante"] = "sin_clases"
    cand["modalidad_predominante"] = cand["modalidad_predominante"].fillna("sin_clases")

    cand["score_recomendacion"] = np.clip(pipe.predict(cand[cols_modelo]), 0, 1)
    return cand


def _razon_recomendacion(nivel: str, aforo: int, aforo_max: int) -> str:
    """Genera el texto explicable de la recomendación."""
    base = (
        "Horario recomendado porque el estudiante está libre"
        f" y el aforo esperado es {nivel}"
        f" ({aforo}/{aforo_max} personas)."
    )
    return base


def recomendar_para_estudiante(
    student_id: str,
    cursos_estudiante: list[str],
    predicciones: pd.DataFrame | None = None,
    horarios_slots: pd.DataFrame | None = None,
    top_n: int = 3,
    usar_modelo: bool = True,
) -> pd.DataFrame:
    """
    Devuelve el ranking top_n de horarios recomendados para un estudiante.

    Parámetros:
      student_id        : código del estudiante.
      cursos_estudiante : lista de clase_id (cod_curso_seccion) en los que
                          está matriculado.
      predicciones      : DataFrame con `predicciones_aforo`. Si None, se carga
                          desde data/processed.
      horarios_slots    : DataFrame con `horarios_expandido_slots`. Idem.
      top_n             : número de horarios a recomendar (default 3).
      usar_modelo       : si True, ordena por `score_recomendacion` del
                          modelo Ridge entrenado. Si False (o el modelo no
                          existe), cae al heurístico (menor aforo predicho).
    """
    if predicciones is None:
        predicciones = pd.read_parquet(PREDICCIONES_AFORO_PARQUET)
    if horarios_slots is None:
        horarios_slots = pd.read_parquet(HORARIOS_SLOTS_PARQUET)

    disp = construir_disponibilidad_estudiante(
        horarios_slots, student_id, cursos_estudiante
    )

    # Cruzar predicciones con slots libres del estudiante
    libres = disp[disp["disponible"] == 1][["dia", "slot"]]
    cand = predicciones.merge(libres, on=["dia", "slot"], how="inner")
    if cand.empty:
        logger.warning("No hay slots libres para %s en horario operativo.", student_id)
        return pd.DataFrame(
            columns=[
                "student_id", "fecha", "dia", "slot", "aforo_predicho",
                "ratio_ocupacion_predicho", "nivel_ocupacion",
                "score_recomendacion",
                "ranking_recomendacion", "razon_recomendacion",
            ]
        )

    # Ordenar candidatos
    if usar_modelo and MODEL_RECO_JOBLIB.exists():
        cand = _enriquecer_con_features_academicas(cand)
        cand = _puntuar_con_modelo(cand)
        cand = cand.sort_values(
            ["score_recomendacion", "aforo_predicho", "dia_num", "hora_dec"],
            ascending=[False, True, True, True],
        )
    else:
        if usar_modelo:
            logger.warning(
                "Modelo de scoring no encontrado en %s. Cayendo a heurístico.",
                MODEL_RECO_JOBLIB,
            )
        cand["score_recomendacion"] = np.nan
        cand = cand.sort_values(
            ["aforo_predicho", "dia_num", "hora_dec"],
            ascending=[True, True, True],
        )

    cand = cand.head(top_n).reset_index(drop=True)
    cand["student_id"] = student_id
    cand["ranking_recomendacion"] = cand.index + 1
    cand["razon_recomendacion"] = cand.apply(
        lambda r: _razon_recomendacion(
            r["nivel_ocupacion"], r["aforo_predicho"], r["aforo_max"]
        ),
        axis=1,
    )

    cols = [
        "student_id", "fecha", "dia", "slot",
        "aforo_predicho", "ratio_ocupacion_predicho", "nivel_ocupacion",
        "score_recomendacion",
        "ranking_recomendacion", "razon_recomendacion",
    ]
    return cand[cols]


def generar_recomendaciones(
    estudiantes: dict[str, list[str]] | None = None,
    top_n: int = 3,
    dst_parquet: Path = RECOMENDACIONES_PARQUET,
    dst_csv: Path = RECOMENDACIONES_CSV,
) -> pd.DataFrame:
    """
    Genera la tabla GOLD `recomendaciones_horario` para una colección de
    estudiantes.

    Si `estudiantes` es None, se construye un caso demo a partir de los
    primeros 3 cursos de horarios_expandido_slots (útil para QA).

    Esquema:
      student_id, fecha, dia, slot, aforo_predicho,
      ratio_ocupacion_predicho, nivel_ocupacion,
      ranking_recomendacion, razon_recomendacion
    """
    ensure_dirs()
    predicciones = pd.read_parquet(PREDICCIONES_AFORO_PARQUET)
    horarios_slots = pd.read_parquet(HORARIOS_SLOTS_PARQUET)

    if estudiantes is None:
        # Demo: usamos los primeros 3 clase_id como horario del estudiante demo
        clases_demo = horarios_slots["clase_id"].drop_duplicates().head(3).tolist()
        estudiantes = {"DEMO_2026": clases_demo}
        logger.info("Generando recomendaciones DEMO para estudiante DEMO_2026.")

    frames: list[pd.DataFrame] = []
    for sid, cursos in estudiantes.items():
        frames.append(
            recomendar_para_estudiante(
                sid, cursos, predicciones, horarios_slots, top_n
            )
        )

    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    out.to_parquet(dst_parquet, index=False)
    out.to_csv(dst_csv, index=False)
    logger.info(
        "recomendaciones_horario: %d filas. parquet=%s csv=%s",
        len(out), dst_parquet, dst_csv,
    )
    return out


def franjas_menor_aforo(
    dia: str,
    top_n: int = 5,
    predicciones: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """
    RF-04: top_n franjas con menor aforo predicho para un día dado.
    """
    if predicciones is None:
        predicciones = pd.read_parquet(PREDICCIONES_AFORO_PARQUET)
    sel = predicciones[predicciones["dia"] == dia].copy()
    return sel.sort_values("aforo_predicho").head(top_n).reset_index(drop=True)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    generar_recomendaciones()


if __name__ == "__main__":
    main()

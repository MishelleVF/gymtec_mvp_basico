"""
Generación de la tabla GOLD `predicciones_aforo`.

Toma el modelo entrenado y construye predicciones de aforo para una grilla
canónica (dia, slot) sobre el horario operativo del gym, usando los promedios
históricos como sustituto de los lags (no conocemos lags futuros antes de que
ocurran). La tabla resultante alimenta:

- el frontend (gráficos de predicción intra-día / heatmap semanal),
- el recomendador personalizado RF-02.

Trazabilidad: RF-01, RF-04, RF-06.
"""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.models.train_model import CATEGORICAL_FEATURES, NUMERIC_FEATURES
from src.utils.helpers import (
    aforo_a_ratio,
    clasificar_nivel_serie,
    construir_grilla_slots,
    en_horario_operativo,
)
from src.utils.paths import (
    AFORO_MAX,
    FEATURES_AFORO_PARQUET,
    MODEL_AFORO_JOBLIB,
    PREDICCIONES_AFORO_CSV,
    PREDICCIONES_AFORO_PARQUET,
    ensure_dirs,
)

logger = logging.getLogger(__name__)


def _construir_input_grilla(features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Construye una fila por (dia, slot) sobre la grilla operativa, usando los
    promedios históricos del feature store como input al modelo.
    """
    grilla = construir_grilla_slots()
    grilla["dia"] = grilla["dia"].astype(str)

    # Para cada (dia, slot) tomamos el promedio de variables académicas y
    # estadísticos históricos. Usamos la media porque las variables académicas
    # son estables semana a semana (los horarios no cambian).
    agg = (
        features_df.groupby(["dia", "slot"])
        .agg(
            aforo_prom_hist=("aforo_prom_hist", "first"),
            aforo_max_hist=("aforo_max_hist", "first"),
            estudiantes_presencial=("estudiantes_presencial", "first"),
            estudiantes_virtual=("estudiantes_virtual", "first"),
            estudiantes_libres=("estudiantes_libres", "first"),
            ratio_libres=("ratio_libres", "first"),
            carga_academica=("carga_academica", "first"),
            ratio_virtual=("ratio_virtual", "first"),
            n_secciones_activas=("n_secciones_activas", "first"),
            n_cursos_activos=("n_cursos_activos", "first"),
            n_facultades_activas=("n_facultades_activas", "first"),
            duracion_prom_clases=("duracion_prom_clases", "first"),
            modalidad_predominante=("modalidad_predominante", "first"),
            es_dia_academico=("es_dia_academico", "first"),
        )
        .reset_index()
    )
    base = grilla.merge(agg, on=["dia", "slot"], how="left")

    # Cíclicas + lags (proxy: aforo_prom_hist como lag1/lag2 cuando no hay info)
    base["hora_sin"] = np.sin(2 * np.pi * base["hora_dec"] / 24)
    base["hora_cos"] = np.cos(2 * np.pi * base["hora_dec"] / 24)
    base["dia_sin"] = np.sin(2 * np.pi * base["dia_num"] / 7)
    base["dia_cos"] = np.cos(2 * np.pi * base["dia_num"] / 7)
    base["es_finde"] = (base["dia_num"] >= 5).astype(int)

    base["aforo_prom_hist"] = base["aforo_prom_hist"].fillna(0)
    base["aforo_max_hist"] = base["aforo_max_hist"].fillna(0)
    base["aforo_lag1"] = base["aforo_prom_hist"]
    base["aforo_lag2"] = base["aforo_prom_hist"]

    # Defaults para slots sin actividad académica
    int_cols = [
        "estudiantes_presencial", "estudiantes_virtual", "estudiantes_libres",
        "n_secciones_activas", "n_cursos_activos", "n_facultades_activas",
        "es_dia_academico",
    ]
    float_cols = [
        "ratio_libres", "ratio_virtual", "carga_academica", "duracion_prom_clases",
    ]
    for c in int_cols:
        base[c] = base[c].fillna(0).astype(int)
    for c in float_cols:
        base[c] = base[c].fillna(0.0)
    base["modalidad_predominante"] = base["modalidad_predominante"].fillna("sin_clases")

    return base


def generar_predicciones(
    features_path: Path = FEATURES_AFORO_PARQUET,
    model_path: Path = MODEL_AFORO_JOBLIB,
    dst_parquet: Path = PREDICCIONES_AFORO_PARQUET,
    dst_csv: Path = PREDICCIONES_AFORO_CSV,
    fecha_referencia: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """
    Predice aforo para todos los (dia, slot) operativos y serializa la tabla
    `predicciones_aforo`.

    Esquema de salida:
      fecha, dia, dia_num, slot, hora_dec,
      aforo_predicho, aforo_max, ratio_ocupacion_predicho, nivel_ocupacion,
      timestamp_generacion
    """
    ensure_dirs()
    features_df = pd.read_parquet(features_path)
    pipe = joblib.load(model_path)

    base = _construir_input_grilla(features_df)
    feat_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X = base[feat_cols]
    y_pred = pipe.predict(X)
    base["aforo_predicho"] = np.clip(np.round(y_pred), 0, AFORO_MAX).astype(int)
    base["aforo_max"] = AFORO_MAX
    base["ratio_ocupacion_predicho"] = base["aforo_predicho"].apply(aforo_a_ratio)
    base["nivel_ocupacion"] = clasificar_nivel_serie(base["ratio_ocupacion_predicho"])

    fecha_ref = pd.Timestamp(fecha_referencia or datetime.utcnow().date())
    base["fecha"] = fecha_ref
    base["timestamp_generacion"] = pd.Timestamp(datetime.utcnow())

    cols = [
        "fecha", "dia", "dia_num", "slot", "hora_dec",
        "aforo_predicho", "aforo_max", "ratio_ocupacion_predicho",
        "nivel_ocupacion", "timestamp_generacion",
    ]
    out = base[cols].copy()
    out["dia"] = out["dia"].astype(str)

    # Filtramos a horario operativo del gym (RF-04 consume estas filas)
    out = out[out.apply(lambda r: en_horario_operativo(r["dia"], r["hora_dec"]), axis=1)]
    out = out.sort_values(["dia_num", "hora_dec"]).reset_index(drop=True)

    out.to_parquet(dst_parquet, index=False)
    out.to_csv(dst_csv, index=False)
    logger.info(
        "predicciones_aforo: %d filas. parquet=%s csv=%s",
        len(out), dst_parquet, dst_csv,
    )
    return out


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    generar_predicciones()


if __name__ == "__main__":
    main()

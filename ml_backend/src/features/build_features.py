from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from src.utils.helpers import (
    aforo_a_ratio,
    clasificar_nivel_serie,
    construir_grilla_slots,
    dia_to_num,
    en_horario_operativo,
    slot_to_hora_dec,
)
from src.utils.paths import (
    AFORO_MAX,
    AFORO_POR_SLOT_PARQUET,
    FEATURES_AFORO_PARQUET,
    HORARIOS_LIMPIOS_PARQUET,
    HORARIOS_SLOTS_PARQUET,
    LOGS_LIMPIOS_PARQUET,
    POBLACION_TOTAL,
    SLOT_MIN,
    ensure_dirs,
)

logger = logging.getLogger(__name__)


# =============================================================================
#  T1 — Expansión de horarios académicos a slots
# =============================================================================
def _expandir_clase_a_slots(
    hora_inicio: str,
    hora_fin: str,
    slot_min: int = SLOT_MIN,
) -> list[str]:
    """Devuelve la lista de slots HH:MM que cubre la clase [inicio, fin)."""
    if pd.isna(hora_inicio) or pd.isna(hora_fin):
        return []
    h_ini = pd.to_datetime(hora_inicio, format="%H:%M", errors="coerce")
    h_fin = pd.to_datetime(hora_fin, format="%H:%M", errors="coerce")
    if pd.isna(h_ini) or pd.isna(h_fin) or h_fin <= h_ini:
        return []
    rng = pd.date_range(
        start=h_ini,
        end=h_fin - pd.Timedelta(minutes=1),
        freq=f"{slot_min}min",
    )
    return [t.strftime("%H:%M") for t in rng]


def expandir_horarios_a_slots(
    src: Path = HORARIOS_LIMPIOS_PARQUET,
    dst: Path = HORARIOS_SLOTS_PARQUET,
    slot_min: int = SLOT_MIN,
) -> pd.DataFrame:
    """
    Convierte cada clase en una fila por (clase_id, dia, slot).

    Resultado: tabla `horarios_expandido_slots`.
    """
    ensure_dirs()
    horarios = pd.read_parquet(src)
    horarios = horarios.copy()
    horarios["slots"] = horarios.apply(
        lambda r: _expandir_clase_a_slots(r["hora_inicio"], r["hora_fin"], slot_min),
        axis=1,
    )
    expanded = horarios.explode("slots").rename(columns={"slots": "slot"})
    expanded = expanded[expanded["slot"].notna()].copy()
    expanded["hora_dec"] = expanded["slot"].apply(slot_to_hora_dec)
    expanded["dia_num"] = expanded["dia"].apply(dia_to_num)

    # Deduplicación: una clase debería aparecer 1 vez por (clase_id, dia, slot)
    antes = len(expanded)
    expanded = expanded.drop_duplicates(subset=["clase_id", "dia", "slot"]).reset_index(drop=True)
    if antes != len(expanded):
        logger.info("Deduplicación: %d -> %d filas", antes, len(expanded))

    expanded.to_parquet(dst, index=False)
    logger.info("Horarios expandidos a %d filas. Escrito %s", len(expanded), dst)
    return expanded


# =============================================================================
#  T1 — Agregación de aforo por slot (variable objetivo RF-01)
# =============================================================================
def construir_aforo_por_slot(
    src_logs: Path = LOGS_LIMPIOS_PARQUET,
    dst: Path = AFORO_POR_SLOT_PARQUET,
    slot_min: int = SLOT_MIN,
) -> pd.DataFrame:
    """
    Construye la serie temporal de ocupación del gym por (fecha, dia, slot).

    Estrategia: para cada (fecha, slot) tomamos la ocupación máxima alcanzada
    dentro de ese intervalo. Se usa el max porque representa el pico real del
    bloque y es la métrica más útil para alertas RF-06.
    """
    ensure_dirs()
    logs = pd.read_parquet(src_logs)
    logs["fecha_date"] = logs["fecha"].dt.normalize()
    # Slot index: floor del timestamp a la frecuencia del slot
    logs["slot_ts"] = logs["timestamp"].dt.floor(f"{slot_min}min")
    logs["slot"] = logs["slot_ts"].dt.strftime("%H:%M")

    # Ocupación máxima dentro de cada (fecha, slot)
    aforo = (
        logs.groupby(["fecha_date", "slot"])["ocupacion"]
        .max()
        .reset_index()
        .rename(columns={"ocupacion": "aforo"})
    )

    # Variables temporales derivadas
    aforo["dia"] = aforo["fecha_date"].dt.day_name().map(
        {
            "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
            "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado",
            "Sunday": "Domingo",
        }
    )
    aforo["dia_num"] = aforo["dia"].apply(dia_to_num)
    aforo["hora_dec"] = aforo["slot"].apply(slot_to_hora_dec)
    aforo["aforo_max"] = AFORO_MAX
    aforo["ratio_ocupacion"] = aforo["aforo"].apply(aforo_a_ratio)
    aforo["nivel_ocupacion"] = clasificar_nivel_serie(aforo["ratio_ocupacion"])

    aforo = aforo.rename(columns={"fecha_date": "fecha"}).sort_values(
        ["fecha", "hora_dec"]
    ).reset_index(drop=True)

    aforo.to_parquet(dst, index=False)
    logger.info("aforo_por_slot: %d filas. Escrito %s", len(aforo), dst)
    return aforo


# =============================================================================
#  T2 — Features académicas agregadas por (dia, slot)
# =============================================================================
def construir_features_academicas(
    horarios_slots: pd.DataFrame,
    poblacion_total: int = POBLACION_TOTAL,
) -> pd.DataFrame:
    """
    A partir de horarios_expandido_slots, agrega por (dia, slot) variables
    académicas que el modelo RF-01 puede usar como predictoras.
    """
    df = horarios_slots.copy()
    # Estudiantes por sección (tomamos matriculados sin repetir clase_id)
    agg_pres = (
        df[df["es_presencial"]]
        .groupby(["dia", "slot"])["matriculados"].sum()
        .reset_index(name="estudiantes_presencial")
    )
    agg_vir = (
        df[~df["es_presencial"]]
        .groupby(["dia", "slot"])["matriculados"].sum()
        .reset_index(name="estudiantes_virtual")
    )
    agg_secc = (
        df.groupby(["dia", "slot"])
        .agg(
            n_secciones_activas=("clase_id", "nunique"),
            n_cursos_activos=("cod_curso", "nunique"),
            n_facultades_activas=("facultad", "nunique"),
            duracion_prom_clases=("duracion_h", "mean"),
        )
        .reset_index()
    )

    feats = (
        agg_secc.merge(agg_pres, on=["dia", "slot"], how="left")
        .merge(agg_vir, on=["dia", "slot"], how="left")
    )
    feats[["estudiantes_presencial", "estudiantes_virtual"]] = feats[
        ["estudiantes_presencial", "estudiantes_virtual"]
    ].fillna(0).astype(int)

    feats["estudiantes_libres"] = (
        poblacion_total - feats["estudiantes_presencial"]
    ).clip(lower=0)
    feats["ratio_libres"] = feats["estudiantes_libres"] / poblacion_total
    feats["carga_academica"] = feats["estudiantes_presencial"] / poblacion_total
    total_mod = feats["estudiantes_presencial"] + feats["estudiantes_virtual"]
    feats["ratio_virtual"] = np.where(
        total_mod > 0, feats["estudiantes_virtual"] / total_mod, 0.0
    )

    # Modalidad predominante por slot
    def _modalidad_pred(row: pd.Series) -> str:
        if row["estudiantes_presencial"] == 0 and row["estudiantes_virtual"] == 0:
            return "sin_clases"
        if row["estudiantes_virtual"] == 0:
            return "presencial"
        if row["estudiantes_presencial"] == 0:
            return "virtual"
        return "mixta"

    feats["modalidad_predominante"] = feats.apply(_modalidad_pred, axis=1)
    return feats


# =============================================================================
#  T2 — Features completas para RF-01 (lags + cíclicas + históricos)
# =============================================================================
def construir_features_aforo_rf01(
    aforo_por_slot: Path | pd.DataFrame = AFORO_POR_SLOT_PARQUET,
    horarios_slots: Path | pd.DataFrame = HORARIOS_SLOTS_PARQUET,
    dst: Path = FEATURES_AFORO_PARQUET,
    poblacion_total: int = POBLACION_TOTAL,
) -> pd.DataFrame:
    """
    Tabla principal de features `features_aforo_rf01`.

    Incluye:
      - Identificadores: fecha, dia, slot, dia_num, hora_dec
      - Target y derivados: aforo, aforo_max, ratio_ocupacion
      - Lags: aforo_lag1, aforo_lag2 (slots previos del mismo día)
      - Promedio histórico por (dia, slot)
      - Codificación cíclica: hora_sin/cos, dia_sin/cos
      - Indicador de día académico (hay clases programadas)
      - Variables académicas: estudiantes_presencial, estudiantes_libres,
        ratio_libres, carga_academica, modalidad_predominante, ratio_virtual
    """
    ensure_dirs()
    if isinstance(aforo_por_slot, Path):
        aforo = pd.read_parquet(aforo_por_slot)
    else:
        aforo = aforo_por_slot.copy()
    if isinstance(horarios_slots, Path):
        horarios_slots = pd.read_parquet(horarios_slots)

    # Asegurar tipos
    aforo["fecha"] = pd.to_datetime(aforo["fecha"])
    aforo = aforo.sort_values(["fecha", "hora_dec"]).reset_index(drop=True)

    # --- Lags por día -------------------------------------------------------
    aforo["aforo_lag1"] = aforo.groupby("fecha")["aforo"].shift(1)
    aforo["aforo_lag2"] = aforo.groupby("fecha")["aforo"].shift(2)
    aforo[["aforo_lag1", "aforo_lag2"]] = aforo[["aforo_lag1", "aforo_lag2"]].fillna(0)

    # --- Promedio histórico por (dia, slot) ---------------------------------
    promedios = (
        aforo.groupby(["dia", "slot"])
        .agg(
            aforo_prom_hist=("aforo", "mean"),
            aforo_max_hist=("aforo", "max"),
        )
        .reset_index()
    )
    aforo = aforo.merge(promedios, on=["dia", "slot"], how="left")

    # --- Codificación cíclica -----------------------------------------------
    aforo["hora_sin"] = np.sin(2 * np.pi * aforo["hora_dec"] / 24)
    aforo["hora_cos"] = np.cos(2 * np.pi * aforo["hora_dec"] / 24)
    aforo["dia_sin"] = np.sin(2 * np.pi * aforo["dia_num"] / 7)
    aforo["dia_cos"] = np.cos(2 * np.pi * aforo["dia_num"] / 7)
    aforo["es_finde"] = (aforo["dia_num"] >= 5).astype(int)

    # --- Features académicas por (dia, slot) --------------------------------
    feats_acad = construir_features_academicas(horarios_slots, poblacion_total)
    aforo = aforo.merge(feats_acad, on=["dia", "slot"], how="left")
    cols_int = [
        "estudiantes_presencial", "estudiantes_virtual", "estudiantes_libres",
        "n_secciones_activas", "n_cursos_activos", "n_facultades_activas",
    ]
    for c in cols_int:
        aforo[c] = aforo[c].fillna(0).astype(int)
    cols_float = [
        "ratio_libres", "ratio_virtual", "carga_academica", "duracion_prom_clases",
    ]
    for c in cols_float:
        aforo[c] = aforo[c].fillna(0.0)
    aforo["modalidad_predominante"] = aforo["modalidad_predominante"].fillna("sin_clases")

    # --- Indicador de día académico -----------------------------------------
    aforo["es_dia_academico"] = (aforo["n_secciones_activas"] > 0).astype(int)

    # Reordenar columnas
    cols_orden = [
        # Identificadores
        "fecha", "dia", "dia_num", "slot", "hora_dec",
        # Target
        "aforo", "aforo_max", "ratio_ocupacion", "nivel_ocupacion",
        # Lags y promedios históricos
        "aforo_lag1", "aforo_lag2", "aforo_prom_hist", "aforo_max_hist",
        # Cíclicas
        "hora_sin", "hora_cos", "dia_sin", "dia_cos", "es_finde",
        # Académicas
        "es_dia_academico",
        "estudiantes_presencial", "estudiantes_virtual", "estudiantes_libres",
        "ratio_libres", "carga_academica", "ratio_virtual",
        "n_secciones_activas", "n_cursos_activos", "n_facultades_activas",
        "duracion_prom_clases", "modalidad_predominante",
    ]
    aforo = aforo[cols_orden].copy()

    aforo.to_parquet(dst, index=False)
    logger.info(
        "features_aforo_rf01: %d filas, %d columnas. Escrito %s",
        len(aforo), aforo.shape[1], dst,
    )
    return aforo


# =============================================================================
#  T4 — Disponibilidad por estudiante (para RF-02)
# =============================================================================
def construir_disponibilidad_estudiante(
    horarios_slots: pd.DataFrame,
    student_id: str,
    cursos_estudiante: list[str],
) -> pd.DataFrame:
    """
    Devuelve la disponibilidad del estudiante por (dia, slot) sobre la grilla
    operativa del gimnasio.

    Columnas: student_id, dia, slot, hora_dec, dia_num, ocupado, disponible.

    `cursos_estudiante` debe ser una lista de clase_id (cod_curso_seccion) en
    los que el estudiante está matriculado. Si vacía, se considera 100% libre
    en horario operativo.
    """
    grilla = construir_grilla_slots()
    ocupados = (
        horarios_slots[horarios_slots["clase_id"].isin(cursos_estudiante)]
        [["dia", "slot"]].drop_duplicates()
    )
    ocupados["ocupado"] = 1
    out = grilla.merge(ocupados, on=["dia", "slot"], how="left")
    out["ocupado"] = out["ocupado"].fillna(0).astype(int)
    out["disponible"] = 1 - out["ocupado"]
    out["student_id"] = student_id
    return out[["student_id", "dia", "dia_num", "slot", "hora_dec", "ocupado", "disponible"]]


def main() -> None:
    """Ejecuta toda la construcción de features."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    expandir_horarios_a_slots()
    construir_aforo_por_slot()
    construir_features_aforo_rf01()


if __name__ == "__main__":
    main()

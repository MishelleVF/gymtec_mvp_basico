
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from src.utils.paths import (
    HORARIOS_LIMPIOS_PARQUET,
    HORARIOS_XLSX,
    LOG_GYM_XLSX,
    LOGS_LIMPIOS_PARQUET,
    ensure_dirs,
)

logger = logging.getLogger(__name__)

# --- Diccionarios de normalización (del EDA DF1) -----------------------------
FACULTADES_MAP: dict[str, str] = {
    "CS": "Computación", "CY": "Computación", "DS": "Computación", "IS": "Computación",
    "CC": "Ciencias Generales",
    "GE": "Gestión", "GH": "Gestión", "GI": "Gestión",
    "HH": "Humanidades",
    "AM": "Ingeniería", "BI": "Ingeniería", "CI": "Ingeniería", "EL": "Ingeniería",
    "EN": "Ingeniería", "IN": "Ingeniería", "IQ": "Ingeniería", "ME": "Ingeniería",
    "MT": "Ingeniería", "PO": "Ingeniería", "QI": "Ingeniería",
    "BA": "Negocios", "AD": "Negocios",
    "PI": "Proyectos", "PR": "Proyectos",
}

DIAS_ABREV_MAP: dict[str, str] = {
    "Lun": "Lunes",
    "Mar": "Martes",
    "Mie": "Miércoles",
    "Mié": "Miércoles",
    "Jue": "Jueves",
    "Vie": "Viernes",
    "Sab": "Sábado",
    "Sáb": "Sábado",
    "Dom": "Domingo",
}

# Umbral de duración mínima de sesión (minutos). Sesiones por debajo se
# consideran ruidosas (entrar y salir casi inmediatamente).
DURACION_MIN_VALIDA: int = 16


# =============================================================================
#  HORARIOS DE CLASES (DF2)
# =============================================================================
def _split_horario(horario: str) -> tuple[str | None, str | None, str | None]:
    """
    Parsea cadenas tipo 'Mar. 15:00 - 17:00' -> ('Mar', '15:00', '17:00').
    Retorna (None, None, None) si no se puede parsear.
    """
    if not isinstance(horario, str) or not horario.strip():
        return None, None, None
    txt = horario.strip()
    # Patrones esperados: "Mar. 15:00 - 17:00" o "Mar 15:00 - 17:00"
    try:
        partes = txt.replace(".", "").split()
        if len(partes) < 4:
            return None, None, None
        dia_abrev = partes[0][:3]
        hora_ini = partes[1]
        hora_fin = partes[3]
        return dia_abrev, hora_ini, hora_fin
    except (IndexError, ValueError):
        return None, None, None


def clean_horarios(
    src: Path = HORARIOS_XLSX,
    dst: Path = HORARIOS_LIMPIOS_PARQUET,
) -> pd.DataFrame:

    ensure_dirs()
    logger.info("Cargando horarios crudos desde %s", src)
    df = pd.read_excel(src)

    # Normalización de espacios en blanco -> NaN
    df = df.replace(r"^\s*$", np.nan, regex=True)

    # Renombrado a snake_case y selección de columnas relevantes
    df["cod_curso"] = df["Código Curso"].astype(str).str.strip()
    df["nombre_curso"] = df["Curso"].astype(str).str.strip()
    df["seccion"] = df["Sección"].astype(int)
    df["modalidad"] = df["Modalidad"].astype(str).str.strip()
    df["matriculados"] = pd.to_numeric(df["Matriculados"], errors="coerce").fillna(0).astype(int)

    # Facultad: primeros 2 chars del código del curso
    df["facultad"] = df["cod_curso"].str[:2].map(FACULTADES_MAP)

    # Parseo del campo Horario
    horarios_split = df["Horario"].apply(_split_horario)
    df["dia_abrev"] = horarios_split.apply(lambda t: t[0])
    df["dia"] = df["dia_abrev"].map(DIAS_ABREV_MAP)
    df["hora_inicio"] = horarios_split.apply(lambda t: t[1])
    df["hora_fin"] = horarios_split.apply(lambda t: t[2])

    # Duración en horas
    h_ini = pd.to_datetime(df["hora_inicio"], format="%H:%M", errors="coerce")
    h_fin = pd.to_datetime(df["hora_fin"], format="%H:%M", errors="coerce")
    df["duracion_h"] = (h_fin - h_ini).dt.total_seconds() / 3600

    # Bandera de presencialidad
    df["es_presencial"] = (
        df["modalidad"].str.lower().str.contains("presencial", na=False)
    )

    # Identificador único de grupo de estudiantes
    df["clase_id"] = df["cod_curso"] + "_" + df["seccion"].astype(str)

    cols = [
        "facultad", "cod_curso", "nombre_curso", "seccion", "modalidad",
        "dia", "hora_inicio", "hora_fin", "duracion_h", "matriculados",
        "es_presencial", "clase_id",
    ]
    out = df[cols].copy()

    # Reglas de calidad: descartar filas sin día válido o con matriculados=0
    n0 = len(out)
    out = out[out["dia"].notna()].copy()
    out = out[out["matriculados"] > 0].copy()
    out = out[out["duracion_h"].notna() & (out["duracion_h"] > 0)].copy()
    logger.info("Horarios limpios: %d filas (descartadas %d)", len(out), n0 - len(out))

    out.to_parquet(dst, index=False)
    logger.info("Escrito %s", dst)
    return out


# =============================================================================
#  LOGS DE GIMNASIO (DF1)
# =============================================================================
def _detectar_outliers_cortos(df: pd.DataFrame) -> pd.DataFrame:
    """
    Identifica pares ingreso/salida con duración <DURACION_MIN_VALIDA min.
    Devuelve un DataFrame (student_id, fecha) de las sesiones a descartar.
    """
    ingresos = df[df["accion"] == "ingreso"][["student_id", "fecha", "timestamp"]].rename(
        columns={"timestamp": "ts_ingreso"}
    )
    salidas = df[df["accion"] == "salida"][["student_id", "fecha", "timestamp"]].rename(
        columns={"timestamp": "ts_salida"}
    )
    sesiones = ingresos.merge(salidas, on=["student_id", "fecha"], how="inner")
    sesiones["duracion_min"] = (
        sesiones["ts_salida"] - sesiones["ts_ingreso"]
    ).dt.total_seconds() / 60
    cortos = sesiones[sesiones["duracion_min"] < DURACION_MIN_VALIDA]
    return cortos[["student_id", "fecha"]].drop_duplicates()


def clean_logs_gym(
    src: Path = LOG_GYM_XLSX,
    dst: Path = LOGS_LIMPIOS_PARQUET,
) -> pd.DataFrame:
    """
    Carga logs crudos y produce la tabla SILVER `logs_limpios`.

    Columnas de salida:
      student_id, facultad, carrera, genero, fecha, hora, timestamp,
      accion, senal, ocupacion (acumulada por día)
    """
    ensure_dirs()
    logger.info("Cargando logs crudos desde %s", src)
    df = pd.read_excel(src)

    # Tipos
    df["fecha"] = pd.to_datetime(df["fecha"])
    df["hora_td"] = pd.to_timedelta(df["hora"].astype(str))
    df["timestamp"] = df["fecha"] + df["hora_td"]

    # Señal +1 / -1
    df["senal"] = df["accion"].map({"ingreso": 1, "salida": -1})
    if df["senal"].isna().any():
        raise ValueError("Hay valores de 'accion' no mapeables a +1/-1.")

    # Eliminar sesiones cortas (<16 min)
    cortos = _detectar_outliers_cortos(df)
    if not cortos.empty:
        antes = len(df)
        df = df.merge(cortos, on=["student_id", "fecha"], how="left", indicator=True)
        df = df[df["_merge"] == "left_only"].drop(columns="_merge")
        logger.info(
            "Eliminadas %d filas (%d sesiones <%dmin)",
            antes - len(df), len(cortos), DURACION_MIN_VALIDA,
        )

    # Ocupación acumulada por día (gym se vacía cada noche)
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["ocupacion"] = df.groupby(df["fecha"].dt.date)["senal"].cumsum()

    if (df["ocupacion"] < 0).any():
        logger.warning(
            "Hay %d eventos con ocupación negativa (salidas sin ingreso previo).",
            int((df["ocupacion"] < 0).sum()),
        )

    cols = [
        "student_id", "facultad", "carrera", "genero",
        "fecha", "hora", "timestamp", "accion", "senal", "ocupacion",
    ]
    out = df[cols].copy()
    out.to_parquet(dst, index=False)
    logger.info("Logs limpios: %d filas. Escrito %s", len(out), dst)
    return out


def main() -> None:
    """Ejecuta la limpieza de las dos fuentes."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    clean_horarios()
    clean_logs_gym()


if __name__ == "__main__":
    main()

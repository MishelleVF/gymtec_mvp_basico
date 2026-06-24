"""
Rutas y constantes globales del pipeline GYMTEC.

Centraliza paths y parámetros para que el resto del código no hardcodee
ubicaciones. Trazabilidad: RF-01, RF-02, RF-03, RF-04, RF-06, RF-07.
"""
from __future__ import annotations

from pathlib import Path

# --- Rutas base ---------------------------------------------------------------
ROOT_DIR: Path = Path(__file__).resolve().parents[2]

DATA_DIR: Path = ROOT_DIR / "data"
RAW_DIR: Path = DATA_DIR / "raw"
INTERIM_DIR: Path = DATA_DIR / "interim"
PROCESSED_DIR: Path = DATA_DIR / "processed"

# --- Inputs (Bronze) ----------------------------------------------------------
LOG_GYM_XLSX: Path = RAW_DIR / "log_gym.xlsx"
HORARIOS_XLSX: Path = RAW_DIR / "horarios_clases.xlsx"

# --- Outputs SILVER (data/interim) -------------------------------------------
LOGS_LIMPIOS_PARQUET: Path = INTERIM_DIR / "logs_limpios.parquet"
HORARIOS_LIMPIOS_PARQUET: Path = INTERIM_DIR / "horarios_limpios.parquet"
HORARIOS_SLOTS_PARQUET: Path = INTERIM_DIR / "horarios_expandido_slots.parquet"

# --- Outputs GOLD (data/processed) -------------------------------------------
AFORO_POR_SLOT_PARQUET: Path = PROCESSED_DIR / "aforo_por_slot.parquet"
FEATURES_AFORO_PARQUET: Path = PROCESSED_DIR / "features_aforo_rf01.parquet"
PREDICCIONES_AFORO_PARQUET: Path = PROCESSED_DIR / "predicciones_aforo.parquet"
RECOMENDACIONES_PARQUET: Path = PROCESSED_DIR / "recomendaciones_horario.parquet"

# Mirrors en CSV para que el backend o el frontend puedan consumir sin parquet
PREDICCIONES_AFORO_CSV: Path = PROCESSED_DIR / "predicciones_aforo.csv"
RECOMENDACIONES_CSV: Path = PROCESSED_DIR / "recomendaciones_horario.csv"

# --- Modelos entrenados -------------------------------------------------------
MODELS_DIR: Path = ROOT_DIR / "models_artifacts"

# Modelo 1 — RF-01: predicción de aforo
MODEL_AFORO_PKL: Path = MODELS_DIR / "rf01_aforo_baseline.pkl"
MODEL_AFORO_JOBLIB: Path = MODEL_AFORO_PKL  # alias retrocompat
MODEL_METRICS_JSON: Path = MODELS_DIR / "rf01_aforo_metrics.json"

# Modelo 2 — RF-02: score de recomendación de horarios
MODEL_RECO_PKL: Path = MODELS_DIR / "rf02_recomendador_score.pkl"
MODEL_RECO_JOBLIB: Path = MODEL_RECO_PKL  # alias retrocompat
MODEL_RECO_METRICS_JSON: Path = MODELS_DIR / "rf02_recomendador_metrics.json"

# --- Parámetros del dominio ---------------------------------------------------
# Población total estimada del campus UTEC (referencia EDA DF1).
POBLACION_TOTAL: int = 5000

# Granularidad temporal de los slots (minutos). Coherente con EDA.
SLOT_MIN: int = 30

# Aforo maximo del gimnasio. Configurable; default consistente con la UI mock.
AFORO_MAX: int = 50

# Horario operativo del gimnasio (hora_dec inicio inclusive, fin exclusive).
HORARIO_GYM: dict[str, tuple[float, float]] = {
    "Lunes": (9.0, 18.0),
    "Martes": (9.0, 18.0),
    "Miércoles": (9.0, 18.0),
    "Jueves": (9.0, 18.0),
    "Viernes": (9.0, 18.0),
    "Sábado": (8.0, 13.0),
}

ORDEN_DIAS: list[str] = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
]
DIA_A_NUM: dict[str, int] = {d: i for i, d in enumerate(ORDEN_DIAS)}

# Umbrales de nivel de ocupación (RF-06). Sobre ratio = aforo / AFORO_MAX.
NIVEL_THRESHOLDS: dict[str, float] = {
    "bajo": 0.50,
    "medio": 0.75,
    "alto": 0.90,
    # > alto se etiqueta como "critico"
}


def ensure_dirs() -> None:
    """Crea directorios de output si no existen."""
    for path in [INTERIM_DIR, PROCESSED_DIR, MODELS_DIR]:
        path.mkdir(parents=True, exist_ok=True)

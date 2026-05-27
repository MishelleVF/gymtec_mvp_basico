"""
FastAPI — backend de GYMTEC.

Sirve las predicciones de aforo (RF-01) y recomendaciones de horarios
(RF-02) que generó el pipeline ML en `data/processed/`.

Endpoints originales:
  GET  /health
  GET  /predictions/today
  GET  /predictions
  GET  /low-occupancy
  POST /recommendations
  GET  /occupancy/heatmap
  GET  /occupancy/current
  GET  /admin/metrics

Endpoints compatibles con el frontend actual:
  GET  /api/v1/health
  GET  /api/v1/forecast/week
  GET  /api/v1/predictions
  GET  /api/v1/predictions/today
  POST /api/v1/schedule
  POST /api/v1/recommendations/today

Para correrlo:
    uvicorn app.api.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import unicodedata
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.recommendation.recommend_schedule import (
    franjas_menor_aforo,
    recomendar_para_estudiante,
)
from src.utils.paths import (
    AFORO_POR_SLOT_PARQUET,
    PREDICCIONES_AFORO_PARQUET,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GYMTEC API",
    description="Predicción de aforo y recomendación de horarios para UTEC.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Estado temporal para desarrollo
# -----------------------------------------------------------------------------
# El frontend primero llama POST /api/v1/schedule y luego
# POST /api/v1/recommendations/today. Guardamos el último horario recibido
# para poder filtrarlo aunque recommendations/today llegue sin busySlots.
LAST_SCHEDULE_PAYLOAD: dict[str, Any] = {}


# -----------------------------------------------------------------------------
# Constantes
# -----------------------------------------------------------------------------
DIA_EN_A_ES = {
    "Monday": "Lunes",
    "Tuesday": "Martes",
    "Wednesday": "Miércoles",
    "Thursday": "Jueves",
    "Friday": "Viernes",
    "Saturday": "Sábado",
    "Sunday": "Domingo",
}

DIA_NORM_A_CANONICO = {
    "lunes": "Lunes",
    "l": "Lunes",
    "lun": "Lunes",

    "martes": "Martes",
    "m": "Martes",
    "mar": "Martes",

    "miercoles": "Miércoles",
    "x": "Miércoles",
    "mie": "Miércoles",

    "jueves": "Jueves",
    "j": "Jueves",
    "jue": "Jueves",

    "viernes": "Viernes",
    "v": "Viernes",
    "vie": "Viernes",

    "sabado": "Sábado",
    "s": "Sábado",
    "sab": "Sábado",

    "domingo": "Domingo",
    "d": "Domingo",
    "dom": "Domingo",
}

DIAS_VALIDOS = set(DIA_NORM_A_CANONICO.values())


# -----------------------------------------------------------------------------
# Helpers generales
# -----------------------------------------------------------------------------
def _remove_accents(value: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", value)
        if unicodedata.category(c) != "Mn"
    )


def _normalize_day(value: Any) -> str:
    """
    Normaliza días a una llave uniforme.

    Soporta:
    - L, M, X, J, V, S
    - Lun, Mar, Mie, Jue, Vie, Sab
    - Lunes, Martes, Miércoles, etc.

    Importante:
    En horarios universitarios:
      L = Lunes
      M = Martes
      X = Miércoles
      J = Jueves
      V = Viernes
      S = Sábado
    """
    if value is None:
        return ""

    raw = _remove_accents(str(value).strip().lower())

    replacements = {
        # Códigos de 1 letra del frontend
        "l": "lunes",
        "m": "martes",
        "x": "miercoles",
        "j": "jueves",
        "v": "viernes",
        "s": "sabado",
        "d": "domingo",

        # Abreviaciones
        "lun": "lunes",
        "mar": "martes",
        "mie": "miercoles",
        "mié": "miercoles",
        "jue": "jueves",
        "vie": "viernes",
        "sab": "sabado",
        "sáb": "sabado",
        "dom": "domingo",

        # Nombres completos
        "lunes": "lunes",
        "martes": "martes",
        "miercoles": "miercoles",
        "miércoles": "miercoles",
        "jueves": "jueves",
        "viernes": "viernes",
        "sabado": "sabado",
        "sábado": "sabado",
        "domingo": "domingo",
    }

    return replacements.get(raw, raw)


def _canonical_day(value: Any) -> str:
    norm = _normalize_day(value)
    return DIA_NORM_A_CANONICO.get(norm, str(value))


def _today_es() -> str:
    today_en = datetime.now().strftime("%A")
    return DIA_EN_A_ES.get(today_en, "Lunes")


def _to_hhmm(value: Any) -> str:
    """
    Normaliza horas a formato HH:MM.

    Acepta:
      9
      9.0
      "9"
      "09"
      "9:00"
      "09:00"
      "09:00:00"
    """
    if value is None:
        return ""

    if isinstance(value, (pd.Timestamp, datetime)):
        return value.strftime("%H:%M")

    raw = str(value).strip()

    if not raw:
        return ""

    # Caso "09:00:00" o "9:00"
    if ":" in raw:
        parts = raw.split(":")
        try:
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            return f"{hour:02d}:{minute:02d}"
        except Exception:
            return raw[:5]

    # Caso "9", "09", "9.0"
    try:
        hour = int(float(raw))
        return f"{hour:02d}:00"
    except Exception:
        return raw[:5]


def _time_to_minutes(value: Any) -> int:
    hhmm = _to_hhmm(value)

    try:
        hour, minute = hhmm.split(":")
        return int(hour) * 60 + int(minute)
    except Exception:
        return 0


def _minutes_to_hhmm(minutes: int) -> str:
    hour = minutes // 60
    minute = minutes % 60
    return f"{hour:02d}:{minute:02d}"


def _add_minutes_to_hhmm(value: Any, minutes: int = 60) -> str:
    return _minutes_to_hhmm(_time_to_minutes(value) + minutes)


def _json_safe(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, np.integer):
        return int(value)

    if isinstance(value, np.floating):
        if np.isnan(value):
            return None
        return float(value)

    if isinstance(value, np.ndarray):
        return value.tolist()

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    return value


def _df_to_records(df: pd.DataFrame) -> list[dict]:
    records = df.to_dict(orient="records")

    return [
        {key: _json_safe(value) for key, value in record.items()}
        for record in records
    ]


def _level_to_frontend(value: Any) -> str:
    """
    El frontend espera:
      "Bajo" | "Medio" | "Alto"

    El modelo/backend puede mandar:
      bajo, medio, alto, critico, crítico, lleno, etc.
    """
    raw = _remove_accents(str(value or "").strip().lower())

    if "medio" in raw or "moderado" in raw:
        return "Medio"

    if "alto" in raw or "critico" in raw or "lleno" in raw:
        return "Alto"

    return "Bajo"


def _has_busy_data(payload: dict[str, Any]) -> bool:
    keys = [
        "busySlots",
        "busy_slots",
        "schedule",
        "horario_ocupado",
        "classes",
        "clases",
    ]

    return any(payload.get(key) for key in keys)


def _extract_busy_items(payload: dict[str, Any]) -> list[Any]:
    """
    Soporta varios contratos posibles del frontend.
    """
    raw = (
        payload.get("busySlots")
        or payload.get("busy_slots")
        or payload.get("schedule")
        or payload.get("horario_ocupado")
        or payload.get("classes")
        or payload.get("clases")
        or []
    )

    # Caso:
    # {
    #   "schedule": {
    #       "Miércoles": ["09:00", "09:30"]
    #   }
    # }
    if isinstance(raw, dict):
        expanded = []
        for day, slots in raw.items():
            if isinstance(slots, list):
                for slot in slots:
                    if isinstance(slot, dict):
                        slot["dia"] = slot.get("dia") or day
                        expanded.append(slot)
                    else:
                        expanded.append({"dia": day, "slot": slot})
            else:
                expanded.append({"dia": day, "slot": slots})
        return expanded

    if isinstance(raw, list):
        return raw

    return []


def _extract_busy_set(payload: dict[str, Any]) -> set[str]:
    """
    Devuelve un set tipo:
        {"miercoles|09:00", "miercoles|09:30"}

    Si una clase dura 09:00-10:00, bloquea:
        09:00 y 09:30
    """
    busy_items = _extract_busy_items(payload)

    default_day = (
        payload.get("dia")
        or payload.get("day")
        or payload.get("dia_nombre")
        or _today_es()
    )

    busy_set: set[str] = set()

    for item in busy_items:
        # Caso simple: ["09:00", "10:00"]
        if isinstance(item, str):
            dia_norm = _normalize_day(default_day)
            start_min = _time_to_minutes(item)
            busy_set.add(f"{dia_norm}|{_minutes_to_hhmm(start_min)}")
            continue

        if not isinstance(item, dict):
            continue

        dia = (
            item.get("dia")
            or item.get("day")
            or item.get("dayName")
            or item.get("dia_nombre")
            or default_day
        )

        start = (
            item.get("slot")
            or item.get("hora")
            or item.get("time")
            or item.get("start_time")
            or item.get("startTime")
            or item.get("hora_inicio")
            or item.get("inicio")
        )

        end = (
            item.get("end_time")
            or item.get("endTime")
            or item.get("hora_fin")
            or item.get("fin")
        )

        dia_norm = _normalize_day(dia)

        if not dia_norm or not start:
            continue

        start_min = _time_to_minutes(start)

        if end:
            end_min = _time_to_minutes(end)
        else:
            # Si solo llega un slot, bloqueamos 1 hora por seguridad.
            end_min = start_min + 60

        # Si por error el fin es menor o igual, bloquea al menos 1 hora.
        if end_min <= start_min:
            end_min = start_min + 60

        current = start_min

        while current < end_min:
            busy_set.add(f"{dia_norm}|{_minutes_to_hhmm(current)}")
            current += 30

    return busy_set


def _load_predicciones() -> pd.DataFrame:
    if not PREDICCIONES_AFORO_PARQUET.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "predicciones_aforo no disponible. "
                "Ejecuta `python -m src.run_pipeline`."
            ),
        )

    return pd.read_parquet(PREDICCIONES_AFORO_PARQUET)


def _load_aforo() -> pd.DataFrame:
    if not AFORO_POR_SLOT_PARQUET.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "aforo_por_slot no disponible. "
                "Ejecuta `python -m src.run_pipeline`."
            ),
        )

    return pd.read_parquet(AFORO_POR_SLOT_PARQUET)


def _filter_by_day(df: pd.DataFrame, dia: Any) -> pd.DataFrame:
    if "dia" not in df.columns:
        return df

    target_norm = _normalize_day(dia)

    if not target_norm:
        return df

    temp = df.copy()
    temp["dia_norm"] = temp["dia"].apply(_normalize_day)

    filtered = temp[temp["dia_norm"] == target_norm].copy()

    if filtered.empty:
        return df

    return filtered


def _prepare_prediction_frame_for_recommendations(
    df: pd.DataFrame,
    payload: dict[str, Any],
) -> pd.DataFrame:
    """
    Filtra:
    1. Solo día actual o día solicitado.
    2. Horarios ocupados del estudiante.
    3. Ordena por menor aforo predicho.
    """
    out = df.copy()

    requested_day = (
        payload.get("dia")
        or payload.get("day")
        or payload.get("dia_nombre")
        or _today_es()
    )

    out = _filter_by_day(out, requested_day)

    busy_set = _extract_busy_set(payload)
    print("PAYLOAD USADO PARA FILTRAR:", payload)
    print("BUSY SET NORMALIZADO:", busy_set)

    if busy_set and "dia" in out.columns and "slot" in out.columns:
        out["dia_norm"] = out["dia"].apply(_normalize_day)
        out["slot_norm"] = out["slot"].apply(_to_hhmm)
        out["busy_key"] = out["dia_norm"] + "|" + out["slot_norm"]
        out = out[~out["busy_key"].isin(busy_set)].copy()

    sort_col = None

    for candidate in [
        "ratio_ocupacion_predicho",
        "aforo_predicho",
        "ratio_ocupacion",
        "aforo",
    ]:
        if candidate in out.columns:
            sort_col = candidate
            break

    if sort_col:
        out = out.sort_values(sort_col, ascending=True)

    return out


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RecommendationsRequest(BaseModel):
    student_id: str
    cursos: list[str]
    top_n: int = 3


# -----------------------------------------------------------------------------
# Endpoints originales
# -----------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "gymtec-api", "version": "0.1.0"}


@app.get("/predictions/today")
def predictions_today() -> list[dict]:
    df = _load_predicciones()
    today_es = _today_es()
    out = _filter_by_day(df, today_es)
    return _df_to_records(out)


@app.get("/predictions")
def predictions(
    dia: str | None = Query(default=None, description="Lunes, Martes, ..."),
) -> list[dict]:
    df = _load_predicciones()

    if dia:
        dia_canonico = _canonical_day(dia)

        if dia_canonico not in DIAS_VALIDOS:
            raise HTTPException(
                status_code=400,
                detail=f"`dia` debe ser uno de {sorted(DIAS_VALIDOS)}",
            )

        df = _filter_by_day(df, dia_canonico)

    return _df_to_records(df)


@app.get("/low-occupancy")
def low_occupancy(
    dia: str = Query(..., description="Día de la semana"),
    top: int = Query(default=5, ge=1, le=20),
) -> list[dict]:
    dia_canonico = _canonical_day(dia)

    if dia_canonico not in DIAS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"`dia` debe ser uno de {sorted(DIAS_VALIDOS)}",
        )

    df = franjas_menor_aforo(dia_canonico, top_n=top)
    return _df_to_records(df)


@app.post("/recommendations")
def recommendations(payload: RecommendationsRequest) -> list[dict]:
    df = recomendar_para_estudiante(
        student_id=payload.student_id,
        cursos_estudiante=payload.cursos,
        top_n=payload.top_n,
    )

    return _df_to_records(df)


@app.get("/occupancy/heatmap")
def occupancy_heatmap() -> dict:
    df = _load_aforo()

    pivot = (
        df.pivot_table(
            index="dia",
            columns="slot",
            values="ratio_ocupacion",
            aggfunc="mean",
        )
        .fillna(0)
    )

    return {
        "dias": pivot.index.tolist(),
        "slots": pivot.columns.tolist(),
        "matriz": pivot.round(3).values.tolist(),
    }


@app.get("/occupancy/current")
def occupancy_current() -> dict:
    df = _load_aforo()

    last = df.sort_values(["fecha", "hora_dec"]).iloc[-1]

    return {
        "fecha": (
            last["fecha"].isoformat()
            if hasattr(last["fecha"], "isoformat")
            else str(last["fecha"])
        ),
        "dia": last["dia"],
        "slot": last["slot"],
        "aforo": int(last["aforo"]),
        "aforo_max": int(last["aforo_max"]),
        "ratio_ocupacion": float(last["ratio_ocupacion"]),
        "nivel_ocupacion": last["nivel_ocupacion"],
    }


@app.get("/admin/metrics")
def admin_metrics() -> list[dict]:
    pred = _load_predicciones()
    today_es = _today_es()
    hoy = _filter_by_day(pred, today_es)

    if hoy.empty:
        return []

    hora_actual = datetime.now().hour

    if "hora_dec" in hoy.columns:
        proximas = hoy[hoy["hora_dec"] >= hora_actual].head(2)
    else:
        proximas = hoy.head(2)

    valor_proximo = (
        int(proximas["aforo_predicho"].iloc[0])
        if len(proximas) and "aforo_predicho" in proximas.columns
        else 0
    )

    nivel_proximo = (
        str(proximas["nivel_ocupacion"].iloc[0])
        if len(proximas) and "nivel_ocupacion" in proximas.columns
        else "desconocido"
    )

    aforo_max = (
        int(hoy["aforo_max"].iloc[0])
        if "aforo_max" in hoy.columns and len(hoy)
        else 0
    )

    return [
        {
            "label": "AFORO ACTUAL EN SALA",
            "value": f"{valor_proximo} / {aforo_max}",
            "accent": "cyan" if nivel_proximo in {"bajo", "medio"} else "yellow",
        },
        {
            "label": "PRÓXIMA HORA (PREDICHO)",
            "value": (
                str(int(proximas["aforo_predicho"].mean()))
                if len(proximas) and "aforo_predicho" in proximas.columns
                else "0"
            ),
            "accent": "cyan",
        },
        {
            "label": "NIVEL GENERAL HOY",
            "value": (
                str(hoy["nivel_ocupacion"].mode().iloc[0])
                if "nivel_ocupacion" in hoy.columns and not hoy.empty
                else "desconocido"
            ),
            "accent": "yellow",
        },
    ]


# -----------------------------------------------------------------------------
# Endpoints compatibles con frontend actual
# -----------------------------------------------------------------------------
@app.get("/api/v1/health")
def api_v1_health() -> dict:
    return health()

def _expected_occupancy_from_row(row: dict) -> str:
    """
    Calcula Bajo / Medio / Alto para el frontend semanal.

    Prioridad:
    1. ratio_ocupacion_predicho
    2. ratio_ocupacion
    3. aforo_predicho / aforo_max
    4. nivel_ocupacion textual
    """

    ratio = None

    for key in ["ratio_ocupacion_predicho", "ratio_ocupacion"]:
        value = row.get(key)

        try:
            if value is not None and pd.notna(value):
                ratio = float(value)
                break
        except Exception:
            pass

    if ratio is None:
        aforo = (
            row.get("aforo_predicho")
            or row.get("aforo")
            or row.get("occupancy")
            or 0
        )

        aforo_max = (
            row.get("aforo_max")
            or row.get("capacity")
            or 0
        )

        try:
            aforo = float(aforo)
            aforo_max = float(aforo_max)

            if aforo_max > 0:
                ratio = aforo / aforo_max
        except Exception:
            ratio = None

    if ratio is not None:
        # Si viene como porcentaje 0-100, lo pasamos a 0-1
        if ratio > 1:
            ratio = ratio / 100

        if ratio < 0.40:
            return "Bajo"

        if ratio < 0.70:
            return "Medio"

        return "Alto"

    nivel_raw = (
        row.get("nivel_ocupacion")
        or row.get("nivel_ocupacion_predicho")
        or row.get("expected_occupancy")
        or "bajo"
    )

    return _level_to_frontend(nivel_raw)
def _week_day_code(value: Any) -> str:
    """
    Convierte días a los códigos que usa el frontend semanal:
    L, M, X, J, V, S
    """
    norm = _normalize_day(value)

    mapping = {
        "lunes": "L",
        "martes": "M",
        "miercoles": "X",
        "jueves": "J",
        "viernes": "V",
        "sabado": "S",
        "domingo": "D",
    }

    return mapping.get(norm, str(value))


def _safe_float(value: Any) -> float | None:
    try:
        if value is None or pd.isna(value):
            return None

        return float(value)
    except Exception:
        return None


def _prediction_score_from_row(row: dict) -> float | None:
    """
    Obtiene un score numérico real desde el modelo.

    Prioridad:
    1. ratio_ocupacion_predicho
    2. ratio_ocupacion
    3. aforo_predicho / aforo_max
    4. aforo_predicho
    """

    for key in ["ratio_ocupacion_predicho", "ratio_ocupacion"]:
        ratio = _safe_float(row.get(key))

        if ratio is not None:
            if ratio > 1:
                ratio = ratio / 100

            return ratio

    aforo_predicho = _safe_float(
        row.get("aforo_predicho")
        or row.get("aforo")
        or row.get("occupancy")
    )

    aforo_max = _safe_float(
        row.get("aforo_max")
        or row.get("capacity")
    )

    if aforo_predicho is not None and aforo_max is not None and aforo_max > 0:
        return aforo_predicho / aforo_max

    if aforo_predicho is not None:
        return aforo_predicho

    return None


def _level_from_score_by_percentiles(
    score: float | None,
    q_low: float | None,
    q_high: float | None,
    fallback_level: Any = "bajo",
) -> str:
    """
    Convierte el score del modelo a Bajo / Medio / Alto.

    Usamos percentiles porque para la demo puede pasar que todos los ratios sean
    menores a 0.40, pero igual hay horarios relativamente más llenos que otros.
    """
    if score is None or q_low is None or q_high is None:
        return _level_to_frontend(fallback_level)

    if score <= q_low:
        return "Bajo"

    if score <= q_high:
        return "Medio"

    return "Alto"


def _build_week_thresholds(records: list[dict]) -> tuple[float | None, float | None]:
    scores = []

    for row in records:
        score = _prediction_score_from_row(row)

        if score is not None:
            scores.append(score)

    if len(scores) < 3:
        return None, None

    unique_scores = set(round(score, 6) for score in scores)

    if len(unique_scores) < 3:
        return None, None

    serie = pd.Series(scores)

    q_low = float(serie.quantile(0.33))
    q_high = float(serie.quantile(0.66))

    return q_low, q_high

@app.get("/api/v1/forecast/week")
def api_v1_forecast_week() -> dict:
    """
    Forecast semanal para la pantalla /week del frontend.

    Importante:
    - day debe ser L, M, X, J, V, S porque así lo usa el grid.
    - expected_occupancy debe ser Bajo, Medio o Alto.
    - El nivel se calcula con percentiles sobre el score real del modelo.
    """
    df = _load_predicciones().copy()

    records = _df_to_records(df)

    q_low, q_high = _build_week_thresholds(records)

    heatmap = []

    for row in records:
        day_name = (
            row.get("dia")
            or row.get("day_name")
            or row.get("dia_nombre")
            or "Día no disponible"
        )

        day_code = _week_day_code(day_name)

        time = (
            row.get("slot")
            or row.get("time")
            or row.get("hora")
            or row.get("start_time")
            or "00:00"
        )

        time = _to_hhmm(time)
        hour = time[:2]

        score = _prediction_score_from_row(row)

        fallback_level = (
            row.get("nivel_ocupacion")
            or row.get("nivel_ocupacion_predicho")
            or row.get("expected_occupancy")
            or "bajo"
        )

        expected_occupancy = _level_from_score_by_percentiles(
            score=score,
            q_low=q_low,
            q_high=q_high,
            fallback_level=fallback_level,
        )

        aforo_predicho = (
            row.get("aforo_predicho")
            or row.get("aforo")
            or row.get("occupancy")
            or 0
        )

        aforo_max = (
            row.get("aforo_max")
            or row.get("capacity")
            or 0
        )

        heatmap.append(
            {
                # Para el grid semanal
                "day": day_code,
                "day_name": day_name,
                "dia": day_name,

                # Para matching por hora
                "hour": hour,
                "time": time,
                "slot": time,
                "start_time": time,
                "end_time": _add_minutes_to_hhmm(time, 60),

                # Para colores
                "expected_occupancy": expected_occupancy,
                "nivel_ocupacion": expected_occupancy,

                # Valores reales del modelo
                "score": score,
                "occupancy": aforo_predicho,
                "aforo_predicho": aforo_predicho,
                "aforo_max": aforo_max,
                "ratio_ocupacion_predicho": row.get("ratio_ocupacion_predicho"),
                "ratio_ocupacion": row.get("ratio_ocupacion"),

                "confidence": 0.89,
            }
        )

    counts_by_level = {
        "Bajo": sum(1 for p in heatmap if p["expected_occupancy"] == "Bajo"),
        "Medio": sum(1 for p in heatmap if p["expected_occupancy"] == "Medio"),
        "Alto": sum(1 for p in heatmap if p["expected_occupancy"] == "Alto"),
    }

    counts_by_day = {}

    for p in heatmap:
        if p["expected_occupancy"] == "Bajo":
            counts_by_day[p["day"]] = counts_by_day.get(p["day"], 0) + 1

    best_day = None

    if counts_by_day:
        best_day = max(counts_by_day.items(), key=lambda item: item[1])[0]

    print("WEEK DEBUG - thresholds:", {"q_low": q_low, "q_high": q_high})
    print("WEEK DEBUG - counts_by_level:", counts_by_level)
    print("WEEK DEBUG - sample heatmap:", heatmap[:5])

    return {
        "success": True,

        "data": records,
        "predictions": records,
        "heatmap": heatmap,

        "average_confidence": 0.89,
        "confidence_avg": 0.89,
        "confidence": 0.89,

        "best_day": best_day,
        "best_day_label": best_day,

        "debug": {
            "total_points": len(heatmap),
            "q_low": q_low,
            "q_high": q_high,
            "counts_by_level": counts_by_level,
            "counts_by_day": counts_by_day,
            "sample": heatmap[:10],
        },

        "message": "Forecast semanal generado correctamente",
    }




@app.get("/api/v1/predictions")
def api_v1_predictions(
    dia: str | None = Query(default=None),
) -> dict:
    df = _load_predicciones().copy()

    if dia:
        df = _filter_by_day(df, dia)

    records = _df_to_records(df)

    return {
        "success": True,
        "data": records,
        "predictions": records,
    }


@app.get("/api/v1/predictions/today")
def api_v1_predictions_today() -> dict:
    records = predictions_today()

    return {
        "success": True,
        "data": records,
        "predictions": records,
    }


@app.post("/api/v1/schedule")
def api_v1_schedule(payload: dict = Body(default_factory=dict)) -> dict:
    """
    Recibe y guarda temporalmente el horario ocupado del alumno.
    Esto permite que /api/v1/recommendations/today filtre aunque el frontend
    no vuelva a mandar busySlots en el segundo request.
    """
    global LAST_SCHEDULE_PAYLOAD

    LAST_SCHEDULE_PAYLOAD = payload or {}

    busy_set = _extract_busy_set(LAST_SCHEDULE_PAYLOAD)

    return {
        "success": True,
        "message": "Horario recibido correctamente",
        "received": LAST_SCHEDULE_PAYLOAD,
        "busySet": sorted(busy_set),
    }


@app.post("/api/v1/recommendations/today")
def api_v1_recommendations_today(
    payload: dict = Body(default_factory=dict),
) -> dict:
    """
    Recomendaciones rápidas cruzando:
    - predicción de aforo
    - horario ocupado del estudiante

    Si este endpoint recibe busySlots, usa ese horario.
    Si no recibe busySlots, usa el último horario guardado por /api/v1/schedule.
    """
    incoming_payload = payload or {}

    print("PAYLOAD RECIBIDO EN RECOMMENDATIONS:", incoming_payload)

    if _has_busy_data(incoming_payload):
        effective_payload = incoming_payload
    else:
        effective_payload = {
            **LAST_SCHEDULE_PAYLOAD,
            **incoming_payload,
        }

    df = _load_predicciones().copy()

    top_n = (
        incoming_payload.get("topN")
        or incoming_payload.get("top_n")
        or effective_payload.get("topN")
        or effective_payload.get("top_n")
        or 3
    )

    try:
        top_n = int(top_n)
    except Exception:
        top_n = 3

    top_n = max(1, min(top_n, 10))

    filtered = _prepare_prediction_frame_for_recommendations(
        df=df,
        payload=effective_payload,
    )

    filtered = filtered.head(top_n).copy()

    recommendations: list[dict[str, Any]] = []

    for _, row in filtered.iterrows():
        dia = row.get("dia", _today_es())
        slot = _to_hhmm(row.get("slot", row.get("hora", "00:00")))

        aforo_predicho = row.get("aforo_predicho", row.get("aforo", 0))
        aforo_max = row.get("aforo_max", 0)

        nivel_raw = row.get(
            "nivel_ocupacion",
            row.get("nivel_ocupacion_predicho", "bajo"),
        )

        expected_occupancy = _level_to_frontend(nivel_raw)

        try:
            aforo_predicho_int = int(aforo_predicho) if pd.notna(aforo_predicho) else 0
        except Exception:
            aforo_predicho_int = 0

        try:
            aforo_max_int = int(aforo_max) if pd.notna(aforo_max) else 0
        except Exception:
            aforo_max_int = 0

        recommendations.append(
            {
                "dia": dia,
                "slot": slot,
                "hora": slot,
                "time": slot,
                "start_time": slot,
                "end_time": _add_minutes_to_hhmm(slot, 60),

                "aforoPredicho": aforo_predicho_int,
                "aforo_predicho": aforo_predicho_int,
                "aforoMax": aforo_max_int,
                "aforo_max": aforo_max_int,

                "nivel": str(nivel_raw),
                "nivel_ocupacion": str(nivel_raw),
                "expected_occupancy": expected_occupancy,

                "confidence": 0.89,
                "reason": (
                    f"Recomendado porque estás libre y el aforo esperado es "
                    f"{str(nivel_raw).lower()}."
                ),
                "razon": (
                    f"Recomendado porque estás libre y el aforo esperado es "
                    f"{str(nivel_raw).lower()}."
                ),
            }
        )

    daily_forecast = [
        {
            "start_time": rec["start_time"],
            "end_time": rec["end_time"],
            "time": rec["time"],
            "dia": rec["dia"],

            "occupancy": rec["aforoPredicho"],
            "aforo_predicho": rec["aforoPredicho"],
            "aforo_max": rec["aforoMax"],

            "expected_occupancy": rec["expected_occupancy"],
            "level": rec["expected_occupancy"],
            "nivel": rec["nivel"],
            "nivel_ocupacion": rec["nivel_ocupacion"],

            "confidence": rec["confidence"],
            "reason": rec["reason"],
        }
        for rec in recommendations
    ]

    best_recommendation = (
        daily_forecast[0]
        if daily_forecast
        else {
            "start_time": "No disponible",
            "end_time": "No disponible",
            "time": "No disponible",
            "dia": _today_es(),
            "occupancy": 0,
            "aforo_predicho": 0,
            "aforo_max": 0,
            "expected_occupancy": "Bajo",
            "level": "Bajo",
            "nivel": "desconocido",
            "nivel_ocupacion": "desconocido",
            "confidence": 0,
            "reason": "No hay recomendaciones disponibles.",
        }
    )

    return {
        "success": True,

        # Formato general
        "data": recommendations,
        "recommendations": recommendations,

        # Formato para pantalla Today
        "daily_forecast": daily_forecast,
        "best_recommendation": best_recommendation,
        "best_recommended_time": best_recommendation["start_time"],

        # Formato para pantalla /recommendations
        "top_recommendations": daily_forecast,

        "debug": {
            "usedSchedulePayload": effective_payload,
            "busySet": sorted(_extract_busy_set(effective_payload)),
        },

        "message": "Recomendaciones generadas correctamente",
    }
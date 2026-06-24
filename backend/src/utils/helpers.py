"""
Helpers transversales del pipeline GYMTEC.

Incluye:
- Clasificación de nivel de ocupación (RF-06).
- Conversión de slot HH:MM a hora decimal y de día a número.
- Utilidades para generar grilla de slots.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from src.utils.paths import (
    AFORO_MAX,
    DIA_A_NUM,
    HORARIO_GYM,
    NIVEL_THRESHOLDS,
    ORDEN_DIAS,
    SLOT_MIN,
)


def slot_to_hora_dec(slot: str) -> float:
    """'13:30' -> 13.5"""
    h, m = slot.split(":")
    return int(h) + int(m) / 60


def hora_dec_to_slot(hora_dec: float) -> str:
    """13.5 -> '13:30'"""
    h = int(hora_dec)
    m = int(round((hora_dec - h) * 60))
    return f"{h:02d}:{m:02d}"


def dia_to_num(dia: str) -> int:
    return DIA_A_NUM.get(dia, -1)


def clasificar_nivel(
    ratio: float,
    thresholds: dict[str, float] | None = None,
) -> str:
    """
    Clasifica un ratio de ocupación (aforo / aforo_max) en niveles RF-06.

    Niveles:
      ratio <= bajo  -> 'bajo'
      ratio <= medio -> 'medio'
      ratio <= alto  -> 'alto'
      ratio  > alto  -> 'critico'
    """
    th = thresholds or NIVEL_THRESHOLDS
    if pd.isna(ratio):
        return "desconocido"
    if ratio <= th["bajo"]:
        return "bajo"
    if ratio <= th["medio"]:
        return "medio"
    if ratio <= th["alto"]:
        return "alto"
    return "critico"


def clasificar_nivel_serie(ratios: pd.Series) -> pd.Series:
    """Versión vectorizada de clasificar_nivel para una Serie de pandas."""
    return ratios.apply(clasificar_nivel)


def en_horario_operativo(dia: str, hora_dec: float) -> bool:
    """¿El slot (dia, hora_dec) está dentro del horario del gym?"""
    if dia not in HORARIO_GYM:
        return False
    h_ini, h_fin = HORARIO_GYM[dia]
    return h_ini <= hora_dec < h_fin


def construir_grilla_slots(
    slot_min: int = SLOT_MIN,
    horario_gym: dict[str, tuple[float, float]] | None = None,
) -> pd.DataFrame:
    """
    Construye la grilla canónica (dia, slot) cubierta por el gym.

    Devuelve columnas: dia, slot, hora_dec, dia_num.
    """
    horario = horario_gym or HORARIO_GYM
    rows: list[dict] = []
    for dia, (h_ini, h_fin) in horario.items():
        # Generar slots cada slot_min minutos desde h_ini hasta h_fin (exclusivo)
        ini = datetime(2000, 1, 1, int(h_ini), int(round((h_ini - int(h_ini)) * 60)))
        fin = datetime(2000, 1, 1, int(h_fin), int(round((h_fin - int(h_fin)) * 60)))
        cur = ini
        while cur < fin:
            slot = cur.strftime("%H:%M")
            rows.append(
                {
                    "dia": dia,
                    "slot": slot,
                    "hora_dec": slot_to_hora_dec(slot),
                    "dia_num": dia_to_num(dia),
                }
            )
            cur += timedelta(minutes=slot_min)
    grilla = pd.DataFrame(rows)
    grilla["dia"] = pd.Categorical(grilla["dia"], categories=ORDEN_DIAS, ordered=True)
    return grilla.sort_values(["dia_num", "hora_dec"]).reset_index(drop=True)


def aforo_a_ratio(aforo: float | int, aforo_max: int = AFORO_MAX) -> float:
    """Convierte aforo absoluto a ratio (0..1+ si excede capacidad)."""
    if aforo_max <= 0:
        return np.nan
    return float(aforo) / aforo_max

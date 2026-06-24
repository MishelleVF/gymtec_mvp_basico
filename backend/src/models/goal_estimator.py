"""
Goal Estimation Model – PROTOTYPE / DEMO ONLY.

This model estimates approximate time to reach a fitness goal based on
user objectives and preferences. It uses SYNTHETIC heuristics, NOT real
medical or exercise-science data. Results are illustrative only.

The model is intentionally simple to demonstrate the full flow:
  user inputs → API → model → estimation → frontend display.

In production this would be replaced with a properly trained model
using real user outcomes data.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal


@dataclass
class ObjectivesInput:
    goal: str                    # bajar_peso | ganar_musculo | mantenerse_activo | mejorar_resistencia | tonificar
    current_weight_kg: float
    target_weight_kg: float | None
    weekly_frequency: int        # sessions/week
    session_duration_min: int    # minutes
    activity_level: str          # sedentario | ligero | moderado | activo
    training_type: str           # fuerza | cardio | funcional | maquinas | pesas | mixto
    intensity: str               # baja | media | alta
    experience_level: str        # principiante | intermedio | avanzado


@dataclass
class GoalEstimation:
    estimated_weeks: int
    difficulty: Literal["bajo", "medio", "alto"]
    recommended_frequency: int
    message: str


# ── Synthetic parameters (demo only) ────────────────────────────────

# Weekly weight change rate (kg/week) by goal, modulated by intensity
_WEIGHT_RATE = {
    "bajar_peso":       {"baja": 0.25, "media": 0.40, "alta": 0.55},
    "ganar_musculo":    {"baja": 0.10, "media": 0.20, "alta": 0.30},
    "tonificar":        {"baja": 0.15, "media": 0.25, "alta": 0.35},
}

_ACTIVITY_MULTIPLIER = {
    "sedentario": 0.70,
    "ligero":     0.85,
    "moderado":   1.00,
    "activo":     1.15,
}

_EXPERIENCE_FACTOR = {
    "principiante": 0.80,
    "intermedio":   1.00,
    "avanzado":     1.15,
}

_FREQUENCY_FACTOR = {
    1: 0.50, 2: 0.70, 3: 0.85, 4: 1.00, 5: 1.10, 6: 1.15, 7: 1.15,
}

_DURATION_FACTOR = {
    30: 0.70, 45: 0.85, 60: 1.00, 90: 1.10, 120: 1.15,
}

_GOAL_LABELS = {
    "bajar_peso":          "bajar de peso",
    "ganar_musculo":       "ganar masa muscular",
    "mantenerse_activo":   "mantenerte activo/a",
    "mejorar_resistencia": "mejorar tu resistencia",
    "tonificar":           "tonificar tu cuerpo",
}


def _closest_key(val: int, mapping: dict[int, float]) -> float:
    keys = sorted(mapping.keys())
    closest = min(keys, key=lambda k: abs(k - val))
    return mapping[closest]


def estimate_goal(inp: ObjectivesInput) -> GoalEstimation:
    """
    Estimate weeks to goal using synthetic heuristics.
    DEMO ONLY – not medically validated.
    """

    goal = inp.goal.lower().strip()
    goal_label = _GOAL_LABELS.get(goal, goal)

    # ── Weight-based goals ──────────────────────────────────────────
    if goal in ("bajar_peso", "ganar_musculo", "tonificar"):
        target = inp.target_weight_kg or inp.current_weight_kg
        delta = abs(inp.current_weight_kg - target)

        if delta < 0.5:
            # Already at target
            return GoalEstimation(
                estimated_weeks=0,
                difficulty="bajo",
                recommended_frequency=max(inp.weekly_frequency, 3),
                message=f"¡Ya estás muy cerca de tu objetivo de {goal_label}! "
                        f"Mantén tu rutina actual para conservar resultados.",
            )

        rates = _WEIGHT_RATE.get(goal, _WEIGHT_RATE["tonificar"])
        base_rate = rates.get(inp.intensity, rates["media"])

        # Apply modifiers
        activity_mod = _ACTIVITY_MULTIPLIER.get(inp.activity_level, 1.0)
        exp_mod = _EXPERIENCE_FACTOR.get(inp.experience_level, 1.0)
        freq_mod = _closest_key(inp.weekly_frequency, _FREQUENCY_FACTOR)
        dur_mod = _closest_key(inp.session_duration_min, _DURATION_FACTOR)

        effective_rate = base_rate * activity_mod * exp_mod * freq_mod * dur_mod
        effective_rate = max(effective_rate, 0.05)  # floor

        weeks = math.ceil(delta / effective_rate)
        weeks = max(weeks, 1)

    # ── Maintenance / endurance goals ───────────────────────────────
    else:
        # Heuristic: 4-12 weeks depending on modifiers
        base = 8
        freq_mod = _closest_key(inp.weekly_frequency, _FREQUENCY_FACTOR)
        dur_mod = _closest_key(inp.session_duration_min, _DURATION_FACTOR)
        exp_mod = _EXPERIENCE_FACTOR.get(inp.experience_level, 1.0)
        activity_mod = _ACTIVITY_MULTIPLIER.get(inp.activity_level, 1.0)

        modifier = freq_mod * dur_mod * exp_mod * activity_mod
        weeks = max(1, math.ceil(base / modifier))

    # ── Difficulty ──────────────────────────────────────────────────
    if weeks <= 6:
        difficulty = "bajo"
    elif weeks <= 16:
        difficulty = "medio"
    else:
        difficulty = "alto"

    # ── Recommended frequency ───────────────────────────────────────
    if difficulty == "alto":
        rec_freq = min(max(inp.weekly_frequency, 4), 6)
    elif difficulty == "medio":
        rec_freq = min(max(inp.weekly_frequency, 3), 5)
    else:
        rec_freq = max(inp.weekly_frequency, 3)

    # ── Friendly message ────────────────────────────────────────────
    months = weeks / 4.33
    if months < 1:
        time_str = f"{weeks} semanas"
    else:
        m = round(months, 1)
        time_str = f"aproximadamente {m} {'mes' if m == 1 else 'meses'}"

    intensity_label = {"baja": "suave", "media": "moderada", "alta": "intensa"}.get(
        inp.intensity, "moderada"
    )

    message = (
        f"Para {goal_label}, estimamos que necesitarás {time_str} "
        f"entrenando {rec_freq} veces por semana con intensidad {intensity_label}. "
        f"Este cálculo es una aproximación basada en tus datos; "
        f"los resultados reales pueden variar según tu alimentación, descanso y constancia."
    )

    return GoalEstimation(
        estimated_weeks=weeks,
        difficulty=difficulty,
        recommended_frequency=rec_freq,
        message=message,
    )

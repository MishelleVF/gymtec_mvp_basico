"""
Goal Estimation API – Endpoint for the objectives prototype model.

POST /api/v1/goals/estimate  → returns estimated time to reach goal
POST /api/v1/goals/save      → saves user objectives + preferences (localStorage proxy)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.models.goal_estimator import GoalEstimation as _GoalEstimation
from src.models.goal_estimator import ObjectivesInput, estimate_goal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/goals", tags=["goals"])


# ── Request / Response schemas ──────────────────────────────────────

class PreferencesPayload(BaseModel):
    training_type: str = "mixto"
    intensity: str = "media"
    preferred_days: list[str] = Field(default_factory=lambda: ["L", "M", "X", "J", "V"])
    preferred_time: str = "flexible"
    session_duration_min: int = 60
    experience_level: str = "principiante"


class ObjectivesPayload(BaseModel):
    goal: str = "mantenerse_activo"
    current_weight_kg: float = 70
    target_weight_kg: float | None = None
    weekly_frequency: int = 3
    session_duration_min: int = 60
    activity_level: str = "ligero"
    target_date: str | None = None


class EstimateRequest(BaseModel):
    objectives: ObjectivesPayload
    preferences: PreferencesPayload


class EstimateResponse(BaseModel):
    estimated_weeks: int
    difficulty: str
    recommended_frequency: int
    message: str


class SaveProfileRequest(BaseModel):
    student_id: str
    preferences: PreferencesPayload
    objectives: ObjectivesPayload


class SaveProfileResponse(BaseModel):
    status: str = "ok"
    message: str = "Perfil guardado correctamente"


# ── Endpoints ───────────────────────────────────────────────────────

@router.post("/estimate", response_model=EstimateResponse)
async def estimate_goal_endpoint(body: EstimateRequest):
    """Estimate time to reach the user's fitness goal (prototype model)."""
    inp = ObjectivesInput(
        goal=body.objectives.goal,
        current_weight_kg=body.objectives.current_weight_kg,
        target_weight_kg=body.objectives.target_weight_kg,
        weekly_frequency=body.objectives.weekly_frequency,
        session_duration_min=body.objectives.session_duration_min,
        activity_level=body.objectives.activity_level,
        training_type=body.preferences.training_type,
        intensity=body.preferences.intensity,
        experience_level=body.preferences.experience_level,
    )

    result = estimate_goal(inp)

    return EstimateResponse(
        estimated_weeks=result.estimated_weeks,
        difficulty=result.difficulty,
        recommended_frequency=result.recommended_frequency,
        message=result.message,
    )


@router.post("/save", response_model=SaveProfileResponse)
async def save_profile(body: SaveProfileRequest):
    """
    Save user preferences and objectives.
    In this demo, validation is done server-side but actual persistence
    is handled client-side via localStorage. This endpoint acts as a
    confirmation + validation step.
    """
    logger.info("Profile saved for student %s", body.student_id)
    return SaveProfileResponse()

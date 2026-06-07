// src/services/goalsApi.ts
import { apiPost } from "./api";
import {
  GoalEstimation,
  GoalEstimationRequest,
  UserObjectives,
  UserPreferences,
} from "@/types/gymtec";

const PREFS_KEY = "gymtec.preferences";
const OBJECTIVES_KEY = "gymtec.objectives";

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function estimateGoal(
  req: GoalEstimationRequest
): Promise<GoalEstimation> {
  return apiPost<GoalEstimationRequest, GoalEstimation>(
    "/api/v1/goals/estimate",
    req
  );
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }
}

export function loadPreferences(): UserPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as UserPreferences) : null;
  } catch {
    return null;
  }
}

export function saveObjectives(obj: UserObjectives): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(OBJECTIVES_KEY, JSON.stringify(obj));
  }
}

export function loadObjectives(): UserObjectives | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OBJECTIVES_KEY);
    return raw ? (JSON.parse(raw) as UserObjectives) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PREFERENCES: UserPreferences = {
  training_type: "mixto",
  intensity: "media",
  preferred_days: ["L", "M", "X", "J", "V"],
  preferred_time: "flexible",
  session_duration_min: 60,
  experience_level: "principiante",
};

export const DEFAULT_OBJECTIVES: UserObjectives = {
  goal: "mantenerse_activo",
  current_weight_kg: 70,
  target_weight_kg: undefined,
  weekly_frequency: 3,
  session_duration_min: 60,
  activity_level: "ligero",
  target_date: undefined,
};

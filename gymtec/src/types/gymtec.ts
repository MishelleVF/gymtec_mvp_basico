// src/types/gymtec.ts
// Domain types matching the FastAPI backend contract.

export type DayCode = "L" | "M" | "X" | "J" | "V" | "S";

export type OccupancyLevel = "Bajo" | "Medio" | "Alto";

export type AcademicLoad = "Baja" | "Media" | "Alta";

export type RecommendationLabel =
  | "Mejor opción"
  | "Buena opción"
  | "Opción aceptable"
  | "Mejor horario recomendado";

export interface BusySlot {
  day: DayCode;
  start_time: string; // "HH:mm" 24h
  end_time: string;   // "HH:mm" 24h
}

export interface Recommendation {
  rank?: number;
  start_time: string;
  end_time: string;
  label: RecommendationLabel | string;
  expected_occupancy: OccupancyLevel;
  confidence: number; // 0..1
  score: number;      // 0..100
  reason: string;
}

export interface DailyForecastPoint {
  time: string;
  expected_occupancy: OccupancyLevel;
  confidence: number;
  academic_load?: AcademicLoad;
}

export interface WeeklyForecastPoint {
  day: DayCode;
  time: string;
  expected_occupancy: OccupancyLevel;
  confidence: number;
}

export interface SaveScheduleRequest {
  student_id: string;
  busy_slots: BusySlot[];
}

export interface SaveScheduleResponse {
  status: "ok" | "error";
  message: string;
}

export interface TodayRecommendationRequest {
  student_id: string;
  date: string; // ISO yyyy-mm-dd
  busy_slots: BusySlot[];
}

export interface TodayRecommendationResponse {
  date: string;
  best_recommendation: Recommendation;
  top_recommendations: Recommendation[];
  daily_forecast: DailyForecastPoint[];
  insight: string;
}

export interface WeeklyForecastResponse {
  week_start: string;
  average_confidence: number;
  heatmap: WeeklyForecastPoint[];
}

export interface ExplainRequest {
  student_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

export interface ExplanationFactor {
  name: string;
  value: string;
  impact: "Alto" | "Medio" | "Bajo";
}

export interface ExplanationResponse {
  summary: string;
  factors: ExplanationFactor[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  model_loaded?: boolean;
  version?: string;
}

// ---------------------------------------------------------------------------
// Google Calendar integration
// ---------------------------------------------------------------------------
export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  day_code: DayCode | "D";
  start_time: string;
  end_time: string;
  all_day: boolean;
  selected?: boolean; // UI-only: whether this event blocks availability
}

export interface GoogleAuthUrlResponse {
  url: string;
}

export interface GoogleCallbackRequest {
  code: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface GoogleUserInfo {
  name: string;
  email: string;
  picture?: string;
}

export interface GoogleEventsRequest {
  access_token: string;
  week_start?: string;
}

export interface GoogleEventsResponse {
  events: CalendarEvent[];
  week_label: string;
}

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------
export type TrainingType =
  | "fuerza"
  | "cardio"
  | "funcional"
  | "maquinas"
  | "pesas"
  | "mixto";

export type Intensity = "baja" | "media" | "alta";
export type ExperienceLevel = "principiante" | "intermedio" | "avanzado";

export interface UserPreferences {
  training_type: TrainingType;
  intensity: Intensity;
  preferred_days: DayCode[];
  preferred_time: "mañana" | "tarde" | "noche" | "flexible";
  session_duration_min: number; // minutes per session
  experience_level: ExperienceLevel;
}

// ---------------------------------------------------------------------------
// User Objectives
// ---------------------------------------------------------------------------
export type FitnessGoal =
  | "bajar_peso"
  | "ganar_musculo"
  | "mantenerse_activo"
  | "mejorar_resistencia"
  | "tonificar";

export interface UserObjectives {
  goal: FitnessGoal;
  current_weight_kg: number;
  target_weight_kg?: number;
  weekly_frequency: number; // sessions per week
  session_duration_min: number;
  activity_level: "sedentario" | "ligero" | "moderado" | "activo";
  target_date?: string; // ISO date
}

export interface GoalEstimation {
  estimated_weeks: number;
  difficulty: "bajo" | "medio" | "alto";
  recommended_frequency: number;
  message: string;
}

export interface GoalEstimationRequest {
  objectives: UserObjectives;
  preferences: UserPreferences;
}

// UI helper types
export type DataSource = "live" | "mock";

export interface ApiResult<T> {
  data: T;
  source: DataSource;
  error?: string;
}

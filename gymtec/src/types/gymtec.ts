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

// UI helper types
export type DataSource = "live" | "mock";

export interface ApiResult<T> {
  data: T;
  source: DataSource;
  error?: string;
}

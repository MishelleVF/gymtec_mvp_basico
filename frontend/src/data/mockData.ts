// src/data/mockData.ts
import {
  DayCode,
  ExplanationResponse,
  HealthResponse,
  OccupancyLevel,
  SaveScheduleResponse,
  TodayRecommendationResponse,
  WeeklyForecastPoint,
  WeeklyForecastResponse,
} from "@/types/gymtec";

export const mockHealth: HealthResponse = {
  status: "ok",
  model_loaded: true,
  version: "0.1.0-mock",
};

export const mockSaveScheduleOk: SaveScheduleResponse = {
  status: "ok",
  message: "Horario registrado correctamente (mock)",
};

export const mockTodayRecommendation: TodayRecommendationResponse = {
  date: new Date().toISOString().slice(0, 10),
  best_recommendation: {
    start_time: "15:00",
    end_time: "16:00",
    label: "Mejor horario recomendado",
    expected_occupancy: "Bajo",
    confidence: 0.89,
    score: 92,
    reason:
      "Estás libre, el aforo predicho es bajo y la carga académica es alta.",
  },
  top_recommendations: [
    {
      rank: 1,
      start_time: "15:00",
      end_time: "16:00",
      label: "Mejor opción",
      expected_occupancy: "Bajo",
      confidence: 0.89,
      score: 92,
      reason:
        "Estás libre, hay clases concurridas en este bloque y el aforo predicho es el más bajo del día.",
    },
    {
      rank: 2,
      start_time: "10:00",
      end_time: "11:00",
      label: "Buena opción",
      expected_occupancy: "Bajo",
      confidence: 0.84,
      score: 86,
      reason:
        "Aforo bajo y tienes disponibilidad, pero la carga académica simultánea es menor.",
    },
    {
      rank: 3,
      start_time: "13:00",
      end_time: "14:00",
      label: "Opción aceptable",
      expected_occupancy: "Medio",
      confidence: 0.82,
      score: 78,
      reason:
        "Hora de almuerzo: aforo moderado y baja superposición con tus clases.",
    },
  ],
  daily_forecast: [
    { time: "09:00", expected_occupancy: "Bajo", confidence: 0.82, academic_load: "Alta" },
    { time: "10:00", expected_occupancy: "Bajo", confidence: 0.84, academic_load: "Alta" },
    { time: "11:00", expected_occupancy: "Bajo", confidence: 0.81, academic_load: "Alta" },
    { time: "12:00", expected_occupancy: "Alto", confidence: 0.78, academic_load: "Baja" },
    { time: "13:00", expected_occupancy: "Alto", confidence: 0.8, academic_load: "Baja" },
    { time: "14:00", expected_occupancy: "Medio", confidence: 0.79, academic_load: "Media" },
    { time: "15:00", expected_occupancy: "Bajo", confidence: 0.89, academic_load: "Alta" },
    { time: "16:00", expected_occupancy: "Medio", confidence: 0.83, academic_load: "Media" },
    { time: "17:00", expected_occupancy: "Alto", confidence: 0.81, academic_load: "Baja" },
  ],
  insight:
    "Después de las 15:00 aumenta la carga académica, por eso el aforo podría bajar.",
};

const DAYS: DayCode[] = ["L", "M", "X", "J", "V", "S"];
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

// Hand-tuned heatmap that matches the mockup (lunch spike + post-15h dip).
const occByHour: Record<string, OccupancyLevel[]> = {
  "09:00": ["Bajo", "Bajo", "Bajo", "Bajo", "Bajo", "Bajo"],
  "10:00": ["Bajo", "Bajo", "Bajo", "Bajo", "Bajo", "Bajo"],
  "11:00": ["Medio", "Medio", "Medio", "Medio", "Medio", "Bajo"],
  "12:00": ["Medio", "Medio", "Medio", "Bajo", "Medio", "Bajo"],
  "13:00": ["Alto", "Alto", "Alto", "Alto", "Alto", "Medio"],
  "14:00": ["Alto", "Alto", "Alto", "Alto", "Alto", "Medio"],
  "15:00": ["Bajo", "Medio", "Bajo", "Medio", "Bajo", "Medio"],
  "16:00": ["Bajo", "Medio", "Bajo", "Medio", "Bajo", "Medio"],
  "17:00": ["Alto", "Alto", "Medio", "Medio", "Medio", "Bajo"],
  "18:00": ["Bajo", "Bajo", "Bajo", "Bajo", "Bajo", "Bajo"],
};

const heatmap: WeeklyForecastPoint[] = HOURS.flatMap((time) =>
  DAYS.map<WeeklyForecastPoint>((day, i) => ({
    day,
    time,
    expected_occupancy: occByHour[time][i],
    confidence: 0.78 + ((i + time.length) % 12) / 100,
  }))
);

export const mockWeeklyForecast: WeeklyForecastResponse = {
  week_start: new Date().toISOString().slice(0, 10),
  average_confidence: 0.84,
  heatmap,
};

export const mockExplanation: ExplanationResponse = {
  summary:
    "Este horario fue recomendado porque estás libre, el aforo esperado es bajo y la carga académica es alta.",
  factors: [
    { name: "Disponibilidad del estudiante", value: "Libre", impact: "Alto" },
    { name: "Aforo predicho", value: "Bajo", impact: "Alto" },
    { name: "Carga académica", value: "Alta", impact: "Medio" },
  ],
};

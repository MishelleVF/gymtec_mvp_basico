// src/services/gymtecApi.ts
// Domain API. Every function returns ApiResult<T> with `source: 'live' | 'mock'`
// so the UI can show a discreet "Usando datos de demostración" banner when the
// backend is unreachable.

import { apiGet, apiPost } from "./api";
import {
  ApiResult,
  ExplainRequest,
  ExplanationResponse,
  HealthResponse,
  SaveScheduleRequest,
  SaveScheduleResponse,
  TodayRecommendationRequest,
  TodayRecommendationResponse,
  WeeklyForecastResponse,
} from "@/types/gymtec";
import {
  mockExplanation,
  mockHealth,
  mockSaveScheduleOk,
  mockTodayRecommendation,
  mockWeeklyForecast,
} from "@/data/mockData";

async function liveOrMock<TReq, TRes>(
  liveFn: () => Promise<TRes>,
  mockValue: TRes
): Promise<ApiResult<TRes>> {
  try {
    const data = await liveFn();
    return { data, source: "live" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: mockValue, source: "mock", error: msg };
  }
}

export async function checkHealth(): Promise<ApiResult<HealthResponse>> {
  return liveOrMock(
    () => apiGet<HealthResponse>("/health", { timeoutMs: 1500 }),
    mockHealth
  );
}

export async function saveSchedule(
  payload: SaveScheduleRequest
): Promise<ApiResult<SaveScheduleResponse>> {
  return liveOrMock(
    () => apiPost<SaveScheduleRequest, SaveScheduleResponse>("/api/v1/schedule", payload),
    mockSaveScheduleOk
  );
}

export async function getTodayRecommendations(
  payload: TodayRecommendationRequest
): Promise<ApiResult<TodayRecommendationResponse>> {
  return liveOrMock(
    () =>
      apiPost<TodayRecommendationRequest, TodayRecommendationResponse>(
        "/api/v1/recommendations/today",
        payload
      ),
    mockTodayRecommendation
  );
}

export async function getWeeklyForecast(): Promise<ApiResult<WeeklyForecastResponse>> {
  return liveOrMock(
    () => apiGet<WeeklyForecastResponse>("/api/v1/forecast/week"),
    mockWeeklyForecast
  );
}

export async function explainRecommendation(
  payload: ExplainRequest
): Promise<ApiResult<ExplanationResponse>> {
  return liveOrMock(
    () =>
      apiPost<ExplainRequest, ExplanationResponse>(
        "/api/v1/recommendations/explain",
        payload
      ),
    mockExplanation
  );
}

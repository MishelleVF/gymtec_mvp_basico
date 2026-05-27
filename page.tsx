// src/app/today/page.tsx
"use client";

import { useEffect, useState } from "react";
import MobileShell from "@/components/layout/MobileShell";
import RecommendationCard from "@/components/cards/RecommendationCard";
import DailyForecastTimeline from "@/components/charts/DailyForecastTimeline";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import DataSourceBanner from "@/components/ui/DataSourceBanner";
import {
  BusySlot,
  DataSource,
  TodayRecommendationResponse,
} from "@/types/gymtec";
import { STUDENT_ID, formatTodayLong, todayIso } from "@/lib/utils";
import { getTodayRecommendations } from "@/services/gymtecApi";

export default function TodayPage() {
  const [data, setData] = useState<TodayRecommendationResponse | null>(null);
  const [source, setSource] = useState<DataSource>("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const busy: BusySlot[] =
        typeof window !== "undefined"
          ? JSON.parse(window.localStorage.getItem("gymtec.busySlots") || "[]")
          : [];
      const res = await getTodayRecommendations({
        student_id: STUDENT_ID,
        date: todayIso(),
        busy_slots: busy,
      });
      setData(res.data);
      setSource(res.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <MobileShell>
      <header className="flex items-start justify-between mt-1">
        <div>
          <div className="text-[11px] font-medium text-neutral-700">
            {formatTodayLong()}
          </div>
          <h1 className="text-base font-medium text-ink-900 mt-0.5">
            Hola, estudiante
          </h1>
        </div>
        <button aria-label="Notificaciones" className="text-neutral-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" strokeLinejoin="round" />
            <path d="M10 21a2 2 0 0 0 4 0" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <p className="text-[13px] text-neutral-700 mt-1.5">
        Este es el mejor momento para entrenar hoy.
      </p>

      <div className="mt-3">
        <DataSourceBanner source={source} />
      </div>

      {loading && <LoadingState label="Generando recomendación..." />}

      {!loading && error && (
        <ErrorState
          title="No se pudo cargar la recomendación"
          message={error}
          onRetry={load}
        />
      )}

      {!loading && data && (
        <>
          <RecommendationCard recommendation={data.best_recommendation} />

          <section className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-900">
                Aforo del gimnasio · hoy
              </span>
              <span className="text-[10px] text-neutral-700">
                Predicción general
              </span>
            </div>
            <div className="mt-2">
              <DailyForecastTimeline
                points={data.daily_forecast}
                highlightTime={data.best_recommendation.start_time}
              />
            </div>
          </section>
        </>
      )}
    </MobileShell>
  );
}

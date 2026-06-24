// src/app/week/page.tsx
"use client";

import { useEffect, useState } from "react";
import MobileShell from "@/components/layout/MobileShell";
import WeeklyHeatmap from "@/components/charts/WeeklyHeatmap";
import ConfidenceCard from "@/components/cards/ConfidenceCard";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import DataSourceBanner from "@/components/ui/DataSourceBanner";
import { DataSource, WeeklyForecastResponse } from "@/types/gymtec";
import { DAY_LABEL } from "@/lib/utils";
import { getWeeklyForecast } from "@/services/gymtecApi";

export default function WeekPage() {
  const [data, setData] = useState<WeeklyForecastResponse | null>(null);
  const [source, setSource] = useState<DataSource>("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWeeklyForecast();
      setData(res.data);
      setSource(res.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Derive "best day" = day with most "Bajo" cells
  const bestDay = data
    ? (() => {
        const counts: Record<string, number> = {};
        for (const p of data?.heatmap ?? []) {
          if (p.expected_occupancy === "Bajo")
            counts[p.day] = (counts[p.day] || 0) + 1;
        }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return top ? DAY_LABEL[top[0] as keyof typeof DAY_LABEL] : "—";
      })()
    : "—";

  return (
    <MobileShell>
      <div className="text-[11px] font-medium text-neutral-700 mt-1">
        SEMANA EN CURSO
      </div>
      <h1 className="text-[20px] font-medium text-ink-900 leading-tight mt-0.5">
        Predicción semanal
      </h1>
      <p className="text-[13px] text-neutral-700 mt-1.5 leading-relaxed">
        Planifica tus entrenamientos según el aforo esperado.
      </p>

      <div className="mt-3">
        <DataSourceBanner source={source} />
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && data && (
        <>
          <div className="mt-3">
            <WeeklyHeatmap points={data.heatmap} />
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <ConfidenceCard
              label="Confianza promedio"
              value={`${Math.round(data.average_confidence * 100)}%`}
            />
            <ConfidenceCard label="Mejor día" value={bestDay} />
          </div>

          <p className="text-[10px] text-neutral-500 leading-relaxed mt-3">
            Basado en carga académica, patrones históricos y disponibilidad estimada.
          </p>
        </>
      )}
    </MobileShell>
  );
}

// src/app/recommendations/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import MobileShell from "@/components/layout/MobileShell";
import InsightCard from "@/components/cards/InsightCard";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import DataSourceBanner from "@/components/ui/DataSourceBanner";
import { BusySlot, DataSource } from "@/types/gymtec";
import { STUDENT_ID, todayIso } from "@/lib/utils";
import { getTodayRecommendations } from "@/services/gymtecApi";
import Badge, { OccupancyBadge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

type RecommendationItem = {
  label?: string;
  start_time?: string;
  end_time?: string;
  time?: string;
  slot?: string;
  hora?: string;
  confidence?: number;
  expected_occupancy?: string;
  level?: string;
  nivel?: string;
  nivel_ocupacion?: string;
  reason?: string;
  razon?: string;
  aforo_predicho?: number;
  aforoPredicho?: number;
  aforo_max?: number;
  aforoMax?: number;
};

type NormalizedRecommendationsData = {
  top_recommendations: RecommendationItem[];
  insight: string;
};

function safeParseBusySlots(): BusySlot[] {
  if (typeof window === "undefined") return [];

  const possibleKeys = [
    "gymtec.busySlots",
    "gymtec_busy_slots",
    "busySlots",
    "schedule",
  ];

  for (const key of possibleKeys) {
    const raw = window.localStorage.getItem(key);

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return [];
}

function normalizeRecommendation(
  rec: RecommendationItem,
  index: number
): RecommendationItem {
  const startTime =
    rec.start_time ||
    rec.time ||
    rec.slot ||
    rec.hora ||
    "No disponible";

  const endTime =
    rec.end_time ||
    (startTime !== "No disponible" ? inferEndTime(startTime) : "No disponible");

  const expectedOccupancy =
    rec.expected_occupancy ||
    rec.level ||
    rec.nivel ||
    rec.nivel_ocupacion ||
    "Bajo";

  return {
    ...rec,
    label: rec.label || (index === 0 ? "Mejor opción" : `Opción ${index + 1}`),
    start_time: startTime,
    end_time: endTime,
    expected_occupancy: expectedOccupancy,
    confidence:
      typeof rec.confidence === "number" && !Number.isNaN(rec.confidence)
        ? rec.confidence
        : 0.89,
    reason:
      rec.reason ||
      rec.razon ||
      `Horario recomendado porque estás libre y el aforo esperado es ${expectedOccupancy}.`,
  };
}

function inferEndTime(startTime: string): string {
  const [hourRaw, minuteRaw] = startTime.split(":");

  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? 0);

  if (Number.isNaN(hour)) return startTime;

  const nextHour = hour + 1;

  return `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}`;
}

function normalizeData(raw: any): NormalizedRecommendationsData {
  const root = raw?.data && !Array.isArray(raw?.data) ? raw.data : raw;

  const list =
    root?.top_recommendations ??
    root?.recommendations ??
    root?.daily_forecast ??
    root?.data ??
    [];

  const topRecommendations = Array.isArray(list)
    ? list.map((rec, index) => normalizeRecommendation(rec, index))
    : [];

  return {
    top_recommendations: topRecommendations,
    insight:
      root?.insight ||
      root?.message ||
      "Estos horarios se recomiendan cruzando tu disponibilidad con la predicción de menor aforo del gimnasio.",
  };
}

export default function RecommendationsPage() {
  const [data, setData] = useState<NormalizedRecommendationsData | null>(null);
  const [source, setSource] = useState<DataSource>("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const busy = safeParseBusySlots();

      const res = await getTodayRecommendations({
        student_id: STUDENT_ID,
        date: todayIso(),
        busy_slots: busy,
        topN: 3,
      } as any);

      const normalized = normalizeData(res);

      setData(normalized);
      setSource((res as any)?.source ?? "live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar recomendaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topRecommendations = useMemo(
    () => data?.top_recommendations ?? [],
    [data]
  );

  return (
    <MobileShell>
      <div className="text-[11px] font-medium text-neutral-700 mt-1">
        PARA TI · HOY
      </div>

      <h1 className="text-[20px] font-medium text-ink-900 leading-tight mt-0.5">
        Top 3 horarios para ti
      </h1>

      <p className="text-[13px] text-neutral-700 mt-1.5 leading-relaxed">
        Ordenados por compatibilidad con tu horario, aforo y carga académica.
      </p>

      <div className="mt-3">
        <DataSourceBanner source={source} />
      </div>

      {loading && <LoadingState />}

      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          {topRecommendations.length > 0 ? (
            <div className="flex flex-col gap-2.5 mt-3">
              {topRecommendations.map((rec, i) => (
                <RankedCard
                  key={`${rec.start_time ?? rec.slot ?? "rec"}-${i}`}
                  rec={rec}
                  index={i}
                />
              ))}
            </div>
          ) : (
            <Card className="p-4 mt-3">
              <p className="text-[13px] text-neutral-700 leading-relaxed">
                No se encontraron horarios disponibles según tu horario actual.
              </p>
            </Card>
          )}

          <div className="mt-4">
            <InsightCard text={data.insight} />
          </div>
        </>
      )}
    </MobileShell>
  );
}

function RankedCard({
  rec,
  index,
}: {
  rec: RecommendationItem;
  index: number;
}) {
  const confidence = rec.confidence ?? 0.89;
  const confidencePct = Math.round(confidence * 100);
  const isBest = index === 0;

  const startTime = rec.start_time ?? rec.time ?? rec.slot ?? "No disponible";
  const endTime = rec.end_time ?? inferEndTime(startTime);
  const label = rec.label ?? (isBest ? "Mejor opción" : `Opción ${index + 1}`);
  const expectedOccupancy =
    rec.expected_occupancy ??
    rec.level ??
    rec.nivel ??
    rec.nivel_ocupacion ??
    "Bajo";

  const reason =
    rec.reason ??
    rec.razon ??
    `Horario recomendado porque estás libre y el aforo esperado es ${expectedOccupancy}.`;

  return (
    <Card accent={isBest ? "left" : "none"} className="p-3.5">
      <div className="flex items-start justify-between">
        <div>
          {isBest ? (
            <Badge variant="info">{label}</Badge>
          ) : (
            <Badge variant={index === 1 ? "medio" : "neutral"}>{label}</Badge>
          )}

          <div
            className={
              isBest
                ? "text-[22px] font-medium text-ink-900 tracking-tight mt-2"
                : "text-lg font-medium text-ink-900 mt-1.5"
            }
          >
            {startTime} — {endTime}
          </div>
        </div>

        <div className="text-right">
          <div
            className={
              isBest
                ? "text-lg font-medium text-ink-900"
                : "text-base font-medium text-ink-900"
            }
          >
            {confidencePct}%
          </div>
          <div className="text-[10px] text-neutral-500">confianza</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[11px] text-neutral-700">Aforo</span>
        <OccupancyBadge level={expectedOccupancy} />
      </div>

      <p className="text-[11px] text-neutral-700 leading-relaxed mt-2">
        {reason}
      </p>
    </Card>
  );
}
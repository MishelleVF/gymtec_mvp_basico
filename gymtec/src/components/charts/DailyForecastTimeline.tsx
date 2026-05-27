// src/components/charts/DailyForecastTimeline.tsx
import { DailyForecastPoint, OccupancyLevel } from "@/types/gymtec";
import { occupancyStyle } from "@/lib/utils";

interface Props {
  points: DailyForecastPoint[];
  highlightTime?: string;
}

const HEIGHT_BY_LEVEL: Record<OccupancyLevel, number> = {
  Bajo: 18,
  Medio: 26,
  Alto: 32,
};

function normalizeOccupancy(value: unknown): OccupancyLevel {
  const raw = String(value ?? "").toLowerCase().trim();

  if (
    raw.includes("bajo") ||
    raw.includes("low") ||
    raw.includes("vacío") ||
    raw.includes("vacio") ||
    raw.includes("empty")
  ) {
    return "Bajo";
  }

  if (
    raw.includes("medio") ||
    raw.includes("medium") ||
    raw.includes("moderado")
  ) {
    return "Medio";
  }

  if (
    raw.includes("alto") ||
    raw.includes("high") ||
    raw.includes("critico") ||
    raw.includes("crítico") ||
    raw.includes("lleno") ||
    raw.includes("critical")
  ) {
    return "Alto";
  }

  return "Bajo";
}

function getPointTime(point: DailyForecastPoint): string {
  const p = point as any;

  return (
    p.time ||
    p.start_time ||
    p.slot ||
    p.hora ||
    "00:00"
  );
}

export default function DailyForecastTimeline({ points = [], highlightTime }: Props) {
  if (!points || points.length === 0) return null;

  const cols = points.length;

  return (
    <div>
      <div
        className="grid gap-1 items-end"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {points.map((point, index) => {
          const p = point as any;

          const time = getPointTime(point);

          const expectedOccupancy = normalizeOccupancy(
            p.expected_occupancy ??
              p.nivel_ocupacion ??
              p.nivel ??
              p.level ??
              p.occupancy_level
          );

          const s = occupancyStyle(expectedOccupancy) ?? occupancyStyle("Bajo");
          const isNow = time === highlightTime;

          return (
            <div
              key={`${time}-${index}`}
              className="rounded-md relative"
              style={{
                background: s.solidBg,
                height: `${HEIGHT_BY_LEVEL[expectedOccupancy]}px`,
                boxShadow: isNow ? "inset 0 0 0 2px #042C53" : undefined,
              }}
              aria-label={`${time} aforo ${expectedOccupancy}`}
            />
          );
        })}
      </div>

      <div
        className="grid gap-1 mt-1"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {points.map((point, index) => {
          const time = getPointTime(point);

          return (
            <div
              key={`${time}-label-${index}`}
              className={
                time === highlightTime
                  ? "text-[9px] text-ink-900 font-medium text-center"
                  : "text-[9px] text-neutral-500 text-center"
              }
            >
              {time.slice(0, 2)}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-2.5 text-[10px] text-neutral-700">
        {(["Bajo", "Medio", "Alto"] as OccupancyLevel[]).map((lvl) => {
          const s = occupancyStyle(lvl);

          return (
            <span key={lvl} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: s.solidBg }}
                aria-hidden
              />
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
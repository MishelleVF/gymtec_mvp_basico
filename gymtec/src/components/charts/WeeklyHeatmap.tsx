// src/components/charts/WeeklyHeatmap.tsx
import {
  DayCode,
  OccupancyLevel,
  WeeklyForecastPoint,
} from "@/types/gymtec";
import { DAYS, HOURS_HEATMAP, fmtHour, occupancyStyle } from "@/lib/utils";

interface Props {
  points: WeeklyForecastPoint[];
}

export default function WeeklyHeatmap({ points }: Props) {
  // Index for O(1) cell lookup
  const idx: Record<string, WeeklyForecastPoint | undefined> = {};
  for (const p of points) idx[`${p.day}|${p.time}`] = p;

  return (
    <div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "28px repeat(6, 1fr)" }}
      >
        <div />
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-[10px] text-neutral-700 font-medium text-center py-1"
          >
            {d}
          </div>
        ))}

        {HOURS_HEATMAP.map((h) => {
          const time = fmtHour(h);
          return (
            <FragmentRow
              key={h}
              time={time}
              cells={DAYS.map((d) => idx[`${d}|${time}`])}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 text-[10px] text-neutral-700 justify-center">
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

function FragmentRow({
  time,
  cells,
}: {
  time: string;
  cells: Array<WeeklyForecastPoint | undefined>;
}) {
  return (
    <>
      <div className="text-[9px] text-neutral-500 flex items-center justify-end pr-1">
        {time.slice(0, 2)}
      </div>
      {cells.map((c, i) => {
        const level = c?.expected_occupancy ?? "Bajo";
        const s = occupancyStyle(level);
        return (
          <div
            key={i}
            className="h-[22px] rounded-md"
            style={{ background: s.solidBg }}
            aria-label={`${time} aforo ${level}`}
          />
        );
      })}
    </>
  );
}

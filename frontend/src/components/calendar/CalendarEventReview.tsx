// src/components/calendar/CalendarEventReview.tsx
"use client";

import { CalendarEvent, DayCode } from "@/types/gymtec";
import { cn, DAY_LABEL } from "@/lib/utils";
import Card from "@/components/ui/Card";

interface Props {
  events: CalendarEvent[];
  onToggle: (eventId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const DAY_ORDER: Record<string, number> = {
  L: 0, M: 1, X: 2, J: 3, V: 4, S: 5, D: 6,
};

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const sorted = [...events].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day_code] ?? 7) - (DAY_ORDER[b.day_code] ?? 7);
    if (dayDiff !== 0) return dayDiff;
    return a.start_time.localeCompare(b.start_time);
  });
  for (const ev of sorted) {
    const key = ev.day_code;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default function CalendarEventReview({
  events,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: Props) {
  const grouped = groupByDay(events);
  const selectedCount = events.filter((e) => e.selected).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-neutral-700">
          {selectedCount} de {events.length} eventos marcan ocupado
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[11px] text-ink-500 font-medium hover:underline"
          >
            Todos
          </button>
          <span className="text-neutral-300">|</span>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-[11px] text-ink-500 font-medium hover:underline"
          >
            Ninguno
          </button>
        </div>
      </div>

      {/* Events by day */}
      <div className="flex flex-col gap-3">
        {Array.from(grouped.entries()).map(([dayCode, dayEvents]) => {
          const dayLabel =
            dayCode in DAY_LABEL
              ? DAY_LABEL[dayCode as DayCode]
              : "Domingo";

          return (
            <div key={dayCode}>
              <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                {dayLabel}
              </div>
              <div className="flex flex-col gap-1.5">
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onToggle(ev.id)}
                    className={cn(
                      "flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors text-left w-full",
                      ev.selected
                        ? "border-ink-500/30 bg-ink-500/5"
                        : "border-black/5 bg-white opacity-60"
                    )}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={cn(
                        "w-4 h-4 rounded border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors",
                        ev.selected
                          ? "bg-ink-500 border-ink-500"
                          : "bg-white border-neutral-300"
                      )}
                    >
                      {ev.selected && (
                        <svg
                          viewBox="0 0 12 12"
                          fill="none"
                          className="w-2.5 h-2.5 text-white"
                        >
                          <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink-900 truncate">
                        {ev.summary}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {ev.all_day
                          ? "Todo el día"
                          : `${formatTime(ev.start_time)} – ${formatTime(ev.end_time)}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <Card>
          <p className="text-[13px] text-neutral-500 text-center py-4">
            No se encontraron eventos para esta semana.
          </p>
        </Card>
      )}
    </div>
  );
}

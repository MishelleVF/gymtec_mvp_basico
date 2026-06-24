// src/components/schedule/ScheduleGrid.tsx
"use client";

import { DayCode } from "@/types/gymtec";
import { DAYS, HOURS_FULL, fmtHour, slotKey } from "@/lib/utils";
import ScheduleSlot from "./ScheduleSlot";

interface Props {
  selected: Set<string>;
  onToggle: (day: DayCode, hour: number) => void;
  /** Optional smaller, read-only variant for the profile preview. */
  readOnly?: boolean;
  compact?: boolean;
  hours?: number[];
}

export default function ScheduleGrid({
  selected,
  onToggle,
  readOnly = false,
  compact = false,
  hours = HOURS_FULL,
}: Props) {
  return (
    <div
      className="grid gap-1"
      style={{
        gridTemplateColumns: compact
          ? "16px repeat(6, 1fr)"
          : "28px repeat(6, 1fr)",
      }}
    >
      <div />
      {DAYS.map((d) => (
        <div
          key={d}
          className={
            compact
              ? "text-[9px] text-neutral-700 font-medium text-center py-0.5"
              : "text-[10px] text-neutral-700 font-medium text-center py-1"
          }
        >
          {d}
        </div>
      ))}

      {hours.map((h) => (
        <RowForHour
          key={h}
          hour={h}
          selected={selected}
          onToggle={onToggle}
          readOnly={readOnly}
          compact={compact}
        />
      ))}
    </div>
  );
}

function RowForHour({
  hour,
  selected,
  onToggle,
  readOnly,
  compact,
}: {
  hour: number;
  selected: Set<string>;
  onToggle: (day: DayCode, hour: number) => void;
  readOnly: boolean;
  compact: boolean;
}) {
  return (
    <>
      <div
        className={
          compact
            ? "text-[8px] text-neutral-500 flex items-center justify-end pr-0.5"
            : "text-[9px] text-neutral-500 flex items-center justify-end pr-1"
        }
      >
        {String(hour).padStart(2, "0")}
      </div>
      {DAYS.map((d) => {
        const isBusy = selected.has(slotKey(d, hour));
        const label = `${d} ${fmtHour(hour)}`;
        return (
          <ScheduleSlot
            key={d}
            busy={isBusy}
            label={label}
            compact={compact}
            onToggle={() => {
              if (!readOnly) onToggle(d, hour);
            }}
          />
        );
      })}
    </>
  );
}

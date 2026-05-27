// src/lib/utils.ts
import { BusySlot, DayCode, OccupancyLevel } from "@/types/gymtec";

export function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export const DAYS: DayCode[] = ["L", "M", "X", "J", "V", "S"];

export const DAY_LABEL: Record<DayCode, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
};

// Hours 07..22 inclusive (16 rows) for the schedule grid
export const HOURS_FULL = Array.from({ length: 16 }, (_, i) => 7 + i);

// Hours 09..18 for the weekly heatmap
export const HOURS_HEATMAP = Array.from({ length: 10 }, (_, i) => 9 + i);

export function fmtHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export const STUDENT_ID = "demo_student";

// ----- Occupancy color helpers ---------------------------------------------
export interface OccupancyStyle {
  bg: string;       // background class
  fg: string;       // foreground/text class
  dot: string;      // small dot solid color (hex)
  solidBg: string;  // solid background hex for charts
  label: string;
}

export function occupancyStyle(level: OccupancyLevel): OccupancyStyle {
  switch (level) {
    case "Bajo":
      return {
        bg: "bg-occ-lowBg",
        fg: "text-occ-lowFg",
        dot: "#639922",
        solidBg: "#97C459",
        label: "Bajo",
      };
    case "Medio":
      return {
        bg: "bg-occ-medBg",
        fg: "text-occ-medFg",
        dot: "#BA7517",
        solidBg: "#EF9F27",
        label: "Medio",
      };
    case "Alto":
      return {
        bg: "bg-occ-highBg",
        fg: "text-occ-highFg",
        dot: "#A32D2D",
        solidBg: "#E24B4A",
        label: "Alto",
      };
  }
}

// ----- Schedule grid helpers -----------------------------------------------
// We represent the busy schedule as a Set of "DAY|HOUR" keys for fast toggle,
// and convert to/from BusySlot[] when talking to the API.
export function slotKey(day: DayCode, hour: number) {
  return `${day}|${hour}`;
}

export function toBusySlots(keys: Set<string>): BusySlot[] {
  return Array.from(keys).map((k) => {
    const [day, hStr] = k.split("|");
    const h = Number(hStr);
    return {
      day: day as DayCode,
      start_time: fmtHour(h),
      end_time: fmtHour(h + 1),
    };
  });
}

export function fromBusySlots(slots: BusySlot[]): Set<string> {
  const set = new Set<string>();
  for (const s of slots) {
    const h = Number(s.start_time.split(":")[0]);
    set.add(slotKey(s.day, h));
  }
  return set;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTodayLong(d = new Date()) {
  const weekdays = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

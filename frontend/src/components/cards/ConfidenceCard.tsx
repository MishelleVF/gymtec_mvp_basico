// src/components/cards/ConfidenceCard.tsx
import { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "highlight";
}

export default function ConfidenceCard({
  label,
  value,
  hint,
  tone = "default",
}: Props) {
  return (
    <div
      className={
        tone === "highlight"
          ? "bg-occ-lowBg border border-occ-lowBg rounded-card p-3"
          : "bg-white border border-black/5 rounded-card p-3"
      }
    >
      <div className="text-[11px] font-medium text-neutral-700">{label}</div>
      <div className="text-[22px] font-medium text-ink-900 tracking-tight mt-0.5">
        {value}
      </div>
      {hint && <div className="text-[10px] text-neutral-500 mt-0.5">{hint}</div>}
    </div>
  );
}

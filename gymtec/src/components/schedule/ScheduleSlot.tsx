// src/components/schedule/ScheduleSlot.tsx
import { cn } from "@/lib/utils";

interface Props {
  busy: boolean;
  onToggle: () => void;
  label: string;
  compact?: boolean;
}

export default function ScheduleSlot({ busy, onToggle, label, compact }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={busy}
      aria-label={label}
      className={cn(
        "aspect-square rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ink-500/40",
        busy ? "bg-ink-500" : "bg-neutral-100 hover:bg-neutral-300",
        compact && "rounded-sm"
      )}
    />
  );
}

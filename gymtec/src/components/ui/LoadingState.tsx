// src/components/ui/LoadingState.tsx
interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({ label = "Cargando..." }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-10 gap-3"
    >
      <div className="w-7 h-7 rounded-full border-2 border-ink-500/20 border-t-ink-500 animate-spin" />
      <p className="text-xs text-neutral-700">{label}</p>
    </div>
  );
}

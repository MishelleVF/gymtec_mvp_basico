// src/components/ui/LoadingState.tsx
interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({ label = "Cargando..." }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in"
    >
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-ink-500/10" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-ink-500 animate-spin" />
      </div>
      <p className="text-[12px] text-neutral-700">{label}</p>
    </div>
  );
}

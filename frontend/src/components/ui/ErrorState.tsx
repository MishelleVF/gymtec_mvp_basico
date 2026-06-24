// src/components/ui/ErrorState.tsx
import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Algo no salió bien",
  message = "No pudimos completar la operación. Inténtalo de nuevo.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="bg-occ-highBg/50 border border-occ-highBg rounded-card p-4 my-4 animate-fade-in"
    >
      <div className="flex gap-2.5 items-start">
        <span className="text-lg flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-occ-highFg">{title}</p>
          <p className="text-[12px] text-occ-highFg/80 mt-1 leading-relaxed">{message}</p>
          {onRetry && (
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

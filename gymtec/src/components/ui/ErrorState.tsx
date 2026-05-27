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
      className="bg-occ-highBg border border-occ-highBg rounded-card p-4 my-4"
    >
      <p className="text-sm font-medium text-occ-highFg">{title}</p>
      <p className="text-xs text-occ-highFg/80 mt-1">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}

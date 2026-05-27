// src/components/cards/RecommendationCard.tsx
import Card from "../ui/Card";
import Badge, { OccupancyBadge } from "../ui/Badge";
import Button from "../ui/Button";
import { Recommendation } from "@/types/gymtec";

interface Props {
  recommendation: Recommendation;
  onReminder?: () => void;
  onExplain?: () => void;
  variant?: "hero" | "compact";
}

export default function RecommendationCard({
  recommendation,
  onReminder,
  onExplain,
  variant = "hero",
}: Props) {
  const confidencePct = Math.round(recommendation.confidence * 100);

  if (variant === "compact") {
    return (
      <Card className="p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <Badge tone="info">{recommendation.label}</Badge>
            <div className="text-lg font-medium text-ink-900 mt-1.5 tracking-tight">
              {recommendation.start_time} — {recommendation.end_time}
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-medium text-ink-900">
              {confidencePct}%
            </div>
            <div className="text-[10px] text-neutral-500">confianza</div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-neutral-700">Aforo</span>
          <OccupancyBadge level={recommendation.expected_occupancy} />
        </div>
        <p className="text-[11px] text-neutral-700 leading-relaxed mt-2">
          {recommendation.reason}
        </p>
      </Card>
    );
  }

  return (
    <Card accent="primary" className="p-4">
      <div className="flex items-center justify-between">
        <Badge tone="primary">Recomendado para ti</Badge>
        <Badge tone="info">{confidencePct}% confianza</Badge>
      </div>
      <div className="text-[32px] font-medium text-ink-900 tracking-tight mt-2.5 leading-none">
        {recommendation.start_time} — {recommendation.end_time}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-neutral-700">Aforo esperado</span>
        <OccupancyBadge level={recommendation.expected_occupancy} />
      </div>

      <hr className="my-3 border-black/5" />

      <div className="flex gap-2 text-xs text-neutral-900 leading-relaxed">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#854F0B"
          strokeWidth="1.5"
          className="w-4 h-4 flex-shrink-0 mt-0.5"
        >
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{recommendation.reason}</span>
      </div>

      <div className="flex gap-2 mt-3.5">
        <Button size="sm" variant="primary" onClick={onReminder}>
          Recordatorio
        </Button>
        <Button size="sm" variant="secondary" onClick={onExplain}>
          Ver detalle
        </Button>
      </div>
    </Card>
  );
}

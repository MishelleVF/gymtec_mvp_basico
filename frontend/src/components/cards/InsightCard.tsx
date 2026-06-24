// src/components/cards/InsightCard.tsx
interface Props {
  title?: string;
  text: string;
}

export default function InsightCard({ title = "Insight del día", text }: Props) {
  return (
    <div className="bg-[#E6F1FB] rounded-card p-3 flex gap-2.5">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0C447C"
        strokeWidth="1.5"
        className="w-4 h-4 flex-shrink-0 mt-0.5"
        aria-hidden
      >
        <path
          d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <div className="text-[11px] font-medium text-ink-700">{title}</div>
        <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">{text}</p>
      </div>
    </div>
  );
}

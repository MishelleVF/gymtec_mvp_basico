// src/components/ui/DataSourceBanner.tsx
import { DataSource } from "@/types/gymtec";

export default function DataSourceBanner({ source }: { source: DataSource }) {
  if (source === "live") return null;
  return (
    <div
      role="status"
      className="mb-3 text-[11px] text-gold-700 bg-[#FAEEDA] border border-[#F0D69A] rounded-xl px-3 py-2 flex items-center gap-2"
    >
      <span
        aria-hidden
        className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse"
      />
      Usando datos de demostración. El backend no está disponible.
    </div>
  );
}

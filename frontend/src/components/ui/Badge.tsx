import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  variant?: string;
  className?: string;
};

type OccupancyBadgeProps = {
  level?: string | number;
  occupancy?: string | number;
  value?: string | number;
  label?: string;
  children?: ReactNode;
  className?: string;
};

const styles: Record<string, { bg: string; fg: string }> = {
  success: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
  },
  warning: {
    bg: "bg-amber-100",
    fg: "text-amber-700",
  },
  danger: {
    bg: "bg-red-100",
    fg: "text-red-700",
  },
  info: {
    bg: "bg-blue-100",
    fg: "text-blue-700",
  },
  neutral: {
    bg: "bg-gray-100",
    fg: "text-gray-700",
  },
  bajo: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
  },
  medio: {
    bg: "bg-amber-100",
    fg: "text-amber-700",
  },
  alto: {
    bg: "bg-orange-100",
    fg: "text-orange-700",
  },
  critico: {
    bg: "bg-red-100",
    fg: "text-red-700",
  },
  crítico: {
    bg: "bg-red-100",
    fg: "text-red-700",
  },
  desconocido: {
    bg: "bg-gray-100",
    fg: "text-gray-700",
  },
};

function normalizeLevel(value?: string | number): string {
  if (value === undefined || value === null) return "desconocido";

  if (typeof value === "number") {
    if (value < 0.4) return "bajo";
    if (value < 0.7) return "medio";
    if (value < 0.9) return "alto";
    return "critico";
  }

  const clean = value.toLowerCase().trim();

  if (clean.includes("bajo") || clean.includes("vacío") || clean.includes("vacio")) {
    return "bajo";
  }

  if (clean.includes("medio") || clean.includes("moderado")) {
    return "medio";
  }

  if (clean.includes("alto")) {
    return "alto";
  }

  if (clean.includes("critico") || clean.includes("crítico") || clean.includes("lleno")) {
    return "critico";
  }

  return clean in styles ? clean : "desconocido";
}

function getLabel(level: string): string {
  const labels: Record<string, string> = {
    bajo: "Probablemente vacío",
    medio: "Aforo moderado",
    alto: "Aforo alto",
    critico: "Muy concurrido",
    crítico: "Muy concurrido",
    desconocido: "Sin información",
  };

  return labels[level] ?? "Sin información";
}

function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const safeVariant = normalizeLevel(variant);
  const s = styles[safeVariant] ?? styles.neutral;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full",
        s.bg,
        s.fg,
        className
      )}
    >
      {children}
    </span>
  );
}

function OccupancyBadge({
  level,
  occupancy,
  value,
  label,
  children,
  className,
}: OccupancyBadgeProps) {
  const normalizedLevel = normalizeLevel(level ?? occupancy ?? value ?? label);

  return (
    <Badge variant={normalizedLevel} className={className}>
      {children ?? label ?? getLabel(normalizedLevel)}
    </Badge>
  );
}

export { Badge, OccupancyBadge };
export default Badge;
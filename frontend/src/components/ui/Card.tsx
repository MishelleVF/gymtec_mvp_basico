// src/components/ui/Card.tsx
import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  accent?: "none" | "primary" | "left";
}

export default function Card({
  children,
  className,
  accent = "none",
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "bg-white rounded-card shadow-card",
        accent === "primary" && "border-2 border-ink-500",
        accent === "left" && "border-l-[3px] border-l-ink-500 rounded-l-none",
        accent === "none" && "border border-black/5",
        "p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

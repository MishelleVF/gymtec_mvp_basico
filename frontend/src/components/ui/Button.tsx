// src/components/ui/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        size === "md" && "px-4 py-3 text-sm",
        size === "sm" && "px-3 py-2 text-xs",
        variant === "primary" &&
          "bg-ink-500 text-white hover:bg-ink-700 active:scale-[0.99]",
        variant === "secondary" &&
          "bg-transparent text-ink-500 border border-ink-500/30 hover:bg-ink-500/5",
        variant === "ghost" &&
          "bg-transparent text-neutral-700 border border-black/10 hover:bg-neutral-100",
        "w-full",
        className
      )}
    >
      {children}
    </button>
  );
}

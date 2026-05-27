// src/components/layout/MobileShell.tsx
import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";

interface MobileShellProps {
  children: ReactNode;
  showNav?: boolean;
  /** Use false for full-bleed onboarding/schedule screens that don't need padding. */
  padded?: boolean;
}

export default function MobileShell({
  children,
  showNav = true,
  padded = true,
}: MobileShellProps) {
  return (
    <div className="min-h-screen w-full bg-neutral-100 flex items-center justify-center md:py-6">
      <div className="w-full max-w-[420px] md:w-[420px] min-h-screen md:min-h-[840px] md:max-h-[840px] bg-canvas md:rounded-[32px] md:shadow-xl md:border md:border-black/10 overflow-hidden flex flex-col">
        {/* Status bar (decorative on desktop) */}
        <div className="hidden md:flex h-7 items-center justify-between px-5 text-[11px] font-medium text-neutral-900 flex-shrink-0">
          <span>9:41</span>
          <span className="flex gap-1.5 items-center">
            <span aria-hidden className="w-3 h-1.5 bg-neutral-900/70 rounded-sm" />
            <span aria-hidden className="w-4 h-2 border border-neutral-900/70 rounded-sm" />
          </span>
        </div>

        <main
          className={cn(
            "flex-1 overflow-y-auto",
            padded ? "px-5 pt-3 pb-4" : ""
          )}
        >
          {children}
        </main>

        {showNav && <BottomNav />}
      </div>
    </div>
  );
}

// src/components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
}

const ICON_CLS = "w-5 h-5";

const HomeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={ICON_CLS}>
    <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={ICON_CLS}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);

const CalIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={ICON_CLS}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
  </svg>
);

const UserIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={ICON_CLS}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
  </svg>
);

const ITEMS: NavItem[] = [
  { href: "/today", label: "Hoy", icon: HomeIcon },
  { href: "/recommendations", label: "Horarios", icon: ClockIcon },
  { href: "/week", label: "Semana", icon: CalIcon },
  { href: "/profile", label: "Perfil", icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="h-16 bg-white border-t border-black/5 flex items-center justify-around pb-2 flex-shrink-0"
    >
      {ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[10px] font-medium",
              active ? "text-ink-500" : "text-neutral-500"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// src/app/profile/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MobileShell from "@/components/layout/MobileShell";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import Button from "@/components/ui/Button";
import { BusySlot } from "@/types/gymtec";
import { fromBusySlots } from "@/lib/utils";

export default function ProfilePage() {
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("gymtec.busySlots");
        if (raw) setBusySlots(JSON.parse(raw) as BusySlot[]);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const selected = fromBusySlots(busySlots);
  const totalHours = busySlots.length;

  return (
    <MobileShell>
      <h1 className="text-[20px] font-medium text-ink-900 mt-1">Perfil</h1>

      <div className="flex items-center gap-3.5 mt-3 bg-white border border-black/5 rounded-card p-3.5">
        <div className="w-14 h-14 rounded-full bg-[#E6F1FB] text-ink-700 flex items-center justify-center text-lg font-medium">
          JS
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-medium text-ink-900">
            Juana Soto
          </div>
          <div className="text-[11px] text-neutral-700">Ingeniería · 5to ciclo</div>
          <div className="text-[10px] text-gold-700 mt-1 flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            Última actualización: hoy
          </div>
        </div>
      </div>

      <section className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-ink-900">
            Mi horario ocupado
          </span>
          <span className="text-[10px] text-neutral-700">
            {totalHours} hrs / semana
          </span>
        </div>
        <ScheduleGrid
          selected={selected}
          onToggle={() => {}}
          readOnly
          compact
          hours={[8, 11, 14, 17]}
        />
      </section>

      <div className="mt-4 bg-white border border-black/5 rounded-card px-3.5 py-0.5">
        <ProfileRow label="Editar horario" href="/schedule" />
        <ProfileRow label="Recordatorios" value="Activos · 2" />
        <ProfileRow label="Preferencias" value="Mañana" />
        <ProfileRow label="Tipo de entreno" value="Fuerza" last />
      </div>

      <div className="mt-4">
        <Link href="/schedule">
          <Button>Actualizar mi horario</Button>
        </Link>
      </div>
    </MobileShell>
  );
}

function ProfileRow({
  label,
  value,
  href,
  last,
}: {
  label: string;
  value?: string;
  href?: string;
  last?: boolean;
}) {
  const inner = (
    <div
      className={
        last
          ? "flex items-center justify-between py-3"
          : "flex items-center justify-between py-3 border-b border-black/5"
      }
    >
      <span className="text-[13px] text-neutral-900">{label}</span>
      {value ? (
        <span className="text-[12px] text-neutral-500">{value}</span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-neutral-500">
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// src/app/schedule/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/layout/MobileShell";
import Button from "@/components/ui/Button";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import ErrorState from "@/components/ui/ErrorState";
import DataSourceBanner from "@/components/ui/DataSourceBanner";
import { DataSource, DayCode } from "@/types/gymtec";
import { STUDENT_ID, slotKey, toBusySlots } from "@/lib/utils";
import { saveSchedule } from "@/services/gymtecApi";

export default function SchedulePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(day: DayCode, hour: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = slotKey(day, hour);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const slots = toBusySlots(selected);
      // Persist locally so /today and /profile can hydrate it.
      if (typeof window !== "undefined") {
        window.localStorage.setItem("gymtec.busySlots", JSON.stringify(slots));
      }
      const res = await saveSchedule({ student_id: STUDENT_ID, busy_slots: slots });
      setSource(res.source);
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gymtec.busySlots", JSON.stringify([]));
    }
    router.push("/today");
  }

  const hoursPerWeek = selected.size;

  return (
    <MobileShell showNav={false}>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Volver"
          className="text-ink-500"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[11px] text-neutral-500">Paso 2 de 3</span>
      </div>

      <h1 className="text-[20px] font-medium text-ink-900 leading-tight">
        Ingresa tu horario ocupado
      </h1>
      <p className="text-[13px] text-neutral-700 mt-1.5 leading-relaxed">
        Selecciona las horas en las que tienes clase para recibir mejores recomendaciones.
      </p>

      {source && <div className="mt-3"><DataSourceBanner source={source} /></div>}

      <div className="flex gap-3 mt-3 mb-3 text-[11px] text-neutral-700">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-ink-500" /> Ocupado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-neutral-100 border border-black/10" /> Libre
        </span>
      </div>

      <ScheduleGrid selected={selected} onToggle={toggle} />

      <div className="text-[11px] text-neutral-700 mt-3 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="1.5" className="w-3.5 h-3.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
        <span>
          {hoursPerWeek} bloques seleccionados · {hoursPerWeek} hrs / semana
        </span>
      </div>

      {error && (
        <ErrorState
          title="No pudimos guardar"
          message={error}
          onRetry={handleSave}
        />
      )}

      <div className="flex flex-col gap-2.5 mt-5">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar horario"}
        </Button>
        <Button variant="secondary" onClick={handleSkip} disabled={saving}>
          Lo haré después
        </Button>
      </div>
    </MobileShell>
  );
}

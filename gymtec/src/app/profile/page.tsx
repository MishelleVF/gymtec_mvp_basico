// src/app/profile/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/layout/MobileShell";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import Button from "@/components/ui/Button";
import { BusySlot, DayCode, UserPreferences, GoalEstimation } from "@/types/gymtec";
import { fromBusySlots, slotKey, toBusySlots, STUDENT_ID } from "@/lib/utils";
import { useGoogleAuth } from "@/context/GoogleAuthContext";
import { getGoogleAuthUrl, fetchCalendarEvents, calendarEventsToBusySlots } from "@/services/googleCalendarApi";
import { saveSchedule } from "@/services/gymtecApi";
import { loadPreferences, loadObjectives } from "@/services/goalsApi";

export default function ProfilePage() {
  const router = useRouter();
  const gAuth = useGoogleAuth();
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [hasGoals, setHasGoals] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("gymtec.busySlots");
        if (raw) {
          const slots = JSON.parse(raw) as BusySlot[];
          setBusySlots(slots);
          setSelected(fromBusySlots(slots));
        }
      } catch {
        /* ignore */
      }
      const savedPrefs = loadPreferences();
      if (savedPrefs) setPrefs(savedPrefs);
      const savedObjs = loadObjectives();
      setHasGoals(!!savedObjs);
    }
  }, []);

  const totalHours = editMode ? selected.size : busySlots.length;

  function handleStartEdit() {
    setSelected(fromBusySlots(busySlots));
    setEditMode(true);
    setMessage(null);
  }

  function handleCancelEdit() {
    setEditMode(false);
    setMessage(null);
  }

  function toggle(day: DayCode, hour: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = slotKey(day, hour);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const slots = toBusySlots(selected);
      window.localStorage.setItem("gymtec.busySlots", JSON.stringify(slots));
      await saveSchedule({ student_id: STUDENT_ID, busy_slots: slots });
      setBusySlots(slots);
      setEditMode(false);
      setMessage("Horario actualizado correctamente");
    } catch {
      setMessage("Error al guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResyncCalendar() {
    if (!gAuth.token) return;
    setResyncing(true);
    setMessage(null);
    try {
      const res = await fetchCalendarEvents(gAuth.token);
      const allSelected = res.events.map((ev) => ({ ...ev, selected: true as const }));
      const calSlots = calendarEventsToBusySlots(allSelected);
      // Replace with fresh calendar data (no stale merge)
      window.localStorage.setItem("gymtec.busySlots", JSON.stringify(calSlots));
      await saveSchedule({ student_id: STUDENT_ID, busy_slots: calSlots });
      setBusySlots(calSlots);
      setSelected(fromBusySlots(calSlots));
      setMessage(`Calendario resincronizado (${res.events.length} eventos)`);
    } catch {
      setMessage("Error al resincronizar. Verifica tu conexión.");
    } finally {
      setResyncing(false);
    }
  }

  async function handleConnectGoogle() {
    setGoogleConnecting(true);
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      setMessage("Error al conectar con Google");
      setGoogleConnecting(false);
    }
  }

  function handleDisconnectGoogle() {
    gAuth.disconnect();
    setMessage("Google Calendar desconectado");
  }

  return (
    <MobileShell>
      <h1 className="text-[20px] font-medium text-ink-900 mt-1">Perfil</h1>

      {/* User card */}
      <div className="flex items-center gap-3.5 mt-3 bg-white border border-black/5 rounded-card p-3.5">
        {gAuth.connected && gAuth.user?.picture ? (
          <img
            src={gAuth.user.picture}
            alt=""
            className="w-14 h-14 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#E6F1FB] text-ink-700 flex items-center justify-center text-lg font-medium">
            {gAuth.user?.name
              ? gAuth.user.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "JS"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-ink-900">
            {gAuth.user?.name ?? "Juana Soto"}
          </div>
          <div className="text-[11px] text-neutral-700 truncate">
            {gAuth.user?.email ?? "Ingeniería · 5to ciclo"}
          </div>
          <div className="text-[10px] text-gold-700 mt-1 flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            Última actualización: hoy
          </div>
        </div>
      </div>

      {/* Google Calendar connection status */}
      <div className="mt-4 bg-white border border-black/5 rounded-card px-3.5 py-3">
        <div className="text-xs font-medium text-ink-900 mb-2">
          Google Calendar
        </div>
        {gAuth.connected ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-green-600 flex-shrink-0">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[12px] text-green-800 truncate">
                Conectado{gAuth.user?.email ? ` · ${gAuth.user.email}` : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResyncCalendar}
                disabled={resyncing}
                className="flex-1 text-[11px] font-medium text-ink-500 py-1.5 rounded-lg border border-ink-500/20 hover:bg-ink-500/5 transition-colors disabled:opacity-50"
              >
                {resyncing ? "Resincronizando..." : "Resincronizar calendario"}
              </button>
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="text-[11px] font-medium text-red-500 py-1.5 px-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
              >
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnectGoogle}
            disabled={googleConnecting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-black/10 bg-white hover:bg-neutral-50 transition-colors text-[12px] font-medium text-ink-900 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleConnecting ? "Conectando..." : "Conectar Google Calendar"}
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className="mt-3 text-[12px] text-center text-ink-700 bg-ink-500/5 rounded-lg py-2 px-3">
          {message}
        </div>
      )}

      {/* Schedule section */}
      <section className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-ink-900">
            Mi horario ocupado
          </span>
          <span className="text-[10px] text-neutral-700">
            {totalHours} hrs / semana
          </span>
        </div>

        {editMode ? (
          <ScheduleGrid selected={selected} onToggle={toggle} />
        ) : (
          <ScheduleGrid
            selected={fromBusySlots(busySlots)}
            onToggle={() => {}}
            readOnly
            compact
            hours={[8, 11, 14, 17]}
          />
        )}
      </section>

      {/* Actions */}
      <div className="mt-4 flex flex-col gap-2.5">
        {editMode ? (
          <>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button variant="secondary" onClick={handleCancelEdit} disabled={saving}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button onClick={handleStartEdit}>Editar mi horario</Button>
        )}
      </div>

      {/* Goals & preferences */}
      <div className="mt-4 bg-white border border-black/5 rounded-card px-3.5 py-0.5">
        <ProfileRow
          label="🎯 Mis objetivos"
          value={hasGoals ? "Configurados" : "Sin configurar"}
          href="/goals"
        />
        <ProfileRow
          label="🏋️ Tipo de entreno"
          value={prefs ? ({ fuerza: "Fuerza", cardio: "Cardio", funcional: "Funcional", maquinas: "Máquinas", pesas: "Pesas", mixto: "Mixto" })[prefs.training_type] : "—"}
          href="/goals"
        />
        <ProfileRow
          label="⚡ Intensidad"
          value={prefs ? ({ baja: "Suave", media: "Moderada", alta: "Intensa" })[prefs.intensity] : "—"}
          href="/goals"
        />
        <ProfileRow
          label="🕐 Horario preferido"
          value={prefs ? ({ "mañana": "Mañana", tarde: "Tarde", noche: "Noche", flexible: "Flexible" })[prefs.preferred_time] : "—"}
          href="/goals"
          last
        />
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

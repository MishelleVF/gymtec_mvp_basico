// src/app/schedule/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileShell from "@/components/layout/MobileShell";
import Button from "@/components/ui/Button";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import CalendarEventReview from "@/components/calendar/CalendarEventReview";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import DataSourceBanner from "@/components/ui/DataSourceBanner";
import { BusySlot, CalendarEvent, DataSource, DayCode } from "@/types/gymtec";
import { STUDENT_ID, slotKey, toBusySlots, fromBusySlots } from "@/lib/utils";
import { saveSchedule } from "@/services/gymtecApi";
import { useGoogleAuth } from "@/context/GoogleAuthContext";
import {
  getGoogleAuthUrl,
  fetchCalendarEvents,
  calendarEventsToBusySlots,
} from "@/services/googleCalendarApi";

type InputMode = "manual" | "calendar";

export default function SchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gAuth = useGoogleAuth();

  // --- shared state ---
  const [mode, setMode] = useState<InputMode>("manual");
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // --- manual mode ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- calendar mode ---
  const [calLoading, setCalLoading] = useState(false);
  const [calConnecting, setCalConnecting] = useState(false);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [calWeekLabel, setCalWeekLabel] = useState("");
  const [calEventsLoaded, setCalEventsLoaded] = useState(false);

  // ---------------------------------------------------------------------------
  // On mount: load saved schedule (for editing) and restore calendar state
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gymtec.busySlots");
      if (raw) {
        const slots = JSON.parse(raw) as BusySlot[];
        if (slots.length > 0) {
          setSelected(fromBusySlots(slots));
          setIsEditing(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Handle OAuth callback (?code=…)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;

    // Clean the URL
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("scope");
    window.history.replaceState({}, "", url.pathname);

    (async () => {
      setCalLoading(true);
      setError(null);
      try {
        await gAuth.connectWithCode(code);
      } catch (e) {
        setError(
          e instanceof Error
            ? `Error al conectar Google Calendar: ${e.message}`
            : "Error al conectar"
        );
        setCalLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // When Google is connected and we haven't loaded events yet, load them
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gAuth.connected && gAuth.token && !calEventsLoaded && !calLoading) {
      setMode("calendar");
      loadCalendarEvents(gAuth.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gAuth.connected, gAuth.token]);

  // ---------------------------------------------------------------------------
  // Calendar helpers
  // ---------------------------------------------------------------------------
  async function loadCalendarEvents(token: string) {
    setCalLoading(true);
    setError(null);
    try {
      const res = await fetchCalendarEvents(token);
      setCalEvents(res.events.map((ev) => ({ ...ev, selected: true })));
      setCalWeekLabel(res.week_label);
      setCalEventsLoaded(true);
      // Clear stale manual selections — calendar is now the source of truth
      setSelected(new Set());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al obtener eventos"
      );
    } finally {
      setCalLoading(false);
    }
  }

  async function handleResyncCalendar() {
    if (!gAuth.token) return;
    setCalEventsLoaded(false);
    await loadCalendarEvents(gAuth.token);
  }

  async function handleConnectGoogle() {
    if (gAuth.connected && gAuth.token) {
      setMode("calendar");
      if (!calEventsLoaded) await loadCalendarEvents(gAuth.token);
      return;
    }

    setCalConnecting(true);
    setError(null);
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo conectar con Google: ${e.message}`
          : "Error al conectar"
      );
      setCalConnecting(false);
    }
  }

  function handleDisconnectGoogle() {
    gAuth.disconnect();
    setCalEvents([]);
    setCalWeekLabel("");
    setCalEventsLoaded(false);
    setMode("manual");
  }

  function toggleCalEvent(eventId: string) {
    setCalEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId ? { ...ev, selected: !ev.selected } : ev
      )
    );
  }

  function selectAllCalEvents() {
    setCalEvents((prev) => prev.map((ev) => ({ ...ev, selected: true })));
  }

  function deselectAllCalEvents() {
    setCalEvents((prev) => prev.map((ev) => ({ ...ev, selected: false })));
  }

  // ---------------------------------------------------------------------------
  // Manual toggle
  // ---------------------------------------------------------------------------
  function toggle(day: DayCode, hour: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = slotKey(day, hour);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Merge & save
  // ---------------------------------------------------------------------------
  function buildFinalSlots() {
    if (mode === "calendar" && calEventsLoaded) {
      // In calendar mode, ONLY use calendar-derived slots (respecting deselection)
      return calendarEventsToBusySlots(calEvents);
    }
    return toBusySlots(selected);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const slots = buildFinalSlots();
      if (typeof window !== "undefined") {
        window.localStorage.setItem("gymtec.busySlots", JSON.stringify(slots));
      }
      const res = await saveSchedule({
        student_id: STUDENT_ID,
        busy_slots: slots,
      });
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

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const finalSlots = buildFinalSlots();
  const totalBlocks = finalSlots.length;

  return (
    <MobileShell showNav={false}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Volver"
          className="text-ink-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-5 h-5"
          >
            <path
              d="M15 6l-6 6 6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-[11px] text-neutral-500">
          {isEditing ? "Editar horario" : "Paso 2 de 3"}
        </span>
      </div>

      <h1 className="text-[20px] font-medium text-ink-900 leading-tight">
        {isEditing ? "Edita tu horario ocupado" : "Ingresa tu horario ocupado"}
      </h1>
      <p className="text-[13px] text-neutral-700 mt-1.5 leading-relaxed">
        {isEditing
          ? "Modifica las horas que tienes ocupadas. Los cambios se guardan al presionar Guardar."
          : "Selecciona las horas en las que tienes clase para recibir mejores recomendaciones."}
      </p>

      {source && (
        <div className="mt-3">
          <DataSourceBanner source={source} />
        </div>
      )}

      {/* Google Calendar: connect or status */}
      {!gAuth.connected ? (
        <button
          type="button"
          onClick={handleConnectGoogle}
          disabled={calConnecting || gAuth.loading}
          className="mt-4 w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-black/10 bg-white hover:bg-neutral-50 transition-colors text-[13px] font-medium text-ink-900 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {calConnecting || gAuth.loading
            ? "Conectando..."
            : "Conectar con Google Calendar"}
        </button>
      ) : (
        <div className="mt-4 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-green-200 bg-green-50">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-green-600 flex-shrink-0">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="flex-1 text-[12px] text-green-800 truncate">
            {gAuth.user?.email ?? "Google Calendar conectado"}
          </span>
        </div>
      )}

      {/* Mode toggle (only when calendar is connected) */}
      {gAuth.connected && (
        <div className="mt-3 flex rounded-lg border border-black/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("calendar")}
            className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
              mode === "calendar"
                ? "bg-ink-500 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            📅 Calendar
          </button>
          <button
            type="button"
            onClick={() => {
              // When switching to manual, populate grid from current calendar selection
              if (calEventsLoaded) {
                const calSlots = calendarEventsToBusySlots(calEvents);
                setSelected(fromBusySlots(calSlots));
              }
              setMode("manual");
            }}
            className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
              mode === "manual"
                ? "bg-ink-500 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            ✏️ Manual
          </button>
        </div>
      )}

      {/* Calendar mode */}
      {mode === "calendar" && gAuth.connected && (
        <div className="mt-3">
          {calLoading && <LoadingState label="Importando eventos..." />}
          {!calLoading && calEventsLoaded && calEvents.length === 0 && (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-[13px] font-medium text-ink-900">
                No encontramos eventos esta semana
              </p>
              <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed max-w-[260px] mx-auto">
                Tu Google Calendar no tiene eventos entre {calWeekLabel}.
                Puedes cambiar a modo manual o guardar disponibilidad completa.
              </p>
              <div className="flex gap-2 justify-center mt-3">
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className="text-[12px] font-medium text-ink-500 px-3 py-1.5 rounded-lg border border-ink-500/20 hover:bg-ink-500/5 transition-colors"
                >
                  Usar modo manual
                </button>
                <button
                  type="button"
                  onClick={handleResyncCalendar}
                  className="text-[12px] font-medium text-neutral-600 px-3 py-1.5 rounded-lg border border-black/10 hover:bg-neutral-50 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}
          {!calLoading && calEventsLoaded && calEvents.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-neutral-500">
                  Semana: {calWeekLabel}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResyncCalendar}
                    className="text-[11px] text-ink-500 font-medium hover:underline"
                  >
                    Resincronizar
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="text-[11px] text-red-500 font-medium hover:underline"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
              <CalendarEventReview
                events={calEvents}
                onToggle={toggleCalEvent}
                onSelectAll={selectAllCalEvents}
                onDeselectAll={deselectAllCalEvents}
              />
            </>
          )}
        </div>
      )}

      {/* Manual mode */}
      {mode === "manual" && (
        <>
          <div className="flex gap-3 mt-3 mb-3 text-[11px] text-neutral-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-ink-500" /> Ocupado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-neutral-100 border border-black/10" />{" "}
              Libre
            </span>
          </div>
          <ScheduleGrid selected={selected} onToggle={toggle} />
        </>
      )}

      {/* Summary */}
      <div className="text-[11px] text-neutral-700 mt-3 flex items-center gap-1.5">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#185FA5"
          strokeWidth="1.5"
          className="w-3.5 h-3.5"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
        <span>
          {totalBlocks} bloques seleccionados · {totalBlocks} hrs / semana
          {mode === "calendar" && selected.size > 0 && (
            <> (+ {selected.size} manuales)</>
          )}
        </span>
      </div>

      {error && (
        <ErrorState
          title="Ocurrió un error"
          message={error}
          onRetry={
            mode === "calendar" && !gAuth.connected
              ? handleConnectGoogle
              : handleSave
          }
        />
      )}

      <div className="flex flex-col gap-2.5 mt-5">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar horario"}
        </Button>
        {!isEditing && (
          <Button variant="secondary" onClick={handleSkip} disabled={saving}>
            Lo haré después
          </Button>
        )}
      </div>
    </MobileShell>
  );
}

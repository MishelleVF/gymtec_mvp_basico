// src/app/goals/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/layout/MobileShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  UserPreferences,
  UserObjectives,
  GoalEstimation,
  TrainingType,
  Intensity,
  ExperienceLevel,
  FitnessGoal,
  DayCode,
} from "@/types/gymtec";
import {
  estimateGoal,
  savePreferences,
  saveObjectives,
  loadPreferences,
  loadObjectives,
  DEFAULT_PREFERENCES,
  DEFAULT_OBJECTIVES,
} from "@/services/goalsApi";
import { DAYS, DAY_LABEL } from "@/lib/utils";

// ── Option configs ─────────────────────────────────────────────────

const GOAL_OPTIONS: { value: FitnessGoal; label: string; emoji: string }[] = [
  { value: "bajar_peso", label: "Bajar de peso", emoji: "🔥" },
  { value: "ganar_musculo", label: "Ganar masa muscular", emoji: "💪" },
  { value: "mantenerse_activo", label: "Mantenerse activo", emoji: "🏃" },
  { value: "mejorar_resistencia", label: "Mejorar resistencia", emoji: "❤️" },
  { value: "tonificar", label: "Tonificar", emoji: "✨" },
];

const TRAINING_OPTIONS: { value: TrainingType; label: string; emoji: string }[] = [
  { value: "fuerza", label: "Fuerza", emoji: "🏋️" },
  { value: "cardio", label: "Cardio", emoji: "🫀" },
  { value: "funcional", label: "Funcional", emoji: "🤸" },
  { value: "maquinas", label: "Máquinas", emoji: "⚙️" },
  { value: "pesas", label: "Pesas", emoji: "🏋️" },
  { value: "mixto", label: "Mixto", emoji: "🔄" },
];

const INTENSITY_OPTIONS: { value: Intensity; label: string; color: string }[] = [
  { value: "baja", label: "Suave", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "media", label: "Moderada", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "alta", label: "Intensa", color: "bg-red-100 text-red-700 border-red-200" },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: "principiante", label: "Principiante", desc: "Empezando o retomando" },
  { value: "intermedio", label: "Intermedio", desc: "Entreno regularmente" },
  { value: "avanzado", label: "Avanzado", desc: "+2 años de experiencia" },
];

const TIME_PREF_OPTIONS = [
  { value: "mañana", label: "🌅 Mañana", desc: "6am–12pm" },
  { value: "tarde", label: "☀️ Tarde", desc: "12pm–6pm" },
  { value: "noche", label: "🌙 Noche", desc: "6pm–10pm" },
  { value: "flexible", label: "🔄 Flexible", desc: "Cualquier hora" },
];

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const ACTIVITY_OPTIONS = [
  { value: "sedentario", label: "Sedentario", desc: "Poco o nada de ejercicio" },
  { value: "ligero", label: "Ligero", desc: "1-2 veces/semana" },
  { value: "moderado", label: "Moderado", desc: "3-4 veces/semana" },
  { value: "activo", label: "Activo", desc: "5+ veces/semana" },
];

type Step = "preferences" | "objectives" | "result";

export default function GoalsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("preferences");
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [objs, setObjs] = useState<UserObjectives>(DEFAULT_OBJECTIVES);
  const [estimation, setEstimation] = useState<GoalEstimation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved data
  useEffect(() => {
    const savedPrefs = loadPreferences();
    if (savedPrefs) setPrefs(savedPrefs);
    const savedObjs = loadObjectives();
    if (savedObjs) setObjs(savedObjs);
  }, []);

  function toggleDay(day: DayCode) {
    setPrefs((p) => ({
      ...p,
      preferred_days: p.preferred_days.includes(day)
        ? p.preferred_days.filter((d) => d !== day)
        : [...p.preferred_days, day],
    }));
  }

  async function handleEstimate() {
    setLoading(true);
    setError(null);
    savePreferences(prefs);
    saveObjectives(objs);
    try {
      const result = await estimateGoal({ objectives: objs, preferences: prefs });
      setEstimation(result);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al calcular");
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    savePreferences(prefs);
    saveObjectives(objs);
    router.push("/today");
  }

  return (
    <MobileShell showNav={false}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() =>
            step === "preferences"
              ? router.back()
              : step === "objectives"
              ? setStep("preferences")
              : setStep("objectives")
          }
          aria-label="Volver"
          className="text-ink-500"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[11px] text-neutral-500">
          {step === "preferences" && "Paso 1 de 3 · Preferencias"}
          {step === "objectives" && "Paso 2 de 3 · Objetivos"}
          {step === "result" && "Paso 3 de 3 · Tu plan"}
        </span>
      </div>

      {/* ── Step 1: Preferences ─────────────────────────── */}
      {step === "preferences" && (
        <>
          <h1 className="text-[20px] font-medium text-ink-900 leading-tight">
            ¿Cómo te gusta entrenar?
          </h1>
          <p className="text-[13px] text-neutral-700 mt-1.5 leading-relaxed">
            Cuéntanos sobre tu estilo para personalizar tu experiencia.
          </p>

          {/* Training type */}
          <SectionLabel label="Tipo de entrenamiento" />
          <div className="grid grid-cols-3 gap-2">
            {TRAINING_OPTIONS.map((opt) => (
              <OptionChip
                key={opt.value}
                selected={prefs.training_type === opt.value}
                onClick={() => setPrefs((p) => ({ ...p, training_type: opt.value }))}
                emoji={opt.emoji}
                label={opt.label}
              />
            ))}
          </div>

          {/* Intensity */}
          <SectionLabel label="Intensidad deseada" />
          <div className="grid grid-cols-3 gap-2">
            {INTENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, intensity: opt.value }))}
                className={`py-2.5 rounded-xl text-[12px] font-medium border transition-all ${
                  prefs.intensity === opt.value
                    ? opt.color + " ring-2 ring-offset-1 ring-current/20 scale-[1.02]"
                    : "bg-white text-neutral-600 border-black/10 hover:bg-neutral-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Preferred days */}
          <SectionLabel label="Días preferidos" />
          <div className="flex gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`flex-1 py-2 rounded-xl text-[12px] font-medium border transition-all ${
                  prefs.preferred_days.includes(d)
                    ? "bg-ink-500 text-white border-ink-500 scale-[1.02]"
                    : "bg-white text-neutral-600 border-black/10 hover:bg-neutral-50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Preferred time */}
          <SectionLabel label="Horario preferido" />
          <div className="grid grid-cols-2 gap-2">
            {TIME_PREF_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, preferred_time: opt.value as any }))}
                className={`py-2.5 px-3 rounded-xl border text-left transition-all ${
                  prefs.preferred_time === opt.value
                    ? "bg-ink-500/5 border-ink-500/30 ring-1 ring-ink-500/20"
                    : "bg-white border-black/10 hover:bg-neutral-50"
                }`}
              >
                <div className="text-[12px] font-medium text-ink-900">{opt.label}</div>
                <div className="text-[10px] text-neutral-500">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Session duration */}
          <SectionLabel label={`Duración por sesión: ${prefs.session_duration_min} min`} />
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, session_duration_min: d }))}
                className={`flex-1 py-2 rounded-xl text-[12px] font-medium border transition-all ${
                  prefs.session_duration_min === d
                    ? "bg-ink-500 text-white border-ink-500"
                    : "bg-white text-neutral-600 border-black/10 hover:bg-neutral-50"
                }`}
              >
                {d}′
              </button>
            ))}
          </div>

          {/* Experience level */}
          <SectionLabel label="Nivel de experiencia" />
          <div className="flex flex-col gap-2">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, experience_level: opt.value }))}
                className={`py-2.5 px-3.5 rounded-xl border text-left transition-all ${
                  prefs.experience_level === opt.value
                    ? "bg-ink-500/5 border-ink-500/30 ring-1 ring-ink-500/20"
                    : "bg-white border-black/10 hover:bg-neutral-50"
                }`}
              >
                <div className="text-[13px] font-medium text-ink-900">{opt.label}</div>
                <div className="text-[11px] text-neutral-500">{opt.desc}</div>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <Button onClick={() => { savePreferences(prefs); setStep("objectives"); }}>
              Continuar
            </Button>
          </div>
        </>
      )}

      {/* ── Step 2: Objectives ──────────────────────────── */}
      {step === "objectives" && (
        <>
          <h1 className="text-[20px] font-medium text-ink-900 leading-tight">
            ¿Cuál es tu objetivo?
          </h1>
          <p className="text-[13px] text-neutral-700 mt-1.5 leading-relaxed">
            Define tu meta y te estimaremos cuánto tiempo te tomará.
          </p>

          {/* Goal */}
          <SectionLabel label="Objetivo principal" />
          <div className="flex flex-col gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setObjs((o) => ({ ...o, goal: opt.value }))}
                className={`flex items-center gap-3 py-3 px-3.5 rounded-xl border text-left transition-all ${
                  objs.goal === opt.value
                    ? "bg-ink-500/5 border-ink-500/30 ring-1 ring-ink-500/20 scale-[1.01]"
                    : "bg-white border-black/10 hover:bg-neutral-50"
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-[13px] font-medium text-ink-900">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Weight */}
          <SectionLabel label="Peso actual (kg)" />
          <input
            type="number"
            value={objs.current_weight_kg}
            onChange={(e) => setObjs((o) => ({ ...o, current_weight_kg: Number(e.target.value) }))}
            min={30}
            max={250}
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-[14px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-500/30"
          />

          {(objs.goal === "bajar_peso" || objs.goal === "ganar_musculo" || objs.goal === "tonificar") && (
            <>
              <SectionLabel label="Peso objetivo (kg)" />
              <input
                type="number"
                value={objs.target_weight_kg ?? ""}
                onChange={(e) =>
                  setObjs((o) => ({
                    ...o,
                    target_weight_kg: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                min={30}
                max={250}
                placeholder="Ej: 65"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-[14px] text-ink-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-ink-500/30"
              />
            </>
          )}

          {/* Frequency */}
          <SectionLabel label={`Frecuencia semanal: ${objs.weekly_frequency} veces`} />
          <input
            type="range"
            min={1}
            max={7}
            value={objs.weekly_frequency}
            onChange={(e) => setObjs((o) => ({ ...o, weekly_frequency: Number(e.target.value) }))}
            className="w-full accent-ink-500"
          />
          <div className="flex justify-between text-[10px] text-neutral-500 -mt-1">
            <span>1×</span><span>3×</span><span>5×</span><span>7×</span>
          </div>

          {/* Activity level */}
          <SectionLabel label="Nivel actual de actividad" />
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setObjs((o) => ({ ...o, activity_level: opt.value as any }))}
                className={`py-2.5 px-3 rounded-xl border text-left transition-all ${
                  objs.activity_level === opt.value
                    ? "bg-ink-500/5 border-ink-500/30 ring-1 ring-ink-500/20"
                    : "bg-white border-black/10 hover:bg-neutral-50"
                }`}
              >
                <div className="text-[12px] font-medium text-ink-900">{opt.label}</div>
                <div className="text-[10px] text-neutral-500">{opt.desc}</div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-3 text-[12px] text-red-600 text-center bg-red-50 rounded-lg py-2">
              {error}
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleEstimate} disabled={loading}>
              {loading ? "Calculando..." : "Calcular mi plan"}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 3: Result ──────────────────────────────── */}
      {step === "result" && estimation && (
        <>
          <div className="text-center mt-2">
            <div className="text-4xl mb-2">🎯</div>
            <h1 className="text-[20px] font-medium text-ink-900 leading-tight">
              Tu plan personalizado
            </h1>
            <p className="text-[13px] text-neutral-700 mt-1.5 leading-relaxed">
              Basado en tus objetivos y preferencias
            </p>
          </div>

          {/* Main estimation card */}
          <Card accent="primary" className="mt-4 p-5 text-center">
            <div className="text-[11px] font-medium text-ink-500 uppercase tracking-wider">
              Tiempo estimado
            </div>
            <div className="text-[36px] font-medium text-ink-900 tracking-tight mt-1">
              {estimation.estimated_weeks <= 0
                ? "¡Ya estás ahí!"
                : estimation.estimated_weeks < 5
                ? `${estimation.estimated_weeks} semanas`
                : `${Math.round(estimation.estimated_weeks / 4.33)} meses`}
            </div>
            {estimation.estimated_weeks > 0 && (
              <div className="text-[12px] text-neutral-600 mt-1">
                ~{estimation.estimated_weeks} semanas
              </div>
            )}
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <Card className="p-3.5 text-center">
              <div className="text-[11px] text-neutral-600">Dificultad</div>
              <div className={`text-[16px] font-medium mt-0.5 ${
                estimation.difficulty === "bajo"
                  ? "text-emerald-600"
                  : estimation.difficulty === "medio"
                  ? "text-amber-600"
                  : "text-red-600"
              }`}>
                {estimation.difficulty === "bajo" ? "🟢 Alcanzable" : estimation.difficulty === "medio" ? "🟡 Moderado" : "🔴 Desafiante"}
              </div>
            </Card>
            <Card className="p-3.5 text-center">
              <div className="text-[11px] text-neutral-600">Frecuencia ideal</div>
              <div className="text-[16px] font-medium text-ink-900 mt-0.5">
                {estimation.recommended_frequency}× / semana
              </div>
            </Card>
          </div>

          {/* Message */}
          <Card className="mt-3 p-4">
            <div className="flex gap-2.5">
              <span className="text-lg flex-shrink-0">💡</span>
              <p className="text-[12px] text-neutral-700 leading-relaxed">
                {estimation.message}
              </p>
            </div>
          </Card>

          {/* Disclaimer */}
          <div className="mt-3 text-[10px] text-neutral-500 text-center leading-relaxed px-4">
            ⚠️ Esta estimación es un prototipo basado en datos sintéticos.
            Los resultados reales dependen de alimentación, descanso, genética y constancia.
          </div>

          <div className="flex flex-col gap-2.5 mt-5">
            <Button onClick={handleDone}>Ir a mis recomendaciones</Button>
            <Button variant="secondary" onClick={() => setStep("objectives")}>
              Ajustar mis objetivos
            </Button>
          </div>
        </>
      )}
    </MobileShell>
  );
}

// ── Shared UI components ───────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="text-[12px] font-medium text-ink-900 mt-4 mb-2">
      {label}
    </div>
  );
}

function OptionChip({
  selected,
  onClick,
  emoji,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
        selected
          ? "bg-ink-500/5 border-ink-500/30 ring-1 ring-ink-500/20 scale-[1.02]"
          : "bg-white border-black/10 hover:bg-neutral-50"
      }`}
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-[11px] font-medium text-ink-900">{label}</span>
    </button>
  );
}

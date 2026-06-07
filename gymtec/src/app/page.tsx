// src/app/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import MobileShell from "@/components/layout/MobileShell";
import Button from "@/components/ui/Button";
import { useGoogleAuth } from "@/context/GoogleAuthContext";
import { getGoogleAuthUrl } from "@/services/googleCalendarApi";

export default function OnboardingPage() {
  const { connected, user, loading } = useGoogleAuth();
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnectGoogle() {
    setGoogleConnecting(true);
    setError(null);
    try {
      // Redirect to Google OAuth — callback lands on /schedule
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al conectar con Google"
      );
      setGoogleConnecting(false);
    }
  }

  return (
    <MobileShell showNav={false}>
      <div className="flex flex-col h-full justify-between pt-10 pb-6">
        <div className="flex flex-col items-center gap-6 mt-10">
          <div className="w-16 h-16 rounded-2xl bg-ink-500 flex items-center justify-center text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
              <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-[11px] tracking-[0.2em] text-gold-700 font-medium mb-1.5">
              GYMTEC · UTEC
            </div>
            <h1 className="text-[22px] font-medium text-ink-900 leading-tight">
              Encuentra el mejor horario para entrenar en UTEC
            </h1>
            <p className="text-sm text-neutral-700 mt-3 leading-relaxed">
              Predicción de aforo y recomendaciones personalizadas según tu horario.
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-3.5 mb-7">
            <Feature
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[18px] h-[18px] text-ink-500">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
              }
              title="Tu horario, considerado"
              hint="Cruzamos clases con aforo del gym."
            />
            <Feature
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[18px] h-[18px] text-ink-500">
                  <path d="M3 17l5-5 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 9h5v5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="Predicción por hora"
              hint="Datos históricos y carga académica."
            />
            <Feature
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[18px] h-[18px] text-ink-500">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
              }
              title="Recomendación accionable"
              hint="Sabes a qué hora ir y por qué."
            />
          </div>

          {/* Google Calendar connection */}
          {connected ? (
            <div className="mb-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-green-200 bg-green-50">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-green-600 flex-shrink-0">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-green-800">
                  Google Calendar conectado
                </div>
                {user && (
                  <div className="text-[11px] text-green-700 truncate">
                    {user.email}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={googleConnecting || loading}
              className="mb-4 w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-black/10 bg-white hover:bg-neutral-50 transition-colors text-[13px] font-medium text-ink-900 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleConnecting || loading
                ? "Conectando..."
                : "Conectar con Google Calendar"}
            </button>
          )}

          {error && (
            <div className="mb-4 text-[12px] text-red-600 text-center">
              {error}
            </div>
          )}

          <Link href="/schedule">
            <Button>Comenzar</Button>
          </Link>

          <div className="flex gap-1.5 justify-center mt-5">
            <span className="block w-4 h-1.5 rounded-sm bg-ink-500" />
            <span className="block w-1.5 h-1.5 rounded-full bg-black/15" />
            <span className="block w-1.5 h-1.5 rounded-full bg-black/15" />
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function Feature({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex gap-3 items-start bg-white/60 backdrop-blur-sm rounded-xl px-3.5 py-3 border border-black/5">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-ink-500/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[13px] font-medium text-ink-900">{title}</div>
        <div className="text-[11px] text-neutral-700 leading-relaxed">{hint}</div>
      </div>
    </div>
  );
}

// src/app/page.tsx
import Link from "next/link";
import MobileShell from "@/components/layout/MobileShell";
import Button from "@/components/ui/Button";

export default function OnboardingPage() {
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
    <div className="flex gap-3 items-start">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-sm font-medium text-ink-900">{title}</div>
        <div className="text-[11px] text-neutral-700">{hint}</div>
      </div>
    </div>
  );
}

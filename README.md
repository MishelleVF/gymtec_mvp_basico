<<<<<<< HEAD
# GYMTEC · Frontend (Next.js)

App móvil para estudiantes UTEC que predice el aforo del gimnasio y recomienda horarios personalizados.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Listo para desplegar en Vercel

## Estructura

```
src/
  app/                     # App Router pages
    page.tsx               # Onboarding (1)
    schedule/page.tsx      # Ingreso de horario (2)
    today/page.tsx         # Home Hoy (3)
    recommendations/page.tsx # Top 3 (4)
    week/page.tsx          # Predicción semanal (5)
    profile/page.tsx       # Perfil (6)
  components/
    layout/                # MobileShell, BottomNav
    cards/                 # RecommendationCard, ConfidenceCard, InsightCard
    charts/                # DailyForecastTimeline, WeeklyHeatmap
    schedule/              # ScheduleGrid, ScheduleSlot
    ui/                    # Badge, Button, Card, LoadingState, ErrorState, DataSourceBanner
  services/
    api.ts                 # Fetch wrapper (timeouts, errores)
    gymtecApi.ts           # Endpoints de dominio con fallback a mock
  data/
    mockData.ts            # Datos de demo (fallback)
  types/
    gymtec.ts              # Tipos del contrato API
  lib/
    utils.ts               # cn(), helpers de horario, colores de aforo
```

## Cómo correrlo localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abre <http://localhost:3000>. Sin backend corriendo el frontend usará automáticamente `mockData` y mostrará un banner discreto "Usando datos de demostración".

## Variables de entorno

`.env.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Endpoints que el frontend consume

| Método | Ruta | Función en `gymtecApi.ts` |
|---|---|---|
| GET  | `/health` | `checkHealth()` |
| POST | `/api/v1/schedule` | `saveSchedule(payload)` |
| POST | `/api/v1/recommendations/today` | `getTodayRecommendations(payload)` |
| GET  | `/api/v1/forecast/week` | `getWeeklyForecast()` |
| POST | `/api/v1/recommendations/explain` | `explainRecommendation(payload)` |

Todas las funciones devuelven `ApiResult<T> = { data, source, error? }`. Cuando el backend falla por timeout o error de red, `source: 'mock'` y la UI muestra el `DataSourceBanner`. No hay try/catch repetido en cada pantalla: se delega a `liveOrMock()`.

## Despliegue en Vercel

1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel.
3. Agrega la variable `NEXT_PUBLIC_API_URL` apuntando a tu backend público (cuando lo tengas).
4. Deploy.

Mientras solo exista backend local, déjala apuntando a `http://localhost:8000`; en producción Vercel no podrá alcanzarlo, así que el frontend caerá a datos mock automáticamente.

---

## Guía rápida: backend FastAPI con el modelo `.pkl`

Estructura sugerida:

```
backend/
  main.py
  schemas.py
  services/
    model_service.py          # Carga gymtec_model.pkl al iniciar
    recommendation_service.py # Genera Top 3 y explicaciones
  models/
    gymtec_model.pkl
  data/
    gold_aforo_horario_modelo.csv
  requirements.txt
```

**`main.py` (boilerplate mínimo):**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.model_service import ModelService
from services.recommendation_service import RecommendationService
from schemas import (
    SaveScheduleRequest, SaveScheduleResponse,
    TodayRequest, TodayResponse,
    WeekResponse, ExplainRequest, ExplanationResponse,
)

app = FastAPI(title="GYMTEC API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = ModelService.load("models/gymtec_model.pkl")
reco = RecommendationService(model=model, data_path="data/gold_aforo_horario_modelo.csv")

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model.is_loaded, "version": "0.1.0"}

@app.post("/api/v1/schedule", response_model=SaveScheduleResponse)
def save_schedule(payload: SaveScheduleRequest):
    # Persiste en memoria, SQLite o filesystem según prefieras
    return {"status": "ok", "message": "Horario registrado correctamente"}

@app.post("/api/v1/recommendations/today", response_model=TodayResponse)
def today(payload: TodayRequest):
    return reco.recommend_today(payload)

@app.get("/api/v1/forecast/week", response_model=WeekResponse)
def week():
    return reco.forecast_week()

@app.post("/api/v1/recommendations/explain", response_model=ExplanationResponse)
def explain(payload: ExplainRequest):
    return reco.explain(payload)
```

**Pasos del pipeline en `recommendation_service.py`:**

1. Cargar `gymtec_model.pkl` con `joblib.load` o `pickle.load` al arrancar.
2. Para cada hora `h ∈ [09:00..18:00]` de la fecha pedida, construir un vector de features compatible con el modelo: día de la semana, hora, carga académica (desde `gold_aforo_horario_modelo.csv`), rezagos históricos, etc.
3. Predecir aforo: `y_hat = model.predict(X)`.
4. Discretizar `y_hat` en niveles `Bajo/Medio/Alto` usando umbrales (p.ej. cuantiles 0.33 y 0.66 del histórico).
5. Filtrar las horas en que el alumno está ocupado (`busy_slots`).
6. Calcular `score = w1 · (1 − aforo_norm) + w2 · carga_academica_norm + w3 · disponibilidad`.
7. Ordenar y devolver Top 3 con su `confidence` (intervalo de predicción del modelo, o varianza relativa).
8. `explain()` devuelve los 3 factores principales con su impacto.

**CORS**: deja `allow_origins=["http://localhost:3000"]` mientras desarrollas. En producción reemplaza por el dominio de Vercel.

**Verificación rápida**: con el backend corriendo en `:8000`, el banner amarillo desaparece y el frontend muestra `source: 'live'`.

---

## Notas de diseño

- Mobile-first (max 420px). En desktop se renderiza como un device frame centrado para QA visual.
- Paleta: `canvas #FAFAF7`, `ink-500 #185FA5`, verde/ámbar/rojo solo para codificar aforo.
- Formato 24h en toda la app.
- Persistencia local de `busy_slots` en `localStorage` con clave `gymtec.busySlots` mientras no exista backend.
=======
# gymtec_mvp_basico


para empezar:

unzip gymtec.zip && cd gymtec
cp .env.example .env.local
npm install
npm run dev
>>>>>>> 02c91563942f45bfae9a6a3e71b470bc04485ae3

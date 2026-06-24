# GYMTEC — Esquema ML → Frontend

Vista de un solo vistazo: qué hace el pipeline, qué archivos produce y
cómo cada pantalla del frontend los consume.

---

## 1. Diagrama de flujo end-to-end

```
┌────────────────────── INPUTS (Bronze) ──────────────────────┐
│  data/raw/horarios_clases.xlsx   data/raw/log_gym.xlsx      │
│  (clases académicas)             (ingresos/salidas QR)      │
└────────────────────────────┬────────────────────────────────┘
                             │ python -m src.data.clean_data
                             ▼
┌────────────────────── SILVER (limpio) ──────────────────────┐
│  data/interim/horarios_limpios.parquet                      │
│  data/interim/logs_limpios.parquet                          │
└────────────────────────────┬────────────────────────────────┘
                             │ python -m src.features.build_features
                             ▼
┌──────────────── SILVER+ / GOLD (feature store) ─────────────┐
│  data/interim/horarios_expandido_slots.parquet              │
│  data/processed/aforo_por_slot.parquet           ◀─ RF-03   │
│  data/processed/features_aforo_rf01.parquet      (interno)  │
└────────────────────────────┬────────────────────────────────┘
                             │ python -m src.models.train_model
                             ▼
┌──────────────────── ML (modelo entrenado) ──────────────────┐
│  models_artifacts/rf01_aforo_baseline.joblib                │
│  models_artifacts/rf01_aforo_metrics.json                   │
│  (RandomForest · MAE 2.63 · R² 0.89)                        │
└────────────────────────────┬────────────────────────────────┘
                             │ python -m src.models.predict_model
                             ▼
┌────────────────── GOLD (consumible) ────────────────────────┐
│  data/processed/predicciones_aforo.{parquet,csv}  ◀─ RF-01  │
└────────────────────────────┬────────────────────────────────┘
                             │ python -m src.recommendation.recommend_schedule
                             ▼
┌────────────────── GOLD (consumible) ────────────────────────┐
│  data/processed/recomendaciones_horario.{parquet,csv} ◀─ RF-02│
└─────────────────────────────────────────────────────────────┘
```

Todo se ejecuta con un solo comando: `python -m src.run_pipeline`.

---

## 2. Qué hace cada paso, en una línea

| Paso | Módulo | Qué hace |
|---|---|---|
| **Limpieza** | `src/data/clean_data.py` | Parsea horarios, descarta sesiones <16 min, calcula ocupación acumulada por día. |
| **Feature engineering** | `src/features/build_features.py` | Explota clases a slots de 30 min, agrega aforo, genera 30 features (lags, cíclicas, académicas). |
| **Train** | `src/models/train_model.py` | Entrena RandomForest con split temporal 80/20. |
| **Predict** | `src/models/predict_model.py` | Aplica el modelo a la grilla operativa del gym y clasifica nivel (RF-06). |
| **Recommend** | `src/recommendation/recommend_schedule.py` | Cruza predicciones con disponibilidad del estudiante y devuelve top-3. |

---

## 3. Mapa pantalla → archivo → endpoint sugerido

```
                   ┌─────────────────────────────────────────────┐
                   │                  FRONTEND                    │
                   └───────────────┬───────────────┬─────────────┘
                                   │               │
        ┌──────────────────────────┘               └──────────────────────────┐
        ▼                                                                     ▼
┌─────────────────────┐                                       ┌──────────────────────────┐
│  apps/student-app   │                                       │     apps/admin-web        │
└──────────┬──────────┘                                       └────────────┬─────────────┘
           │                                                               │
           │  HomeScreen          ─────► GET /predictions/today   ─────►   │
           │  PredictionScreen    ─────► GET /predictions          ─────►  │
           │  ResultsScreen       ─────► GET /low-occupancy?dia=X ─────►   │
           │  OptimizeScreen      ─────► POST /recommendations    ─────►   │
           │                                                               │
           │                                  ◄───── GET /occupancy/heatmap│ AdminDashboard
           │                                  ◄───── GET /occupancy/heatmap│ AdminDemandBalance
           ▼                                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND  (a crear: app/api/, FastAPI)                       │
│  - Lee data/processed/*.parquet                                                      │
│  - Ejecuta src.recommendation.recommend_schedule.recomendar_para_estudiante() vivo   │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                  CAPA ML (este branch)                               │
│  data/processed/predicciones_aforo.parquet                                           │
│  data/processed/recomendaciones_horario.parquet                                      │
│  data/processed/aforo_por_slot.parquet                                               │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tabla maestra de consumo

| Pantalla | Mock actual en el front | Endpoint nuevo | Lee el backend de | Devuelve |
|---|---|---|---|---|
| `HomeScreen` (aforo actual) | `getCurrentOccupancy()` | `GET /occupancy/current` | `aforo_por_slot.parquet` (último slot) | `{ percentage, level, recommendation }` |
| `HomeScreen` (predicción de hoy) | `getTodayPrediction()` | `GET /predictions/today` | `predicciones_aforo.parquet` filtrado por día actual | `[{ time, occupancy }]` |
| `PredictionScreen` | `getTodaySchedules()` | `GET /predictions?dia=Lunes` | `predicciones_aforo.parquet` | `[{ day, time, occupancy, level }]` |
| `OptimizeScreen` | `getRecommendedSlots()` | `POST /recommendations` | invoca `recomendar_para_estudiante()` | `{ recommended, alternatives }` |
| `ResultsScreen` | `getBlockComparison()` | `GET /low-occupancy?dia=Lunes&top=5` | invoca `franjas_menor_aforo()` | `[{ day, time, occupancy, level }]` |
| `WeeklyTrendChart` | `getWeeklyTrend()` | `GET /occupancy/weekly` | agrega `aforo_por_slot.parquet` por día | `[{ day, occupancy }]` |
| `AdminDashboard` (heatmap) | `getHeatmapData()` | `GET /occupancy/heatmap` | `aforo_por_slot.parquet` pivotado | `[{ day, hour, level, percentage }]` |
| `AdminDashboard` (métricas) | `getAdminMetrics()` | `GET /admin/metrics` | derivado de `predicciones_aforo` (próximo slot) | `[{ label, value, accent }]` |
| `AdminDemandBalance` | `getDemandBalanceData()` | `GET /admin/demand` | combina `aforo_por_slot` + `predicciones_aforo` | `[{ hour, baseline, withGymtec }]` |

---

## 5. Ejemplo concreto: pantalla → fetch → JSON → render

### `student-app/screens/HomeScreen.tsx` (predicción de hoy)

**Hoy** (mock):
```ts
const [pred, setPred] = useState<PredictionPoint[]>([])
useEffect(() => {
  getTodayPrediction().then(setPred)   // devuelve array hardcoded
}, [])
```

**Mañana** (con backend):
```ts
useEffect(() => {
  fetch("/api/predictions/today")
    .then(r => r.json())
    .then((rows: any[]) => {
      const adapted = rows.map(r => ({
        time: r.slot,                                          // "13:00"
        occupancy: Math.round(r.ratio_ocupacion_predicho*100), // 0..100
      }))
      setPred(adapted)
    })
}, [])
```

**Lo que devuelve el backend** (de `predicciones_aforo.csv`):
```json
[
  { "fecha": "2026-05-25", "dia": "Lunes", "slot": "09:00",
    "aforo_predicho": 3, "aforo_max": 50,
    "ratio_ocupacion_predicho": 0.06, "nivel_ocupacion": "bajo" },
  { "fecha": "2026-05-25", "dia": "Lunes", "slot": "12:30",
    "aforo_predicho": 25, "aforo_max": 50,
    "ratio_ocupacion_predicho": 0.50, "nivel_ocupacion": "bajo" }
]
```

### `student-app/screens/OptimizeScreen.tsx` (recomendación)

**Mañana**:
```ts
const reco = await fetch("/api/recommendations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    student_id: user.code,
    cursos: user.clases,    // ej. ["CS2023_2", "HH1011_5"]
    top_n: 3,
  }),
}).then(r => r.json())

// reco[0] = { dia, slot, aforo_predicho, nivel_ocupacion, ranking_recomendacion, razon_recomendacion }
```

---

## 6. Trampas de integración (importante)

| Tema | Backend devuelve | Frontend espera | Acción |
|---|---|---|---|
| Niveles | `bajo / medio / alto / critico` | `bajo / medio / alto` | Mapear `critico -> alto` o extender el tipo. |
| Hora | `"13:00"` (24h) | `"01:00 PM"` (12h) | Formatear en el adaptador del front. |
| Día | `"Miércoles"` (con tilde) | tiene tildes | Asegurar UTF-8 en headers. |
| Capacidad | `aforo_max=50` | hardcoded 50 | Pasar `aforo_max` al frontend para que sea config. |

---

## 7. Cómo verlo funcionando ahora

Sin backend todavía, ya podés probar el flujo completo:

```bash
# Genera todos los outputs (5–10s)
python -m src.run_pipeline

# Dashboard interactivo (lo abre en localhost:8501)
streamlit run dashboard/streamlit_app.py
```

En el dashboard tenés:
- **Pestaña Predicciones**: heatmap día×slot que es lo que vería `AdminDashboard`.
- **Pestaña Recomendador**: simulador del endpoint `POST /recommendations`.
- **Pestaña Pipeline**: las tablas SILVER y GOLD para inspección.

---

## 8. Estado actual y próximo paso

```
[✔] Capa ML completa (este branch feature/ml)
[✔] Outputs en data/processed/
[✔] Dashboard de inspección en streamlit
[ ] Backend FastAPI en app/api/             ← siguiente milestone (Mish)
[ ] Frontends llamando endpoints reales      ← siguiente milestone (Mish + Fátima)
[ ] CRON para reejecutar pipeline diario     ← cuando haya datos en producción
```

Para cerrar la integración, ver `docs/api_contract.md` (esquemas detallados
de cada endpoint y checklist de tareas).

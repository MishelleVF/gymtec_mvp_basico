# GYMTEC — Resumen ejecutivo de los modelos

Hoja de un vistazo: qué modelos hay, cómo se entrenan, dónde se exportan y
cómo los consume el backend.

---

## 1. Los dos modelos

| | **Modelo 1 — RF-01** | **Modelo 2 — RF-02** |
|---|---|---|
| **Qué predice** | Aforo del gimnasio por slot (personas) | Score 0–1 de cuán recomendable es un slot |
| **Tipo** | Regresión supervisada | Regresión supervisada |
| **Algoritmo** | RandomForestRegressor | Ridge (lineal regularizada) |
| **Otras opciones** | `linear`, `lightgbm` | (futuro: LightGBM) |
| **Target** | `aforo` (de `log_gym`) | `score_objetivo` sintético en [0,1] |
| **N° features** | 22 numéricas + 1 categórica | 8 numéricas + 1 categórica |
| **Train size** | 276 slots | 276 slots |
| **Test size** | 94 slots | 94 slots |
| **Métricas test** | MAE=2.63 · RMSE=3.59 · R²=0.890 | MAE=0.033 · R²=0.927 · NDCG@3=0.998 |
| **RF cubierto** | RF-01, RF-04, RF-06 | RF-02 |

**Por qué RandomForest y no LightGBM en RF-01**: dataset de 370 filas, sin
dependencias C++ extras, RF gana o empata sin tuning. Cuando lleguemos a
~3000 filas (ciclo académico completo) reemplazamos por LGB.

**Por qué Ridge en RF-02**: target sintético con relación lineal por
construcción, coeficientes interpretables para Bienestar Universitario.
Cuando exista feedback real (clicks, asistencias, ratings) reemplazamos
la etiqueta sintética sin tocar el resto del pipeline.

---

## 2. Dónde se entrenan

```
src/
├── models/
│   ├── train_model.py        ← Modelo 1 (RF-01: aforo)
│   ├── predict_model.py      ← genera predicciones_aforo a partir del Modelo 1
│   └── train_recommender.py  ← Modelo 2 (RF-02: score)
└── recommendation/
    └── recommend_schedule.py ← consume Modelo 1 + Modelo 2
```

Comandos individuales:

```bash
python -m src.models.train_model           # entrena RF-01
python -m src.models.predict_model         # corre RF-01 sobre la grilla
python -m src.models.train_recommender     # entrena RF-02
python -m src.recommendation.recommend_schedule  # genera top-3
```

Comando único end-to-end (lo que se usa en producción):

```bash
python -m src.run_pipeline
```

Ese orquestador hace los 6 pasos en orden:

```
1. clean_data       (BRONZE → SILVER)
2. build_features   (SILVER → GOLD: feature store)
3. train_model      (entrena Modelo 1)
4. predict_model    (genera predicciones_aforo)
5. train_recommender(entrena Modelo 2)
6. recommend_schedule (genera recomendaciones_horario)
```

---

## 3. Cómo se exportan

| Archivo | Generado por | Para qué sirve |
|---|---|---|
| `models_artifacts/rf01_aforo_baseline.pkl` | `train_model.train_baseline()` | Modelo 1 serializado (sklearn Pipeline completo, incluye preprocessor) |
| `models_artifacts/rf01_aforo_metrics.json` | idem | Métricas + feature importances |
| `models_artifacts/rf02_recomendador_score.pkl` | `train_recommender.train_recomendador()` | Modelo 2 serializado |
| `models_artifacts/rf02_recomendador_metrics.json` | idem | Métricas (MAE, RMSE, R², NDCG@3) + coeficientes |

Formato: **pickle** (vía `joblib.dump`, que es un wrapper sobre `pickle` con
mejor compresión). Cargar así:

```python
import joblib  # también funciona `import pickle`
modelo_aforo = joblib.load("models_artifacts/rf01_aforo_baseline.pkl")
modelo_score = joblib.load("models_artifacts/rf02_recomendador_score.pkl")

# Predecir
y_aforo = modelo_aforo.predict(X)        # X con las 23 columnas esperadas
y_score = modelo_score.predict(X_reco)   # X_reco con las 9 columnas esperadas
```

> Los `.pkl` están en `.gitignore` (son artefactos pesados que se
> regeneran corriendo el pipeline). El equipo solo versiona el código.

---

## 4. Outputs que el backend consume

Los modelos no se exponen al frontend directamente. El backend los aplica
y publica las **tablas resultantes** en `data/processed/`:

| Archivo | Quién lo lee | RF |
|---|---|---|
| `data/processed/predicciones_aforo.{parquet,csv}` | endpoints `/predictions/*`, `/low-occupancy` | RF-01, 04, 06 |
| `data/processed/recomendaciones_horario.{parquet,csv}` | endpoint `/recommendations` (batch) | RF-02 |
| `data/processed/aforo_por_slot.parquet` | endpoint `/occupancy/heatmap` | RF-03 (histórico) |
| `data/processed/features_aforo_rf01.parquet` | uso interno (reentrenar) | — |

---

## 5. Endpoints reales (`app/api/main.py`)

> El backend FastAPI está implementado en `app/api/main.py`. Levantarlo con:
> `uvicorn app.api.main:app --reload --port 8000`
> Docs interactivas: http://localhost:8000/docs

| Método | Ruta | Lee de | Pantalla front | Modelo usado |
|---|---|---|---|---|
| `GET` | `/health` | — | — | — |
| `GET` | `/predictions/today` | `predicciones_aforo.parquet` | `student-app/HomeScreen` | Modelo 1 (offline) |
| `GET` | `/predictions?dia=Lunes` | `predicciones_aforo.parquet` | `student-app/PredictionScreen` | Modelo 1 (offline) |
| `GET` | `/low-occupancy?dia=Lunes&top=5` | invoca `franjas_menor_aforo()` | `student-app/ResultsScreen` | Modelo 1 (offline) |
| `POST` | `/recommendations` | invoca `recomendar_para_estudiante()` | `student-app/OptimizeScreen` | Modelo 1 + Modelo 2 (en vivo) |
| `GET` | `/occupancy/heatmap` | `aforo_por_slot.parquet` | `admin-web/AdminDashboardScreen` | — (histórico real) |
| `GET` | `/occupancy/current` | `aforo_por_slot.parquet` (último slot) | `student-app/HomeScreen` | — (histórico real) |
| `GET` | `/admin/metrics` | derivado de `predicciones_aforo` | `admin-web/AdminDashboardScreen` | Modelo 1 (offline) |

**"Offline" vs "en vivo"**:
- Endpoints que sirven `predicciones_aforo` leen un archivo precalculado.
  Para refrescar, el cron corre `python -m src.run_pipeline`.
- `POST /recommendations` ejecuta el modelo en cada request porque cada
  estudiante tiene cursos distintos. Tarda <100 ms en local.

### Ejemplo de llamada

```bash
# Liveness
curl http://localhost:8000/health

# Top 3 horarios menos saturados el martes
curl "http://localhost:8000/low-occupancy?dia=Martes&top=3"

# Recomendación personalizada
curl -X POST http://localhost:8000/recommendations \
  -H "Content-Type: application/json" \
  -d '{"student_id":"20224D5F8","cursos":["CS2023_2","CS5393_1"],"top_n":3}'
```

---

## 6. Flujo de actualización (RF-07)

Cuando hay datos nuevos:

```bash
# 1. Reemplazar Excels en data/raw/
# 2. Reentrenar todo
python -m src.run_pipeline
# 3. Reiniciar el backend (los archivos parquet ya están actualizados)
```

Cron diario sugerido (Linux):
```cron
0 3 * * * cd /opt/gymtec && python -m src.run_pipeline >> logs/pipeline.log 2>&1
```

---

## 7. Cuándo retentenar vs cuándo regenerar

| Acción | Comando | Cuándo |
|---|---|---|
| Solo regenerar predicciones | `python -m src.models.predict_model` | Cambió la grilla operativa pero no los datos |
| Regenerar predicciones + recomendaciones | `python -m src.models.predict_model && python -m src.recommendation.recommend_schedule` | Mismo modelo, nuevo deploy |
| Reentrenar Modelo 1 | `python -m src.models.train_model` | Cambiaron las features o llegan datos de logs nuevos |
| Reentrenar Modelo 2 | `python -m src.models.train_recommender` | Cambió la fórmula del score o llega feedback real |
| Reentrenar todo + re-predecir | `python -m src.run_pipeline` | Caso default de actualización diaria |

---

## 8. Qué falta para producción

- [ ] Backend FastAPI en `app/api/` que sirva los 8 endpoints.
- [ ] `requirements.txt` agregar `fastapi` y `uvicorn`.
- [ ] Reemplazar mocks en `apps/student-app/services/gymtec-api.ts` y
      `apps/admin-web/services/admin-api.ts` por fetchs reales.
- [ ] Cron job o agent hook que corra el pipeline cada noche.
- [ ] Cuando exista feedback de usuario (asistencias confirmadas), reemplazar
      la etiqueta sintética del Modelo 2 por la real.
- [ ] Cuando haya >3000 filas, benchmark RF vs LightGBM en RF-01.

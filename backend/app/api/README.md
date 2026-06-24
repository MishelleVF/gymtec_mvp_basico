# GYMTEC API — Backend FastAPI

Sirve los outputs del pipeline ML (`feature/ml`) a las apps Next.js
(`apps/student-app` y `apps/admin-web`).

## Levantar el server

```bash
# 1. Generar tablas + modelos
python -m src.run_pipeline

# 2. Levantar la API
uvicorn app.api.main:app --reload --port 8000
```

Docs interactivas: http://localhost:8000/docs

## Endpoints

| Método | Ruta | Para qué | Modelo / Archivo |
|---|---|---|---|
| GET | `/health` | Liveness probe | — |
| GET | `/predictions/today` | Predicción del día actual (Home, Prediction) | `predicciones_aforo.parquet` |
| GET | `/predictions?dia=Lunes` | Predicción filtrada por día | `predicciones_aforo.parquet` |
| GET | `/low-occupancy?dia=Martes&top=5` | Mejores horarios por menor aforo (RF-04) | `predicciones_aforo.parquet` |
| POST | `/recommendations` | Top-N personalizado (RF-02, en vivo) | `rf02_recomendador_score.pkl` |
| GET | `/occupancy/heatmap` | Heatmap día × slot real (Admin) | `aforo_por_slot.parquet` |
| GET | `/occupancy/current` | Aforo del último slot | `aforo_por_slot.parquet` |
| GET | `/admin/metrics` | Métricas resumidas del día | `predicciones_aforo.parquet` |

## Ejemplo: recomendación personalizada

```bash
curl -X POST http://localhost:8000/recommendations \
  -H "Content-Type: application/json" \
  -d '{"student_id":"20224D5F8","cursos":["CS2023_2","CS5393_1"],"top_n":3}'
```

Respuesta:

```json
[
  {
    "student_id": "20224D5F8",
    "dia": "Martes",
    "slot": "09:00",
    "aforo_predicho": 2,
    "score_recomendacion": 0.831,
    "ranking_recomendacion": 1,
    "razon_recomendacion": "Horario recomendado porque..."
  }
]
```

## CORS

Habilitado para `http://localhost:3000` y `:3001` (Next.js dev). Para producción
ajustar `allow_origins` en `main.py`.

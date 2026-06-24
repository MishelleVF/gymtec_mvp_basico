# GYMTEC — Pipeline ML (branch `feature/ml`)

Documentación corta del trabajo entregado en la rama `feature/ml`.
Foco exclusivo: **datos → limpieza → features → modelo → predicción → recomendación**.
Sin componentes visuales nuevos: las apps ya consumen mocks y pasarán a leer
los CSV/parquet generados aquí.

## Datos usados

| Capa | Archivo | Origen |
|---|---|---|
| BRONZE | `data/raw/horarios_clases.xlsx` | Horarios académicos UTEC 2026-1 |
| BRONZE | `data/raw/log_gym.xlsx` | Logs de ingreso/salida del gimnasio |
| EDA | `notebooks/eda/01_horarios_clases_eda.ipynb` | Decisiones de limpieza DF2 |
| EDA | `notebooks/eda/02_log_gym_eda.ipynb` | Decisiones de limpieza DF1 |

> Los `.xlsx` quedan ignorados por `.gitignore` (carpeta `data/raw/*`); cada
> dev clona, copia los excels localmente y corre el pipeline.

## Cómo se limpian (`src/data/clean_data.py`, capa SILVER)

**Horarios** (`horarios_limpios.parquet`):
- Mapeo de los 2 primeros chars del `cod_curso` a `facultad` (CS→Computación, etc.).
- Parseo de la columna `Horario` ("Mar. 15:00 - 17:00") en `dia`, `hora_inicio`, `hora_fin`.
- Cálculo de `duracion_h`, flag `es_presencial`, `clase_id = cod_curso_seccion`.
- Descarte de filas sin día válido y `matriculados == 0`.

**Logs gym** (`logs_limpios.parquet`):
- Construcción de `timestamp = fecha + hora` y señal `+1/-1` por acción.
- Eliminación de pares ingreso/salida con duración `<16 min` (entradas
  fugaces, no representan uso real). Validado en EDA DF1.
- Cálculo de `ocupacion` acumulada **por día** (el gym se vacía cada noche).

## Qué features se generan (`src/features/build_features.py`, capa GOLD)

Tabla `horarios_expandido_slots`: cada clase explotada a una fila por
`(clase_id, dia, slot)` con paso de 30 min, deduplicado.

Tabla `aforo_por_slot`: serie temporal de aforo por `(fecha, dia, slot)`,
agregando con `max(ocupacion)` para conservar el pico real del bloque.
Incluye `ratio_ocupacion` y `nivel_ocupacion` (RF-06).

Tabla **principal** `features_aforo_rf01` (30 columnas):

| Bloque | Variables | Origen |
|---|---|---|
| Identificadores | `fecha, dia, dia_num, slot, hora_dec` | derivado |
| Target / niveles | `aforo, aforo_max, ratio_ocupacion, nivel_ocupacion` | log_gym |
| Lags y promedios históricos | `aforo_lag1, aforo_lag2, aforo_prom_hist, aforo_max_hist` | feature engineering |
| Cíclicas | `hora_sin, hora_cos, dia_sin, dia_cos, es_finde` | feature engineering |
| Día académico | `es_dia_academico` | horarios_clases |
| Académicas | `estudiantes_presencial, estudiantes_virtual, estudiantes_libres, ratio_libres, carga_academica, ratio_virtual` | horarios_clases |
| Cardinalidades | `n_secciones_activas, n_cursos_activos, n_facultades_activas, duracion_prom_clases` | horarios_clases |
| Modalidad | `modalidad_predominante` (`presencial / virtual / mixta / sin_clases`) | horarios_clases |

Origen de las variables:
- **De `log_gym`**: `aforo`, `ratio_ocupacion`, `nivel_ocupacion`, lags y promedios históricos.
- **De `horarios_clases`**: todas las variables académicas y de modalidad.
- **Transformadas**: `dia_num`, `hora_dec`, `slot`, `duracion_h`.
- **Feature engineering**: cíclicas (`*_sin`/`*_cos`), `ratio_libres`, `carga_academica`, `ratio_virtual`, `aforo_lag*`, `aforo_prom_hist`, `aforo_max_hist`, `es_dia_academico`, `modalidad_predominante`.

## Cómo se entrena el modelo (`src/models/train_model.py`)

- **Modelo 1 (RF-01)**: `RandomForestRegressor(n_estimators=200, min_samples_leaf=2)`.
  También soporta `LinearRegression` (`model_kind='linear'`) y `LightGBM`
  (`model_kind='lightgbm'`) para benchmarks.
- **Por qué RandomForest como default**: dataset chico (~370 filas) donde
  el error de varianza domina, sin dependencias extra (sklearn ya está),
  y razonable sin tuning. LightGBM tiene sentido cuando lleguemos a 1000+ filas.
- **Split temporal**: 80% de las primeras fechas a train, 20% últimas a test.
  Nada de mezclar pasado/futuro.
- **Métricas**: MAE, RMSE, R² persistidas en `models_artifacts/rf01_aforo_metrics.json`.
- **Run actual**: MAE=2.63, RMSE=3.59, R²=0.890 (n_train=276, n_test=94).

## Modelo 2 — Scoring de recomendación (`src/models/train_recommender.py`)

- **Tipo**: regresión `Ridge` con `StandardScaler + OneHotEncoder`.
- **Target**: score sintético en [0, 1] que combina `(1-ratio_ocupacion)`,
  `carga_academica`, preferencia horaria heurística, y `(1-es_finde)`.
  Cuando exista feedback real (clicks, asistencia, ratings), reemplazamos la
  etiqueta sin tocar el resto del pipeline.
- **Por qué Ridge**: target sintético con relación lineal por construcción,
  coeficientes interpretables, dataset chico. Se puede migrar a LightGBM
  cuando agreguemos features no-lineales (preferencias del estudiante).
- **Métricas**: MAE, RMSE, R² **y NDCG@3** (la métrica que importa porque
  el recomendador devuelve top-3 y lo crítico es el orden, no el valor).
- **Run actual**: MAE=0.033, R²=0.927, NDCG@3=0.998.

## Cómo se generan predicciones (`src/models/predict_model.py`)

- Para cada `(dia, slot)` operativo del gym (L-V 9-18, Sáb 8-13) se construye
  una fila usando los promedios históricos como input y se predice el aforo.
- Output `predicciones_aforo`:
  - `fecha, dia, dia_num, slot, hora_dec`
  - `aforo_predicho` (clipeado a `[0, AFORO_MAX]`)
  - `aforo_max, ratio_ocupacion_predicho, nivel_ocupacion`
  - `timestamp_generacion`
- Doble formato: `.parquet` (interno) y `.csv` (consumible por backend/front).

## Cómo se generan recomendaciones (`src/recommendation/recommend_schedule.py`)

Lógica T5 (`recomendar_para_estudiante`):
1. Tomar `predicciones_aforo`.
2. Construir disponibilidad del estudiante a partir de su lista de `clase_id`.
3. Filtrar slots libres.
4. Enriquecer con features académicas y puntuar con el **Modelo 2** (Ridge).
5. Ordenar por `score_recomendacion` descendente (rompe empate por hora).
6. Devolver top 3 con `razon_recomendacion` explicable.

Si el modelo 2 no está entrenado, cae a un **fallback heurístico**: ordena
por menor `aforo_predicho`. Útil en CI o cuando se borra `models_artifacts/`.

Output `recomendaciones_horario`:
`student_id, fecha, dia, slot, aforo_predicho, ratio_ocupacion_predicho,
nivel_ocupacion, score_recomendacion, ranking_recomendacion, razon_recomendacion`.

`franjas_menor_aforo(dia)` resuelve RF-04 directamente.

## Outputs que consume el backend

```
data/processed/predicciones_aforo.csv
data/processed/predicciones_aforo.parquet
data/processed/recomendaciones_horario.csv
data/processed/recomendaciones_horario.parquet
data/processed/aforo_por_slot.parquet           (RF-03 histórico)
data/processed/features_aforo_rf01.parquet      (feature store, opcional)
```

El frontend `apps/student-app/services/gymtec-api.ts` y
`apps/admin-web/services/admin-api.ts` deberían reemplazar sus mocks
leyendo estos CSV (vía `app/api/...` que aún está vacío).

## Trazabilidad RF ↔ Tareas ↔ Archivos

| RF | Tarea | Archivos clave |
|---|---|---|
| RF-01 | T1, T2 | `build_features.py`, `train_model.py`, `predict_model.py` |
| RF-02 | T4, T5 | `build_features.construir_disponibilidad_estudiante`, `recommend_schedule.py` |
| RF-03 | T1 | `aforo_por_slot.parquet`, `plot_results.heatmap_aforo_real` |
| RF-04 | T5 | `recommend_schedule.franjas_menor_aforo` |
| RF-06 | T2 | `helpers.clasificar_nivel`, columna `nivel_ocupacion` |
| RF-07 | T1 | `run_pipeline.main`, idempotente y reejecutable |

## Cómo correr el pipeline

```bash
# 1. Tener los excels en data/raw/
ls data/raw/  # log_gym.xlsx, horarios_clases.xlsx

# 2. Correr todo
python -m src.run_pipeline

# 3. Outputs en data/processed/ y models_artifacts/
```

O paso a paso:

```bash
python -m src.data.clean_data
python -m src.features.build_features
python -m src.models.train_model
python -m src.models.predict_model
python -m src.recommendation.recommend_schedule
```

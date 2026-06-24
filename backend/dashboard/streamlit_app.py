"""
Dashboard Streamlit — explorador de resultados del pipeline ML GYMTEC.

Sirve como interfaz visual para inspeccionar los outputs sin escribir código.
No reemplaza al frontend definitivo; es solo una herramienta interna para que
el equipo entienda lo que entrega `feature/ml`.

Uso:
    streamlit run dashboard/streamlit_app.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.recommendation.recommend_schedule import (  # noqa: E402
    franjas_menor_aforo,
    recomendar_para_estudiante,
)
from src.utils import paths  # noqa: E402

st.set_page_config(page_title="GYMTEC ML Results", layout="wide")

# -----------------------------------------------------------------------------
#  Carga de datos
# -----------------------------------------------------------------------------
@st.cache_data
def cargar_tablas() -> dict[str, pd.DataFrame]:
    return {
        "logs": pd.read_parquet(paths.LOGS_LIMPIOS_PARQUET),
        "horarios": pd.read_parquet(paths.HORARIOS_LIMPIOS_PARQUET),
        "horarios_slots": pd.read_parquet(paths.HORARIOS_SLOTS_PARQUET),
        "aforo": pd.read_parquet(paths.AFORO_POR_SLOT_PARQUET),
        "features": pd.read_parquet(paths.FEATURES_AFORO_PARQUET),
        "predicciones": pd.read_parquet(paths.PREDICCIONES_AFORO_PARQUET),
        "recomendaciones": pd.read_parquet(paths.RECOMENDACIONES_PARQUET),
    }


@st.cache_data
def cargar_metricas() -> dict:
    return json.loads(paths.MODEL_METRICS_JSON.read_text())


@st.cache_data
def cargar_metricas_reco() -> dict | None:
    if not paths.MODEL_RECO_METRICS_JSON.exists():
        return None
    return json.loads(paths.MODEL_RECO_METRICS_JSON.read_text())


if not paths.PREDICCIONES_AFORO_PARQUET.exists():
    st.error(
        "No encuentro las tablas GOLD. "
        "Corré primero `python -m src.run_pipeline` desde la raíz del repo."
    )
    st.stop()

tablas = cargar_tablas()
metrics = cargar_metricas()
metrics_reco = cargar_metricas_reco()

# -----------------------------------------------------------------------------
#  Header
# -----------------------------------------------------------------------------
st.title("GYMTEC — Resultados del pipeline ML")
st.caption(
    "Branch `feature/ml` · 2 modelos: predicción de aforo (RF-01) y "
    "scoring de recomendación (RF-02)"
)

st.markdown("**Modelo 1 — RF-01 (predicción de aforo, RandomForest)**")
c1, c2, c3, c4 = st.columns(4)
c1.metric("MAE", f"{metrics['mae']:.2f} pers.")
c2.metric("RMSE", f"{metrics['rmse']:.2f} pers.")
c3.metric("R²", f"{metrics['r2']:.3f}")
c4.metric("Train / Test", f"{metrics['n_train']} / {metrics['n_test']}")

if metrics_reco:
    st.markdown("**Modelo 2 — RF-02 (scoring de recomendación, Ridge)**")
    d1, d2, d3, d4 = st.columns(4)
    d1.metric("MAE", f"{metrics_reco['mae']:.4f}")
    d2.metric("R²", f"{metrics_reco['r2']:.3f}")
    d3.metric("NDCG@3", f"{metrics_reco['ndcg_at_3']:.3f}")
    d4.metric("Train / Test", f"{metrics_reco['n_train']} / {metrics_reco['n_test']}")

# -----------------------------------------------------------------------------
#  Tabs
# -----------------------------------------------------------------------------
tab_pipe, tab_pred, tab_reco, tab_feat, tab_modelo, tab_modelo2 = st.tabs(
    [
        "Pipeline",
        "Predicciones (RF-01/03/04/06)",
        "Recomendador (RF-02)",
        "Feature store",
        "Modelo 1 (aforo)",
        "Modelo 2 (recomendador)",
    ]
)

# ---- TAB PIPELINE -----------------------------------------------------------
with tab_pipe:
    st.subheader("Capas y archivos generados")
    st.markdown(
        """
| Capa | Archivo | Filas |
|---|---|---|
| BRONZE | `data/raw/horarios_clases.xlsx` | input |
| BRONZE | `data/raw/log_gym.xlsx` | input |
| SILVER | `data/interim/horarios_limpios.parquet` | %d |
| SILVER | `data/interim/logs_limpios.parquet` | %d |
| SILVER+ | `data/interim/horarios_expandido_slots.parquet` | %d |
| GOLD | `data/processed/aforo_por_slot.parquet` | %d |
| GOLD | `data/processed/features_aforo_rf01.parquet` | %d |
| GOLD | `data/processed/predicciones_aforo.parquet` | %d |
| GOLD | `data/processed/recomendaciones_horario.parquet` | %d |
        """
        % (
            len(tablas["horarios"]),
            len(tablas["logs"]),
            len(tablas["horarios_slots"]),
            len(tablas["aforo"]),
            len(tablas["features"]),
            len(tablas["predicciones"]),
            len(tablas["recomendaciones"]),
        )
    )
    st.markdown("### Vista rápida de la capa SILVER")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**logs_limpios** (eventos del gym)")
        st.dataframe(tablas["logs"].head(10), use_container_width=True)
    with col2:
        st.markdown("**horarios_limpios** (clases académicas)")
        st.dataframe(tablas["horarios"].head(10), use_container_width=True)

# ---- TAB PREDICCIONES -------------------------------------------------------
with tab_pred:
    st.subheader("Heatmap de aforo predicho (RF-01 / RF-03)")
    pred = tablas["predicciones"]
    orden = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    pivot = (
        pred.pivot_table(index="dia", columns="slot", values="aforo_predicho", aggfunc="first")
        .reindex([d for d in orden if d in pred["dia"].unique()])
        .fillna(0)
        .astype(int)
    )
    st.dataframe(pivot.style.background_gradient(cmap="YlOrRd", axis=None),
                 use_container_width=True)

    st.subheader("Distribución de niveles (RF-06)")
    vc = pred["nivel_ocupacion"].value_counts()
    st.bar_chart(vc)

    st.subheader("Top franjas con menor aforo (RF-04)")
    dia_sel = st.selectbox("Día", orden, index=1)
    top_n = st.slider("Cuántas franjas mostrar", 3, 10, 5)
    franjas = franjas_menor_aforo(dia_sel, top_n=top_n, predicciones=pred)
    st.dataframe(
        franjas[["slot", "aforo_predicho", "ratio_ocupacion_predicho", "nivel_ocupacion"]],
        use_container_width=True,
    )

    st.subheader("Tabla completa `predicciones_aforo`")
    st.dataframe(pred, use_container_width=True)
    st.download_button(
        "Descargar predicciones_aforo.csv",
        data=pred.to_csv(index=False).encode("utf-8"),
        file_name="predicciones_aforo.csv",
        mime="text/csv",
    )

# ---- TAB RECOMENDADOR -------------------------------------------------------
with tab_reco:
    st.subheader("Recomendador personalizado (RF-02)")
    st.markdown(
        "Selecciona los cursos en los que estás matriculado. El recomendador "
        "filtrará los slots en que estás libre y devolverá los 3 con menor "
        "aforo predicho."
    )

    clases_disponibles = sorted(tablas["horarios_slots"]["clase_id"].unique().tolist())
    seleccionadas = st.multiselect(
        "Tus clases (clase_id = cod_curso_seccion)",
        options=clases_disponibles,
        default=clases_disponibles[:5],
    )
    student_id = st.text_input("Código del estudiante", value="ESTUDIANTE_DEMO")
    top_n = st.slider("Top N recomendaciones", 1, 10, 3)

    if st.button("Generar recomendación"):
        recos = recomendar_para_estudiante(
            student_id=student_id,
            cursos_estudiante=seleccionadas,
            predicciones=tablas["predicciones"],
            horarios_slots=tablas["horarios_slots"],
            top_n=top_n,
        )
        if recos.empty:
            st.warning("No hay slots libres con esos cursos.")
        else:
            st.caption(
                "Orden por `score_recomendacion` del Modelo 2 (Ridge). "
                "Si el modelo no está entrenado, cae al heurístico (menor aforo)."
            )
            for _, r in recos.iterrows():
                with st.container(border=True):
                    st.markdown(
                        f"### #{int(r['ranking_recomendacion'])} · "
                        f"{r['dia']} {r['slot']}"
                    )
                    score_txt = (
                        f"score={r['score_recomendacion']:.3f}"
                        if pd.notna(r["score_recomendacion"]) else "(heurístico)"
                    )
                    st.write(
                        f"Aforo predicho: **{int(r['aforo_predicho'])}/50** "
                        f"({r['nivel_ocupacion']}) · {score_txt}"
                    )
                    st.caption(r["razon_recomendacion"])

    st.subheader("Recomendaciones demo persistidas")
    st.dataframe(tablas["recomendaciones"], use_container_width=True)

# ---- TAB FEATURE STORE ------------------------------------------------------
with tab_feat:
    st.subheader("`features_aforo_rf01` (tabla principal de features)")
    st.write(
        f"Shape: **{tablas['features'].shape[0]} filas × "
        f"{tablas['features'].shape[1]} columnas**"
    )
    st.dataframe(tablas["features"].head(50), use_container_width=True)

    st.subheader("Origen de cada variable")
    st.markdown(
        """
| Bloque | Columnas | Origen |
|---|---|---|
| Identificadores | `fecha, dia, dia_num, slot, hora_dec` | derivado |
| Target / niveles | `aforo, aforo_max, ratio_ocupacion, nivel_ocupacion` | log_gym |
| Lags | `aforo_lag1, aforo_lag2` | feature engineering |
| Históricos | `aforo_prom_hist, aforo_max_hist` | feature engineering |
| Cíclicas | `hora_sin, hora_cos, dia_sin, dia_cos, es_finde` | feature engineering |
| Académicas | `estudiantes_presencial, estudiantes_libres, ratio_libres, carga_academica, ratio_virtual` | horarios_clases |
| Cardinalidades | `n_secciones_activas, n_cursos_activos, n_facultades_activas, duracion_prom_clases` | horarios_clases |
| Modalidad | `modalidad_predominante` | horarios_clases |
        """
    )

# ---- TAB MODELO -------------------------------------------------------------
with tab_modelo:
    st.subheader("Modelo 1 — RF-01 · predicción de aforo")
    st.caption(
        "RandomForestRegressor entrenado sobre `features_aforo_rf01.parquet`. "
        "Predice el aforo absoluto (personas) por slot."
    )
    st.json(metrics)

    st.subheader("Top 15 features más importantes")
    imp = (
        pd.Series(metrics["feature_importances"])
        .sort_values(ascending=False)
        .head(15)
    )
    st.bar_chart(imp)


# ---- TAB MODELO 2 -----------------------------------------------------------
with tab_modelo2:
    st.subheader("Modelo 2 — RF-02 · scoring de recomendación")
    st.caption(
        "Ridge regression entrenado contra una etiqueta sintética en [0, 1] "
        "que combina aforo, carga académica, preferencia horaria y fin de "
        "semana. Cuando exista feedback real (clicks, asistencias, ratings), "
        "reemplazamos la etiqueta sintética sin tocar el resto del pipeline."
    )

    if metrics_reco is None:
        st.warning(
            "Aún no hay modelo entrenado. Corré `python -m src.run_pipeline`."
        )
    else:
        st.json(metrics_reco)

        st.subheader("Coeficientes (impacto de cada variable en el score)")
        coef = (
            pd.Series(metrics_reco["coef"])
            .sort_values(key=abs, ascending=False)
        )
        st.bar_chart(coef)

        st.markdown(
            """
**Cómo se usa**: el recomendador construye los slots libres del estudiante,
los enriquece con `features_aforo_rf01` y los puntúa con este modelo.
Los top-N por mayor `score_recomendacion` son la respuesta al usuario.
            """
        )

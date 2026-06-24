"""
Orquestador end-to-end del pipeline ML de GYMTEC (branch feature/ml).

Ejecuta secuencialmente:
  1. Limpieza (BRONZE -> SILVER)
       data/raw/log_gym.xlsx        -> data/interim/logs_limpios.parquet
       data/raw/horarios_clases.xlsx -> data/interim/horarios_limpios.parquet

  2. Feature engineering (SILVER -> GOLD)
       horarios_expandido_slots.parquet
       aforo_por_slot.parquet
       features_aforo_rf01.parquet

  3. Modelo 1 (RF-01): predicción de aforo
       models_artifacts/rf01_aforo_baseline.joblib
       models_artifacts/rf01_aforo_metrics.json

  4. Predicciones GOLD
       data/processed/predicciones_aforo.parquet (+ csv)

  5. Modelo 2 (RF-02): scoring de recomendación
       models_artifacts/rf02_recomendador_score.joblib
       models_artifacts/rf02_recomendador_metrics.json

  6. Recomendaciones (RF-02 demo)
       data/processed/recomendaciones_horario.parquet (+ csv)

Uso:
    python -m src.run_pipeline
"""
from __future__ import annotations

import logging

from src.data.clean_data import clean_horarios, clean_logs_gym
from src.features.build_features import (
    construir_aforo_por_slot,
    construir_features_aforo_rf01,
    expandir_horarios_a_slots,
)
from src.models.predict_model import generar_predicciones
from src.models.train_model import train_baseline
from src.models.train_recommender import train_recomendador
from src.recommendation.recommend_schedule import generar_recomendaciones


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    log = logging.getLogger("gymtec.pipeline")

    log.info("[1/6] Limpieza SILVER")
    clean_horarios()
    clean_logs_gym()

    log.info("[2/6] Feature engineering GOLD")
    expandir_horarios_a_slots()
    construir_aforo_por_slot()
    construir_features_aforo_rf01()

    log.info("[3/6] Modelo 1 (RF-01): predicción de aforo")
    metrics_aforo = train_baseline()
    log.info(
        "RF-01 | MAE=%.2f RMSE=%.2f R2=%.3f",
        metrics_aforo.mae, metrics_aforo.rmse, metrics_aforo.r2,
    )

    log.info("[4/6] Generación de predicciones de aforo")
    generar_predicciones()

    log.info("[5/6] Modelo 2 (RF-02): scoring de recomendación")
    metrics_reco = train_recomendador()
    log.info(
        "RF-02 | MAE=%.4f R2=%.3f NDCG@3=%.3f",
        metrics_reco.mae, metrics_reco.r2, metrics_reco.ndcg_at_3,
    )

    log.info("[6/6] Recomendaciones demo (RF-02)")
    generar_recomendaciones()

    log.info("Pipeline finalizado.")


if __name__ == "__main__":
    main()

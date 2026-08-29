"""
Data Insights Module
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from ..data_analyzers import (
    identify_numeric_columns,
    identify_categorical_columns,
    identify_petroleum_metrics,
)

logger = logging.getLogger(__name__)

def _generate_data_insights(data: pd.DataFrame, question: str) -> List[str]:
        """Generate insights about the data for visualization"""
        insights = []

        try:
            if data.empty:
                return ["No hay datos disponibles para generar visualizaciones"]

            # Data shape insights
            rows, cols = data.shape
            insights.append(f"Dataset con {rows:,} registros y {cols} columnas")

            # Numeric data insights
            numeric_cols = identify_numeric_columns(data)
            if numeric_cols:
                insights.append(
                    f"Variables numéricas disponibles: {', '.join(numeric_cols[:3])}"
                )

                # Range insights for first numeric column
                if len(numeric_cols) > 0:
                    col = numeric_cols[0]
                    min_val = data[col].min()
                    max_val = data[col].max()
                    insights.append(f"Rango de {col}: {min_val:.2f} - {max_val:.2f}")

            # Categorical insights
            categorical_cols = identify_categorical_columns(data)
            if categorical_cols:
                insights.append(
                    f"Variables categóricas: {', '.join(categorical_cols[:2])}"
                )

            # Petroleum-specific insights
            petroleum_metrics = identify_petroleum_metrics(data)
            if petroleum_metrics:
                insights.append(
                    f"Métricas petroleras identificadas: {', '.join(petroleum_metrics)}"
                )

        except Exception as e:
            logger.error(f"Error generating data insights: {e}")
            insights.append("Error analizando datos para visualización")

        return insights



def _check_data_graphability(data: pd.DataFrame) -> Dict[str, Any]:
        """Check if data is suitable for graphing and provide feedback"""
        if data.empty:
            return {
                "is_graphable": False,
                "reason": "No hay datos disponibles para graficar",
                "suggestions": [
                    "Intenta reformular tu consulta",
                    "Verifica los filtros aplicados",
                ],
            }

        rows, cols = data.shape

        if rows < 2:
            return {
                "is_graphable": False,
                "reason": "Datos insuficientes para crear gráficos (menos de 2 registros)",
                "suggestions": [
                    "Amplía el rango de fechas",
                    "Reduce los filtros aplicados",
                ],
            }

        numeric_cols = identify_numeric_columns(data)
        if len(numeric_cols) == 0:
            return {
                "is_graphable": False,
                "reason": "No se encontraron métricas numéricas para graficar",
                "suggestions": [
                    "Solicita métricas específicas como producción, volúmenes, o ratios"
                ],
            }

        petroleum_metrics = identify_petroleum_metrics(data)
        if len(petroleum_metrics) == 0:
            return {
                "is_graphable": True,
                "quality": "limited",
                "reason": "Datos graficables pero sin métricas petroleras específicas identificadas",
                "suggestions": [
                    "Los gráficos serán genéricos",
                    "Para mejores visualizaciones, incluye métricas como producción, GOR, WOR",
                ],
            }

        return {
            "is_graphable": True,
            "quality": "good",
            "reason": f"Datos aptos para {len(petroleum_metrics)} tipos de gráficos petroleros",
            "metrics_found": petroleum_metrics,
            "suggestions": [],
        }




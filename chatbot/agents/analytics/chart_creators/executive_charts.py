"""
Executive Charts Module
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from ..data_analyzers import (
    identify_numeric_columns,
    identify_categorical_columns,
)
from .bar_charts import _create_bar_chart_config, _create_grouped_bar_chart_config
from .line_charts import _create_line_chart_config

logger = logging.getLogger(__name__)

def _create_executive_chart_config(
        data: pd.DataFrame, config: Dict, chart_type: str
    ) -> Dict:
        """Create executive-level chart configurations with intelligent fallbacks"""
        try:
            # Get enhanced title and context
            enhanced_title = config.get(
                "title", f"Análisis Ejecutivo - {chart_type.replace('_', ' ').title()}"
            )

            # Intelligent fallback mapping based on executive chart type
            if chart_type == "benchmark":
                # Benchmark analysis - use bar chart for comparisons
                fallback_config = config.copy()
                fallback_config["title"] = f"📊 Benchmark Ejecutivo: {enhanced_title}"
                return _create_bar_chart_config(data, fallback_config)

            elif chart_type == "gap_analysis":
                # Gap analysis - use grouped bar or multi-line for comparisons
                categorical_cols = identify_categorical_columns(data)
                numeric_cols = identify_numeric_columns(data)

                if len(numeric_cols) >= 2:
                    # Multiple metrics - use grouped bar
                    fallback_config = {
                        "x_axis": (
                            categorical_cols[0] if categorical_cols else data.columns[0]
                        ),
                        "y_axis": numeric_cols[:2],  # Use first two numeric columns
                        "title": f"📈 Análisis de Brechas: {enhanced_title}",
                        "x_title": config.get("x_title"),
                        "y_title": "Métricas Comparativas",
                    }
                    return _create_grouped_bar_chart_config(data, fallback_config)
                else:
                    # Single metric - use bar chart
                    fallback_config = config.copy()
                    fallback_config["title"] = (
                        f"📈 Análisis de Brechas: {enhanced_title}"
                    )
                    return _create_bar_chart_config(data, fallback_config)

            elif chart_type == "growth_analysis":
                # Growth analysis - prefer line chart for trends
                temporal_cols = [
                    col
                    for col in data.columns
                    if any(
                        time_word in col.lower()
                        for time_word in [
                            "año",
                            "year",
                            "fecha",
                            "date",
                            "mes",
                            "month",
                        ]
                    )
                ]
                numeric_cols = identify_numeric_columns(data)

                if temporal_cols and numeric_cols:
                    # Time series data - use line chart
                    fallback_config = {
                        "x_axis": temporal_cols[0],
                        "y_axis": numeric_cols[0],
                        "title": f"📊 Análisis de Crecimiento: {enhanced_title}",
                        "x_title": config.get("x_title"),
                        "y_title": config.get("y_title"),
                    }
                    return _create_line_chart_config(data, fallback_config)
                else:
                    # No temporal data - use bar chart
                    fallback_config = config.copy()
                    fallback_config["title"] = (
                        f"📊 Análisis de Crecimiento: {enhanced_title}"
                    )
                    return _create_bar_chart_config(data, fallback_config)

            elif chart_type == "efficiency_analysis":
                # Efficiency analysis - use appropriate chart based on data structure
                ratio_cols = [
                    col
                    for col in data.columns
                    if any(
                        ratio_word in col.lower()
                        for ratio_word in [
                            "ratio",
                            "pct",
                            "percent",
                            "eficiencia",
                            "productividad",
                        ]
                    )
                ]

                if ratio_cols:
                    # Ratio/efficiency data - use bar chart
                    categorical_cols = identify_categorical_columns(data)
                    fallback_config = {
                        "x_axis": (
                            categorical_cols[0] if categorical_cols else data.columns[0]
                        ),
                        "y_axis": ratio_cols[0],
                        "title": f"⚡ Análisis de Eficiencia: {enhanced_title}",
                        "x_title": config.get("x_title"),
                        "y_title": "Indicadores de Eficiencia",
                    }
                    return _create_bar_chart_config(data, fallback_config)
                else:
                    # Standard efficiency analysis - use bar chart
                    fallback_config = config.copy()
                    fallback_config["title"] = (
                        f"⚡ Análisis de Eficiencia: {enhanced_title}"
                    )
                    return _create_bar_chart_config(data, fallback_config)

            # Default fallback for unknown executive chart types
            logger.warning(
                f"Unknown executive chart type '{chart_type}', using bar chart fallback"
            )
            fallback_config = config.copy()
            fallback_config["title"] = f"📊 Análisis Ejecutivo: {enhanced_title}"
            return _create_bar_chart_config(data, fallback_config)

        except Exception as e:
            logger.error(f"Error creating executive chart config for {chart_type}: {e}")
            # Final fallback to simple bar chart
            return _create_bar_chart_config(data, config)



def _create_dashboard_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create dashboard-style bar chart configuration"""
        columns = config.get("columns", [])
        if not columns:
            # Use first 4 numeric columns
            numeric_cols = identify_numeric_columns(data)
            columns = numeric_cols[:4]

        if not columns:
            # Fallback to regular bar chart
            return _create_bar_chart_config(data, config)

        # Use first column as x-axis, sum others as metrics
        x_col = data.columns[0]  # First column (usually categorical)
        y_col = columns[0]  # First numeric column

        config_updated = {
            "x_axis": x_col,
            "y_axis": y_col,
            "x_title": "Categoría",
            "y_title": "Valor Principal",
        }

        return _create_bar_chart_config(data, config_updated)




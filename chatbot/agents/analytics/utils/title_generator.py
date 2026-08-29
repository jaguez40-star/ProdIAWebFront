"""
Intelligent chart title generation
Generates context-aware titles based on data characteristics and chart type
"""

import logging
from typing import Dict, List
import pandas as pd

from .translations import translate_column_name

logger = logging.getLogger(__name__)


def generate_intelligent_chart_title(
    chart_type: str,
    data: pd.DataFrame,
    config: Dict,
    identify_date_columns_func,
    identify_numeric_columns_func,
    identify_categorical_columns_func,
    context: Dict = None
) -> str:
    """
    Generate intelligent chart titles based on data characteristics
    - Avoids using "Tendencia" unless there's actual regression analysis
    - Uses specific temporal language (diario/mensual/anual)
    - Includes date ranges when relevant
    - Personalizes based on petroleum metrics

    Args:
        chart_type: Type of chart (line, bar, pie, etc)
        data: DataFrame being visualized
        config: Chart configuration dictionary
        identify_date_columns_func: Function to identify date columns
        identify_numeric_columns_func: Function to identify numeric columns
        identify_categorical_columns_func: Function to identify categorical columns
        context: Optional context dictionary

    Returns:
        Intelligent chart title string
    """
    try:
        # Check if title is already provided in config
        if config.get('title') and config['title'] not in ['undefined', 'Gráfico', 'Chart']:
            return config['title']

        # Detect temporal scope and date range
        date_cols = identify_date_columns_func(data)
        date_cols_set = set(date_cols) if date_cols else set()
        temporal_scope = "temporal"
        date_range_str = ""

        if date_cols and len(date_cols) > 0:
            date_col = date_cols[0]
            try:
                col_lower = date_col.lower()
                # For integer year/month columns (AÑO, MES), don't use pd.to_datetime
                if col_lower in ("año", "ano", "year", "mes", "month"):
                    col_values = data[date_col].dropna()
                    if not col_values.empty:
                        min_val = int(col_values.min())
                        max_val = int(col_values.max())
                        # Check if we have a MES-like column for granularity
                        has_mes = any(
                            c.lower() in ("mes", "month") for c in date_cols
                        )
                        has_año = any(
                            "año" in c.lower() or c.lower() == "year" for c in date_cols
                        )
                        if has_mes and has_año:
                            temporal_scope = "mensual"
                        elif has_mes:
                            temporal_scope = "mensual"
                        elif has_año:
                            temporal_scope = "anual"
                        # Build a readable date range from the actual values
                        if col_lower in ("año", "ano", "year"):
                            if min_val == max_val:
                                date_range_str = f" ({min_val})"
                            else:
                                date_range_str = f" ({min_val} a {max_val})"
                        # For MES columns, show month range with year context
                        elif col_lower in ("mes", "month"):
                            año_col = next(
                                (c for c in date_cols if "año" in c.lower() or c.lower() == "year"),
                                None,
                            )
                            if año_col:
                                año_val = int(data[año_col].dropna().iloc[0])
                                date_range_str = f" (Mes {min_val}-{max_val}, {año_val})"
                            else:
                                date_range_str = f" (Mes {min_val} a {max_val})"
                else:
                    # Standard datetime columns
                    min_date = pd.to_datetime(data[date_col]).min()
                    max_date = pd.to_datetime(data[date_col]).max()
                    date_range_str = f" ({min_date.strftime('%Y-%m-%d')} a {max_date.strftime('%Y-%m-%d')})"

                    # Determine temporal granularity
                    date_diff = (max_date - min_date).days
                    if date_diff <= 31:
                        temporal_scope = "diario"
                    elif date_diff <= 365:
                        temporal_scope = "mensual"
                    else:
                        temporal_scope = "anual"
            except Exception:
                pass

        # Identify main metrics - EXCLUDE date columns (AÑO, MES)
        numeric_cols = identify_numeric_columns_func(data)
        numeric_cols_filtered = [c for c in numeric_cols if c not in date_cols_set]
        categorical_cols = identify_categorical_columns_func(data)

        # Get metric names in Spanish (use filtered numeric cols, not raw)
        metric_names = [translate_column_name(col) for col in numeric_cols_filtered[:2]]
        category_name = translate_column_name(categorical_cols[0]) if categorical_cols else "Categoría"

        # Generate title based on chart type
        if chart_type in ['line', 'multi_line', 'area']:
            # For time series charts
            if len(metric_names) > 1:
                title = f"Evolución {temporal_scope.title()} de {metric_names[0]} y {metric_names[1]}{date_range_str}"
            elif metric_names:
                title = f"Producción de {metric_names[0]} en el Tiempo{date_range_str}"
            else:
                title = f"Evolución {temporal_scope.title()}{date_range_str}"

            # Only add "con Tendencia" if there's actual regression
            has_regression = config.get('show_regression', False) or config.get('trendline', False)
            if has_regression:
                title += " (con Línea de Tendencia)"

        elif chart_type in ['bar', 'grouped_bar']:
            # For comparison charts
            if metric_names and category_name:
                title = f"{metric_names[0]} por {category_name}"
            elif metric_names:
                title = f"Comparación de {metric_names[0]}"
            else:
                title = "Comparación por Categoría"

        elif chart_type == 'ranking_bar':
            # For ranking charts
            if metric_names:
                title = f"Ranking - Top {min(len(data), 10)} por {metric_names[0]}"
            else:
                title = f"Ranking - Top {min(len(data), 10)}"

        elif chart_type == 'histogram':
            # For distribution charts
            if metric_names:
                title = f"Distribución de {metric_names[0]}"
            else:
                title = "Distribución de Valores"

        elif chart_type == 'scatter':
            # For correlation charts
            if len(metric_names) >= 2:
                title = f"Correlación entre {metric_names[0]} y {metric_names[1]}"
            else:
                title = "Análisis de Correlación"

        elif chart_type == 'pie':
            # For composition charts
            if metric_names and category_name:
                title = f"Distribución de {metric_names[0]} por {category_name}"
            else:
                title = "Distribución Porcentual"

        elif chart_type == 'heatmap':
            title = "Matriz de Correlación entre Variables"

        else:
            # Generic fallback
            if metric_names:
                title = f"Análisis de {metric_names[0]}"
            else:
                title = "Análisis de Datos"

        # Ensure title is not too long
        if len(title) > 80:
            title = title[:77] + "..."

        logger.info(f"Generated intelligent chart title: '{title}' for chart type: {chart_type}")
        return title

    except Exception as e:
        logger.error(f"Error generating intelligent chart title: {e}")
        # Fallback to basic title
        return f"Gráfico de {chart_type.replace('_', ' ').title()}"

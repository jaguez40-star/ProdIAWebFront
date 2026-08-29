"""
Dynamic Buttons Module
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from ..utils import translate_column_name
from ..data_analyzers import (
    identify_numeric_columns,
    identify_categorical_columns,
    identify_date_columns,
    identify_petroleum_metrics,
    detect_available_years,
    detect_query_type,
    analyze_executive_intent,
)
from .executive_buttons import (
    _generate_market_share_buttons,
    _generate_growth_analysis_buttons,
    _generate_performance_buttons,
    _generate_operational_buttons,
)

logger = logging.getLogger(__name__)

def _generate_dynamic_buttons(
        data: pd.DataFrame, question: str, context: Dict
    ) -> List[Dict[str, Any]]:
        """Generate intelligent executive-level dynamic buttons based on query analysis"""
        buttons = []
        query_type = detect_query_type(question, data)
        logger.info(f"🎯 Generating executive buttons for query type: {query_type}")

        # Executive context analysis
        executive_context = analyze_executive_intent(question, data, query_type)
        # Add original question to executive context for SQL generation
        executive_context["original_question"] = question
        logger.info(f"📊 Executive context: {executive_context['intent_type']}")

        numeric_cols = identify_numeric_columns(data)
        categorical_cols = identify_categorical_columns(data)
        date_cols = identify_date_columns(data)
        petroleum_metrics = identify_petroleum_metrics(data)

        # Base button structure with enhanced titles
        def create_button(
            title: str,
            description: str,
            chart_type: str,
            config: Dict,
            priority: float = 1.0,
            columns: List[str] = [],
        ):
            # Translate column names in title and description
            if columns:
                translated_cols = [translate_column_name(col) for col in columns]
                # Replace column names in title with translated versions
                for i, col in enumerate(columns):
                    if i < len(translated_cols):
                        title = title.replace(col, translated_cols[i])
                        description = description.replace(col, translated_cols[i])

            return {
                "id": f"btn_{chart_type}_{int(pd.Timestamp.now().timestamp())}",
                "title": title,
                "description": description,
                "chart_type": chart_type,
                "config": config,
                "priority": priority,
                "css_class": "btn btn-outline-primary btn-sm chart-button",
            }

        # Generate executive-focused buttons based on intent analysis
        if executive_context["intent_type"] == "market_share":
            buttons.extend(
                _generate_market_share_buttons(
                    data, executive_context, create_button
                )
            )
        elif executive_context["intent_type"] == "growth_analysis":
            buttons.extend(
                _generate_growth_analysis_buttons(
                    data, executive_context, create_button
                )
            )
        elif executive_context["intent_type"] == "performance_ranking":
            buttons.extend(
                _generate_performance_buttons(
                    data, executive_context, create_button
                )
            )
        elif executive_context["intent_type"] == "operational_kpis":
            buttons.extend(
                _generate_operational_buttons(
                    data, executive_context, create_button
                )
            )
        else:
            # Fallback to original logic for backward compatibility
            buttons.extend(
                _generate_fallback_buttons(data, query_type, create_button)
            )

        # Generate buttons based on original query type for additional options
        if query_type == "temporal" and date_cols and numeric_cols:
            # Time series visualizations
            for metric in petroleum_metrics[:2]:  # Limit to 2 main metrics
                metric_title = translate_column_name(metric)
                buttons.append(
                    create_button(
                        f"Evolución de {metric_title}",
                        f"Gráfico de líneas mostrando evolución de {metric_title} en el tiempo",
                        "line",
                        {
                            "x_axis": date_cols[0],
                            "y_axis": [metric],
                            "chart_type": "line",
                        },
                        1.0,
                        [metric],
                    )
                )

            if len(petroleum_metrics) >= 2:
                buttons.append(
                    create_button(
                        "Comparación Temporal",
                        f"Comparar múltiples métricas en el tiempo",
                        "multi_line",
                        {
                            "x_axis": date_cols[0],
                            "y_axis": petroleum_metrics[:3],
                            "chart_type": "multi_line",
                        },
                        0.9,
                    )
                )

            # Add year filter buttons if multiple years are detected
            available_years = detect_available_years(data)
            if len(available_years) > 1:
                # Add individual year filter buttons
                for year in available_years[-3:]:  # Last 3 years
                    if petroleum_metrics:
                        metric = petroleum_metrics[0]
                        metric_title = translate_column_name(metric)
                        buttons.append(
                            create_button(
                                f"{metric_title} - Año {year}",
                                f"Ver evolución de {metric_title} solo para el año {year}",
                                "line",
                                {
                                    "x_axis": date_cols[0],
                                    "y_axis": [metric],
                                    "chart_type": "line",
                                    "filter_year": year,
                                },
                                0.7,
                                [metric],
                            )
                        )

                # Add year comparison button (bar chart)
                if petroleum_metrics:
                    metric = petroleum_metrics[0]
                    metric_title = translate_column_name(metric)
                    buttons.append(
                        create_button(
                            f"Variación Anual - {metric_title}",
                            f"Gráfico de barras comparando {metric_title} por año",
                            "bar",
                            {
                                "x_axis": "AÑO",  # This will be the year column
                                "y_axis": metric,
                                "chart_type": "bar",
                                "aggregate_by_year": True,
                            },
                            0.8,
                            [metric],
                        )
                    )

        elif query_type == "comparison" and categorical_cols and numeric_cols:
            # Comparison visualizations
            cat_col = categorical_cols[0]
            # Pick the right numeric column - prioritize participation metrics first
            num_col = None

            # First priority: participation columns
            participation_cols = [
                col
                for col in numeric_cols
                if "participacion" in col.lower()
                or "pct" in col.lower()
                or "porcentaje" in col.lower()
            ]
            if participation_cols:
                num_col = participation_cols[0]
            else:
                # Second priority: petroleum metrics
                for metric in petroleum_metrics:
                    if metric in numeric_cols:
                        num_col = metric
                        break
                # Third priority: any numeric column
                if not num_col:
                    num_col = numeric_cols[0]

            # Translate column names for button
            num_col_title = translate_column_name(num_col)
            cat_col_title = translate_column_name(cat_col)

            buttons.append(
                create_button(
                    f"{num_col_title} por {cat_col_title}",
                    f"Gráfico de barras comparando {num_col_title} entre {cat_col_title}",
                    "bar",
                    {
                        "x_axis": cat_col,
                        "y_axis": num_col,
                        "chart_type": "bar",
                        "x_title": cat_col_title,
                        "y_title": num_col_title,
                    },
                    1.0,
                    [num_col, cat_col],
                )
            )

            # Add pie chart for participation data
            if participation_cols:
                buttons.append(
                    create_button(
                        f"Distribución {num_col_title}",
                        f"Gráfico de pastel mostrando distribución de {num_col_title}",
                        "pie",
                        {
                            "x_axis": cat_col,
                            "y_axis": num_col,
                            "chart_type": "pie",
                            "x_title": cat_col_title,
                            "y_title": num_col_title,
                        },
                        0.9,
                        [num_col, cat_col],
                    )
                )

            if len(numeric_cols) >= 2:
                buttons.append(
                    create_button(
                        "Comparación Multiple",
                        f"Comparar múltiples métricas por {cat_col}",
                        "grouped_bar",
                        {
                            "x_axis": cat_col,
                            "y_axis": numeric_cols[:3],
                            "chart_type": "grouped_bar",
                        },
                        0.8,
                    )
                )

        elif query_type == "distribution" and petroleum_metrics:
            # Distribution analysis
            for metric in petroleum_metrics[:2]:
                metric_title = translate_column_name(metric)
                buttons.append(
                    create_button(
                        f"Distribución {metric_title}",
                        f"Histograma mostrando distribución de valores de {metric_title}",
                        "histogram",
                        {"column": metric, "chart_type": "histogram"},
                        0.9,
                        [metric],
                    )
                )

            if len(petroleum_metrics) >= 2:
                buttons.append(
                    create_button(
                        "Box Plot Comparativo",
                        "Comparar distribuciones de métricas principales",
                        "box_plot",
                        {"columns": petroleum_metrics[:3], "chart_type": "box_plot"},
                        0.7,
                    )
                )

        elif query_type == "correlation" and len(petroleum_metrics) >= 2:
            # Correlation analysis
            metric1, metric2 = petroleum_metrics[0], petroleum_metrics[1]
            metric1_title = translate_column_name(metric1)
            metric2_title = translate_column_name(metric2)

            buttons.append(
                create_button(
                    f"{metric1_title} vs {metric2_title}",
                    f"Scatter plot mostrando correlación entre {metric1_title} y {metric2_title}",
                    "scatter",
                    {"x_axis": metric1, "y_axis": metric2, "chart_type": "scatter"},
                    1.0,
                    [metric1, metric2],
                )
            )

            if len(petroleum_metrics) >= 3:
                buttons.append(
                    create_button(
                        "Matriz de Correlación",
                        "Heatmap mostrando correlaciones entre todas las métricas",
                        "heatmap",
                        {
                            "columns": petroleum_metrics,
                            "chart_type": "correlation_heatmap",
                        },
                        0.8,
                    )
                )

        elif query_type == "production_analysis":
            # Production-specific analysis
            if "oil_volume" in [col.lower() for col in data.columns] and date_cols:
                buttons.append(
                    create_button(
                        "Producción de Aceite",
                        "Gráfico de área mostrando producción de aceite en el tiempo",
                        "area",
                        {
                            "x_axis": date_cols[0],
                            "y_axis": "oil_volume",
                            "chart_type": "area",
                        },
                        1.0,
                    )
                )

            if petroleum_metrics and categorical_cols:
                buttons.append(
                    create_button(
                        "Rendimiento por Campo",
                        "Comparar rendimiento de producción entre diferentes campos",
                        "bar",
                        {
                            "x_axis": categorical_cols[0],
                            "y_axis": petroleum_metrics[0],
                            "chart_type": "bar",
                        },
                        0.9,
                    )
                )

        # Fallback for general queries with valid data
        if query_type == "general" and len(buttons) == 0:
            if categorical_cols and numeric_cols:
                # Add basic comparison chart
                buttons.append(
                    create_button(
                        f"{numeric_cols[0]} por {categorical_cols[0]}",
                        f"Gráfico de barras mostrando {numeric_cols[0]} por {categorical_cols[0]}",
                        "bar",
                        {
                            "x_axis": categorical_cols[0],
                            "y_axis": numeric_cols[0],
                            "chart_type": "bar",
                        },
                        0.8,
                    )
                )

            if len(numeric_cols) >= 1:
                # Add distribution chart
                buttons.append(
                    create_button(
                        f"Distribución de {numeric_cols[0]}",
                        f"Histograma de distribución de {numeric_cols[0]}",
                        "histogram",
                        {"column": numeric_cols[0], "chart_type": "histogram"},
                        0.7,
                    )
                )

        # Always add a general overview if we have enough data
        if len(numeric_cols) >= 2 and len(data) > 5:
            buttons.append(
                create_button(
                    "Vista General",
                    "Dashboard con múltiples métricas principales",
                    "dashboard",
                    {"columns": numeric_cols[:4], "chart_type": "dashboard"},
                    0.6,
                )
            )

        # Deduplicate buttons by title and chart_type
        seen_combinations = set()
        unique_buttons = []

        for button in buttons:
            combo = (button["title"], button["chart_type"])
            if combo not in seen_combinations:
                seen_combinations.add(combo)
                unique_buttons.append(button)
            else:
                logger.debug(
                    f"🔄 Removing duplicate button: {button['title']} ({button['chart_type']})"
                )

        logger.info(
            f"🔘 Removed {len(buttons) - len(unique_buttons)} duplicate buttons"
        )

        # Sort by priority and limit to 4 buttons max
        unique_buttons.sort(key=lambda x: x["priority"], reverse=True)
        final_buttons = unique_buttons[:4]
        logger.info(f"🔘 Final button count: {len(final_buttons)}")
        for i, btn in enumerate(final_buttons):
            logger.info(f"   Button {i+1}: {btn['title']} ({btn['chart_type']})")
        return final_buttons



def _generate_fallback_buttons(
        data: pd.DataFrame, query_type: str, create_button
    ) -> List[Dict]:
        """Generate fallback buttons for general queries"""
        buttons = []
        numeric_cols = identify_numeric_columns(data)
        categorical_cols = identify_categorical_columns(data)

        if categorical_cols and numeric_cols:
            buttons.append(
                create_button(
                    f"Análisis General",
                    f"Visualización general de {numeric_cols[0]} por {categorical_cols[0]}",
                    "bar",
                    {"x_axis": categorical_cols[0], "y_axis": numeric_cols[0]},
                    0.7,
                    [numeric_cols[0], categorical_cols[0]],
                )
            )

        return buttons




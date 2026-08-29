"""
Executive Buttons Module
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
    select_temporal_x_axis,
    get_non_date_numeric_cols,
)
from .sql_followups import _generate_sql_followups_with_rules

logger = logging.getLogger(__name__)

def _generate_market_share_buttons(
        data: pd.DataFrame, executive_context: Dict, create_button
    ) -> List[Dict]:
        """Generate executive buttons for market share analysis"""
        buttons = []
        categorical_cols = identify_categorical_columns(data)

        # Find participation columns
        participation_cols = [
            col
            for col in data.columns
            if any(x in col.lower() for x in ["participacion", "pct", "porcentaje"])
        ]
        main_category = categorical_cols[0] if categorical_cols else None
        main_metric = participation_cols[0] if participation_cols else None

        if main_category and main_metric:
            cat_title = translate_column_name(main_category)
            metric_title = translate_column_name(main_metric)

            # 1. Executive Ranking Bar Chart
            buttons.append(
                create_button(
                    f"Ranking Ejecutivo: {metric_title}",
                    f"Ranking estratégico de {cat_title} por {metric_title} para decisiones directivas",
                    "bar",
                    {
                        "x_axis": main_category,
                        "y_axis": main_metric,
                        "chart_type": "executive_bar",
                    },
                    0.95,
                    [main_metric, main_category],
                )
            )

            # 2. Market Share Pie Chart
            buttons.append(
                create_button(
                    f"Share de Mercado: {cat_title}",
                    f"Distribución visual del market share por {cat_title} para análisis estratégico",
                    "pie",
                    {
                        "x_axis": main_category,
                        "y_axis": main_metric,
                        "chart_type": "executive_pie",
                    },
                    0.90,
                    [main_metric, main_category],
                )
            )

            # 3. Performance Benchmark
            if len(data) > 5:
                buttons.append(
                    create_button(
                        f"Benchmark Estratégico",
                        f"Comparación vs targets y benchmarks de {metric_title} para evaluación de performance",
                        "benchmark",
                        {
                            "x_axis": main_category,
                            "y_axis": main_metric,
                            "chart_type": "benchmark",
                        },
                        0.85,
                        [main_metric, main_category],
                    )
                )

        return buttons



def _generate_growth_analysis_buttons(
        data: pd.DataFrame, executive_context: Dict, create_button
    ) -> List[Dict]:
        """Generate executive buttons for growth analysis"""
        buttons = []
        date_cols = identify_date_columns(data)
        numeric_cols = identify_numeric_columns(data)

        if date_cols and numeric_cols:
            date_col = date_cols[0]
            main_metric = numeric_cols[0]

            date_title = translate_column_name(date_col)
            metric_title = translate_column_name(main_metric)

            # 1. Growth Trending Line Chart
            buttons.append(
                create_button(
                    f"Evolución Ejecutiva: {metric_title}",
                    f"Análisis de crecimiento y proyecciones de {metric_title} para planificación estratégica",
                    "line",
                    {
                        "x_axis": date_col,
                        "y_axis": main_metric,
                        "chart_type": "executive_trend",
                    },
                    0.95,
                    [main_metric, date_col],
                )
            )

            # 2. YoY Growth Analysis
            buttons.append(
                create_button(
                    f"Crecimiento YoY",
                    f"Análisis año sobre año de {metric_title} para evaluación de performance",
                    "growth_analysis",
                    {
                        "x_axis": date_col,
                        "y_axis": main_metric,
                        "chart_type": "yoy_growth",
                    },
                    0.90,
                    [main_metric, date_col],
                )
            )

        return buttons



def _generate_performance_buttons(
        data: pd.DataFrame, executive_context: Dict, create_button
    ) -> List[Dict]:
        """Generate executive buttons for performance ranking"""
        buttons = []
        categorical_cols = identify_categorical_columns(data)
        numeric_cols = identify_numeric_columns(data)

        if categorical_cols and numeric_cols:
            cat_col = categorical_cols[0]
            metric_col = numeric_cols[0]

            cat_title = translate_column_name(cat_col)
            metric_title = translate_column_name(metric_col)

            # 1. Performance Ranking
            buttons.append(
                create_button(
                    f"Ranking de Performance: {cat_title}",
                    f"Ranking ejecutivo de {cat_title} por {metric_title} para identificar top performers",
                    "bar",
                    {
                        "x_axis": cat_col,
                        "y_axis": metric_col,
                        "chart_type": "performance_ranking",
                    },
                    0.95,
                    [metric_col, cat_col],
                )
            )

            # 2. Gap Analysis
            buttons.append(
                create_button(
                    f"Análisis de Brechas",
                    f"Identificación de gaps de performance entre {cat_title} para optimización",
                    "gap_analysis",
                    {
                        "x_axis": cat_col,
                        "y_axis": metric_col,
                        "chart_type": "gap_analysis",
                    },
                    0.85,
                    [metric_col, cat_col],
                )
            )

        return buttons



def _generate_operational_buttons(
        data: pd.DataFrame, executive_context: Dict, create_button
    ) -> List[Dict]:
        """Generate executive buttons for operational KPIs using LLM-generated SQL"""
        buttons = []

        # First try intelligent rule-based SQL generation
        original_question = executive_context.get("original_question", "")
        rule_based_followups = _generate_sql_followups_with_rules(
            original_question, data
        )
        if rule_based_followups:
            buttons.extend(rule_based_followups)
            logger.info(
                f"✅ Generated {len(rule_based_followups)} SQL follow-ups using intelligent rules"
            )
            return buttons

        # Try LLM generation as backup (requires agent context)
        # This needs to be handled by the agent itself
        try:
            # Note: LLM-based SQL generation requires agent context
            # For now, we'll skip this and rely on rule-based generation
            sql_followups = []
            # sql_followups = _generate_sql_followups_with_llm(
            #     original_question, data
            # )
            if sql_followups:
                buttons.extend(sql_followups)
                logger.info(
                    f"✅ Generated {len(sql_followups)} SQL follow-ups using LLM"
                )
                return buttons
        except Exception as e:
            logger.warning(f"⚠️ Failed to generate SQL follow-ups with LLM: {e}")

        # Fallback to traditional button generation with DIFFERENTIATED chart types
        numeric_cols = identify_numeric_columns(data)
        categorical_cols = identify_categorical_columns(data)
        petroleum_metrics = identify_petroleum_metrics(data)
        date_cols = identify_date_columns(data)

        # Check if data has temporal structure (time series)
        x_col, group_col = select_temporal_x_axis(data, date_cols)
        metric_cols = get_non_date_numeric_cols(data, date_cols)

        if x_col and metric_cols:
            # TEMPORAL FALLBACK: line + bar charts for time series data
            main_metric = metric_cols[0]
            metric_title = translate_column_name(main_metric)
            x_title = translate_column_name(x_col)

            # 1. Line chart - trend evolution
            buttons.append(
                create_button(
                    f"Tendencia: {metric_title}",
                    f"Evolución de {metric_title} por {x_title}",
                    "line",
                    {
                        "x_axis": x_col,
                        "y_axis": [main_metric],
                        "chart_type": "line",
                        "title": f"Evolución de {metric_title} por {x_title}",
                    },
                    0.95,
                    [main_metric, x_col],
                )
            )

            # 2. Bar chart - variation/comparison by period
            buttons.append(
                create_button(
                    f"Variación por {x_title}",
                    f"Comparación de {metric_title} por {x_title}",
                    "bar",
                    {
                        "x_axis": x_col,
                        "y_axis": main_metric,
                        "chart_type": "bar",
                    },
                    0.85,
                    [main_metric, x_col],
                )
            )

            logger.info(
                f"📈 Generated temporal fallback buttons (line+bar) for operational KPIs"
            )
            return buttons

        # NON-TEMPORAL FALLBACK: pie + ranking for categorical data
        # Determine main metric and category columns
        # IMPORTANT: main_metric must be NUMERIC, not categorical.
        # petroleum_metrics may include categorical cols like 'CAMPO' (petroleum keyword).
        numeric_petroleum = [m for m in petroleum_metrics if m in numeric_cols]
        main_metric = numeric_petroleum[0] if numeric_petroleum else (numeric_cols[0] if numeric_cols else None)
        cat_col = categorical_cols[0] if categorical_cols else None

        if main_metric and cat_col:
            metric_title = translate_column_name(main_metric)
            cat_title = translate_column_name(cat_col)

            # 1. Pie chart - distribution/composition view (visually distinct from bar)
            buttons.append(
                create_button(
                    f"Distribución: {metric_title}",
                    f"Gráfico circular mostrando la distribución porcentual de {metric_title} por {cat_title}",
                    "pie",
                    {
                        "x_axis": cat_col,
                        "y_axis": main_metric,
                        "chart_type": "pie",
                    },
                    0.90,
                    [main_metric, cat_col],
                )
            )

            # 2. Ranking bar - ranked view with medals and gradient colors
            buttons.append(
                create_button(
                    f"Ranking: {metric_title}",
                    f"Ranking ordenado de {cat_title} por {metric_title} con indicadores de posición",
                    "ranking_bar",
                    {
                        "x_axis": cat_col,
                        "y_axis": main_metric,
                        "chart_type": "ranking_bar",
                    },
                    0.85,
                    [main_metric, cat_col],
                )
            )

        return buttons




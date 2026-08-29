"""
Modern Analytics Agent - Configurable chart and visualization generation
"""

import logging
import time
from typing import Any, Dict, List, Optional

import pandas as pd

from .configurable_agent import AgentResponse, ConfigurableAgent

# Import modular chart creators
from .analytics.chart_creators import (
    _create_bar_chart_config as bar_chart_config,
    _create_grouped_bar_chart_config as grouped_bar_config,
    _create_ranking_bar_chart_config as ranking_bar_config,
    _create_line_chart_config as line_chart_config,
    _create_multi_line_chart_config as multi_line_config,
    _create_area_chart_config as area_chart_config,
    _create_pie_chart_config as pie_chart_config,
    _create_scatter_chart_config as scatter_chart_config,
    _create_histogram_chart_config as histogram_chart_config,
    _create_box_plot_chart_config as box_plot_config,
    _create_heatmap_chart_config as heatmap_config,
    _create_executive_chart_config as executive_chart_config,
    _create_dashboard_chart_config as dashboard_config,
)

# Import utility functions
from .analytics.utils import (
    translate_column_name,
    get_chart_color,
    get_petroleum_color_palette,
    generate_intelligent_chart_title,
    COLOR_SCHEMES,
)

# Import data analyzers
from .analytics.data_analyzers import (
    identify_numeric_columns,
    identify_categorical_columns,
    identify_date_columns,
    identify_petroleum_metrics,
    detect_available_years,
    detect_query_type,
    analyze_executive_intent,
    select_temporal_x_axis,
    get_non_date_numeric_cols,
)

# Import button generators
from .analytics.button_generators.sql_followups import (
    _generate_sql_followups_with_rules,
)
from .analytics.button_generators.executive_buttons import (
    _generate_market_share_buttons,
    _generate_growth_analysis_buttons,
    _generate_performance_buttons,
    _generate_operational_buttons,
)
from .analytics.button_generators.dynamic_buttons import (
    _generate_fallback_buttons,
)

logger = logging.getLogger(__name__)

# Global cache for analytics data persistence across requests
_analytics_cache = {}

# Analysis categories for hierarchical followup buttons
ANALYSIS_CATEGORIES = [
    {"id": "economico", "label": "Económico", "icon": "dollar-sign"},
    {"id": "clasificacion", "label": "Clasificación", "icon": "tags"},
    {"id": "produccion", "label": "Producción", "icon": "oil-can"},
    {"id": "temporal", "label": "Temporal", "icon": "clock"},
    {"id": "comparativo", "label": "Comparativo", "icon": "balance-scale"},
]

# ROBUSTEZ metrics: exact column names (with accents), aggregation rules, and SQL aliases
ROBUSTEZ_METRICS = {
    "ebitda": {"col": '"EBITDA (Activo) KUSD"', "agg": "SUM", "alias": "ebitda_kusd", "label": "EBITDA (KUSD)"},
    "breakeven": {"col": '"Breakeven (Activos) USD/Bl"', "agg": "AVG", "alias": "breakeven_usd", "label": "Breakeven (USD/Bl)"},
    "costos": {"col": '"Costos Variables (Activos) KUSD"', "agg": "SUM", "alias": "costos_kusd", "label": "Costos Variables (KUSD)"},
    "transporte": {"col": '"Transporte Real (Activo) KUSD"', "agg": "SUM", "alias": "transporte_kusd", "label": "Transporte (KUSD)"},
    "dilucion": {"col": '"Dilucion Real (Activo) KUSD"', "agg": "SUM", "alias": "dilucion_kusd", "label": "Dilución (KUSD)"},
    "tasa_aceite": {"col": '"Tasa Producción Aceite"', "agg": "WEIGHTED", "alias": "tasa_aceite_bpd", "label": "Tasa Aceite (BPD)"},
    "vol_aceite": {"col": '"Producción Aceite Dia_Mes"', "agg": "SUM", "alias": "prod_aceite_bls", "label": "Producción Aceite (Bls)"},
    "tasa_agua": {"col": '"Tasa Producción Agua"', "agg": "WEIGHTED", "alias": "tasa_agua_bpd", "label": "Tasa Agua (BPD)"},
    "vol_agua": {"col": '"Producción Agua Dia_Mes"', "agg": "SUM", "alias": "prod_agua_bls", "label": "Producción Agua (Bls)"},
}


class AnalyticsAgent(ConfigurableAgent):
    """
    Modern analytics agent for automated chart generation and data visualization
    Uses vector database for intelligent chart type recommendations
    """

    def __init__(self, config_path: str = "config/master_prompts.yaml"):
        """Initialize modern analytics agent"""
        super().__init__(agent_type="analytics", config_path=config_path)

        # Chart type mappings
        self.chart_type_mappings = {
            "trend": ["line", "area"],
            "comparison": ["bar", "column"],
            "distribution": ["histogram", "box"],
            "correlation": ["scatter", "heatmap"],
            "composition": ["pie", "donut", "stacked_bar"],
        }

        # Column name translations (English -> Spanish)
        self.column_translations = {
            "oil_volume": "Producción de Aceite",
            "bopd": "Barriles de Aceite por Día",
            "water": "Producción de Agua",
            "gas": "Producción de Gas",
            "gor": "Relación Gas-Aceite (GOR)",
            "wor": "Relación Agua-Aceite (WOR)",
            "field_name": "Campo",
            "well_common_name": "Pozo",
            "dmu_code": "Código DMU",
            "vice_hom": "Vicepresidencia",
            "campo": "Campo",
            "production": "Producción",
            "volume": "Volumen",
            "date": "Fecha",
            "observation_datetime": "Fecha",
            "participacion_pct": "Participación (%)",
            "bopd_gerencia": "BOPD por Gerencia",
            "gerencia": "Gerencia",
            "año": "Año",
            "total_nacional": "Total Nacional",
            "año": "Año",
            "mes": "Mes",
        }

        # Color schemes for different chart types and petroleum metrics
        self.color_schemes = {
            "petroleum_colors": ["#1f4e79", "#f7db17", "#ff5f00", "#004236", "#8b1538"],
            "oil_production": "#1f4e79",  # Deep blue for oil
            "water_production": "#0099cc",  # Light blue for water
            "gas_production": "#ff5f00",  # Orange for gas
            "gor_wor": "#f7db17",  # Yellow for ratios
            "comparison": ["#1f4e79", "#f7db17", "#ff5f00", "#004236", "#8b1538"],
            "temporal": "#1f4e79",
            "distribution": "#004236",
            "correlation": ["#1f4e79", "#ff5f00"],
        }

        # Statistics
        self.stats = {
            "total_requests": 0,
            "charts_generated": 0,
            "chart_types_used": {},
        }

        # Storage for chart generation data
        self.stored_data = {
            "results_data": None,
            "analytics_context": None,
            "last_question": None,
        }

        logger.info("Modern AnalyticsAgent initialized")

    def generate_chart_buttons(
        self,
        original_question: str,
        results_data: pd.DataFrame,
        agent_type: str,
        sql_query: str = "",
        context: Dict[str, Any] = None,
    ) -> AgentResponse:
        """Generate dynamic chart buttons for Panel 2"""
        self.stats["total_requests"] += 1
        logger.info(
            f"🔘 Chart buttons generation started for: '{original_question}' with {len(results_data) if not results_data.empty else 0} rows"
        )

        try:
            # Prepare analytics context
            analytics_context = self._prepare_analytics_context(
                original_question, results_data, agent_type, sql_query, context
            )

            # Check if data is suitable for graphing
            graphability_check = self._check_data_graphability(results_data)
            logger.info(
                f"📊 Data graphability check for buttons: {graphability_check['is_graphable']} - {graphability_check.get('reason', 'No reason')}"
            )

            if not graphability_check["is_graphable"]:
                logger.warning(
                    f"❌ Data not graphable for buttons: {graphability_check['reason']}"
                )
                return AgentResponse(
                    success=True,
                    content="No se pueden generar botones de gráficos para estos datos",
                    data={
                        "chart_buttons": [],
                        "is_graphable": False,
                        "reason": graphability_check["reason"],
                        "fallback_message": self._create_fallback_message(
                            graphability_check
                        ),
                    },
                )

            # Generate dynamic buttons for Panel 2
            dynamic_buttons = self._generate_dynamic_buttons(
                results_data, original_question, analytics_context
            )
            logger.info(
                f"🔘 Generated {len(dynamic_buttons)} dynamic buttons for Panel 2"
            )

            # Store data for later chart generation
            logger.info(
                f"🔧 About to store chart generation data for {len(results_data)} rows"
            )
            self._store_chart_generation_data(results_data, analytics_context)

            # Detect hierarchy and build categorized structure
            hierarchy = self._detect_hierarchy(original_question, results_data)
            report_mode = (context or {}).get("report_mode", "")
            is_robustez = report_mode == "robustez"

            categorized_buttons = None
            if is_robustez and hierarchy != "unknown":
                entity_ctx = self._extract_robustez_entity_context(
                    original_question, results_data, hierarchy
                )
                categories = self._build_robustez_categorized_buttons(
                    hierarchy, entity_ctx, dynamic_buttons
                )
                categorized_buttons = {
                    "hierarchy": hierarchy,
                    "hierarchy_label": {
                        "pozo": "Pozo",
                        "campo": "Campo",
                        "gerencia": "Gerencia",
                        "vicepresidencia": "Vicepresidencia",
                    }.get(hierarchy, hierarchy),
                    "categories": categories,
                }

            response_data = {
                "chart_buttons": dynamic_buttons,
                "is_graphable": True,
                "data_quality": graphability_check.get("quality", "good"),
                "button_summary": f"Se generaron {len(dynamic_buttons)} opciones de visualización",
            }
            if categorized_buttons:
                response_data["categorized_buttons"] = categorized_buttons

            return AgentResponse(
                success=True,
                content=f"Se generaron {len(dynamic_buttons)} botones de gráficos",
                data=response_data,
            )

        except Exception as e:
            logger.error(f"Error generating chart buttons: {e}")
            return AgentResponse(
                success=False,
                content=f"Error generando botones de gráficos: {str(e)}",
                error=str(e),
            )

    def generate_analytics(
        self,
        original_question: str,
        results_data: pd.DataFrame,
        agent_type: str,
        sql_query: str = "",
        context: Dict[str, Any] = None,
    ) -> AgentResponse:
        """Generate analytics and chart recommendations"""
        self.stats["total_requests"] += 1
        logger.info(
            f"🔍 Analytics generation started for: '{original_question}' with {len(results_data) if not results_data.empty else 0} rows"
        )

        try:
            # Prepare analytics context
            analytics_context = self._prepare_analytics_context(
                original_question, results_data, agent_type, sql_query, context
            )

            # Check if data is suitable for graphing
            graphability_check = self._check_data_graphability(results_data)
            logger.info(
                f"📊 Data graphability check: {graphability_check['is_graphable']} - {graphability_check.get('reason', 'No reason')}"
            )

            if not graphability_check["is_graphable"]:
                logger.warning(f"❌ Data not graphable: {graphability_check['reason']}")
                # Return non-graphable response with helpful message
                return AgentResponse(
                    success=True,
                    content="Los datos no son aptos para generar gráficos",
                    data={
                        "is_graphable": False,
                        "reason": graphability_check["reason"],
                        "suggestions": graphability_check["suggestions"],
                        "dynamic_buttons": [],
                        "chart_recommendations": [],
                        "auto_generated_charts": [],
                        "fallback_message": self._create_fallback_message(
                            graphability_check
                        ),
                    },
                )

            # Detect query type
            query_type = self._detect_query_type(original_question, results_data)
            logger.info(f"🎯 Query type detected: {query_type}")

            # Generate dynamic buttons based on query and data characteristics
            dynamic_buttons = self._generate_dynamic_buttons(
                results_data, original_question, analytics_context
            )
            logger.info(f"🔘 Generated {len(dynamic_buttons)} dynamic buttons")

            # Generate traditional chart recommendations (keep for backwards compatibility)
            chart_recommendations = self._generate_chart_recommendations(
                results_data, original_question, analytics_context
            )

            # Generate auto charts if data is suitable
            auto_charts = self._generate_auto_charts(
                results_data, chart_recommendations
            )

            # Generate insights
            data_insights = self._generate_data_insights(
                results_data, original_question
            )

            # Create enhanced response with dynamic buttons
            response_data = {
                "is_graphable": True,
                "data_quality": graphability_check.get("quality", "good"),
                "dynamic_buttons": dynamic_buttons,
                "chart_recommendations": chart_recommendations,
                "auto_generated_charts": auto_charts,
                "data_insights": data_insights,
                "visualization_summary": self._create_enhanced_visualization_summary(
                    dynamic_buttons, chart_recommendations, auto_charts
                ),
                "query_type": query_type,
                "petroleum_metrics_found": self._identify_petroleum_metrics(
                    results_data
                ),
            }

            logger.info(
                f"✅ Analytics response created with {len(dynamic_buttons)} dynamic buttons and {len(auto_charts)} auto charts"
            )

            response = AgentResponse(
                success=True,
                content="Análisis y opciones de visualización generados",
                data=response_data,
            )

            self.stats["charts_generated"] += len(auto_charts)

            return response

        except Exception as e:
            logger.error(f"Error generating analytics: {e}")
            return AgentResponse(
                success=False,
                content=f"Error generando análisis: {str(e)}",
                error=str(e),
            )

    def _prepare_analytics_context(
        self,
        original_question: str,
        results_data: pd.DataFrame,
        agent_type: str,
        sql_query: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Prepare context for analytics generation"""
        return {
            "original_question": original_question,
            "data_shape": results_data.shape if not results_data.empty else (0, 0),
            "data_columns": (
                list(results_data.columns) if not results_data.empty else []
            ),
            "agent_type": agent_type,
            "sql_query": sql_query,
            "numeric_columns": self._identify_numeric_columns(results_data),
            "categorical_columns": self._identify_categorical_columns(results_data),
            "date_columns": self._identify_date_columns(results_data),
            "petroleum_metrics": self._identify_petroleum_metrics(results_data),
            "context": context or {},
        }

    def _generate_chart_recommendations(
        self, data: pd.DataFrame, question: str, analytics_context: Dict
    ) -> List[Dict[str, Any]]:
        """Generate intelligent chart recommendations with scale validation"""
        recommendations = []

        try:
            if data.empty:
                return recommendations

            numeric_cols = analytics_context["numeric_columns"]
            categorical_cols = analytics_context["categorical_columns"]
            date_cols = analytics_context["date_columns"]
            petroleum_metrics = analytics_context["petroleum_metrics"]

            # Special handling for national BOPD production queries
            question_lower = question.lower()
            is_national_bopd = any(keyword in question_lower for keyword in [
                "producción nacional", "bopd nacional", "producción anual",
                "por año", "total país", "producción total"
            ]) and ("año" in question_lower or "bopd" in question_lower)

            # Check if we have gerencia breakdown
            has_gerencia = "GERENCIA" in data.columns or "VICE_HOM" in data.columns
            gerencia_col = "GERENCIA" if "GERENCIA" in data.columns else "VICE_HOM" if "VICE_HOM" in data.columns else None

            if is_national_bopd and "año" in [col.lower() for col in data.columns]:
                logger.info(f"Detected national BOPD production query - has_gerencia: {has_gerencia}")

                if has_gerencia and gerencia_col:
                    # We have gerencia breakdown - generate 3 specialized charts
                    bopd_col = "BOPD_GERENCIA" if "BOPD_GERENCIA" in data.columns else "BOPD"

                    # Chart 1: Bar chart aggregated by year (sum across all gerencias)
                    recommendations.append({
                        "chart_type": "bar",
                        "title": "Producción Nacional Anual Total (BOPD)",
                        "description": "Producción nacional agregada por año",
                        "priority": 1.0,
                        "complexity": "simple",
                        "config": {
                            "x_axis": "AÑO",
                            "y_axis": bopd_col,
                            "chart_type": "bar",
                            "aggregate_by_year": True
                        }
                    })

                    # Chart 2: Pie chart by gerencia (latest year)
                    recommendations.append({
                        "chart_type": "pie",
                        "title": "Distribución de Producción por Gerencia",
                        "description": f"Pael crticipación de cada gerencia en la producción total",
                        "priority": 0.95,
                        "complexity": "medium",
                        "config": {
                            "x_axis": gerencia_col,
                            "y_axis": bopd_col,
                            "chart_type": "pie"
                        }
                    })

                    # Chart 3: Bar chart by gerencia (latest year or aggregated)
                    recommendations.append({
                        "chart_type": "bar",
                        "title": "Producción por Gerencia",
                        "description": f"Comparación de producción entre gerencias",
                        "priority": 0.9,
                        "complexity": "medium",
                        "config": {
                            "x_axis": gerencia_col,
                            "y_axis": bopd_col,
                            "chart_type": "bar"
                        }
                    })

                else:
                    # No gerencia breakdown - just annual totals
                    bopd_col = "TOTAL_BOPD" if "TOTAL_BOPD" in data.columns else "BOPD"
                    recommendations.append({
                        "chart_type": "bar",
                        "title": "Variación Anual de Producción Nacional (BOPD)",
                        "description": "Producción nacional por año en barras",
                        "priority": 1.0,
                        "complexity": "simple",
                        "config": {
                            "x_axis": "AÑO",
                            "y_axis": bopd_col,
                            "chart_type": "bar",
                            "aggregate_by_year": True
                        }
                    })

                return recommendations

            # Time series charts (if date columns exist)
            if date_cols and numeric_cols:
                # Validate scale compatibility for multiple metrics
                cols_to_plot = numeric_cols[:2]
                if len(cols_to_plot) > 1:
                    validation = self._validate_scale_compatibility(cols_to_plot, data)
                    if not validation['compatible']:
                        logger.warning(f"Skipping multi-metric line chart: {validation['reason']}")
                        # Create separate charts for each metric type
                        for col in cols_to_plot:
                            recommendations.append(
                                {
                                    "chart_type": "line",
                                    "title": f"Evolución Temporal - {self._translate_column_name(col)}",
                                    "description": f'Evolución de {self._translate_column_name(col)} en el tiempo',
                                    "priority": 1.0,
                                    "complexity": "medium",
                                    "config": {
                                        "x_axis": date_cols[0],
                                        "y_axis": [col],
                                        "chart_type": "line",
                                    },
                                }
                            )
                    else:
                        # Scales are compatible, create multi-metric chart
                        recommendations.append(
                            {
                                "chart_type": "line",
                                "title": "Evolución Temporal",
                                "description": f'Evolución de {", ".join([self._translate_column_name(c) for c in cols_to_plot])} en el tiempo',
                                "priority": 1.0,
                                "complexity": "medium",
                                "config": {
                                    "x_axis": date_cols[0],
                                    "y_axis": cols_to_plot,
                                    "chart_type": "line",
                                },
                            }
                        )
                else:
                    # Single metric, no validation needed
                    recommendations.append(
                        {
                            "chart_type": "line",
                            "title": "Evolución Temporal",
                            "description": f'Evolución de {self._translate_column_name(cols_to_plot[0])} en el tiempo',
                            "priority": 1.0,
                            "complexity": "medium",
                            "config": {
                                "x_axis": date_cols[0],
                                "y_axis": cols_to_plot,
                                "chart_type": "line",
                            },
                        }
                    )

            # Comparison charts (categorical vs numeric)
            if categorical_cols and numeric_cols:
                recommendations.append(
                    {
                        "chart_type": "bar",
                        "title": "Comparación por Categoría",
                        "description": f"Comparar {numeric_cols[0]} por {categorical_cols[0]}",
                        "priority": 0.9,
                        "complexity": "low",
                        "config": {
                            "x_axis": categorical_cols[0],
                            "y_axis": numeric_cols[0],
                            "chart_type": "bar",
                        },
                    }
                )

            # Distribution charts for petroleum metrics
            if petroleum_metrics:
                for metric in petroleum_metrics[:2]:
                    recommendations.append(
                        {
                            "chart_type": "histogram",
                            "title": f"Distribución de {metric}",
                            "description": f"Análisis estadístico de {metric}",
                            "priority": 0.7,
                            "complexity": "medium",
                            "config": {"column": metric, "chart_type": "histogram"},
                        }
                    )

            # Correlation heatmap (if multiple numeric columns)
            if len(numeric_cols) >= 3:
                recommendations.append(
                    {
                        "chart_type": "heatmap",
                        "title": "Matriz de Correlación",
                        "description": "Correlaciones entre variables numéricas",
                        "priority": 0.6,
                        "complexity": "high",
                        "config": {"columns": numeric_cols, "chart_type": "heatmap"},
                    }
                )

            # Scatter plot for petroleum metrics correlation
            if len(petroleum_metrics) >= 2:
                recommendations.append(
                    {
                        "chart_type": "scatter",
                        "title": f"Correlación {petroleum_metrics[0]} vs {petroleum_metrics[1]}",
                        "description": "Análisis de correlación entre métricas petroleras",
                        "priority": 0.8,
                        "complexity": "medium",
                        "config": {
                            "x_axis": petroleum_metrics[0],
                            "y_axis": petroleum_metrics[1],
                            "chart_type": "scatter",
                        },
                    }
                )

            # Sort by priority
            recommendations.sort(key=lambda x: x["priority"], reverse=True)

        except Exception as e:
            logger.error(f"Error generating chart recommendations: {e}")

        return recommendations[:6]  # Limit to 6 recommendations

    def _generate_auto_charts(
        self, data: pd.DataFrame, recommendations: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Generate auto-charts for simple visualizations"""
        auto_charts = []

        try:
            if data.empty or len(recommendations) == 0:
                return auto_charts

            # Generate chart for top recommendation if it's simple
            top_rec = recommendations[0]
            if top_rec["complexity"] in ["low", "medium"]:
                chart_config = self._create_chart_config(data, top_rec)
                if chart_config:
                    auto_charts.append(chart_config)

            # Track chart type usage
            chart_type = top_rec["chart_type"]
            self.stats["chart_types_used"][chart_type] = (
                self.stats["chart_types_used"].get(chart_type, 0) + 1
            )

        except Exception as e:
            logger.error(f"Error generating auto charts: {e}")

        return auto_charts

    def _create_chart_config(
        self, data: pd.DataFrame, recommendation: Dict
    ) -> Optional[Dict]:
        """Create Plotly chart configuration"""
        try:
            chart_type = recommendation["chart_type"]
            config = recommendation.get("config", {})

            if chart_type == "bar":
                return self._create_bar_chart_config(data, config)
            elif chart_type == "ranking_bar":
                return self._create_ranking_bar_chart_config(data, config)
            elif chart_type == "line":
                return self._create_line_chart_config(data, config)
            elif chart_type == "multi_line":
                return self._create_multi_line_chart_config(data, config)
            elif chart_type == "scatter":
                return self._create_scatter_chart_config(data, config)
            elif chart_type == "histogram":
                return self._create_histogram_chart_config(data, config)
            elif chart_type == "dashboard":
                # For dashboard, create a bar chart with multiple columns
                return self._create_dashboard_chart_config(data, config)
            elif chart_type == "pie":
                # Add title to config for pie charts
                config_with_title = config.copy()
                if "title" not in config_with_title and recommendation.get("title"):
                    config_with_title["title"] = recommendation["title"]
                return self._create_pie_chart_config(data, config_with_title)
            elif chart_type == "grouped_bar":
                return self._create_grouped_bar_chart_config(data, config)
            elif chart_type == "box_plot":
                return self._create_box_plot_chart_config(data, config)
            elif chart_type == "heatmap":
                return self._create_heatmap_chart_config(data, config)
            elif chart_type == "area":
                return self._create_area_chart_config(data, config)
            elif chart_type in [
                "benchmark",
                "gap_analysis",
                "growth_analysis",
                "efficiency_analysis",
            ]:
                # Executive chart types - fallback to appropriate base charts
                return self._create_executive_chart_config(data, config, chart_type)
            elif chart_type in [
                "subplot_combo",
                "horizontal_comparison_bar",
                "multi_line_grouped",
            ]:
                # Frontend-only chart types - pass through data and config
                logger.info(f"✅ Frontend-only chart type '{chart_type}' - passing through to frontend")
                return self._create_frontend_passthrough_config(data, config, recommendation)
            else:
                # Fallback to bar chart for unknown types
                logger.warning(
                    f"Unknown chart type '{chart_type}', falling back to bar chart"
                )
                return self._create_bar_chart_config(data, config)

        except Exception as e:
            logger.error(f"Error creating chart config: {e}")
            return None

    def _create_frontend_passthrough_config(
        self, data: pd.DataFrame, config: Dict, recommendation: Dict
    ) -> Dict:
        """
        Create a passthrough configuration for frontend-only chart types.
        These charts are rendered entirely in the frontend using custom logic.
        """
        try:
            # Replace NaN with None (converts to null in JSON) to avoid JSON serialization errors
            data_clean = data.replace({pd.NA: None, float('nan'): None})
            data_clean = data_clean.where(pd.notnull(data_clean), None)

            # Convert data to records format for frontend
            data_records = data_clean.to_dict("records")

            # Create chart config with raw data and original config
            chart_config = {
                "type": recommendation.get("chart_type"),
                "title": recommendation.get("title", ""),
                "description": recommendation.get("description", ""),
                "data": data_records,
                "config": config,
                "frontend_only": True,  # Flag to indicate frontend processing
                "data_shape": {
                    "rows": len(data_clean),
                    "columns": list(data_clean.columns),
                },
                "id": f"chart_{int(pd.Timestamp.now().timestamp())}"
            }

            logger.info(f"✅ Created frontend passthrough config:")
            logger.info(f"   • Chart type: {recommendation.get('chart_type')}")
            logger.info(f"   • Data rows: {len(data_clean)}")
            logger.info(f"   • Data columns: {list(data_clean.columns)}")
            logger.info(f"   • Config keys: {list(config.keys())}")
            logger.info(f"   • First row sample: {data_records[0] if data_records else 'No data'}")

            return chart_config

        except Exception as e:
            logger.error(f"❌ Error creating frontend passthrough config: {e}", exc_info=True)
            return None

    def _create_dashboard_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return dashboard_config(data, config)

    def _create_pie_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return pie_chart_config(data, config)

    def _create_multi_line_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return multi_line_config(data, config)

    def _create_grouped_bar_chart_config(
        self, data: pd.DataFrame, config: Dict
    ) -> Dict:
        """Create grouped bar chart with multiple y-axis columns side by side."""
        try:
            x_col = config.get("x_axis")
            y_cols = config.get("y_axis")

            if not isinstance(y_cols, list):
                y_cols = [y_cols]

            # Filter to columns that actually exist in the data
            y_cols = [c for c in y_cols if c in data.columns]
            if not y_cols or x_col not in data.columns:
                return self._create_bar_chart_config(data, config)

            # If only one column survived, fall back to regular bar
            if len(y_cols) == 1:
                config_single = {**config, "y_axis": y_cols[0]}
                return self._create_bar_chart_config(data, config_single)

            # Aggregate if categorical x-axis
            chart_data = data.copy()
            if chart_data[x_col].dtype == "object":
                chart_data = chart_data.groupby(x_col)[y_cols].sum().reset_index()

            # Sort descending by first y column if requested
            if config.get("sort_descending"):
                chart_data = chart_data.sort_values(y_cols[0], ascending=False)

            # Colors for each series
            series_colors = ["#CCD32A", "#00214D", "#FF5F00", "#F7DB17"]

            # Build one trace per y column
            traces = []
            for i, y_col in enumerate(y_cols):
                trace = {
                    "x": chart_data[x_col].tolist(),
                    "y": chart_data[y_col].tolist(),
                    "type": "bar",
                    "name": translate_column_name(y_col),
                    "marker": {
                        "color": series_colors[i % len(series_colors)],
                        "line": {"color": "#ffffff", "width": 1},
                    },
                }
                # Add data labels if requested
                if config.get("show_data_labels"):
                    text_labels = []
                    for v in chart_data[y_col]:
                        if abs(v) >= 1_000_000:
                            text_labels.append(f"{v / 1_000_000:,.1f}M")
                        elif abs(v) >= 1_000:
                            text_labels.append(f"{v / 1_000:,.1f}k")
                        else:
                            text_labels.append(f"{v:,.1f}")
                    trace["text"] = text_labels
                    trace["textposition"] = "outside"
                    trace["textfont"] = {"size": 10, "color": "#333333"}
                traces.append(trace)

            title = config.get("title", f"{y_cols[0]} por {x_col}")
            x_title = translate_column_name(x_col)
            y_title = config.get("y_title", "Volumen")

            return {
                "id": f"grouped_bar_{int(pd.Timestamp.now().timestamp())}",
                "type": "bar",
                "title": title,
                "data": traces,
                "layout": {
                    "title": title,
                    "barmode": "group",
                    "xaxis": {
                        "title": x_title,
                        "tickangle": -45 if len(chart_data) > 5 else 0,
                    },
                    "yaxis": {"title": y_title},
                    "font": {"size": 12, "family": "Arial, sans-serif"},
                    "plot_bgcolor": "rgba(0,0,0,0)",
                    "paper_bgcolor": "rgba(0,0,0,0)",
                    "height": 500,
                    "legend": {"orientation": "h", "y": -0.15, "x": 0.5, "xanchor": "center"},
                    "margin": {"b": 120 if len(chart_data) > 5 else 80},
                },
            }
        except Exception as e:
            logger.error(f"Error in grouped bar chart config: {e}")
            return self._create_bar_chart_config(data, config)

    def _create_box_plot_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return box_plot_config(data, config)

    def _create_heatmap_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return heatmap_config(data, config)

    def _create_area_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return area_chart_config(data, config)

    def _create_executive_chart_config(
        self, data: pd.DataFrame, config: Dict, chart_type: str
    ) -> Dict:
        """Delegate to modular function"""
        return executive_chart_config(data, config, chart_type)

    def _create_bar_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return bar_chart_config(data, config)

    def _create_ranking_bar_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return ranking_bar_config(data, config)

    def _create_line_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return line_chart_config(data, config)

    def _create_scatter_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return scatter_chart_config(data, config)

    def _create_histogram_chart_config(self, data: pd.DataFrame, config: Dict) -> Dict:
        """Delegate to modular function"""
        return histogram_chart_config(data, config)

    def _generate_data_insights(self, data: pd.DataFrame, question: str) -> List[str]:
        """Generate insights about the data for visualization"""
        insights = []

        try:
            if data.empty:
                return ["No hay datos disponibles para generar visualizaciones"]

            # Data shape insights
            rows, cols = data.shape
            insights.append(f"Dataset con {rows:,} registros y {cols} columnas")

            # Numeric data insights
            numeric_cols = self._identify_numeric_columns(data)
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
            categorical_cols = self._identify_categorical_columns(data)
            if categorical_cols:
                insights.append(
                    f"Variables categóricas: {', '.join(categorical_cols[:2])}"
                )

            # Petroleum-specific insights
            petroleum_metrics = self._identify_petroleum_metrics(data)
            if petroleum_metrics:
                insights.append(
                    f"Métricas petroleras identificadas: {', '.join(petroleum_metrics)}"
                )

        except Exception as e:
            logger.error(f"Error generating data insights: {e}")
            insights.append("Error analizando datos para visualización")

        return insights

    def _create_enhanced_visualization_summary(
        self,
        dynamic_buttons: List[Dict],
        recommendations: List[Dict],
        auto_charts: List[Dict],
    ) -> str:
        """Create enhanced visualization summary including dynamic buttons"""
        try:
            summary_parts = []

            if dynamic_buttons:
                summary_parts.append(
                    f"Se generaron {len(dynamic_buttons)} botones dinámicos de visualización"
                )

                button_types = [btn["chart_type"] for btn in dynamic_buttons]
                summary_parts.append(
                    f"Opciones disponibles: {', '.join(set(button_types))}"
                )

            if auto_charts:
                summary_parts.append(
                    f"Se crearon {len(auto_charts)} gráficos automáticos"
                )

            if recommendations:
                summary_parts.append(
                    f"Se generaron {len(recommendations)} recomendaciones adicionales"
                )

            return (
                ". ".join(summary_parts)
                if summary_parts
                else "No se generaron visualizaciones"
            )

        except Exception as e:
            logger.error(f"Error creating enhanced visualization summary: {e}")
            return "Error creando resumen de visualización"

    def _create_fallback_message(self, graphability_check: Dict) -> str:
        """Create a user-friendly fallback message for non-graphable data"""
        reason = graphability_check.get("reason", "Datos no aptos para gráficos")
        suggestions = graphability_check.get("suggestions", [])

        message_parts = [f"📊 {reason}"]

        if suggestions:
            message_parts.append("\n💡 Sugerencias:")
            for suggestion in suggestions:
                message_parts.append(f"• {suggestion}")

        message_parts.append("\n🔍 Puedes intentar consultas como:")
        message_parts.append(
            "• Evolución de producción de aceite en los últimos 6 meses"
        )
        message_parts.append("• Comparar producción entre diferentes campos")
        message_parts.append("• Distribución de GOR por pozos activos")

        return "\n".join(message_parts)

    def _create_visualization_summary(
        self, recommendations: List[Dict], auto_charts: List[Dict]
    ) -> str:
        """Create visualization summary (legacy method for backwards compatibility)"""
        try:
            summary_parts = []

            if recommendations:
                summary_parts.append(
                    f"Se generaron {len(recommendations)} recomendaciones de gráficos"
                )

                chart_types = [rec["chart_type"] for rec in recommendations]
                summary_parts.append(
                    f"Tipos recomendados: {', '.join(set(chart_types))}"
                )

            if auto_charts:
                summary_parts.append(
                    f"Se crearon {len(auto_charts)} gráficos automáticos"
                )

            return (
                ". ".join(summary_parts)
                if summary_parts
                else "No se generaron visualizaciones"
            )

        except Exception as e:
            logger.error(f"Error creating visualization summary: {e}")
            return "Error creando resumen de visualización"

    def _identify_numeric_columns(self, data: pd.DataFrame) -> List[str]:
        """Delegate to modular function"""
        return identify_numeric_columns(data)

    def _identify_categorical_columns(self, data: pd.DataFrame) -> List[str]:
        """Delegate to modular function"""
        return identify_categorical_columns(data)

    def _identify_date_columns(self, data: pd.DataFrame) -> List[str]:
        """Delegate to modular function"""
        return identify_date_columns(data)

    def _identify_petroleum_metrics(self, data: pd.DataFrame) -> List[str]:
        """Delegate to modular function"""
        return identify_petroleum_metrics(data)

    def _detect_query_type(self, question: str, data: pd.DataFrame) -> str:
        """Delegate to modular function"""
        return detect_query_type(question, data)

    def _analyze_executive_intent(
        self, question: str, data: pd.DataFrame, query_type: str
    ) -> Dict[str, Any]:
        """Analyze executive intent behind the query for intelligent follow-ups"""
        question_lower = question.lower()
        columns = list(data.columns) if not data.empty else []

        # Determine executive intent category
        intent_type = "general"
        key_metrics = []
        suggested_drilldowns = []
        business_context = ""

        # Participation/Share Analysis Intent
        if any(
            kw in question_lower
            for kw in ["participación", "porcentaje", "distribución", "share"]
        ):
            intent_type = "market_share"
            key_metrics = [
                col
                for col in columns
                if any(x in col.lower() for x in ["participacion", "pct", "porcentaje"])
            ]
            suggested_drilldowns = ["ranking", "trending", "benchmark", "composition"]
            business_context = (
                "Análisis de participación para decisiones estratégicas de mercado"
            )

        # Temporal/Growth Analysis Intent
        elif any(
            kw in question_lower
            for kw in ["evolución", "tendencia", "yoy", "crecimiento", "histórico"]
        ):
            intent_type = "growth_analysis"
            key_metrics = [
                col
                for col in columns
                if any(x in col.lower() for x in ["bopd", "produccion", "volumen"])
            ]
            suggested_drilldowns = [
                "projection",
                "seasonal",
                "comparative",
                "acceleration",
            ]
            business_context = "Análisis de crecimiento para planificación estratégica"

        # Performance/Ranking Intent
        elif any(
            kw in question_lower
            for kw in ["ranking", "mejor", "top", "comparar", "eficiencia"]
        ):
            intent_type = "performance_ranking"
            key_metrics = [
                col
                for col in columns
                if any(x in col.lower() for x in ["bopd", "produccion", "eficiencia"])
            ]
            suggested_drilldowns = [
                "benchmarking",
                "gap_analysis",
                "best_practices",
                "optimization",
            ]
            business_context = (
                "Análisis de performance para identificación de oportunidades"
            )

        # Operational/KPI Intent
        elif any(
            kw in question_lower for kw in ["producción", "volumen", "operacion", "kpi"]
        ):
            intent_type = "operational_kpis"
            key_metrics = [
                col
                for col in columns
                if any(x in col.lower() for x in ["bopd", "gor", "wor", "volumen"])
            ]
            suggested_drilldowns = ["targets", "alerts", "drill_down", "correlation"]
            business_context = "Análisis operacional para optimización de procesos"

        return {
            "intent_type": intent_type,
            "key_metrics": key_metrics,
            "suggested_drilldowns": suggested_drilldowns,
            "business_context": business_context,
            "executive_priority": self._calculate_executive_priority(
                intent_type, key_metrics
            ),
        }

    def _calculate_executive_priority(
        self, intent_type: str, key_metrics: List[str]
    ) -> float:
        """Calculate priority score for executive relevance"""
        base_scores = {
            "market_share": 0.95,  # High priority for strategic decisions
            "growth_analysis": 0.90,  # High priority for planning
            "performance_ranking": 0.85,  # Important for optimization
            "operational_kpis": 0.75,  # Operational importance
        }
        return base_scores.get(intent_type, 0.5)

    def _generate_dynamic_buttons(
        self, data: pd.DataFrame, question: str, context: Dict
    ) -> List[Dict[str, Any]]:
        """Generate intelligent executive-level dynamic buttons based on query analysis"""
        buttons = []
        query_type = self._detect_query_type(question, data)
        logger.info(f"🎯 Generating executive buttons for query type: {query_type}")

        # Executive context analysis
        executive_context = self._analyze_executive_intent(question, data, query_type)
        # Add original question to executive context for SQL generation
        executive_context["original_question"] = question
        logger.info(f"📊 Executive context: {executive_context['intent_type']}")

        numeric_cols = self._identify_numeric_columns(data)
        categorical_cols = self._identify_categorical_columns(data)
        date_cols = self._identify_date_columns(data)
        petroleum_metrics = self._identify_petroleum_metrics(data)

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
                translated_cols = [self._translate_column_name(col) for col in columns]
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
            operational_buttons = _generate_operational_buttons(
                data, executive_context, create_button
            )
            buttons.extend(operational_buttons)

            # If SQL follow-ups were generated, return early (don't add additional buttons)
            has_sql_buttons = any(btn.get("is_sql_query", False) for btn in operational_buttons)
            if has_sql_buttons:
                logger.info(f"✅ Returning {len(operational_buttons)} SQL follow-up buttons (skipping additional button generation)")
                # Deduplicate and sort before returning
                seen_combinations = set()
                unique_buttons = []
                for button in buttons:
                    # Get chart_type from button root or config
                    chart_type = button.get("chart_type") or button.get("config", {}).get("chart_type", "unknown")
                    combo = (button["title"], chart_type)
                    if combo not in seen_combinations:
                        seen_combinations.add(combo)
                        unique_buttons.append(button)
                unique_buttons.sort(key=lambda x: x.get("priority", 0.5), reverse=True)
                return unique_buttons[:4]  # Limit to 4 buttons
        else:
            # Fallback to original logic for backward compatibility
            buttons.extend(
                _generate_fallback_buttons(data, query_type, create_button)
            )

        # Generate buttons based on original query type for additional options
        if query_type == "temporal" and date_cols and numeric_cols:
            # Smart x-axis selection: pick column with most distinct values
            x_axis_col, group_col = select_temporal_x_axis(data, date_cols)
            if not x_axis_col:
                x_axis_col = date_cols[0]

            # Exclude date columns from metrics to avoid using AÑO/MES as y-axis
            metric_cols = get_non_date_numeric_cols(data, date_cols)
            effective_metrics = metric_cols if metric_cols else petroleum_metrics

            # Detect ROBUSTEZ context
            report_mode = context.get("context", {}).get("report_mode", "")
            is_robustez = report_mode == "robustez"

            if is_robustez and effective_metrics and x_axis_col:
                # ===== ROBUSTEZ-specific temporal buttons =====
                # Note: Line chart (Tendencia) is already generated by the
                # executive_buttons.py temporal fallback. We add specialized
                # ROBUSTEZ analyses here instead of duplicating the line chart.
                metric = effective_metrics[0]
                metric_title = self._translate_column_name(metric)
                x_title = self._translate_column_name(x_axis_col)

                # 1. Bar chart: Variación % (adapts label for AÑO vs MES)
                is_annual = "año" in x_axis_col.lower() or x_axis_col.lower() == "year"
                var_period = "Anual" if is_annual else "Mes a Mes"
                var_between = "años" if is_annual else "meses consecutivos"
                buttons.append(
                    create_button(
                        f"Variación % {var_period}",
                        f"Porcentaje de variación de {metric_title} entre {var_between}",
                        "bar",
                        {
                            "x_axis": x_axis_col,
                            "y_axis": metric,
                            "chart_type": "bar",
                            "compute_variation_pct": True,
                            "title": f"Variación % {var_period} - {metric_title}",
                        },
                        1.0,
                        [metric],
                    )
                )

                # 3. SQL button: Segmentación por Condición de Pozo
                # Extract entity (CAMPO or VICEPRESIDENCIA) and AÑO from question/data
                question_lower = question.lower()
                campo_name = self._extract_campo_from_question(question_lower)
                vp_name = self._extract_vp_from_question(question_lower)
                año_value = None
                año_col = next(
                    (c for c in date_cols if "año" in c.lower() or c.lower() == "year"),
                    None,
                )
                if año_col and not data.empty:
                    año_value = int(data[año_col].dropna().iloc[0])

                if año_value and (campo_name or vp_name):
                    if campo_name:
                        # Filter by CAMPO
                        where_filter = f"UPPER(CAMPO) = '{campo_name.upper()}'"
                        entity_label = campo_name
                    else:
                        # Filter by VICEPRESIDENCIA
                        where_filter = f"UPPER(VICEPRESIDENCIA) = '{vp_name.upper()}'"
                        entity_label = f"VP {vp_name}"

                    segmentation_sql = f'''
SELECT "Condición Real (Activos)" AS condicion,
       COUNT(*) AS cantidad_pozos,
       ROUND(SUM("Tasa Producción Aceite"), 1) AS produccion_aceite
FROM RESULTADOSREGRESION
WHERE "AÑO" = {año_value}
  AND {where_filter}
GROUP BY "Condición Real (Activos)"
ORDER BY produccion_aceite DESC
'''.strip()
                    buttons.append({
                        "id": f"btn_segmentacion_{int(pd.Timestamp.now().timestamp())}",
                        "title": "Segmentación por Condición de Pozo",
                        "description": f"Producción de {entity_label} por condición: Rentables, Marginales, No Rentables",
                        "chart_type": "pie",
                        "config": {
                            "x_axis": "condicion",
                            "y_axis": "produccion_aceite",
                            "chart_type": "pie",
                            "title": f"Segmentación por Condición - {entity_label} ({año_value})",
                            "color_map": {"RENTABLE": "#004236", "MARGINAL": "#CCD32A", "NO RENTABLE": "#F7DB17"},
                        },
                        "priority": 0.90,
                        "css_class": "btn btn-outline-success btn-sm chart-button",
                        "is_sql_query": True,
                        "sql_query": segmentation_sql,
                        "database": "robustez",
                    })

                logger.info(f"📊 Generated {len(buttons)} ROBUSTEZ-specific temporal buttons")
            else:
                # ===== Standard temporal buttons =====
                # Time series visualizations
                for metric in effective_metrics[:2]:  # Limit to 2 main metrics
                    metric_title = self._translate_column_name(metric)
                    x_title = self._translate_column_name(x_axis_col)
                    buttons.append(
                        create_button(
                            f"Evolución de {metric_title}",
                            f"Gráfico de líneas mostrando evolución de {metric_title} por {x_title}",
                            "line",
                            {
                                "x_axis": x_axis_col,
                                "y_axis": [metric],
                                "chart_type": "line",
                            },
                            1.0,
                            [metric],
                        )
                    )

                if len(effective_metrics) >= 2:
                    buttons.append(
                        create_button(
                            "Comparación Temporal",
                            f"Comparar múltiples métricas en el tiempo",
                            "multi_line",
                            {
                                "x_axis": x_axis_col,
                                "y_axis": effective_metrics[:3],
                                "chart_type": "multi_line",
                            },
                            0.9,
                        )
                    )

                # Add year filter buttons if multiple years are detected
                available_years = self._detect_available_years(data)
                if len(available_years) > 1:
                    # Add individual year filter buttons
                    for year in available_years[-3:]:  # Last 3 years
                        if effective_metrics:
                            metric = effective_metrics[0]
                            metric_title = self._translate_column_name(metric)
                            buttons.append(
                                create_button(
                                    f"{metric_title} - Año {year}",
                                    f"Ver evolución de {metric_title} solo para el año {year}",
                                    "line",
                                    {
                                        "x_axis": x_axis_col,
                                        "y_axis": [metric],
                                        "chart_type": "line",
                                        "filter_year": year,
                                    },
                                    0.7,
                                    [metric],
                                )
                            )

                    # Add year comparison button (bar chart)
                    if effective_metrics:
                        metric = effective_metrics[0]
                        metric_title = self._translate_column_name(metric)
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
            num_col_title = self._translate_column_name(num_col)
            cat_col_title = self._translate_column_name(cat_col)

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
                metric_title = self._translate_column_name(metric)
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
            metric1_title = self._translate_column_name(metric1)
            metric2_title = self._translate_column_name(metric2)

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

        # Add a general overview only for NON-temporal data with enough columns
        # For temporal data (AÑO/MES), dashboard creates useless charts
        if len(numeric_cols) >= 2 and len(data) > 5 and query_type != "temporal":
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

    def _check_data_graphability(self, data: pd.DataFrame) -> Dict[str, Any]:
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

        numeric_cols = self._identify_numeric_columns(data)
        if len(numeric_cols) == 0:
            return {
                "is_graphable": False,
                "reason": "No se encontraron métricas numéricas para graficar",
                "suggestions": [
                    "Solicita métricas específicas como producción, volúmenes, o ratios"
                ],
            }

        petroleum_metrics = self._identify_petroleum_metrics(data)
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

    def get_analytics_stats(self) -> Dict[str, Any]:
        """Get analytics-specific statistics"""
        base_stats = self.get_agent_stats()

        analytics_stats = {
            **base_stats,
            "analytics_stats": self.stats,
            "supported_chart_types": list(self.chart_type_mappings.keys()),
            "available_visualizations": [
                "line",
                "bar",
                "scatter",
                "histogram",
                "heatmap",
                "pie",
            ],
        }

        return analytics_stats

    def _translate_column_name(self, column_name: str) -> str:
        """Delegate to modular function"""
        return translate_column_name(column_name)

    def _detect_available_years(self, data: pd.DataFrame) -> List[int]:
        """Delegate to modular function"""
        return detect_available_years(data)

    @staticmethod
    def _extract_campo_from_question(question_lower: str) -> Optional[str]:
        """Extract CAMPO name from a ROBUSTEZ question.
        Looks for patterns like 'campo CASTILLA', 'del campo Apiay', etc.
        """
        import re
        # Stop words: each additional word must NOT be one of these
        stop = (
            r"(?!en\b|del\b|de\b|por\b|para\b|desde\b|hasta\b|que\b|"
            r"durante\b|producción\b|produccion\b|cuál\b|cual\b|"
            r"como\b|cómo\b|tiene\b|con\b|sin\b|entre\b|"
            r"sobre\b|año\b|mes\b|cuanto\b|cuánto\b)"
        )
        # First word after "campo" is always captured; additional words
        # are only captured if they don't match stop words.
        match = re.search(
            r'campo\s+([a-záéíóúñ]+(?:\s+' + stop + r'[a-záéíóúñ]+)*)',
            question_lower,
        )
        if match:
            return match.group(1).strip().upper()
        return None

    @staticmethod
    def _extract_vp_from_question(question_lower: str) -> Optional[str]:
        """Extract VICEPRESIDENCIA code from a ROBUSTEZ question.
        Looks for patterns like 'Vicepresidencia GOR', 'VP GAN', 'la VP GCT', etc.
        Known VP codes: CPV, DFL, GAA, GAN, GCH, GCT, GNS, GOR, GPA, GRM, GTA, GXO, PRP
        """
        import re
        known_vps = {
            "cpv", "dfl", "gaa", "gan", "gch", "gct", "gns",
            "gor", "gpa", "grm", "gta", "gxo", "prp",
        }
        # Match "vicepresidencia CODE" or "vp CODE"
        match = re.search(
            r'(?:vicepresidencia|vp)\s+([a-záéíóúñ]+)',
            question_lower,
        )
        if match:
            candidate = match.group(1).strip().upper()
            if candidate.lower() in known_vps:
                return candidate
        return None

    @staticmethod
    def _detect_hierarchy(question: str, data: pd.DataFrame) -> str:
        """Detect the hierarchy level of the query: pozo, campo, gerencia, vicepresidencia, or unknown."""
        import re
        question_lower = question.lower()

        has_pozo = bool(re.search(r'\bpozo\b', question_lower))
        has_campo = bool(re.search(r'\bcampo\b', question_lower))
        has_gerencia = bool(re.search(r'\bgerencia\b', question_lower))
        has_vp = bool(re.search(r'\b(?:vicepresidencia|vp)\b', question_lower))

        # Resolve ambiguity: if a higher-level keyword appears BEFORE a lower one,
        # the higher level is the scope (e.g. "En la gerencia PPC, cual es el campo...")
        if has_gerencia and has_campo:
            g_pos = re.search(r'\bgerencia\b', question_lower).start()
            c_pos = re.search(r'\bcampo\b', question_lower).start()
            if g_pos < c_pos:
                return "gerencia"

        # Check question keywords (most specific first)
        if has_pozo:
            return "pozo"
        if has_campo:
            return "campo"
        if has_gerencia:
            return "gerencia"
        if has_vp:
            return "vicepresidencia"

        # Check data columns (most specific first)
        if any(c in data.columns for c in ["POZO", "UWI", "WELL_COMMON_NAME"]):
            return "pozo"
        if "CAMPO" in data.columns:
            return "campo"
        if "GERENCIA" in data.columns:
            return "gerencia"
        if any(c in data.columns for c in ["VICEPRESIDENCIA", "VICE_HOM"]):
            return "vicepresidencia"

        return "unknown"

    @staticmethod
    def _compute_variation_pct(data: pd.DataFrame, config: Dict) -> pd.DataFrame:
        """Compute month-over-month variation % for temporal data.
        Replaces the y_axis metric with its % change between consecutive periods.
        """
        x_col = config.get("x_axis")
        y_col = config.get("y_axis")
        if not x_col or not y_col or x_col not in data.columns or y_col not in data.columns:
            return data

        # Sort chronologically: if AÑO exists alongside MES, sort by [AÑO, MES]
        # to handle cross-year data correctly (e.g., Nov 2025, Dec 2025, Jan 2026)
        _MES_A_NUM = {
            "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4,
            "Mayo": 5, "Junio": 6, "Julio": 7, "Agosto": 8,
            "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12,
        }
        if x_col == "MES" and "AÑO" in data.columns:
            df = data.copy()
            mes_numeric = pd.to_numeric(df["MES"], errors="coerce")
            if mes_numeric.notna().all():
                # MES is already numeric (1-12)
                df["MES"] = mes_numeric.astype(int)
            else:
                # MES is month names — create sort key from mapping
                df["_sort_mes"] = df["MES"].map(_MES_A_NUM)
                df = df.sort_values(["AÑO", "_sort_mes"]).drop(columns=["_sort_mes"])
                # Skip the default sort below since we already sorted
                mes_numeric = None
            if mes_numeric is not None:
                df = df.sort_values(["AÑO", "MES"])
        else:
            df = data.sort_values(x_col).copy()
        prev = df[y_col].shift(1)
        variation = ((df[y_col] - prev) / prev * 100).round(2)
        # Replace original metric with variation %
        var_col = f"variacion_pct_{y_col}"
        df[var_col] = variation
        # Drop first row (NaN) and update config to use new column
        df = df.dropna(subset=[var_col])
        config["y_axis"] = var_col
        config["y_title"] = "Variación %"
        logger.info(f"📈 Computed MoM variation %: {len(df)} rows, column '{var_col}'")
        return df

    # ──────────────────────────────────────────────────────────────────────
    #  ROBUSTEZ Categorized Buttons System
    # ──────────────────────────────────────────────────────────────────────

    @staticmethod
    def _agg_expr(col: str, agg_type: str, alias: str) -> str:
        """Generate SQL aggregation expression based on type."""
        if agg_type == "SUM":
            return f"ROUND(SUM({col}), 2) AS {alias}"
        elif agg_type == "AVG":
            return f"ROUND(AVG({col}), 2) AS {alias}"
        elif agg_type == "WEIGHTED":
            return f"ROUND(SUM({col} * PROD_DAYS) / NULLIF(SUM(PROD_DAYS), 0), 2) AS {alias}"
        elif agg_type == "COUNT_DISTINCT":
            return f"COUNT(DISTINCT {col}) AS {alias}"
        return f"{col} AS {alias}"

    @staticmethod
    def _build_robustez_sql(
        select_cols: List[str],
        group_by: Optional[List[str]] = None,
        where_entity: str = "",
        año: int = 2025,
        order_by: str = "",
        limit: int = 0,
    ) -> str:
        """Build parameterized SQL for ROBUSTEZ with correct quoting rules."""
        parts = [f"SELECT {', '.join(select_cols)}"]
        parts.append("FROM RESULTADOSREGRESION")

        wheres = [f'"AÑO" = {año}']
        if where_entity:
            wheres.append(where_entity)
        parts.append(f"WHERE {' AND '.join(wheres)}")

        if group_by:
            parts.append(f"GROUP BY {', '.join(group_by)}")
        if order_by:
            parts.append(f"ORDER BY {order_by}")
        if limit:
            parts.append(f"LIMIT {limit}")

        return "\n".join(parts)

    @staticmethod
    def _make_sql_button(
        title: str,
        description: str,
        chart_type: str,
        config: Dict,
        sql: str,
        priority: float = 0.9,
    ) -> Dict:
        """Create a SQL-backed button dict for ROBUSTEZ."""
        return {
            "id": f"btn_{chart_type}_{int(pd.Timestamp.now().timestamp())}_{abs(hash(title)) % 10000}",
            "title": title,
            "description": description,
            "chart_type": chart_type,
            "config": config,
            "priority": priority,
            "css_class": "btn btn-outline-primary btn-sm chart-button",
            "is_sql_query": True,
            "sql_query": sql,
            "database": "robustez",
        }

    # ── Entity extraction helpers ────────────────────────────────────────

    @staticmethod
    def _extract_gerencia_from_question(question_lower: str) -> Optional[str]:
        """Extract GERENCIA code from a ROBUSTEZ question."""
        import re
        known_gerencias = {
            "cpi", "cpv", "cuf", "cup", "gan", "gns", "gxo",
            "pci", "pcn", "pcs", "pdb", "pdh", "poe", "ppa",
            "ppc", "pph", "ppu", "ptn", "puc",
        }
        match = re.search(
            r'(?:gerencia)\s+([a-záéíóúñ0-9]+)',
            question_lower,
        )
        if match:
            candidate = match.group(1).strip().upper()
            if candidate.lower() in known_gerencias:
                return candidate
        return None

    @staticmethod
    def _extract_pozo_from_question(question_lower: str) -> Optional[str]:
        """Extract POZO/UWI identifier from a ROBUSTEZ question.
        UWIs can have alphanumeric chars with hyphens and underscores.
        """
        import re
        match = re.search(
            r'(?:pozo|uwi)\s+([a-záéíóúñ0-9][a-záéíóúñ0-9\-_]*)',
            question_lower,
        )
        if match:
            return match.group(1).strip().upper()
        return None

    @staticmethod
    def _extract_entity_from_data(data: pd.DataFrame, hierarchy: str) -> Optional[str]:
        """Fallback: extract entity name from DataFrame columns when question parsing fails."""
        col_map = {
            "campo": "CAMPO",
            "gerencia": "GERENCIA",
            "vicepresidencia": "VICEPRESIDENCIA",
            "pozo": "UWI",
        }
        col = col_map.get(hierarchy)
        if col and col in data.columns and not data.empty:
            values = data[col].dropna().unique()
            if len(values) == 1:
                return str(values[0]).strip().upper()
            if len(values) > 1:
                # Return most frequent value
                return str(data[col].mode().iloc[0]).strip().upper()
        return None

    def _extract_robustez_entity_context(
        self, question: str, data: pd.DataFrame, hierarchy: str
    ) -> Dict[str, Any]:
        """Unified entity extraction: combines question parsing + data fallback."""
        question_lower = question.lower()
        entity_name = None

        # Try question-based extraction first
        if hierarchy == "campo":
            entity_name = self._extract_campo_from_question(question_lower)
        elif hierarchy == "gerencia":
            entity_name = self._extract_gerencia_from_question(question_lower)
        elif hierarchy == "vicepresidencia":
            entity_name = self._extract_vp_from_question(question_lower)
        elif hierarchy == "pozo":
            entity_name = self._extract_pozo_from_question(question_lower)

        # Fallback to data extraction
        if not entity_name:
            entity_name = self._extract_entity_from_data(data, hierarchy)

        # Build WHERE filter
        col_map = {
            "campo": "CAMPO",
            "gerencia": "GERENCIA",
            "vicepresidencia": "VICEPRESIDENCIA",
            "pozo": "UWI",
        }
        where_col = col_map.get(hierarchy, "CAMPO")
        where_filter = f"UPPER({where_col}) = '{entity_name}'" if entity_name else ""

        # Extract year from data
        año = 2025
        if "AÑO" in data.columns and not data.empty:
            año_values = data["AÑO"].dropna()
            if not año_values.empty:
                año = int(año_values.iloc[0])

        # Determine child column (one level down in hierarchy)
        child_map = {
            "vicepresidencia": ("GERENCIA", "Gerencia"),
            "gerencia": ("CAMPO", "Campo"),
            "campo": ("UWI", "Pozo"),
            "pozo": (None, None),
        }
        child_col, child_label = child_map.get(hierarchy, (None, None))

        return {
            "entity_name": entity_name or "Desconocido",
            "where_filter": where_filter,
            "año": año,
            "hierarchy": hierarchy,
            "child_col": child_col,
            "child_label": child_label,
        }

    # ── Category button generators ───────────────────────────────────────

    def _build_economico_buttons(self, hierarchy: str, ctx: Dict) -> List[Dict]:
        """Generate Económico category buttons for any hierarchy level."""
        buttons = []
        entity = ctx["entity_name"]
        wf = ctx["where_filter"]
        año = ctx["año"]
        child = ctx["child_col"]

        if not wf:
            return buttons

        if hierarchy == "pozo":
            # Pozo: EBITDA by month + Breakeven by month
            sql1 = self._build_robustez_sql(
                ["MES", self._agg_expr(ROBUSTEZ_METRICS["ebitda"]["col"], "SUM", "ebitda_kusd")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"EBITDA Mensual - {entity}",
                f"EBITDA mensual del pozo {entity}",
                "bar",
                {"x_axis": "MES", "y_axis": "ebitda_kusd", "chart_type": "bar",
                 "title": f"EBITDA Mensual - Pozo {entity} ({año})"},
                sql1, 0.95,
            ))
            sql2 = self._build_robustez_sql(
                ["MES", self._agg_expr(ROBUSTEZ_METRICS["breakeven"]["col"], "AVG", "breakeven_usd")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"Breakeven Mensual - {entity}",
                f"Breakeven mensual del pozo {entity}",
                "line",
                {"x_axis": "MES", "y_axis": ["breakeven_usd"], "chart_type": "line",
                 "title": f"Breakeven Mensual - Pozo {entity} ({año})"},
                sql2, 0.90,
            ))
        elif hierarchy == "vicepresidencia":
            # VP level: compare ALL vicepresidencias (no entity filter)
            vp_col = '"VICEPRESIDENCIA"'
            sql1 = self._build_robustez_sql(
                [vp_col, self._agg_expr(ROBUSTEZ_METRICS["ebitda"]["col"], "SUM", "ebitda_kusd")],
                group_by=[vp_col], where_entity="", año=año,
                order_by="ebitda_kusd DESC",
            )
            buttons.append(self._make_sql_button(
                "EBITDA por Vicepresidencia",
                "EBITDA comparativo de todas las vicepresidencias",
                "bar",
                {"x_axis": "VICEPRESIDENCIA", "y_axis": "ebitda_kusd", "chart_type": "bar",
                 "title": f"EBITDA por Vicepresidencia ({año})",
                 "sort_descending": True, "gradient_color": "#004236", "show_data_labels": True},
                sql1, 0.95,
            ))

            sql2 = self._build_robustez_sql(
                [vp_col, self._agg_expr(ROBUSTEZ_METRICS["breakeven"]["col"], "AVG", "breakeven_usd")],
                group_by=[vp_col], where_entity="", año=año,
                order_by="breakeven_usd DESC",
            )
            buttons.append(self._make_sql_button(
                "Breakeven por Vicepresidencia",
                "Breakeven promedio comparativo de todas las vicepresidencias",
                "bar",
                {"x_axis": "VICEPRESIDENCIA", "y_axis": "breakeven_usd", "chart_type": "bar",
                 "title": f"Breakeven por Vicepresidencia ({año})",
                 "sort_descending": True, "gradient_color": "#00214D", "show_data_labels": True},
                sql2, 0.90,
            ))

            # Estructura de Costos (pie) — filtered to the specific VP
            sql3 = (
                f"SELECT 'Costos Variables' AS componente, "
                f"ROUND(SUM(\"Costos Variables (Activos) KUSD\"), 2) AS valor_kusd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND {wf}\n"
                f"UNION ALL\n"
                f"SELECT 'Transporte' AS componente, "
                f"ROUND(SUM(\"Transporte Real (Activo) KUSD\"), 2) AS valor_kusd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND {wf}\n"
                f"UNION ALL\n"
                f"SELECT 'Dilución' AS componente, "
                f"ROUND(SUM(\"Dilucion Real (Activo) KUSD\"), 2) AS valor_kusd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND {wf}"
            )
            buttons.append(self._make_sql_button(
                f"Estructura de Costos - {entity}",
                f"Distribución de costos operacionales de {entity}",
                "pie",
                {"x_axis": "componente", "y_axis": "valor_kusd", "chart_type": "pie",
                 "title": f"Estructura de Costos - {entity} ({año})",
                 "color_map": {"COSTOS VARIABLES": "#004236", "TRANSPORTE": "#CCD32A", "DILUCIÓN": "#F7DB17", "DILUCION": "#F7DB17"}},
                sql3, 0.85,
            ))

        else:
            # Campo/Gerencia: metric by MES (campo) or child (gerencia)
            group_col = "MES" if hierarchy == "campo" else child
            group_label = "Mes" if hierarchy == "campo" else ctx["child_label"]
            order = "MES" if hierarchy == "campo" else "ebitda_kusd DESC"
            limit_val = 15 if hierarchy != "campo" else 0

            sql1 = self._build_robustez_sql(
                [group_col, self._agg_expr(ROBUSTEZ_METRICS["ebitda"]["col"], "SUM", "ebitda_kusd")],
                group_by=[group_col], where_entity=wf, año=año,
                order_by=order, limit=limit_val,
            )
            ebitda_cfg = {"x_axis": group_col, "y_axis": "ebitda_kusd", "chart_type": "bar",
                 "title": f"EBITDA por {group_label} - {entity} ({año})"}
            if hierarchy == "gerencia":
                ebitda_cfg.update({"sort_descending": True, "gradient_color": "#004236", "show_data_labels": True})
            buttons.append(self._make_sql_button(
                f"EBITDA por {group_label}",
                f"EBITDA de {entity} agrupado por {group_label.lower()}",
                "bar",
                ebitda_cfg,
                sql1, 0.95,
            ))

            sql2 = self._build_robustez_sql(
                [group_col, self._agg_expr(ROBUSTEZ_METRICS["breakeven"]["col"], "AVG", "breakeven_usd")],
                group_by=[group_col], where_entity=wf, año=año,
                order_by="MES" if hierarchy == "campo" else "breakeven_usd DESC",
                limit=limit_val,
            )
            chart2 = "line" if hierarchy == "campo" else "bar"
            breakeven_cfg = {"x_axis": group_col, "y_axis": ["breakeven_usd"] if chart2 == "line" else "breakeven_usd", "chart_type": chart2,
                 "title": f"Breakeven por {group_label} - {entity} ({año})"}
            if hierarchy == "gerencia":
                breakeven_cfg.update({"sort_descending": True, "gradient_color": "#00214D", "show_data_labels": True})
            buttons.append(self._make_sql_button(
                f"Breakeven por {group_label}",
                f"Breakeven promedio de {entity} por {group_label.lower()}",
                chart2,
                breakeven_cfg,
                sql2, 0.90,
            ))

            # Estructura de Costos (pie) — all levels except pozo
            sql3 = (
                f"SELECT 'Costos Variables' AS componente, "
                f"ROUND(SUM(\"Costos Variables (Activos) KUSD\"), 2) AS valor_kusd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND {wf}\n"
                f"UNION ALL\n"
                f"SELECT 'Transporte' AS componente, "
                f"ROUND(SUM(\"Transporte Real (Activo) KUSD\"), 2) AS valor_kusd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND {wf}\n"
                f"UNION ALL\n"
                f"SELECT 'Dilución' AS componente, "
                f"ROUND(SUM(\"Dilucion Real (Activo) KUSD\"), 2) AS valor_kusd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND {wf}"
            )
            buttons.append(self._make_sql_button(
                f"Estructura de Costos - {entity}",
                f"Distribución de costos operacionales de {entity}",
                "pie",
                {"x_axis": "componente", "y_axis": "valor_kusd", "chart_type": "pie",
                 "title": f"Estructura de Costos - {entity} ({año})",
                 "color_map": {"COSTOS VARIABLES": "#004236", "TRANSPORTE": "#CCD32A", "DILUCIÓN": "#F7DB17", "DILUCION": "#F7DB17"}},
                sql3, 0.85,
            ))

        return buttons

    def _build_clasificacion_buttons(self, hierarchy: str, ctx: Dict) -> List[Dict]:
        """Generate Clasificación category buttons for any hierarchy level."""
        buttons = []
        entity = ctx["entity_name"]
        wf = ctx["where_filter"]
        año = ctx["año"]

        if not wf:
            return buttons

        if hierarchy == "pozo":
            # Pozo: condition by month
            sql1 = self._build_robustez_sql(
                ["MES", '"Condición Real (Activos)" AS condicion',
                 self._agg_expr(ROBUSTEZ_METRICS["tasa_aceite"]["col"], "WEIGHTED", "tasa_aceite_bpd")],
                group_by=["MES", '"Condición Real (Activos)"'],
                where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"Condición por Mes - {entity}",
                f"Evolución de la condición económica del pozo {entity}",
                "bar",
                {"x_axis": "MES", "y_axis": "tasa_aceite_bpd", "chart_type": "bar",
                 "title": f"Condición por Mes - Pozo {entity} ({año})"},
                sql1, 0.90,
            ))
        else:
            # Campo/Gerencia/VP: segmentation by condition (pie)
            sql1 = self._build_robustez_sql(
                ['"Condición Real (Activos)" AS condicion',
                 "COUNT(DISTINCT UWI) AS cantidad_pozos",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=['"Condición Real (Activos)"'],
                where_entity=wf, año=año, order_by="prod_aceite_bls DESC",
            )
            buttons.append(self._make_sql_button(
                f"Segmentación por Condición - {entity}",
                f"Pozos por condición: Rentable, Marginal, No Rentable",
                "pie",
                {"x_axis": "condicion", "y_axis": "cantidad_pozos", "chart_type": "pie",
                 "title": f"Segmentación por Condición - {entity} ({año})",
                 "color_map": {"RENTABLE": "#004236", "MARGINAL": "#CCD32A", "NO RENTABLE": "#F7DB17"}},
                sql1, 0.95,
            ))

            # Distribution by well status or well type
            if hierarchy == "campo":
                # Estado de pozos for campo
                sql2 = self._build_robustez_sql(
                    ['"ESTADO POZO" AS estado_pozo', "COUNT(DISTINCT UWI) AS cantidad_pozos"],
                    group_by=['"ESTADO POZO"'],
                    where_entity=wf, año=año, order_by="cantidad_pozos DESC",
                )
                buttons.append(self._make_sql_button(
                    f"Estado de Pozos - {entity}",
                    f"Distribución de pozos por estado: Activo, Inactivo, Suspendido",
                    "pie",
                    {"x_axis": "estado_pozo", "y_axis": "cantidad_pozos", "chart_type": "pie",
                     "title": f"Estado de Pozos - {entity} ({año})"},
                    sql2, 0.85,
                ))
            else:
                # Tipo de pozo for gerencia/VP
                sql2 = self._build_robustez_sql(
                    ['"TIPO DE POZO" AS tipo_pozo', "COUNT(DISTINCT UWI) AS cantidad_pozos"],
                    group_by=['"TIPO DE POZO"'],
                    where_entity=wf, año=año, order_by="cantidad_pozos DESC",
                )
                buttons.append(self._make_sql_button(
                    f"Tipo de Pozo - {entity}",
                    f"Distribución de pozos por tipo: Producción, Inyección, etc.",
                    "pie",
                    {"x_axis": "tipo_pozo", "y_axis": "cantidad_pozos", "chart_type": "pie",
                     "title": f"Tipo de Pozo - {entity} ({año})",
                     "color_map": {"PRODUCTION": "#004236", "INJECTION": "#0d6efd"}},
                    sql2, 0.85,
                ))

        return buttons

    def _build_produccion_buttons(self, hierarchy: str, ctx: Dict) -> List[Dict]:
        """Generate Producción category buttons for any hierarchy level."""
        buttons = []
        entity = ctx["entity_name"]
        wf = ctx["where_filter"]
        año = ctx["año"]
        child = ctx["child_col"]
        child_label = ctx["child_label"]

        if not wf:
            return buttons

        if hierarchy == "pozo":
            # Line: production evolution by month
            sql1 = self._build_robustez_sql(
                ["MES",
                 self._agg_expr(ROBUSTEZ_METRICS["tasa_aceite"]["col"], "WEIGHTED", "tasa_aceite_bpd")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"Evolución Producción - {entity}",
                f"Tasa de producción de aceite mensual del pozo {entity}",
                "line",
                {"x_axis": "MES", "y_axis": ["tasa_aceite_bpd"], "chart_type": "line",
                 "title": f"Evolución Producción Aceite - Pozo {entity} ({año})"},
                sql1, 0.95,
            ))
            # Multi-line: oil vs water
            sql2 = self._build_robustez_sql(
                ["MES",
                 self._agg_expr(ROBUSTEZ_METRICS["tasa_aceite"]["col"], "WEIGHTED", "tasa_aceite_bpd"),
                 self._agg_expr(ROBUSTEZ_METRICS["tasa_agua"]["col"], "WEIGHTED", "tasa_agua_bpd")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"Aceite vs Agua - {entity}",
                f"Comparación de tasas de aceite y agua del pozo {entity}",
                "multi_line",
                {"x_axis": "MES", "y_axis": ["tasa_aceite_bpd", "tasa_agua_bpd"],
                 "chart_type": "multi_line",
                 "title": f"Aceite vs Agua - Pozo {entity} ({año})"},
                sql2, 0.90,
            ))
        elif hierarchy == "campo":
            # Line: production by month
            sql1 = self._build_robustez_sql(
                ["MES",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"Evolución Producción Aceite - {entity}",
                f"Producción mensual de aceite del campo {entity}",
                "line",
                {"x_axis": "MES", "y_axis": ["prod_aceite_bls"], "chart_type": "line",
                 "title": f"Evolución Producción Aceite - {entity} ({año})"},
                sql1, 0.95,
            ))
            # Ranking: top wells
            sql2 = self._build_robustez_sql(
                ["UWI AS pozo",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=["UWI"], where_entity=wf, año=año,
                order_by="prod_aceite_bls DESC", limit=15,
            )
            buttons.append(self._make_sql_button(
                f"Top Pozos Productores - {entity}",
                f"Ranking de pozos por producción de aceite en {entity}",
                "ranking_bar",
                {"x_axis": "pozo", "y_axis": "prod_aceite_bls", "chart_type": "ranking_bar",
                 "title": f"Top Pozos Productores - {entity} ({año})"},
                sql2, 0.90,
            ))
        else:
            # Gerencia/VP: production by child
            sql1 = self._build_robustez_sql(
                [f"{child} AS {child.lower()}",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=[child], where_entity=wf, año=año,
                order_by="prod_aceite_bls DESC", limit=15,
            )
            buttons.append(self._make_sql_button(
                f"Producción por {child_label} - {entity}",
                f"Producción de aceite por {child_label.lower()} en {entity}",
                "bar",
                {"x_axis": child.lower(), "y_axis": "prod_aceite_bls", "chart_type": "bar",
                 "title": f"Producción por {child_label} - {entity} ({año})",
                 "sort_descending": True, "gradient_color": "#CCD32A", "show_data_labels": True},
                sql1, 0.95,
            ))
            # Ranking top children
            sql2 = self._build_robustez_sql(
                [f"{child} AS {child.lower()}",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=[child], where_entity=wf, año=año,
                order_by="prod_aceite_bls DESC", limit=10,
            )
            buttons.append(self._make_sql_button(
                f"Top {child_label}s - {entity}",
                f"Ranking de {child_label.lower()}s por producción en {entity}",
                "ranking_bar",
                {"x_axis": child.lower(), "y_axis": "prod_aceite_bls", "chart_type": "ranking_bar",
                 "title": f"Top {child_label}s por Producción - {entity} ({año})",
                 "gradient_color": "#CCD32A", "show_data_labels": True},
                sql2, 0.90,
            ))

        return buttons

    def _build_temporal_buttons(self, hierarchy: str, ctx: Dict) -> List[Dict]:
        """Generate Temporal category buttons for any hierarchy level."""
        buttons = []
        entity = ctx["entity_name"]
        wf = ctx["where_filter"]
        año = ctx["año"]

        if not wf:
            return buttons

        # All hierarchies: monthly production (for variation % computation)
        sql_var = self._build_robustez_sql(
            ["MES",
             self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
            group_by=["MES"], where_entity=wf, año=año, order_by="MES",
        )
        buttons.append(self._make_sql_button(
            f"Variación % Mes a Mes - {entity}",
            f"Porcentaje de variación de producción entre meses consecutivos",
            "bar",
            {"x_axis": "MES", "y_axis": "prod_aceite_bls", "chart_type": "bar",
             "compute_variation_pct": True,
             "title": f"Variación % Mes a Mes - {entity} ({año})"},
            sql_var, 0.95,
        ))

        if hierarchy != "pozo":
            # Additional: monthly production bar (absolute values)
            sql_prod = self._build_robustez_sql(
                ["MES",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            chart_type = "line" if hierarchy != "campo" else "bar"
            title_prefix = "Evolución Mensual" if hierarchy != "campo" else "Producción Mensual"
            buttons.append(self._make_sql_button(
                f"{title_prefix} - {entity}",
                f"Producción de aceite por mes de {entity}",
                chart_type,
                {"x_axis": "MES", "y_axis": ["prod_aceite_bls"] if chart_type == "line" else "prod_aceite_bls", "chart_type": chart_type,
                 "title": f"{title_prefix} - {entity} ({año})"},
                sql_prod, 0.85,
            ))

        return buttons

    def _build_comparativo_buttons(self, hierarchy: str, ctx: Dict) -> List[Dict]:
        """Generate Comparativo category buttons for any hierarchy level."""
        buttons = []
        entity = ctx["entity_name"]
        wf = ctx["where_filter"]
        año = ctx["año"]
        child = ctx["child_col"]
        child_label = ctx["child_label"]

        if not wf:
            return buttons

        if hierarchy == "pozo":
            # Pozo vs campo average
            sql1 = (
                f"SELECT 'Pozo {entity}' AS entidad, "
                f"ROUND(SUM(\"Tasa Producción Aceite\" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS), 0), 1) AS tasa_aceite_bpd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND {wf}\n"
                f"UNION ALL\n"
                f"SELECT 'Promedio Campo' AS entidad, "
                f"ROUND(SUM(\"Tasa Producción Aceite\" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS), 0), 1) AS tasa_aceite_bpd "
                f"FROM RESULTADOSREGRESION WHERE \"AÑO\" = {año} AND UPPER(CAMPO) = ("
                f"SELECT UPPER(CAMPO) FROM RESULTADOSREGRESION WHERE {wf} LIMIT 1)"
            )
            buttons.append(self._make_sql_button(
                f"vs Promedio del Campo",
                f"Comparar tasa de {entity} contra el promedio de su campo",
                "bar",
                {"x_axis": "entidad", "y_axis": "tasa_aceite_bpd", "chart_type": "bar",
                 "title": f"Pozo {entity} vs Promedio del Campo ({año})"},
                sql1, 0.90,
            ))
        elif hierarchy == "campo":
            # Aceite by month
            sql_aceite = self._build_robustez_sql(
                ["MES",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"Aceite por Mes - {entity}",
                f"Producción de aceite mensual",
                "area",
                {"x_axis": "MES", "y_axis": "prod_aceite_bls", "chart_type": "area",
                 "title": f"Aceite por Mes - {entity} ({año})",
                 "show_data_labels": True, "color": "#CCD32A"},
                sql_aceite, 0.90,
            ))
            # Agua by month
            sql_agua = self._build_robustez_sql(
                ["MES",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_agua"]["col"], "SUM", "prod_agua_bls")],
                group_by=["MES"], where_entity=wf, año=año, order_by="MES",
            )
            buttons.append(self._make_sql_button(
                f"Agua por Mes - {entity}",
                f"Producción de agua mensual",
                "area",
                {"x_axis": "MES", "y_axis": "prod_agua_bls", "chart_type": "area",
                 "title": f"Agua por Mes - {entity} ({año})",
                 "show_data_labels": True},
                sql_agua, 0.90,
            ))
            # Ranking wells by EBITDA
            sql2 = self._build_robustez_sql(
                ["UWI AS pozo",
                 self._agg_expr(ROBUSTEZ_METRICS["ebitda"]["col"], "SUM", "ebitda_kusd")],
                group_by=["UWI"], where_entity=wf, año=año,
                order_by="ebitda_kusd DESC", limit=15,
            )
            buttons.append(self._make_sql_button(
                f"Ranking Pozos por EBITDA - {entity}",
                f"Pozos más rentables del campo {entity}",
                "ranking_bar",
                {"x_axis": "pozo", "y_axis": "ebitda_kusd", "chart_type": "ranking_bar",
                 "title": f"Ranking Pozos por EBITDA - {entity} ({año})"},
                sql2, 0.85,
            ))
        else:
            # Gerencia/VP: ranking children by EBITDA
            sql1 = self._build_robustez_sql(
                [f"{child} AS {child.lower()}",
                 self._agg_expr(ROBUSTEZ_METRICS["ebitda"]["col"], "SUM", "ebitda_kusd")],
                group_by=[child], where_entity=wf, año=año,
                order_by="ebitda_kusd DESC", limit=15,
            )
            buttons.append(self._make_sql_button(
                f"Ranking {child_label}s por EBITDA - {entity}",
                f"Ranking de {child_label.lower()}s por EBITDA en {entity}",
                "ranking_bar",
                {"x_axis": child.lower(), "y_axis": "ebitda_kusd", "chart_type": "ranking_bar",
                 "title": f"Ranking {child_label}s por EBITDA - {entity} ({año})"},
                sql1, 0.90,
            ))
            # Aceite by child
            sql_aceite = self._build_robustez_sql(
                [f"{child} AS {child.lower()}",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_aceite"]["col"], "SUM", "prod_aceite_bls")],
                group_by=[child], where_entity=wf, año=año,
                order_by="prod_aceite_bls DESC", limit=15,
            )
            buttons.append(self._make_sql_button(
                f"Aceite por {child_label} - {entity}",
                f"Producción de aceite por {child_label.lower()}",
                "bar",
                {"x_axis": child.lower(), "y_axis": "prod_aceite_bls", "chart_type": "bar",
                 "title": f"Aceite por {child_label} - {entity} ({año})",
                 "sort_descending": True, "gradient_color": "#CCD32A", "show_data_labels": True},
                sql_aceite, 0.85,
            ))
            # Agua by child
            sql_agua = self._build_robustez_sql(
                [f"{child} AS {child.lower()}",
                 self._agg_expr(ROBUSTEZ_METRICS["vol_agua"]["col"], "SUM", "prod_agua_bls")],
                group_by=[child], where_entity=wf, año=año,
                order_by="prod_agua_bls DESC", limit=15,
            )
            buttons.append(self._make_sql_button(
                f"Agua por {child_label} - {entity}",
                f"Producción de agua por {child_label.lower()}",
                "bar",
                {"x_axis": child.lower(), "y_axis": "prod_agua_bls", "chart_type": "bar",
                 "title": f"Agua por {child_label} - {entity} ({año})",
                 "sort_descending": True, "gradient_color": "#0d6efd", "show_data_labels": True},
                sql_agua, 0.85,
            ))

        return buttons

    def _build_robustez_categorized_buttons(
        self,
        hierarchy: str,
        entity_ctx: Dict[str, Any],
        existing_dynamic_buttons: List[Dict],
    ) -> List[Dict]:
        """Orchestrator: build all 5 categories with SQL buttons for ROBUSTEZ."""
        generators = {
            "economico": self._build_economico_buttons,
            "clasificacion": self._build_clasificacion_buttons,
            "produccion": self._build_produccion_buttons,
            "temporal": self._build_temporal_buttons,
            "comparativo": self._build_comparativo_buttons,
        }

        categories = []
        for cat_def in ANALYSIS_CATEGORIES:
            generator = generators.get(cat_def["id"])
            cat_buttons = generator(hierarchy, entity_ctx) if generator else []
            categories.append({
                "id": cat_def["id"],
                "label": cat_def["label"],
                "icon": cat_def["icon"],
                "buttons": cat_buttons,
                "enabled": len(cat_buttons) > 0,
            })

        enabled = [c["id"] for c in categories if c["enabled"]]
        logger.info(
            f"🏗️ Built ROBUSTEZ categorized buttons: hierarchy={hierarchy}, "
            f"entity={entity_ctx['entity_name']}, enabled={enabled}"
        )
        return categories

    # ──────────────────────────────────────────────────────────────────────
    #  End ROBUSTEZ Categorized Buttons System
    # ──────────────────────────────────────────────────────────────────────

    def _validate_scale_compatibility(self, columns: List[str], data: pd.DataFrame) -> Dict[str, Any]:
        """
        Validate that columns are compatible for visualization on the same chart
        Returns dict with: compatible (bool), reason (str), suggestions (list)
        """
        if len(columns) <= 1:
            return {'compatible': True, 'reason': 'Single column', 'suggestions': []}

        # Classify all columns
        classifications = {col: self._classify_column_by_unit(col, data) for col in columns}

        # Get unique unit types (excluding dates and categoricals which are allowed)
        metric_types = set([
            c for c in classifications.values()
            if c not in ['date', 'categorical', 'unknown']
        ])

        # Check for incompatible combinations
        incompatible_pairs = [
            ('percentage', 'volume'),
            ('percentage', 'ratio'),
            ('volume', 'count'),
            ('ratio', 'count')
        ]

        for type1, type2 in incompatible_pairs:
            if type1 in metric_types and type2 in metric_types:
                cols_by_type = {
                    type1: [col for col, t in classifications.items() if t == type1],
                    type2: [col for col, t in classifications.items() if t == type2]
                }

                return {
                    'compatible': False,
                    'reason': f'Incompatible units: {type1} ({cols_by_type[type1]}) cannot be mixed with {type2} ({cols_by_type[type2]})',
                    'suggestions': [
                        f'Create separate charts for {type1} metrics: {cols_by_type[type1]}',
                        f'Create separate charts for {type2} metrics: {cols_by_type[type2]}'
                    ],
                    'classifications': classifications
                }

        # Check for too many different unit types
        if len(metric_types) > 2:
            return {
                'compatible': False,
                'reason': f'Too many different unit types: {metric_types}',
                'suggestions': ['Group metrics by unit type and create separate charts'],
                'classifications': classifications
            }

        return {
            'compatible': True,
            'reason': 'All columns compatible',
            'suggestions': [],
            'classifications': classifications
        }

    def _generate_intelligent_chart_title(
        self,
        chart_type: str,
        data: pd.DataFrame,
        config: Dict,
        context: Dict = None
    ) -> str:
        """
        Generate intelligent chart titles based on data characteristics
        - Avoids using "Tendencia" unless there's actual regression analysis
        - Uses specific temporal language (diario/mensual/anual)
        - Includes date ranges when relevant
        - Personalizes based on petroleum metrics
        """
        try:
            # Check if title is already provided in config
            if config.get('title') and config['title'] not in ['undefined', 'Gráfico', 'Chart']:
                return config['title']

            # Detect temporal scope and date range
            date_cols = self._identify_date_columns(data)
            temporal_scope = "temporal"
            date_range_str = ""

            if date_cols and len(date_cols) > 0:
                date_col = date_cols[0]
                try:
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
                except:
                    pass

            # Identify main metrics
            numeric_cols = self._identify_numeric_columns(data)
            categorical_cols = self._identify_categorical_columns(data)

            # Get metric names in Spanish
            metric_names = [self._translate_column_name(col) for col in numeric_cols[:2]]
            category_name = self._translate_column_name(categorical_cols[0]) if categorical_cols else "Categoría"

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

    def _get_chart_color(
        self, chart_type: str, metric_name: str = "", data_context: Dict = None
    ) -> Any:
        """Get appropriate color for chart based on type and petroleum metrics"""
        metric_lower = metric_name.lower() if metric_name else ""

        # Petroleum-specific colors
        if "oil" in metric_lower or "aceite" in metric_lower or "bopd" in metric_lower:
            return self.color_schemes["oil_production"]
        elif "water" in metric_lower or "agua" in metric_lower:
            return self.color_schemes["water_production"]
        elif "gas" in metric_lower:
            return self.color_schemes["gas_production"]
        elif "gor" in metric_lower or "wor" in metric_lower:
            return self.color_schemes["gor_wor"]

        # Chart-type specific colors
        if (
            chart_type in ["bar", "column"]
            and data_context
            and data_context.get("multiple_series")
        ):
            return self.color_schemes["comparison"]
        elif chart_type in ["line", "area"]:
            return self.color_schemes["temporal"]
        elif chart_type == "histogram":
            return self.color_schemes["distribution"]
        elif chart_type == "scatter":
            return self.color_schemes["correlation"][0]

        # Default petroleum color
        return self.color_schemes["petroleum_colors"][0]

    def _get_petroleum_color_palette(self) -> List[str]:
        """Delegate to modular function"""
        return get_petroleum_color_palette()

    def _create_enhanced_title(
        self, base_title: str, chart_type: str, columns: List[str]
    ) -> str:
        """Create enhanced, descriptive title in Spanish"""
        translated_columns = [
            self._translate_column_name(col) for col in columns if col
        ]

        if chart_type == "line":
            if len(translated_columns) == 1:
                return f"Evolución de {translated_columns[0]}"
            else:
                return f"Evolución de {', '.join(translated_columns[:2])}"
        elif chart_type == "bar":
            if len(translated_columns) >= 2:
                return f"{translated_columns[1]} por {translated_columns[0]}"
            else:
                return f"Distribución de {translated_columns[0] if translated_columns else 'Datos'}"
        elif chart_type == "scatter":
            if len(translated_columns) >= 2:
                return (
                    f"Correlación: {translated_columns[1]} vs {translated_columns[0]}"
                )
        elif chart_type == "histogram":
            if translated_columns:
                return f"Distribución de {translated_columns[0]}"
        elif chart_type == "area":
            if translated_columns:
                return f"Producción de {translated_columns[0]} (Área)"

        return base_title or "Gráfico de Datos Petroleros"

    def _store_chart_generation_data(
        self, results_data: pd.DataFrame, analytics_context: Dict
    ):
        """Store data for later chart generation using session storage"""
        logger.info(
            f"💾 _store_chart_generation_data called with {len(results_data)} rows"
        )

        try:
            # Store in both instance and session for persistence across requests
            self.stored_data["results_data"] = results_data.copy()
            self.stored_data["analytics_context"] = analytics_context.copy()
            self.stored_data["last_question"] = analytics_context.get(
                "original_question", ""
            )
            logger.info(f"✅ Stored data in instance successfully")

            # Store in Flask session for persistence
            from flask import session

            logger.info(f"💾 Attempting to store in Flask session...")

            session_id = session.get("user_id", "default")
            data_to_store = {
                "results_data": results_data.to_dict("records"),
                "analytics_context": analytics_context,
                "last_question": analytics_context.get("original_question", ""),
                "timestamp": pd.Timestamp.now().isoformat(),
            }

            # Store in Flask session
            session["analytics_data"] = data_to_store

            # Also store in global cache with session_id as key
            global _analytics_cache
            _analytics_cache[session_id] = data_to_store
            # Always store under "_latest" as fallback key for cross-session access
            # (internal requests.post() from app.py may use different session than browser AJAX)
            _analytics_cache["_latest"] = data_to_store

            logger.info(
                f"📦 Stored chart generation data: {len(results_data)} rows, {len(analytics_context['data_columns'])} columns"
            )
            logger.info(
                f"💾 Data stored in Flask session and global cache (session_id: {session_id})"
            )
            logger.info(f"✅ Dual storage completed successfully")

        except Exception as e:
            logger.error(f"Error storing chart generation data: {e}")
            # Fallback to instance storage only
            self.stored_data["results_data"] = results_data.copy()
            self.stored_data["analytics_context"] = analytics_context.copy()
            self.stored_data["last_question"] = analytics_context.get(
                "original_question", ""
            )

    def _load_data_from_session(self) -> bool:
        """Load stored data from Flask session or global cache"""
        try:
            from flask import session

            session_data = None

            # Try Flask session first
            if "analytics_data" in session:
                session_data = session["analytics_data"]
                logger.info("💾 Found data in Flask session")
            else:
                # Try global cache as fallback
                session_id = session.get("user_id", "default")
                global _analytics_cache

                if session_id in _analytics_cache:
                    session_data = _analytics_cache[session_id]
                    logger.info(
                        f"💾 Found data in global cache for session_id: {session_id}"
                    )
                elif "_latest" in _analytics_cache:
                    # Fallback: use "_latest" key for cross-session access
                    # (internal requests.post() stores under different session_id than browser AJAX)
                    session_data = _analytics_cache["_latest"]
                    logger.info(
                        f"💾 Found data in global cache using '_latest' fallback (session_id mismatch: {session_id})"
                    )
                else:
                    logger.warning(
                        f"💾 No analytics data found in session or cache (session_id: {session_id})"
                    )
                    logger.warning(
                        f"💾 Available cache keys: {list(_analytics_cache.keys())}"
                    )
                    return False

            # Reconstruct DataFrame from session data
            results_data = pd.DataFrame(session_data["results_data"])
            analytics_context = session_data["analytics_context"]
            last_question = session_data["last_question"]

            # Store in instance
            self.stored_data["results_data"] = results_data
            self.stored_data["analytics_context"] = analytics_context
            self.stored_data["last_question"] = last_question

            logger.info(f"💾 Successfully loaded {len(results_data)} rows from session")
            logger.info(f"💾 Last question: {last_question}")
            logger.info(
                f"💾 Data columns: {list(results_data.columns) if not results_data.empty else 'No columns'}"
            )

            return True

        except Exception as e:
            logger.error(f"❌ Error loading data from session: {e}")
            return False

    def generate_chart_from_button(self, button_config: Dict) -> AgentResponse:
        """Generate a specific chart from button configuration"""
        try:
            # Check if this button has custom SQL query
            if button_config.get("is_sql_query") and button_config.get("sql_query"):
                logger.info(
                    f"🔍 Executing custom SQL query for button: {button_config.get('title')}"
                )

                # Execute the custom SQL query
                chart_data = self._execute_button_sql_query(button_config)
                if chart_data is None:
                    return AgentResponse(
                        success=False,
                        content="Error ejecutando consulta SQL personalizada",
                        error="SQL execution failed",
                    )
            else:
                # Use stored data for traditional buttons
                logger.info(
                    f"📦 Using stored data for button: {button_config.get('title')}"
                )

                # Try to load data from instance first, then from session
                if (
                    self.stored_data["results_data"] is None
                    or self.stored_data["results_data"].empty
                ):
                    logger.info(
                        "📦 No data in instance, trying to load from Flask session..."
                    )
                    success = self._load_data_from_session()
                    if not success:
                        return AgentResponse(
                            success=False,
                            content="No hay datos almacenados para generar el gráfico",
                            error="No stored data available",
                        )

                chart_data = self.stored_data["results_data"]

            logger.info(
                f"📊 Generating chart from button: {button_config.get('title', 'Unknown')}"
            )

            # Compute MoM variation % if requested
            # Use a COPY of config to avoid mutating the original button_config
            config_dict = dict(button_config.get("config", {}))
            if config_dict.get("compute_variation_pct"):
                chart_data = self._compute_variation_pct(chart_data, config_dict)
                # Update stored data so followup insight analyzes the actual chart data
                self.stored_data["results_data"] = chart_data

            # Create chart configuration using the appropriate data
            # Convert button_config to recommendation format
            # IMPORTANT: Prioritize chart_type from config if it exists (for frontend-only charts)
            chart_type = config_dict.get("chart_type", button_config.get("chart_type", "bar"))

            logger.info(f"🎯 Detected chart_type: {chart_type}")

            recommendation = {
                "chart_type": chart_type,
                "config": config_dict,
                "title": button_config.get("title", ""),
                "description": button_config.get("description", ""),
            }

            chart_config = self._create_chart_config(chart_data, recommendation)

            if not chart_config:
                return AgentResponse(
                    success=False,
                    content="No se pudo generar la configuración del gráfico",
                    error="Chart configuration failed",
                )

            # Store original button config for year filtering
            chart_config["original_button_config"] = button_config

            self.stats["charts_generated"] += 1
            chart_type = button_config.get("chart_type", "unknown")
            self.stats["chart_types_used"][chart_type] = (
                self.stats["chart_types_used"].get(chart_type, 0) + 1
            )

            return AgentResponse(
                success=True,
                content=f"Gráfico {button_config.get('title', 'generado')} creado exitosamente",
                data={
                    "chart_config": chart_config,
                    "chart_type": chart_type,
                    "data_rows": len(chart_data),
                },
            )

        except Exception as e:
            logger.error(f"Error generating chart from button: {e}")
            return AgentResponse(
                success=False,
                content=f"Error generando gráfico: {str(e)}",
                error=str(e),
            )

    def _execute_button_sql_query(self, button_config: Dict) -> Optional[pd.DataFrame]:
        """Execute SQL query from button configuration and return data"""
        try:
            sql_query = button_config.get("sql_query", "").strip()
            database = button_config.get("database", "ECP_PROD")

            if not sql_query:
                logger.error("No SQL query found in button configuration")
                return None

            logger.info(
                f"🔍 Executing SQL query for '{button_config.get('title')}' on database '{database}'"
            )
            logger.info(f"📝 SQL: {sql_query[:200]}...")

            # Import database manager
            from utils.database import execute_sql_query

            # Execute the SQL query
            result = execute_sql_query(sql_query, database=database)

            if result.get("success") and not result.get("data").empty:
                logger.info(
                    f"✅ SQL executed successfully. Rows: {len(result['data'])}, Columns: {len(result['data'].columns)}"
                )
                logger.info(f"📊 Data columns: {list(result['data'].columns)}")
                logger.info(f"📊 Data types: {result['data'].dtypes.to_dict()}")

                # Store the new data for potential use in followups
                self.stored_data["results_data"] = result["data"]
                self.stored_data["sql_query"] = sql_query
                self.stored_data["database"] = database

                return result["data"]
            else:
                error_msg = result.get("error", "Unknown SQL execution error")
                logger.error(f"❌ SQL execution failed: {error_msg}")
                return None

        except Exception as e:
            logger.error(f"❌ Error executing button SQL query: {e}")
            import traceback

            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return None

    # ── LLM Insight Generation ────────────────────────────────────

    def _summarize_data_for_prompt(
        self, data: pd.DataFrame, button_config: Dict, max_rows: int = 20
    ) -> str:
        """Build a compact text summary of the DataFrame tailored to the chart type."""
        config = button_config.get("config", {})
        chart_type = config.get("chart_type", button_config.get("chart_type", "bar"))
        title = button_config.get("title", "Análisis")
        x_col = config.get("x_axis", "")
        y_col = config.get("y_axis", "")

        # Resolve y_col to first element if list
        if isinstance(y_col, list):
            y_col = y_col[0] if y_col else ""

        lines = [
            f"Tipo de gráfico: {chart_type}",
            f"Título: {title}",
            f"Eje X: {x_col}",
            f"Eje Y: {y_col}",
            f"Total registros: {len(data)}",
            "",
        ]

        if chart_type in ("bar", "ranking_bar", "horizontal_comparison_bar", "grouped_bar"):
            # Bar: category → value table sorted desc
            if x_col in data.columns and y_col in data.columns:
                sorted_df = data[[x_col, y_col]].dropna().sort_values(y_col, ascending=False).head(max_rows)
                lines.append("Datos (mayor a menor):")
                for _, row in sorted_df.iterrows():
                    lines.append(f"  {row[x_col]}: {row[y_col]:,.2f}" if isinstance(row[y_col], (int, float)) else f"  {row[x_col]}: {row[y_col]}")
                vals = data[y_col].dropna()
                if len(vals) > 0:
                    lines.append(f"\nTotal: {vals.sum():,.2f}")
                    lines.append(f"Promedio: {vals.mean():,.2f}")
                    lines.append(f"Máximo: {vals.max():,.2f} ({data.loc[vals.idxmax(), x_col] if x_col in data.columns else ''})")
                    lines.append(f"Mínimo: {vals.min():,.2f} ({data.loc[vals.idxmin(), x_col] if x_col in data.columns else ''})")

        elif chart_type in ("line", "multi_line", "area"):
            # Line: x range + y summary
            if x_col in data.columns and y_col in data.columns:
                lines.append(f"Rango X: {data[x_col].iloc[0]} a {data[x_col].iloc[-1]}")
                vals = data[y_col].dropna()
                if len(vals) > 0:
                    lines.append(f"Valor inicio: {vals.iloc[0]:,.2f}")
                    lines.append(f"Valor fin: {vals.iloc[-1]:,.2f}")
                    lines.append(f"Máximo: {vals.max():,.2f}")
                    lines.append(f"Mínimo: {vals.min():,.2f}")
                    lines.append(f"Promedio: {vals.mean():,.2f}")
                lines.append("\nDatos:")
                for _, row in data[[x_col, y_col]].head(max_rows).iterrows():
                    lines.append(f"  {row[x_col]}: {row[y_col]:,.2f}" if isinstance(row[y_col], (int, float)) else f"  {row[x_col]}: {row[y_col]}")

        elif chart_type == "pie":
            # Pie: category + value + percentage
            if x_col in data.columns and y_col in data.columns:
                total = data[y_col].sum()
                sorted_df = data[[x_col, y_col]].dropna().sort_values(y_col, ascending=False).head(max_rows)
                lines.append("Segmentos:")
                for _, row in sorted_df.iterrows():
                    pct = (row[y_col] / total * 100) if total else 0
                    lines.append(f"  {row[x_col]}: {row[y_col]:,.2f} ({pct:.1f}%)")

        else:
            # Generic fallback
            numeric_cols = [c for c in data.columns if pd.api.types.is_numeric_dtype(data[c])]
            lines.append(f"Columnas: {', '.join(data.columns.tolist())}")
            for col in numeric_cols[:3]:
                vals = data[col].dropna()
                if len(vals) > 0:
                    lines.append(f"  {col}: sum={vals.sum():,.2f}, avg={vals.mean():,.2f}, max={vals.max():,.2f}")

        return "\n".join(lines)

    def _build_insight_prompt(
        self, data_summary: str, chart_type: str, title: str, question: str
    ) -> str:
        """Build the LLM prompt for chart insight generation."""
        return (
            "Eres un analista senior de producción petrolera de Ecopetrol.\n"
            "Analiza los siguientes datos y genera un insight conciso para ejecutivos no técnicos.\n\n"
            f"CONTEXTO:\n"
            f"- Pregunta del usuario: {question}\n"
            f"- Visualización: {title} (tipo: {chart_type})\n\n"
            f"DATOS:\n{data_summary}\n\n"
            "INSTRUCCIONES:\n"
            "1. Escribe EXACTAMENTE 2-3 oraciones en español que describan los hallazgos principales.\n"
            '2. Usa etiquetas HTML <span class="badge bg-primary">VALOR</span> para destacar los 2-3 valores más importantes.\n'
            '3. Usa <span class="badge bg-success">VALOR</span> para valores positivos o destacados.\n'
            '4. Usa <span class="badge bg-danger">VALOR</span> para valores críticos o los más bajos.\n'
            "5. NO inventes datos. SOLO usa los números proporcionados.\n"
            "6. NO expliques causas ni hagas recomendaciones.\n"
            "7. NO uses listas, viñetas, títulos ni encabezados. Escribe prosa fluida.\n"
            "8. Responde SOLAMENTE con el texto del insight.\n"
            "9. Formatea números grandes con separadores de miles (ej: 125,430.5).\n"
            "10. Las siglas GOR,GAA,GLH,GNS,GRM,GPA,GTA,DFL,GCT,GAN,PRP,CPV,GCH corresponden a Gerencias.\n\n"
            "EJEMPLO DE FORMATO:\n"
            'La gerencia GOR lidera con <span class="badge bg-primary">125,430 BOPD</span>, '
            "representando el 28% del total. El rango de producción entre gerencias va desde "
            '<span class="badge bg-danger">12,340 BOPD</span> hasta el máximo, con un promedio de '
            '<span class="badge bg-success">59,348 BOPD</span>.\n'
        )

    def _generate_llm_insight(self, prompt: str) -> Optional[str]:
        """Call Ollama to generate chart insight."""
        try:
            from chatbot.core.llm_manager import llm_manager
        except ImportError:
            logger.warning("llm_manager not available for insights")
            return None

        if llm_manager.is_available():
            try:
                response = llm_manager.generate_response(
                    prompt=prompt,
                    temperature=0.3,
                    max_tokens=400,
                )
                if response:
                    return response.strip()
            except Exception as exc:
                logger.error("Ollama insight failed: %s", exc)

        return None

    def _build_static_fallback_insight(
        self, data: pd.DataFrame, button_config: Optional[Dict] = None
    ) -> str:
        """Build a static HTML insight when LLM is unavailable."""
        numeric_cols = [c for c in data.columns if pd.api.types.is_numeric_dtype(data[c])]
        if not numeric_cols:
            return f"Dataset con {len(data):,} registros y {len(data.columns)} columnas disponibles para análisis."

        # Pick the primary metric from config or first numeric col
        primary_col = numeric_cols[0]
        if button_config:
            config_inner = button_config.get("config", {})
            y_axis = config_inner.get("y_axis")
            # If variation was computed, prefer the variation column
            if config_inner.get("compute_variation_pct") and isinstance(y_axis, str):
                var_col = f"variacion_pct_{y_axis}"
                if var_col in numeric_cols:
                    y_axis = var_col
            if isinstance(y_axis, list) and y_axis and y_axis[0] in numeric_cols:
                primary_col = y_axis[0]
            elif isinstance(y_axis, str) and y_axis in numeric_cols:
                primary_col = y_axis

        vals = data[primary_col].dropna()
        if len(vals) == 0:
            return f"Dataset con {len(data):,} registros disponibles para análisis."

        # Use a human-readable label
        display_name = self._translate_column_name(primary_col)
        is_pct = "variacion_pct" in primary_col or "pct" in primary_col.lower()

        total = vals.sum()
        avg = vals.mean()
        max_val = vals.max()
        suffix = "%" if is_pct else ""

        return (
            f'La variación promedio de {display_name} es <span class="badge bg-primary">{avg:,.1f}{suffix}</span>, '
            f'con un máximo de <span class="badge bg-success">{max_val:,.1f}{suffix}</span> '
            f'y un mínimo de <span class="badge bg-danger">{vals.min():,.1f}{suffix}</span> '
            f"en {len(data):,} períodos analizados."
        ) if is_pct else (
            f'El total de {display_name} es <span class="badge bg-primary">{total:,.1f}</span>, '
            f'con un promedio de <span class="badge bg-success">{avg:,.1f}</span> '
            f'y un valor máximo de <span class="badge bg-primary">{max_val:,.1f}</span> '
            f"en un dataset de {len(data):,} registros."
        )

    def get_followup_content_for_panel3(
        self, button_config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Get content to be displayed below charts in Panel 3, with LLM-generated insight."""
        if self.stored_data["results_data"] is None:
            self._load_data_from_session()

        if self.stored_data["results_data"] is not None:
            data = self.stored_data["results_data"]
            data_rows = len(data)
            data_cols = len(data.columns)

            llm_insight_html = None

            if button_config:
                try:
                    # If compute_variation_pct was applied, adjust config for insight
                    insight_button_config = button_config
                    config_dict = button_config.get("config", {})
                    if config_dict.get("compute_variation_pct"):
                        y_orig = config_dict.get("y_axis", "")
                        var_col = f"variacion_pct_{y_orig}"
                        if var_col in data.columns:
                            insight_button_config = dict(button_config)
                            insight_button_config["config"] = dict(config_dict)
                            insight_button_config["config"]["y_axis"] = var_col

                    data_summary = self._summarize_data_for_prompt(data, insight_button_config)
                    chart_type = config_dict.get("chart_type", button_config.get("chart_type", "bar"))
                    title = button_config.get("title", "Análisis de datos")
                    question = self.stored_data.get("last_question", "")

                    prompt = self._build_insight_prompt(data_summary, chart_type, title, question)
                    llm_insight_html = self._generate_llm_insight(prompt)

                    if llm_insight_html:
                        logger.info("✅ LLM insight generated for: %s", title)
                    else:
                        logger.warning("⚠️ LLM insight returned None for: %s", title)
                except Exception as exc:
                    logger.error("❌ Error generating LLM insight: %s", exc)

            if not llm_insight_html:
                llm_insight_html = self._build_static_fallback_insight(data, button_config)

            return {
                "success": True,
                "llm_insight_html": llm_insight_html,
                "insights": [
                    f"Análisis basado en {data_rows:,} registros",
                    f"Dataset con {data_cols} variables disponibles",
                ],
                "recommendations": [],
            }
        else:
            return {"success": False, "llm_insight_html": None, "insights": [], "recommendations": []}


# Factory function
def create_analytics_agent(
    config_path: str = "config/master_prompts.yaml",
) -> AnalyticsAgent:
    """Create an analytics agent instance"""
    return AnalyticsAgent(config_path)

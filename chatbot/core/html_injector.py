"""
Unified HTML Injection System for ECP Insights
Handles dynamic HTML generation based on query results and context
"""

import logging
import json
import yaml
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from pathlib import Path
import pandas as pd
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class RenderContext:
    """Context for HTML rendering"""
    data: Union[pd.DataFrame, List[Dict], Dict]
    query_type: str
    agent_type: str
    database: str
    user_query: str
    sql_query: Optional[str] = None
    insights: List[str] = None
    metrics: Dict[str, Any] = None


@dataclass
class HTMLComponent:
    """HTML component with metadata"""
    html: str
    component_type: str
    priority: int
    css_classes: List[str]
    js_dependencies: List[str] = None


class HTMLInjector:
    """
    Unified HTML injection system that converts query results 
    into appropriate HTML components for the frontend
    """
    
    def __init__(self, config_path: str = "config/master_prompts.yaml"):
        """Initialize HTML Injector"""
        self.config_path = config_path
        self.templates = self._load_templates()
        self.component_registry = self._initialize_components()
        
        logger.info("HTMLInjector initialized")

    def _load_templates(self) -> Dict[str, Any]:
        """Load HTML templates from configuration"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                
            return config.get('html_templates', {})
            
        except Exception as e:
            logger.error(f"Error loading HTML templates: {e}")
            return self._get_default_templates()

    def _get_default_templates(self) -> Dict[str, Any]:
        """Get default HTML templates"""
        return {
            "metrics_table": {
                "template": """
                <div class="metrics-table-container">
                    <h3>{table_title}</h3>
                    <table class="petroleum-metrics-table">
                        <thead><tr>{table_headers}</tr></thead>
                        <tbody>{table_rows}</tbody>
                    </table>
                    <div class="table-insights">{insights}</div>
                </div>
                """
            },
            "trend_chart": {
                "template": """
                <div class="trend-chart-container">
                    <h3>{chart_title}</h3>
                    <div id="{chart_id}" class="plotly-chart"></div>
                    <div class="chart-insights">{chart_insights}</div>
                </div>
                """
            },
            "ranking_cards": {
                "template": """
                <div class="ranking-cards-container">
                    <h3>{ranking_title}</h3>
                    <div class="cards-grid">{ranking_cards}</div>
                </div>
                """
            }
        }

    def _initialize_components(self) -> Dict[str, Any]:
        """Initialize component registry"""
        return {
            "data_table": {
                "priority": 1,
                "css_classes": ["data-table", "petroleum-data"],
                "js_dependencies": []
            },
            "metrics_summary": {
                "priority": 2, 
                "css_classes": ["metrics-summary", "petroleum-metrics"],
                "js_dependencies": []
            },
            "chart_container": {
                "priority": 3,
                "css_classes": ["chart-container", "petroleum-chart"],
                "js_dependencies": ["plotly"]
            },
            "insight_cards": {
                "priority": 4,
                "css_classes": ["insight-cards", "petroleum-insights"],
                "js_dependencies": []
            }
        }

    def render_panel_1(self, context: RenderContext) -> List[HTMLComponent]:
        """Render Panel 1 (Main Results)"""
        try:
            components = []
            
            # Determine rendering strategy based on data and query type
            if isinstance(context.data, (list, pd.DataFrame)) and len(context.data) > 0:
                # Data table component
                table_component = self._render_data_table(context)
                if table_component:
                    components.append(table_component)
                
                # Metrics summary if applicable
                metrics_component = self._render_metrics_summary(context)
                if metrics_component:
                    components.append(metrics_component)

                # Insights component removed - no contextual analysis needed
                    
            else:
                # No data - render empty state
                components.append(self._render_empty_state(context))
            
            return sorted(components, key=lambda x: x.priority)
            
        except Exception as e:
            logger.error(f"Error rendering Panel 1: {e}")
            return [self._render_error_state(str(e))]

    def render_panel_2(self, suggestions: List[Dict], insights: List[str]) -> List[HTMLComponent]:
        """Render Panel 2 (Follow-up Suggestions)"""
        try:
            components = []
            
            # Suggestions component
            if suggestions:
                suggestions_component = self._render_suggestions(suggestions)
                components.append(suggestions_component)
            
            # Additional insights
            if insights:
                insights_component = self._render_additional_insights(insights)
                components.append(insights_component)
                
            return components
            
        except Exception as e:
            logger.error(f"Error rendering Panel 2: {e}")
            return [self._render_error_state(str(e))]

    def render_panel_3(self, chart_recommendations: List[Dict], auto_charts: List[Dict]) -> List[HTMLComponent]:
        """Render Panel 3 (Analytics and Charts)"""
        try:
            components = []
            
            # Chart recommendations
            if chart_recommendations:
                chart_rec_component = self._render_chart_recommendations(chart_recommendations)
                components.append(chart_rec_component)
            
            # Auto-generated charts
            if auto_charts:
                auto_charts_component = self._render_auto_charts(auto_charts)
                components.append(auto_charts_component)
                
            return components
            
        except Exception as e:
            logger.error(f"Error rendering Panel 3: {e}")
            return [self._render_error_state(str(e))]

    def _render_data_table(self, context: RenderContext) -> Optional[HTMLComponent]:
        """Render data as HTML table"""
        try:
            data = context.data
            
            # Convert to DataFrame if needed
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = data.copy()
                
            if df.empty:
                return None
                
            # Determine table style based on query type and database
            table_class = self._get_table_class(context)
            
            # Format columns for petroleum data
            df_formatted = self._format_petroleum_data(df, context.database)
            
            # Generate table HTML
            table_html = self._generate_table_html(df_formatted, table_class, context)
            
            return HTMLComponent(
                html=table_html,
                component_type="data_table",
                priority=1,
                css_classes=["data-table", table_class]
            )
            
        except Exception as e:
            logger.error(f"Error rendering data table: {e}")
            return None

    def _render_metrics_summary(self, context: RenderContext) -> Optional[HTMLComponent]:
        """Render metrics summary cards"""
        try:
            if not context.metrics:
                return None
                
            metrics_html = self._generate_metrics_cards(context.metrics, context.database)
            
            return HTMLComponent(
                html=metrics_html,
                component_type="metrics_summary",
                priority=2,
                css_classes=["metrics-summary", "petroleum-metrics"]
            )
            
        except Exception as e:
            logger.error(f"Error rendering metrics summary: {e}")
            return None

    def _render_insights(self, context: RenderContext) -> Optional[HTMLComponent]:
        """Render insights and analysis"""
        try:
            if not context.insights:
                return None
                
            insights_html = self._generate_insights_html(context.insights)
            
            return HTMLComponent(
                html=insights_html,
                component_type="insights",
                priority=4,
                css_classes=["insight-cards", "petroleum-insights"]
            )
            
        except Exception as e:
            logger.error(f"Error rendering insights: {e}")
            return None

    def _render_suggestions(self, suggestions: List[Dict]) -> HTMLComponent:
        """Render follow-up suggestions"""
        try:
            suggestions_html = f"""
            <div class="suggestions-container">
                <h4>💡 Análisis Adicionales</h4>
                <div class="suggestions-grid">
            """
            
            for suggestion in suggestions[:8]:  # Limit to 8
                icon = suggestion.get('icon', '📊')
                question = suggestion.get('question', '')
                description = suggestion.get('description', '')
                category = suggestion.get('category', 'general')
                
                suggestions_html += f"""
                <div class="suggestion-card" data-category="{category}">
                    <div class="suggestion-icon">{icon}</div>
                    <div class="suggestion-content">
                        <h5>{question}</h5>
                        <p>{description}</p>
                    </div>
                    <button class="suggestion-btn" onclick="executeFollowup('{question}')">
                        Analizar
                    </button>
                </div>
                """
                
            suggestions_html += """
                </div>
            </div>
            """
            
            return HTMLComponent(
                html=suggestions_html,
                component_type="suggestions",
                priority=1,
                css_classes=["suggestions-container", "petroleum-suggestions"],
                js_dependencies=["followup-handler"]
            )
            
        except Exception as e:
            logger.error(f"Error rendering suggestions: {e}")
            return self._render_error_state(str(e))

    def _render_chart_recommendations(self, chart_recommendations: List[Dict]) -> HTMLComponent:
        """Render chart recommendations"""
        try:
            charts_html = f"""
            <div class="chart-recommendations-container">
                <h4>📈 Visualizaciones Recomendadas</h4>
                <div class="chart-recommendations-grid">
            """
            
            for chart in chart_recommendations[:6]:  # Limit to 6
                chart_type = chart.get('chart_type', 'bar')
                title = chart.get('title', 'Gráfico')
                description = chart.get('description', '')
                
                chart_icon = self._get_chart_icon(chart_type)
                
                charts_html += f"""
                <div class="chart-recommendation-card" data-chart-type="{chart_type}">
                    <div class="chart-icon">{chart_icon}</div>
                    <div class="chart-info">
                        <h5>{title}</h5>
                        <p>{description}</p>
                    </div>
                    <button class="chart-btn" onclick="generateChart('{chart_type}', '{title}')">
                        Generar
                    </button>
                </div>
                """
                
            charts_html += """
                </div>
            </div>
            """
            
            return HTMLComponent(
                html=charts_html,
                component_type="chart_recommendations",
                priority=1,
                css_classes=["chart-recommendations", "petroleum-charts"],
                js_dependencies=["chart-generator", "plotly"]
            )
            
        except Exception as e:
            logger.error(f"Error rendering chart recommendations: {e}")
            return self._render_error_state(str(e))

    def _format_petroleum_data(self, df: pd.DataFrame, database: str) -> pd.DataFrame:
        """Format petroleum data for display"""
        try:
            df_formatted = df.copy()
            
            # Format numeric columns based on petroleum units
            for column in df_formatted.columns:
                col_lower = column.lower()
                
                if any(keyword in col_lower for keyword in ['oil_volume', 'petróleo', 'crudo', 'bopd']):
                    # Oil volume - format as bbl/day or BOPD
                    if df_formatted[column].dtype in ['float64', 'int64']:
                        df_formatted[column] = df_formatted[column].apply(
                            lambda x: f"{x:,.1f} bbl/day" if pd.notna(x) else "-"
                        )
                        
                elif any(keyword in col_lower for keyword in ['water', 'agua']):
                    # Water volume - format as bbl/day
                    if df_formatted[column].dtype in ['float64', 'int64']:
                        df_formatted[column] = df_formatted[column].apply(
                            lambda x: f"{x:,.1f} bbl/day" if pd.notna(x) else "-"
                        )
                        
                elif any(keyword in col_lower for keyword in ['gas']):
                    # Gas volume - format as MSCF/day
                    if df_formatted[column].dtype in ['float64', 'int64']:
                        df_formatted[column] = df_formatted[column].apply(
                            lambda x: f"{x:,.1f} MSCF/day" if pd.notna(x) else "-"
                        )
                        
                elif 'gor' in col_lower:
                    # GOR - format as scf/bbl
                    if df_formatted[column].dtype in ['float64', 'int64']:
                        df_formatted[column] = df_formatted[column].apply(
                            lambda x: f"{x:,.1f} scf/bbl" if pd.notna(x) else "-"
                        )
                        
                elif 'wor' in col_lower:
                    # WOR - format as ratio
                    if df_formatted[column].dtype in ['float64', 'int64']:
                        df_formatted[column] = df_formatted[column].apply(
                            lambda x: f"{x:.3f}" if pd.notna(x) else "-"
                        )
                        
                elif any(keyword in col_lower for keyword in ['fecha', 'date', 'datetime']):
                    # Format dates
                    try:
                        df_formatted[column] = pd.to_datetime(df_formatted[column]).dt.strftime('%d/%m/%Y')
                    except:
                        pass
                        
            return df_formatted
            
        except Exception as e:
            logger.error(f"Error formatting petroleum data: {e}")
            return df

    def _generate_table_html(self, df: pd.DataFrame, table_class: str, context: RenderContext) -> str:
        """Generate enhanced HTML table with better formatting and interactivity"""
        try:
            # Table title based on context
            title = self._generate_table_title(context)

            # Generate summary statistics for numeric columns - DISABLED (user request)
            # summary_stats = self._generate_summary_statistics(df)
            summary_stats = ""  # Disabled: user requested to remove statistical summary

            # Table headers with icons and tooltips
            headers = ""
            for col in df.columns:
                icon = self._get_column_icon(col)
                tooltip = self._get_column_tooltip(col)
                headers += f'<th title="{tooltip}" class="sortable-header">{icon} {col}</th>'

            # Table rows — show first 5 in chat, rest hidden (visible in fullscreen)
            max_preview_rows = 5
            max_fullscreen_rows = 100  # Safety limit for DOM size
            rows = ""
            for i, (idx, row) in enumerate(df.iterrows()):
                if i >= max_fullscreen_rows:
                    break
                row_class = "even-row" if i % 2 == 0 else "odd-row"
                if i >= max_preview_rows:
                    row_class += " hidden-row"
                row_cells = ""

                for col, val in row.items():
                    cell_class = self._get_cell_class(col, val)
                    formatted_val = self._format_cell_value(col, val)
                    row_cells += f'<td class="{cell_class}">{formatted_val}</td>'

                rows += f'<tr class="{row_class}">{row_cells}</tr>'

            # "More rows" indicator (hidden in fullscreen via CSS)
            rendered_rows = min(len(df), max_fullscreen_rows)
            remaining = len(df) - max_preview_rows
            more_rows_html = ""
            if remaining > 0:
                export_note = " — exportar para ver todos" if len(df) > max_fullscreen_rows else ""
                more_rows_html = f'''
                <div class="table-more-rows" style="text-align:center; padding:8px; color:#666; font-size:0.85rem; border-top:1px solid #e0e0e0;">
                    <i class="fas fa-ellipsis-h"></i> {remaining:,} registros adicionales{export_note}
                </div>
                '''

            # Pagination controls if dataset is large
            pagination_html = ""
            if len(df) > 20:
                pagination_html = self._generate_pagination_controls(len(df))

            table_html = f"""
            <div class="table-container {table_class}">
                <div class="table-header">
                    <h3 class="table-title">{title}</h3>
                    <div class="table-controls">
                        <div class="table-info">
                            <span class="record-count">
                                <i class="fas fa-database"></i> {len(df):,} registros
                            </span>
                            <span class="database-source">
                                <i class="fas fa-server"></i> {context.database.upper()}
                            </span>
                        </div>
                        <div class="table-actions">
                            <button class="btn-icon" onclick="exportTableToCSV(this)" title="Exportar a CSV">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn-icon fullscreen-toggle" onclick="toggleFullscreen(this)" title="Pantalla completa">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {summary_stats}

                <div class="table-responsive">
                    <table class="petroleum-data-table enhanced-table" data-rows="{len(df)}">
                        <thead>
                            <tr>{headers}</tr>
                        </thead>
                        <tbody>{rows}</tbody>
                    </table>
                </div>

                {more_rows_html}

                {pagination_html}

                <div class="table-footer">
                    <small class="text-muted">
                        <i class="fas fa-info-circle"></i>
                        Haz clic en los encabezados para ordenar.
                        {len(df.columns)} columnas mostradas.
                    </small>
                </div>
            </div>
            """

            return table_html

        except Exception as e:
            logger.error(f"Error generating table HTML: {e}")
            return f"<div class='error'><i class='fas fa-exclamation-triangle'></i> Error generando tabla: {str(e)}</div>"

    def _get_table_class(self, context: RenderContext) -> str:
        """Get appropriate CSS class for table"""
        if context.database == "datagenesis":
            return "datagenesis-table"
        elif context.database == "ecp_prod":
            return "ecp-prod-table"
        else:
            return "general-table"

    def _generate_table_title(self, context: RenderContext) -> str:
        """Generate appropriate table title"""
        if context.database == "datagenesis":
            return "Datos de Producción Diaria"
        elif context.database == "ecp_prod":
            # Detect if it's monthly 2025 data (PROD_2025) or annual data (PROD_2023/2024/2025)
            # Ensure data is a DataFrame before checking columns
            if isinstance(context.data, pd.DataFrame):
                df = context.data
                has_producto = any("producto" in col.lower() for col in df.columns)
                monthly_columns = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
                has_monthly_cols = any(any(month in col.lower() for month in monthly_columns) for col in df.columns)

                # Also check if it's 2025 data based on Anio column
                has_anio_2025 = False
                if 'anio' in [c.lower() for c in df.columns] or 'año' in [c.lower() for c in df.columns]:
                    try:
                        anio_col = [c for c in df.columns if c.lower() in ['anio', 'año']][0]
                        has_anio_2025 = any(df[anio_col].astype(str).str.contains('2025', na=False))
                    except:
                        pass

                if has_producto or has_monthly_cols or has_anio_2025:
                    return "Datos de Producción Mensual (2025)"

            return "Datos de Producción Anual (BOPD)"
        else:
            return "Resultados de Consulta"

    def _generate_summary_statistics(self, df: pd.DataFrame) -> str:
        """Generate summary statistics for numeric columns"""
        try:
            numeric_cols = df.select_dtypes(include=['float64', 'float32', 'int64', 'int32']).columns

            if len(numeric_cols) == 0:
                return ""

            stats_html = '<div class="table-summary-stats">'
            stats_html += '<h5><i class="fas fa-chart-bar"></i> Resumen Estadístico</h5>'
            stats_html += '<div class="stats-grid">'

            # Show stats for up to 3 most important numeric columns
            for col in numeric_cols[:3]:
                col_data = df[col].dropna()
                if len(col_data) > 0:
                    stats_html += f'''
                    <div class="stat-card">
                        <div class="stat-label">{col}</div>
                        <div class="stat-values">
                            <span class="stat-item">
                                <small>Promedio:</small> <strong>{col_data.mean():,.1f}</strong>
                            </span>
                            <span class="stat-item">
                                <small>Máx:</small> <strong>{col_data.max():,.1f}</strong>
                            </span>
                            <span class="stat-item">
                                <small>Mín:</small> <strong>{col_data.min():,.1f}</strong>
                            </span>
                        </div>
                    </div>
                    '''

            stats_html += '</div></div>'
            return stats_html

        except Exception as e:
            logger.error(f"Error generating summary statistics: {e}")
            return ""

    def _get_column_icon(self, col: str) -> str:
        """Get appropriate icon for column type"""
        col_lower = col.lower()

        if any(keyword in col_lower for keyword in ['oil', 'petróleo', 'crudo', 'bopd']):
            return '<i class="fas fa-oil-can" style="color: #1f4e79;"></i>'
        elif any(keyword in col_lower for keyword in ['water', 'agua']):
            return '<i class="fas fa-tint" style="color: #0099cc;"></i>'
        elif any(keyword in col_lower for keyword in ['gas']):
            return '<i class="fas fa-fire" style="color: #ff5f00;"></i>'
        elif any(keyword in col_lower for keyword in ['gor', 'wor']):
            return '<i class="fas fa-percent" style="color: #f7db17;"></i>'
        elif any(keyword in col_lower for keyword in ['fecha', 'date', 'año', 'year']):
            return '<i class="fas fa-calendar"></i>'
        elif any(keyword in col_lower for keyword in ['campo', 'field', 'pozo', 'well']):
            return '<i class="fas fa-map-marker-alt"></i>'
        elif any(keyword in col_lower for keyword in ['gerencia', 'vicepresidencia', 'management']):
            return '<i class="fas fa-building"></i>'
        else:
            return '<i class="fas fa-table"></i>'

    def _get_column_tooltip(self, col: str) -> str:
        """Get tooltip description for column"""
        col_lower = col.lower()

        tooltips = {
            'oil_volume': 'Volumen de producción de petróleo (bbl/day)',
            'bopd': 'Barriles de petróleo por día (promedio anual)',
            'water': 'Volumen de producción de agua (bbl/day)',
            'gas': 'Volumen de producción de gas (MSCF/day)',
            'gor': 'Relación Gas-Aceite (scf/bbl)',
            'wor': 'Relación Agua-Aceite (ratio)',
            'campo': 'Nombre del campo petrolero',
            'pozo': 'Nombre del pozo',
            'well_common_name': 'Nombre común del pozo',
            'field_name': 'Nombre del campo',
            'gerencia': 'Gerencia responsable',
            'vicepresidencia': 'Vicepresidencia',
            'año': 'Año de producción',
            'participacion': 'Porcentaje de participación'
        }

        for key, tooltip in tooltips.items():
            if key in col_lower:
                return tooltip

        return f'Columna: {col}'

    def _get_cell_class(self, col: str, val) -> str:
        """Get CSS class for cell based on value and column type"""
        col_lower = col.lower()
        classes = []

        # Numeric highlighting
        if isinstance(val, (int, float)) and not pd.isna(val):
            classes.append('numeric-cell')

            # Highlight high/low values for petroleum metrics
            if any(keyword in col_lower for keyword in ['oil', 'bopd', 'gas', 'produccion']):
                if val > 10000:
                    classes.append('high-value')
                elif val < 100:
                    classes.append('low-value')

            # Highlight ratios
            if 'gor' in col_lower and val > 1000:
                classes.append('alert-value')
            if 'wor' in col_lower and val > 3:
                classes.append('alert-value')

        # String cells
        elif isinstance(val, str):
            classes.append('text-cell')

        # Date cells
        if any(keyword in col_lower for keyword in ['fecha', 'date', 'año']):
            classes.append('date-cell')

        return ' '.join(classes)

    # Month number → Spanish month name mapping
    MESES_ES = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }

    def _format_cell_value(self, col: str, val) -> str:
        """Format cell value for display"""
        if pd.isna(val) or val is None or val == 'None':
            return '<span class="null-value">—</span>'

        # Month number → month name for MES column
        if col.strip().upper() == "MES":
            try:
                mes_num = int(val)
                if 1 <= mes_num <= 12:
                    return self.MESES_ES[mes_num]
            except (ValueError, TypeError):
                pass

        col_lower = col.lower()

        # Numeric formatting with thousands separator
        if isinstance(val, (int, float)):
            # Different formatting for different metrics
            if 'gor' in col_lower or 'wor' in col_lower:
                return f'{val:,.2f}'
            elif 'participacion' in col_lower or 'pct' in col_lower:
                return f'{val:.1f}%'
            elif any(keyword in col_lower for keyword in ['oil', 'bopd', 'water', 'gas', 'produccion', 'volumen']):
                return f'{val:,.1f}'
            else:
                return f'{val:,.0f}' if val == int(val) else f'{val:,.1f}'

        # Date formatting
        if isinstance(val, pd.Timestamp):
            return val.strftime('%d/%m/%Y')

        # Do not truncate long text for narrative columns
        if isinstance(val, str):
            if any(key in col_lower for key in ["pozo_comment", "comentario", "comentarios", "resumen"]):
                return f'<span class="text-wrap">{val}</span>'
            if len(val) > 50:
                return f'<span title="{val}">{val[:47]}...</span>'

        return str(val)

    def _generate_pagination_controls(self, total_rows: int) -> str:
        """Generate pagination controls for large datasets"""
        pages = (total_rows // 20) + 1

        return f'''
        <div class="table-pagination">
            <div class="pagination-info">
                Mostrando <span id="current-range">1-20</span> de {total_rows:,} registros
            </div>
            <div class="pagination-controls">
                <button class="btn-pagination" onclick="previousPage(this)" disabled>
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
                <span class="page-indicator">Página <span id="current-page">1</span> de {pages}</span>
                <button class="btn-pagination" onclick="nextPage(this)">
                    Siguiente <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
        '''

    def _generate_metrics_cards(self, metrics: Dict[str, Any], database: str) -> str:
        """Generate metrics summary cards"""
        try:
            cards_html = '<div class="metrics-cards">'
            
            for key, value in metrics.items():
                if isinstance(value, (int, float)):
                    formatted_value = f"{value:,.1f}" if isinstance(value, float) else f"{value:,}"
                    
                    cards_html += f"""
                    <div class="metric-card">
                        <div class="metric-label">{key.replace('_', ' ').title()}</div>
                        <div class="metric-value">{formatted_value}</div>
                    </div>
                    """
                    
            cards_html += '</div>'
            
            return cards_html
            
        except Exception as e:
            logger.error(f"Error generating metrics cards: {e}")
            return ""

    def _generate_insights_html(self, insights: List[str]) -> str:
        """Generate insights HTML"""
        try:
            insights_html = f"""
            <div class="insights-container">
                <h4>🔍 Análisis de Resultados</h4>
                <div class="insights-list">
            """
            
            for insight in insights:
                insights_html += f"""
                <div class="insight-item">
                    <span class="insight-bullet">•</span>
                    <span class="insight-text">{insight}</span>
                </div>
                """
                
            insights_html += """
                </div>
            </div>
            """
            
            return insights_html
            
        except Exception as e:
            logger.error(f"Error generating insights HTML: {e}")
            return ""

    def _get_chart_icon(self, chart_type: str) -> str:
        """Get icon for chart type"""
        icons = {
            "bar": "📊",
            "line": "📈", 
            "pie": "🥧",
            "scatter": "⚬",
            "histogram": "📊",
            "area": "📈",
            "heatmap": "🗺️"
        }
        
        return icons.get(chart_type, "📊")

    def _render_empty_state(self, context: RenderContext) -> HTMLComponent:
        """Render empty state when no data"""
        empty_html = f"""
        <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>No se encontraron datos</h3>
            <p>Tu consulta no devolvió resultados. Intenta:</p>
            <ul>
                <li>Modificar los filtros de fecha</li>
                <li>Usar términos más generales</li>
                <li>Verificar la ortografía</li>
            </ul>
        </div>
        """
        
        return HTMLComponent(
            html=empty_html,
            component_type="empty_state",
            priority=1,
            css_classes=["empty-state"]
        )

    def _render_error_state(self, error_message: str) -> HTMLComponent:
        """Render error state"""
        error_html = f"""
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <h3>Error en el procesamiento</h3>
            <p>{error_message}</p>
        </div>
        """
        
        return HTMLComponent(
            html=error_html,
            component_type="error_state", 
            priority=1,
            css_classes=["error-state"]
        )

    def _render_additional_insights(self, insights: List[str]) -> HTMLComponent:
        """Render additional insights for Panel 2"""
        insights_html = f"""
        <div class="additional-insights-container">
            <h4>💭 Contexto Adicional</h4>
            <div class="insights-list">
        """
        
        for insight in insights:
            insights_html += f"""
            <div class="insight-item">
                <span class="insight-bullet">•</span>
                <span class="insight-text">{insight}</span>
            </div>
            """
            
        insights_html += """
            </div>
        </div>
        """
        
        return HTMLComponent(
            html=insights_html,
            component_type="additional_insights",
            priority=2,
            css_classes=["additional-insights"]
        )

    def _render_auto_charts(self, auto_charts: List[Dict]) -> HTMLComponent:
        """Render auto-generated charts"""
        charts_html = f"""
        <div class="auto-charts-container">
            <h4>📊 Gráficos Generados</h4>
            <div class="auto-charts-grid">
        """
        
        for chart in auto_charts:
            chart_id = chart.get('id', f'chart_{len(auto_charts)}')
            title = chart.get('title', 'Gráfico')
            
            charts_html += f"""
            <div class="auto-chart-item">
                <h5>{title}</h5>
                <div id="{chart_id}" class="plotly-chart"></div>
            </div>
            """
            
        charts_html += """
            </div>
        </div>
        """
        
        return HTMLComponent(
            html=charts_html,
            component_type="auto_charts",
            priority=1,
            css_classes=["auto-charts", "petroleum-charts"],
            js_dependencies=["plotly"]
        )


# Global HTML injector instance
html_injector = None

def get_html_injector() -> HTMLInjector:
    """Get global HTML injector instance"""
    global html_injector
    if html_injector is None:
        html_injector = HTMLInjector()
    return html_injector

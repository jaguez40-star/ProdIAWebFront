"""
Modern Followup Agent - Configurable intelligent follow-up generation
"""

import logging
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import json

from .configurable_agent import ConfigurableAgent, AgentResponse
from .analytics.button_generators.fixed_reports import (
    get_fixed_production_report_button,
    format_fixed_button_for_frontend,
    should_show_fixed_report
)

logger = logging.getLogger(__name__)


def make_json_serializable(obj):
    """Convert numpy/pandas types to JSON serializable types"""
    if isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(make_json_serializable(v) for v in obj)
    elif pd.isna(obj):
        return None
    else:
        return obj


class FollowupAgent(ConfigurableAgent):
    """
    Modern followup agent for generating intelligent follow-up questions and suggestions
    Uses vector database to find similar successful queries
    """
    
    def __init__(self, config_path: str = "config/master_prompts.yaml"):
        """Initialize modern followup agent"""
        super().__init__(agent_type="followup", config_path=config_path)
        
        # Followup categories and templates
        self.followup_categories = {
            'drill_down': {
                'name': 'Profundización',
                'icon': '🔍',
                'priority': 0.9
            },
            'temporal_analysis': {
                'name': 'Análisis Temporal',
                'icon': '📈',
                'priority': 0.8
            },
            'comparative_analysis': {
                'name': 'Comparación',
                'icon': '⚖️',
                'priority': 0.85
            },
            'statistical_analysis': {
                'name': 'Análisis Estadístico',
                'icon': '📊',
                'priority': 0.7
            },
            'operational_insights': {
                'name': 'Insights Operacionales',
                'icon': '⚙️',
                'priority': 0.75
            }
        }
        
        # Statistics
        self.stats = {
            'total_requests': 0,
            'suggestions_generated': 0,
            'categories_used': {}
        }
        
        logger.info("Modern FollowupAgent initialized")

    def generate_followups(
        self,
        original_question: str,
        sql_query: str,
        results_data: pd.DataFrame,
        agent_type: str,
        context: Dict[str, Any] = None
    ) -> AgentResponse:
        """Execute priority statistical analyses automatically for executives"""
        self.stats['total_requests'] += 1
        
        try:
            # Analyze the original query and results
            query_analysis = self._analyze_original_query(
                original_question, sql_query, results_data, agent_type
            )
            
            # AUTO-EXECUTE PRIORITY STATISTICAL ANALYSES
            executive_analyses = self._execute_priority_analyses(
                query_analysis, original_question, results_data, context
            )
            
            # Generate contextual insights (still useful)
            contextual_insights = self._generate_contextual_insights(
                query_analysis, results_data
            )
            
            # Create executive summary content
            executive_content = self._build_executive_analysis_content(
                executive_analyses, contextual_insights, original_question
            )
            
            # Track statistics
            self.stats['suggestions_generated'] += len(executive_analyses)
            for analysis in executive_analyses:
                category = analysis.get('type', 'unknown')
                self.stats['categories_used'][category] = (
                    self.stats['categories_used'].get(category, 0) + 1
                )
            
            # NUEVO: Always add fixed production report button
            fixed_button = None
            if should_show_fixed_report(context):
                fixed_button_raw = get_fixed_production_report_button()
                fixed_button = format_fixed_button_for_frontend(fixed_button_raw)
                logger.info("✅ Added fixed production report button to followups")

            # Make data JSON serializable
            response_data = make_json_serializable({
                'executive_analyses': executive_analyses,
                'contextual_insights': contextual_insights,
                'query_analysis': query_analysis,
                'auto_executed': True,
                'panel_type': 'executive_dashboard',
                'fixed_report_button': fixed_button  # NUEVO: Always-visible button
            })

            return AgentResponse(
                success=True,
                content=executive_content,
                data=response_data
            )
            
        except Exception as e:
            logger.error(f"Error generating executive followups: {e}")
            return AgentResponse(
                success=False,
                content=f"Error ejecutando análisis ejecutivo: {str(e)}",
                error=str(e)
            )

    def _analyze_original_query(
        self,
        original_question: str,
        sql_query: str,
        results_data: pd.DataFrame,
        agent_type: str
    ) -> Dict[str, Any]:
        """Analyze the original query to understand context and opportunities"""
        analysis = {
            'query_type': self._classify_query_type(original_question),
            'temporal_scope': self._detect_temporal_scope(original_question),
            'entities_mentioned': self._extract_entities(original_question),
            'metrics_mentioned': self._extract_metrics(original_question),
            'data_characteristics': self._analyze_data_characteristics(results_data),
            'sql_complexity': self._assess_sql_complexity(sql_query),
            'agent_type': agent_type
        }
        
        return analysis

    def _execute_priority_analyses(
        self,
        query_analysis: Dict[str, Any],
        original_question: str,
        results_data: pd.DataFrame,
        context: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Execute dynamic statistical analyses based on actual data patterns"""
        analyses = []
        
        try:
            logger.info(f"Executing dynamic statistical analysis on {len(results_data)} records")
            
            # Generate dynamic statistical analyses based on actual data
            statistical_analyses = self._generate_dynamic_statistical_analyses(results_data, original_question)
            
            for analysis in statistical_analyses:
                analyses.append(analysis)
                
        except Exception as e:
            logger.error(f"Error in dynamic statistical analysis: {e}")
            # Fallback to basic summary
            analyses = self._generate_basic_statistics_fallback(results_data, original_question)
            
        return analyses

    def _generate_dynamic_statistical_analyses(
        self,
        data: pd.DataFrame,
        original_question: str
    ) -> List[Dict[str, Any]]:
        """Generate statistical analyses dynamically based on actual data patterns"""
        analyses = []
        
        if data.empty:
            return analyses
            
        try:
            logger.info(f"Analyzing data structure: {data.shape[0]} rows, {data.shape[1]} columns")
            
            # 1. DESCRIPTIVE STATISTICS ANALYSIS
            descriptive_analysis = self._generate_descriptive_statistics(data, original_question)
            if descriptive_analysis:
                analyses.append(descriptive_analysis)
            
            # 2. DISTRIBUTION ANALYSIS (for categorical fields)
            distribution_analysis = self._generate_distribution_analysis(data, original_question)
            if distribution_analysis:
                analyses.append(distribution_analysis)
            
            # 3. CORRELATION ANALYSIS (if multiple numeric columns)
            correlation_analysis = self._generate_correlation_analysis(data, original_question)
            if correlation_analysis:
                analyses.append(correlation_analysis)
            
            # 4. OUTLIER DETECTION
            outlier_analysis = self._generate_outlier_analysis(data, original_question)
            if outlier_analysis:
                analyses.append(outlier_analysis)
            
            # 5. RANKING/TOP PERFORMERS
            ranking_analysis = self._generate_ranking_analysis(data, original_question)
            if ranking_analysis:
                analyses.append(ranking_analysis)
                
        except Exception as e:
            logger.error(f"Error in dynamic statistical generation: {e}")
            
        return analyses[:4]  # Limit to top 4 most relevant analyses

    def _generate_descriptive_statistics(self, data: pd.DataFrame, original_question: str) -> Dict[str, Any]:
        """Generate descriptive statistics for numeric columns"""
        try:
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            if not numeric_cols:
                return None
                
            stats_summary = {}
            key_findings = []
            
            for col in numeric_cols:
                series = data[col].dropna()
                if len(series) == 0:
                    continue
                    
                stats = {
                    'count': len(series),
                    'mean': series.mean(),
                    'median': series.median(),
                    'std': series.std(),
                    'min': series.min(),
                    'max': series.max(),
                    'q25': series.quantile(0.25),
                    'q75': series.quantile(0.75)
                }
                stats_summary[col] = stats
                
                # Generate insights
                cv = stats['std'] / stats['mean'] if stats['mean'] != 0 else 0
                if cv > 1:
                    key_findings.append(f"{col}: Alta variabilidad (CV={cv:.1f})")
                elif cv < 0.1:
                    key_findings.append(f"{col}: Muy consistente (CV={cv:.2f})")
                
                # Check for skewness
                if stats['mean'] > stats['median'] * 1.2:
                    key_findings.append(f"{col}: Distribución sesgada hacia valores altos")
                elif stats['median'] > stats['mean'] * 1.2:
                    key_findings.append(f"{col}: Distribución sesgada hacia valores bajos")
            
            if not stats_summary:
                return None
                
            # Create executive summary
            total_metrics = len(stats_summary)
            total_records = len(data)
            
            executive_summary = f"Análisis estadístico de {total_metrics} métricas en {total_records:,} registros"
            
            return {
                'title': 'Estadísticas Descriptivas',
                'type': 'descriptive_statistics',
                'priority': 0.95,
                'expected_insight': 'Medidas de tendencia central y dispersión',
                'data': stats_summary,
                'data_count': total_records,
                'executive_summary': executive_summary,
                'key_findings': key_findings[:3],
                'success': True,
                'execution_time': 0.1
            }
            
        except Exception as e:
            logger.error(f"Error in descriptive statistics: {e}")
            return None

    def _generate_distribution_analysis(self, data: pd.DataFrame, original_question: str) -> Dict[str, Any]:
        """Analyze distribution of categorical fields"""
        try:
            categorical_cols = data.select_dtypes(include=['object']).columns.tolist()
            if not categorical_cols:
                return None
            
            distributions = {}
            key_findings = []
            
            for col in categorical_cols:
                value_counts = data[col].value_counts()
                if len(value_counts) == 0:
                    continue
                    
                # Calculate distribution metrics
                total_count = len(data[col].dropna())
                unique_count = len(value_counts)
                most_common = value_counts.iloc[0] if len(value_counts) > 0 else 0
                most_common_pct = (most_common / total_count) * 100 if total_count > 0 else 0
                
                distributions[col] = {
                    'unique_values': unique_count,
                    'most_common': value_counts.index[0] if len(value_counts) > 0 else None,
                    'most_common_count': most_common,
                    'most_common_percentage': most_common_pct,
                    'distribution': value_counts.head(10).to_dict()
                }
                
                # Generate insights
                if most_common_pct > 80:
                    key_findings.append(f"{col}: Dominado por '{value_counts.index[0]}' ({most_common_pct:.1f}%)")
                elif unique_count == total_count:
                    key_findings.append(f"{col}: Todos los valores son únicos")
                elif unique_count < 10:
                    key_findings.append(f"{col}: Pocas categorías ({unique_count} tipos)")
            
            if not distributions:
                return None
                
            executive_summary = f"Análisis de distribución en {len(distributions)} campos categóricos"
            
            return {
                'title': 'Análisis de Distribución',
                'type': 'distribution_analysis',
                'priority': 0.80,
                'expected_insight': 'Patrones de distribución en campos categóricos',
                'data': distributions,
                'data_count': len(data),
                'executive_summary': executive_summary,
                'key_findings': key_findings[:3],
                'success': True,
                'execution_time': 0.1
            }
            
        except Exception as e:
            logger.error(f"Error in distribution analysis: {e}")
            return None

    def _generate_correlation_analysis(self, data: pd.DataFrame, original_question: str) -> Dict[str, Any]:
        """Analyze correlations between numeric variables"""
        try:
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            if len(numeric_cols) < 2:
                return None
                
            # Calculate correlation matrix
            corr_matrix = data[numeric_cols].corr()
            
            # Find strong correlations (excluding diagonal)
            strong_correlations = []
            key_findings = []
            
            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols):
                    if i < j:  # Avoid duplicate pairs and diagonal
                        corr_value = corr_matrix.loc[col1, col2]
                        if not pd.isna(corr_value) and abs(corr_value) > 0.5:
                            strong_correlations.append({
                                'variable1': col1,
                                'variable2': col2,
                                'correlation': corr_value,
                                'strength': 'Fuerte' if abs(corr_value) > 0.8 else 'Moderada'
                            })
                            
                            # Generate insight
                            direction = 'positiva' if corr_value > 0 else 'negativa'
                            key_findings.append(f"{col1} - {col2}: Correlación {direction} ({corr_value:.2f})")
            
            if not strong_correlations:
                return None
                
            executive_summary = f"Encontradas {len(strong_correlations)} correlaciones significativas"
            
            return {
                'title': 'Análisis de Correlaciones',
                'type': 'correlation_analysis',
                'priority': 0.75,
                'expected_insight': 'Relaciones entre variables numéricas',
                'data': {
                    'correlations': strong_correlations,
                    'correlation_matrix': corr_matrix.round(2).to_dict()
                },
                'data_count': len(strong_correlations),
                'executive_summary': executive_summary,
                'key_findings': key_findings[:3],
                'success': True,
                'execution_time': 0.1
            }
            
        except Exception as e:
            logger.error(f"Error in correlation analysis: {e}")
            return None

    def _generate_outlier_analysis(self, data: pd.DataFrame, original_question: str) -> Dict[str, Any]:
        """Detect outliers using IQR method"""
        try:
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            if not numeric_cols:
                return None
                
            outlier_summary = {}
            key_findings = []
            total_outliers = 0
            
            for col in numeric_cols:
                series = data[col].dropna()
                if len(series) < 4:  # Need at least 4 values for quartiles
                    continue
                    
                q1 = series.quantile(0.25)
                q3 = series.quantile(0.75)
                iqr = q3 - q1
                
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                outliers = series[(series < lower_bound) | (series > upper_bound)]
                
                if len(outliers) > 0:
                    outlier_pct = (len(outliers) / len(series)) * 100
                    outlier_summary[col] = {
                        'count': len(outliers),
                        'percentage': outlier_pct,
                        'lower_bound': lower_bound,
                        'upper_bound': upper_bound,
                        'outlier_values': outliers.tolist()[:5]  # Show first 5
                    }
                    total_outliers += len(outliers)
                    
                    key_findings.append(f"{col}: {len(outliers)} outliers ({outlier_pct:.1f}%)")
            
            if total_outliers == 0:
                return {
                    'title': 'Análisis de Valores Atípicos',
                    'type': 'outlier_analysis', 
                    'priority': 0.60,
                    'expected_insight': 'Detección de valores atípicos',
                    'data': {},
                    'data_count': 0,
                    'executive_summary': "No se detectaron valores atípicos significativos",
                    'key_findings': ["Datos dentro de rangos normales"],
                    'success': True,
                    'execution_time': 0.1
                }
                
            executive_summary = f"Detectados {total_outliers} valores atípicos en {len(outlier_summary)} métricas"
            
            return {
                'title': 'Análisis de Valores Atípicos',
                'type': 'outlier_analysis',
                'priority': 0.70,
                'expected_insight': 'Detección de valores atípicos',
                'data': outlier_summary,
                'data_count': total_outliers,
                'executive_summary': executive_summary,
                'key_findings': key_findings[:3],
                'success': True,
                'execution_time': 0.1
            }
            
        except Exception as e:
            logger.error(f"Error in outlier analysis: {e}")
            return None

    def _generate_ranking_analysis(self, data: pd.DataFrame, original_question: str) -> Dict[str, Any]:
        """Generate ranking based on primary numeric metric"""
        try:
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            categorical_cols = data.select_dtypes(include=['object']).columns.tolist()
            
            if not numeric_cols or not categorical_cols:
                return None
                
            # Choose primary metric (first numeric) and category (first categorical)
            primary_metric = numeric_cols[0]
            primary_category = categorical_cols[0]
            
            # Create ranking
            ranking_data = data.groupby(primary_category)[primary_metric].agg(['mean', 'count', 'sum']).round(2)
            ranking_data = ranking_data.sort_values('mean', ascending=False).head(10)
            
            if len(ranking_data) == 0:
                return None
                
            key_findings = []
            
            # Top performer
            top_performer = ranking_data.index[0]
            top_value = ranking_data.iloc[0]['mean']
            key_findings.append(f"Mejor desempeño: {top_performer} ({top_value:.1f})")
            
            # Performance spread
            if len(ranking_data) > 1:
                performance_spread = ranking_data.iloc[0]['mean'] - ranking_data.iloc[-1]['mean']
                key_findings.append(f"Rango de variación: {performance_spread:.1f}")
            
            # Volume analysis
            total_records = ranking_data['count'].sum()
            key_findings.append(f"Total de registros analizados: {total_records:,}")
            
            executive_summary = f"Ranking de {len(ranking_data)} entidades por {primary_metric}"
            
            return {
                'title': f'Ranking por {primary_metric}',
                'type': 'ranking_analysis',
                'priority': 0.85,
                'expected_insight': 'Identificación de mejores y peores performers',
                'data': {
                    'ranking': ranking_data.to_dict('index'),
                    'metric_name': primary_metric,
                    'category_name': primary_category
                },
                'data_count': len(ranking_data),
                'executive_summary': executive_summary,
                'key_findings': key_findings,
                'success': True,
                'execution_time': 0.1
            }
            
        except Exception as e:
            logger.error(f"Error in ranking analysis: {e}")
            return None

    def _generate_basic_statistics_fallback(
        self, 
        data: pd.DataFrame, 
        original_question: str
    ) -> List[Dict[str, Any]]:
        """Fallback to basic statistics if dynamic analysis fails"""
        analyses = []
        
        try:
            basic_analysis = {
                'title': 'Resumen Básico de Datos',
                'type': 'basic_summary',
                'priority': 0.5,
                'data_count': len(data),
                'executive_summary': f"Dataset con {len(data):,} registros y {len(data.columns)} columnas",
                'key_findings': [
                    f"Total de registros: {len(data):,}",
                    f"Columnas de datos: {len(data.columns)}",
                    f"Consulta: {original_question}"
                ],
                'success': True
            }
            analyses.append(basic_analysis)
            
        except Exception as e:
            logger.error(f"Error in basic statistics fallback: {e}")
            
        return analyses

    def _identify_priority_analyses(
        self,
        query_analysis: Dict[str, Any],
        original_question: str,
        results_data: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """Identify the most important analyses to execute for executives"""
        priority_analyses = []
        
        query_type = query_analysis.get('query_type', '')
        entities = query_analysis.get('entities_mentioned', [])
        metrics = query_analysis.get('metrics_mentioned', [])
        
        # Priority Analysis 1: Performance Ranking
        if 'campo' in entities or query_type == 'field_analysis':
            priority_analyses.append({
                'title': 'Ranking de Campos por Producción',
                'query': '¿cuáles son los 5 campos más productivos por volumen de petróleo?',
                'type': 'performance_ranking',
                'priority': 0.95,
                'expected_insight': 'Identificar campos top performers'
            })
            
        elif 'pozo' in entities or query_type == 'well_analysis':
            priority_analyses.append({
                'title': 'Pozos Más Productivos',
                'query': '¿cuáles son los 10 pozos más productivos por volumen de petróleo?',
                'type': 'performance_ranking',
                'priority': 0.93,
                'expected_insight': 'Identificar pozos top performers'
            })
        
        # Priority Analysis 2: Trend Analysis
        if query_analysis.get('temporal_scope') in ['daily', 'unspecified']:
            priority_analyses.append({
                'title': 'Tendencia de Producción Mensual',
                'query': '¿cómo ha evolucionado la producción total de petróleo en los últimos 6 meses?',
                'type': 'trend_analysis',
                'priority': 0.90,
                'expected_insight': 'Tendencias operacionales recientes'
            })
        
        # Priority Analysis 3: Operational Metrics
        if 'gor' in metrics or any(m in original_question.lower() for m in ['gor', 'gas']):
            priority_analyses.append({
                'title': 'Análisis de GOR Crítico',
                'query': '¿qué campos tienen GOR mayor a 1000 scf/bbl que requieren atención?',
                'type': 'operational_analysis',
                'priority': 0.85,
                'expected_insight': 'Campos con manejo de gas desafiante'
            })
        
        # Priority Analysis 4: Efficiency Analysis
        if query_type in ['general_production', 'field_analysis']:
            priority_analyses.append({
                'title': 'Análisis de Eficiencia Productiva',
                'query': '¿cuál es la producción promedio por pozo activo por campo?',
                'type': 'efficiency_analysis',
                'priority': 0.80,
                'expected_insight': 'Eficiencia operacional por área'
            })
        
        # Priority Analysis 5: Water Management (if relevant)
        if 'agua' in metrics or 'wor' in metrics:
            priority_analyses.append({
                'title': 'Análisis de Corte de Agua',
                'query': '¿qué pozos tienen WOR mayor a 2.0 que requieren manejo prioritario de agua?',
                'type': 'water_management',
                'priority': 0.78,
                'expected_insight': 'Pozos con problemas de agua'
            })
        
        # Sort by priority and return top 3-4 analyses
        priority_analyses.sort(key=lambda x: x['priority'], reverse=True)
        return priority_analyses[:4]  # Execute top 4 priority analyses
        
    def _process_analysis_result(
        self,
        result: 'AgentResponse',
        analysis_config: Dict,
        original_question: str
    ) -> Dict[str, Any]:
        """Process analysis result for executive presentation"""
        return {
            'title': analysis_config['title'],
            'type': analysis_config['type'],
            'priority': analysis_config['priority'],
            'expected_insight': analysis_config['expected_insight'],
            'data': result.data,
            'data_count': len(result.data) if result.data else 0,
            'executive_summary': self._create_executive_summary(result.data, analysis_config),
            'key_findings': self._extract_key_findings(result.data, analysis_config['type']),
            'success': True,
            'execution_time': getattr(result, 'execution_time', 0)
        }

    def _create_executive_summary(self, data: List[Dict], analysis_config: Dict) -> str:
        """Create executive summary for analysis result"""
        if not data:
            return f"No se encontraron datos para {analysis_config['title']}"
        
        analysis_type = analysis_config['type']
        
        if analysis_type == 'performance_ranking':
            if len(data) > 0 and 'FIELD_NAME' in data[0]:
                top_performer = data[0]['FIELD_NAME']
                return f"Campo líder: {top_performer} - {len(data)} campos analizados"
            elif len(data) > 0 and 'WELL_COMMON_NAME' in data[0]:
                top_performer = data[0]['WELL_COMMON_NAME']
                return f"Pozo líder: {top_performer} - {len(data)} pozos analizados"
        
        elif analysis_type == 'operational_analysis':
            high_gor_count = len([row for row in data if row.get('GOR', 0) > 1000])
            return f"Identificados {high_gor_count} activos con GOR crítico de {len(data)} analizados"
        
        elif analysis_type == 'efficiency_analysis':
            if data:
                avg_production = sum(row.get('promedio_produccion', 0) for row in data) / len(data)
                return f"Producción promedio por pozo: {avg_production:.1f} bbl/día - {len(data)} campos analizados"
        
        elif analysis_type == 'water_management':
            high_wor_count = len([row for row in data if row.get('WOR', 0) > 2.0])
            return f"Identificados {high_wor_count} pozos con alto corte de agua de {len(data)} analizados"
        
        return f"{len(data)} registros analizados para {analysis_config['title']}"

    def _extract_key_findings(self, data: List[Dict], analysis_type: str) -> List[str]:
        """Extract key findings from analysis data"""
        findings = []
        
        if not data:
            return findings
        
        try:
            if analysis_type == 'performance_ranking':
                if 'OIL_VOLUME' in data[0]:
                    total_production = sum(row.get('OIL_VOLUME', 0) for row in data)
                    findings.append(f"Producción total: {total_production:,.0f} bbl/día")
                    
                    if len(data) >= 3:
                        top_3_production = sum(row.get('OIL_VOLUME', 0) for row in data[:3])
                        percentage = (top_3_production / total_production) * 100 if total_production > 0 else 0
                        findings.append(f"Top 3 representan {percentage:.1f}% de la producción total")
                        
            elif analysis_type == 'operational_analysis':
                if 'GOR' in data[0]:
                    avg_gor = sum(row.get('GOR', 0) for row in data if row.get('GOR')) / len(data)
                    max_gor = max(row.get('GOR', 0) for row in data)
                    findings.append(f"GOR promedio: {avg_gor:.1f} scf/bbl")
                    findings.append(f"GOR máximo: {max_gor:.1f} scf/bbl")
                    
            elif analysis_type == 'efficiency_analysis':
                if data and 'promedio_produccion' in data[0]:
                    efficiencies = [row.get('promedio_produccion', 0) for row in data]
                    best_efficiency = max(efficiencies)
                    worst_efficiency = min(efficiencies)
                    findings.append(f"Mayor eficiencia: {best_efficiency:.1f} bbl/día por pozo")
                    findings.append(f"Menor eficiencia: {worst_efficiency:.1f} bbl/día por pozo")
                    
        except Exception as e:
            logger.error(f"Error extracting key findings: {e}")
            
        return findings[:3]  # Top 3 findings
    
    def _generate_data_statistics_summary(
        self, 
        data: pd.DataFrame, 
        query_analysis: Dict
    ) -> List[Dict[str, Any]]:
        """Generate statistical summary of current data as fallback"""
        analyses = []
        
        if data.empty:
            return analyses
            
        try:
            # Basic statistics
            analyses.append({
                'title': 'Estadísticas de los Datos Actuales',
                'type': 'data_summary',
                'priority': 0.6,
                'data_count': len(data),
                'executive_summary': f"Análisis de {len(data)} registros con {len(data.columns)} métricas",
                'key_findings': [
                    f"Total de registros: {len(data):,}",
                    f"Columnas de datos: {len(data.columns)}",
                    f"Periodo analizado: Según datos actuales"
                ],
                'success': True
            })
            
        except Exception as e:
            logger.error(f"Error generating data statistics summary: {e}")
            
        return analyses

    def _build_executive_analysis_content(
        self,
        executive_analyses: List[Dict],
        contextual_insights: List[str],
        original_question: str
    ) -> str:
        """Build formatted content for executive analyses"""
        content_parts = []
        
        content_parts.append("# 🎯 Análisis Ejecutivo Automático")
        content_parts.append(f"**Consulta base**: {original_question}")
        content_parts.append(f"**Análisis ejecutados**: {len(executive_analyses)}")
        content_parts.append("")
        
        # Executive analyses results
        for i, analysis in enumerate(executive_analyses, 1):
            content_parts.append(f"## {i}. {analysis['title']}")
            content_parts.append(f"**Resumen**: {analysis['executive_summary']}")
            
            if analysis.get('key_findings'):
                content_parts.append("**Hallazgos Clave**:")
                for finding in analysis['key_findings']:
                    content_parts.append(f"• {finding}")
            
            content_parts.append(f"*Registros analizados: {analysis['data_count']}*")
            content_parts.append("")
        
        # Contextual insights
        if contextual_insights:
            content_parts.append("## 💡 Insights Contextuales")
            for insight in contextual_insights[:3]:
                content_parts.append(f"• {insight}")
        
        content_parts.append("\n---\n*Análisis generado automáticamente para Panel Ejecutivo*")
        
        return "\n".join(content_parts)

    def _generate_suggestions(
        self,
        query_analysis: Dict[str, Any],
        original_question: str,
        results_data: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """Generate contextual follow-up suggestions"""
        suggestions = []
        
        try:
            # Drill-down suggestions
            drill_down_suggestions = self._generate_drill_down_suggestions(
                query_analysis, original_question
            )
            suggestions.extend(drill_down_suggestions)
            
            # Temporal analysis suggestions
            temporal_suggestions = self._generate_temporal_suggestions(
                query_analysis, original_question
            )
            suggestions.extend(temporal_suggestions)
            
            # Comparative analysis suggestions
            comparative_suggestions = self._generate_comparative_suggestions(
                query_analysis, results_data
            )
            suggestions.extend(comparative_suggestions)
            
            # Statistical analysis suggestions
            statistical_suggestions = self._generate_statistical_suggestions(
                query_analysis, results_data
            )
            suggestions.extend(statistical_suggestions)
            
            # Operational insights suggestions
            operational_suggestions = self._generate_operational_suggestions(
                query_analysis, results_data
            )
            suggestions.extend(operational_suggestions)
            
            # Sort by priority and relevance
            suggestions.sort(key=lambda x: x.get('priority', 0.5), reverse=True)
            
        except Exception as e:
            logger.error(f"Error generating suggestions: {e}")
            
        return suggestions[:8]  # Limit to 8 suggestions

    def _generate_drill_down_suggestions(
        self, 
        query_analysis: Dict, 
        original_question: str
    ) -> List[Dict[str, Any]]:
        """Generate drill-down suggestions"""
        suggestions = []
        
        query_type = query_analysis.get('query_type', '')
        entities = query_analysis.get('entities_mentioned', [])
        
        if query_type == 'field_analysis' and 'campo' in entities:
            suggestions.append({
                'question': '¿Cuáles son los pozos más productivos de este campo?',
                'description': 'Desglose por pozos individuales dentro del campo',
                'category': 'drill_down',
                'icon': '🔍',
                'priority': 0.9,
                'complexity': 'medium'
            })
            
        elif query_type == 'general_production':
            suggestions.append({
                'question': '¿Cómo se distribuye la producción por gerencia?',
                'description': 'Análisis jerárquico de la producción',
                'category': 'drill_down',
                'icon': '🔍',
                'priority': 0.85,
                'complexity': 'low'
            })
            
        if 'producción' in original_question.lower():
            suggestions.append({
                'question': '¿Qué pozos están inactivos o suspendidos?',
                'description': 'Análisis del estado operacional de pozos',
                'category': 'drill_down',
                'icon': '🔍',
                'priority': 0.8,
                'complexity': 'medium'
            })
        
        return suggestions

    def _generate_temporal_suggestions(
        self,
        query_analysis: Dict,
        original_question: str
    ) -> List[Dict[str, Any]]:
        """Generate temporal analysis suggestions"""
        suggestions = []
        
        temporal_scope = query_analysis.get('temporal_scope', '')
        
        if temporal_scope == 'daily':
            suggestions.append({
                'question': '¿Cuál es la tendencia semanal de estos resultados?',
                'description': 'Expandir análisis a periodo semanal',
                'category': 'temporal_analysis',
                'icon': '📈',
                'priority': 0.8,
                'complexity': 'medium'
            })
            
        elif temporal_scope in ['unspecified', 'monthly']:
            suggestions.append({
                'question': '¿Cómo ha evolucionado la producción en los últimos 6 meses?',
                'description': 'Análisis de tendencia semestral',
                'category': 'temporal_analysis',
                'icon': '📈',
                'priority': 0.85,
                'complexity': 'medium'
            })
            
        if 'año' not in original_question.lower():
            suggestions.append({
                'question': '¿Cómo se compara con el mismo período del año pasado?',
                'description': 'Comparación interanual',
                'category': 'temporal_analysis',
                'icon': '📈',
                'priority': 0.9,
                'complexity': 'high'
            })
        
        return suggestions

    def _generate_comparative_suggestions(
        self,
        query_analysis: Dict,
        results_data: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """Generate comparative analysis suggestions"""
        suggestions = []
        
        data_chars = query_analysis.get('data_characteristics', {})
        
        if data_chars.get('has_categorical_data'):
            suggestions.append({
                'question': '¿Cuál es el ranking de desempeño entre entidades?',
                'description': 'Clasificación ordenada por métricas clave',
                'category': 'comparative_analysis',
                'icon': '⚖️',
                'priority': 0.85,
                'complexity': 'medium'
            })
            
        if data_chars.get('multiple_metrics'):
            suggestions.append({
                'question': '¿Hay correlación entre las diferentes métricas?',
                'description': 'Análisis de correlación estadística',
                'category': 'comparative_analysis',
                'icon': '⚖️',
                'priority': 0.8,
                'complexity': 'high'
            })
            
        # Petroleum-specific comparisons
        metrics = query_analysis.get('metrics_mentioned', [])
        if 'producción' in metrics or 'petróleo' in metrics:
            suggestions.append({
                'question': '¿Qué entidad tiene la mejor eficiencia productiva?',
                'description': 'Análisis de eficiencia relativa',
                'category': 'comparative_analysis',
                'icon': '⚖️',
                'priority': 0.82,
                'complexity': 'medium'
            })
        
        return suggestions

    def _generate_statistical_suggestions(
        self,
        query_analysis: Dict,
        results_data: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """Generate statistical analysis suggestions"""
        suggestions = []
        
        data_chars = query_analysis.get('data_characteristics', {})
        
        if data_chars.get('has_numeric_data'):
            suggestions.append({
                'question': '¿Cuáles son las estadísticas descriptivas principales?',
                'description': 'Media, mediana, desviación estándar, percentiles',
                'category': 'statistical_analysis',
                'icon': '📊',
                'priority': 0.7,
                'complexity': 'low'
            })
            
        if data_chars.get('sufficient_data_points'):
            suggestions.append({
                'question': '¿Hay valores atípicos o outliers significativos?',
                'description': 'Identificación de anomalías estadísticas',
                'category': 'statistical_analysis',
                'icon': '📊',
                'priority': 0.75,
                'complexity': 'medium'
            })
            
        # Petroleum-specific statistical analysis
        if any(metric in query_analysis.get('metrics_mentioned', []) 
               for metric in ['gor', 'wor', 'gas', 'agua']):
            suggestions.append({
                'question': '¿Cuál es la distribución de GOR y WOR en los datos?',
                'description': 'Análisis estadístico de métricas petroleras',
                'category': 'statistical_analysis',
                'icon': '📊',
                'priority': 0.8,
                'complexity': 'medium'
            })
        
        return suggestions

    def _generate_operational_suggestions(
        self,
        query_analysis: Dict,
        results_data: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """Generate operational insights suggestions"""
        suggestions = []
        
        # Production optimization suggestions
        if query_analysis.get('query_type') in ['field_analysis', 'well_analysis']:
            suggestions.append({
                'question': '¿Qué acciones podrían optimizar la producción?',
                'description': 'Recomendaciones operacionales basadas en datos',
                'category': 'operational_insights',
                'icon': '⚙️',
                'priority': 0.85,
                'complexity': 'high'
            })
            
        # Water cut analysis
        metrics = query_analysis.get('metrics_mentioned', [])
        if 'agua' in metrics or 'wor' in metrics:
            suggestions.append({
                'question': '¿Qué pozos requieren manejo de agua prioritario?',
                'description': 'Identificar pozos con alto corte de agua',
                'category': 'operational_insights',
                'icon': '⚙️',
                'priority': 0.8,
                'complexity': 'medium'
            })
            
        # Gas management
        if 'gas' in metrics or 'gor' in metrics:
            suggestions.append({
                'question': '¿Hay oportunidades de optimización de gas?',
                'description': 'Análisis de eficiencia en manejo de gas',
                'category': 'operational_insights',
                'icon': '⚙️',
                'priority': 0.75,
                'complexity': 'medium'
            })
        
        return suggestions

    def _generate_contextual_insights(
        self,
        query_analysis: Dict,
        results_data: pd.DataFrame
    ) -> List[str]:
        """Generate contextual insights about the query and results"""
        insights = []
        
        try:
            # Data quality insights
            if not results_data.empty:
                rows, cols = results_data.shape
                insights.append(f"Consulta devolvió {rows:,} registros con {cols} columnas")
                
                # Completeness insight
                total_cells = rows * cols
                non_null_cells = results_data.count().sum()
                completeness = (non_null_cells / total_cells) * 100 if total_cells > 0 else 0
                
                if completeness < 90:
                    insights.append(f"Completitud de datos: {completeness:.1f}% - Considerar filtros adicionales")
                else:
                    insights.append(f"Datos completos ({completeness:.1f}% de completitud)")
            
            # Query complexity insight
            sql_complexity = query_analysis.get('sql_complexity', 'unknown')
            if sql_complexity == 'high':
                insights.append("Consulta compleja - Considera dividir en análisis más específicos")
            elif sql_complexity == 'low':
                insights.append("Consulta básica - Oportunidad para análisis más profundo")
                
            # Temporal scope insight
            temporal_scope = query_analysis.get('temporal_scope', '')
            if temporal_scope == 'daily':
                insights.append("Análisis diario - Considera ampliar a tendencias semanales o mensuales")
            elif temporal_scope == 'annual':
                insights.append("Análisis anual - Considera desglose mensual para mayor detalle")
                
        except Exception as e:
            logger.error(f"Error generating contextual insights: {e}")
            insights.append("Error generando insights contextuales")
            
        return insights

    def _generate_recommended_actions(
        self,
        query_analysis: Dict,
        suggestions: List[Dict]
    ) -> List[str]:
        """Generate recommended actions based on analysis"""
        actions = []
        
        try:
            # High-priority suggestions become recommended actions
            high_priority_suggestions = [
                s for s in suggestions if s.get('priority', 0) >= 0.8
            ]
            
            for suggestion in high_priority_suggestions[:3]:
                actions.append(f"Ejecutar: {suggestion['question']}")
            
            # General recommendations based on query type
            query_type = query_analysis.get('query_type', '')
            
            if query_type == 'general_production':
                actions.append("Profundizar en análisis por entidades específicas")
                
            elif query_type == 'field_analysis':
                actions.append("Analizar pozos individuales dentro del campo")
                
            # Data-driven recommendations
            data_chars = query_analysis.get('data_characteristics', {})
            if data_chars.get('has_outliers'):
                actions.append("Investigar valores atípicos identificados")
                
        except Exception as e:
            logger.error(f"Error generating recommended actions: {e}")
            
        return actions[:5]  # Limit to 5 actions

    # Utility methods for analysis
    def _classify_query_type(self, question: str) -> str:
        """Classify the type of query"""
        question_lower = question.lower()
        
        if any(word in question_lower for word in ['campo', 'field']):
            return 'field_analysis'
        elif any(word in question_lower for word in ['pozo', 'well']):
            return 'well_analysis'
        elif any(word in question_lower for word in ['gerencia', 'management']):
            return 'management_analysis'
        elif any(word in question_lower for word in ['tendencia', 'trend', 'evolución']):
            return 'trend_analysis'
        elif any(word in question_lower for word in ['comparar', 'compare', 'versus']):
            return 'comparative_analysis'
        else:
            return 'general_production'

    def _detect_temporal_scope(self, question: str) -> str:
        """Detect temporal scope of question"""
        question_lower = question.lower()
        
        if any(word in question_lower for word in ['diario', 'día', 'daily']):
            return 'daily'
        elif any(word in question_lower for word in ['semanal', 'semana', 'weekly']):
            return 'weekly'
        elif any(word in question_lower for word in ['mensual', 'mes', 'monthly']):
            return 'monthly'
        elif any(word in question_lower for word in ['anual', 'año', 'yearly']):
            return 'annual'
        else:
            return 'unspecified'

    def _extract_entities(self, question: str) -> List[str]:
        """Extract mentioned entities from question"""
        entities = []
        question_lower = question.lower()
        
        entity_keywords = {
            'campo': ['campo', 'field'],
            'pozo': ['pozo', 'well'],
            'gerencia': ['gerencia', 'management'],
            'vicepresidencia': ['vicepresidencia', 'vp'],
            'dmu': ['dmu', 'unidad']
        }
        
        for entity, keywords in entity_keywords.items():
            if any(keyword in question_lower for keyword in keywords):
                entities.append(entity)
                
        return entities

    def _extract_metrics(self, question: str) -> List[str]:
        """Extract mentioned metrics from question"""
        metrics = []
        question_lower = question.lower()
        
        metric_keywords = {
            'producción': ['producción', 'production'],
            'petróleo': ['petróleo', 'oil', 'crudo', 'aceite'],
            'agua': ['agua', 'water'],
            'gas': ['gas'],
            'gor': ['gor'],
            'wor': ['wor'],
            'bopd': ['bopd']
        }
        
        for metric, keywords in metric_keywords.items():
            if any(keyword in question_lower for keyword in keywords):
                metrics.append(metric)
                
        return metrics

    def _analyze_data_characteristics(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze characteristics of result data"""
        if data.empty:
            return {}
            
        characteristics = {
            'has_numeric_data': len(data.select_dtypes(include=['number']).columns) > 0,
            'has_categorical_data': len(data.select_dtypes(include=['object']).columns) > 0,
            'multiple_metrics': len(data.select_dtypes(include=['number']).columns) > 1,
            'sufficient_data_points': len(data) >= 10,
            'has_outliers': False  # Would implement outlier detection
        }
        
        return characteristics

    def _assess_sql_complexity(self, sql_query: str) -> str:
        """Assess complexity of SQL query"""
        if not sql_query:
            return 'unknown'
            
        sql_lower = sql_query.lower()
        complexity_indicators = {
            'high': ['join', 'subquery', 'with', 'case when', 'window function'],
            'medium': ['group by', 'having', 'order by'],
            'low': ['select', 'from', 'where']
        }
        
        for level, indicators in complexity_indicators.items():
            if any(indicator in sql_lower for indicator in indicators):
                return level
                
        return 'low'

    def get_followup_stats(self) -> Dict[str, Any]:
        """Get followup-specific statistics"""
        base_stats = self.get_agent_stats()
        
        followup_stats = {
            **base_stats,
            'followup_stats': self.stats,
            'available_categories': list(self.followup_categories.keys()),
            'category_priorities': {
                cat: info['priority'] 
                for cat, info in self.followup_categories.items()
            }
        }
        
        return followup_stats


# Factory function
def create_followup_agent(config_path: str = "config/master_prompts.yaml") -> FollowupAgent:
    """Create a followup agent instance"""
    return FollowupAgent(config_path)
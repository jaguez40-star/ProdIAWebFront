"""
Configurable Agent Base Class for ECP Insights
Base class for all specialized agents using vector DB and YAML configuration
"""

import logging
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from datetime import datetime
import yaml
import pandas as pd

from ..core.vector_manager import get_vector_manager, SearchResult
from ..core.html_injector import get_html_injector, RenderContext
from ..core.base_agent import BaseAgent
from ..core.llm_manager import llm_manager
from ..core.knowledge_base_manager import get_knowledge_base_manager

logger = logging.getLogger(__name__)


@dataclass
class AgentResponse:
    """Standardized agent response"""
    success: bool
    content: str
    data: Optional[Union[List[Dict], Dict]] = None
    sql_query: Optional[str] = None
    database_used: Optional[str] = None
    insights: List[str] = None
    html_components: List[Any] = None
    processing_time: float = 0.0
    error: Optional[str] = None


class ConfigurableAgent(BaseAgent):
    """
    Base class for configurable agents that use:
    - Vector database for context retrieval
    - YAML configuration for prompts and behavior
    - Unified HTML injection for results rendering
    """
    
    def __init__(self, agent_type: str, config_path: str = "config/master_prompts.yaml"):
        """Initialize configurable agent"""
        super().__init__(agent_type)
        
        self.agent_type = agent_type
        self.config_path = config_path
        
        # Load agent configuration
        self.agent_config = self._load_agent_config()
        
        # Initialize components
        self.kb_manager = get_knowledge_base_manager()  # SINGLE SOURCE OF TRUTH
        self.vector_manager = get_vector_manager()
        self.html_injector = get_html_injector()

        logger.info(f"ConfigurableAgent '{agent_type}' initialized with KnowledgeBaseManager")

    def _load_agent_config(self) -> Dict[str, Any]:
        """Load agent-specific configuration from YAML"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            agent_prompts = config.get('agent_prompts', {})
            base_prompts = config.get('base_prompts', {})
            
            if self.agent_type not in agent_prompts:
                logger.error(f"Agent configuration not found: {self.agent_type}")
                return self._get_default_config()
                
            agent_config = agent_prompts[self.agent_type].copy()
            agent_config['base_prompts'] = base_prompts
            agent_config['scenario_templates'] = config.get('scenario_templates', {})
            agent_config['variables'] = config.get('variables', {})
            
            return agent_config
            
        except Exception as e:
            logger.error(f"Error loading agent config: {e}")
            return self._get_default_config()

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration if config loading fails"""
        return {
            "specialization": f"Agente {self.agent_type}",
            "base_prompt": "Eres un asistente especializado. Responde de manera útil y precisa.",
            "base_prompts": {"system_role": "Eres un asistente especializado."},
            "scenario_templates": {},
            "variables": {}
        }

    @staticmethod
    def _is_daily_report_range_query(user_query: str) -> bool:
        if not user_query:
            return False
        text = user_query.lower()
        keywords = ["rango", "fechas", "fecha", "dias", "días", "periodo", "período"]
        return any(k in text for k in keywords) and ("reporte" in text or "diario" in text)

    @staticmethod
    def _is_daily_report_min_production_with_reason(user_query: str) -> bool:
        if not user_query:
            return False
        text = user_query.lower()
        has_min = "min" in text or "mín" in text or "menor" in text or "baja" in text
        has_prod = "produccion" in text or "producción" in text
        has_reason = (
            "razon" in text or "razón" in text or "motivo" in text or
            "causa" in text or "circunstancia" in text or
            "diferida" in text or "diferidas" in text
        )
        return has_min and has_prod and has_reason

    @staticmethod
    def _extract_ddmmyyyy_from_query(user_query: str) -> Optional[str]:
        if not user_query:
            return None
        import re
        text = user_query.lower()
        # Match dd/mm/yyyy
        match = re.search(r"\b(0?[1-9]|[12]\d|3[01])/(0?[1-9]|1[0-2])/(20\d{2})\b", text)
        if match:
            day = int(match.group(1))
            month = int(match.group(2))
            year = int(match.group(3))
            return f"{day:02d}/{month:02d}/{year}"

        # Match "3 de enero de 2026"
        months = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
            "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
            "noviembre": 11, "diciembre": 12,
        }
        match = re.search(r"\b(0?[1-9]|[12]\d|3[01])\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(20\d{2})\b", text)
        if match:
            day = int(match.group(1))
            month_name = match.group(2)
            year = int(match.group(3))
            month = months.get(month_name)
            if month:
                return f"{day:02d}/{month:02d}/{year}"
        return None

    @staticmethod
    def _has_date_not_spelled(user_query: str) -> bool:
        if not user_query:
            return False
        import re
        text = user_query.lower()
        # Natural language date like "3 de enero de 2026"
        if re.search(r"\b(0?[1-9]|[12]\d|3[01])\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(20\d{2})\b", text):
            return False
        # Numeric dates like 03/01/2026 or 2026-01-03
        if re.search(r"\b(0?[1-9]|[12]\d|3[01])/(0?[1-9]|1[0-2])/(20\d{2})\b", text):
            return True
        if re.search(r"\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b", text):
            return True
        return False

    @staticmethod
    def _is_daily_report_ranking_query(user_query: str) -> bool:
        if not user_query:
            return False
        text = user_query.lower()
        has_rank = any(k in text for k in ["ranking", "top", "mayor", "menor", "mas alta", "más alta", "mas baja", "más baja"])
        has_campo = "campo" in text or "campos" in text
        has_prod = "produccion" in text or "producción" in text
        return has_rank and has_campo and has_prod

    @staticmethod
    def _is_daily_report_reason_by_date(user_query: str) -> bool:
        if not user_query:
            return False
        text = user_query.lower()
        has_reason = any(k in text for k in ["razon", "razón", "motivo", "causa", "circunstancia", "diferida", "diferidas"])
        has_date = ConfigurableAgent._extract_ddmmyyyy_from_query(user_query) is not None
        return has_reason and has_date

    def process_query(self, user_query: str, context: Dict[str, Any] = None) -> AgentResponse:
        """Main query processing method"""
        start_time = datetime.now()
        
        try:
            if context and context.get("report_mode") == "daily_performance":
                if "pozo" in user_query.lower():
                    message = (
                        "Por favor reformula tu pregunta, En este momento solo puedo responde "
                        "preguntas a nivel de agrupamiento \"CAMPO\". Agradezco tu ayuda!"
                    )
                    return AgentResponse(
                        success=True,
                        content=message,
                        data=None,
                        sql_query=None,
                        database_used="ecp_prod",
                        insights=[],
                        html_components=[],
                        processing_time=(datetime.now() - start_time).total_seconds(),
                    )
                if self._has_date_not_spelled(user_query):
                    message = (
                        "Por favor reformula tu pregunta, indicando la fecha de la siguiente forma "
                        "\"dia  de Mes de año\"  (Ejemplo 3 de enero de 2026). Agradezco tu ayuda!"
                    )
                    return AgentResponse(
                        success=True,
                        content=message,
                        data=None,
                        sql_query=None,
                        database_used="ecp_prod",
                        insights=[],
                        html_components=[],
                        processing_time=(datetime.now() - start_time).total_seconds(),
                    )
                if self._is_daily_report_range_query(user_query):
                    processed_response = {
                        "sql_query": "SELECT MIN(FECHA) AS fecha_inicio, MAX(FECHA) AS fecha_fin FROM REPORTE_SEMANAL;",
                        "database": "ecp_prod",
                    }
                    execution_result = self._execute_sql_query(
                        processed_response["sql_query"],
                        processed_response["database"],
                        user_query,
                        context=context,
                    )
                    processed_response.update(execution_result)
                    html_components = self._generate_html_components(processed_response, user_query)
                    processing_time = (datetime.now() - start_time).total_seconds()
                    content = (
                        self._build_data_response(processed_response, user_query)
                        if processed_response.get("execution_success")
                        else self._build_error_fallback_response(user_query, processed_response.get("error"))
                    )
                    return AgentResponse(
                        success=True,
                        content=content,
                        data=processed_response.get("data"),
                        sql_query=processed_response.get("sql_query"),
                        database_used=processed_response.get("database"),
                        insights=processed_response.get("insights", []),
                        html_components=html_components,
                        processing_time=processing_time,
                    )
                # If the user asks for reasons/causes for a specific date, query RESUMEN_DIFERIDAS_MES_OLLAMA directly.
                if self._is_daily_report_reason_by_date(user_query):
                    date_ddmmyyyy = self._extract_ddmmyyyy_from_query(user_query)
                    reason_sql = (
                        "SELECT R.POZO_COMMENT FROM RESUMEN_DIFERIDAS_MES_OLLAMA R "
                        f"WHERE R.EVENT_DATE = '{date_ddmmyyyy}';"
                    )
                    reason_result = self._execute_sql_query(
                        reason_sql,
                        "ecp_prod",
                        user_query,
                        context=context,
                    )
                    if reason_result.get("execution_success"):
                        reason_rows = reason_result.get("data", [])
                        if reason_rows and isinstance(reason_rows[0], dict):
                            reason = reason_rows[0].get("POZO_COMMENT")
                            if reason:
                                return AgentResponse(
                                    success=True,
                                    content=reason,
                                    data=reason_rows,
                                    sql_query=reason_sql,
                                    database_used="ecp_prod",
                                    insights=[],
                                    html_components=self._generate_html_components(
                                        {
                                            "data": reason_rows,
                                            "sql_query": reason_sql,
                                            "database": "ecp_prod",
                                            "execution_success": True,
                                        },
                                        user_query,
                                    ),
                                    processing_time=(datetime.now() - start_time).total_seconds(),
                                )
                    return AgentResponse(
                        success=True,
                        content=self._build_error_fallback_response(user_query, reason_result.get("error")),
                        processing_time=(datetime.now() - start_time).total_seconds(),
                    )
                if self._is_daily_report_min_production_with_reason(user_query):
                    min_sql = (
                        "SELECT FECHA, ECP_VOL_ESTIMADO_DIA AS produccion "
                        "FROM V_DATA_GRAF_DAILY "
                        "ORDER BY ECP_VOL_ESTIMADO_DIA ASC LIMIT 1;"
                    )
                    min_result = self._execute_sql_query(
                        min_sql,
                        "ecp_prod",
                        user_query,
                        context=context,
                    )
                    if not min_result.get("execution_success"):
                        return AgentResponse(
                            success=True,
                            content=self._build_error_fallback_response(user_query, min_result.get("error")),
                            processing_time=(datetime.now() - start_time).total_seconds(),
                        )
                    rows = min_result.get("data", [])
                    if not rows:
                        return AgentResponse(
                            success=True,
                            content=self._build_error_fallback_response(user_query, None),
                            processing_time=(datetime.now() - start_time).total_seconds(),
                        )
                    row = rows[0]
                    fecha_raw = row.get("FECHA")
                    prod_val = row.get("produccion")
                    fecha_iso = None
                    fecha_ddmmyyyy = None
                    try:
                        fecha_dt = pd.to_datetime(fecha_raw, dayfirst=True, errors="coerce")
                        if pd.notna(fecha_dt):
                            fecha_iso = fecha_dt.strftime("%Y-%m-%d")
                            fecha_ddmmyyyy = fecha_dt.strftime("%d/%m/%Y")
                    except Exception:
                        fecha_iso = None

                    reason = None
                    if fecha_ddmmyyyy:
                        reason_sql = (
                            "SELECT POZO_COMMENT FROM RESUMEN_DIFERIDAS_MES_OLLAMA "
                            f"WHERE EVENT_DATE = '{fecha_ddmmyyyy}' LIMIT 1;"
                        )
                        reason_result = self._execute_sql_query(
                            reason_sql,
                            "ecp_prod",
                            user_query,
                            context=context,
                        )
                        if reason_result.get("execution_success"):
                            reason_rows = reason_result.get("data", [])
                            if reason_rows and isinstance(reason_rows[0], dict):
                                reason = reason_rows[0].get("POZO_COMMENT")

                    response_parts = [
                        "📊 **Producción mínima del reporte diario**",
                        f"Fecha: {fecha_raw}",
                        f"Producción: {prod_val}",
                    ]
                    if reason:
                        response_parts.append("")
                        response_parts.append("**Razón reportada:**")
                        response_parts.append(reason)
                    else:
                        response_parts.append("")
                        response_parts.append("No hay diferidas reportadas para esa fecha.")

                    return AgentResponse(
                        success=True,
                        content="\\n".join(response_parts),
                        data=rows,
                        sql_query=min_sql,
                        database_used="ecp_prod",
                        insights=[],
                        html_components=self._generate_html_components(
                            {
                                "data": rows,
                                "sql_query": min_sql,
                                "database": "ecp_prod",
                                "execution_success": True,
                            },
                            user_query,
                        ),
                        processing_time=(datetime.now() - start_time).total_seconds(),
                    )

            # Step 1: Get vector context for the query
            vector_context = self._get_vector_context(user_query, context)
            
            # Step 2: Build complete prompt
            full_prompt = self._build_prompt(user_query, vector_context, context)
            
            # Step 3: Generate response from LLM
            llm_response = self._generate_llm_response(full_prompt, context)
            
            # Step 4: Process LLM response (extract SQL, insights, etc.)
            processed_response = self._process_llm_response(llm_response, vector_context)
            
            # Step 5: Execute SQL if present
            if processed_response.get('sql_query'):
                execution_result = self._execute_sql_query(
                    processed_response['sql_query'],
                    processed_response.get('database', 'datagenesis'),
                    user_query,
                    context=context
                )
                processed_response.update(execution_result)

                if context and context.get("report_mode") == "daily_performance":
                    if self._is_daily_report_ranking_query(user_query):
                        data_rows = processed_response.get("data") or []
                        campos = []
                        for row in data_rows:
                            if isinstance(row, dict) and row.get("CAMPO"):
                                campos.append(row.get("CAMPO"))
                        campos = list(dict.fromkeys(campos))[:5]
                        processed_response["data"] = [{"CAMPO": c} for c in campos]
                        processed_response["ranking_only"] = True
            
            # Step 6: Generate HTML components
            html_components = self._generate_html_components(processed_response, user_query)
            
            # Step 7: Build final response
            processing_time = (datetime.now() - start_time).total_seconds()

            # Build appropriate response content
            data = processed_response.get('data')
            if processed_response.get('execution_success'):
                # Query executed successfully (with or without data) - build appropriate response
                content = self._build_data_response(processed_response, user_query)
            else:
                # Execution failed - show friendly message without technical error details
                content = self._build_error_fallback_response(user_query, processed_response.get('error'))
                # Log the technical error for debugging (not shown to user)
                if processed_response.get('error'):
                    logger.error(f"Query execution failed: {processed_response.get('error')}")

            # Safeguard: if we have actual data but content is fallback, fix it
            if data and len(data) > 0 and "No encontré resultados" in content:
                logger.warning("Safeguard triggered: data exists but content was fallback — fixing")
                content = self._build_data_response(processed_response, user_query)

            response = AgentResponse(
                success=True,  # Always return success=True to avoid showing error states
                content=content,
                data=data,
                sql_query=processed_response.get('sql_query'),
                database_used=processed_response.get('database'),
                insights=processed_response.get('insights', []),
                html_components=html_components,
                processing_time=processing_time
            )
            
            # Step 8: Learn from successful query (optional)
            self._learn_from_success(user_query, processed_response)
            
            return response
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error processing query: {e}")
            import traceback
            logger.error(traceback.format_exc())

            # Return friendly fallback message instead of technical error
            return AgentResponse(
                success=True,  # Always return success to avoid error UI states
                content=self._build_error_fallback_response(user_query, str(e)),
                processing_time=processing_time,
                error=None  # Don't expose error to frontend
            )

    def _get_vector_context(self, user_query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get relevant context from vector database"""
        try:
            if not self.vector_manager.is_available():
                logger.warning("Vector manager not available, using empty context")
                return {"vector_context": [], "sql_examples": [], "selected_database": "datagenesis"}
            
            # Get database context (includes schema, examples, and database selection)
            database_context = self.vector_manager.get_database_context(
                user_query,
                context.get('database_hint') if context else None
            )

            if context and context.get('database_hint'):
                database_context['selected_database'] = context['database_hint']
                database_context['force_database'] = True

            return database_context
            
        except Exception as e:
            logger.error(f"Error getting vector context: {e}")
            return {"vector_context": [], "sql_examples": [], "selected_database": "datagenesis"}

    def _build_prompt(self, user_query: str, vector_context: Dict, context: Dict = None) -> str:
        """Build complete prompt using agent configuration and vector context"""
        try:
            # Get base prompt template
            base_prompt_template = self.agent_config.get('base_prompt', '')
            
            # Prepare template variables
            template_vars = {
                'system_role': self.agent_config['base_prompts'].get('system_role', ''),
                'specialization': self.agent_config.get('specialization', ''),
                'user_query': user_query,
                'vector_context': self._format_vector_context(vector_context.get('vector_context', [])),
                'sql_examples': self._format_sql_examples(vector_context.get('sql_examples', [])),
                'selected_database': vector_context.get('selected_database', 'datagenesis'),
                'database_schema': self._get_database_schema(vector_context.get('selected_database', 'datagenesis')),
                'additional_context': self._format_additional_context(context or {})
            }
            
            # Format prompt template
            formatted_prompt = base_prompt_template.format(**template_vars)
            
            return formatted_prompt
            
        except Exception as e:
            logger.error(f"Error building prompt: {e}")
            return f"Consulta del usuario: {user_query}"

    def _generate_llm_response(self, prompt: str, context: Dict[str, Any] = None) -> str:
        """Generate response from Ollama"""
        if llm_manager.is_available():
            try:
                response = llm_manager.generate_response(
                    prompt=prompt,
                    temperature=0.1,
                    max_tokens=3000
                )
                if response:
                    return response
            except Exception as e:
                logger.error(f"Ollama failed: {e}")

        raise Exception("Ollama no está disponible")

    def _process_llm_response(self, llm_response: str, vector_context: Dict) -> Dict[str, Any]:
        """Process LLM response to extract structured information"""
        try:
            extracted_db = self._extract_database(llm_response)
            context_db = vector_context.get('selected_database', 'datagenesis')
            if vector_context.get('force_database'):
                selected_db = context_db
            else:
                selected_db = extracted_db or context_db
            
            logger.info(f"Database selection: extracted='{extracted_db}', context='{context_db}', final='{selected_db}'")
            
            # Ensure lowercase database names for consistency
            if selected_db:
                db_lower = selected_db.lower()
                db_upper = selected_db.upper()
                
                # Handle all variations of database names
                if db_lower in ['datagenesis'] or db_upper in ['DATAGENESIS']:
                    selected_db = 'datagenesis'
                elif db_lower in ['ecp_prod'] or db_upper in ['ECP_PROD'] or 'ecp' in db_lower:
                    selected_db = 'ecp_prod'
                elif db_lower in ['robustez'] or db_upper in ['ROBUSTEZ']:
                    selected_db = 'robustez'
                else:
                    logger.warning(f"Unknown database name '{selected_db}', using datagenesis as fallback")
                    selected_db = 'datagenesis'  # Default fallback
            else:
                selected_db = 'datagenesis'  # Default fallback
            
            logger.info(f"Final normalized database: '{selected_db}'")
            
            processed = {
                'explanation': llm_response,
                'sql_query': self._extract_sql_query(llm_response),
                'insights': self._extract_insights(llm_response),
                'database': selected_db
            }
            
            # If no SQL found, use the full response as explanation
            if not processed['sql_query']:
                logger.warning("No SQL query extracted from LLM response")
            
            return processed
            
        except Exception as e:
            logger.error(f"Error processing LLM response: {e}")
            return {'explanation': llm_response}
    
    def _extract_sql_query(self, llm_response: str) -> Optional[str]:
        """Extract SQL query from LLM response - Improved version"""
        import re
        
        if not llm_response:
            logger.warning("Empty LLM response")
            return None
            
        logger.info(f"Attempting SQL extraction from {len(llm_response)} char response")
        logger.warning(f"Full LLM response for SQL extraction: {llm_response}")
        
        try:
            # Method 1: SQL_QUERY: pattern (most common format) - more flexible
            pattern1 = r'(?:SQL_QUERY|SQL):\s*(.+?)(?=DATABASE:|EXPLANATION:|\n\n|\Z)'
            match1 = re.search(pattern1, llm_response, re.IGNORECASE | re.MULTILINE | re.DOTALL)
            if match1:
                sql = match1.group(1).strip()
                logger.debug(f"Raw SQL before cleaning: {sql}")
                # Clean up markdown syntax and other formatting
                sql = re.sub(r'```sql\s*', '', sql)  # Remove ```sql 
                sql = re.sub(r'\s*```', '', sql)     # Remove ```
                sql = re.sub(r'^\*+\s*', '', sql)   # Remove leading asterisks with spaces
                sql = re.sub(r'\s*\*+$', '', sql)   # Remove trailing asterisks with spaces
                # Only remove specific leading characters, not all non-letter chars
                sql = re.sub(r'^[;,\s\*\-]+', '', sql) # Remove leading semicolons, commas, spaces, asterisks, dashes
                sql = re.sub(r'\s+', ' ', sql).strip()
                logger.debug(f"Cleaned SQL: {sql}")
                # Check if SQL is meaningful (not just semicolon or empty)
                if sql and sql != ';' and len(sql) > 3:
                    if not sql.endswith(';'):
                        sql += ';'
                    logger.info(f"✅ SQL extracted with SQL_QUERY pattern: {sql[:100]}...")
                    return sql
                else:
                    logger.warning(f"SQL extracted but too short or empty: '{sql}'")
            
            # Method 2: Markdown SQL blocks (```sql ... ```)
            pattern2 = r'```sql\s*(.+?)\s*```'
            match2 = re.search(pattern2, llm_response, re.IGNORECASE | re.DOTALL)
            if match2:
                sql = match2.group(1).strip()
                logger.debug(f"Raw SQL from markdown: {sql}")
                sql = re.sub(r'^[;,\s\*\-]+', '', sql)
                sql = re.sub(r'\s+', ' ', sql).strip()
                if sql and sql != ';' and len(sql) > 3:
                    if not sql.endswith(';'):
                        sql += ';'
                    logger.info(f"✅ SQL extracted with markdown pattern: {sql[:100]}...")
                    return sql
                else:
                    logger.warning(f"Markdown SQL too short or empty: '{sql}'")
            
            # Method 3: Direct SELECT or WITH statement search (greedy for CTEs)
            pattern3 = r'((?:WITH|SELECT)[\s\S]+?;)'
            match3 = re.search(pattern3, llm_response, re.IGNORECASE)
            if match3:
                sql = match3.group(1).strip()
                logger.debug(f"Raw SQL from SELECT/WITH search: {sql}")
                sql = re.sub(r'\s+', ' ', sql).strip()
                if sql and sql != ';' and len(sql) > 3:
                    logger.info(f"✅ SQL extracted with SELECT/WITH pattern: {sql[:100]}...")
                    return sql
                else:
                    logger.warning(f"SELECT/WITH SQL too short: '{sql}'")
            
            # Method 4: Alternative patterns for different LLM formats
            alternative_patterns = [
                r'(?:Query|Consulta):\s*((?:WITH|SELECT)[\s\S]+?;)',
                r'((?:WITH|SELECT)[\s\S]+?;)\s*(?:Database|Base de datos)',
                r'```\s*((?:WITH|SELECT)[\s\S]+?)\s*```',
                r'((?:WITH|SELECT)[\s\S]+?)(?:\n\s*$|\Z)',
            ]
            
            for i, pattern in enumerate(alternative_patterns):
                match = re.search(pattern, llm_response, re.IGNORECASE | re.MULTILINE)
                if match:
                    sql = match.group(1).strip()
                    logger.debug(f"Alternative pattern {i+1} matched: {sql[:100]}")
                    sql = re.sub(r'^[;,\s\*\-]+', '', sql)
                    sql = re.sub(r'\s+', ' ', sql).strip()
                    if sql and sql != ';' and len(sql) > 10:
                        if not sql.endswith(';'):
                            sql += ';'
                        logger.info(f"✅ SQL extracted with alternative pattern {i+1}: {sql[:100]}...")
                        return sql

            # Method 5: Line-by-line parsing as final fallback
            lines = llm_response.split('\n')
            for line in lines:
                line_upper = line.strip().upper()
                if line_upper.startswith('SQL_QUERY:'):
                    sql = line.replace('SQL_QUERY:', '').strip()
                    # Clean up formatting
                    sql = re.sub(r'^\*+\s*', '', sql)      # Remove leading asterisks
                    sql = re.sub(r'\s*\*+$', '', sql)      # Remove trailing asterisks
                    sql = re.sub(r'^[;,\s\*\-]+', '', sql) # Remove leading junk chars
                    if sql and sql != ';' and len(sql) > 3:
                        if not sql.endswith(';'):
                            sql += ';'
                        logger.info(f"✅ SQL extracted from line: {sql[:100]}...")
                        return sql
                # Also check for direct SQL statements
                elif line_upper.startswith(('SELECT', 'WITH')):
                    sql = line.strip()
                    if sql and len(sql) > 3:
                        if not sql.endswith(';'):
                            sql += ';'
                        logger.info(f"✅ SQL extracted from direct line: {sql[:100]}...")
                        return sql
            
            # Method 6: Last resort - find any SQL-like content
            logger.warning("Trying last resort SQL extraction...")
            
            # Look for any string that looks like SQL
            sql_keywords = ['SELECT', 'WITH', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY']
            lines = llm_response.split('\n')
            potential_sql_lines = []
            
            for line in lines:
                line_upper = line.strip().upper()
                if any(keyword in line_upper for keyword in sql_keywords):
                    potential_sql_lines.append(line.strip())
            
            if potential_sql_lines:
                # Try to reconstruct SQL from multiple lines
                sql_candidate = ' '.join(potential_sql_lines)
                logger.warning(f"Found potential SQL from lines: {sql_candidate}")
                
                if len(sql_candidate) > 10:
                    if not sql_candidate.endswith(';'):
                        sql_candidate += ';'
                    logger.info(f"✅ SQL extracted via last resort: {sql_candidate[:100]}...")
                    return sql_candidate
            
            logger.warning("❌ Could not extract SQL from LLM response using any method")
            logger.warning(f"LLM response was: {llm_response}")
            
            # No fallback - let the system work naturally with vector DB and prompts
            logger.warning("No SQL extracted - relying on vector DB and agent prompts only")
            
            return None
            
        except Exception as e:
            logger.error(f"Error in SQL extraction: {e}")
            return None

    
    def _extract_database(self, llm_response: str) -> Optional[str]:
        """Extract database name from LLM response"""
        import re
        
        # Pattern: DATABASE: [name]
        match = re.search(r'DATABASE:\s*([^\s\n]+)', llm_response, re.IGNORECASE)
        if match:
            db_name = match.group(1).strip()
            db_lower = db_name.lower()
            
            # Handle all variations
            if 'datagenesis' in db_lower:
                return 'datagenesis'
            elif 'ecp' in db_lower or db_name.upper() == 'ECP_PROD':
                return 'ecp_prod'
            elif 'robustez' in db_lower or db_name.upper() == 'ROBUSTEZ':
                return 'robustez'

        return None
    
    def _extract_insights(self, llm_response: str) -> List[str]:
        """Extract insights from LLM response"""
        insights = []
        
        # Look for bullet points or numbered insights
        import re
        bullet_matches = re.findall(r'[•\-\*]\s+([^\n]+)', llm_response)
        insights.extend(bullet_matches)
        
        # Look for EXPLANATION section
        explanation_match = re.search(r'EXPLANATION:\s*(.+?)(?:\n\n|\Z)', llm_response, re.DOTALL | re.IGNORECASE)
        if explanation_match:
            insights.append(explanation_match.group(1).strip())
        
        return insights[:5]  # Limit to 5 insights

    def _build_error_fallback_response(self, user_query: str, technical_error: str = None) -> str:
        """
        Build a friendly fallback response when query execution fails
        NEVER shows technical error details to the user
        """
        # Log technical error for debugging (not shown to user)
        if technical_error:
            logger.error(f"Technical error (hidden from user): {technical_error}")

        # Build friendly user-facing message
        friendly_messages = [
            f"🔍 **Búsqueda completada**\n\n",
            f"No encontré resultados para: **{user_query}**\n\n",
            f"💡 **Sugerencias:**\n",
            f"• Intenta reformular tu pregunta con términos diferentes\n",
            f"• Verifica que el nombre del campo, pozo o gerencia sea correcto\n",
            f"• Prueba con un rango de fechas más amplio\n",
            f"• Pregunta por datos más generales (ej: 'producción total' en lugar de pozos específicos)\n\n",
            f"📊 Ejemplos de preguntas que puedo responder:\n",
            f"• 'Producción de petróleo del campo APIAY ayer'\n",
            f"• 'Ranking de campos por producción 2024'\n",
            f"• 'Pozos con WOR crítico en el último mes'\n"
        ]

        return "".join(friendly_messages)

    def _build_data_response(self, processed_response: Dict, user_query: str) -> str:
        """Build executive-formatted response content when we have real data"""
        data = processed_response.get('data', [])
        sql_query = processed_response.get('sql_query', '')
        database = processed_response.get('database', 'DataGenesis')
        execution_time = processed_response.get('execution_time', 0)

        # Log SQL query for debugging (not shown to user)
        logger.info(f"SQL Query executed for user: {sql_query}")

        if not data:
            return f"📊 **Análisis completado** - No se encontraron datos que coincidan con la consulta: '{user_query}'"

        # Check if all data values are NULL/None
        if self._all_values_are_null(data):
            return f"📊 **Consulta ejecutada exitosamente**\n\nNo se encontraron datos para: **{user_query}**\n\n💡 Esto puede deberse a:\n• La fecha consultada no tiene datos disponibles\n• El filtro aplicado no coincide con registros existentes\n• Los datos aún no han sido cargados al sistema"

        if len(data) >= 1 and isinstance(data[0], dict):
            row = data[0]
            if "fecha_inicio" in row and "fecha_fin" in row:
                return (
                    f"???? **Rango de fechas del reporte diario**\n\n"
                    f"Inicio: {row.get('fecha_inicio')}\n"
                    f"Fin: {row.get('fecha_fin')}\n\n"
                    f"*Fuente: {database}*"
                )
        
        # Compact single-line response — table and charts carry the detail
        return f"📊 **{user_query}** — {len(data):,} registros"

    def _all_values_are_null(self, data: List[Dict]) -> bool:
        """
        Check if all values in the data are NULL/None
        Returns True if data contains only NULL values (no useful information)
        """
        if not data:
            return True

        for row in data:
            if isinstance(row, dict):
                for value in row.values():
                    # Check if value is not None and not NaN
                    if value is not None:
                        # Handle pandas NaN
                        try:
                            import math
                            if not (isinstance(value, float) and math.isnan(value)):
                                return False  # Found a non-null value
                        except (TypeError, ValueError):
                            return False  # Found a non-null value

        return True  # All values are NULL

    def _extract_key_metrics_for_executives(self, data: List[Dict]) -> List[str]:
        """Extract key business metrics from data for executive summary"""
        metrics = []
        
        if not data:
            return metrics
            
        try:
            sample_row = data[0]
            total_records = len(data)
            
            # Production metrics
            if 'OIL_VOLUME' in sample_row:
                oil_values = [row.get('OIL_VOLUME', 0) for row in data if isinstance(row.get('OIL_VOLUME'), (int, float))]
                if oil_values:
                    total_oil = sum(oil_values)
                    avg_oil = total_oil / len(oil_values)
                    metrics.append(f"**Producción total de petróleo**: {total_oil:,.0f} bbl/día")
                    metrics.append(f"**Promedio por registro**: {avg_oil:,.1f} bbl/día")
            
            # GOR metrics
            if 'promedio_gor' in sample_row or 'GOR' in sample_row:
                gor_key = 'promedio_gor' if 'promedio_gor' in sample_row else 'GOR'
                gor_values = [row.get(gor_key, 0) for row in data if isinstance(row.get(gor_key), (int, float)) and row.get(gor_key) > 0]
                if gor_values:
                    avg_gor = sum(gor_values) / len(gor_values)
                    max_gor = max(gor_values)
                    metrics.append(f"**GOR promedio**: {avg_gor:.1f} scf/bbl")
                    if max_gor > avg_gor * 1.5:  # Flag high GOR
                        metrics.append(f"**GOR máximo**: {max_gor:.1f} scf/bbl ⚠️")
            
            # Field/Well counts
            if 'FIELD_NAME' in sample_row:
                unique_fields = len(set(row.get('FIELD_NAME', '') for row in data if row.get('FIELD_NAME')))
                metrics.append(f"**Campos analizados**: {unique_fields}")
            elif 'WELL_COMMON_NAME' in sample_row:
                unique_wells = len(set(row.get('WELL_COMMON_NAME', '') for row in data if row.get('WELL_COMMON_NAME')))
                metrics.append(f"**Pozos analizados**: {unique_wells}")
            
            # Water production
            if 'WATER' in sample_row:
                water_values = [row.get('WATER', 0) for row in data if isinstance(row.get('WATER'), (int, float))]
                if water_values:
                    total_water = sum(water_values)
                    metrics.append(f"**Producción total de agua**: {total_water:,.0f} bbl/día")
                    
        except Exception as e:
            logger.error(f"Error extracting executive metrics: {e}")
            
        return metrics[:4]  # Limit to 4 key metrics
    
    def _format_row_for_executives(self, row: Dict, index: int) -> str:
        """Format data row for executive presentation"""
        try:
            # Identify key fields and format them appropriately
            formatted_parts = []
            
            # Handle common field patterns
            if 'FIELD_NAME' in row:
                field_name = row.get('FIELD_NAME', 'N/A')
                formatted_parts.append(f"**{field_name}**")
                
            if 'WELL_COMMON_NAME' in row:
                well_name = row.get('WELL_COMMON_NAME', 'N/A')
                formatted_parts.append(f"**{well_name}**")
            
            # Production values
            production_values = []
            if 'OIL_VOLUME' in row:
                oil = row.get('OIL_VOLUME', 0)
                production_values.append(f"Petróleo: {oil:,.0f} bbl/día")
                
            if 'promedio_gor' in row:
                gor = row.get('promedio_gor', 0)
                if gor > 0:
                    production_values.append(f"GOR: {gor:.1f} scf/bbl")
                else:
                    production_values.append("GOR: N/D")
                    
            if 'WATER' in row:
                water = row.get('WATER', 0)
                production_values.append(f"Agua: {water:,.0f} bbl/día")
            
            # Dates
            if 'FECHA' in row:
                fecha = row.get('FECHA', 'N/A')
                formatted_parts.append(f"Fecha: {fecha}")
            
            # Build final format
            if formatted_parts:
                main_text = " - ".join(formatted_parts)
                if production_values:
                    main_text += f" ({', '.join(production_values)})"
                return f"{index}. {main_text}"
            else:
                # Fallback to simple format
                row_text = ", ".join([f"{k}: {v}" for k, v in row.items() if v is not None])
                return f"{index}. {row_text}"
                
        except Exception as e:
            logger.error(f"Error formatting row for executives: {e}")
            # Fallback formatting
            row_text = ", ".join([f"{k}: {v}" for k, v in row.items() if v is not None])
            return f"{index}. {row_text}"
    
    def _format_row_for_chat(self, row: Dict, index: int) -> str:
        """Format data row for simple chat presentation"""
        try:
            # Simple, clean format for chat
            main_parts = []

            # NEW: Handle Mes/Producto/Porcentaje patterns (percentage distribution data)
            if 'Mes' in row and 'Producto' in row and 'Porcentaje' in row:
                mes = row.get('Mes', '')
                producto = row.get('Producto', '')
                porcentaje = row.get('Porcentaje', 0)
                if porcentaje is not None:
                    return f"• **{mes}** - {producto}: {porcentaje}%"
                else:
                    return f"• **{mes}** - {producto}: N/D"

            # Handle common field patterns
            if 'FIELD_NAME' in row:
                field_name = row.get('FIELD_NAME', 'N/A')
                main_parts.append(field_name)

            if 'WELL_COMMON_NAME' in row:
                well_name = row.get('WELL_COMMON_NAME', 'N/A')
                main_parts.append(well_name)
            
            # Key values only
            key_values = []
            if 'promedio_gor' in row:
                gor = row.get('promedio_gor', 0)
                if gor > 0:
                    key_values.append(f"GOR: {gor:.1f}")
                else:
                    key_values.append("GOR: N/D")
            
            if 'OIL_VOLUME' in row:
                oil = row.get('OIL_VOLUME', 0)
                key_values.append(f"{oil:,.0f} bbl/día")
                
            # Build simple format
            if main_parts:
                main_text = " - ".join(main_parts)
                if key_values:
                    main_text += f" ({', '.join(key_values)})"
                return f"{index}. {main_text}"
            else:
                # Fallback to first 2 most important fields
                important_fields = ['FIELD_NAME', 'WELL_COMMON_NAME', 'promedio_gor', 'OIL_VOLUME']
                shown = []
                for field in important_fields:
                    if field in row and len(shown) < 2:
                        value = row[field]
                        if value is not None:
                            shown.append(f"{field}: {value}")
                
                if shown:
                    return f"{index}. {', '.join(shown)}"
                
                # NEW: Dynamic fallback - detect any meaningful data
                meaningful_parts = []
                for key, value in row.items():
                    if value is not None:
                        key_lower = key.lower()
                        # Prioritize names and codes
                        if any(term in key_lower for term in ['name', 'code', 'dmu']):
                            meaningful_parts.append(str(value))
                            break
                
                # Add first numeric value found
                for key, value in row.items():
                    if value is not None and isinstance(value, (int, float)) and len(meaningful_parts) < 2:
                        if 'oil' in key.lower() or 'volume' in key.lower():
                            meaningful_parts.append(f"{value:,.1f} bbl/día")
                        elif 'gas' in key.lower():
                            meaningful_parts.append(f"{value:,.1f} MSCF/día")
                        elif 'gor' in key.lower():
                            meaningful_parts.append(f"GOR: {value:.1f}")
                        elif 'pozos' in key.lower():
                            meaningful_parts.append(f"{int(value)} pozos")
                        else:
                            meaningful_parts.append(f"{value:,.1f}")
                        break
                
                return f"{index}. {' - '.join(meaningful_parts)}" if meaningful_parts else f"{index}. Registro {index}"
                
        except Exception as e:
            logger.error(f"Error formatting row for chat: {e}")
            # Very simple fallback
            return f"{index}. Registro {index}"
    
    def _get_current_timestamp(self) -> str:
        """Get formatted current timestamp"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M")

    def _extract_cte_names(self, sql_query: str) -> set:
        import re
        if not sql_query:
            return set()
        return set(
            name.upper()
            for name in re.findall(r"(?:\bwith|,)\s*([A-Za-z_][\w]*)\s+as\s*\(", sql_query, re.IGNORECASE)
        )

    def _extract_table_identifiers(self, sql_query: str) -> set:
        import re
        tables = set()
        if not sql_query:
            return tables

        cte_names = self._extract_cte_names(sql_query)
        for _, raw in re.findall(r"\\b(from|join)\\s+([^\\s,;]+)", sql_query, re.IGNORECASE):
            if raw.startswith("("):
                continue
            clean = raw.strip().strip("`\"[]")
            clean = clean.split(".")[-1]
            clean = clean.split("(")[0]
            name = clean.upper()
            if name and name not in cte_names:
                tables.add(name)
        return tables

    def _validate_daily_report_tables(self, sql_query: str) -> Optional[str]:
        allowed = {
            "REPORTE_SEMANAL",
            "V_DIFERIDAS_RESUMEN",
            "RESUMEN_DIFERIDAS_MES_OLLAMA",
        }
        tables = self._extract_table_identifiers(sql_query)
        disallowed = sorted([t for t in tables if t not in allowed])
        if disallowed:
            return (
                "Consulta bloqueada. En modo Reporte Diario solo se permiten: "
                "REPORTE_SEMANAL, V_DIFERIDAS_RESUMEN, RESUMEN_DIFERIDAS_MES_OLLAMA."
            )
        return None

    def _execute_sql_query(self, sql_query: str, database: str, user_query: str = "", context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute SQL query against appropriate database"""
        try:
            logger.info(f"Executing SQL on {database}: {sql_query[:100]}...")
            
            # Import database manager
            from utils.database import db_manager
            
            # Validate query safety first
            if not self._validate_query_safety(sql_query):
                logger.error(f"Query validation failed for SQL: {sql_query[:200]}")
                return {
                    'data': [],
                    'execution_success': False,
                    'error': 'Query validation failed - only SELECT and WITH (CTE) operations allowed'
                }
            
            # Extract and fill SQL parameters from user query context  
            logger.info(f"ORIGINAL SQL from LLM: {sql_query}")
            filled_sql = self._fill_sql_parameters(sql_query, user_query, database)

            if context and context.get("report_mode") == "daily_performance":
                blocked = self._validate_daily_report_tables(filled_sql)
                if blocked:
                    return {
                        'data': [],
                        'execution_success': False,
                        'error': blocked
                    }
            
            # Additional fix: For ECP_PROD database, ensure years are quoted (stored as TEXT)
            if database.lower() == "ecp_prod":
                filled_sql = self._fix_year_quotes_ecp_prod(filled_sql)

            # Fix case sensitivity for ROBUSTEZ text columns
            if database.lower() == "robustez":
                filled_sql = self._fix_case_sensitivity_robustez(filled_sql)

            logger.info(f"FINAL SQL after parameter filling: {filled_sql}")
            
            # Execute query using database manager with database selection
            result = db_manager.execute_query(filled_sql, params=None, database=database)
            
            if result.get('success'):
                df = result.get('data', pd.DataFrame())

                # Process and validate data quality
                processed_df = self._process_and_validate_data(df, database)

                # Convert DataFrame to list of dictionaries
                data = processed_df.to_dict('records') if not processed_df.empty else []
                logger.info(f"Query executed successfully: {len(data)} rows returned and processed")

                return {
                    'data': data,
                    'execution_success': True,
                    'rows_affected': len(data),
                    'execution_time': result.get('execution_time', 0.0)
                }
            else:
                logger.error(f"Query execution failed: {result.get('error')}")
                return {
                    'data': [],
                    'execution_success': False,
                    'error': result.get('error', 'Unknown database error')
                }
            
        except Exception as e:
            logger.error(f"Error executing SQL query: {e}")
            return {
                'data': [],
                'execution_success': False,
                'error': str(e)
            }
    
    def _process_and_validate_data(self, df: pd.DataFrame, database: str) -> pd.DataFrame:
        """
        Process and validate query results for data quality
        - Convert data types appropriately
        - Handle NULL/NaN values
        - Format dates consistently
        - Log data quality metrics
        """
        if df.empty:
            logger.info("Empty DataFrame - no processing needed")
            return df

        logger.info(f"Processing {len(df)} rows with {len(df.columns)} columns from {database}")

        try:
            processed_df = df.copy()

            # Track data quality metrics
            quality_metrics = {
                'total_rows': len(processed_df),
                'total_columns': len(processed_df.columns),
                'null_counts': {},
                'type_conversions': [],
                'warnings': []
            }

            for col in processed_df.columns:
                # Count and handle NULL/NaN values
                null_count = processed_df[col].isna().sum()
                if null_count > 0:
                    quality_metrics['null_counts'][col] = null_count
                    logger.debug(f"Column '{col}': {null_count} NULL values ({null_count/len(processed_df)*100:.1f}%)")

                # Convert data types based on column names and content
                col_lower = col.lower()

                # Date columns
                if any(keyword in col_lower for keyword in ['fecha', 'date', 'datetime', 'observation']):
                    try:
                        processed_df[col] = pd.to_datetime(processed_df[col], errors='coerce')
                        quality_metrics['type_conversions'].append(f"{col} → datetime")
                        logger.debug(f"Converted '{col}' to datetime")
                    except Exception as e:
                        logger.warning(f"Could not convert '{col}' to datetime: {e}")
                        quality_metrics['warnings'].append(f"Date conversion failed for '{col}'")

                # Numeric columns (petroleum metrics)
                elif any(keyword in col_lower for keyword in [
                    'oil_volume', 'bopd', 'water', 'gas', 'gor', 'wor',
                    'produccion', 'volumen', 'participacion', 'total'
                ]):
                    try:
                        # Convert to numeric, coercing errors to NaN
                        processed_df[col] = pd.to_numeric(processed_df[col], errors='coerce')
                        quality_metrics['type_conversions'].append(f"{col} → numeric")
                        logger.debug(f"Converted '{col}' to numeric")
                    except Exception as e:
                        logger.warning(f"Could not convert '{col}' to numeric: {e}")
                        quality_metrics['warnings'].append(f"Numeric conversion failed for '{col}'")

                # Year columns (special handling for ECP_PROD)
                elif 'año' in col_lower or 'year' in col_lower:
                    try:
                        # Keep as string for ECP_PROD, convert to int for others
                        if database.lower() == 'ecp_prod':
                            processed_df[col] = processed_df[col].astype(str)
                            quality_metrics['type_conversions'].append(f"{col} → string (ECP_PROD)")
                        else:
                            processed_df[col] = pd.to_numeric(processed_df[col], errors='coerce').astype('Int64')
                            quality_metrics['type_conversions'].append(f"{col} → int")
                        logger.debug(f"Processed year column '{col}'")
                    except Exception as e:
                        logger.warning(f"Could not process year column '{col}': {e}")

                # String columns - ensure consistent encoding
                elif processed_df[col].dtype == 'object':
                    try:
                        processed_df[col] = processed_df[col].astype(str).str.strip()
                        # Replace 'nan' strings with actual None
                        processed_df[col] = processed_df[col].replace('nan', None)
                        logger.debug(f"Cleaned string column '{col}'")
                    except Exception as e:
                        logger.warning(f"Could not clean string column '{col}': {e}")

            # Log quality summary
            total_nulls = sum(quality_metrics['null_counts'].values())
            null_percentage = (total_nulls / (len(processed_df) * len(processed_df.columns))) * 100 if len(processed_df) > 0 else 0

            logger.info(f"Data quality summary: {total_nulls} total NULLs ({null_percentage:.1f}%), {len(quality_metrics['type_conversions'])} type conversions, {len(quality_metrics['warnings'])} warnings")

            if quality_metrics['warnings']:
                logger.warning(f"Data processing warnings: {quality_metrics['warnings']}")

            # Round numeric columns to reasonable precision
            numeric_columns = processed_df.select_dtypes(include=['float64', 'float32']).columns
            for col in numeric_columns:
                col_lower = col.lower()
                # Different precision for different petroleum metrics
                if 'gor' in col_lower or 'wor' in col_lower:
                    processed_df[col] = processed_df[col].round(2)  # Ratios: 2 decimals
                elif 'participacion' in col_lower or 'pct' in col_lower:
                    processed_df[col] = processed_df[col].round(1)  # Percentages: 1 decimal
                else:
                    processed_df[col] = processed_df[col].round(1)  # Volumes: 1 decimal

            logger.info(f"Data processing completed successfully for {len(processed_df)} rows")
            return processed_df

        except Exception as e:
            logger.error(f"Error processing data: {e}")
            # Return original dataframe if processing fails
            return df

    def _validate_query_safety(self, query: str) -> bool:
        """Validate that query is safe to execute"""
        if not query or not query.strip():
            logger.warning(f"Query validation failed: Empty query")
            return False

        upper_query = query.upper().strip()
        logger.info(f"Validating query safety. First 100 chars: {upper_query[:100]}")

        # Must start with SELECT or WITH (for CTEs)
        if not (upper_query.startswith('SELECT') or upper_query.startswith('WITH')):
            logger.warning(f"Query validation failed: Query doesn't start with SELECT or WITH. Starts with: {upper_query[:50]}")
            return False

        # No dangerous operations
        forbidden = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC']
        for keyword in forbidden:
            if keyword in upper_query:
                logger.warning(f"Query validation failed: Forbidden keyword '{keyword}' found in query")
                return False

        logger.info(f"Query validation passed successfully")
        return True

    def _generate_html_components(self, processed_response: Dict, user_query: str) -> List[Any]:
        """Generate HTML components for rendering"""
        try:
            if not processed_response.get('data'):
                return []
                
            render_context = RenderContext(
                data=processed_response['data'],
                query_type=self._determine_query_type(user_query),
                agent_type=self.agent_type,
                database=processed_response.get('database', 'datagenesis'),
                user_query=user_query,
                sql_query=processed_response.get('sql_query'),
                insights=processed_response.get('insights'),
                metrics=processed_response.get('metrics')
            )
            
            html_components = self.html_injector.render_panel_1(render_context)
            
            return html_components
            
        except Exception as e:
            logger.error(f"Error generating HTML components: {e}")
            return []

    def _learn_from_success(self, user_query: str, processed_response: Dict):
        """Learn from successful queries by adding to vector database"""
        try:
            if (processed_response.get('execution_success') and 
                processed_response.get('sql_query') and 
                processed_response.get('data')):
                
                self.vector_manager.add_successful_query(
                    query=user_query,
                    sql=processed_response['sql_query'],
                    results_summary=f"Returned {len(processed_response.get('data', []))} records",
                    agent_type=self.agent_type
                )
                
        except Exception as e:
            logger.error(f"Error learning from success: {e}")

    def _format_vector_context(self, vector_results: List[SearchResult]) -> str:
        """Format vector search results for prompt"""
        if not vector_results:
            return "No hay contexto vectorial disponible."
            
        formatted = "Contexto relevante encontrado:\n"
        for i, result in enumerate(vector_results[:3]):  # Limit to top 3
            formatted += f"{i+1}. {result.content}\n"
            
        return formatted

    def _format_sql_examples(self, sql_examples: List[str]) -> str:
        """Format SQL examples for prompt"""
        if not sql_examples:
            return "No hay ejemplos SQL disponibles."
            
        formatted = "Ejemplos SQL similares:\n"
        for i, example in enumerate(sql_examples[:2]):  # Limit to top 2
            formatted += f"Ejemplo {i+1}:\n{example}\n\n"
            
        return formatted

    def _get_database_schema(self, database: str) -> str:
        """
        Get database schema information from KnowledgeBaseManager (SINGLE SOURCE OF TRUTH)

        OLD APPROACH (DEPRECATED): Hardcoded schemas embedded in code
        NEW APPROACH: Use KnowledgeBaseManager.format_schema_for_prompt()
        """
        try:
            # Use KnowledgeBaseManager to get formatted schema
            schema_formatted = self.kb_manager.format_schema_for_prompt(database)

            if schema_formatted:
                logger.debug(f"📋 Schema loaded from KnowledgeBaseManager for {database}")
                return schema_formatted
            else:
                logger.warning(f"Schema not found in KnowledgeBaseManager for {database}")
                return f"Schema no disponible para database: {database}"

        except Exception as e:
            logger.error(f"Error getting schema from KnowledgeBaseManager: {e}")
            return f"Error loading schema for database: {database}"

    def _format_additional_context(self, context: Dict) -> str:
        """Format additional context information"""
        if not context:
            return ""
            
        formatted = "Contexto adicional:\n"
        for key, value in context.items():
            if key not in ['database_hint']:  # Exclude internal keys
                formatted += f"- {key}: {value}\n"
                
        return formatted


    def _extract_insights(self, llm_response: str) -> List[str]:
        """Extract insights from LLM response"""
        # Basic insight extraction - can be enhanced
        insights = []
        
        lines = llm_response.split('\n')
        for line in lines:
            line = line.strip()
            if (line.startswith('*') or line.startswith('-') or 
                'insight' in line.lower() or 'análisis' in line.lower()):
                insights.append(line.lstrip('*- '))
                
        return insights[:5]  # Limit to 5 insights

    def _determine_query_type(self, user_query: str) -> str:
        """Determine query type for HTML rendering"""
        query_lower = user_query.lower()
        
        if any(keyword in query_lower for keyword in ['tendencia', 'evolución', 'histórico']):
            return 'trend_analysis'
        elif any(keyword in query_lower for keyword in ['comparar', 'versus', 'ranking']):
            return 'comparative_analysis'
        elif any(keyword in query_lower for keyword in ['top', 'mejor', 'mayor', 'menor']):
            return 'ranking_analysis'
        else:
            return 'general_query'

    def get_agent_stats(self) -> Dict[str, Any]:
        """Get agent statistics"""
        return {
            'agent_type': self.agent_type,
            'config_loaded': bool(self.agent_config),
            'vector_manager_available': self.vector_manager.is_available() if self.vector_manager else False,
            'html_injector_available': bool(self.html_injector)
        }
    
    def _fix_year_quotes_ecp_prod(self, sql_query: str) -> str:
        """Fix unquoted years in ECP_PROD queries (years are stored as TEXT)"""
        import re
        
        try:
            # Pattern to match AÑO = YYYY (unquoted 4-digit year)
            pattern = r'(AÑO\s*=\s*)(\b20\d{2}\b)(?!\w)'
            
            def quote_year(match):
                column_part = match.group(1)  # "AÑO = "
                year = match.group(2)         # "2024"
                return f"{column_part}'{year}'"  # "AÑO = '2024'"
            
            fixed_sql = re.sub(pattern, quote_year, sql_query, flags=re.IGNORECASE)
            
            if fixed_sql != sql_query:
                logger.info(f"Fixed unquoted years in ECP_PROD query: {sql_query} -> {fixed_sql}")
            
            return fixed_sql
            
        except Exception as e:
            logger.error(f"Error fixing year quotes: {e}")
            return sql_query

    def _fix_case_sensitivity_robustez(self, sql_query: str) -> str:
        """Fix case sensitivity for ROBUSTEZ text hierarchy columns.
        SQLite uses BINARY collation by default, so WHERE CAMPO = 'castilla'
        returns 0 rows when the stored value is 'CASTILLA'.
        This wraps bare column comparisons with UPPER() and uppercases the value.
        """
        import re

        try:
            # Columns that are TEXT and store values in UPPERCASE
            text_cols = ["VICEPRESIDENCIA", "GERENCIA", "ACTIVO", "CAMPO", "UWI"]
            fixed_sql = sql_query

            for col in text_cols:
                # Pattern: COL = 'value' or COL = "value" (not already wrapped in UPPER)
                # Negative lookbehind ensures we don't double-wrap UPPER(COL)
                pattern = rf"(?<!\bUPPER\()(\b{col}\b)\s*=\s*'([^']*)'"
                def upper_replacement(match):
                    column = match.group(1)
                    value = match.group(2).upper()
                    return f"UPPER({column}) = '{value}'"
                fixed_sql = re.sub(pattern, upper_replacement, fixed_sql, flags=re.IGNORECASE)

                # Also handle LIKE comparisons
                pattern_like = rf"(?<!\bUPPER\()(\b{col}\b)\s+LIKE\s+'([^']*)'"
                def upper_like_replacement(match):
                    column = match.group(1)
                    value = match.group(2).upper()
                    return f"UPPER({column}) LIKE '{value}'"
                fixed_sql = re.sub(pattern_like, upper_like_replacement, fixed_sql, flags=re.IGNORECASE)

            if fixed_sql != sql_query:
                logger.info(f"Fixed case sensitivity in ROBUSTEZ query")
                logger.info(f"  Before: {sql_query[:200]}")
                logger.info(f"  After:  {fixed_sql[:200]}")

            return fixed_sql

        except Exception as e:
            logger.error(f"Error fixing case sensitivity: {e}")
            return sql_query

    def _fill_sql_parameters(self, sql_query: str, user_query: str, database: str) -> str:
        """Fill SQL parameters by extracting values from user query context"""
        import re
        from datetime import datetime
        
        try:
            filled_sql = sql_query
            user_lower = user_query.lower()
            
            logger.info(f"Analyzing user query for parameters: '{user_query}'")
            
            # Extract year from user query
            year_match = re.search(r'\b(20\d{2}|\d{4})\b', user_query)
            if year_match:
                extracted_year = year_match.group(1)
                # For ECP_PROD database, years are stored as TEXT, so add quotes
                if database.lower() == "ecp_prod":
                    year_value = f"'{extracted_year}'"
                else:
                    year_value = extracted_year
                filled_sql = re.sub(r'@anio\b', year_value, filled_sql)
                logger.info(f"Extracted year: {extracted_year} (formatted as {year_value})")
                logger.info(f"SQL after year replacement: {filled_sql}")
            elif any(word in user_lower for word in ['último', 'actual', 'reciente']):
                current_year = str(datetime.now().year)
                # For ECP_PROD database, years are stored as TEXT, so add quotes
                if database.lower() == "ecp_prod":
                    year_value = f"'{current_year}'"
                else:
                    year_value = current_year
                filled_sql = re.sub(r'@anio\b', year_value, filled_sql)
                logger.info(f"Using current year: {current_year} (formatted as {year_value})")
            
            # Extract gerencia/vicepresidencia from user query
            gerencias = {
                'vp llanos': 'VP LLANOS', 'llanos': 'VP LLANOS',
                'vp sur': 'VP SUR', 'sur': 'VP SUR', 
                'vp norte': 'VP NORTE', 'norte': 'VP NORTE',
                'gaa': 'GAA', 'GAA': 'GAA',
                'gco': 'GCO', 'GCO': 'GCO',
                'gct': 'GCT', 'GCT': 'GCT',
                'gdc': 'GDC', 'GDC': 'GDC',
                'ggs': 'GGS', 'GGS': 'GGS',
                'glh': 'GLH', 'GLH': 'GLH',
                'gor': 'GOR', 'GOR': 'GOR',
                'gpa': 'GPA', 'GPA': 'GPA',
                'grm': 'GRM', 'GRM': 'GRM',
                'gsm': 'GSM', 'GSM': 'GSM',
                'gso': 'GSO', 'GSO': 'GSO',
                'gta': 'GTA', 'GTA': 'GTA',
                'other': 'OTHER', 'otras': 'OTRAS', 'otros': 'OTROS'
            }
            
            for key, value in gerencias.items():
                if key in user_lower:
                    filled_sql = re.sub(r'@gerencia\b', f"'{value}'", filled_sql)
                    logger.info(f"Extracted gerencia: {value}")
                    break
            
            # Handle temporal references for DataGenesis
            if database.lower() == "datagenesis":
                if 'ayer' in user_lower:
                    filled_sql = re.sub(r'@fecha\b', 'DATEADD(day, -1, CAST(GETDATE() AS DATE))', filled_sql)
                elif 'último mes' in user_lower or 'mes pasado' in user_lower:
                    filled_sql = re.sub(r'@fecha\b', 'DATEADD(month, -1, CAST(GETDATE() AS DATE))', filled_sql)
                elif 'hoy' in user_lower or 'actual' in user_lower:
                    filled_sql = re.sub(r'@fecha\b', 'CAST(GETDATE() AS DATE)', filled_sql)

            # Extract field/well/campo names from user query
            # Handle both :campo and @campo parameter formats
            if ':campo' in filled_sql or '@campo' in filled_sql:
                # Look for field names in uppercase (common pattern: APIAY, RUBIALES, CASTILLA, etc.)
                field_match = re.search(r'\b([A-Z]{3,}(?:-\d+)?)\b', user_query)
                if field_match:
                    extracted_field = field_match.group(1)
                    filled_sql = re.sub(r':campo\b', f"'{extracted_field}'", filled_sql)
                    filled_sql = re.sub(r'@campo\b', f"'{extracted_field}'", filled_sql)
                    logger.info(f"Extracted campo: {extracted_field}")
                else:
                    # Try lowercase field names after "campo" keyword
                    campo_match = re.search(r'campo\s+([a-zA-Z0-9-]+)', user_lower)
                    if campo_match:
                        extracted_field = campo_match.group(1).upper()
                        filled_sql = re.sub(r':campo\b', f"'{extracted_field}'", filled_sql)
                        filled_sql = re.sub(r'@campo\b', f"'{extracted_field}'", filled_sql)
                        logger.info(f"Extracted campo from keyword: {extracted_field}")

            # Extract pozo (well) names from user query
            # Handle both :pozo and @pozo parameter formats
            if ':pozo' in filled_sql or '@pozo' in filled_sql:
                # Look for well names (e.g., APIAY-1, CASTILLA-45)
                well_match = re.search(r'\b([A-Z]{3,}-\d+)\b', user_query)
                if well_match:
                    extracted_well = well_match.group(1)
                    filled_sql = re.sub(r':pozo\b', f"'{extracted_well}'", filled_sql)
                    filled_sql = re.sub(r'@pozo\b', f"'{extracted_well}'", filled_sql)
                    logger.info(f"Extracted pozo: {extracted_well}")
                else:
                    # Try lowercase well names after "pozo" keyword
                    pozo_match = re.search(r'pozo\s+([a-zA-Z0-9-]+)', user_lower)
                    if pozo_match:
                        extracted_well = pozo_match.group(1).upper()
                        filled_sql = re.sub(r':pozo\b', f"'{extracted_well}'", filled_sql)
                        filled_sql = re.sub(r'@pozo\b', f"'{extracted_well}'", filled_sql)
                        logger.info(f"Extracted pozo from keyword: {extracted_well}")

            # Only apply cleanup logic if there are still unfilled parameters
            # Check for both @ and : parameter formats
            unfilled_params = re.findall(r'[@:]\w+', filled_sql)
            logger.info(f"SQL after parameter filling: {filled_sql}")
            logger.info(f"Unfilled parameters remaining: {unfilled_params}")
            
            if unfilled_params:
                logger.info("Running cleanup logic for unfilled parameters")
                
                if '@gerencia' in filled_sql:
                    # Remove the gerencia filter to make query general
                    filled_sql = re.sub(r'\s+AND\s+[A-Z_]*VICE_HOM\s*=\s*@gerencia\b', '', filled_sql, flags=re.IGNORECASE)
                    filled_sql = re.sub(r'\s+WHERE\s+[A-Z_]*VICE_HOM\s*=\s*@gerencia\b', ' WHERE 1=1', filled_sql, flags=re.IGNORECASE)
                    logger.info("Removed @gerencia filter - making query general")
                
                if '@anio' in filled_sql:
                    # Remove year filter or use a reasonable range
                    if database.lower() == "ecp_prod":
                        filled_sql = re.sub(r'WHERE\s+AÑO\s*=\s*@anio\b', 'WHERE AÑO >= \'2020\'', filled_sql, flags=re.IGNORECASE)
                        filled_sql = re.sub(r'\s+AND\s+AÑO\s*=\s*@anio\b', ' AND AÑO >= \'2020\'', filled_sql, flags=re.IGNORECASE)
                        logger.info("Replaced @anio with recent years filter")
                    else:
                        filled_sql = re.sub(r'\s+AND\s+AÑO\s*=\s*@anio\b', '', filled_sql, flags=re.IGNORECASE)
                        logger.info("Removed @anio filter")
            else:
                logger.info("All parameters filled successfully - no cleanup needed")
            
            # Clean up any remaining parameters (both @ and : formats)
            remaining_params = re.findall(r'[@:]\w+', filled_sql)
            if remaining_params:
                logger.warning(f"Remaining unfilled parameters: {remaining_params}")
                for param in remaining_params:
                    # Remove WHERE clause with unfilled parameter or replace with 1=1
                    param_pattern = re.escape(param)
                    # Try to remove the entire WHERE condition with this parameter
                    filled_sql = re.sub(rf'\s+AND\s+\w+\s*=\s*{param_pattern}\b', '', filled_sql, flags=re.IGNORECASE)
                    filled_sql = re.sub(rf'\s+WHERE\s+\w+\s*=\s*{param_pattern}\b', ' WHERE 1=1', filled_sql, flags=re.IGNORECASE)
                    # If still present, replace with NULL as last resort
                    if param in filled_sql:
                        filled_sql = re.sub(param_pattern, 'NULL', filled_sql)
                        logger.warning(f"Replaced unfilled parameter {param} with NULL")
            
            # Clean up SQL formatting
            filled_sql = re.sub(r'\s+', ' ', filled_sql).strip()
            
            if filled_sql != sql_query:
                logger.info(f"SQL parameters filled successfully")
                
            return filled_sql
            
        except Exception as e:
            logger.error(f"Error filling SQL parameters: {e}")
            return sql_query  # Return original on error

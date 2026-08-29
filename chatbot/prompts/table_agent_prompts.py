"""
Table Agent Prompts - Legacy compatibility module
"""

# Legacy prompts for table-based agents
TABLE_AGENT_BASE_PROMPT = """
Eres un agente especializado en análisis de tablas de datos petroleros.
Tu función es generar consultas SQL y analizar resultados.
"""

QUERY_GENERATION_TEMPLATE = """
Basado en la pregunta del usuario, genera una consulta SQL apropiada:
Pregunta: {question}
Esquema: {schema}
Contexto: {context}
"""

EXPLANATION_TEMPLATE = """
Explica los resultados de la consulta:
Pregunta original: {question}
Consulta SQL: {sql_query}
Registros encontrados: {record_count}
"""

class TableAgentPrompts:
    """Legacy class for table agent prompts"""
    
    @staticmethod
    def get_base_prompt():
        return TABLE_AGENT_BASE_PROMPT
        
    @staticmethod
    def get_query_template():
        return QUERY_GENERATION_TEMPLATE
    
    @staticmethod
    def get_explanation_template():
        return EXPLANATION_TEMPLATE
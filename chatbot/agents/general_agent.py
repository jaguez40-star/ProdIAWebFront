"""
General Agent - For natural conversation and non-technical queries
"""

import logging
from typing import Dict, Any
from datetime import datetime
from .configurable_agent import ConfigurableAgent, AgentResponse

logger = logging.getLogger(__name__)

class GeneralAgent(ConfigurableAgent):
    """
    General conversational agent for greetings, help, and non-technical queries
    """
    
    def __init__(self, config_path: str = "config/master_prompts.yaml"):
        super().__init__(agent_type="general", config_path=config_path)
        logger.info("GeneralAgent initialized for conversational queries")
    
    def process_query(self, user_query: str, context: Dict[str, Any]) -> AgentResponse:
        """Process general conversational queries"""
        try:
            start_time = datetime.now()
            
            # Classify query type
            query_type = self._classify_general_query(user_query)
            
            # Generate appropriate response
            response_content = self._generate_general_response(user_query, query_type, context)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return AgentResponse(
                success=True,
                content=response_content,
                processing_time=processing_time,
                database_used=None,
                sql_query=None,
                data=None,
                insights=None
            )
            
        except Exception as e:
            logger.error(f"Error in GeneralAgent: {e}")
            return AgentResponse(
                success=False,
                content="Lo siento, hubo un error procesando tu consulta.",
                error=str(e)
            )
    
    def _classify_general_query(self, user_query: str) -> str:
        """Classify the type of general query"""
        query_lower = user_query.lower().strip()
        
        # Greetings
        if any(greeting in query_lower for greeting in ['hola', 'hello', 'hi', 'buenos días', 'buenas tardes', 'buenas noches']):
            return 'greeting'
        
        # Help requests  
        elif any(help_word in query_lower for help_word in ['ayuda', 'help', 'qué puedes hacer', 'como funciona']):
            return 'help'
        
        # Goodbyes
        elif any(goodbye in query_lower for goodbye in ['adiós', 'bye', 'hasta luego', 'nos vemos']):
            return 'goodbye'
        
        # General questions
        elif '?' in query_lower or any(question in query_lower for question in ['qué', 'cómo', 'cuándo', 'dónde', 'por qué']):
            return 'general_question'
        
        return 'general'
    
    def _generate_general_response(self, user_query: str, query_type: str, context: Dict[str, Any]) -> str:
        """Generate appropriate general response"""
        
        if query_type == 'greeting':
            return self._generate_greeting_response(context)
        elif query_type == 'help':
            return self._generate_help_response()
        elif query_type == 'goodbye':
            return "¡Hasta luego! Si necesitas analizar datos de producción petrolera, estaré aquí para ayudarte. 👋"
        elif query_type == 'general_question':
            return self._generate_contextual_response(user_query)
        else:
            return self._generate_default_response()
    
    def _generate_greeting_response(self, context: Dict[str, Any]) -> str:
        """Generate friendly greeting response"""
        import random
        
        greetings = [
            "¡Hola! Soy tu asistente especializado en análisis de datos de producción petrolera. ¿En qué puedo ayudarte hoy?",
            "¡Hola! Estoy aquí para ayudarte con consultas sobre producción de petróleo, análisis de campos y datos de pozos. ¿Qué te gustaría saber?",
            "¡Hola! ¿Tienes alguna consulta sobre producción petrolera, GOR, campos o análisis de datos? Estoy aquí para ayudarte.",
        ]
        
        return random.choice(greetings)
    
    def _generate_help_response(self) -> str:
        """Generate help information"""
        return """¡Te puedo ayudar con análisis de datos de producción petrolera! 

**Puedes preguntarme sobre:**
• **Producción por campo**: "producción del campo X"
• **Análisis de GOR/WOR**: "e por campo" 
• **Comparaciones**: "campos con mayor producción"
• **Datos de pozos**: "producción del pozo Y"
• **Tendencias**: "evolución de la producción"

**Ejemplos de consultas:**
- "¿Cuál fue la producción de aceite ayer?"
- "Muéstrame el top 5 de campos por BOPD"
- "¿Cómo ha evolucionado el GOR del campo APIAY?"

¡Solo pregúntame en lenguaje natural! 🛢️"""
    
    def _generate_contextual_response(self, user_query: str) -> str:
        """Generate contextual response for general questions"""
        return f"""Entiendo que tienes una consulta general. Mi especialidad es el análisis de datos de producción petrolera.

Si tu pregunta está relacionada con:
• **Datos de producción** (aceite, gas, agua)
• **Campos petroleros** y pozos
• **Métricas técnicas** (GOR, WOR, BOPD)
• **Análisis históricos** de producción

Solo reformula tu pregunta con estos términos y te ayudo con datos precisos. 

¿Hay algo específico sobre producción petrolera que te gustaría saber?"""
    
    def _generate_default_response(self) -> str:
        """Generate default response"""
        return """Estoy especializado en análisis de datos de producción petrolera. 

**Para mejores resultados, pregúntame sobre:**
- Producción de campos o pozos específicos
- Análisis de GOR (Gas-Oil Ratio) 
- Comparativas entre campos
- Datos históricos de producción
- Métricas de rendimiento

¿Hay algún análisis de producción petrolera que te interese? 🛢️"""
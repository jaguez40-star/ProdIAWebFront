"""
Supervisor Agent Prompts - Legacy compatibility module
"""

# Legacy prompts for backward compatibility
SUPERVISOR_SYSTEM_PROMPT = """
Eres un supervisor de agentes especializados en análisis de datos petroleros.
Tu función es determinar qué agente debe manejar cada consulta.
"""

ROUTING_INSTRUCTIONS = """
Ruta las consultas según las palabras clave de producción petrolera:
- producción, petróleo, crudo, pozo, campo, dmu, aceite, gas, agua, gor, wor
"""

class SupervisorPrompts:
    """Legacy class for backward compatibility"""
    
    @staticmethod
    def get_system_prompt():
        return SUPERVISOR_SYSTEM_PROMPT
        
    @staticmethod
    def get_routing_instructions():
        return ROUTING_INSTRUCTIONS
    
    @staticmethod
    def get_agent_selection_prompt():
        return "Select appropriate agent based on petroleum keywords"

# For backward compatibility
def get_supervisor_prompt():
    return SUPERVISOR_SYSTEM_PROMPT

def get_routing_instructions():
    return ROUTING_INSTRUCTIONS
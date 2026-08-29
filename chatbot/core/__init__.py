"""
Core chatbot components - New Vector-Enhanced Architecture
"""

try:
    from .vector_manager import get_vector_manager
    from .html_injector import get_html_injector
    from .base_agent import BaseAgent
    from .llm_manager import llm_manager
    from .agent_config import AgentConfig
    
    __all__ = [
        'get_vector_manager',
        'get_html_injector', 
        'BaseAgent',
        'llm_manager',
        'AgentConfig'
    ]
    
except ImportError as e:
    # Fallback for missing dependencies
    __all__ = []
    print(f"Warning: Core modules not fully available: {e}")
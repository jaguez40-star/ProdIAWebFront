"""
ECP Insights Chatbot Module - New Vector-Enhanced Architecture
Modern chatbot system with vector database integration and configurable agents

This module provides a scalable chatbot architecture with:
- Vector database for intelligent context retrieval
- YAML-based configuration system
- Specialized configurable agents
- Unified HTML injection system
"""

__version__ = "2.0.0"
__author__ = "ECP Insights Team"

# New architecture imports
try:
    from .core.vector_manager import get_vector_manager
    from .core.html_injector import get_html_injector
    from .agents.configurable_agent import ConfigurableAgent
    from .agents.production_agent import ProductionAgent
    from .agents.analytics_agent import AnalyticsAgent
    from .agents.followup_agent import FollowupAgent
    
    __all__ = [
        'get_vector_manager',
        'get_html_injector', 
        'ConfigurableAgent',
        'ProductionAgent',
        'AnalyticsAgent',
        'FollowupAgent',
    ]
    
except ImportError as e:
    # Minimal import for initialization
    __all__ = []
    print(f"Warning: Some modules not available during initialization: {e}")
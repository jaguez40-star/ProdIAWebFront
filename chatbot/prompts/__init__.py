"""
Prompts Module - Centralized prompt management for all agents
"""

from .prompt_manager import PromptManager
from .supervisor_prompts import SupervisorPrompts
from .table_agent_prompts import VentasPrompts, EmpleadosPrompts
from .followup_prompts import FollowUpPrompts
from .analytics_prompts import AnalyticsPrompts

__all__ = [
    'PromptManager',
    'SupervisorPrompts',
    'VentasPrompts',
    'EmpleadosPrompts', 
    'FollowUpPrompts',
    'AnalyticsPrompts'
]
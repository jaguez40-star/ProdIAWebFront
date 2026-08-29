"""
Base Agent for New Vector-Enhanced Architecture
"""

import logging
import yaml
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class AgentResponse:
    """Standardized agent response format"""
    success: bool
    content: str = ""
    data: Optional[List[Dict]] = None
    sql_query: Optional[str] = None
    error: Optional[str] = None
    processing_time: float = 0.0
    database_used: Optional[str] = None
    insights: Optional[List[str]] = None
    html_components: Optional[List[Dict]] = None

class BaseAgent(ABC):
    """Base class for all configurable agents in new architecture"""
    
    def __init__(self, agent_type: str):
        self.agent_type = agent_type
        self.logger = logging.getLogger(f"{__name__}.{agent_type}")
        
        # Load configuration
        self.config = self._load_config()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load agent configuration from YAML"""
        try:
            with open('config/master_prompts.yaml', 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            return config.get('agent_prompts', {}).get(self.agent_type, {})
        except Exception as e:
            self.logger.warning(f"Could not load config: {e}")
            return {}
    
    @abstractmethod
    def process_query(self, query: str, context: Dict[str, Any]) -> AgentResponse:
        """Process a query using the agent's specialization"""
        pass
    
    def _create_error_response(self, error_message: str) -> AgentResponse:
        """Create standardized error response"""
        return AgentResponse(
            success=False,
            error=error_message,
            content=f"Error: {error_message}"
        )
    
    def _create_success_response(self, content: str, **kwargs) -> AgentResponse:
        """Create standardized success response"""
        return AgentResponse(
            success=True,
            content=content,
            **kwargs
        )
"""
Agent Configuration Manager
"""

import yaml
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class AgentConfig:
    """Manages agent configuration from YAML files"""
    
    def __init__(self):
        self.config = self._load_config()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load master configuration from YAML"""
        try:
            with open('config/master_prompts.yaml', 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.warning(f"Could not load master config: {e}")
            return {}
    
    def get_agent_config(self, agent_type: str) -> Dict[str, Any]:
        """Get configuration for specific agent"""
        return self.config.get('agent_prompts', {}).get(agent_type, {})
    
    def get_system_prompt(self, agent_type: str) -> str:
        """Get system prompt for agent"""
        agent_config = self.get_agent_config(agent_type)
        base_prompt = agent_config.get('base_prompt', '')
        
        # Format with agent-specific values
        return base_prompt.format(
            system_role=self.config.get('system_prompts', {}).get('base_role', ''),
            specialization=agent_config.get('specialization', ''),
            **agent_config
        )
    
    def get_html_template(self, template_name: str) -> str:
        """Get HTML template by name"""
        return self.config.get('html_templates', {}).get(template_name, '')
        
    def get_scenario_template(self, scenario: str) -> str:
        """Get scenario-specific template"""
        return self.config.get('scenario_templates', {}).get(scenario, '')
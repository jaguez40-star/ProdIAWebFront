"""
Prompt Manager - Centralized management and loading of all prompts
"""

import logging
from typing import Dict, Any, Optional
from pathlib import Path
import yaml

logger = logging.getLogger(__name__)

class PromptManager:
    """Centralized prompt management system"""
    
    def __init__(self, prompts_dir: str = "chatbot/prompts"):
        """Initialize prompt manager"""
        self.prompts_dir = Path(prompts_dir)
        self.prompts_cache = {}
        self._load_all_prompts()
    
    def _load_all_prompts(self):
        """Load all prompt files"""
        try:
            # Load YAML prompt files
            yaml_files = list(self.prompts_dir.glob("*.yaml")) + list(self.prompts_dir.glob("*.yml"))
            
            for yaml_file in yaml_files:
                try:
                    with open(yaml_file, 'r', encoding='utf-8') as file:
                        prompts_data = yaml.safe_load(file)
                        agent_name = yaml_file.stem
                        self.prompts_cache[agent_name] = prompts_data
                        logger.info(f"Loaded prompts for {agent_name}")
                except Exception as e:
                    logger.error(f"Error loading {yaml_file}: {str(e)}")
            
            logger.info(f"Loaded prompts for {len(self.prompts_cache)} agents")
            
        except Exception as e:
            logger.error(f"Error loading prompts: {str(e)}")
            self.prompts_cache = {}
    
    def get_prompt(self, agent_type: str, prompt_name: str, **kwargs) -> str:
        """
        Get formatted prompt for an agent
        
        Args:
            agent_type: Type of agent (supervisor, ventas, empleados, etc.)
            prompt_name: Name of the prompt (routing, query_generation, etc.)
            **kwargs: Variables to format into the prompt
            
        Returns:
            Formatted prompt string
        """
        try:
            agent_prompts = self.prompts_cache.get(agent_type, {})
            prompt_template = agent_prompts.get(prompt_name, "")
            
            if not prompt_template:
                logger.warning(f"Prompt not found: {agent_type}.{prompt_name}")
                return self._get_fallback_prompt(agent_type, prompt_name)
            
            # Format with provided variables
            if kwargs:
                try:
                    return prompt_template.format(**kwargs)
                except KeyError as e:
                    logger.warning(f"Missing variable {e} in prompt {agent_type}.{prompt_name}")
                    return prompt_template
            
            return prompt_template
            
        except Exception as e:
            logger.error(f"Error getting prompt {agent_type}.{prompt_name}: {str(e)}")
            return self._get_fallback_prompt(agent_type, prompt_name)
    
    def _get_fallback_prompt(self, agent_type: str, prompt_name: str) -> str:
        """Get fallback prompt when specific prompt is not found"""
        fallbacks = {
            'routing': "Analyze the user question and determine the appropriate agent to handle it.",
            'query_generation': "Generate a SQL query to answer the user's question.",
            'explanation': "Explain the query results in a clear and helpful way.",
            'followup_generation': "Generate helpful follow-up questions based on the results.",
            'chart_recommendation': "Recommend appropriate charts for visualizing the data."
        }
        
        return fallbacks.get(prompt_name, "Please help the user with their request.")
    
    def get_system_prompt(self, agent_type: str, **kwargs) -> str:
        """Get system prompt for an agent"""
        return self.get_prompt(agent_type, 'system', **kwargs)
    
    def get_user_prompt(self, agent_type: str, prompt_name: str, **kwargs) -> str:
        """Get user/human prompt template"""
        return self.get_prompt(agent_type, prompt_name, **kwargs)
    
    def list_available_prompts(self, agent_type: Optional[str] = None) -> Dict[str, Any]:
        """List all available prompts"""
        if agent_type:
            return {agent_type: list(self.prompts_cache.get(agent_type, {}).keys())}
        
        return {
            agent: list(prompts.keys()) 
            for agent, prompts in self.prompts_cache.items()
        }
    
    def reload_prompts(self):
        """Reload all prompts from files"""
        self.prompts_cache.clear()
        self._load_all_prompts()
        logger.info("All prompts reloaded")
    
    def add_prompt(self, agent_type: str, prompt_name: str, prompt_content: str):
        """Add or update a prompt"""
        if agent_type not in self.prompts_cache:
            self.prompts_cache[agent_type] = {}
        
        self.prompts_cache[agent_type][prompt_name] = prompt_content
        logger.info(f"Added/updated prompt {agent_type}.{prompt_name}")
    
    def save_prompts_to_file(self, agent_type: str):
        """Save prompts for an agent to YAML file"""
        try:
            agent_prompts = self.prompts_cache.get(agent_type, {})
            if not agent_prompts:
                logger.warning(f"No prompts found for agent {agent_type}")
                return
            
            output_file = self.prompts_dir / f"{agent_type}.yaml"
            self.prompts_dir.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as file:
                yaml.dump(agent_prompts, file, default_flow_style=False, allow_unicode=True)
            
            logger.info(f"Saved prompts for {agent_type} to {output_file}")
            
        except Exception as e:
            logger.error(f"Error saving prompts for {agent_type}: {str(e)}")

# Global prompt manager instance  
prompt_manager = PromptManager()

__all__ = ['PromptManager', 'prompt_manager']
"""
Modern Production Agent - Uses vector database and configurable architecture
Specialized agent for petroleum production data analysis across two databases
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from .configurable_agent import AgentResponse, ConfigurableAgent

logger = logging.getLogger(__name__)


class ProductionAgent(ConfigurableAgent):
    """
    Modern production agent that leverages:
    - Vector database for intelligent context retrieval
    - YAML-based prompt configuration
    - Unified HTML injection for results
    - Support for both DataGenesis and ECP_PROD databases
    """

    def __init__(self, config_path: str = "config/master_prompts.yaml"):
        """Initialize modern production agent"""
        super().__init__(agent_type="production", config_path=config_path)

        # Production-specific settings
        self.timezone = "America/Bogota"
        self.max_years_default = 5

        # Statistics tracking
        self.stats = {
            "total_queries": 0,
            "successful_queries": 0,
            "database_routing": {"datagenesis": 0, "ecp_prod": 0},
        }

        logger.info(
            "Modern ProductionAgent initialized with vector-enhanced architecture"
        )

    def process_query(
        self, user_query: str, context: Dict[str, Any] = None
    ) -> AgentResponse:
        """Process production-related queries with enhanced context"""
        self.stats["total_queries"] += 1

        # Enhance context with production-specific information
        enhanced_context = self._enhance_production_context(user_query, context or {})

        # Process using base configurable agent logic
        response = super().process_query(user_query, enhanced_context)

        # Track statistics
        if response.success:
            self.stats["successful_queries"] += 1
            if response.database_used:
                self.stats["database_routing"][response.database_used] = (
                    self.stats["database_routing"].get(response.database_used, 0) + 1
                )

        # Add production-specific post-processing
        self._post_process_production_response(response, user_query)

        return response

    def _enhance_production_context(
        self, user_query: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Enhance context with production-specific information"""
        enhanced_context = context.copy()

        # Add petroleum domain context
        enhanced_context.update(
            {
                "domain": "petroleum_production",
                "timezone": self.timezone,
                "max_historical_years": self.max_years_default,
                "supported_metrics": [
                    "OIL_VOLUME",
                    "WATER",
                    "GAS",
                    "GOR",
                    "WOR",
                    "BOPD",
                ],
                "supported_entities": [
                    "pozo",
                    "campo",
                    "gerencia",
                    "vicepresidencia",
                    "dmu",
                ],
            }
        )

        # Enhance with query type classification
        query_type = self._classify_production_query(user_query)
        enhanced_context["query_type"] = query_type
        enhanced_context["temporal_scope"] = self._detect_temporal_scope(user_query)

        return enhanced_context

    def _classify_production_query(self, user_query: str) -> str:
        """Classify the type of production query"""
        query_lower = user_query.lower()

        # Daily production queries
        if any(
            keyword in query_lower
            for keyword in ["diario", "día", "ayer", "hoy", "pozo"]
        ):
            return "daily_production"

        # Annual analysis queries
        elif any(
            keyword in query_lower
            for keyword in ["anual", "año", "años", "bopd", "gerencia"]
        ):
            return "annual_analysis"

        # Trend analysis
        elif any(
            keyword in query_lower
            for keyword in ["tendencia", "evolución", "histórico"]
        ):
            return "trend_analysis"

        # Performance comparison
        elif any(
            keyword in query_lower
            for keyword in ["comparar", "versus", "ranking", "top"]
        ):
            return "performance_comparison"

        # Metrics analysis (GOR, WOR, etc.)
        elif any(
            keyword in query_lower for keyword in ["gor", "wor", "corte", "gas", "agua"]
        ):
            return "metrics_analysis"

        else:
            return "general_production"

    def _detect_temporal_scope(self, user_query: str) -> str:
        """Detect temporal scope of the query"""
        query_lower = user_query.lower()

        if any(keyword in query_lower for keyword in ["ayer", "hoy", "día"]):
            return "daily"
        elif any(keyword in query_lower for keyword in ["semana", "semanal"]):
            return "weekly"
        elif any(keyword in query_lower for keyword in ["mes", "mensual"]):
            return "monthly"
        elif any(keyword in query_lower for keyword in ["año", "anual", "años"]):
            return "annual"
        elif any(keyword in query_lower for keyword in ["histórico", "evolución"]):
            return "historical"
        else:
            return "unspecified"

    def _post_process_production_response(
        self, response: AgentResponse, user_query: str
    ):
        """Add production-specific post-processing to response"""
        if not response.success:
            return

        # Minimal post-processing - no insights or contextual analysis
        # Just ensure data integrity
        logger.debug(f"Post-processing production response for query: {user_query}")

    # Methods removed: _generate_production_insights and _enhance_content_with_units
    # These methods added unnecessary contextual analysis and recommendations


# Factory function for backward compatibility
def create_production_agent(
    config_path: str = "config/master_prompts.yaml",
) -> ProductionAgent:
    """Create a production agent instance"""
    return ProductionAgent(config_path)

"""
Robustez Agent - Specialized for economic robustness and profitability analysis
Queries the ROBUSTEZ.db database (RESULTADOSREGRESION table)
"""

import logging
from typing import Any, Dict

from .configurable_agent import AgentResponse, ConfigurableAgent

logger = logging.getLogger(__name__)


class RobustezAgent(ConfigurableAgent):
    """
    Agent specialized in robustness/profitability analysis:
    - Breakeven analysis by well, field, management unit
    - EBITDA aggregation and comparison
    - Profitability classification (RENTABLE/MARGINAL/NO RENTABLE)
    - Variable costs, transport, dilution analysis
    - Organizational hierarchy navigation (VP > Gerencia > Activo > Campo > UWI)
    """

    def __init__(self, config_path: str = "config/master_prompts.yaml"):
        """Initialize robustez agent"""
        super().__init__(agent_type="robustez", config_path=config_path)

        self.stats = {
            "total_queries": 0,
            "successful_queries": 0,
        }

        logger.info("RobustezAgent initialized for ROBUSTEZ database")

    def process_query(
        self, user_query: str, context: Dict[str, Any] = None
    ) -> AgentResponse:
        """Process robustez-related queries"""
        self.stats["total_queries"] += 1

        # Ensure context routes to robustez database
        enhanced_context = self._enhance_robustez_context(user_query, context or {})

        # Process using base configurable agent logic
        response = super().process_query(user_query, enhanced_context)

        if response.success:
            self.stats["successful_queries"] += 1

        return response

    def _enhance_robustez_context(
        self, user_query: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Enhance context with robustez-specific information"""
        enhanced_context = context.copy()

        # Force robustez database
        enhanced_context["database_hint"] = "robustez"

        enhanced_context.update(
            {
                "domain": "robustez_analysis",
                "supported_metrics": [
                    "EBITDA",
                    "BREAKEVEN",
                    "COSTOS_VARIABLES",
                    "TRANSPORTE",
                    "DILUCION",
                    "PRODUCCION_ACEITE",
                    "PRODUCCION_AGUA",
                ],
                "supported_entities": [
                    "vicepresidencia",
                    "gerencia",
                    "activo",
                    "campo",
                    "uwi",
                ],
            }
        )

        # Classify query type
        enhanced_context["query_type"] = self._classify_robustez_query(user_query)

        return enhanced_context

    def _classify_robustez_query(self, user_query: str) -> str:
        """Classify the type of robustez query"""
        query_lower = user_query.lower()

        if any(kw in query_lower for kw in ["breakeven", "punto de equilibrio", "equilibrio"]):
            return "breakeven_analysis"
        elif any(kw in query_lower for kw in ["ebitda", "margen"]):
            return "ebitda_analysis"
        elif any(kw in query_lower for kw in ["rentable", "marginal", "no rentable", "condición", "condicion", "clasificación"]):
            return "profitability_classification"
        elif any(kw in query_lower for kw in ["costo", "transporte", "dilución", "dilucion", "variable"]):
            return "cost_analysis"
        elif any(kw in query_lower for kw in ["vicepresidencia", "gerencia", "activo", "campo", "pozo", "uwi", "jerarquía", "jerarquia"]):
            return "hierarchy_query"
        else:
            return "general_robustez"


def create_robustez_agent(
    config_path: str = "config/master_prompts.yaml",
) -> RobustezAgent:
    """Create a robustez agent instance"""
    return RobustezAgent(config_path)

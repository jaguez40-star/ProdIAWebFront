"""
Query Router - Intelligent routing between General and Production agents

RESPONSIBILITY: Decides which AGENT TYPE to use (production vs general)
- Production Agent: Petroleum data queries requiring SQL execution
- General Agent: Conversational queries (greetings, help, general info)

NOTE: Database routing has been simplified (2025-10-15).
      All production queries now route to ECP_PROD database automatically.

FLOW:
    User Query
        ↓
    QueryRouter.route_query() → "production" or "general"
        ↓ (if production)
    ProductionAgent.process_query()
        ↓
    VectorManager.get_database_context()
        ↓
    VectorManager._determine_database() → "ecp_prod" (always)
"""

import logging
import re
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)


class QueryRouter:
    """
    Routes queries to appropriate specialized agents

    Routing Logic:
    - General Agent: Greetings, help requests, conversational queries
    - Production Agent: Any petroleum/oil/gas production data query

    NOTE: All production queries route to ECP_PROD database (simplified 2025-10-15).
    Database selection logic has been removed from VectorManager.
    """

    def __init__(self):
        # Petroleum production keywords
        # These keywords indicate petroleum production queries for ECP_PROD database
        self.production_keywords = [
            # === CORE METRICS ===
            "gor",
            "wor",
            "bopd",
            "producción",
            "petróleo",
            "aceite",
            "crudo",
            "gas",
            "agua",
            "water",
            "oil",
            "barril",
            "bbl",
            "mscf",
            "volumen",
            "volume",

            # === ENTITIES ===
            "campo",
            "pozo",
            "well",
            "field",
            "dmu",
            "apiay",
            "cusiana",
            "cupiagua",
            "volcanera",
            "castilla",
            "rubiales",
            "chichimene",

            # === ORGANIZATIONAL ENTITIES ===
            "gerencia",
            "vicepresidencia",
            "tt_gerencia",
            "nacional",
            "producción nacional",
            "vp llanos",
            "vp norte",
            "vp sur",
            "gaa",
            "gco",
            "gct",
            "gdc",
            "ggs",
            "glh",
            "gpa",
            "grm",
            "gsm",
            "gso",
            "gta",

            # === ANALYSIS TYPES (both databases) ===
            "promedio",
            "average",
            "total",
            "suma",
            "máximo",
            "mínimo",
            "top",
            "ranking",
            "comparación",
            "evolución",
            "tendencia",
            "histórico",
            "estadísticas",
            "reporte",
            "análisis",
            "desempeño",
            "balance",

            # === TEMPORAL KEYWORDS ===
            "anual",
            "mensual",
            "diario",
            "trimestre",
            "semestre",
            "por año",
            "por mes",
            "mes a mes",
            "año a año",

            # === TIME REFERENCES ===
            "ayer",
            "hoy",
            "semana",
            "mes",
            "año",
            "2023",
            "2024",
            "2025",
            "último",
            "última",
            "pasado",
            "anterior",
            "reciente",
            "actual",

            # === PRODUCT TYPES ===
            "hidrocarburos",
            "hidrocarburo",
            "producto",
            "productos",
            "líquidos",

            # === ANALYSIS TYPES ===
            "distribuye",
            "distribución",
            "segmentado",
            "participación",
            "porcentaje",
        ]

        # Robustez/profitability keywords
        self.robustez_keywords = [
            # === CORE ROBUSTEZ TERMS ===
            "robustez",
            "breakeven",
            "ebitda",
            "rentable",
            "rentabilidad",
            "marginal",
            "no rentable",
            "punto de equilibrio",

            # === COST ANALYSIS ===
            "costos variables",
            "costo variable",
            "transporte",
            "dilución",
            "dilucion",

            # === PRODUCTION VARIATION (ROBUSTEZ DB) ===
            "variacion",
            "variación",

            # === WELL CLASSIFICATION ===
            "tipo de pozo",
            "estado pozo",
            "activo",
            "inactivo",
            "suspendido",
            "abandonado",
            "uwi",

            # === ECONOMIC METRICS ===
            "mezcla",
            "bls mezcla",
            "kusd",
            "usd/bl",
        ]

        # General conversation keywords
        self.general_keywords = [
            "hola",
            "hello",
            "hi",
            "buenos días",
            "buenas tardes",
            "buenas noches",
            "ayuda",
            "help",
            "qué puedes hacer",
            "cómo funciona",
            "gracias",
            "thanks",
            "adiós",
            "bye",
            "hasta luego",
            "quién eres",
            "qué eres",
            "presentate",
        ]

    def route_query(
        self, user_query: str, context: Dict[str, Any] = None
    ) -> Tuple[str, float]:
        """
        Route query to appropriate agent

        Decision Logic:
        1. Strong general indicators (greetings, help) → General Agent
        2. Any petroleum keywords → Production Agent
        3. Short ambiguous phrases → General Agent
        4. Default for unclear → General Agent

        NOTE: All production queries route to ECP_PROD database (simplified 2025-10-15).

        Returns:
            Tuple[agent_type, confidence_score]
                agent_type: "production" or "general"
                confidence_score: 0.0 to 1.0
        """
        query_lower = user_query.lower().strip()

        # Calculate scores
        production_score = self._calculate_production_score(query_lower)
        general_score = self._calculate_general_score(query_lower)
        robustez_score = self._calculate_robustez_score(query_lower)

        logger.info(
            f"🔀 QueryRouter - Production: {production_score:.2f}, General: {general_score:.2f}, Robustez: {robustez_score:.2f}"
        )

        # Routing logic
        if general_score > 0.7 and production_score < 0.3 and robustez_score < 0.3:
            # Strong general indicators, weak petroleum/robustez
            logger.info(f"🗣️ Routing to GENERAL agent (strong conversational signal)")
            return "general", general_score
        elif robustez_score > 0.3 and robustez_score >= production_score:
            # Robustez query detected and stronger than production
            logger.info(f"💰 Routing to ROBUSTEZ agent (robustez/profitability query detected)")
            return "robustez", robustez_score
        elif production_score > 0.3:
            # Any significant petroleum indicator → Production
            logger.info(f"🛢️ Routing to PRODUCTION agent (petroleum query detected)")
            return "production", production_score
        elif len(query_lower.split()) <= 3 and general_score > 0.3:
            # Short phrases likely to be greetings
            logger.info(f"👋 Routing to GENERAL agent (short greeting)")
            return "general", general_score
        elif robustez_score > 0.1:
            # Weak robustez signal
            logger.info(f"💰 Routing to ROBUSTEZ agent (weak robustez signal)")
            return "robustez", robustez_score
        elif production_score > 0.1:
            # Has some petroleum keywords, route to production
            logger.info(f"🛢️ Routing to PRODUCTION agent (weak petroleum signal)")
            return "production", production_score
        else:
            # Default to general for ambiguous queries
            logger.info(f"❓ Routing to GENERAL agent (ambiguous/default)")
            return "general", 0.5

    def _calculate_production_score(self, query: str) -> float:
        """
        Calculate how likely the query is about petroleum production

        This score indicates if the query requires the Production Agent.
        All production queries route to ECP_PROD database.

        Scoring factors:
        - Keyword density (base score)
        - Years/temporal references (bonus)
        - Production units (bbl, mscf) (bonus)
        - Question patterns (bonus)
        - Technical terms (bonus)
        - Strategic keywords (nacional, ranking, etc.) (bonus)
        """
        words = query.split()
        word_count = len(words)

        if word_count == 0:
            return 0.0

        # Count keyword matches
        keyword_matches = sum(
            1 for keyword in self.production_keywords if keyword in query
        )

        # Base score from keyword density
        base_score = min(keyword_matches / word_count * 2, 1.0)

        # Bonus for specific patterns
        bonuses = 0.0

        # Numbers (years, quantities)
        if re.search(r"\b\d{4}\b", query):  # Years (2023, 2024, 2025)
            bonuses += 0.2
        if re.search(r"\b\d+\s*(bbl|barril|mscf|bopd)\b", query):  # Production units
            bonuses += 0.3

        # Question patterns about data (indicates data query)
        if any(
            pattern in query
            for pattern in ["cuál", "cuánto", "cuánta", "cómo", "dónde", "qué", "quién"]
        ):
            if keyword_matches > 0:
                bonuses += 0.2

        # Technical analysis terms (strong indicator of production query)
        if any(
            term in query for term in ["análisis", "reporte", "estadística", "datos", "desempeño", "balance"]
        ):
            bonuses += 0.2

        # Strategic/aggregated queries (ECP_PROD style queries)
        if any(
            term in query for term in ["nacional", "ranking", "distribución", "participación", "hidrocarburos"]
        ):
            bonuses += 0.25  # Strong indicator

        # Temporal patterns (mensual, anual, por año, etc.)
        if any(
            term in query for term in ["mensual", "anual", "por año", "por mes", "mes a mes"]
        ):
            bonuses += 0.15

        return min(base_score + bonuses, 1.0)

    def _calculate_general_score(self, query: str) -> float:
        """Calculate how likely the query is general conversation"""
        words = query.split()
        word_count = len(words)

        if word_count == 0:
            return 0.0

        # Count general keyword matches
        general_matches = sum(
            1 for keyword in self.general_keywords if keyword in query
        )

        # Base score
        base_score = min(general_matches / word_count * 3, 1.0)

        # Bonus for short queries (likely greetings)
        if word_count <= 2:
            base_score += 0.3

        # Bonus for greeting patterns
        if query.startswith(("hola", "hello", "hi", "buenos", "buenas")):
            base_score += 0.4

        # Penalty for having petroleum keywords
        production_matches = sum(
            1 for keyword in self.production_keywords if keyword in query
        )
        if production_matches > 0:
            base_score *= 0.3

        return min(base_score, 1.0)

    def _calculate_robustez_score(self, query: str) -> float:
        """
        Calculate how likely the query is about robustez/profitability analysis.

        Scoring factors:
        - Robustez keyword density (base score)
        - Strong economic indicators get high bonuses to beat production score
        """
        words = query.split()
        word_count = len(words)

        if word_count == 0:
            return 0.0

        # Count keyword matches
        keyword_matches = sum(
            1 for keyword in self.robustez_keywords if keyword in query
        )

        # Base score from keyword density
        base_score = min(keyword_matches / word_count * 2, 1.0)

        # Strong robustez indicators — these terms are UNIQUE to robustez
        # and should override production keywords like "campo" or "gerencia"
        bonuses = 0.0

        if any(term in query for term in ["breakeven", "ebitda", "robustez"]):
            bonuses += 0.5  # Very strong signal

        if any(term in query for term in ["rentable", "no rentable", "marginal", "rentabilidad"]):
            bonuses += 0.45  # Strong signal

        if any(term in query for term in ["costos variables", "transporte", "dilución", "dilucion"]):
            bonuses += 0.35

        if any(term in query for term in ["uwi", "tipo de pozo", "estado pozo"]):
            bonuses += 0.2

        if any(term in query for term in ["kusd", "usd/bl", "punto de equilibrio"]):
            bonuses += 0.3

        # "variacion de produccion" → ROBUSTEZ DB has monthly data for variation analysis
        if any(term in query for term in ["variacion", "variación"]):
            if any(term in query for term in ["produccion", "producción", "gerencia", "campo"]):
                bonuses += 0.55

        return min(base_score + bonuses, 1.0)

    def get_routing_explanation(
        self, user_query: str, agent_type: str, confidence: float
    ) -> str:
        """
        Get explanation of routing decision (for debugging)

        Returns human-readable explanation of why a query was routed
        to a specific agent type.
        """
        explanation = f"Query: '{user_query}' → {agent_type.upper()} Agent (confidence: {confidence:.2f})"

        if agent_type == "production":
            explanation += "\n  Reason: Petroleum production query detected"
            explanation += "\n  Database: ECP_PROD (all queries route here)"
        elif agent_type == "robustez":
            explanation += "\n  Reason: Robustez/profitability query detected"
            explanation += "\n  Database: ROBUSTEZ"
        else:
            explanation += "\n  Reason: Conversational/general query"

        return explanation


# Global router instance
query_router = QueryRouter()

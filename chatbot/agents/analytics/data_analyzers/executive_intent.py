"""
Executive intent analysis for intelligent follow-up generation
Detects business intent behind queries to provide strategic recommendations
"""

from typing import Any, Dict, List
import pandas as pd


def analyze_executive_intent(
    question: str, data: pd.DataFrame, query_type: str
) -> Dict[str, Any]:
    """
    Analyze executive intent behind the query for intelligent follow-ups

    Args:
        question: Natural language question from user
        data: DataFrame containing the data
        query_type: Detected query type

    Returns:
        Dictionary containing:
            - intent_type: Type of business intent
            - key_metrics: Relevant metrics for this intent
            - suggested_drilldowns: Recommended analysis directions
            - business_context: Business explanation
            - executive_priority: Priority score (0-1)
    """
    question_lower = question.lower()
    columns = list(data.columns) if not data.empty else []

    # Determine executive intent category
    intent_type = "general"
    key_metrics = []
    suggested_drilldowns = []
    business_context = ""

    # Participation/Share Analysis Intent
    if any(
        kw in question_lower
        for kw in [
            "participación", "participacion",
            "porcentaje", "distribución", "distribucion", "share",
        ]
    ):
        intent_type = "market_share"
        key_metrics = [
            col
            for col in columns
            if any(x in col.lower() for x in ["participacion", "pct", "porcentaje"])
        ]
        suggested_drilldowns = ["ranking", "trending", "benchmark", "composition"]
        business_context = (
            "Análisis de participación para decisiones estratégicas de mercado"
        )

    # Temporal/Growth Analysis Intent
    elif any(
        kw in question_lower
        for kw in [
            "evolución", "evolucion", "tendencia", "yoy",
            "crecimiento", "histórico", "historico",
        ]
    ):
        intent_type = "growth_analysis"
        key_metrics = [
            col
            for col in columns
            if any(x in col.lower() for x in ["bopd", "produccion", "volumen"])
        ]
        suggested_drilldowns = [
            "projection",
            "seasonal",
            "comparative",
            "acceleration",
        ]
        business_context = "Análisis de crecimiento para planificación estratégica"

    # Performance/Ranking Intent
    elif any(
        kw in question_lower
        for kw in ["ranking", "mejor", "top", "comparar", "eficiencia"]
    ):
        intent_type = "performance_ranking"
        key_metrics = [
            col
            for col in columns
            if any(x in col.lower() for x in ["bopd", "produccion", "eficiencia"])
        ]
        suggested_drilldowns = [
            "benchmarking",
            "gap_analysis",
            "best_practices",
            "optimization",
        ]
        business_context = (
            "Análisis de performance para identificación de oportunidades"
        )

    # Operational/KPI Intent
    elif any(
        kw in question_lower
        for kw in [
            "producción", "produccion",  # with and without accent
            "volumen", "operacion", "operación", "kpi",
            "comportamiento", "tasa",
        ]
    ):
        intent_type = "operational_kpis"
        key_metrics = [
            col
            for col in columns
            if any(x in col.lower() for x in ["bopd", "gor", "wor", "volumen"])
        ]
        suggested_drilldowns = ["targets", "alerts", "drill_down", "correlation"]
        business_context = "Análisis operacional para optimización de procesos"

    return {
        "intent_type": intent_type,
        "key_metrics": key_metrics,
        "suggested_drilldowns": suggested_drilldowns,
        "business_context": business_context,
        "executive_priority": calculate_executive_priority(intent_type, key_metrics),
    }


def calculate_executive_priority(intent_type: str, key_metrics: List[str]) -> float:
    """
    Calculate priority score for executive relevance

    Args:
        intent_type: Type of business intent
        key_metrics: Relevant metrics identified

    Returns:
        Priority score between 0 and 1
    """
    base_scores = {
        "market_share": 0.95,  # High priority for strategic decisions
        "growth_analysis": 0.90,  # High priority for planning
        "performance_ranking": 0.85,  # Important for optimization
        "operational_kpis": 0.75,  # Operational importance
    }
    return base_scores.get(intent_type, 0.5)

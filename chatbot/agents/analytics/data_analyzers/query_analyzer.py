"""
Query type detection for intelligent chart recommendations
Analyzes natural language queries to determine visualization intent
"""

import logging
import pandas as pd

logger = logging.getLogger(__name__)


def detect_query_type(question: str, data: pd.DataFrame) -> str:
    """
    Detect the type of query to suggest appropriate visualizations

    Args:
        question: Natural language question from user
        data: DataFrame containing the data

    Returns:
        Query type: 'temporal', 'comparison', 'distribution', 'correlation', 'production_analysis', 'general'
    """
    question_lower = question.lower()

    # Check specific comparison patterns first (higher priority)
    specific_comparison_patterns = [
        "participación",
        "participacion",
        "porcentaje por gerencia",
        "participación anual",
        "distribución por",
        "ranking",
        "share",
    ]
    if any(pattern in question_lower for pattern in specific_comparison_patterns):
        logger.info(
            f"🎯 Detected COMPARISON query type for: '{question}' - Pattern matched"
        )
        return "comparison"

    # Temporal analysis keywords
    temporal_keywords = [
        "evolución",
        "evolucion",
        "tendencia",
        "tiempo",
        "histórico",
        "historico",
        "mensual",
        "anual",
        "diario",
        "temporal",
        "fecha",
        "periodo",
        "por mes",
        "por año",
        "por meses",
        "cada mes",
        "mes a mes",
        "mes por mes",
        "año a año",
        "serie",
        "a lo largo",
    ]
    if any(keyword in question_lower for keyword in temporal_keywords):
        logger.info(
            f"🎯 Detected TEMPORAL query type for: '{question}' - Keyword matched"
        )
        return "temporal"

    # Data-driven temporal detection: if data has temporal columns with multiple values
    # This must run BEFORE generic keyword checks (production_analysis, comparison, etc.)
    # so that time series data gets line charts instead of pie/ranking.
    if not data.empty:
        cols_lower = {col.lower(): col for col in data.columns}
        mes_col = next(
            (cols_lower[c] for c in cols_lower if c == "mes" or c == "month"), None
        )
        año_col = next(
            (cols_lower[c] for c in cols_lower if "año" in c or c == "year"), None
        )

        if mes_col and data[mes_col].nunique() >= 3:
            logger.info(
                f"🎯 Detected TEMPORAL query type for: '{question}' - MES column has {data[mes_col].nunique()} distinct values"
            )
            return "temporal"
        if año_col and data[año_col].nunique() >= 2:
            logger.info(
                f"🎯 Detected TEMPORAL query type for: '{question}' - AÑO column has {data[año_col].nunique()} distinct values"
            )
            return "temporal"

    # Comparison keywords (general)
    comparison_keywords = [
        "comparar",
        "versus",
        "vs",
        "diferencia",
        "ranking",
        "mejor",
        "peor",
        "por campo",
        "por pozo",
        "por vicepresidencia",
        "entre campos",
        "entre pozos",
        "participación",
        "participacion",
        "porcentaje",
        "share",
        "distribución por",
        "participación anual",
        "porcentaje por gerencia",
    ]
    if any(keyword in question_lower for keyword in comparison_keywords):
        return "comparison"

    # Distribution keywords
    distribution_keywords = [
        "distribución",
        "promedio",
        "máximo",
        "mínimo",
        "estadística",
    ]
    if any(keyword in question_lower for keyword in distribution_keywords):
        return "distribution"

    # Correlation keywords
    correlation_keywords = ["relación", "correlación", "gor", "wor", "influencia"]
    if any(keyword in question_lower for keyword in correlation_keywords):
        return "correlation"

    # Production-specific patterns
    if "producción" in question_lower and (
        "agua" in question_lower or "aceite" in question_lower
    ):
        return "production_analysis"

    return "general"

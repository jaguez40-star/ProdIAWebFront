"""
Placeholder module for "Principales eventos de la semana y variacion diaria - Pagina en construccion".
"""

from typing import Any, Dict

__all__ = ["create_weekly_events_payload"]


def create_weekly_events_payload(
    db_connection,
    config: Dict[str, Any] = None,
    summary_table: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """Return a minimal payload indicating the page is under construction."""
    return {
        "success": True,
        "chart_data": None,
        "summary_table": {
            "headers": [],
            "rows": [],
            "title": "Principales eventos de la semana y variacion diaria - Pagina en construccion",
        },
        "analysis_table": None,
        "production_types_table": None,
        "data_points": 0,
        "date_range": None,
        "metrics": [],
        "chart_type": "production_weekly_events",
        "message": "Principales eventos de la semana y variacion diaria - Pagina en construccion",
    }

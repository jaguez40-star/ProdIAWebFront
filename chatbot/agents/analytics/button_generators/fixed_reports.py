"""
Fixed Production Reports Module
Provides always-visible production report buttons regardless of query context
"""

import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


def get_fixed_production_report_button() -> Dict[str, Any]:
    """
    Returns the fixed production report button structure
    This button is ALWAYS visible in followup suggestions
    """
    return {
        "id": "fixed_report_production",
        "title": "📊 Reporte Desempeño de Producción",
        "type": "expandable",
        "always_visible": True,
        "priority": 100,  # Highest priority to always appear first
        "css_class": "btn btn-success btn-sm fixed-report-button",
        "icon": "fas fa-chart-bar",
        "options": [
            {
                "id": "daily_performance",
                "title": "Desempeño de la Producción (diario)",
                "description": "Balance diario y mensual de producción",
                "enabled": True,
                "chart_type": "production_daily_performance",
                "icon": "fas fa-check-circle",
                "css_class": "report-option enabled",
                "config": {
                    "report_type": "daily_performance",
                    "table": "REPORTE_SEMANAL",
                    "columns": [
                        "FECHA",
                        "Q_Real",
                        "Q_POP",
                        "ECP_META_741",
                        "ECP_META_747",
                        "ECP_META_755"
                    ],
                    "chart_config": {
                        "type": "multi_line",
                        "x_axis": "FECHA",
                        "y_axes": [
                            {"column": "Q_Real", "name": "Q Real", "color": "#2E7D32"},
                            {"column": "Q_POP", "name": "Q POP", "color": "#1976D2"},
                            {"column": "ECP_META_741", "name": "ECP META 741", "color": "#D32F2F"},
                            {"column": "ECP_META_747", "name": "ECP META 747", "color": "#F57C00"},
                            {"column": "ECP_META_755", "name": "ECP META 755", "color": "#7B1FA2"}
                        ],
                        "title": "Desempeño de la Producción (Diario)",
                        "x_title": "Fecha",
                        "y_title": "Producción (kbpd)",
                        "show_legend": True,
                        "show_grid": True
                    }
                }
            },
            {
                "id": "monthly_balance",
                "title": "Balance (mes)",
                "description": "Balance mensual de producción",
                "enabled": True,
                "chart_type": "production_monthly_balance",
                "icon": "fas fa-check-circle",
                "css_class": "report-option enabled",
                "config": {
                    "report_type": "monthly_balance",
                    "chart_config": {
                        "title": "Balance Mensual de Producción"
                    }
                }
            }
        ]
    }


def get_enabled_report_options() -> List[Dict[str, Any]]:
    """
    Returns only enabled report options for quick access
    """
    report = get_fixed_production_report_button()
    return [opt for opt in report["options"] if opt.get("enabled", False)]


def get_report_option_by_id(option_id: str) -> Dict[str, Any]:
    """
    Get specific report option configuration by ID

    Args:
        option_id: The ID of the report option (e.g., 'daily_performance')

    Returns:
        Report option configuration or None if not found
    """
    report = get_fixed_production_report_button()
    for option in report["options"]:
        if option["id"] == option_id:
            return option

    logger.warning(f"Report option '{option_id}' not found")
    return None


def should_show_fixed_report(context: Dict[str, Any] = None) -> bool:
    """
    Determines if the fixed report button should be shown
    Currently always returns True (always visible)

    Args:
        context: Optional context about the current query/state

    Returns:
        bool: Always True for now
    """
    return True


def format_fixed_button_for_frontend(button_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format the fixed button data for frontend consumption

    Args:
        button_data: Raw button data from get_fixed_production_report_button()

    Returns:
        Formatted button data ready for JSON serialization
    """
    return {
        "id": button_data["id"],
        "title": button_data["title"],
        "type": button_data["type"],
        "priority": button_data["priority"],
        "css_class": button_data["css_class"],
        "icon": button_data.get("icon"),
        "expandable": True,
        "options": [
            {
                "id": opt["id"],
                "title": opt["title"],
                "description": opt.get("description", ""),
                "enabled": opt.get("enabled", False),
                "icon": opt.get("icon"),
                "css_class": opt.get("css_class"),
                "action": "load_report" if opt.get("enabled") else None,
                "action_data": {
                    "report_type": opt["config"].get("report_type"),
                    "chart_type": opt.get("chart_type")
                } if opt.get("enabled") else None
            }
            for opt in button_data["options"]
        ]
    }


# Export main functions
__all__ = [
    "get_fixed_production_report_button",
    "get_enabled_report_options",
    "get_report_option_by_id",
    "should_show_fixed_report",
    "format_fixed_button_for_frontend"
]

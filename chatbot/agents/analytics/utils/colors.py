"""
Color schemes and utilities for analytics visualizations
Provides petroleum-specific color palettes and chart coloring logic
"""

from typing import Any, Dict, List


# Color schemes for different chart types and petroleum metrics
COLOR_SCHEMES = {
    "petroleum_colors": ["#1f4e79", "#f7db17", "#ff5f00", "#004236", "#8b1538"],
    "oil_production": "#1f4e79",  # Deep blue for oil
    "water_production": "#0099cc",  # Light blue for water
    "gas_production": "#ff5f00",  # Orange for gas
    "gor_wor": "#f7db17",  # Yellow for ratios
    "comparison": ["#1f4e79", "#f7db17", "#ff5f00", "#004236", "#8b1538"],
    "temporal": "#1f4e79",
    "distribution": "#004236",
    "correlation": ["#1f4e79", "#ff5f00"],
}


def get_chart_color(
    chart_type: str, metric_name: str = "", data_context: Dict = None
) -> Any:
    """
    Get appropriate color for chart based on type and petroleum metrics

    Args:
        chart_type: Type of chart (bar, line, pie, etc)
        metric_name: Name of the metric being visualized
        data_context: Additional context about the data

    Returns:
        Color string or list of colors
    """
    metric_lower = metric_name.lower() if metric_name else ""

    # Petroleum-specific colors
    if "oil" in metric_lower or "aceite" in metric_lower or "bopd" in metric_lower:
        return COLOR_SCHEMES["oil_production"]
    elif "water" in metric_lower or "agua" in metric_lower:
        return COLOR_SCHEMES["water_production"]
    elif "gas" in metric_lower:
        return COLOR_SCHEMES["gas_production"]
    elif "gor" in metric_lower or "wor" in metric_lower:
        return COLOR_SCHEMES["gor_wor"]

    # Chart-type specific colors
    if (
        chart_type in ["bar", "column"]
        and data_context
        and data_context.get("multiple_series")
    ):
        return COLOR_SCHEMES["comparison"]
    elif chart_type in ["line", "area"]:
        return COLOR_SCHEMES["temporal"]
    elif chart_type == "histogram":
        return COLOR_SCHEMES["distribution"]
    elif chart_type == "scatter":
        return COLOR_SCHEMES["correlation"][0]

    # Default petroleum color
    return COLOR_SCHEMES["petroleum_colors"][0]


def get_petroleum_color_palette() -> List[str]:
    """
    Get the petroleum color palette for charts

    Returns:
        List of color hex codes
    """
    return COLOR_SCHEMES["petroleum_colors"]

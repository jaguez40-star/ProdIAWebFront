"""
Line Charts Module
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from ..utils import (
    translate_column_name,
    get_chart_color,
    get_petroleum_color_palette,
    generate_intelligent_chart_title,
    COLOR_SCHEMES,
)
from ..data_analyzers import (
    identify_numeric_columns,
    identify_categorical_columns,
    identify_date_columns,
)

logger = logging.getLogger(__name__)

# Month number → Spanish month name mapping
MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

def _create_line_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create line chart configuration with translations and colors"""
        x_col = config.get("x_axis")
        y_cols = config.get("y_axis", [])

        # Apply year filter if specified
        filtered_data = data.copy()
        if config.get("filter_year"):
            year = config["filter_year"]
            date_cols = identify_date_columns(filtered_data)
            if date_cols:
                date_col = date_cols[0]
                try:
                    if 'año' in date_col.lower() or 'year' in date_col.lower():
                        filtered_data = filtered_data[filtered_data[date_col].astype(str) == str(year)]
                    else:
                        date_series = pd.to_datetime(filtered_data[date_col], errors='coerce')
                        filtered_data = filtered_data[date_series.dt.year == year]
                    logger.info(f"Applied year filter to line chart: {year}, resulting in {len(filtered_data)} rows")
                except Exception as e:
                    logger.warning(f"Could not apply year filter to line chart: {e}")

        if not x_col or not y_cols or x_col not in filtered_data.columns:
            return None

        # Sort by x-axis for proper line chart
        chart_data = filtered_data.sort_values(x_col)

        # Translate column names
        x_title = translate_column_name(x_col)
        y_titles = [translate_column_name(col) for col in y_cols]

        # Generate intelligent title
        intelligent_title = generate_intelligent_chart_title(
            "line",
            chart_data,
            config,
            identify_date_columns,
            identify_numeric_columns,
            identify_categorical_columns
        )

        traces = []
        petroleum_colors = COLOR_SCHEMES["petroleum_colors"]

        for i, y_col in enumerate(y_cols):
            if y_col in chart_data.columns:
                # Get appropriate color for this metric
                line_color = get_chart_color("line", y_col)
                if isinstance(line_color, list):
                    line_color = line_color[i % len(line_color)]
                elif i > 0:  # Use different colors for multiple lines
                    line_color = petroleum_colors[i % len(petroleum_colors)]

                traces.append(
                    {
                        "x": chart_data[x_col].tolist(),
                        "y": chart_data[y_col].tolist(),
                        "type": "scatter",
                        "mode": "lines+markers",
                        "name": y_titles[i],
                        "line": {"color": line_color, "width": 2},
                        "marker": {"size": 6},
                    }
                )

        # Build xaxis config with month name labels if x_col is MES
        xaxis_config = {"title": x_title}
        if x_col.strip().upper() == "MES":
            mes_values = sorted(chart_data[x_col].dropna().unique())
            xaxis_config["tickmode"] = "array"
            xaxis_config["tickvals"] = [int(v) for v in mes_values]
            xaxis_config["ticktext"] = [MESES_ES.get(int(v), str(v)) for v in mes_values]

        return {
            "id": f"line_chart_{int(pd.Timestamp.now().timestamp())}",
            "type": "line",
            "title": intelligent_title,
            "data": traces,
            "layout": {
                "title": intelligent_title,
                "xaxis": xaxis_config,
                "yaxis": {"title": "Valores" if len(y_titles) > 1 else y_titles[0]},
                "font": {"size": 12, "family": "Arial, sans-serif"},
                "plot_bgcolor": "rgba(0,0,0,0)",
                "paper_bgcolor": "rgba(0,0,0,0)",
                "legend": {"orientation": "h", "y": -0.2},
            },
        }



def _create_multi_line_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create multi-line chart configuration for comparing multiple metrics"""
        try:
            # Get columns to plot
            columns = config.get("columns", [])
            x_axis = config.get("x_axis")

            if not columns:
                # Auto-detect numeric columns
                numeric_cols = identify_numeric_columns(data)
                columns = numeric_cols[:3]  # Limit to 3 lines for readability

            if not x_axis:
                # Auto-detect x-axis (date or categorical)
                date_cols = identify_date_columns(data)
                categorical_cols = identify_categorical_columns(data)

                if date_cols:
                    x_axis = date_cols[0]
                elif categorical_cols:
                    x_axis = categorical_cols[0]
                else:
                    x_axis = data.columns[0]  # First column as fallback

            if not columns or x_axis not in data.columns:
                logger.error(
                    f"Invalid columns for multi-line chart: columns={columns}, x_axis={x_axis}"
                )
                return None

            # Filter valid columns that exist in data
            valid_columns = [col for col in columns if col in data.columns]
            if not valid_columns:
                logger.error("No valid columns found for multi-line chart")
                return None

            # Prepare data
            try:
                if data[x_axis].dtype == "object":
                    # Categorical x-axis: aggregate data
                    # Ensure we only use numeric columns for aggregation
                    numeric_valid_cols = [
                        col
                        for col in valid_columns
                        if pd.api.types.is_numeric_dtype(data[col])
                    ]
                    if not numeric_valid_cols:
                        logger.error("No numeric columns found for aggregation")
                        return None
                    chart_data = (
                        data.groupby(x_axis)[numeric_valid_cols].sum().reset_index()
                    )
                    valid_columns = numeric_valid_cols  # Update valid columns
                else:
                    # Numeric/date x-axis: use as is
                    all_columns = [x_axis] + valid_columns
                    chart_data = data[all_columns].head(50)  # Limit for performance
            except Exception as e:
                logger.error(f"Error preparing data for multi-line chart: {e}")
                return None

            # Create traces for each line
            traces = []
            colors = get_petroleum_color_palette()

            for i, col in enumerate(valid_columns):
                col_title = translate_column_name(col)
                traces.append(
                    {
                        "x": chart_data[x_axis].tolist(),
                        "y": chart_data[col].tolist(),
                        "type": "scatter",
                        "mode": "lines+markers",
                        "name": col_title,
                        "line": {"color": colors[i % len(colors)], "width": 3},
                        "marker": {"size": 6},
                    }
                )

            x_title = translate_column_name(x_axis)
            title = f"Comparación Temporal - {', '.join([translate_column_name(col) for col in valid_columns[:2]])}"

            return {
                "data": traces,
                "layout": {
                    "title": {"text": title, "font": {"size": 16}},
                    "xaxis": {"title": x_title},
                    "yaxis": {"title": "Valores"},
                    "showlegend": True,
                    "height": 500,
                    "hovermode": "x unified",
                    "font": {"family": "Arial, sans-serif"},
                },
            }

        except Exception as e:
            logger.error(f"Error creating multi-line chart config: {e}")
            return None



def _hex_to_rgba(hex_color: str, alpha: float) -> str:
    """Convert hex color to rgba string with given alpha transparency."""
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def _fmt_area_label(v) -> str:
    """Format numeric value for area chart data labels."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    av = abs(v)
    if av >= 1_000_000:
        return f"{v / 1_000_000:,.1f}M"
    elif av >= 1_000:
        return f"{v / 1_000:,.1f}K"
    else:
        return f"{v:,.1f}"


def _create_area_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
    """Create area chart - line with shaded area fill, optional data labels."""
    # Normalize y_axis to list (line chart expects a list)
    area_config = dict(config)
    y_axis = area_config.get("y_axis", [])
    if isinstance(y_axis, str):
        area_config["y_axis"] = [y_axis]

    line_config = _create_line_chart_config(data, area_config)
    if not line_config or "data" not in line_config:
        return line_config

    traces = line_config["data"]
    override_color = area_config.get("color")
    for trace in traces:
        trace["fill"] = "tonexty" if len(traces) > 1 else "tozeroy"
        trace["mode"] = "lines+markers"
        # Apply color override if provided, otherwise use line color
        if override_color:
            trace["line"] = {**trace.get("line", {}), "color": override_color}
            trace["marker"] = {**trace.get("marker", {}), "color": override_color}
        line_color = trace.get("line", {}).get("color", "#1f4e79")
        trace["fillcolor"] = _hex_to_rgba(line_color, 0.25)

    # Add data labels if requested
    if area_config.get("show_data_labels"):
        for trace in traces:
            y_values = trace.get("y", [])
            trace["text"] = [_fmt_area_label(v) for v in y_values]
            trace["textposition"] = "top center"
            trace["textfont"] = {"size": 11, "color": "#333333"}
            trace["mode"] = "lines+markers+text"

    line_config["type"] = "area"
    return line_config




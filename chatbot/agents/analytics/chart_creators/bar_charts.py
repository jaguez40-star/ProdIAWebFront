"""
Bar Charts Module
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from ..utils import (
    translate_column_name,
    get_chart_color,
    generate_intelligent_chart_title,
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

def _create_bar_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create bar chart configuration with translations and colors"""
        x_col = config.get("x_axis")
        y_col = config.get("y_axis")

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
                    logger.info(f"Applied year filter: {year}, resulting in {len(filtered_data)} rows")
                except Exception as e:
                    logger.warning(f"Could not apply year filter: {e}")

        # Handle aggregate_by_year option
        if config.get("aggregate_by_year"):
            date_cols = identify_date_columns(filtered_data)
            if date_cols:
                date_col = date_cols[0]
                try:
                    # Extract year and aggregate
                    if 'año' in date_col.lower() or 'year' in date_col.lower():
                        year_col = date_col
                    else:
                        filtered_data['AÑO'] = pd.to_datetime(filtered_data[date_col], errors='coerce').dt.year
                        year_col = 'AÑO'

                    # Update x_col to year column
                    x_col = year_col
                except Exception as e:
                    logger.warning(f"Could not aggregate by year: {e}")

        if (
            not x_col
            or not y_col
            or x_col not in filtered_data.columns
            or y_col not in filtered_data.columns
        ):
            # Auto-detect columns if not provided or invalid
            categorical_cols = identify_categorical_columns(filtered_data)
            numeric_cols = identify_numeric_columns(filtered_data)

            if categorical_cols and numeric_cols:
                x_col = categorical_cols[0]
                y_col = numeric_cols[0]
                logger.warning(
                    f"Auto-detected columns for bar chart: x={x_col}, y={y_col}"
                )
            else:
                logger.error("Cannot create bar chart: no suitable columns found")
                return None

        # Check if x_col is a year column (should not aggregate by sum for variation metrics)
        is_year_col = 'año' in x_col.lower() or 'year' in x_col.lower()
        is_variation_metric = any(kw in y_col.lower() for kw in ['delta', 'variacion', 'variation', 'yoy', 'cagr', 'pct'])

        # Aggregate data if necessary
        if filtered_data[x_col].dtype == "object" and not (is_year_col and is_variation_metric):
            # Aggregate by grouping (e.g., by category)
            chart_data = filtered_data.groupby(x_col)[y_col].sum().reset_index()
        else:
            # For numeric x-axis or year-based variation metrics, use data as-is
            chart_data = filtered_data[[x_col, y_col]].copy()
            # Remove NaN/null values only from the selected columns
            chart_data = chart_data.dropna()

        # Convert year columns to string so Plotly uses categorical axis
        # (otherwise AÑO=2026 creates a linear 0-2000 scale)
        if is_year_col and not chart_data.empty:
            chart_data[x_col] = chart_data[x_col].astype(int).astype(str)

        # Sort descending by y value if requested
        if config.get("sort_descending"):
            chart_data = chart_data.sort_values(y_col, ascending=False).reset_index(drop=True)

        logger.info(f"📊 Bar chart data prepared: {len(chart_data)} rows, x_dtype={filtered_data[x_col].dtype}, is_year={is_year_col}, is_variation={is_variation_metric}")
        logger.info(f"📊 Sample data: {chart_data.head(3).to_dict('records') if len(chart_data) > 0 else 'No data'}")

        # Use provided titles or translate column names
        x_title = config.get("x_title") or translate_column_name(x_col)
        y_title = config.get("y_title") or translate_column_name(y_col)

        # Get appropriate color
        chart_color = get_chart_color("bar", y_col)

        # Check if this is a variation/YoY column - apply conditional coloring
        y_col_lower = y_col.lower()
        is_variation = any(kw in y_col_lower for kw in ['variacion', 'variation', 'yoy', 'crecimiento', 'cambio', 'delta'])
        is_percentage = 'pct' in y_col_lower or 'percent' in y_col_lower or 'porcentaje' in y_col_lower

        if is_variation or (is_percentage and any(v < 0 for v in chart_data[y_col])):
            # Apply conditional colors: green for positive, red for negative, orange for near-zero
            colors = []
            for val in chart_data[y_col]:
                if val > 0.5:  # Positive growth
                    colors.append('#CCD32A')  # Green-yellow for positive variation
                elif val < -0.5:  # Negative growth
                    colors.append('#D32F2F')  # Red for negative
                else:  # Near zero
                    colors.append('#F7DB17')  # ECP Yellow for minimal change
            marker_config = {
                "color": colors,
                "line": {"color": "#ffffff", "width": 1}
            }
        else:
            # Use single color for non-variation charts
            marker_config = {"color": chart_color}

        # Apply gradient color if requested
        gradient_color = config.get("gradient_color")
        if gradient_color and len(chart_data) > 0:
            # Parse base hex color to RGB
            base = gradient_color.lstrip("#")
            r0, g0, b0 = int(base[0:2], 16), int(base[2:4], 16), int(base[4:6], 16)
            n = len(chart_data)
            colors = []
            for i in range(n):
                # Fade from full color (rank 1) to 30% opacity (last rank)
                t = 0.3 + 0.7 * (1 - i / max(n - 1, 1))
                r = int(r0 * t + 255 * (1 - t))
                g = int(g0 * t + 255 * (1 - t))
                b = int(b0 * t + 255 * (1 - t))
                colors.append(f"rgb({r},{g},{b})")
            marker_config = {"color": colors, "line": {"color": gradient_color, "width": 0.5}}

        # Generate intelligent title
        intelligent_title = generate_intelligent_chart_title(
            "bar",
            chart_data,
            config,
            identify_date_columns,
            identify_numeric_columns,
            identify_categorical_columns
        )

        # Add value labels on bars for variation charts or when explicitly requested
        text_labels = None
        text_position = None
        if is_variation or is_percentage:
            text_labels = [f"{val:.2f}%" for val in chart_data[y_col]]
            text_position = "outside"
        elif config.get("show_data_labels"):
            def _fmt_label(v):
                if v is None or (isinstance(v, float) and pd.isna(v)):
                    return ""
                av = abs(v)
                if av >= 1_000_000:
                    return f"{v/1_000_000:,.1f}M"
                elif av >= 1_000:
                    return f"{v/1_000:,.1f}K"
                else:
                    return f"{v:,.1f}"
            text_labels = [_fmt_label(v) for v in chart_data[y_col]]
            text_position = "outside"

        bar_data = {
            "x": chart_data[x_col].tolist(),
            "y": chart_data[y_col].tolist(),
            "type": "bar",
            "name": y_title,
            "marker": marker_config,
        }

        if text_labels:
            bar_data["text"] = text_labels
            bar_data["textposition"] = text_position
            bar_data["textfont"] = {"size": 11, "color": "#333333"}

        # Custom hover template for variation charts
        if is_variation or is_percentage:
            bar_data["hovertemplate"] = "<b>%{x}</b><br>Variación: %{y:.2f}%<extra></extra>"

        # Configure x-axis: force categorical type when x values are strings/objects
        xaxis_config = {"title": x_title}
        if chart_data[x_col].dtype == "object":
            xaxis_config["type"] = "category"
            logger.info(f"📊 Forcing categorical x-axis for object dtype column {x_col}")

        # Add month name labels if x-axis is MES
        if x_col.strip().upper() == "MES":
            mes_values = sorted(chart_data[x_col].dropna().unique())
            xaxis_config["tickmode"] = "array"
            xaxis_config["tickvals"] = [int(v) for v in mes_values]
            xaxis_config["ticktext"] = [MESES_ES.get(int(v), str(v)) for v in mes_values]

        layout_config = {
            "title": intelligent_title,
            "xaxis": xaxis_config,
            "yaxis": {"title": y_title},
            "font": {"size": 12, "family": "Arial, sans-serif"},
            "plot_bgcolor": "rgba(0,0,0,0)",
            "paper_bgcolor": "rgba(0,0,0,0)",
        }

        # Add reference line at y=0 for variation charts
        if is_variation or is_percentage:
            layout_config["shapes"] = [{
                "type": "line",
                "x0": -0.5,
                "x1": len(chart_data),
                "y0": 0,
                "y1": 0,
                "line": {
                    "color": "#999999",
                    "width": 1,
                    "dash": "dash"
                }
            }]

        return {
            "id": f"bar_chart_{int(pd.Timestamp.now().timestamp())}",
            "type": "bar",
            "title": intelligent_title,
            "data": bar_data,
            "layout": layout_config,
        }



def _create_grouped_bar_chart_config(
        data: pd.DataFrame, config: Dict
    ) -> Dict:
        """Create grouped bar chart with multiple y-axis columns"""
        try:
            x_axis = config.get("x_axis")
            y_axis = config.get("y_axis")

            # Handle case where y_axis is a list (multiple columns)
            if isinstance(y_axis, list):
                if not y_axis:
                    return None
                # For grouped bar, use the first column and create config for bar chart
                y_col = y_axis[0]
                if y_col not in data.columns:
                    return None
                config_updated = {
                    "x_axis": x_axis,
                    "y_axis": y_col,
                    "x_title": config.get("x_title"),
                    "y_title": config.get("y_title") or f"Múltiples Métricas",
                }
                return _create_bar_chart_config(data, config_updated)
            else:
                # Single column, use regular bar chart
                return _create_bar_chart_config(data, config)
        except Exception as e:
            logger.error(f"Error in grouped bar chart config: {e}")
            return _create_bar_chart_config(data, config)



def _create_ranking_bar_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """
        Create ranking bar chart with special formatting:
        - Descending order by value
        - Top N items (default 10)
        - Gradient colors by position
        - Medals/badges for top 3
        - % difference from #1
        """
        x_col = config.get("x_axis")
        y_col = config.get("y_axis")
        top_n = config.get("top_n", 10)

        if (
            not x_col
            or not y_col
            or x_col not in data.columns
            or y_col not in data.columns
        ):
            # Auto-detect columns
            categorical_cols = identify_categorical_columns(data)
            numeric_cols = identify_numeric_columns(data)

            if categorical_cols and numeric_cols:
                x_col = categorical_cols[0]
                y_col = numeric_cols[0]
            else:
                logger.error("Cannot create ranking chart: no suitable columns found")
                return None

        # Check if there's an AÑO column and filter by most recent year if not specified
        filtered_data = data.copy()
        available_years = []
        if 'AÑO' in data.columns or 'año' in data.columns:
            year_col = 'AÑO' if 'AÑO' in data.columns else 'año'
            available_years = sorted(data[year_col].unique(), reverse=True)

            # Filter by specified year or most recent
            if config.get('filter_year'):
                filtered_data = data[data[year_col] == str(config['filter_year'])]
            else:
                # Use most recent year by default
                filtered_data = data[data[year_col] == available_years[0]]

            logger.info(f"📊 Ranking chart filtered to year: {available_years[0] if not config.get('filter_year') else config['filter_year']}")

        # Aggregate and sort data for ranking
        if filtered_data[x_col].dtype == "object":
            chart_data = filtered_data.groupby(x_col)[y_col].sum().reset_index()
        else:
            chart_data = filtered_data[[x_col, y_col]].copy()

        # Sort descending and take top N
        chart_data = chart_data.sort_values(y_col, ascending=False).head(top_n)

        # Add ranking positions
        chart_data['Posición'] = range(1, len(chart_data) + 1)

        # Calculate % difference from #1
        max_value = chart_data[y_col].iloc[0]
        chart_data['% vs #1'] = ((chart_data[y_col] / max_value) * 100).round(1)

        # Create gradient colors by position
        gradient_color = config.get("gradient_color")
        colors = []
        n = len(chart_data)
        if gradient_color and n > 0:
            # Gradient from gradient_color (top) to gray (bottom)
            base = gradient_color.lstrip("#")
            r0, g0, b0 = int(base[0:2], 16), int(base[2:4], 16), int(base[4:6], 16)
            r1, g1, b1 = 192, 192, 192  # target gray
            for i in range(n):
                t = i / max(n - 1, 1)
                r = int(r0 + (r1 - r0) * t)
                g = int(g0 + (g1 - g0) * t)
                b = int(b0 + (b1 - b0) * t)
                colors.append(f'#{r:02x}{g:02x}{b:02x}')
        else:
            for i in range(n):
                if i == 0:
                    colors.append('#FFD700')  # Gold for #1
                elif i == 1:
                    colors.append('#C0C0C0')  # Silver for #2
                elif i == 2:
                    colors.append('#CD7F32')  # Bronze for #3
                else:
                    # Gradient from dark blue to light blue for the rest
                    intensity = 1 - (i / n)
                    colors.append(f'rgba(31, 78, 121, {0.4 + intensity * 0.6})')

        # Generate labels with medals
        labels = []
        for idx, row in chart_data.iterrows():
            pos = row['Posición']
            name = row[x_col]
            if pos == 1:
                labels.append(f'🥇 {name}')
            elif pos == 2:
                labels.append(f'🥈 {name}')
            elif pos == 3:
                labels.append(f'🥉 {name}')
            else:
                labels.append(f'#{pos} {name}')

        # Translate column names
        x_title = translate_column_name(x_col)
        y_title = translate_column_name(y_col)

        # Generate intelligent title
        intelligent_title = generate_intelligent_chart_title(
            "ranking_bar",
            chart_data,
            config,
            identify_date_columns,
            identify_numeric_columns,
            identify_categorical_columns
        )

        # Create custom hover template
        hover_template = (
            "<b>%{customdata[0]}</b><br>"
            + f"{y_title}: %{{y:,.1f}}<br>"
            + "% vs #1: %{customdata[1]:.1f}%<br>"
            + "<extra></extra>"
        )

        # Add data labels if requested
        text_config = {}
        if config.get("show_data_labels"):
            values = chart_data[y_col].tolist()
            text_labels = []
            for v in values:
                if abs(v) >= 1_000_000:
                    text_labels.append(f"{v/1_000_000:,.1f}M")
                elif abs(v) >= 1_000:
                    text_labels.append(f"{v/1_000:,.1f}k")
                else:
                    text_labels.append(f"{v:,.1f}")
            text_config = {
                "text": text_labels,
                "textposition": "outside",
                "textfont": {"size": 11, "color": "#333333"},
            }

        ranking_config = {
            "id": f"ranking_bar_{int(pd.Timestamp.now().timestamp())}",
            "type": "bar",
            "title": intelligent_title,
            "data": {
                "x": labels,
                "y": chart_data[y_col].tolist(),
                "type": "bar",
                "name": y_title,
                "marker": {
                    "color": colors,
                    "line": {"color": "#ffffff", "width": 1}
                },
                "customdata": list(zip(
                    chart_data[x_col].tolist(),
                    chart_data['% vs #1'].tolist()
                )),
                "hovertemplate": hover_template,
                **text_config,
            },
            "layout": {
                "title": intelligent_title,
                "xaxis": {
                    "title": x_title,
                    "tickangle": -45 if len(chart_data) > 5 else 0
                },
                "yaxis": {"title": y_title},
                "font": {"size": 12, "family": "Arial, sans-serif"},
                "plot_bgcolor": "rgba(0,0,0,0)",
                "paper_bgcolor": "rgba(0,0,0,0)",
                "height": 500,
                "margin": {"b": 120 if len(chart_data) > 5 else 80}
            },
        }

        # Add year filter buttons if multiple years detected
        if available_years and len(available_years) > 1:
            ranking_config["year_buttons"] = [
                {
                    "year": year,
                    "label": f"Año {year}",
                    "active": year == (config.get('filter_year') or available_years[0])
                }
                for year in available_years
            ]

        return ranking_config




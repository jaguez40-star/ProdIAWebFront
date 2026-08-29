"""
Statistical Charts Module
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd
import time

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
from .bar_charts import _create_bar_chart_config

logger = logging.getLogger(__name__)

def _create_pie_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create enhanced pie chart configuration with better visuals"""
        x_col = config.get("x_axis")
        y_col = config.get("y_axis")

        if not x_col or not y_col:
            # Auto-detect: first categorical and first numeric
            categorical_cols = identify_categorical_columns(data)
            numeric_cols = identify_numeric_columns(data)

            if categorical_cols and numeric_cols:
                x_col = categorical_cols[0]
                y_col = numeric_cols[0]
            else:
                return None

        if x_col not in data.columns or y_col not in data.columns:
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

            logger.info(f"📊 Pie chart filtered to year: {available_years[0] if not config.get('filter_year') else config['filter_year']}")

        # Aggregate data for pie chart
        chart_data = filtered_data.groupby(x_col)[y_col].sum().reset_index()
        chart_data = chart_data.head(10)  # Limit to top 10 for readability

        x_title = config.get("x_title") or translate_column_name(x_col)
        y_title = config.get("y_title") or translate_column_name(y_col)

        # Enhanced title handling with multiple fallbacks
        chart_title = config.get("title")
        if not chart_title:
            chart_title = f"Distribución de {y_title} por {x_title}"

        # Enhanced color palette with more distinctive colors
        distinctive_colors = [
            '#FF6B6B',  # Red
            '#4ECDC4',  # Teal
            '#45B7D1',  # Blue
            '#96CEB4',  # Mint Green
            '#FECA57',  # Yellow
            '#FF9FF3',  # Pink
            '#54A0FF',  # Light Blue
            '#5F27CD',  # Purple
            '#00D2D3',  # Cyan
            '#FF9F43',  # Orange
            '#10AC84',  # Green
            '#EE5A24',  # Dark Orange
            '#0984E3',  # Dark Blue
            '#A29BFE',  # Light Purple
            '#FD79A8'   # Rose
        ]

        # Determine colors: use color_map if provided, else default palette
        color_map = config.get("color_map")
        if color_map:
            labels_list = chart_data[x_col].tolist()
            pie_colors = [color_map.get(str(label).upper(), distinctive_colors[i % len(distinctive_colors)]) for i, label in enumerate(labels_list)]
        else:
            pie_colors = distinctive_colors[:len(chart_data)]

        pie_config = {
            "id": f"pie_chart_{int(time.time())}",
            "type": "pie",
            "title": chart_title if chart_title and chart_title != "undefined" else f"Distribución de {y_title} por {x_title}",
            "data": [
                {
                    "values": chart_data[y_col].tolist(),
                    "labels": chart_data[x_col].tolist(),
                    "type": "pie",
                    "hole": 0.3,  # Donut style for better aesthetics
                    "textinfo": "label+percent",
                    "textposition": "auto",
                    "hovertemplate": "<b>%{label}</b><br>Valor: %{value:,.0f}<br>Porcentaje: %{percent}<extra></extra>",
                    "marker": {
                        "colors": pie_colors,
                        "line": {"color": "#ffffff", "width": 2}
                    },
                    "textfont": {
                        "size": 12,
                        "color": "#2c3e50"
                    }
                }
            ],
            "layout": {
                "title": {
                    "text": chart_title if chart_title and chart_title != "undefined" else f"Distribución de {y_title} por {x_title}",
                    "x": 0.5,
                    "xanchor": "center",
                    "y": 0.95,
                    "font": {
                        "size": 16,
                        "family": "Arial, sans-serif",
                        "color": "#2c3e50"
                    }
                },
                "showlegend": True,
                "legend": {
                    "orientation": "h",
                    "yanchor": "bottom",
                    "y": -0.3,
                    "xanchor": "center",
                    "x": 0.5,
                    "font": {
                        "size": 10,
                        "family": "Arial, sans-serif"
                    }
                },
                "height": 450,
                "margin": {"l": 40, "r": 40, "t": 60, "b": 120},
                "font": {"family": "Arial, sans-serif", "size": 11},
                "paper_bgcolor": "rgba(0,0,0,0)",
                "plot_bgcolor": "rgba(0,0,0,0)",
                "autosize": True
            },
        }

        # Add year filter buttons if multiple years detected
        if available_years and len(available_years) > 1:
            pie_config["year_buttons"] = [
                {
                    "year": year,
                    "label": f"Año {year}",
                    "active": year == (config.get('filter_year') or available_years[0])
                }
                for year in available_years
            ]

        return pie_config



def _create_scatter_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create scatter plot configuration with translations and colors"""
        x_col = config.get("x_axis")
        y_col = config.get("y_axis")

        if (
            not x_col
            or not y_col
            or x_col not in data.columns
            or y_col not in data.columns
        ):
            return None

        # Remove NaN values
        clean_data = data[[x_col, y_col]].dropna()

        # Use provided titles or translate column names
        x_title = config.get("x_title") or translate_column_name(x_col)
        y_title = config.get("y_title") or translate_column_name(y_col)

        # Get appropriate color
        scatter_color = get_chart_color("scatter", f"{y_col} {x_col}")

        # Create enhanced title
        enhanced_title = generate_intelligent_chart_title(
            "scatter",
            data,
            config,
            identify_date_columns,
            identify_numeric_columns,
            identify_categorical_columns
        )

        return {
            "id": f"scatter_chart_{int(pd.Timestamp.now().timestamp())}",
            "type": "scatter",
            "title": enhanced_title,
            "data": {
                "x": clean_data[x_col].tolist(),
                "y": clean_data[y_col].tolist(),
                "type": "scatter",
                "mode": "markers",
                "name": f"{y_title} vs {x_title}",
                "marker": {
                    "color": scatter_color,
                    "size": 8,
                    "opacity": 0.7,
                    "line": {"width": 1, "color": "#ffffff"},
                },
            },
            "layout": {
                "title": enhanced_title,
                "xaxis": {"title": x_title},
                "yaxis": {"title": y_title},
                "font": {"size": 12, "family": "Arial, sans-serif"},
                "plot_bgcolor": "rgba(0,0,0,0)",
                "paper_bgcolor": "rgba(0,0,0,0)",
            },
        }



def _create_histogram_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create histogram configuration with translations and colors"""
        column = config.get("column")

        if not column or column not in data.columns:
            return None

        # Remove NaN values
        clean_data = data[column].dropna()

        # Translate column name
        column_title = translate_column_name(column)

        # Get appropriate color
        hist_color = get_chart_color("histogram", column)

        # Create enhanced title
        enhanced_title = generate_intelligent_chart_title(
            "histogram",
            data,
            config,
            identify_date_columns,
            identify_numeric_columns,
            identify_categorical_columns
        )

        return {
            "id": f"histogram_chart_{int(pd.Timestamp.now().timestamp())}",
            "type": "histogram",
            "title": enhanced_title,
            "data": {
                "x": clean_data.tolist(),
                "type": "histogram",
                "name": column_title,
                "marker": {
                    "color": hist_color,
                    "line": {"color": "#ffffff", "width": 1},
                },
                "opacity": 0.8,
            },
            "layout": {
                "title": enhanced_title,
                "xaxis": {"title": column_title},
                "yaxis": {"title": "Frecuencia"},
                "font": {"size": 12, "family": "Arial, sans-serif"},
                "plot_bgcolor": "rgba(0,0,0,0)",
                "paper_bgcolor": "rgba(0,0,0,0)",
            },
        }



def _create_box_plot_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create box plot - fallback to histogram"""
        columns = config.get("columns", [])
        if columns and columns[0] in data.columns:
            config_updated = {"column": columns[0], "chart_type": "histogram"}
            return _create_histogram_chart_config(data, config_updated)
        return None



def _create_heatmap_chart_config(data: pd.DataFrame, config: Dict) -> Dict:
        """Create heatmap - fallback to bar chart"""
        logger.warning("Heatmap not fully implemented, falling back to bar chart")
        return _create_bar_chart_config(data, config)




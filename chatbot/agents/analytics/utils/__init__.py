"""
Analytics utilities module
Provides reusable utilities for chart generation and data analysis
"""

from .translations import translate_column_name, COLUMN_TRANSLATIONS
from .colors import get_chart_color, get_petroleum_color_palette, COLOR_SCHEMES
from .scale_validator import classify_column_by_unit, validate_scale_compatibility
from .title_generator import generate_intelligent_chart_title

__all__ = [
    'translate_column_name',
    'COLUMN_TRANSLATIONS',
    'get_chart_color',
    'get_petroleum_color_palette',
    'COLOR_SCHEMES',
    'classify_column_by_unit',
    'validate_scale_compatibility',
    'generate_intelligent_chart_title',
]

"""
Scale compatibility validation for preventing mixed-unit charts
Ensures that incompatible metrics are not plotted together
"""

from typing import Any, Dict, List
import pandas as pd


def classify_column_by_unit(column_name: str, data: pd.DataFrame = None) -> str:
    """
    Classify column by unit type to prevent mixing incompatible scales

    Args:
        column_name: Name of the column to classify
        data: Optional DataFrame for dtype checking

    Returns:
        Unit classification: 'percentage', 'volume', 'ratio', 'count', 'date', 'categorical', 'unknown'
    """
    col_lower = column_name.lower()

    # Percentage metrics
    if any(keyword in col_lower for keyword in ['participacion', 'pct', 'percent', 'porcentaje']):
        return 'percentage'

    # Volume metrics (bbl/day, MSCF/day)
    if any(keyword in col_lower for keyword in ['oil_volume', 'bopd', 'water', 'gas', 'produccion', 'volumen']):
        return 'volume'

    # Ratio metrics (GOR, WOR - dimensionless)
    if any(keyword in col_lower for keyword in ['gor', 'wor', 'ratio']):
        return 'ratio'

    # Count/totals
    if any(keyword in col_lower for keyword in ['total', 'count', 'numero', 'cantidad']):
        return 'count'

    # Date/time
    if any(keyword in col_lower for keyword in ['fecha', 'date', 'año', 'year', 'mes', 'month']):
        return 'date'

    # Default to categorical for strings
    if data is not None and column_name in data.columns:
        if data[column_name].dtype == 'object':
            return 'categorical'

    return 'unknown'


def validate_scale_compatibility(columns: List[str], data: pd.DataFrame) -> Dict[str, Any]:
    """
    Validate that columns are compatible for visualization on the same chart

    Args:
        columns: List of column names to validate
        data: DataFrame containing the columns

    Returns:
        Dictionary with:
            - compatible (bool): Whether columns can be plotted together
            - reason (str): Explanation of compatibility
            - suggestions (list): Alternative approaches
            - classifications (dict): Unit classification for each column
    """
    if len(columns) <= 1:
        return {'compatible': True, 'reason': 'Single column', 'suggestions': []}

    # Classify all columns
    classifications = {col: classify_column_by_unit(col, data) for col in columns}

    # Get unique unit types (excluding dates and categoricals which are allowed)
    metric_types = set([
        c for c in classifications.values()
        if c not in ['date', 'categorical', 'unknown']
    ])

    # Check for incompatible combinations
    incompatible_pairs = [
        ('percentage', 'volume'),
        ('percentage', 'ratio'),
        ('volume', 'count'),
        ('ratio', 'count')
    ]

    for type1, type2 in incompatible_pairs:
        if type1 in metric_types and type2 in metric_types:
            cols_by_type = {
                type1: [col for col, t in classifications.items() if t == type1],
                type2: [col for col, t in classifications.items() if t == type2]
            }

            return {
                'compatible': False,
                'reason': f'Incompatible units: {type1} ({cols_by_type[type1]}) cannot be mixed with {type2} ({cols_by_type[type2]})',
                'suggestions': [
                    f'Create separate charts for {type1} metrics: {cols_by_type[type1]}',
                    f'Create separate charts for {type2} metrics: {cols_by_type[type2]}'
                ],
                'classifications': classifications
            }

    # Check for too many different unit types
    if len(metric_types) > 2:
        return {
            'compatible': False,
            'reason': f'Too many different unit types: {metric_types}',
            'suggestions': ['Group metrics by unit type and create separate charts'],
            'classifications': classifications
        }

    return {
        'compatible': True,
        'reason': 'All columns compatible',
        'suggestions': [],
        'classifications': classifications
    }

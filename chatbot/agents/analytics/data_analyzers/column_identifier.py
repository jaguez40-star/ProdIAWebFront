"""
Column identification utilities for data analysis
Provides functions to identify different types of columns in DataFrames
"""

from typing import List, Optional, Tuple
import pandas as pd


def identify_numeric_columns(data: pd.DataFrame) -> List[str]:
    """
    Identify numeric columns in dataset

    Args:
        data: DataFrame to analyze

    Returns:
        List of numeric column names
    """
    if data.empty:
        return []
    return [col for col in data.columns if data[col].dtype in ["int64", "float64"]]


def identify_categorical_columns(data: pd.DataFrame) -> List[str]:
    """
    Identify categorical columns in dataset

    Args:
        data: DataFrame to analyze

    Returns:
        List of categorical column names
    """
    if data.empty:
        return []
    return [col for col in data.columns if data[col].dtype == "object"]


def identify_date_columns(data: pd.DataFrame) -> List[str]:
    """
    Identify date/datetime columns

    Args:
        data: DataFrame to analyze

    Returns:
        List of date column names
    """
    if data.empty:
        return []
    date_cols = []
    for col in data.columns:
        col_lower = col.lower()
        # Check for common date/time keywords including Spanish 'año' (year)
        if any(
            keyword in col_lower
            for keyword in [
                "date",
                "time",
                "fecha",
                "año",
                "year",
                "mes",
                "month",
                "dia",
                "day",
            ]
        ):
            date_cols.append(col)
        # Also check for exact matches of year columns
        elif col.upper() in ["AÑO", "YEAR", "ANO"]:
            date_cols.append(col)
    return date_cols


def select_temporal_x_axis(
    data: pd.DataFrame, date_cols: List[str]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Pick the best date column for the x-axis based on distinct value count.

    For single-year monthly data (AÑO=1 unique, MES=12 unique), picks MES.
    For multi-year data, picks AÑO and returns MES as grouping column.

    Args:
        data: DataFrame to analyze
        date_cols: List of date column names

    Returns:
        Tuple of (x_axis_col, grouping_col) where grouping_col is None
        if no multi-series grouping is needed.
    """
    if data.empty or not date_cols:
        return (None, None)

    # Find AÑO-like and MES-like columns
    año_col = None
    mes_col = None
    for col in date_cols:
        cl = col.lower()
        if "año" in cl or cl == "year":
            año_col = col
        elif cl == "mes" or cl == "month":
            mes_col = col

    año_unique = data[año_col].nunique() if año_col else 0
    mes_unique = data[mes_col].nunique() if mes_col else 0

    # Multi-year + monthly → x=MES, group=AÑO (for multi-line by year)
    if año_unique >= 2 and mes_unique >= 2:
        return (mes_col, año_col)

    # Single year + monthly → x=MES
    if mes_unique >= 2:
        return (mes_col, None)

    # Multi-year only → x=AÑO
    if año_unique >= 2:
        return (año_col, None)

    # Fallback: pick column with most distinct values
    best_col = max(date_cols, key=lambda c: data[c].nunique(), default=date_cols[0])
    return (best_col, None)


def get_non_date_numeric_cols(
    data: pd.DataFrame, date_cols: List[str]
) -> List[str]:
    """
    Get numeric columns excluding date columns (AÑO, MES, etc.).

    Prevents date columns from being used as y-axis metrics.

    Args:
        data: DataFrame to analyze
        date_cols: List of date column names to exclude

    Returns:
        List of numeric column names that are not date columns
    """
    numeric_cols = identify_numeric_columns(data)
    date_set = set(date_cols)
    return [col for col in numeric_cols if col not in date_set]


def identify_petroleum_metrics(data: pd.DataFrame) -> List[str]:
    """
    Identify petroleum-specific metrics in data

    Args:
        data: DataFrame to analyze

    Returns:
        List of petroleum metric column names
    """
    if data.empty:
        return []

    petroleum_keywords = [
        "oil_volume",
        "water",
        "gas",
        "gor",
        "wor",
        "bopd",
        "mscf",
        "petróleo",
        "aceite",
        "crudo",
        "produccion",
        "production",
        "bbl",
        "barril",
        "campo",
        "pozo",
        "well",
        "field",
    ]

    petroleum_cols = []
    for col in data.columns:
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in petroleum_keywords):
            petroleum_cols.append(col)

    return petroleum_cols


def detect_available_years(data: pd.DataFrame) -> List[int]:
    """
    Detect available years in the dataset for filtering

    Args:
        data: DataFrame to analyze

    Returns:
        Sorted list of unique years
    """
    if data.empty:
        return []

    date_cols = identify_date_columns(data)
    years = set()

    for col in date_cols:
        try:
            if 'año' in col.lower() or 'year' in col.lower():
                # Column already contains years
                year_values = data[col].dropna().unique()
                years.update([int(y) for y in year_values if str(y).isdigit()])
            else:
                # Extract year from datetime
                date_series = pd.to_datetime(data[col], errors='coerce')
                year_values = date_series.dt.year.dropna().unique()
                years.update([int(y) for y in year_values])
        except Exception:
            continue

    return sorted(list(years))

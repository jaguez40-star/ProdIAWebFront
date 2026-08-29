"""
Column name translations for analytics visualizations
Provides English -> Spanish translations for petroleum data columns
"""

# Column name translations (English -> Spanish)
COLUMN_TRANSLATIONS = {
    "oil_volume": "Producción de Aceite",
    "bopd": "Barriles de Aceite por Día",
    "water": "Producción de Agua",
    "gas": "Producción de Gas",
    "gor": "Relación Gas-Aceite (GOR)",
    "wor": "Relación Agua-Aceite (WOR)",
    "field_name": "Campo",
    "well_common_name": "Pozo",
    "dmu_code": "Código DMU",
    "vice_hom": "Vicepresidencia",
    "campo": "Campo",
    "production": "Producción",
    "volume": "Volumen",
    "date": "Fecha",
    "observation_datetime": "Fecha",
    "participacion_pct": "Participación (%)",
    "bopd_gerencia": "BOPD por Gerencia",
    "gerencia": "Gerencia",
    "año": "Año",
    "total_nacional": "Total Nacional",
    "mes": "Mes",
}


def translate_column_name(column_name: str) -> str:
    """
    Translate column name to Spanish if translation exists

    Args:
        column_name: Original column name

    Returns:
        Translated name or formatted original name
    """
    if not column_name:
        return column_name

    # Check direct translation first
    lower_name = column_name.lower()
    if lower_name in COLUMN_TRANSLATIONS:
        return COLUMN_TRANSLATIONS[lower_name]

    # Check if column name contains petroleum keywords
    for english, spanish in COLUMN_TRANSLATIONS.items():
        if english in lower_name:
            return spanish

    # Return original name with proper capitalization if no translation found
    return column_name.replace("_", " ").title()

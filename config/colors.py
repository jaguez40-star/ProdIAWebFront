"""
Configuración de colores basada en la paleta corporativa
"""

# Colores primarios
PRIMARY_YELLOW = "#F7DB17"  # PANTONE: 109C
PRIMARY_LIME = "#CCD32A"  # PANTONE: 382C
PRIMARY_FOREST = "#004236"  # PANTONE: 3308C

# Colores complementarios
SECONDARY_ORANGE = "#FF5F00"  # PANTONE: 166C
SECONDARY_NAVY = "#00214D"  # PANTONE: 282C
SECONDARY_GRAY = "#B5B5AD"  # PANTONE: COOL GRAY
SECONDARY_CHARCOAL = "#403833"  # PANTONE: BLACK 7C

# Paleta de colores para gráficos
CHART_COLORS = [
    PRIMARY_YELLOW,
    PRIMARY_LIME,
    SECONDARY_ORANGE,
    SECONDARY_NAVY,
    PRIMARY_FOREST,
    SECONDARY_GRAY,
    SECONDARY_CHARCOAL,
]

# Colores para diferentes elementos de UI
UI_COLORS = {
    "background_primary": PRIMARY_FOREST,
    "background_secondary": SECONDARY_NAVY,
    "background_light": SECONDARY_GRAY,
    "text_primary": SECONDARY_CHARCOAL,
    "text_secondary": PRIMARY_FOREST,
    "text_light": SECONDARY_GRAY,
    "text_inverse": "#FFFFFF",
    "accent_primary": PRIMARY_YELLOW,
    "accent_secondary": PRIMARY_LIME,
    "accent_tertiary": SECONDARY_ORANGE,
    "border": SECONDARY_GRAY,
    "success": PRIMARY_LIME,
    "warning": PRIMARY_YELLOW,
    "error": SECONDARY_ORANGE,
    "info": SECONDARY_NAVY,
}

# Diccionarios de colores para usar en el app principal
PRIMARY_COLORS = {
    "yellow": PRIMARY_YELLOW,
    "lime": PRIMARY_LIME,
    "forest_green": PRIMARY_FOREST,
}

COMPLEMENTARY_COLORS = {
    "orange": SECONDARY_ORANGE,
    "navy": SECONDARY_NAVY,
    "gray": SECONDARY_GRAY,
    "charcoal": SECONDARY_CHARCOAL,
}

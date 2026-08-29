"""
Production Monthly 2025 Pattern

Handles questions about monthly distribution of hydrocarbon production in 2025.

Example questions:
- "Cómo se distribuye la producción nacional de hidrocarburos a lo largo de los meses de 2025?"
- "Cuál ha sido el comportamiento mensual de la producción nacional de Crudo, Gas y Blancos en 2025?"
- "Cómo evolucionó la producción nacional de hidrocarburos durante 2025?"
- "Qué tendencia muestra la producción de Crudo, Gas y Blancos en Colombia en 2025?"
"""

import logging
import pandas as pd
from typing import List, Dict

from .base_pattern import QuestionPatternBase

logger = logging.getLogger(__name__)


class ProductionMonthly2025Pattern(QuestionPatternBase):
    """
    Pattern for monthly 2025 hydrocarbon production analysis.

    Generates 3 SQL followup buttons:
    1. Monthly Crude Oil Variation (MoM%)
    2. Max vs Min Month Comparison
    3. Product Participation % by Month
    """

    keywords = [
        "distribuye", "distribución", "mensual", "mensualmente", "meses", "mes a mes",
        "2025", "hidrocarburos", "crudo", "gas", "blancos",
        "comportamiento", "evolucionó", "evolución", "tendencia",
        "niveles", "alcanzaron", "durante", "a lo largo"
    ]
    priority = 95  # Higher priority (checked before annual)
    description = "Monthly 2025 hydrocarbon production analysis"

    def followup_buttons(
        self, question: str, data: pd.DataFrame
    ) -> List[Dict]:
        """Generate followup buttons for monthly 2025 analysis"""

        question_lower = question.lower()

        # Check for products (stronger indicator)
        has_products = any(p in question_lower for p in ["crudo", "gas", "blancos", "hidrocarburos"])
        has_2025 = "2025" in question_lower
        has_temporal = any(t in question_lower for t in ["mensual", "meses", "mes a mes", "mensualmente", "durante", "a lo largo"])

        is_monthly_query = (has_2025 and has_products) or (
            has_2025 and has_temporal and any(keyword in question_lower for keyword in self.keywords)
        )

        if not is_monthly_query:
            logger.info("❌ Not a monthly 2025 query")
            return []

        # Check if data has monthly columns
        monthly_columns = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                          "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        has_monthly_data = any(
            any(month in col.lower() for month in monthly_columns)
            for col in data.columns
        )

        # Also check if data has PRODUCTO column (PROD_2025 table)
        has_producto_column = any("producto" in col.lower() for col in data.columns)

        # Alternative detection: Check if DataFrame has 2025 data
        has_anio_2025 = False
        if 'anio' in [c.lower() for c in data.columns] or 'año' in [c.lower() for c in data.columns]:
            try:
                anio_col = [c for c in data.columns if c.lower() in ['anio', 'año']][0]
                has_anio_2025 = any(data[anio_col].astype(str).str.contains('2025', na=False))
            except:
                pass

        logger.info(
            f"🔍 Monthly 2025 detection: has_2025={has_2025}, has_products={has_products}, "
            f"has_temporal={has_temporal}, has_monthly_data={has_monthly_data}, "
            f"has_producto_column={has_producto_column}, has_anio_2025={has_anio_2025}"
        )

        # IMPORTANT: Exclude ROBUSTEZ database queries
        # These SQL followups query ECP_PROD tables (PROD_2025).
        robustez_indicators = ["campo", "uwi", "pend_id_cc", "activo", "breakeven", "ebitda"]
        ecp_prod_indicators = ["vice", "real_acum", "producto", "programado"]
        cols_lower = [col.lower() for col in data.columns]
        is_robustez_data = (
            any(ind in col for ind in robustez_indicators for col in cols_lower)
            and not any(ind in col for ind in ecp_prod_indicators for col in cols_lower)
        )

        # Question-level ROBUSTEZ detection: terms exclusive to ROBUSTEZ hierarchy
        robustez_question_terms = [
            "vicepresidencia", "robustez", "breakeven", "ebitda",
            "uwi", "pend_id_cc", "rentable", "no rentable",
            "costos variables", "dilución", "tipo de pozo",
            "campo", "pozo",
        ]
        is_robustez_query = any(term in question_lower for term in robustez_question_terms)

        if not (has_monthly_data or has_producto_column or has_anio_2025) or is_robustez_data or is_robustez_query:
            logger.info(f"❌ Data validation failed for monthly 2025 pattern (robustez_data={is_robustez_data}, robustez_query={is_robustez_query})")
            return []

        logger.info("🎯 Generating monthly 2025 SQL follow-ups")

        buttons = []

        # 1. Variación de la producción de Crudo mes a mes durante 2025
        buttons.append({
            "id": "FU_04_Variacion_Crudo_Mensual_2025",
            "title": "Variación de la producción de Crudo mes a mes durante 2025",
            "description": "Análisis de la evolución mensual de la producción de crudo con deltas y porcentajes de cambio",
            "sql_query": """
WITH m AS (
    SELECT 1 AS mes_n, 'Enero'      AS Mes, SUM(Enero)      AS BOPD FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 2, 'Febrero',   SUM(Febrero)            FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 3, 'Marzo',     SUM(Marzo)              FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 4, 'Abril',     SUM(Abril)              FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 5, 'Mayo',      SUM(Mayo)               FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 6, 'Junio',     SUM(Junio)              FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 7, 'Julio',     SUM(Julio)              FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 8, 'Agosto',    SUM(Agosto)             FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
    UNION ALL SELECT 9, 'Septiembre',SUM(Septiembre)         FROM PROD_2025 WHERE TRIM(PRODUCTO)='CRUDO'
)
SELECT
    2025 AS Anio,
    Mes,
    BOPD,
    BOPD - LAG(BOPD) OVER (ORDER BY mes_n)                                AS Variacion_MoM,
    CASE
        WHEN LAG(BOPD) OVER (ORDER BY mes_n) IS NULL OR LAG(BOPD) OVER (ORDER BY mes_n)=0
            THEN NULL
        ELSE (BOPD - LAG(BOPD) OVER (ORDER BY mes_n)) * 100.0
             / LAG(BOPD) OVER (ORDER BY mes_n)
    END AS Variacion_MoM_pct
FROM m
WHERE BOPD IS NOT NULL AND BOPD > 0
ORDER BY mes_n
            """.strip(),
            "database": "ecp_prod",
            "config": {
                "chart_type": "subplot_combo",
                "title": "Variación Mensual de Crudo 2025",
                "x_axis": "Mes",
                "subplots": [
                    {
                        "type": "line",
                        "y_axis": ["BOPD"],
                        "title": "Producción de Crudo 2025 (Enero-Septiembre)",
                        "yaxis_title": "BOPD",
                        "row": 1
                    },
                    {
                        "type": "bar",
                        "y_axis": ["Variacion_MoM_pct"],
                        "title": "Variación % mes a mes",
                        "yaxis_title": "Variación (%)",
                        "row": 2
                    }
                ],
                "layout": {
                    "rows": 2,
                    "cols": 1,
                    "row_heights": [0.6, 0.4],
                    "shared_xaxis": True
                }
            },
            "priority": 0.95,
            "css_class": "btn btn-outline-primary btn-sm chart-button",
            "is_sql_query": True,
        })

        # 2. Variación entre mes de mayor y menor producción total
        buttons.append({
            "id": "FU_05_MaxMin_Produccion_Mensual_2025",
            "title": "Variación de la producción total de hidrocarburos entre el mes de mayor producción y el de menor producción en 2025",
            "description": "Comparación entre el mes con mayor producción total y el mes con menor producción de hidrocarburos",
            "sql_query": """
WITH monthly AS (
    SELECT 1 AS mes_n, 'Enero'       AS Mes, SUM(Enero)       AS Total
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 2, 'Febrero',    SUM(Febrero)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 3, 'Marzo',      SUM(Marzo)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 4, 'Abril',      SUM(Abril)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 5, 'Mayo',       SUM(Mayo)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 6, 'Junio',      SUM(Junio)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 7, 'Julio',      SUM(Julio)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 8, 'Agosto',     SUM(Agosto)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 9, 'Septiembre', SUM(Septiembre)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 10, 'Octubre',   SUM(Octubre)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 11, 'Noviembre', SUM(Noviembre)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
    UNION ALL SELECT 12, 'Diciembre', SUM(Diciembre)
    FROM PROD_2025 WHERE TRIM(PRODUCTO) IN ('CRUDO','GAS','BLANCOS')
),
valid AS (
    SELECT * FROM monthly WHERE Total IS NOT NULL AND Total > 0
),
extremos AS (
    SELECT
        (SELECT Mes   FROM valid ORDER BY Total DESC LIMIT 1) AS Mes_Max,
        (SELECT Total FROM valid ORDER BY Total DESC LIMIT 1) AS Total_Max,
        (SELECT Mes   FROM valid ORDER BY Total ASC  LIMIT 1) AS Mes_Min,
        (SELECT Total FROM valid ORDER BY Total ASC  LIMIT 1) AS Total_Min
)
SELECT
    2025 AS Anio,
    Mes_Max,
    Total_Max,
    Mes_Min,
    Total_Min,
    Total_Max - Total_Min AS Variacion_Absoluta,
    CASE WHEN Total_Min = 0 THEN NULL
         ELSE (Total_Max - Total_Min) * 100.0 / Total_Min
    END AS Variacion_pct_vs_Min
FROM extremos
            """.strip(),
            "database": "ecp_prod",
            "config": {
                "chart_type": "horizontal_comparison_bar",
                "title": "Comparación Máximo vs Mínimo Mensual 2025",
                "data_mapping": {
                    "categories": ["Mes_Min", "Mes_Max"],
                    "values": ["Total_Min", "Total_Max"],
                    "labels": ["Mínimo", "Máximo"],
                    "month_labels": True,
                    "show_values": True
                },
                "colors": {
                    "min": "#00A86B",
                    "max": "#004236"
                }
            },
            "priority": 0.90,
            "css_class": "btn btn-outline-warning btn-sm chart-button",
            "is_sql_query": True,
        })

        # 3. Porcentaje de participación por producto mensual
        buttons.append({
            "id": "FU_06_Porcentaje_Participacion_Mensual_2025",
            "title": "Porcentaje de la producción total mensual corresponde a Crudo, Gas y Blancos en 2025",
            "description": "Distribución porcentual de cada producto en la producción total mensual de 2025",
            "sql_query": """
WITH base AS (
    -- Totales por mes y por producto
    SELECT 1 AS mes_n, 'Enero' AS Mes,
           SUM(Enero) AS total_mes,
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Enero ELSE 0 END) AS crudo,
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Enero ELSE 0 END) AS gas,
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Enero ELSE 0 END) AS blancos
    FROM PROD_2025
    UNION ALL SELECT 2,'Febrero',
           SUM(Febrero),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Febrero ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Febrero ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Febrero ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 3,'Marzo',
           SUM(Marzo),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Marzo ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Marzo ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Marzo ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 4,'Abril',
           SUM(Abril),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Abril ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Abril ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Abril ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 5,'Mayo',
           SUM(Mayo),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Mayo ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Mayo ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Mayo ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 6,'Junio',
           SUM(Junio),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Junio ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Junio ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Junio ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 7,'Julio',
           SUM(Julio),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Julio ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Julio ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Julio ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 8,'Agosto',
           SUM(Agosto),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Agosto ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Agosto ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Agosto ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 9,'Septiembre',
           SUM(Septiembre),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Septiembre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Septiembre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Septiembre ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 10,'Octubre',
           SUM(Octubre),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Octubre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Octubre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Octubre ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 11,'Noviembre',
           SUM(Noviembre),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Noviembre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Noviembre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Noviembre ELSE 0 END)
    FROM PROD_2025
    UNION ALL SELECT 12,'Diciembre',
           SUM(Diciembre),
           SUM(CASE WHEN TRIM(PRODUCTO)='CRUDO'   THEN Diciembre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='GAS'     THEN Diciembre ELSE 0 END),
           SUM(CASE WHEN TRIM(PRODUCTO)='BLANCOS' THEN Diciembre ELSE 0 END)
    FROM PROD_2025
),
valid AS (
    SELECT * FROM base WHERE total_mes IS NOT NULL AND total_mes > 0
),
pct AS (
    SELECT 2025 AS Anio, mes_n, Mes, 'CRUDO'   AS Producto,
           crudo   * 100.0 / NULLIF(total_mes,0) AS Porcentaje
    FROM valid
    UNION ALL
    SELECT 2025, mes_n, Mes, 'GAS',
           gas     * 100.0 / NULLIF(total_mes,0)
    FROM valid
    UNION ALL
    SELECT 2025, mes_n, Mes, 'BLANCOS',
           blancos * 100.0 / NULLIF(total_mes,0)
    FROM valid
)
SELECT Anio, Mes, Producto, Porcentaje
FROM pct
ORDER BY mes_n,
         CASE Producto WHEN 'CRUDO' THEN 1 WHEN 'GAS' THEN 2 ELSE 3 END
            """.strip(),
            "database": "ecp_prod",
            "config": {
                "chart_type": "multi_line_grouped",
                "title": "Participación mensual de Gas y Blancos en 2025",
                "x_axis": "Mes",
                "y_axis": "Porcentaje",
                "group_by": "Producto",
                "filters": {
                    "exclude_products": ["CRUDO"]
                },
                "series_config": {
                    "GAS": {
                        "color": "#F7DB17",
                        "name": "Gas (%)"
                    },
                    "BLANCOS": {
                        "color": "#00A8E8",
                        "name": "Blancos (%)"
                    }
                },
                "layout": {
                    "yaxis_title": "Participación (%)",
                    "xaxis_title": "Mes",
                    "showlegend": True,
                    "height": 400
                }
            },
            "priority": 0.85,
            "css_class": "btn btn-outline-success btn-sm chart-button",
            "is_sql_query": True,
        })

        logger.info(f"📊 Generated {len(buttons)} SQL follow-ups for monthly 2025 production")
        return buttons

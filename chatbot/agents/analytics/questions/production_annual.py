"""
Production Annual Pattern

Handles questions about annual national petroleum production.

Example questions:
- "Qué valores anuales registra la producción de crudo nacional?"
- "Cuál ha sido la producción de petróleo en BOPD a nivel nacional los ultimos años?"
- "Qué producción nacional de crudo se ha obtenido en los ultimos años?"
"""

import logging
import pandas as pd
from typing import List, Dict

from .base_pattern import QuestionPatternBase

logger = logging.getLogger(__name__)


class ProductionAnnualPattern(QuestionPatternBase):
    """
    Pattern for annual production analysis questions.

    Generates 3 SQL followup buttons:
    1. YoY Variation & CAGR
    2. Participation by Management
    3. Ranking of Management Units
    """

    keywords = [
        "producción", "bopd", "nacional", "año", "gerencia",
        "crudo", "petróleo", "anual", "anuales", "volumen",
        "promedio", "últimos", "ultimos", "valores", "registra"
    ]
    priority = 90  # High priority
    description = "Annual national petroleum production analysis"

    def followup_buttons(
        self, question: str, data: pd.DataFrame
    ) -> List[Dict]:
        """Generate followup buttons for annual production analysis"""

        # Validate data structure
        has_year = any(
            "año" in col.lower() or "year" in col.lower() for col in data.columns
        )
        has_bopd = any(
            "bopd" in col.lower() or "produccion" in col.lower()
            for col in data.columns
        )

        # IMPORTANT: Exclude monthly 2025 queries
        question_lower = question.lower()
        is_2025_monthly = "2025" in question_lower and any(
            t in question_lower for t in ["mensual", "meses", "mes a mes", "mensualmente", "durante", "por mes", "cada mes", "mes por mes"]
        )

        # IMPORTANT: Exclude ROBUSTEZ database queries
        # These SQL followups query ECP_PROD tables (PROD_2023/2024/2025).
        # ROBUSTEZ data has columns like CAMPO, UWI, PEND_ID_CC at per-well granularity.
        robustez_indicators = ["campo", "uwi", "pend_id_cc", "activo", "breakeven", "ebitda"]
        ecp_prod_indicators = ["vice", "real_acum", "producto", "programado"]
        cols_lower = [col.lower() for col in data.columns]
        is_robustez_data = (
            any(ind in col for ind in robustez_indicators for col in cols_lower)
            and not any(ind in col for ind in ecp_prod_indicators for col in cols_lower)
        )

        # Question-level ROBUSTEZ detection: terms exclusive to ROBUSTEZ hierarchy
        # "vicepresidencia" is ROBUSTEZ-specific (ECP_PROD uses "VICE" column)
        robustez_question_terms = [
            "vicepresidencia", "robustez", "breakeven", "ebitda",
            "uwi", "pend_id_cc", "rentable", "no rentable",
            "costos variables", "dilución", "tipo de pozo",
            "campo", "pozo",
        ]
        is_robustez_query = any(term in question_lower for term in robustez_question_terms)

        if not (has_year or has_bopd) or is_2025_monthly or is_robustez_data or is_robustez_query:
            logger.info(f"❌ Production annual pattern: Data validation failed (robustez_data={is_robustez_data}, robustez_query={is_robustez_query})")
            return []

        logger.info("🎯 Generating annual production SQL follow-ups")

        buttons = []

        # 1. Variación Interanual (YoY) con CAGR
        buttons.append({
            "id": "FU_01_Variacion_interanual_YoY",
            "title": "(%) de Variación(%) anual de la producción !",
            "description": "Análisis completo de crecimiento año sobre año con delta absoluto, porcentaje de cambio y CAGR desde inicio",
            "chart_type": "bar",
            "sql_query": """
WITH prod_all AS (
  SELECT '2023' AS AÑO, SUM(Real_Acum) AS bopd_nacional
  FROM PROD_2023 WHERE TRIM(PRODUCTO) = 'CRUDO'
  UNION ALL
  SELECT '2024', SUM(Real_Acum)
  FROM PROD_2024 WHERE TRIM(PRODUCTO) = 'CRUDO'
  UNION ALL
  SELECT '2025', SUM(Real_Acum)
  FROM PROD_2025 WHERE TRIM(PRODUCTO) = 'CRUDO'
),
yoy AS (
  SELECT
    CAST(AÑO AS INT) AS año_int,
    AÑO,
    bopd_nacional,
    LAG(bopd_nacional) OVER (ORDER BY CAST(AÑO AS INT)) AS bopd_prev
  FROM prod_all
)
SELECT
  AÑO,
  bopd_nacional,
  (bopd_nacional - COALESCE(bopd_prev, bopd_nacional)) AS delta_abs,
  CASE WHEN bopd_prev IS NULL OR bopd_prev = 0 THEN 0
       ELSE 100.0*(bopd_nacional - bopd_prev)/bopd_prev END AS delta_pct
FROM yoy
ORDER BY año_int;
            """.strip(),
            "database": "ecp_prod",
            "config": {
                "x_axis": "AÑO",
                "y_axis": "delta_pct",
                "chart_type": "bar",
                "title": "Variación Interanual de Producción Nacional",
            },
            "priority": 0.95,
            "css_class": "btn btn-outline-primary btn-sm chart-button",
            "is_sql_query": True,
        })

        # 2. Participación por Gerencia
        buttons.append({
            "id": "FU_02_Particip_Produccion_gerencias",
            "title": "Participación por Gerencia",
            "description": "Distribución porcentual de producción por gerencias operativas con botones para rangos de tiempo",
            "sql_query": """
WITH prod_all AS (
  SELECT '2023' AS AÑO, VICE, SUM(Real_Acum) AS prod
  FROM PROD_2023 WHERE TRIM(PRODUCTO) = 'CRUDO' GROUP BY VICE
  UNION ALL
  SELECT '2024', VICE, SUM(Real_Acum)
  FROM PROD_2024 WHERE TRIM(PRODUCTO) = 'CRUDO' GROUP BY VICE
  UNION ALL
  SELECT '2025', VICE, SUM(Real_Acum)
  FROM PROD_2025 WHERE TRIM(PRODUCTO) = 'CRUDO' GROUP BY VICE
)
SELECT
  AÑO,
  VICE AS GERENCIA,
  prod AS BOPD,
  SUM(prod) OVER (PARTITION BY AÑO) AS bopd_total,
  ROUND(100.0 * prod / SUM(prod) OVER (PARTITION BY AÑO), 2) AS pct_participacion
FROM prod_all
ORDER BY AÑO, pct_participacion DESC;
            """.strip(),
            "database": "ecp_prod",
            "config": {
                "x_axis": "GERENCIA",
                "y_axis": "pct_participacion",
                "chart_type": "pie",
                "title": "Participación por Gerencia",
            },
            "priority": 0.90,
            "css_class": "btn btn-outline-success btn-sm chart-button",
            "is_sql_query": True,
        })

        # 3. Ranking de Gerencias por BOPD
        buttons.append({
            "id": "FU_03_Ranking_Gerencias_BOPD",
            "title": "Ranking de Gerencias por BOPD",
            "description": "Clasificación de gerencias por volumen de producción con ranking por año",
            "sql_query": """
WITH prod_all AS (
  SELECT '2023' AS AÑO, VICE, SUM(Real_Acum) AS prod
  FROM PROD_2023 WHERE TRIM(PRODUCTO) = 'CRUDO' GROUP BY VICE
  UNION ALL
  SELECT '2024', VICE, SUM(Real_Acum)
  FROM PROD_2024 WHERE TRIM(PRODUCTO) = 'CRUDO' GROUP BY VICE
  UNION ALL
  SELECT '2025', VICE, SUM(Real_Acum)
  FROM PROD_2025 WHERE TRIM(PRODUCTO) = 'CRUDO' GROUP BY VICE
)
SELECT
  AÑO,
  VICE AS GERENCIA,
  prod AS BOPD_TOTAL,
  RANK() OVER (PARTITION BY AÑO ORDER BY prod DESC) AS RANKING
FROM prod_all
ORDER BY BOPD_TOTAL DESC;
            """.strip(),
            "database": "ecp_prod",
            "config": {
                "x_axis": "GERENCIA",
                "y_axis": "BOPD_TOTAL",
                "chart_type": "ranking_bar",
                "title": "Ranking de Gerencias por BOPD",
                "top_n": 10
            },
            "priority": 0.85,
            "css_class": "btn btn-outline-info btn-sm chart-button",
            "is_sql_query": True,
        })

        logger.info(f"📊 Generated {len(buttons)} SQL follow-ups for annual production")
        return buttons

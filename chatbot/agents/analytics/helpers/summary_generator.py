"""
Summary Generator Module
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

logger = logging.getLogger(__name__)

def _create_enhanced_visualization_summary(
        self,
        dynamic_buttons: List[Dict],
        recommendations: List[Dict],
        auto_charts: List[Dict],
    ) -> str:
        """Create enhanced visualization summary including dynamic buttons"""
        try:
            summary_parts = []

            if dynamic_buttons:
                summary_parts.append(
                    f"Se generaron {len(dynamic_buttons)} botones dinámicos de visualización"
                )

                button_types = [btn["chart_type"] for btn in dynamic_buttons]
                summary_parts.append(
                    f"Opciones disponibles: {', '.join(set(button_types))}"
                )

            if auto_charts:
                summary_parts.append(
                    f"Se crearon {len(auto_charts)} gráficos automáticos"
                )

            if recommendations:
                summary_parts.append(
                    f"Se generaron {len(recommendations)} recomendaciones adicionales"
                )

            return (
                ". ".join(summary_parts)
                if summary_parts
                else "No se generaron visualizaciones"
            )

        except Exception as e:
            logger.error(f"Error creating enhanced visualization summary: {e}")
            return "Error creando resumen de visualización"



def _create_fallback_message(graphability_check: Dict) -> str:
        """Create a user-friendly fallback message for non-graphable data"""
        reason = graphability_check.get("reason", "Datos no aptos para gráficos")
        suggestions = graphability_check.get("suggestions", [])

        message_parts = [f"📊 {reason}"]

        if suggestions:
            message_parts.append("\n💡 Sugerencias:")
            for suggestion in suggestions:
                message_parts.append(f"• {suggestion}")

        message_parts.append("\n🔍 Puedes intentar consultas como:")
        message_parts.append(
            "• Evolución de producción de aceite en los últimos 6 meses"
        )
        message_parts.append("• Comparar producción entre diferentes campos")
        message_parts.append("• Distribución de GOR por pozos activos")

        return "\n".join(message_parts)



def _create_visualization_summary(
        recommendations: List[Dict], auto_charts: List[Dict]
    ) -> str:
        """Create visualization summary (legacy method for backwards compatibility)"""
        try:
            summary_parts = []

            if recommendations:
                summary_parts.append(
                    f"Se generaron {len(recommendations)} recomendaciones de gráficos"
                )

                chart_types = [rec["chart_type"] for rec in recommendations]
                summary_parts.append(
                    f"Tipos recomendados: {', '.join(set(chart_types))}"
                )

            if auto_charts:
                summary_parts.append(
                    f"Se crearon {len(auto_charts)} gráficos automáticos"
                )

            return (
                ". ".join(summary_parts)
                if summary_parts
                else "No se generaron visualizaciones"
            )

        except Exception as e:
            logger.error(f"Error creating visualization summary: {e}")
            return "Error creando resumen de visualización"




#!/usr/bin/env python3
"""
iny_comp_lienzo_mensual.py
--------------------------

Guía automatizada para recordar cómo habilitar componentes en el lienzo del
reporte "Balance (mes)" (o cualquier otro pipeline mensual similar).

El script **no** modifica archivos; simplemente imprime los pasos y rutas
claves a seguir. Ejecútalo cuando necesites reproducir el proceso.
"""

from __future__ import annotations

import textwrap


STEPS = """
1. Incluir el archivo JS especializado antes de `chat.js`
   - Editar `templates/main.html` (u otra plantilla base) y agregar:
       <script src="{{ url_for('static', filename='js/monthlyBalance.js') }}"></script>
       <script src="{{ url_for('static', filename='js/chat.js') }}"></script>

2. Estructura del backend (placeholder)
   - Archivo: `chatbot/agents/analytics/chart_creators/monthly_balance.py`
   - Función clave: `create_monthly_balance_payload`, que debe devolver:
       {
         "success": True,
         "chart_data": None,
         "summary_table": {"headers": [], "rows": [], "title": "..."},
         "analysis_table": None,
         "production_types_table": None,
         "data_points": 0,
         "date_range": None,
         "metrics": [],
         "chart_type": "production_monthly_balance",
         "message": "Pagina en construccion"
       }

3. Renderer frontend minimalista
   - Archivo: `static/js/monthlyBalance.js`
   - Asegurarse de exponer las funciones sin `export`:
       function renderMonthlyBalanceReport(container, payload) { ... }
       if (typeof window !== "undefined") {
           window.monthlyBalanceRenderer = window.monthlyBalanceRenderer || {};
           window.monthlyBalanceRenderer.renderMonthlyBalanceReport = renderMonthlyBalanceReport;
       }
   - Dentro de `renderMonthlyBalanceReport`, limpiar el contenedor y crear la card:
       container.innerHTML = "";
       const card = document.createElement("div");
       card.className = "card mb-3";
       // ... header + body con el mensaje placeholder ...
       container.appendChild(card);

4. Integración en `chat.js`
   - En `loadFixedReport`, detectar `result.chart_type === "production_monthly_balance"`
     y delegar a `window.monthlyBalanceRenderer.renderMonthlyBalanceReport(...)`.
   - Si el renderer no existe, limpiar el contenedor para evitar errores.

5. Botones hardcodeados (fallback del frontend)
   - En `showProductionReportInChat` (dentro de `static/js/chat.js`), asegurarse de que
     la opción correspondiente tenga:
       enabled: true,
       icon: "fas fa-check-circle",
       css_class: "report-option enabled",
       action_data: { report_type: "monthly_balance", chart_type: "production_monthly_balance" }

Sugerencia: Si se crea un nuevo pipeline similar, reutiliza `scripts/Active_Buttons_report.py`,
que ya automatiza la mayor parte del proceso.
"""


def main() -> None:
    print("=" * 70)
    print("INSTRUCCIONES PARA INYECTAR COMPONENTES EN EL LIENZO MENSUAL")
    print("=" * 70)
    print(textwrap.dedent(STEPS).strip())
    print("\nListo. Sigue los pasos en orden para garantizar que la card se renderice.")


if __name__ == "__main__":
    main()


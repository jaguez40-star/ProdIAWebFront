#!/usr/bin/env python3
"""
Configura o actualiza un pipeline de reporte fijo que muestra un lienzo en blanco.

Pasos automatizados:
1. Habilitar el boton correspondiente en fixed_reports.py (icono, css_class,
   chart_type y configuracion).
2. Generar el modulo backend (chart_creators/<slug>_placeholder.py) con la
   funcion create_<slug>_payload.
3. Crear el renderer frontend (static/js/<slug>.js) que deja el panel vacio con
   un mensaje.
4. Conectar production_reports.py importando el modulo y anadiendo la rama del
   pipeline.
5. Actualizar chat.js para delegar el renderizado segun el chart_type recien
   creado, preservando el flujo diario existente.

El script solicita el titulo exacto del boton, muestra una barra de progreso y
mantiene intactos los pipelines ya configurados.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def show_progress(step: int, total: int, description: str) -> None:
    percent = int(step / total * 100)
    bar_len = 40
    filled = int(bar_len * percent / 100)
    bar = "#" * filled + "-" * (bar_len - filled)
    print(f"[{bar}] {percent:3d}% - {description}")


def prompt_button_title() -> str:
    title = input("Titulo exacto del boton en fixed_reports.py: ").strip()
    if not title:
        print("No se proporciono un titulo. Abortando.")
        sys.exit(1)
    return title


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower())
    slug = slug.strip("_")
    return slug or "reporte"


def pascal_case(slug: str) -> str:
    parts = [word for word in slug.split("_") if word]
    return "".join(part.capitalize() for part in parts) or "Reporte"


def update_fixed_reports(title: str, chart_type: str) -> str:
    """
    Habilita el boton y devuelve el option_id detectado en fixed_reports.py.
    """
    path = PROJECT_ROOT / "chatbot" / "agents" / "analytics" / "button_generators" / "fixed_reports.py"
    text = path.read_text(encoding="utf-8")

    match = re.search(rf'"title"\s*:\s*"{re.escape(title)}"', text)
    if not match:
        raise ValueError(f'No se encontro una opcion con title "{title}" en fixed_reports.py')

    block_start = text.rfind("{", 0, match.start())
    if block_start == -1:
        raise ValueError("No se pudo delimitar el bloque del boton en fixed_reports.py")

    level = 0
    block_end = None
    for idx in range(block_start, len(text)):
        char = text[idx]
        if char == "{":
            level += 1
        elif char == "}":
            level -= 1
            if level == 0:
                block_end = idx
                break
    if block_end is None:
        raise ValueError("No se pudo cerrar el bloque del boton en fixed_reports.py")

    block = text[block_start:block_end + 1]

    id_match = re.search(r'"id"\s*:\s*"([^"]+)"', block)
    if not id_match:
        raise ValueError('No se encontro "id" en el bloque del boton')
    option_id = id_match.group(1)

    def replace_field(pattern: str, replacement: str) -> None:
        nonlocal block
        block_new, count = re.subn(pattern, replacement, block, flags=re.DOTALL)
        if count:
            block = block_new

    replace_field(r'("enabled"\s*:\s*)(True|False)', r'\1True')
    replace_field(r'("icon"\s*:\s*)"[^"]*"', r'\1"fas fa-check-circle"')
    replace_field(r'("css_class"\s*:\s*)"[^"]*"', r'\1"report-option enabled"')

    if '"chart_type"' in block:
        replace_field(r'("chart_type"\s*:\s*)"[^"]*"', rf'\1"{chart_type}"')
    else:
        insert_pos = block.find("\n", block.find('"id"'))
        chart_type_line = f'\n                "chart_type": "{chart_type}",'
        block = block[:insert_pos] + chart_type_line + block[insert_pos:]

    config_block = (
        f'                "config": {{\n'
        f'                    "report_type": "{option_id}",\n'
        f'                    "chart_config": {{\n'
        f'                        "title": "{title}"\n'
        f'                    }}\n'
        f'                }}'
    )
    if '"config"' in block:
        block = re.sub(r'"config"\s*:\s*\{.*?\}', config_block, block, flags=re.DOTALL)
    else:
        block = block.rstrip("}\n") + "\n" + config_block + "\n            }"

    text = text[:block_start] + block + text[block_end + 1:]
    path.write_text(text, encoding="utf-8")

    return option_id


def write_backend_module(slug: str, chart_type: str, message: str) -> str:
    module_name = f"{slug}_placeholder"
    payload_func = f"create_{slug}_payload"
    message_escaped = message.replace('"', '\\"')

    path = PROJECT_ROOT / "chatbot" / "agents" / "analytics" / "chart_creators" / f"{module_name}.py"
    content = f'''"""
Placeholder module for "{message_escaped}".
"""

from typing import Any, Dict

__all__ = ["{payload_func}"]


def {payload_func}(
    db_connection,
    config: Dict[str, Any] = None,
    summary_table: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """Return a minimal payload indicating the page is under construction."""
    return {{
        "success": True,
        "chart_data": None,
        "summary_table": {{
            "headers": [],
            "rows": [],
            "title": "{message_escaped}",
        }},
        "analysis_table": None,
        "production_types_table": None,
        "data_points": 0,
        "date_range": None,
        "metrics": [],
        "chart_type": "{chart_type}",
        "message": "{message_escaped}",
    }}
'''
    path.write_text(content, encoding="utf-8")
    return module_name, payload_func


def write_js_file(slug: str, pascal: str, message: str) -> tuple[str, str, str]:
    js_name = f"{slug}.js"
    render_func = f"render{pascal}Report"
    renderer_var = f"{pascal}Renderer"
    message_escaped = message.replace('"', '\\"')

    path = PROJECT_ROOT / "static" / "js" / js_name
    content = f'''/**
 * Placeholder renderer for "{message_escaped}".
 * Deja el contenedor en blanco mostrando el mensaje recibido.
 */

export function {render_func}(container, payload) {{
  if (!container) return;

  container.innerHTML = "";
  const message = payload?.message || "{message_escaped}";

  const notice = document.createElement("div");
  notice.className = "alert alert-info";
  notice.innerHTML = `
    <i class="fas fa-info-circle me-2"></i>
    ${message}
  `;
  container.appendChild(notice);
}}

if (typeof window !== "undefined") {{
  window.{renderer_var} = window.{renderer_var} || {{}};
  window.{renderer_var}.{render_func} = {render_func};
}}
'''
    path.write_text(content, encoding="utf-8")
    return js_name, render_func, renderer_var


def update_production_reports(
    module_name: str,
    payload_func: str,
    slug: str,
    option_id: str,
) -> None:
    path = PROJECT_ROOT / "chatbot" / "agents" / "analytics" / "chart_creators" / "production_reports.py"
    text = path.read_text(encoding="utf-8")

    import_line = f"from .{module_name} import {payload_func}\n"
    if import_line not in text:
        text = text.replace("import pandas as pd\n", f"import pandas as pd\n{import_line}")

    wrapper_name = f"create_{slug}_chart"
    if f"def {wrapper_name}(" not in text:
        anchor = "    def _fetch_daily_performance_data("
        idx = text.find(anchor)
        if idx == -1:
            raise ValueError("No se encontro el ancla para insertar el wrapper en production_reports.py")
        wrapper = (
            f"    def {wrapper_name}(\n"
            f"        self,\n"
            f"        data: Dict[str, Any] = None,\n"
            f"        config: Dict[str, Any] = None,\n"
            f"    ) -> Dict[str, Any]:\n"
            f"        return {payload_func}(\n"
            f"            self.db_connection,\n"
            f"            config=config,\n"
            f"            summary_table=data,\n"
            f"        )\n\n"
        )
        text = text[:idx] + wrapper + text[idx:]

    branch = (
        f'        elif report_option_id == "{option_id}":\n'
        f"            config = custom_params.get(\"config\") if custom_params else None\n"
        f"            return self.{wrapper_name}(config=config)\n"
    )
    if branch not in text:
        marker = '        elif report_option_id == "monthly_balance":'
        if marker in text:
            text = text.replace(marker, branch + marker, 1)
        else:
            else_marker = "        else:\n"
            text = text.replace(else_marker, branch + else_marker, 1)

    path.write_text(text, encoding="utf-8")


def ensure_render_signature(text: str) -> str:
    old_sig = (
        "  renderProductionChart(\n"
        "    chartData,\n"
        "    container,\n"
        "    summaryTable = null,\n"
        "    analysisTable = null,\n"
        "    productionTypesTable = null\n"
        "  ) {\n"
    )
    if old_sig in text:
        new_sig = (
            "  renderProductionChart(\n"
            "    chartData,\n"
            "    container,\n"
            "    summaryTable = null,\n"
            "    analysisTable = null,\n"
            "    productionTypesTable = null,\n"
            '    chartType = "production_daily_performance"\n'
            "  ) {\n"
        )
        text = text.replace(old_sig, new_sig, 1)
    return text


def ensure_daily_cards_guard(text: str) -> str:
    original = (
        "    // Create a container for both analysis cards\n"
        "    const analysisContainer = document.createElement('div');\n"
    )
    if original in text and 'if (chartType === "production_daily_performance")' not in text:
        text = text.replace(
            original,
            '    // Create a container for both analysis cards\n'
            '    if (chartType === "production_daily_performance") {\n'
            "      const analysisContainer = document.createElement('div');\n",
            1,
        )
        text = text.replace(
            "    analysisContainer.appendChild(analysisCard);\n"
            "    analysisContainer.appendChild(productionTypesCard);\n"
            "    container.appendChild(analysisContainer);\n",
            "      analysisContainer.appendChild(analysisCard);\n"
            "      analysisContainer.appendChild(productionTypesCard);\n"
            "      container.appendChild(analysisContainer);\n"
            "    }\n",
            1,
        )
    return text


def insert_placeholder_branch(text: str, chart_type: str, renderer_var: str, render_func: str) -> str:
    if chart_type in text:
        return text

    marker = '      if (result.chart_type === "production_monthly_balance") {'
    if marker not in text:
        raise ValueError("No se encontro el bloque de monthly_balance en chat.js")

    branch = (
        f'      if (result.chart_type === "{chart_type}") {{\n'
        f"        const rendererNamespace = window.{renderer_var};\n"
        f"        const renderFn =\n"
        f"          (rendererNamespace && rendererNamespace.{render_func}) || window.{render_func};\n"
        f"        if (typeof renderFn === \"function\") {{\n"
        f"          renderFn(chartsArea, result);\n"
        f"        }} else {{\n"
        f'          console.warn("Renderer for chart type \'{chart_type}\' not found; leaving blank canvas.");\n'
        f"          if (result.chart_data) {{\n"
        f"            this.renderProductionChart(\n"
        f"              result.chart_data,\n"
        f"              chartsArea,\n"
        f"              result.summary_table,\n"
        f"              result.analysis_table,\n"
        f"              result.production_types_table,\n"
        f"              result.chart_type\n"
        f"            );\n"
        f"          }} else if (chartsArea) {{\n"
        f"            chartsArea.innerHTML = \"\";\n"
        f"          }}\n"
        f"        }}\n"
        f"      }} else "
    )
    return text.replace(marker, branch + marker, 1)


def update_chat_js(chart_type: str, renderer_var: str, render_func: str) -> None:
    path = PROJECT_ROOT / "static" / "js" / "chat.js"
    text = path.read_text(encoding="utf-8")

    text = ensure_render_signature(text)
    text = ensure_daily_cards_guard(text)
    text = insert_placeholder_branch(text, chart_type, renderer_var, render_func)

    path.write_text(text, encoding="utf-8")


def main() -> None:
    title = prompt_button_title()
    slug = slugify(title)
    pascal = pascal_case(slug)
    chart_type = f"production_{slug}"
    message = f"{title} - Pagina en construccion"

    total_steps = 5
    step = 0

    option_id = update_fixed_reports(title, chart_type)
    step += 1
    show_progress(step, total_steps, "Boton habilitado en fixed_reports.py")

    module_name, payload_func = write_backend_module(slug, chart_type, message)
    step += 1
    show_progress(step, total_steps, "Modulo backend generado")

    js_name, render_func, renderer_var = write_js_file(slug, pascal, message)
    step += 1
    show_progress(step, total_steps, "Renderer frontend creado")

    update_production_reports(module_name, payload_func, slug, option_id)
    step += 1
    show_progress(step, total_steps, "production_reports.py actualizado")

    update_chat_js(chart_type, renderer_var, render_func)
    step += 1
    show_progress(step, total_steps, "chat.js actualizado")

    print(
        f'\nPipeline configurado para el boton "{title}".\n'
        f"- Modulo backend: {module_name}.py\n"
        f"- Renderer frontend: {js_name}\n"
        f"- chart_type utilizado: {chart_type}\n"
        "Al ejecutarse el boton se presentara un lienzo en blanco listo para agregar componentes."
    )


if __name__ == "__main__":
    main()


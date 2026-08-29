"""
Pipeline independiente para analizar variaciones programadas (Crudo y Blancos)
usando el mismo ecosistema de LLM que el módulo res_mes_var.py.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import sqlite3
import importlib.util

# --- Configuración común ----------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in os.sys.path:  # ensure package imports work
    os.sys.path.insert(0, str(PROJECT_ROOT))
DB_PATH = PROJECT_ROOT / "data" / "ECP_PROD.db"
OUTPUT_JSON = Path(__file__).with_name("Resp_AnalisisProduccion.json")

# Reutilizar llm_manager del proyecto
LLM_SPEC = importlib.util.spec_from_file_location(
    "chatbot.core.llm_manager_custom", PROJECT_ROOT / "chatbot" / "core" / "llm_manager.py"
)
if LLM_SPEC is None or LLM_SPEC.loader is None:
    raise ImportError("No se pudo importar chatbot/core/llm_manager.py")

llm_module = importlib.util.module_from_spec(LLM_SPEC)
LLM_SPEC.loader.exec_module(llm_module)
llm_manager = llm_module.llm_manager

LOGGER = logging.getLogger(__name__)

# Prompts base (pueden personalizarse vía variables de entorno)
PROMPT_ANALISIS_CRUDO = """Rol: Analista senior de producción petrolera.
Contexto: Recibes la tabla de producción programada (mes en curso) y la variación porcentual vs. meta, por gerencia, para crudo.

Objetivo:
1. Entregar un resumen ejecutivo en 2 párrafos (tendencia global + alertas).
2. Reportar al menos 4 KPIs clave en estructura tabular (etiqueta, valor, comentario), listando:
   - Gerencia con mayor incremento.
   - Gerencia con mayor caída.
   - Promedio de variación del conjunto.
   - Gerencia con el segundo mejor desempeño o con recuperación relevante (si existe).
   - (Opcional) cualquier hallazgo adicional que consideres crítico.

Formato de salida (sin encabezado ni viñetas, respeta el orden y etiquetas):

RESUMEN:
Párrafo 1 (tendencia global)
Párrafo 2 (señales de alerta / contexto adicional)

KPIS:
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
(Agrega una fila extra si el análisis revela otra gerencia o métrica relevante)

Instrucciones de estilo:
- Tono descriptivo ejecutivo (sin recomendaciones).
- Usa números con una sola cifra decimal si aplica.
- No repitas información idéntica entre resumen y KPIs.

Datos de entrada:
{data}

Salida: máximo 1.600 caracteres."""

PROMPT_ANALISIS_BLANCO = """Rol: Analista senior de producción petrolera.
Contexto: Recibes la tabla de producción programada (mes en curso) y la variación porcentual vs. meta, por gerencia, para productos Blancos.

Objetivo:
1. Entregar un resumen ejecutivo en 2 párrafos (tendencia global + alertas).
2. Reportar al menos 4 KPIs clave en formato tabular (etiqueta, valor, comentario), cubriendo:
   - Gerencia con mayor incremento de producción.
   - Gerencia con mayor caída.
   - Promedio de variación del conjunto.
   - Gerencia con recuperación relevante o aporte destacado distinto a la líder (si existe).
   - (Opcional) cualquier métrica adicional que consideres crítica.

Formato de salida (sin encabezados ni viñetas, respeta el orden y etiquetas exactas):

RESUMEN:
Párrafo 1 (tendencia global)
Párrafo 2 (señales de alerta / contexto adicional)

KPIS:
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
(Agrega una fila extra si el análisis revela otra gerencia o métrica relevante)

Instrucciones de estilo:
- Tono descriptivo ejecutivo (sin recomendaciones).
- Usa una cifra decimal cuando corresponda.
- No repitas literalmente el texto del resumen en los KPIs.
- Evita viñetas, encabezados adicionales o formato Markdown.

Datos de entrada:
{data}

Salida: máximo 1.600 caracteres."""

PROMPT_ANALISIS_POP = """Rol: Analista senior de producción petrolera.
Contexto: Recibes la tabla de producción real de septiembre, la producción POP programada y la variación porcentual vs. POP por gerencia para crudo.

Objetivo:
1. Entregar un resumen ejecutivo en 2 párrafos (tendencia general + principales brechas contra POP).
2. Reportar al menos 4 KPIs clave (etiqueta, valor, comentario), cubriendo:
   - Gerencia con mayor sobrecumplimiento vs. POP.
   - Gerencia con mayor déficit vs. POP.
   - Promedio de variación respecto al POP.
   - Alguna gerencia adicional relevante (segunda con mejor desempeño, foco de alerta, etc.).

Formato de salida (sin encabezado ni viñetas, respeta el orden y etiquetas exactas):

RESUMEN:
Párrafo 1 (tendencia global y sobrecumplimientos destacados)
Párrafo 2 (alertas por déficit o brechas relevantes)

KPIS:
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
(Agrega una fila extra si identificas otro hallazgo crítico)

Instrucciones de estilo:
- Tono ejecutivo descriptivo, sin recomendaciones.
- Usa porcentajes con signo y una cifra decimal cuando corresponda.
- No repitas literalmente el texto del resumen en los KPIs.

Datos de entrada:
{data}

Salida: máximo 1.600 caracteres."""

PROMPT_ANALISIS_POP_BLANCO = """Rol: Analista senior de producción petrolera.
Contexto: Recibes la tabla de producción real de septiembre, la producción POP programada y la variación porcentual vs. POP por gerencia para productos blancos.

Objetivo:
1. Entregar un resumen ejecutivo en 2 párrafos (tendencia general + brechas relevantes con respecto al POP).
2. Reportar al menos 4 KPIs clave (etiqueta, valor, comentario), cubriendo:
   - Gerencia con mayor sobrecumplimiento vs. POP.
   - Gerencia con mayor déficit vs. POP.
   - Promedio de variación respecto al POP.
   - Alguna gerencia adicional de interés (segundo mejor desempeño o foco de alerta).

Formato de salida (sin encabezado ni viñetas, respeta el orden y etiquetas exactas):

RESUMEN:
Párrafo 1 (tendencia global y sobrecumplimientos destacados)
Párrafo 2 (alertas por caídas o brechas críticas)

KPIS:
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
ETIQUETA=..., VALOR=..., COMENTARIO=...
(Agrega una fila extra si detectas otro hallazgo clave)

Instrucciones de estilo:
- Tono ejecutivo descriptivo, sin recomendaciones.
- Usa porcentajes con signo y una cifra decimal cuando aplique.
- Evita repetir el resumen textual dentro de los KPIs.

Datos de entrada:
{data}

Salida: máximo 1.600 caracteres."""


# --- Utilidades -------------------------------------------------------------

def _format_prompt(data: List[Dict[str, object]], template: str) -> str:
    """Convierte la lista de diccionarios a CSV para inyectarla en el prompt."""
    if not data:
        return template.format(data="Sin datos disponibles.")
    df = pd.DataFrame(data)
    csv_data = df.to_csv(index=False)
    return template.format(data=csv_data)


def _call_llm(prompt: str) -> str:
    """Llama al LLM manejando indisponibilidad o errores."""
    if not llm_manager.is_available():
        LOGGER.error("LLM no disponible actualmente.")
        return "El modelo no se encuentra disponible para generar el análisis."
    try:
        response = llm_manager.generate_response(
            prompt=prompt,
            temperature=0.2,
            top_p=0.9,
            max_tokens=900,
        )
        return (response or "").strip() or "El modelo no entregó contenido."
    except Exception as exc:
        LOGGER.exception("Error llamando al LLM: %s", exc)
        return f"Error generando análisis con el LLM: {exc}"


def _save_results(payload: Dict[str, object], output_path: Path) -> None:
    """Persiste resultados en JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)
    LOGGER.info("Archivo de análisis programado actualizado: %s", output_path)


def _fetch_programmed_tables() -> Dict[str, List[Dict[str, object]]]:
    """
    Carga directamente desde SQLite los datos programados de Crudo y Blancos
    en el formato requerido por el LLM.
    """
    if not DB_PATH.exists():
        raise FileNotFoundError(f"No se encontró la base de datos: {DB_PATH}")

    with sqlite3.connect(DB_PATH) as connection:
        crudo_df = pd.read_sql_query(
            """
            SELECT
                GERENCIA AS Gerencia,
                PROD_SEPT AS "Producción Septiembre",
                VAR_PCT AS "Variación (%)"
            FROM V_CRUDO_VARIACION_GER_PROGRAMADO
            """,
            connection,
        )
        blancos_df = pd.read_sql_query(
            """
            SELECT
                GERENCIA AS Gerencia,
                PROG_SEP AS "Producción Programada",
                VAR_PCT AS "Variación (%)"
            FROM V_BLANCOS_VARIACION_GER_PROGRAMADO
            """,
            connection,
        )
        pop_blancos_df = pd.read_sql_query(
            """
            SELECT
                GERENCIA AS Gerencia,
                Produccion_Real AS "Producción Septiembre",
                Produccion_POP AS "Producción POP",
                VARIACION_PORCT AS "Variación (%)"
            FROM V_PRODUCCION_POP_BLANCOS
            """,
            connection,
        )
        pop_df = pd.read_sql_query(
            """
            SELECT
                GERENCIA AS Gerencia,
                Produccion_Real AS "Producción Septiembre",
                Produccion_POP AS "Producción POP",
                VARIACION_PORCT AS "Variación (%)"
            FROM V_PRODUCCION_POP
            """,
            connection,
        )

    def _normalize(df: pd.DataFrame) -> List[Dict[str, object]]:
        if df.empty:
            return []
        cleaned = df.copy()
        for column in cleaned.columns:
            if column != "Gerencia":
                cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")
        return (
            cleaned.replace({pd.NA: None})
            .replace({float("nan"): None})
            .to_dict("records")
        )

    return {
        "crudo": _normalize(crudo_df),
        "blancos": _normalize(blancos_df),
        "pop": _normalize(pop_df),
        "pop_blancos": _normalize(pop_blancos_df),
    }


def _format_percentage(value: Optional[float]) -> str:
    """Formatea valores porcentuales con signo y una cifra decimal."""
    if value is None or pd.isna(value):
        return "N/D"
    return f"{float(value):+0.1f}%"


def _simplify_llm_summary(llm_text: Optional[str]) -> Optional[str]:
    """Reduce LLM output to unformatted 1-2 sentences suitable for the panorama card."""
    if not llm_text:
        return None
    cleaned = re.sub(r"\s+", " ", str(llm_text)).strip()
    if "KPIS" in cleaned.upper():
        cleaned = re.split(r"KPIS\s*:", cleaned, flags=re.IGNORECASE)[0].strip()
    if not cleaned:
        return None
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    if not sentences:
        return None
    summary = " ".join(sentences[:2])
    return summary if summary else None


def _extract_llm_kpis(
    llm_text: Optional[str],
    dataframe: pd.DataFrame,
    gerencia_col: str,
    variation_col: str,
    existing_labels: Optional[set] = None,
) -> List[Dict[str, str]]:
    """
    Busca menciones en el texto del LLM para generar KPIs adicionales.
    Regresa una lista de dicts con 'etiqueta', 'mensaje' y 'valor'.
    """
    if not llm_text:
        return []

    text = str(llm_text)
    raw_kpis = re.findall(
        r"ETIQUETA\s*=\s*(.+?),\s*VALOR\s*=\s*(.+?),\s*COMENTARIO\s*=\s*(.+)",
        text,
        flags=re.IGNORECASE,
    )
    existing_labels = {
        str(label).upper() for label in (existing_labels or [])
    }
    available = {
        str(v).strip().upper(): v for v in dataframe[gerencia_col].dropna()
    }

    def _match_percentage(token: str) -> Optional[float]:
        match = re.search(r"([+-]?\d+(?:[.,]\d+)?)\s*%", token)
        if not match:
            return None
        try:
            return float(match.group(1).replace(",", "."))
        except ValueError:
            return None

    insights: List[Dict[str, str]] = []
    for etiqueta, valor, comentario in raw_kpis:
        tokens = re.findall(r"[A-ZÁÉÍÓÚ]{2,}", etiqueta.upper())
        label = None
        for token in tokens[::-1]:
            token = token.strip().upper()
            if token in available and token not in existing_labels:
                label = token
                break

        if label:
            row = dataframe.loc[
                dataframe[gerencia_col].str.upper() == label, variation_col
            ]
            formatted_value = (
                _format_percentage(row.iloc[0])
                if not row.empty
                else valor.strip()
            )
        else:
            raw_label = etiqueta.strip()
            if not raw_label:
                continue
            normalized_label = raw_label.title()
            if normalized_label.upper() in existing_labels:
                continue
            label = normalized_label
            formatted_value = valor.strip()

        insights.append(
            {
                "etiqueta": label,
                "mensaje": comentario.strip(),
                "valor": formatted_value,
            }
        )
        existing_labels.add(label.upper())

    positive_matches: Dict[str, float] = {}
    for match in re.finditer(
        r"([A-ZÁÉÍÓÚ]{2,})\s+con\s+(?:un\s+)?(?:aumento|incremento|crecimiento)\s+del\s+([+-]?\d+(?:[.,]\d+)?)\s*%",
        text,
        flags=re.IGNORECASE,
    ):
        name = match.group(1).strip().upper()
        value = _match_percentage(match.group(0))
        if name in available and value is not None:
            positive_matches[name] = value

    second_positive: Optional[Tuple[str, float]] = None
    if positive_matches:
        sorted_pos = sorted(
            positive_matches.items(), key=lambda item: item[1], reverse=True
        )
        for name, pct in sorted_pos:
            if name not in existing_labels:
                second_positive = (name, pct)
                break

    negative_matches: Dict[str, float] = {}
    for match in re.finditer(
        r"([A-ZÁÉÍÓÚ]{2,})\s+con\s+(?:una\s+)?(?:ca[ií]da|descenso|disminuci[oó]n)\s+del\s+([+-]?\d+(?:[.,]\d+)?)\s*%",
        text,
        flags=re.IGNORECASE,
    ):
        name = match.group(1).strip().upper()
        value = _match_percentage(match.group(0))
        if name in available and value is not None:
            negative_matches[name] = value

    second_negative: Optional[Tuple[str, float]] = None
    if negative_matches:
        sorted_neg = sorted(
            negative_matches.items(), key=lambda item: item[1]
        )
        for name, pct in sorted_neg:
            if name not in existing_labels:
                second_negative = (name, pct)
                break

    counts_match = re.search(
        r"Se\s+observan\s+(\d+)\s+gerencias\s+con\s+(?:incrementos|alzas).*?(\d+)\s+gerencias\s+con\s+(?:disminuciones|ca[ií]das)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    if second_positive:
        label, pct = second_positive
        row = dataframe.loc[
            dataframe[gerencia_col].str.upper() == label, variation_col
        ]
        value = (
            _format_percentage(row.iloc[0]) if not row.empty else f"{pct:+0.1f}%"
        )
        insights.append(
            {
                "etiqueta": label,
                "mensaje": "Incremento adicional resaltado por el análisis LLM",
                "valor": value,
            }
        )
        existing_labels.add(label)

    if second_negative:
        label, pct = second_negative
        row = dataframe.loc[
            dataframe[gerencia_col].str.upper() == label, variation_col
        ]
        value = (
            _format_percentage(row.iloc[0]) if not row.empty else f"{pct:+0.1f}%"
        )
        insights.append(
            {
                "etiqueta": label,
                "mensaje": "Caída adicional identificada en el análisis LLM",
                "valor": value,
            }
        )
        existing_labels.add(label)

    if counts_match:
        try:
            ups = int(counts_match.group(1))
            downs = int(counts_match.group(2))
            insights.append(
                {
                    "etiqueta": "Resumen LLM",
                    "mensaje": "Gerencias al alza / a la baja destacadas por el LLM",
                    "valor": f"{ups}↑ / {downs}↓",
                }
            )
        except ValueError:
            pass

    return insights


def _build_panorama_payload(
    records: List[Dict[str, object]], fuel_label: str, llm_summary: Optional[str] = None
) -> Dict[str, object]:
    """
    Construye un panorama ejecutivo a partir de la tabla programada.

    El payload replica la estructura usada en Resumen Mes:
    {
        "titulo": "...",
        "descripcion": "...",
        "insights": [{"etiqueta": "...", "mensaje": "...", "valor": "..."}]
    }
    """
    title_map = {
        "Crudo": "Crudo: Producción vs Meta Panorama General",
        "Blancos": "Productos Blancos: Producción vs Meta Panorama General",
        "POP": "Crudo: Producción vs POP Panorama General",
        "POP Blancos": "Productos Blancos: Producción vs POP Panorama General",
    }
    title = title_map.get(fuel_label, f"Panorama General {fuel_label}")
    if not records:
        return {
            "titulo": title,
            "descripcion": "No hay datos programados disponibles para generar un panorama.",
            "insights": [],
        }

    dataframe = pd.DataFrame(records)
    gerencia_col = next(
        (col for col in dataframe.columns if col.lower() == "gerencia"), "Gerencia"
    )
    variation_col = next(
        (col for col in dataframe.columns if "variaci" in col.lower()), None
    )

    if variation_col is None:
        return {
            "titulo": title,
            "descripcion": "Los datos programados no incluyen variaciones porcentuales.",
            "insights": [],
        }

    dataframe[variation_col] = pd.to_numeric(
        dataframe[variation_col], errors="coerce"
    )
    valid_df = dataframe.dropna(subset=[variation_col])
    if valid_df.empty:
        return {
            "titulo": title,
            "descripcion": "Las variaciones programadas no contienen valores numéricos válidos.",
            "insights": [],
        }

    positive_count = int((valid_df[variation_col] >= 0).sum())
    negative_count = int((valid_df[variation_col] < 0).sum())
    average_variation = valid_df[variation_col].mean()

    trend_description = (
        "predominio de incrementos"
        if positive_count > negative_count
        else "presión por caídas"
        if negative_count > positive_count
        else "balance mixto"
    )

    descripcion = (
        f"El comportamiento programado de {fuel_label.lower()} muestra un {trend_description}, "
        f"con {positive_count} gerencias al alza y {negative_count} con caídas. "
        f"La variación promedio se ubica en { _format_percentage(average_variation) }."
    )

    insights: List[Dict[str, str]] = []
    top_increase = valid_df.sort_values(variation_col, ascending=False).iloc[0]
    insights.append(
        {
            "etiqueta": str(top_increase.get(gerencia_col, "N/D")),
            "mensaje": "Mayor incremento mensual dentro del programa",
            "valor": _format_percentage(top_increase.get(variation_col)),
        }
    )

    decreases_df = valid_df[valid_df[variation_col] < 0]
    if not decreases_df.empty:
        top_drop = decreases_df.sort_values(variation_col).iloc[0]
        insights.append(
            {
                "etiqueta": str(top_drop.get(gerencia_col, "N/D")),
                "mensaje": "Mayor caída mensual registrada",
                "valor": _format_percentage(top_drop.get(variation_col)),
            }
        )

    insights.append(
        {
            "etiqueta": "Promedio mensual",
            "mensaje": "Variación promedio del conjunto de gerencias",
            "valor": _format_percentage(average_variation),
        }
    )

    llm_excerpt = _simplify_llm_summary(llm_summary)
    if llm_excerpt:
        descripcion = f"{descripcion} {llm_excerpt}"

    llm_insights = _extract_llm_kpis(
        llm_summary, valid_df, gerencia_col, variation_col, {ins["etiqueta"] for ins in insights}
    )
    if llm_insights:
        insights.extend(llm_insights)

    return {
        "titulo": title,
        "descripcion": descripcion,
        "insights": insights,
    }


def run_pipeline(
    prompt_crudo: Optional[str] = None,
    prompt_blancos: Optional[str] = None,
    prompt_pop: Optional[str] = None,
    prompt_pop_blancos: Optional[str] = None,
    output_json: Optional[Path] = None,
    verbose: bool = False,
) -> Dict[str, str]:
    """Ejecuta el pipeline completo y retorna los textos generados."""
    data = _fetch_programmed_tables()
    template_crudo = prompt_crudo or os.getenv("PROMPT_ANALISIS_CRUDO", PROMPT_ANALISIS_CRUDO)
    template_blancos = prompt_blancos or os.getenv("PROMPT_ANALISIS_BLANCO", PROMPT_ANALISIS_BLANCO)
    template_pop = prompt_pop or os.getenv("PROMPT_ANALISIS_POP", PROMPT_ANALISIS_POP)
    template_pop_blancos = prompt_pop_blancos or os.getenv(
        "PROMPT_ANALISIS_POP_BLANCO", PROMPT_ANALISIS_POP_BLANCO
    )

    prompt_c = _format_prompt(data.get("crudo", []), template_crudo)
    prompt_b = _format_prompt(data.get("blancos", []), template_blancos)
    prompt_pop_text = _format_prompt(data.get("pop", []), template_pop)
    prompt_pop_blancos_text = _format_prompt(
        data.get("pop_blancos", []), template_pop_blancos
    )

    analysis_crudo = _call_llm(prompt_c)
    analysis_blancos = _call_llm(prompt_b)
    analysis_pop = _call_llm(prompt_pop_text)
    analysis_pop_blancos = _call_llm(prompt_pop_blancos_text)

    panorama_crudo = _build_panorama_payload(
        data.get("crudo", []), "Crudo", analysis_crudo
    )
    panorama_blancos = _build_panorama_payload(
        data.get("blancos", []), "Blancos", analysis_blancos
    )
    panorama_pop = _build_panorama_payload(
        data.get("pop", []), "POP", analysis_pop
    )
    panorama_pop_blancos = _build_panorama_payload(
        data.get("pop_blancos", []), "POP Blancos", analysis_pop_blancos
    )

    payload = {
        "analysis_crudo": analysis_crudo,
        "analysis_blancos": analysis_blancos,
        "analysis_pop": analysis_pop,
        "analysis_pop_blancos": analysis_pop_blancos,
        "panorama_general_crudo": panorama_crudo,
        "panorama_general_blancos": panorama_blancos,
        "panorama_general_pop": panorama_pop,
        "panorama_general_pop_blancos": panorama_pop_blancos,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_results(payload, output_json or OUTPUT_JSON)

    if verbose:
        print("=== Panorama Programado Crudo ===")
        print(analysis_crudo)
        print("\n=== Panorama Programado Blancos ===")
        print(analysis_blancos)
        print("\n=== Panorama Producción vs POP ===")
        print(analysis_pop)
        print("\n=== Panorama Productos Blancos vs POP ===")
        print(analysis_pop_blancos)

    return payload


if __name__ == "__main__":
    run_pipeline(verbose=True)

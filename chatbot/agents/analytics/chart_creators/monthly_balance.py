"""
Monthly balance report generator with product behavior analysis tables.
"""

import pandas as pd
import numpy as np
import logging
from concurrent.futures import ThreadPoolExecutor

from typing import Any, Dict

try:
    from chatbot.core.llm_manager import llm_manager  # type: ignore
except Exception as exc:
    llm_manager = None  # type: ignore
    logging.getLogger(__name__).warning(
        "No se pudo importar llm_manager (%s). Las conclusiones LLM serán omitidas.", exc
    )

logger = logging.getLogger(__name__)

INVALID_DBCONNECTION_MSG = (
    "Monthly balance invoked without DB connection; returning minimal data."
)


def _fetch_gerencia_variation_data(db_connection) -> pd.DataFrame:
    """
    Fetch gerencia variation data from V_CRUDO_VARIACION_GER view.

    Args:
        db_connection: Database connection object

    Returns:
        DataFrame with gerencia variation data
    """
    if not db_connection:
        logger.error("No database connection available for gerencia variation data")
        return pd.DataFrame()

    query = "SELECT * FROM V_CRUDO_VARIACION_GER;"

    try:
        logger.info("Fetching gerencia variation data from V_CRUDO_VARIACION_GER")
        data = pd.read_sql_query(query, db_connection)

        if data.empty:
            logger.warning("No data found in V_CRUDO_VARIACION_GER view")

        return data

    except Exception as e:
        logger.error(f"Error fetching gerencia variation data: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return pd.DataFrame()


def _fetch_blancos_variation_data(db_connection) -> pd.DataFrame:
    """
    Fetch blancos variation data from V_BLANCOS_VARIACION_GER view.

    Args:
        db_connection: Database connection object

    Returns:
        DataFrame with blancos variation data
    """
    if not db_connection:
        logger.error("No database connection available for blancos variation data")
        return pd.DataFrame()

    query = "SELECT * FROM V_BLANCOS_VARIACION_GER;"

    try:
        logger.info("Fetching blancos variation data from V_BLANCOS_VARIACION_GER")
        data = pd.read_sql_query(query, db_connection)

        if data.empty:
            logger.warning("No data found in V_BLANCOS_VARIACION_GER view")

        return data

    except Exception as e:
        logger.error(f"Error fetching blancos variation data: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return pd.DataFrame()




def _prepare_variation_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and standardize variation data for tables and charts."""
    if df is None or df.empty:
        return pd.DataFrame()

    df = df.copy()
    df.columns = [str(col).strip().replace(" ", "_") for col in df.columns]

    rename_map = {}
    for col in list(df.columns):
        low = col.lower()
        if low == "producto":
            rename_map[col] = "PRODUCTO"
        elif low == "gerencia":
            rename_map[col] = "GERENCIA"
        elif low in {"prod_agost", "prod_agosto", "prod_agost."}:
            rename_map[col] = "Prod_Agost"
        elif low in {"prod_sept", "prod_septiembre", "prod_sept."}:
            rename_map[col] = "Prod_Sept"
        elif low in {"var_pct", "var_%", "variacion_pct"}:
            rename_map[col] = "VAR_PCT"
    if rename_map:
        df = df.rename(columns=rename_map)

    def _to_numeric(series: pd.Series) -> pd.Series:
        if series.dtype != object:
            return pd.to_numeric(series, errors="coerce")
        cleaned = series.astype(str).str.strip()
        cleaned = cleaned.str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
        return pd.to_numeric(cleaned, errors="coerce")

    for col in ("Prod_Agost", "Prod_Sept", "VAR_PCT"):
        if col in df.columns:
            df[col] = _to_numeric(df[col])

    if {"Prod_Agost", "Prod_Sept"}.issubset(df.columns):
        df["DELTA_ABS"] = df["Prod_Sept"] - df["Prod_Agost"]
        df["VAR_PCT_CALC"] = np.where(
            (df["Prod_Agost"].notna()) & (df["Prod_Agost"] != 0),
            (df["DELTA_ABS"] / df["Prod_Agost"]) * 100.0,
            np.nan,
        )
    else:
        df["DELTA_ABS"] = np.nan
        df["VAR_PCT_CALC"] = np.nan

    if "VAR_PCT" in df.columns and df["VAR_PCT"].notna().any():
        df["VAR_PCT_TO_SHOW"] = df["VAR_PCT"].copy()
    else:
        df["VAR_PCT_TO_SHOW"] = df["VAR_PCT_CALC"]

    if "VAR_PCT_TO_SHOW" in df.columns:
        max_abs = df["VAR_PCT_TO_SHOW"].abs().max(skipna=True)
        if pd.notna(max_abs) and max_abs <= 1.0:
            df["VAR_PCT_TO_SHOW"] = df["VAR_PCT_TO_SHOW"] * 100.0
        df = df.sort_values("VAR_PCT_TO_SHOW", ascending=False, na_position="last").reset_index(drop=True)

    return df


def _build_radar_single(dataset: pd.DataFrame, title: str) -> Dict[str, Any]:
    """Build a single radar payload from a variation DataFrame."""
    if dataset is None or dataset.empty:
        return {}

    prepared = _prepare_variation_dataframe(dataset)
    if prepared.empty:
        return {}

    gerencia_col = "GERENCIA" if "GERENCIA" in prepared.columns else "Gerencia"
    if gerencia_col not in prepared.columns or "Prod_Sept" not in prepared.columns:
        return {}

    filtered = prepared[prepared["Prod_Sept"] > 0].copy()
    if filtered.empty:
        return {}
    filtered.sort_values("Prod_Sept", ascending=False, inplace=True)

    categories = filtered[gerencia_col].astype(str).tolist()
    values = filtered["Prod_Sept"].round(2).tolist()

    return {
        "title": title,
        "categories": categories,
        "series": [
            {
                "name": "Producción Septiembre (BOPD)",
                "values": values,
                "color": "#004236",
                "fill": "rgba(0, 66, 54, 0.25)",
            }
        ],
        "value_suffix": " BOPD",
        "value_format": ",.0f",
    }


def load_radar_variaciones_gerencias(
    db_connection,
    df_crudo: pd.DataFrame = None,
    df_blancos: pd.DataFrame = None,
) -> Dict[str, Any]:
    """
    Build radar payloads for crude and blancos production (September, BOPD).
    Accepts pre-fetched DataFrames to avoid redundant SQL queries.
    """
    crudo_data = df_crudo if df_crudo is not None else _fetch_gerencia_variation_data(db_connection)
    blancos_data = df_blancos if df_blancos is not None else _fetch_blancos_variation_data(db_connection)

    radar_payload = {
        "crudo": _build_radar_single(
            crudo_data,
            "Radar - Producción Septiembre (BOPD) CRUDO",
        ),
        "blancos": _build_radar_single(
            blancos_data,
            "Radar - Producción Septiembre (BOPD) BLANCOS",
        ),
    }
    radar_payload["radar_conclusion"] = _radar_generate_llm_conclusion(
        radar_payload.get("crudo"), radar_payload.get("blancos")
    )
    return radar_payload


def _build_gerencia_analysis_table(db_connection, df_crudo: pd.DataFrame = None) -> Dict[str, Any]:
    """Build table payload and chart data for gerencia variation."""
    data = df_crudo if df_crudo is not None else _fetch_gerencia_variation_data(db_connection)

    if data.empty:
        return {"headers": [], "rows": [], "title": "Analisis / Gerencia", "chart": None}

    prepared = _prepare_variation_dataframe(data)
    if prepared.empty:
        return {"headers": [], "rows": [], "title": "Analisis / Gerencia", "chart": None}

    if "VAR_PCT" not in prepared.columns and "VAR_PCT_TO_SHOW" in prepared.columns:
        prepared["VAR_PCT"] = prepared["VAR_PCT_TO_SHOW"]

    table_df = prepared.copy()
    drop_columns = {"PRODUCTO", "VAR_PCT_TO_SHOW", "VAR_PCT_CALC", "DELTA_ABS"}
    columns = [col for col in table_df.columns if col.strip().upper() not in drop_columns]
    table_df = table_df[columns]
    if "VAR_PCT" in table_df.columns:
        table_df["VAR_PCT"] = table_df["VAR_PCT"].round(2)

    header_labels = {
        "Gerencia": "Gerencia",
        "GERENCIA": "Gerencia",
        "Prod_Agost": "Producción Agosto",
        "PROD_AGOST": "Producción Agosto",
        "Prod_Sept": "Producción Septiembre",
        "PROD_SEPT": "Producción Septiembre",
        "Var_Pct": "Variación (%)",
        "VAR_PCT": "Variación (%)",
    }

    headers = [
        {"key": column, "label": header_labels.get(column, column.replace("_", " " ).title())}
        for column in table_df.columns
    ]

    rows = (
        table_df.replace({pd.NA: None})
        .replace({float("nan"): None})
        .to_dict("records")
    )

    chart = None
    chart_source = []
    if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
        chart_df = prepared[["GERENCIA", "VAR_PCT_TO_SHOW"]].dropna(subset=["VAR_PCT_TO_SHOW"])  # type: ignore[index]
        if not chart_df.empty:
            values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
            colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
            chart_source = chart_df.to_dict("records")
            chart = {
                "type": "horizontal_bar",
                "title": "CRUDO - Variación % por gerencia (Agosto → Septiembre)",
                "x": values,
                "y": chart_df["GERENCIA"].astype(str).tolist(),
                "orientation": "h",
                "colors": colors,
                "x_suffix": "%",
                "x_format": ",.2f",
                "x_axis_label": "Variación (%)",
                "y_axis_label": "Gerencia",
            }

    return {
        "headers": headers,
        "rows": rows,
        "title": "Comportamiento Producto: CRUDO (BOPD)",
        "chart": chart,
        "llm_source": chart_source,
    }



def _build_blancos_analysis_table(db_connection, df_blancos: pd.DataFrame = None) -> Dict[str, Any]:
    """Build table payload for blancos variation and chart data."""
    data = df_blancos if df_blancos is not None else _fetch_blancos_variation_data(db_connection)

    if data.empty:
        return {"headers": [], "rows": [], "title": "Producción por Tipo", "chart": None}

    prepared = _prepare_variation_dataframe(data)
    if prepared.empty:
        return {"headers": [], "rows": [], "title": "Producción por Tipo", "chart": None}

    if "VAR_PCT" not in prepared.columns and "VAR_PCT_TO_SHOW" in prepared.columns:
        prepared["VAR_PCT"] = prepared["VAR_PCT_TO_SHOW"]

    table_df = prepared.copy()
    drop_columns = {"PRODUCTO", "VAR_PCT_TO_SHOW", "VAR_PCT_CALC", "DELTA_ABS"}
    columns = [col for col in table_df.columns if col.strip().upper() not in drop_columns]
    table_df = table_df[columns]
    if "VAR_PCT" in table_df.columns:
        table_df["VAR_PCT"] = table_df["VAR_PCT"].round(2)

    header_labels = {
        "Gerencia": "Gerencia",
        "GERENCIA": "Gerencia",
        "Prod_Agost": "Producción Agosto",
        "PROD_AGOST": "Producción Agosto",
        "Prod_Sept": "Producción Septiembre",
        "PROD_SEPT": "Producción Septiembre",
        "Var_Pct": "Variación (%)",
        "VAR_PCT": "Variación (%)",
    }

    headers = [
        {"key": column, "label": header_labels.get(column, column.replace("_", " " ).title())}
        for column in table_df.columns
    ]

    rows = (
        table_df.replace({pd.NA: None})
        .replace({float("nan"): None})
        .to_dict("records")
    )

    chart = None
    chart_source = []
    if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
        chart_df = prepared[["GERENCIA", "VAR_PCT_TO_SHOW"]].dropna(subset=["VAR_PCT_TO_SHOW"])  # type: ignore[index]
        if not chart_df.empty:
            values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
            colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
            chart_source = chart_df.to_dict("records")
            chart = {
                "type": "horizontal_bar",
                "title": "BLANCOS - Variación % por gerencia (Agosto → Septiembre)",
                "x": values,
                "y": chart_df["GERENCIA"].astype(str).tolist(),
                "orientation": "h",
                "colors": colors,
                "x_suffix": "%",
                "x_format": ",.2f",
                "x_axis_label": "Variación (%)",
                "y_axis_label": "Gerencia",
            }

    return {
        "headers": headers,
        "rows": rows,
        "title": "Comportamiento Producto: Blancos (BOPD)",
        "chart": chart,
        "llm_source": chart_source,
    }


def _format_variation_for_prompt(rows: list) -> str:
    if not rows:
        return "Sin datos"

    lines = []
    for row in rows:
        gerencia = str(row.get("GERENCIA", "")).strip()
        value = row.get("VAR_PCT_TO_SHOW")
        if gerencia and isinstance(value, (int, float, np.floating)):
            lines.append(f"{gerencia}: {value:+.1f}%")
    return "\n".join(lines) if lines else "Sin datos"


def _format_radar_for_prompt(radar_payload: Dict[str, Any]) -> str:
    if not radar_payload:
        return "Sin datos"

    categories = radar_payload.get("categories") or []
    series = radar_payload.get("series") or []
    if not categories or not series:
        return "Sin datos"

    values = series[0].get("values") or []
    def _format_thousands(value: float) -> str:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return ""
        return f"{numeric / 1000:.2f}k BOPD"

    lines = []
    for category, value in zip(categories, values):
        if not category:
            continue
        if isinstance(value, (int, float, np.floating)):
            formatted = _format_thousands(value)
            if formatted:
                lines.append(f"{category}: {formatted}")
    return "\n".join(lines) if lines else "Sin datos"


def _build_llm_prompt(crudo_text: str, blancos_text: str) -> str:
    prompt = (
        "Eres un analista de producción. Debes redactar una “Conclusión integrada” en ESPAÑOL, clara para público no técnico\n"
        "usando EXCLUSIVAMENTE los datos que aparecen como DATOS DE ENTRADA\n"

        "IMPORTANTE:\n"
        "- Las siglas GOR,GAA,GLH,GNS,GRM,GPA,GTA,DFL,GCT,GAN,PRP,CPV, corresponden a Gerencias y debes referrite a ellas como Gerencia\n"


        "SALIDA (OBLIGATORIA):\n"
        "- Devuelve EXACTAMENTE TRES PÁRRAFOS, sin títulos ni listas, en este orden:\n"
        "  1) Párrafo 1 (DEBE empezar con “Para el producto Crudo”): patrón general, RANGO (mín–máx) y puntos clave (quiénes suben y quiénes bajan) con cifras.\n"
        "  2) Párrafo 2 (DEBE empezar con “Para los productos Blancos”):  patrón general, RANGO (mín–máx) y puntos clave (quiénes suben y quiénes bajan) con cifras.\n"
        "  3) Párrafo 3 (DEBE empezar con “El comportamiento general para Crudo y productos Blancos”): DEBE CONTRASTAR los hallazgos de los dos párrafos anteriores;  Señala patrones NO obvios: rango de variaciones, concentración vs. dispersión, presencia de outliers, simetrías/asimetrías, y coincidencias o divergencias entre CRUDO y BLANCOS por gerencia.\n"
        "   Menciona SIEMPRE las siglas de las gerencias involucradas y respalda tus frases con VALORES (porcentajes con signo, 1 decimal cuando aplique).\n"
        "   Destaca: (a) quiénes lideran alzas y caídas en cada producto, (b) el rango total de variación y si parece acotado o amplio, (c) gerencias con signo igual en ambos productos, (d) gerencias con signos opuestos entre productos.\n"
        "   Estilo: directo, sin jerga estadística. Sin listas, sin títulos, sin repetir todos los datos.\n"
        "   Usa porcentajes con signo y 1 decimal cuando aplique.\n"
        "   No expliques causas ni recomiendes acciones.\n"
        "   No asumas que un producto es “inicial” y el otro “resultante”; limítate a CONTRASTAR valores (X% vs Y%) por gerencia.\n"
        "   No enumeres toda la tabla: cita selectivamente (máximo 8 cifras en total entre Párrafo 1 y 2).\n\n"
       

        "REGLAS:\n"
        "- SOLAMENTE RESPONDE LO UE PREGUNTO NO AGREGUES NADA MAS.\n"
        "- Usa porcentajes con signo y 2 decimales cuando aplique.\n"
        "- No expliques causas ni recomiendes acciones.\n"
        "- No inventes promedios ni totales.\n\n"
        
        "DATOS DE ENTRADA (ÚSALOS TAL CUAL):\n"
        "[CRUDO]\n"
        f"{crudo_text}\n\n"
        "[BLANCOS]\n"
        f"{blancos_text}\n\n"

        "ENTREGA:\n" 
        "**IMPORTANTE: NO MENCIONES QUE LOS VALORES VIENEN DE LA COLUMNA VAR_PCT_TO_SHOW**.  Integra las dos respuestas de ANALISIS REQUIERIDO EN un parrafo con lenguaje no tecnico, agrupa tus resultados por gerencia.\n\n"
    )
    return prompt


def _generate_llm_conclusion(crudo_rows: list, blancos_rows: list) -> str | None:
    if not llm_manager:
        return None

    prompt = _build_llm_prompt(
        _format_variation_for_prompt(crudo_rows),
        _format_variation_for_prompt(blancos_rows),
    )

    if llm_manager.is_available():
        try:
            response = llm_manager.generate_response(
                prompt=prompt,
                temperature=0.2,
                max_tokens=600,
            )
            if response:
                return response.strip()
        except Exception as exc:
            logger.error("Ollama conclusión integrada falló: %s", exc)

    return None


def _radar_generate_llm_conclusion(
    crudo_radar: Dict[str, Any], blancos_radar: Dict[str, Any]
) -> str | None:
    if not llm_manager:
        return None

    prompt = _build_llm_prompt(
        _format_radar_for_prompt(crudo_radar),
        _format_radar_for_prompt(blancos_radar),
    )

    if llm_manager.is_available():
        try:
            response = llm_manager.generate_response(
                prompt=prompt,
                temperature=0.2,
                max_tokens=600,
            )
            if response:
                return response.strip()
        except Exception as exc:
            logger.error("Ollama conclusión radar falló: %s", exc)

    return None


def create_monthly_balance_payload(
    db_connection,
    config: Dict[str, Any] = None,
    summary_table: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Create monthly balance payload with product behavior analysis tables.

    Args:
        db_connection: Database connection for fetching data.
        config: Optional configuration from the report definition.
        summary_table: Optional pre-fetched table payload.

    Returns:
        Dict compatible with the frontend fixed-report pipeline.
    """
    if not db_connection:
        logger.warning(INVALID_DBCONNECTION_MSG)
        return {
            "success": True,
            "chart_data": None,
            "summary_table": {"headers": [], "rows": [], "title": "Resumen Mes"},
            "analysis_table": {"headers": [], "rows": [], "title": "Analisis / Gerencia", "chart": None},
            "production_types_table": {"headers": [], "rows": [], "title": "Producción por Tipo", "chart": None},
            "distribution_relative": {"crudo": {}, "blancos": {}},
            "conclusion_integrada": None,
            "data_points": 0,
            "date_range": None,
            "metrics": [],
            "chart_type": "production_monthly_balance",
            "message": "Sin conexión a base de datos",
        }

    # Fetch shared data ONCE (eliminates 2 redundant SQL queries)
    df_crudo = _fetch_gerencia_variation_data(db_connection)
    df_blancos = _fetch_blancos_variation_data(db_connection)

    # Build tables using pre-fetched data
    analysis_table = _build_gerencia_analysis_table(db_connection, df_crudo=df_crudo)
    production_types_table = _build_blancos_analysis_table(db_connection, df_blancos=df_blancos)

    # Build radar data (fast, no LLM)
    radar_crudo = _build_radar_single(df_crudo, "Radar - Producción Septiembre (BOPD) CRUDO")
    radar_blancos = _build_radar_single(df_blancos, "Radar - Producción Septiembre (BOPD) BLANCOS")

    # Run 2 LLM calls in PARALLEL (thread-safe: HTTP-only, no DB access)
    conclusion_text = None
    radar_conclusion = None

    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="llm_balance") as executor:
        future_conclusion = executor.submit(
            _generate_llm_conclusion,
            analysis_table.get("llm_source"),
            production_types_table.get("llm_source"),
        )
        future_radar = executor.submit(
            _radar_generate_llm_conclusion, radar_crudo, radar_blancos,
        )
        try:
            conclusion_text = future_conclusion.result(timeout=90)
        except Exception as exc:
            logger.error("LLM conclusion generation failed: %s", exc)
        try:
            radar_conclusion = future_radar.result(timeout=90)
        except Exception as exc:
            logger.error("LLM radar conclusion generation failed: %s", exc)

    distribution_relative = {
        "crudo": radar_crudo,
        "blancos": radar_blancos,
        "radar_conclusion": radar_conclusion,
    }

    analysis_table.pop("llm_source", None)
    production_types_table.pop("llm_source", None)

    logger.info(f"Generated analysis_table with {len(analysis_table.get('rows', []))} rows")
    logger.info(f"Generated production_types_table with {len(production_types_table.get('rows', []))} rows")

    return {
        "success": True,
        "chart_data": None,
        "summary_table": summary_table or {"headers": [], "rows": [], "title": "Resumen Mes"},
        "analysis_table": analysis_table,
        "production_types_table": production_types_table,
        "distribution_relative": distribution_relative,
        "conclusion_integrada": conclusion_text,
        "data_points": len(analysis_table.get("rows", [])) + len(production_types_table.get("rows", [])),
        "date_range": None,
        "metrics": [],
        "chart_type": "production_monthly_balance",
        "message": "Balance Mensual con Comportamiento de Producto",
    }


__all__ = ["create_monthly_balance_payload"]

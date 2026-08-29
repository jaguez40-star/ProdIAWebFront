"""
Production Reports Chart Creator
Generates charts for fixed production reports
"""

import json
import os
import re
import hashlib
import logging
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import numpy as np
try:  # pragma: no cover
    import markdown
except ImportError:  # pragma: no cover
    markdown = None
from .monthly_balance import create_monthly_balance_payload
from ..map_variation_heatmap import generate_variation_heatmap_html

logger = logging.getLogger(__name__)


def render_markdown_to_html(markdown_text: Optional[str]) -> Optional[str]:
    """Convert markdown text to HTML, preserving tables and lists."""
    if not markdown_text:
        return None

    try:
        if markdown:
            return markdown.markdown(
                markdown_text,
                extensions=["tables", "fenced_code", "sane_lists"],
                output_format="html5",
            )
        # Fallback básico cuando python-markdown no está disponible
        html = markdown_text
        replacements = [
            ("**", ""),  # quitar negritas básicas
            ("__", ""),
        ]
        for old, new in replacements:
            html = html.replace(old, new)
        html = html.replace("\n\n", "<br><br>").replace("\n", "<br>")
        return html
    except Exception as exc:  # pragma: no cover
        logger.warning("Unable to convert markdown to HTML: %s", exc)
        return markdown_text


def extract_markdown_table(markdown_text: Optional[str]) -> Optional[Dict[str, Any]]:
    """Parse the first markdown table found in the text into headers/rows."""
    if not markdown_text:
        return None

    lines = markdown_text.splitlines()
    table_lines: List[str] = []
    collecting = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|"):
            collecting = True
            table_lines.append(stripped)
        elif collecting:
            break

    if len(table_lines) < 2:
        return None

    header_cells = [
        cell.strip()
        for cell in table_lines[0].split("|")[1:-1]
        if cell.strip()
    ]
    if not header_cells:
        return None

    headers = []
    for idx, cell in enumerate(header_cells):
        slug = re.sub(r"[^a-z0-9]+", "_", cell.lower()).strip("_") or f"col_{idx}"
        headers.append({"key": slug, "label": cell})

    data_rows: List[Dict[str, str]] = []
    for raw_line in table_lines[2:]:
        if raw_line.count("|") < 2:
            continue
        cells = [cell.strip() for cell in raw_line.split("|")[1:-1]]
        if not any(cells):
            continue
        row = {headers[idx]["key"]: cell for idx, cell in enumerate(cells)}
        data_rows.append(row)

    if not data_rows:
        return None

    return {"headers": headers, "rows": data_rows}


def extract_conclusion_items(markdown_text: Optional[str]) -> List[str]:
    """Extract paragraph-style conclusions from the 'Conclusion Integrada' section."""
    if not markdown_text:
        return []

    lines = markdown_text.splitlines()
    conclusion_idx = None
    for idx, line in enumerate(lines):
        if line.strip().lower().startswith("### conclusion integrada"):
            conclusion_idx = idx + 1
            break

    if conclusion_idx is None:
        return []

    conclusion_lines: List[str] = []
    for line in lines[conclusion_idx:]:
        stripped = line.strip()
        if stripped.startswith("### "):
            break
        if stripped == "---":
            break
        conclusion_lines.append(line)

    # Join lines into paragraphs separated by blank lines
    items: List[str] = []
    buffer: List[str] = []
    for line in conclusion_lines:
        if not line.strip():
            if buffer:
                items.append(" ".join(part.strip() for part in buffer if part.strip()))
                buffer = []
        else:
            buffer.append(line)
    if buffer:
        items.append(" ".join(part.strip() for part in buffer if part.strip()))

    return [item for item in items if item]


class ProductionReportChartCreator:
    """Creates charts for production performance reports"""

    def __init__(self, db_connection=None):
        """
        Initialize the chart creator

        Args:
            db_connection: Database connection for executing queries
        """
        self.db_connection = db_connection
        self._frame_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._programmed_panorama_cache: Optional[Dict[str, Any]] = None
        self._programmed_panorama_cache_mtime: Optional[float] = None

    def _load_programmed_panorama_cache(self) -> Dict[str, Any]:
        """Lazy load panorama payload for programmed analysis cards."""
        cache: Dict[str, Any] = {}
        json_path = (
            Path(__file__).resolve().parents[4]
            / "resumen"
            / "Resp_AnalisisProduccion.json"
        )
        if json_path.exists():
            try:
                current_mtime = json_path.stat().st_mtime
            except OSError:
                current_mtime = None

            if (
                self._programmed_panorama_cache is not None
                and self._programmed_panorama_cache_mtime is not None
                and current_mtime is not None
                and abs(self._programmed_panorama_cache_mtime - current_mtime) < 1e-6
            ):
                return self._programmed_panorama_cache

            try:
                with json_path.open(encoding="utf-8-sig") as json_file:
                    payload = json.load(json_file)
                if isinstance(payload, dict):
                    cache = payload
                else:
                    logger.warning(
                        "Unexpected structure in Resp_AnalisisProduccion.json: %s",
                        type(payload),
                    )
            except Exception as exc:  # pragma: no cover
                logger.warning(
                    "Unable to load programmed panorama payload: %s",
                    exc,
                )
        else:
            logger.info("Resp_AnalisisProduccion.json not found at %s", json_path)

        self._programmed_panorama_cache = cache
        try:
            self._programmed_panorama_cache_mtime = (
                json_path.stat().st_mtime if json_path.exists() else None
            )
        except OSError:
            self._programmed_panorama_cache_mtime = None
        return cache

    def _get_programmed_panorama(self, key: str) -> Optional[Dict[str, Any]]:
        """Return panorama object for a specific programmed dataset if available."""
        cache = self._load_programmed_panorama_cache()
        value = cache.get(key)
        if isinstance(value, dict):
            return value
        return None

    def _format_programmed_panorama(self, key: str, title: str) -> Optional[Dict[str, Any]]:
        """Return a copy of the panorama with an updated title, if available."""
        panorama = self._get_programmed_panorama(key)
        if not isinstance(panorama, dict):
            return None
        formatted = panorama.copy()
        if title:
            formatted["titulo"] = title
        return formatted

    def create_daily_performance_chart(
        self,
        data: pd.DataFrame = None,
        start_date: str = None,
        end_date: str = None,
        config: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Create daily performance chart with multiple metrics

        Args:
            data: Optional pre-fetched data
            start_date: Start date for data query (default: last 14 days)
            end_date: End date for data query (default: today)
            config: Chart configuration

        Returns:
            Dict containing chart data (traces and layout) for frontend rendering
        """
        try:
            # If no data provided, fetch from database
            if data is None:
                data = self._fetch_daily_performance_data(start_date, end_date)

            if data.empty:
                logger.warning("No data available for daily performance chart")
                return {
                    "success": False,
                    "error": "No hay datos disponibles para el período seleccionado",
                    "chart_data": None,
                }

            # Generate chart data (traces and layout) for frontend
            chart_data = self._generate_chart_data(data, config)

            # Fetch summary table data from RESUMEN_MES
            summary_table = self._fetch_monthly_summary_data()
            # Fetch deferred summary generated via Ollama
            deferred_summary = self._fetch_deferred_summary_table()

            # Build analysis/gerencia table data
            analysis_table = self._build_gerencia_analysis_table()
            production_types_table = self._build_blancos_analysis_table()
            programmed_analysis_table = self._build_programmed_analysis_table()
            programmed_blancos_table = self._build_programmed_blancos_table()
            pop_vs_real_table = self._build_pop_vs_real_table()
            pop_blancos_vs_real_table = self._build_pop_blancos_vs_real_table()

            try:
                maps_payload = self._build_maps_payload()
            except Exception as exc:  # pragma: no cover
                logger.error("Error building maps payload: %s", exc)
                maps_payload = {}

            return {
                "success": True,
                "chart_data": chart_data,
                "deferred_summary_table": deferred_summary,
                "summary_table": summary_table,  # NEW: Add summary table data
                "analysis_table": analysis_table,  # NEW: Add gerencia analysis table
                "production_types_table": production_types_table,
                "programmed_analysis_table": programmed_analysis_table,
                "programmed_blancos_table": programmed_blancos_table,
                "pop_vs_real_table": pop_vs_real_table,
                "pop_blancos_vs_real_table": pop_blancos_vs_real_table,
                "maps": maps_payload,
                "data_points": len(data),
                "date_range": {
                    "start": (
                        data["FECHA"].min().strftime("%Y-%m-%d")
                        if "FECHA" in data.columns
                        else None
                    ),
                    "end": (
                        data["FECHA"].max().strftime("%Y-%m-%d")
                        if "FECHA" in data.columns
                        else None
                    ),
                },
                "metrics": list(data.columns),
                "chart_type": "production_daily_performance",
            }

        except Exception as e:
            logger.error(f"Error creating daily performance chart: {e}")
            import traceback

            logger.error(f"Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e), "chart_data": None}

    def create_monthly_balance_chart(
        self,
        data: Dict[str, Any] = None,
        config: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Compatibility wrapper delegating to the dedicated monthly balance module.
        """
        payload = create_monthly_balance_payload(
            self.db_connection,
            config=config,
            summary_table=data,
        )
        if payload.get("success"):
            try:
                payload["programmed_analysis_table"] = (
                    self._build_programmed_analysis_table()
                )
            except Exception as exc:  # pragma: no cover
                logger.error(
                    "Error building programmed analysis table for monthly balance: %s",
                    exc,
                )
                payload["programmed_analysis_table"] = {
                    "headers": [],
                    "rows": [],
                    "title": "Crudo: Producción vs Meta",
                    "chart": None,
                }

            try:
                payload["programmed_blancos_table"] = (
                    self._build_programmed_blancos_table()
                )
            except Exception as exc:  # pragma: no cover
                logger.error(
                    "Error building programmed blancos table for monthly balance: %s",
                    exc,
                )
                payload["programmed_blancos_table"] = {
                    "headers": [],
                    "rows": [],
                    "title": "Productos Blancos: Producción vs Meta",
                    "chart": None,
                }

            try:
                payload["pop_vs_real_table"] = self._build_pop_vs_real_table()
            except Exception as exc:  # pragma: no cover
                logger.error(
                    "Error building POP vs Real table for monthly balance: %s",
                    exc,
                )
                payload["pop_vs_real_table"] = {
                    "headers": [],
                    "rows": [],
                    "title": "Crudo: Producción vs POP",
                    "chart": None,
                }

            try:
                payload[
                    "pop_blancos_vs_real_table"
                ] = self._build_pop_blancos_vs_real_table()
            except Exception as exc:  # pragma: no cover
                logger.error(
                    "Error building POP blancos vs Real table for monthly balance: %s",
                    exc,
                )
                payload["pop_blancos_vs_real_table"] = {
                    "headers": [],
                    "rows": [],
                    "title": "Productos Blancos: Producción vs POP",
                    "chart": None,
                }

        return payload

    def _fetch_daily_performance_data(
        self, start_date: str = None, end_date: str = None
    ) -> pd.DataFrame:
        """
        Fetch daily performance data from database

        Args:
            start_date: Start date (DD/MM/YYYY or YYYY-MM-DD)
            end_date: End date (DD/MM/YYYY or YYYY-MM-DD)

        Returns:
            DataFrame with production data
        """
        if not self.db_connection:
            logger.error("No database connection available")
            return pd.DataFrame()

        # SQLite query with column mapping
        # Q_Real → ECP_VOL_ESTIMADO_DIA
        # Q_POP → ECP_VOL_PROG
        # Note: Table has limited date range (Aug-Sep 2025), so we fetch all records
        query = """
            SELECT
                FECHA,
                ECP_VOL_ESTIMADO_DIA as Q_Real,
                ECP_VOL_PROG as Q_POP,
                ECP_META_741,
                ECP_META_747,
                ECP_META_755,
                CAMPO,
                COMENTARIO,
                TOTAL_ACEITE_PERDIDO
            FROM V_DATA_GRAF_DAILY
            ORDER BY id_row
        """

        try:
            logger.info(f"Fetching production report data from REPORTE_SEMANAL")

            # SQLite query - get all records
            data = pd.read_sql_query(query, self.db_connection)

            # Convert FECHA to datetime (format: DD/MM/YYYY)
            if "FECHA" in data.columns and len(data) > 0:
                data["FECHA"] = pd.to_datetime(
                    data["FECHA"], format="%d/%m/%Y", errors="coerce"
                )
                data["CAMPO"] = data["CAMPO"].astype(str).str.strip()
                data["COMENTARIO"] = data["COMENTARIO"].astype(str).str.strip()
                data["TOTAL_ACEITE_PERDIDO"] = pd.to_numeric(
                    data["TOTAL_ACEITE_PERDIDO"], errors="coerce"
                )
                data["__order"] = data.index

                aggregator = {"TOTAL_ACEITE_PERDIDO": "sum", "__order": "min"}
                metric_columns = [
                    "Q_Real",
                    "Q_POP",
                    "ECP_META_741",
                    "ECP_META_747",
                    "ECP_META_755",
                ]
                for col in metric_columns:
                    if col in data.columns:
                        aggregator[col] = "first"

                data = (
                    data.sort_values(["FECHA", "__order"])
                    .groupby(
                        ["FECHA", "CAMPO", "COMENTARIO"], as_index=False, dropna=False
                    )
                    .agg(aggregator)
                    .sort_values(["FECHA", "__order"])
                    .drop(columns="__order")
                )
                logger.info(f"✅ Fetched {len(data)} records for daily performance")
                logger.info(
                    f"📅 Date range: {data['FECHA'].min()} to {data['FECHA'].max()}"
                )
            else:
                logger.warning(f"⚠️ No data found in REPORTE_SEMANAL table")

            return data

        except Exception as e:
            logger.error(f"❌ Error fetching daily performance data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return pd.DataFrame()

    def _fetch_gerencia_variation_data(self) -> pd.DataFrame:
        """
        Fetch raw data from V_CRUDO_VARIACION_GER view.

        Returns:
            DataFrame with gerencia variation data.
        """
        if not self.db_connection:
            logger.error("No database connection available for gerencia variation data")
            return pd.DataFrame()

        query = "SELECT * FROM V_CRUDO_VARIACION_GER;"

        try:
            logger.info("Fetching gerencia variation data from V_CRUDO_VARIACION_GER")
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning("No data found in V_CRUDO_VARIACION_GER view")

            return data

        except Exception as e:
            logger.error(f"Error fetching gerencia variation data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return pd.DataFrame()

    def _fetch_programmed_variation_data(self) -> pd.DataFrame:
        """
        Fetch raw data from V_CRUDO_VARIACION_GER_PROGRAMADO view.
        """
        if not self.db_connection:
            logger.error(
                "No database connection available for programmed variation data"
            )
            return pd.DataFrame()

        query = "SELECT * FROM V_CRUDO_VARIACION_GER_PROGRAMADO;"

        try:
            logger.info(
                "Fetching programmed variation data from V_CRUDO_VARIACION_GER_PROGRAMADO"
            )
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning(
                    "No data found in V_CRUDO_VARIACION_GER_PROGRAMADO view"
                )

            return data

        except Exception as e:
            logger.error(f"Error fetching programmed variation data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return pd.DataFrame()

    def _fetch_pop_variation_data(self) -> pd.DataFrame:
        """
        Fetch POP comparison data from V_PRODUCCION_POP view.
        """
        if not self.db_connection:
            logger.error("No database connection available for POP variation data")
            return pd.DataFrame()

        query = "SELECT * FROM V_PRODUCCION_POP;"

        try:
            logger.info("Fetching POP variation data from V_PRODUCCION_POP view")
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning("No data found in V_PRODUCCION_POP view")

            return data

        except Exception as e:
            logger.error(f"Error fetching POP variation data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return pd.DataFrame()

    def _fetch_pop_blancos_variation_data(self) -> pd.DataFrame:
        """
        Fetch POP comparison data for blancos from V_PRODUCCION_POP_BLANCOS view.
        """
        if not self.db_connection:
            logger.error(
                "No database connection available for POP blancos variation data"
            )
            return pd.DataFrame()

        query = "SELECT * FROM V_PRODUCCION_POP_BLANCOS;"

        try:
            logger.info(
                "Fetching POP blancos variation data from V_PRODUCCION_POP_BLANCOS view"
            )
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning("No data found in V_PRODUCCION_POP_BLANCOS view")

            return data

        except Exception as e:
            logger.error(f"Error fetching POP blancos variation data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return pd.DataFrame()

    

    @staticmethod
    def _prepare_variation_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """Clean and standardize variation data for tables and charts."""
        if df is None or df.empty:
            return pd.DataFrame()

        df = df.copy()
        df.columns = [str(col).strip().replace(' ', '_') for col in df.columns]

        rename_map = {}
        for col in list(df.columns):
            low = col.lower()
            if low == "producto":
                rename_map[col] = "PRODUCTO"
            elif low == "gerencia":
                rename_map[col] = "GERENCIA"
            elif low in {"produccion_real", "prod_real", "septiembre"}:
                rename_map[col] = "Prod_Sept"
            elif low in {"produccion_pop", "pop_dic", "pop"}:
                rename_map[col] = "POP_Dic"
            elif low in {"prod_agost", "prod_agosto", "prod_agost."}:
                rename_map[col] = "Prod_Agost"
            elif low in {"prod_sept", "prod_septiembre", "prod_sept."}:
                rename_map[col] = "Prod_Sept"
            elif low in {
                "prog_sep",
                "prog_sept",
                "prog_septiembre",
                "prog_sep.",
            }:
                rename_map[col] = "Prog_Sep"
            elif low in {"var_pct", "var_%", "variacion_pct", "variacion_porct"}:
                rename_map[col] = "VAR_PCT"
        if rename_map:
            df = df.rename(columns=rename_map)

        # Ensure duplicate columns are removed (take first occurrence)
        if df.columns.duplicated().any():
            df = df.loc[:, ~df.columns.duplicated()]

        def _to_numeric(series: pd.Series) -> pd.Series:
            if series.dtype != object:
                return pd.to_numeric(series, errors="coerce")
            cleaned = series.astype(str).str.strip()
            cleaned = cleaned.str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
            return pd.to_numeric(cleaned, errors="coerce")

        for col in ("Prod_Agost", "Prod_Sept", "Prog_Sep", "VAR_PCT"):
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

    def _fetch_blancos_variation_data(self) -> pd.DataFrame:
        if not self.db_connection:
            logger.error("No database connection available for blancos variation data")
            return pd.DataFrame()

        query = "SELECT * FROM V_BLANCOS_VARIACION_GER;"

        try:
            logger.info("Fetching blancos variation data from V_BLANCOS_VARIACION_GER")
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning("No data found in V_BLANCOS_VARIACION_GER view")

            return data
            
        except Exception as e:
                logger.error(f"Error fetching blancos variation data: {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return pd.DataFrame()

    def _fetch_programmed_blancos_variation_data(self) -> pd.DataFrame:
        """
        Fetch raw data from V_BLANCOS_VARIACION_GER_PROGRAMADO view.
        """
        if not self.db_connection:
            logger.error(
                "No database connection available for blancos programmed variation data"
            )
            return pd.DataFrame()

        query = "SELECT * FROM V_BLANCOS_VARIACION_GER_PROGRAMADO;"

        try:
            logger.info(
                "Fetching blancos programmed variation data from V_BLANCOS_VARIACION_GER_PROGRAMADO"
            )
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning(
                    "No data found in V_BLANCOS_VARIACION_GER_PROGRAMADO view"
                )

            return data

        except Exception as e:
            logger.error(f"Error fetching blancos programmed variation data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return pd.DataFrame()
    

    def _build_gerencia_analysis_table(self) -> Dict[str, Any]:
        """Build table payload and chart data for gerencia variation."""
        data = self._fetch_gerencia_variation_data()
        if data.empty:
            return {"headers": [], "rows": [], "title": "Analisis / Gerencia", "chart": None}

        prepared = self._prepare_variation_dataframe(data)
        if prepared.empty:
            return {"headers": [], "rows": [], "title": "Analisis / Gerencia", "chart": None}

        if "VAR_PCT" not in prepared.columns and "VAR_PCT_TO_SHOW" in prepared.columns:
            prepared["VAR_PCT"] = prepared["VAR_PCT_TO_SHOW"]

        table_df = prepared.copy()
        drop_columns = {"PRODUCTO", "VAR_PCT_TO_SHOW", "VAR_PCT_CALC", "DELTA_ABS"}
        columns = [col for col in table_df.columns if col.strip().upper() not in drop_columns]
        table_df = table_df[columns]
        preferred_order = [
            col
            for col in ["GERENCIA", "Prod_Sept", "Prog_Sep", "VAR_PCT"]
            if col in table_df.columns
        ]
        if preferred_order:
            remaining = [col for col in table_df.columns if col not in preferred_order]
            table_df = table_df[preferred_order + remaining]
        if "VAR_PCT" in table_df.columns:
            table_df["VAR_PCT"] = table_df["VAR_PCT"].round(2)

        header_labels = {
            "Gerencia": "Gerencia",
            "GERENCIA": "Gerencia",
            "Prod_Agost": "Producción Agosto",
            "PROD_AGOST": "Producción Agosto",
            "Prod_Sept": "Producción Septiembre",
            "PROD_SEPT": "Producción Septiembre",
            "Prog_Sep": "Producción Programada",
            "PROG_SEP": "Producción Programada",
            "Var_Pct": "Variación (%)",
            "VAR_PCT": "Variación (%)",
        }

        headers = [
            {
                "key": column,
                "label": header_labels.get(column, column.replace("_", " ").title()),
            }
            for column in table_df.columns
        ]

        rows = (
            table_df.replace({pd.NA: None})
            .replace({float("nan"): None})
            .to_dict("records")
        )

        chart = None
        if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
            chart_df = prepared[["GERENCIA", "VAR_PCT_TO_SHOW"]].dropna(subset=["VAR_PCT_TO_SHOW"])  # type: ignore[index]
            if not chart_df.empty:
                values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
                colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
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
        }

    def _build_programmed_analysis_table(self) -> Dict[str, Any]:
        """Build table payload for programmed production variation."""
        data = self._fetch_programmed_variation_data()
        if data.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Crudo: Comportamiento Producción vs Meta",
                "chart": None,
            }

        prepared = self._prepare_variation_dataframe(data)
        if prepared.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Crudo: Comportamiento Producción vs Meta",
                "chart": None,
            }

        if "VAR_PCT" not in prepared.columns and "VAR_PCT_TO_SHOW" in prepared.columns:
            prepared["VAR_PCT"] = prepared["VAR_PCT_TO_SHOW"]

        table_df = prepared.copy()
        drop_columns = {"PRODUCTO", "VAR_PCT_TO_SHOW", "VAR_PCT_CALC", "DELTA_ABS"}
        columns = [
            col for col in table_df.columns if col.strip().upper() not in drop_columns
        ]
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
            {
                "key": column,
                "label": header_labels.get(column, column.replace("_", " ").title()),
            }
            for column in table_df.columns
        ]

        rows = (
            table_df.replace({pd.NA: None})
            .replace({float("nan"): None})
            .to_dict("records")
        )

        chart = None
        if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
            chart_df = prepared[["GERENCIA", "VAR_PCT_TO_SHOW"]].dropna(
                subset=["VAR_PCT_TO_SHOW"]
            )
            if not chart_df.empty:
                values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
                colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
                chart = {
                    "type": "horizontal_bar",
                    "x": values,
                    "y": chart_df["GERENCIA"].astype(str).tolist(),
                    "orientation": "h",
                    "colors": colors,
                    "x_suffix": "%",
                    "x_format": ",.2f",
                    "x_axis_label": "Variación (%)",
                    "y_axis_label": "Gerencia",
                }

        result = {
            "headers": headers,
            "rows": rows,
            "title": "Crudo: Comportamiento Producción vs Meta",
            "chart": chart,
        }

        llm_cols = [
            col
            for col in ["GERENCIA", "Prod_Sept", "Prog_Sep", "VAR_PCT"]
            if col in prepared.columns
        ]
        if llm_cols:
            result["llm_source"] = (
                prepared[llm_cols]
                .rename(
                    columns={
                        "GERENCIA": "Gerencia",
                        "Prod_Sept": "Producción Septiembre",
                        "Prog_Sep": "Producción Programada",
                        "VAR_PCT": "Variación (%)",
                    }
                )
                .to_dict("records")
            )

        if panorama := self._format_programmed_panorama(
            "panorama_general_crudo", "Crudo: Producción vs Meta Panorama General"
        ):
            result["panorama_general"] = panorama

        return result

    def _build_pop_vs_real_table(self) -> Dict[str, Any]:
        """Build table payload for POP vs Real production comparison."""
        data = self._fetch_pop_variation_data()
        if data.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Crudo: Comportamiento Producción vs POP",
                "chart": None,
            }

        prepared = self._prepare_variation_dataframe(data)
        if prepared.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Crudo: Comportamiento Producción vs POP",
                "chart": None,
            }

        if "VAR_PCT" not in prepared.columns and "VAR_PCT_TO_SHOW" in prepared.columns:
            prepared["VAR_PCT"] = prepared["VAR_PCT_TO_SHOW"]

        table_df = prepared.copy()
        drop_columns = {"PRODUCTO", "VAR_PCT_TO_SHOW", "VAR_PCT_CALC", "DELTA_ABS"}
        columns = [
            col for col in table_df.columns if col.strip().upper() not in drop_columns
        ]
        table_df = table_df[columns]
        preferred_order = [
            col
            for col in ["GERENCIA", "Prod_Sept", "POP_Dic", "VAR_PCT"]
            if col in table_df.columns
        ]
        if preferred_order:
            remaining = [col for col in table_df.columns if col not in preferred_order]
            table_df = table_df[preferred_order + remaining]
        if "VAR_PCT" in table_df.columns:
            table_df["VAR_PCT"] = table_df["VAR_PCT"].round(2)

        header_labels = {
            "GERENCIA": "Gerencia",
            "Prod_Sept": "Producción Septiembre",
            "POP_Dic": "POP",
            "VAR_PCT": "Variación (%)",
        }

        headers = [
            {
                "key": column,
                "label": header_labels.get(column, column.replace("_", " ").title()),
            }
            for column in table_df.columns
        ]

        rows = (
            table_df.replace({pd.NA: None})
            .replace({float("nan"): None})
            .to_dict("records")
        )

        chart = None
        if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
            chart_df = prepared[
                ["GERENCIA", "VAR_PCT_TO_SHOW"]
            ].dropna(subset=["VAR_PCT_TO_SHOW"])
            if not chart_df.empty:
                values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
                colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
                chart = {
                    "type": "horizontal_bar",
                    "title": "CRUDO - Variación % vs POP (Septiembre)",
                    "x": values,
                    "y": chart_df["GERENCIA"].astype(str).tolist(),
                    "orientation": "h",
                    "colors": colors,
                    "x_suffix": "%",
                    "x_format": ",.2f",
                    "x_axis_label": "Variación (%)",
                    "y_axis_label": "Gerencia",
                }

        result = {
            "headers": headers,
            "rows": rows,
            "title": "Crudo: Comportamiento Producción vs POP",
            "chart": chart,
        }

        llm_cols = [
            col
            for col in ["GERENCIA", "Prod_Sept", "POP_Dic", "VAR_PCT"]
            if col in prepared.columns
        ]
        if llm_cols:
            result["llm_source"] = (
                prepared[llm_cols]
                .rename(
                    columns={
                        "GERENCIA": "Gerencia",
                        "Prod_Sept": "Producción Septiembre",
                        "POP_Dic": "POP",
                        "VAR_PCT": "Variación (%)",
                    }
                )
                .to_dict("records")
            )

        if panorama := self._format_programmed_panorama(
            "panorama_general_pop", "Crudo: Producción vs POP Panorama General"
        ):
            result["panorama_general"] = panorama

        return result

    def _build_pop_blancos_vs_real_table(self) -> Dict[str, Any]:
        """Build table payload for blancos POP vs Real comparison."""
        data = self._fetch_pop_blancos_variation_data()
        if data.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Productos Blancos: Comportamiento Producción vs POP",
                "chart": None,
            }

        prepared = self._prepare_variation_dataframe(data)
        if prepared.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Productos Blancos: Comportamiento Producción vs POP",
                "chart": None,
            }

        if "VAR_PCT" not in prepared.columns and "VAR_PCT_TO_SHOW" in prepared.columns:
            prepared["VAR_PCT"] = prepared["VAR_PCT_TO_SHOW"]

        table_df = prepared.copy()
        drop_columns = {"PRODUCTO", "VAR_PCT_TO_SHOW", "VAR_PCT_CALC", "DELTA_ABS"}
        columns = [
            col for col in table_df.columns if col.strip().upper() not in drop_columns
        ]
        table_df = table_df[columns]
        preferred_order = [
            col
            for col in ["GERENCIA", "Prod_Sept", "POP_Dic", "VAR_PCT"]
            if col in table_df.columns
        ]
        if preferred_order:
            remaining = [col for col in table_df.columns if col not in preferred_order]
            table_df = table_df[preferred_order + remaining]
        if "VAR_PCT" in table_df.columns:
            table_df["VAR_PCT"] = table_df["VAR_PCT"].round(2)

        header_labels = {
            "GERENCIA": "Gerencia",
            "Prod_Sept": "Producción Septiembre",
            "POP_Dic": "POP",
            "VAR_PCT": "Variación (%)",
        }

        headers = [
            {
                "key": column,
                "label": header_labels.get(column, column.replace("_", " ").title()),
            }
            for column in table_df.columns
        ]

        rows = (
            table_df.replace({pd.NA: None})
            .replace({float("nan"): None})
            .to_dict("records")
        )

        chart = None
        if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
            chart_df = prepared[
                ["GERENCIA", "VAR_PCT_TO_SHOW"]
            ].dropna(subset=["VAR_PCT_TO_SHOW"])
            if not chart_df.empty:
                values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
                colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
                chart = {
                    "type": "horizontal_bar",
                    "title": "Productos Blancos - Variación % vs POP (Septiembre)",
                    "x": values,
                    "y": chart_df["GERENCIA"].astype(str).tolist(),
                    "orientation": "h",
                    "colors": colors,
                    "x_suffix": "%",
                    "x_format": ",.2f",
                    "x_axis_label": "Variación (%)",
                    "y_axis_label": "Gerencia",
                }

        result = {
            "headers": headers,
            "rows": rows,
            "title": "Productos Blancos: Comportamiento Producción vs POP",
            "chart": chart,
        }

        llm_cols = [
            col
            for col in ["GERENCIA", "Prod_Sept", "POP_Dic", "VAR_PCT"]
            if col in prepared.columns
        ]
        if llm_cols:
            result["llm_source"] = (
                prepared[llm_cols]
                .rename(
                    columns={
                        "GERENCIA": "Gerencia",
                        "Prod_Sept": "Producción Septiembre",
                        "POP_Dic": "POP",
                        "VAR_PCT": "Variación (%)",
                    }
                )
                .to_dict("records")
            )

        if panorama := self._format_programmed_panorama(
            "panorama_general_pop_blancos",
            "Productos Blancos: Producción vs POP Panorama General",
        ):
            result["panorama_general"] = panorama

        return result

    def _build_maps_payload(self) -> Dict[str, Any]:
        """Compose HTML maps for gerencias and campos using Leaflet."""
        if not self.db_connection:
            return {}

        def _fetch_view(view_name: str) -> pd.DataFrame:
            try:
                return pd.read_sql_query(f"SELECT * FROM {view_name}", self.db_connection)
            except Exception as exc:
                logger.error("Error fetching view %s: %s", view_name, exc)
                return pd.DataFrame()

        def _generate_map_html(df: pd.DataFrame, columns: Dict[str, str]) -> Optional[str]:
            if df.empty:
                return None

            normalized: Dict[str, str] = {}
            for alias, candidate in columns.items():
                match = next((col for col in df.columns if col.lower() == candidate.lower()), None)
                normalized[alias] = match or candidate

            lat_col = normalized.get("lat")
            lon_col = normalized.get("lon")
            if lat_col not in df.columns or lon_col not in df.columns:
                return None

            cleaned = df.dropna(subset=[lat_col, lon_col]).copy()
            if cleaned.empty:
                return None

            records: List[Dict[str, Any]] = []
            for _, row in cleaned.iterrows():
                record = {
                    "lat": float(row[lat_col]),
                    "lon": float(row[lon_col]),
                }
                for key, col_name in normalized.items():
                    if key in {"lat", "lon"}:
                        continue
                    value = row.get(col_name)
                    if isinstance(value, (float, int, np.floating)):
                        if pd.isna(value):
                            record[key] = None
                        else:
                            record[key] = float(value)
                    elif value is None or (isinstance(value, str) and not value.strip()):
                        record[key] = None
                    else:
                        record[key] = str(value)
                records.append(record)

            if not records:
                return None

            popup_fields = [
                key for key in ["vice", "campo", "crudo", "blancos"] if key in records[0]
            ]

            popup_lines: List[str] = []
            label_mapping = {
                "vice": "Gerencia Operativa",
                "campo": "Campo Productor",
                "crudo": "Producción Crudo (BOPD)",
                "blancos": "Producción Productos Blancos (BOPD)",
            }

            title_template = "`<div class=\\\"popup-title\\\">${d.vice ? 'Gerencia Operativa: ' + d.vice : 'Detalle de Producción'}</div>`"
            if "vice" in popup_fields:
                popup_fields.remove("vice")

            for key in popup_fields:
                alias_js = json.dumps(key)
                label = label_mapping.get(key, key.replace("_", " ").title())
                line = (
                    f"`<div class='popup-metric'><span class='popup-metric-label'>{label}:</span><span class='popup-metric-value'>"
                    f"${{d[{alias_js}] === null || d[{alias_js}] === 'NaN' ? '' : (typeof d[{alias_js}] === 'number' ? fmt.format(d[{alias_js}]) : d[{alias_js}])}}</span></div>`"
                )
                popup_lines.append(line)

            popup_expr = (
                "[" + ", ".join([title_template] + popup_lines) + "].join('')"
                if popup_lines
                else title_template
            )

            return f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{{height:100%;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;}}
  .control-panel{{
    position:absolute;top:20px;right:20px;z-index:1000;
    background:linear-gradient(135deg,#ffffff 0%,#f8f9fa 100%);
    border-radius:12px;padding:20px;width:280px;
    box-shadow:0 8px 32px rgba(0,0,0,0.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    transition:all 0.3s ease;
  }}
  .control-panel:hover{{box-shadow:0 12px 48px rgba(0,0,0,0.15);}}
  .panel-header{{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e9ecef;}}
  .panel-title{{font-size:16px;font-weight:700;color:#1a1a1a;}}
  .panel-icon{{display:inline-flex;align-items:center;justify-content:center;width:55px;height:55px;border-radius:14px;background:#f0f4f8;box-shadow:0 3px 8px rgba(0,0,0,0.12);overflow:hidden;}}
  .panel-icon img{{width:100%;height:100%;object-fit:cover;}}
  .metric-selector{{display:flex;flex-direction:column;gap:10px;}}
  .metric-option{{
    width:100%;border:2px solid #e9ecef;background:#ffffff;border-radius:10px;
    padding:12px 16px;display:flex;align-items:center;gap:12px;
    cursor:pointer;transition:all 0.2s ease;font-size:13px;font-weight:600;color:#1a1a1a;
  }}
  .metric-option:focus{{outline:none;}}
  .metric-option:hover{{border-color:#CCD32A;background:rgba(204,211,42,0.12);transform:translateX(4px);}}
  .metric-option.active{{
    border-color:#CCD32A;
    background:linear-gradient(135deg,#CCD32A 0%,#A6B021 100%);
    color:#ffffff;box-shadow:0 6px 16px rgba(204,211,42,0.35);
  }}
  .metric-radio{{
    width:18px;height:18px;border-radius:50%;border:2px solid currentColor;
    display:inline-flex;align-items:center;justify-content:center;
  }}
  .metric-option.active .metric-radio{{border-color:#ffffff;background:#ffffff;}}
  .metric-option.active .metric-radio::after{{
    content:'';width:8px;height:8px;border-radius:50%;background:#CCD32A;
  }}
  .metric-label{{flex:1;}}
  .search-box{{margin-top:16px;padding-top:16px;border-top:2px solid #e9ecef;}}
  .search-input-wrapper{{position:relative;}}
  .search-icon{{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#9aa0a6;font-size:14px;}}
  .layer-search{{
    width:100%;padding:10px 12px 10px 34px;border:2px solid #e9ecef;border-radius:10px;
    font-size:13px;transition:all 0.2s ease;background:#ffffff;box-sizing:border-box;
  }}
.layer-search:focus{{outline:none;border-color:#CCD32A;box-shadow:0 0 0 3px rgba(204,211,42,0.2);}}
  .layer-search::placeholder{{color:#9aa0a6;}}
  .popup-title{{font-size:18.75px;font-weight:700;color:#004236;text-align:center;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e9ecef;}}
  .popup-metric{{display:flex;justify-content:space-between;align-items:center;margin:4px 0;font-size:13px;color:#1a1a1a;}}
  .popup-metric-label{{color:#666;font-weight:500;margin-right:12px;}}
  .popup-metric-value{{font-weight:600;color:#1a1a1a;}}
</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const data = {json.dumps(records)};
function maxOf(field){{let m=0;data.forEach(d=>{{if(typeof d[field]==='number' && d[field] > 0) m=Math.max(m,d[field]);}});return m;}}
function radius(v,max,rmax=44){{if(!v||v<=0||!max)return 0;return Math.max(Math.sqrt(v/max)*rmax,6);}}
const fmt = new Intl.NumberFormat('es-CO', {{ maximumFractionDigits: 0 }});
const map = L.map('map');
L.tileLayer('https://{{s}}.basemaps.cartocdn.com/light_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{ attribution: '&copy; OpenStreetMap &copy; CARTO' }}).addTo(map);
const layers = [
  {{ key: 'crudo', label: 'Producción Crudo (BOPD)', color: '#004236' }},
  {{ key: 'blancos', label: 'Producción Productos Blancos (BOPD)', color: '#999999' }}
];
const BASE_OPACITY = 0.9;
const DIMMED_OPACITY = 0.25;
const layerGroups = {{}};
const markersByLayer = {{}};
layers.forEach(cfg => {{
  const group = L.layerGroup();
  const markers = [];
  layerGroups[cfg.key] = group;
  markersByLayer[cfg.key] = markers;
  const vmax = maxOf(cfg.key);
  data.forEach(d => {{
    const value = d[cfg.key];
    const radiusValue = radius(value, vmax);
    if (radiusValue <= 0) return;
    const popup = {popup_expr};
    const marker = L.circleMarker([d.lat, d.lon], {{
      radius: radiusValue,
      color: cfg.color,
      fillColor: cfg.color,
      weight: 1.5,
      opacity: 1,
      fillOpacity: BASE_OPACITY
    }}).bindPopup(popup);
    const labelParts = [d.vice, d.campo, d.ger, d.gerencia, d.nombre].filter(Boolean);
    marker._searchText = labelParts.join(' ').toLowerCase();
    marker._layerKey = cfg.key;
    marker._baseOpacity = BASE_OPACITY;
    marker._dimOpacity = DIMMED_OPACITY;
    marker.addTo(group);
    markers.push(marker);
  }});
  group.addTo(map);
}});
const layerState = layers.reduce((acc, cfg) => {{ acc[cfg.key] = true; return acc; }}, {{}});
const layerControl = L.control({{ position: 'topright' }});
layerControl.onAdd = function() {{
  const container = L.DomUtil.create('div', 'control-panel layer-panel');

  const header = document.createElement('div');
  header.className = 'panel-header';
  const title = document.createElement('div');
  title.className = 'panel-title';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'panel-icon';
  iconSpan.innerHTML = '&#128205;';
  const titleText = document.createElement('span');
  titleText.textContent = 'Capas disponibles';
  title.appendChild(iconSpan);
  title.appendChild(titleText);
  header.appendChild(title);
  container.appendChild(header);

  const optionsWrapper = document.createElement('div');
  optionsWrapper.className = 'metric-selector layer-options';
  container.appendChild(optionsWrapper);

  layers.forEach(cfg => {{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'metric-option layer-option active';
    button.dataset.layer = cfg.key;

    const radio = document.createElement('span');
    radio.className = 'metric-radio';
    const label = document.createElement('span');
    label.className = 'metric-label';
    label.textContent = cfg.label;

    button.appendChild(radio);
    button.appendChild(label);
    optionsWrapper.appendChild(button);
  }});

  const searchBox = document.createElement('div');
  searchBox.className = 'search-box';
  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'search-input-wrapper';
  const searchIcon = document.createElement('span');
  searchIcon.className = 'search-icon';
  searchIcon.innerHTML = '&#128269;';
  const searchInputEl = document.createElement('input');
  searchInputEl.type = 'text';
  searchInputEl.className = 'layer-search';
  searchInputEl.placeholder = 'Buscar ubicaci\u00f3n...';
  searchWrapper.appendChild(searchIcon);
  searchWrapper.appendChild(searchInputEl);
  searchBox.appendChild(searchWrapper);
  container.appendChild(searchBox);

  return container;
}};
layerControl.addTo(map);
const controlNode = layerControl.getContainer();
L.DomEvent.disableClickPropagation(controlNode);
L.DomEvent.disableScrollPropagation(controlNode);
const toggleButtons = controlNode.querySelectorAll('.layer-option');
toggleButtons.forEach(btn => {{
  const layerKey = btn.dataset.layer;
  btn.addEventListener('click', () => {{
    const isActive = btn.classList.toggle('active');
    layerState[layerKey] = isActive;
    if (isActive) {{
      map.addLayer(layerGroups[layerKey]);
    }} else {{
      map.removeLayer(layerGroups[layerKey]);
    }}
  }});
}});
const allMarkers = Object.values(markersByLayer).flat();
const searchInput = controlNode.querySelector('.layer-search');
let searchHandle = null;
function applySearch(term) {{
  const query = term.trim().toLowerCase();
  let firstMatch = null;
  if (!query) {{
    allMarkers.forEach(marker => {{
      marker.setStyle({{ fillOpacity: marker._baseOpacity, opacity: 1 }});
    }});
    return;
  }}
  allMarkers.forEach(marker => {{
    const matches = marker._searchText && marker._searchText.includes(query);
    marker.setStyle({{
      fillOpacity: matches ? marker._baseOpacity : marker._dimOpacity,
      opacity: matches ? 1 : 0.45
    }});
    if (!firstMatch && matches && layerState[marker._layerKey]) {{
      firstMatch = marker;
    }}
  }});
  if (firstMatch) {{
    map.setView(firstMatch.getLatLng(), Math.max(map.getZoom(), 8), {{ animate: true }});
    setTimeout(() => firstMatch.openPopup(), 240);
  }}
}}
if (searchInput) {{
  searchInput.addEventListener('input', (event) => {{
    if (searchHandle) clearTimeout(searchHandle);
    const value = event.target.value || '';
    searchHandle = setTimeout(() => applySearch(value), 180);
  }});
}}

try {{
  const coords = data.map(d => [d.lat, d.lon]).filter(v => Array.isArray(v) && !Number.isNaN(v[0]) && !Number.isNaN(v[1]));
  if (coords.length) {{
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, {{ padding: [40, 40], maxZoom: 8 }});
    try {{
      const center = map.getCenter();
      if (center.lng > -40 || center.lng < -90 || center.lat < -10 || center.lat > 15) {{
        map.setView([4.6, -74.1], Math.max(8, map.getZoom()));
      }}
    }} catch (adjustErr) {{
      console.warn('No se pudo ajustar el centro del mapa de campos:', adjustErr);
      map.setView([4.6, -74.1], 8);
    }}
  }} else {{
    map.setView([4.57, -74.3], 7);
  }}
}} catch (err) {{
  console.warn('No fue posible ajustar el zoom del mapa:', err);
  map.setView([4.57, -74.3], 5);
}}
</script></body></html>"""

        ger_html = _generate_map_html(
            _fetch_view("MAP_DATA_MAP"),
            {
                "lat": "GEO_LATITUDE",
                "lon": "GEO_LONGITUDE",
                "vice": "VICE",
                "campo": "campo_top_crudo",
                "crudo": "total_crudo_agosto",
                "blancos": "total_blancos_agosto",
            },
        )

        campo_html = _generate_map_html(
            _fetch_view("MAP_DATA_MAP_CAMPO"),
            {
                "lat": "GEO_LATITUDE",
                "lon": "GEO_LONGITUDE",
                "vice": "VICE",
                "campo": "CAMPO",
                "crudo": "crudo_agosto",
                "blancos": "blancos_agosto",
            },
        )

        variation_df = _fetch_view("MAP_DATA_MAP_VARIACION")
        variation_html = generate_variation_heatmap_html(variation_df) if not variation_df.empty else None

        payload: Dict[str, Any] = {}
        if ger_html:
            payload["map_ger_html"] = ger_html
        if campo_html:
            payload["map_campo_html"] = campo_html
        if variation_html:
            payload["map_variation_html"] = variation_html
        return payload

    def _build_programmed_blancos_table(self) -> Dict[str, Any]:
        """Build table payload for programmed blancos variation."""
        data = self._fetch_programmed_blancos_variation_data()
        if data.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Productos Blancos: Comportamiento Producción vs Meta",
                "chart": None,
            }

        prepared = self._prepare_variation_dataframe(data)
        if prepared.empty:
            return {
                "headers": [],
                "rows": [],
                "title": "Productos Blancos: Comportamiento Producción vs Meta",
                "chart": None,
            }

        if "VAR_PCT" not in prepared.columns and "VAR_PCT_TO_SHOW" in prepared.columns:
            prepared["VAR_PCT"] = prepared["VAR_PCT_TO_SHOW"]

        table_df = prepared.copy()
        drop_columns = {"PRODUCTO", "VAR_PCT_TO_SHOW", "VAR_PCT_CALC", "DELTA_ABS"}
        columns = [
            col for col in table_df.columns if col.strip().upper() not in drop_columns
        ]
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
            "Prog_Sep": "Prog Sep",
            "PROG_SEP": "Prog Sep",
            "Var_Pct": "Variación (%)",
            "VAR_PCT": "Variación (%)",
        }

        headers = [
            {
                "key": column,
                "label": header_labels.get(column, column.replace("_", " ").title()),
            }
            for column in table_df.columns
        ]

        rows = (
            table_df.replace({pd.NA: None})
            .replace({float("nan"): None})
            .to_dict("records")
        )

        chart = None
        if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
            chart_df = prepared[["GERENCIA", "VAR_PCT_TO_SHOW"]].dropna(
                subset=["VAR_PCT_TO_SHOW"]
            )
            if not chart_df.empty:
                values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
                colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
                chart = {
                    "type": "horizontal_bar",
                    "x": values,
                    "y": chart_df["GERENCIA"].astype(str).tolist(),
                    "orientation": "h",
                    "colors": colors,
                    "x_suffix": "%",
                    "x_format": ",.2f",
                    "x_axis_label": "Variación (%)",
                    "y_axis_label": "Gerencia",
                }

        result = {
            "headers": headers,
            "rows": rows,
            "title": "Productos Blancos: Comportamiento Producción vs Meta",
            "chart": chart,
        }

        llm_cols = [
            col
            for col in ["GERENCIA", "Prod_Sept", "Prog_Sep", "VAR_PCT"]
            if col in prepared.columns
        ]
        if llm_cols:
            result["llm_source"] = (
                prepared[llm_cols]
                .rename(
                    columns={
                        "GERENCIA": "Gerencia",
                        "Prod_Sept": "Producción Septiembre",
                        "Prog_Sep": "Prog Sep",
                        "VAR_PCT": "Variación (%)",
                    }
                )
                .to_dict("records")
            )

        if panorama := self._format_programmed_panorama(
            "panorama_general_blancos",
            "Productos Blancos: Producción vs Meta Panorama General",
        ):
            result["panorama_general"] = panorama

        return result
    
    def _build_blancos_analysis_table(self) -> Dict[str, Any]:
        data = self._fetch_blancos_variation_data()

        if data.empty:
            return {"headers": [], "rows": [], "title": "Producción por Tipo", "chart": None}

        prepared = self._prepare_variation_dataframe(data)
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
            {
                "key": column,
                "label": header_labels.get(column, column.replace("_", " ").title()),
            }
            for column in table_df.columns
        ]

        rows = (
            table_df.replace({pd.NA: None})
            .replace({float("nan"): None})
            .to_dict("records")
        )

        chart = None
        if {"GERENCIA", "VAR_PCT_TO_SHOW"}.issubset(prepared.columns):
            chart_df = prepared[["GERENCIA", "VAR_PCT_TO_SHOW"]].dropna(subset=["VAR_PCT_TO_SHOW"])  # type: ignore[index]
            if not chart_df.empty:
                values = chart_df["VAR_PCT_TO_SHOW"].round(2).tolist()
                colors = ["#CCD32A" if value >= 0 else "#FF5F00" for value in values]
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
        }


    def _fetch_monthly_summary_data(self) -> Dict[str, Any]:
        """
        Fetch monthly summary data from RESUMEN_MES table

        Returns:
            Dict with table data including headers and rows
        """
        if not self.db_connection:
            logger.error("No database connection available")
            return {"headers": [], "rows": []}

        query = """
            SELECT
                Segmento,
                Meta_Sept,
                Real_Sept,
                Var_Real,
                Proy_Sept,
                Var_Proy,
                Meta_747,
                Var_Meta_747,
                Reto_755,
                Var_Reto_755,
                Reto_761,
                Var_Reto_761
            FROM RESUMEN_MES
            ORDER BY
                CASE
                    WHEN Segmento = 'ECP SA' THEN 1
                    WHEN Segmento = 'Filiales' THEN 2
                    WHEN Segmento = 'GE Vs Meta' THEN 3
                    ELSE 4
                END
        """

        try:
            logger.info("Fetching monthly summary data from RESUMEN_MES")
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning("No data found in RESUMEN_MES table")
                return {"headers": [], "rows": []}

            # Clean numeric columns that may have tabs and commas
            numeric_columns = [
                "Meta_Sept",
                "Real_Sept",
                "Var_Real",
                "Proy_Sept",
                "Var_Proy",
                "Meta_747",
                "Var_Meta_747",
                "Reto_755",
                "Var_Reto_755",
                "Reto_761",
                "Var_Reto_761",
            ]

            for col in numeric_columns:
                if col in data.columns:
                    # Clean tabs, spaces, and replace comma with dot for decimal separator
                    data[col] = (
                        data[col]
                        .astype(str)
                        .str.strip()
                        .str.replace("\t", "")
                        .str.replace(",", ".")
                    )
                    # Convert to float
                    data[col] = pd.to_numeric(data[col], errors="coerce")

            # Convert DataFrame to dict format for frontend
            headers = [
                {"key": "Segmento", "label": "Segmento"},
                {"key": "Meta_Sept", "label": "Meta Sept"},
                {"key": "Real_Sept", "label": "Real Sept"},
                {"key": "Var_Real", "label": "Var(BOPD)<br/>Real"},
                {"key": "Proy_Sept", "label": "Proy Sept"},
                {"key": "Var_Proy", "label": "Var(%)<br/>Proy"},
                {"key": "Meta_747", "label": "Meta - 747"},
                {"key": "Var_Meta_747", "label": "Var(%)<br/>Meta-747"},
                {"key": "Reto_755", "label": "Reto - 755"},
                {"key": "Var_Reto_755", "label": "Var(%)<br/>Reto-755"},
                {"key": "Reto_761", "label": "Reto - 761"},
                {"key": "Var_Reto_761", "label": "Var(%)<br/>Reto-761"},
            ]

            # Convert rows to list of dicts, replacing NaN with None
            rows = data.replace({float("nan"): None}).to_dict("records")

            analysis_markdown = None
            panorama_general = None
            conclusion_items: List[str] = []
            analysis_table: Optional[Dict[str, Any]] = None
            json_path = (
                Path(__file__).resolve().parents[4] / "resumen" / "Resp_Ollama.json"
            )
            if json_path.exists():
                try:
                    with json_path.open(encoding="utf-8") as json_file:
                        json_payload = json.load(json_file)

                    root = None
                    if isinstance(json_payload, list) and json_payload:
                        root = json_payload[0] if isinstance(json_payload[0], dict) else {}
                    elif isinstance(json_payload, dict):
                        root = json_payload
                    else:
                        root = {}

                    if isinstance(root, dict):
                        raw_analysis = root.get("analysis")
                    if isinstance(raw_analysis, str):
                        analysis_markdown = raw_analysis.strip() or None
                    elif raw_analysis is not None:
                        analysis_markdown = str(raw_analysis).strip() or None
                    else:
                        analysis_markdown = None

                    panorama_general = root.get("panorama_general")
                    if isinstance(panorama_general, str):
                        panorama_general = {
                            "descripcion": panorama_general.strip(),
                            "insights": [],
                        }
                    elif isinstance(panorama_general, dict):
                        if "descripcion" not in panorama_general and "mensaje" in panorama_general:
                            panorama_general = {
                                **panorama_general,
                                "descripcion": panorama_general.get("mensaje"),
                            }
                    else:
                        panorama_general = None

                    raw_conclusion_items = root.get("conclusion_items")
                    if isinstance(raw_conclusion_items, list):
                        conclusion_items = [
                            str(item).strip()
                            for item in raw_conclusion_items
                            if str(item).strip()
                        ]

                    raw_analysis_table = root.get("analysis_table")
                    if isinstance(raw_analysis_table, dict):
                        analysis_table = raw_analysis_table
                except Exception as exc:  # pragma: no cover
                    logger.warning("Unable to load Resp_Ollama.json: %s", exc)
            else:
                logger.info("Resp_Ollama.json not found at %s", json_path)

            charts_payload = None
            try:
                from resumen.analisis_resumen_mes import get_resumen_mes_charts

                charts_payload = get_resumen_mes_charts()
                if charts_payload:
                    logger.info("✅ Resumen Mes charts payload generated.")
                else:
                    logger.warning("Resumen Mes charts payload is empty.")
            except Exception as exc:  # pragma: no cover
                charts_payload = None
                logger.warning("Unable to build Resumen Mes charts: %s", exc)

            logger.info(f"✅ Fetched {len(rows)} rows from RESUMEN_MES")

            if not (
                isinstance(analysis_table, dict)
                and analysis_table.get("headers")
                and analysis_table.get("rows")
            ):
                analysis_table = extract_markdown_table(analysis_markdown) or {
                    "headers": [],
                    "rows": [],
                }

            if not conclusion_items:
                conclusion_items = extract_conclusion_items(analysis_markdown) or []

            return {
                "headers": headers,
                "rows": rows,
                "title": "Resumen Mes",
                "analysis_markdown": analysis_markdown,
                "analysis_html": render_markdown_to_html(analysis_markdown),
                "analysis_table": analysis_table,
                "conclusion_items": conclusion_items,
                "panorama_general": panorama_general,
                "charts": charts_payload,
            }

        except Exception as e:
            logger.error(f"❌ Error fetching monthly summary data: {e}")
            import traceback

            logger.error(f"Traceback: {traceback.format_exc()}")
            return {"headers": [], "rows": []}

    @staticmethod
    def _normalize_ollama_event_date(series: Optional[pd.Series]) -> pd.Series:
        """Normalize EVENT_DATE values from the deferred summary table."""
        if series is None:
            return pd.Series(dtype=object)

        parsed = pd.to_datetime(series, errors="coerce")
        formatted = parsed.dt.strftime("%Y-%m-%d").astype(object)
        formatted[parsed.isna()] = None
        return formatted

    @staticmethod
    def _clean_ollama_comment(value: object) -> Optional[str]:
        """Return a trimmed comment without leading or trailing quotes."""
        if pd.isna(value):
            return None

        text = str(value).strip()
        if not text:
            return None

        text = text.strip("\"'").strip()
        return text or None

    def _fetch_deferred_summary_table(self) -> Dict[str, Any]:
        """Fetch deferred production summaries from RESUMEN_DIFERIDAS_MES_OLLAMA."""
        if not self.db_connection:
            logger.error("No database connection available for deferred summary")
            return {"headers": [], "rows": [], "title": "Resumen diario diferidas reportadas"}

        query = """
            SELECT
                EVENT_DATE,
                POZO_COMMENT
            FROM RESUMEN_DIFERIDAS_MES_OLLAMA
            ORDER BY EVENT_DATE
        """

        try:
            logger.info("Fetching deferred summary data from RESUMEN_DIFERIDAS_MES_OLLAMA")
            data = pd.read_sql_query(query, self.db_connection)

            if data.empty:
                logger.warning("No data found in RESUMEN_DIFERIDAS_MES_OLLAMA")
                return {"headers": [], "rows": [], "title": "Resumen diario diferidas reportadas"}

            if "EVENT_DATE" in data.columns:
                data["EVENT_DATE"] = self._normalize_ollama_event_date(data["EVENT_DATE"])

            if "POZO_COMMENT" in data.columns:
                data["POZO_COMMENT"] = data["POZO_COMMENT"].apply(self._clean_ollama_comment)

            headers = [
                {"key": "EVENT_DATE", "label": "Fecha"},
                {"key": "POZO_COMMENT", "label": "Resumen del día"},
            ]

            rows = data.where(pd.notna(data), None).to_dict("records")

            return {
                "headers": headers,
                "rows": rows,
                "title": "Resumen diario diferidas reportadas",
            }

        except Exception as exc:
            logger.error(f"Error fetching deferred summary data: {exc}")
            import traceback

            logger.error(f"Traceback: {traceback.format_exc()}")
            return {"headers": [], "rows": [], "title": "Resumen diario diferidas reportadas"}

    def _build_frame_cache_key(
        self, traces: List[Dict[str, Any]], x_values: List[str]
    ) -> str:
        """
        Build a compact hash representing the current trace/x configuration.
        """
        try:
            signature = {
                "x": list(x_values),
                "traces": [],
            }
            for trace in traces:
                marker = trace.get("marker", {})
                marker_size = marker.get("size")
                marker_color = marker.get("color")
                if isinstance(marker_size, list):
                    marker_size = list(marker_size)
                if isinstance(marker_color, list):
                    marker_color = list(marker_color)
                signature["traces"].append(
                    {
                        "name": trace.get("name"),
                        "y": list(trace.get("y", [])),
                        "mode": trace.get("mode"),
                        "line": trace.get("line", {}),
                        "marker_size": marker_size,
                        "marker_color": marker_color,
                    }
                )
            raw = json.dumps(signature, ensure_ascii=False, sort_keys=True, default=str)
        except Exception as exc:  # pragma: no cover - fallback hashing
            logger.debug(f"Unable to serialize traces for cache key: {exc}")
            raw = json.dumps(
                {
                    "x_len": len(x_values),
                    "trace_count": len(traces),
                    "y_lengths": [len(trace.get("y", [])) for trace in traces],
                },
                sort_keys=True,
            )

        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    def _add_animation_frames(
        self, traces: List[Dict[str, Any]], x_values: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Añade frames para animación frame por frame (dibujo progresivo)

        Args:
            traces: Lista de traces originales
            x_values: Valores del eje X

        Returns:
            Lista de frames para animación
        """
        cache_key = self._build_frame_cache_key(traces, x_values)
        if cache_key in self._frame_cache:
            cached_frames = self._frame_cache[cache_key]
            logger.info(
                f"🎬 Reutilizando {len(cached_frames)} frames de animación desde caché"
            )
            return cached_frames

        frames: List[Dict[str, Any]] = []
        total_points = len(x_values)

        if total_points == 0:
            return frames

        # Limitar la cantidad total de frames generados para acelerar el render
        max_frames = 10
        step = max(1, (total_points + max_frames - 1) // max_frames)

        def build_frame(point_count: int) -> Dict[str, Any]:
            frame_data = []

            for trace in traces:
                # Copiar trace y truncar datos hasta el punto i
                frame_trace = {
                    "x": trace["x"][:point_count],
                    "y": trace["y"][:point_count],
                    "type": trace["type"],
                    "mode": trace["mode"],
                    "name": trace["name"],
                    "line": trace.get("line", {}),
                    "marker": {},  # Inicializar marker vacío
                }

                # Manejar marker especial para Q_Real (con tamaños y colores variables)
                if "marker" in trace and "size" in trace["marker"]:
                    # Si es una lista (Q_Real con tamaños variables)
                    if isinstance(trace["marker"]["size"], list):
                        frame_trace["marker"]["size"] = trace["marker"]["size"][
                            :point_count
                        ]
                    else:
                        frame_trace["marker"]["size"] = trace["marker"]["size"]

                    # Copiar colores
                    if "color" in trace["marker"]:
                        if isinstance(trace["marker"]["color"], list):
                            frame_trace["marker"]["color"] = trace["marker"]["color"][
                                :point_count
                            ]
                        else:
                            frame_trace["marker"]["color"] = trace["marker"]["color"]

                    # Copiar otras propiedades de marker
                    for key in ["opacity", "line"]:
                        if key in trace["marker"]:
                            frame_trace["marker"][key] = trace["marker"][key]
                else:
                    frame_trace["marker"] = trace.get("marker", {})

                # Copiar metadatos textuales asegurando que se preserven los labels en cada frame
                if "text" in trace:
                    text_values = trace["text"]
                    if isinstance(text_values, list):
                        frame_trace["text"] = text_values[:point_count]
                    else:
                        frame_trace["text"] = text_values
                if "textposition" in trace:
                    frame_trace["textposition"] = trace["textposition"]
                if "textfont" in trace:
                    frame_trace["textfont"] = trace["textfont"]
                if "hovertext" in trace:
                    hover_values = trace["hovertext"]
                    if isinstance(hover_values, list):
                        frame_trace["hovertext"] = hover_values[:point_count]
                    else:
                        frame_trace["hovertext"] = hover_values
                if "hovertemplate" in trace:
                    frame_trace["hovertemplate"] = trace["hovertemplate"]
                if "hoverlabel" in trace:
                    frame_trace["hoverlabel"] = trace["hoverlabel"]
                if "customdata" in trace:
                    custom_values = trace["customdata"]
                    if isinstance(custom_values, list):
                        frame_trace["customdata"] = custom_values[:point_count]
                    else:
                        frame_trace["customdata"] = custom_values

                frame_data.append(frame_trace)

            return {"name": str(point_count), "data": frame_data}

        for i in range(step, total_points + 1, step):
            frames.append(build_frame(i))

        if frames[-1]["name"] != str(total_points):
            frames.append(build_frame(total_points))

        logger.info(f"🎬 Step usado: {step}, frames generados: {len(frames)}")

        self._frame_cache[cache_key] = frames

        return frames

    def _generate_chart_data(
        self, data: pd.DataFrame, config: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Generate Plotly chart data (traces and layout) for frontend rendering

        Args:
            data: DataFrame with production data
            config: Chart configuration from fixed_reports

        Returns:
            Dict with traces, layout, and title for Plotly
        """
        chart_config = (config or {}).get("chart_config", {})
        x_axis_col = chart_config.get("x_axis", "FECHA")
        y_axes_config = chart_config.get("y_axes", [])

        # --- Utilidad para formatear valores: 1k, 250k, 1M, 2B (sin decimales) ---
        def format_k(v, decimals: int = 0):
            if v is None or pd.isna(v):
                return ""
            v = float(v)
            av = abs(v)
            if av >= 1_000_000_000:
                return f"{v/1_000_000_000:.{decimals}f}B" if decimals else f"{v/1_000_000_000:.0f}B"
            if av >= 1_000_000:
                return f"{v/1_000_000:.{decimals}f}M" if decimals else f"{v/1_000_000:.0f}M"
            if av >= 1_000:
                return f"{v/1_000:.{decimals}f}k" if decimals else f"{v/1_000:.0f}k"
            return f"{v:.{decimals}f}" if decimals else f"{v:.0f}"

        # --- Eje X como categoría: fuerza un tick por punto (día a día) ---
        weekdays = [
            "Lunes",
            "Martes",
            "Miércoles",
            "Jueves",
            "Viernes",
            "Sábado",
            "Domingo",
        ]
        months = [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre",
        ]

        def format_hover_date(value: object) -> str:
            """Build long-form date text for tooltips."""
            if pd.isna(value):
                return ""
            try:
                date_value = pd.to_datetime(value)
            except Exception:
                return str(value) if value is not None else ""

            return (
                f"{weekdays[date_value.weekday()]} "
                f"{date_value.day} de {months[date_value.month - 1]} de {date_value.year}"
            )

        if x_axis_col in data.columns:
            x_values = [
                d.strftime("%d-%m") if pd.notna(d) else None for d in data[x_axis_col]
            ]
            hover_dates = [format_hover_date(d) for d in data[x_axis_col]]
        else:
            x_values = list(map(str, range(len(data))))  # fallback
            hover_dates = x_values[:]

        traces: List[Dict[str, Any]] = []

        # Para comparación en Q_Real
        series_qpop = data["Q_POP"] if "Q_POP" in data.columns else None
        qpop_list = (
            series_qpop.tolist() if series_qpop is not None else [None] * len(data)
        )

        # Bloque tipo "tabla" por día (hasta 3 filas por FECHA)
        if all(
            c in data.columns for c in ["CAMPO", "COMENTARIO", "TOTAL_ACEITE_PERDIDO"]
        ):

            def _build_day_block(df_day: pd.DataFrame) -> str:
                df_day = (
                    df_day.assign(
                        CAMPO=df_day["CAMPO"].astype(str).str.strip(),
                        COMENTARIO=df_day["COMENTARIO"].astype(str).str.strip(),
                        TOTAL_ACEITE_PERDIDO=pd.to_numeric(
                            df_day["TOTAL_ACEITE_PERDIDO"], errors="coerce"
                        ),
                    )
                    .groupby(["CAMPO", "COMENTARIO"], as_index=False, dropna=False)
                    .agg({"TOTAL_ACEITE_PERDIDO": "sum"})
                    .sort_values(["CAMPO", "COMENTARIO"])
                )
                rows = []
                # Mostrar hasta 3 registros para más contexto
                for idx, (_, r) in enumerate(df_day.head(3).iterrows(), 1):
                    campo = str(r["CAMPO"]) if pd.notna(r["CAMPO"]) else "N/A"
                    comentario = str(r["COMENTARIO"]) if pd.notna(r["COMENTARIO"]) else "Sin comentario"

                    # Truncar comentarios muy largos para casos extremos
                    if len(comentario) > 80:
                        comentario = comentario[:77] + "..."

                    aceite = (
                        format_k(r["TOTAL_ACEITE_PERDIDO"], decimals=1)
                        if pd.notna(r["TOTAL_ACEITE_PERDIDO"])
                        else "0.0"
                    )

                    row_html = (
                        "<span style='display:block; margin-bottom:6px;'>"
                        f"<span style='display:inline-block; min-width:70px; font-weight:600; color:#2196F3'>{idx}. {campo}</span><br>"
                        f"<span style='display:inline-block; color:#444; white-space:normal; padding-left:12px'>{comentario}</span><br>"
                        f"<span style='display:inline-block; color:#F44336; font-weight:500; padding-left:12px'>Pérdida: {aceite} BOPD</span>"
                        "</span>"
                    )
                    rows.append(row_html)

                if not rows:
                    return ""

                extra_rows = len(df_day) - 3
                header = (
                    "<span style='display:block; color:#FF9800; font-weight:700; font-size:11px; border-bottom:2px solid #FF9800; margin-bottom:4px'>"
                    "Actividad Día:"
                    "</span><br>"
                )
                content = header + "<br>".join(rows)
                if extra_rows > 0:
                    content += (
                        f"<span style='display:block; color:#9E9E9E; font-style:italic; font-size:9px; margin-top:4px'>+{extra_rows} evento(s) mas...</span>"
                    )

                #return f"<span style='display:block; max-width:240px'>{content}</span>"
                return f"<span style='display:block; max-width:480px; white-space:normal; overflow-wrap:break-word;'>{content}</span>"

            day_block = {}
            if "FECHA" in data.columns:
                for day, df_day in data.groupby("FECHA", dropna=False):
                    day_block[day] = _build_day_block(df_day)
                table_blocks = [day_block.get(d, "") for d in data["FECHA"]]
            else:
                table_blocks = ["" for _ in range(len(data))]
        else:
            table_blocks = ["" for _ in range(len(data))]

        # customdata por punto: [tabla_html, fecha_larga]
        customdata_common = [
            [table_blocks[i], hover_dates[i]] for i in range(len(data))
        ]

        skip_columns = {"ECP_META_741", "ECP_META_747", "ECP_META_755"}
        filtered_axes = [
            cfg
            for cfg in y_axes_config
            if cfg.get("column") in data.columns
            and cfg.get("column") not in skip_columns
        ]

        for i, axis_config in enumerate(filtered_axes):
            is_last = i == len(filtered_axes) - 1
            column = axis_config["column"]

            y_values = [(float(v) if pd.notna(v) else None) for v in data[column]]
            base_color = axis_config.get("color", "#1976D2")

            # 🔹 Configuración base (se ajusta más abajo según tipo de variable)
            trace = {
                "x": x_values,
                "y": y_values,
                "name": axis_config.get("name", column),
                "type": "scatter",
                "mode": "lines+markers",
                "line": {
                    "color": base_color,
                    "width": 2,
                    "shape": "spline",  # Línea suavizada para animación fluida
                    "smoothing": 1.0  # Nivel de suavizado
                },
                "marker": {"size": 6},
            }
            trace["customdata"] = [
                ["", hover_dates[idx]] for idx in range(len(hover_dates))
            ]

            # ===== SOLO Q_Real: compara con Q_POP y cambia color/tamaño de marcador =====
            if column == "Q_Real":
                sizes, colors = [], []
                base_color = axis_config.get("color", "#2E7D32")  # verde Q_Real

                for v_real, v_pop in zip(y_values, qpop_list):
                    if v_real is None or v_pop is None:
                        sizes.append(6)
                        colors.append(base_color)
                    elif v_real < v_pop:
                        sizes.append(15)
                        colors.append("#D32F2F")  # rojo si está por debajo de POP
                    else:
                        sizes.append(6)
                        colors.append(base_color)

                customdata_qreal = [
                    [table_blocks[idx], hover_dates[idx]]
                    if sizes[idx] == 15
                    else ["", hover_dates[idx]]
                    for idx in range(len(table_blocks))
                ]

                trace["marker"] = {
                    "size": sizes,
                    "color": colors,
                    "opacity": 1.0,
                    "line": {"width": 1, "color": "#000000"},
                }
                trace["customdata"] = customdata_qreal
                trace.update(
                    {
                        "text": [f"{format_k(v)}" for v in y_values],
                        "textposition": "top center",
                        "textfont": {"size": 9, "color": base_color},
                        "mode": "lines+markers+text",
                    }
                )
                # Evitar texto duplicado en hover unificado y añadir datos extra del dia
                name = axis_config.get("name", column)
                hovertext = [
                    (f"{name} : {format_k(v)}" if v is not None else "")
                    for v in y_values
                ]
                trace["hovertext"] = hovertext
                # Hover profesional y moderno
                trace["hoverlabel"] = {
                    "bgcolor": "rgba(255, 255, 255, 0.97)",
                    "bordercolor": base_color,
                    "font": {
                        "family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
                        "size": 12,
                        "color": "#212121"
                    },
                    "align": "left",
                    "namelength": -1
                }
                trace["hovertemplate"] = (
                    "<span style='color:#757575; text-align:center; font-size:11px'>----------------------📅 %{customdata[1]}--------------------</span><br>"
                    "<b style='font-size:15px; color:" + base_color + "'><span style='color:#1976D2; font-size:13px'><b>Producción_</b></span>%{hovertext}</b><br>"
                    "<span style='display:block; max-width:480px; white-space:normal; overflow-wrap:break-word; margin-top:6px;'>%{customdata[0]}</span>"
                    "<extra></extra>"
                )

            # ===== SOLO Q_POP: labels, sin cambiar marcadores =====
            elif column == "Q_POP":
                trace.update(
                    {
                        "text": [f"{format_k(v)}" for v in y_values],
                        "textposition": "top center",
                        "textfont": {"size": 9, "color": base_color},
                        "mode": "lines+markers+text",
                    }
                )
                # Evitar texto duplicado en hover unificado
                name = axis_config.get("name", column)
                hovertext = [
                    (f"{name} : {format_k(v)}" if v is not None else "")
                    for v in y_values
                ]
                trace["hovertext"] = hovertext
                if is_last:
                    trace["customdata"] = customdata_common
                    # Hover premium con tabla detallada - más compacto
                    trace["hoverlabel"] = {
                        "bgcolor": "rgba(255, 255, 255, 0.97)",
                        "bordercolor": base_color,
                        "font": {
                            "family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace",
                            "size": 9,  # Reducido para casos extremos
                            "color": "#212121"
                        },
                        "align": "left",
                        "namelength": -1
                    }
                    # Formato más compacto con máximo ancho reducido
                    trace["hovertemplate"] = (
                        "<span style='color:#757575; text-align:center; font-size:11px'>----------------------📅 %{customdata[1]}--------------------</span><br>"
                        "<b style='font-size:12px; color:" + base_color + "; max-width:480px; display:block; word-wrap:break-word'><span style='color:#1976D2; font-size:13px'><b>Producción_</b></span>%{hovertext}</b><br>"
                        "<span style='display:block; max-width:480px; white-space:normal; overflow-wrap:break-word; margin-top:6px;'>%{customdata[0]}</span>"
                        "<extra></extra>"
                    )
                else:
                    # Hover para series intermedias
                    trace["hoverlabel"] = {
                        "bgcolor": "rgba(255, 255, 255, 0.97)",
                        "bordercolor": base_color,
                        "font": {
                            "family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
                            "size": 12,
                            "color": "#212121"
                        },
                        "align": "left",
                        "namelength": -1
                    }
                    trace["hovertemplate"] = (
                        "<span style='color:#757575; text-align:center; font-size:11px'>----------------------📅 %{customdata[1]}--------------------</span><br>"
                        "<b style='font-size:15px; color:" + base_color + "'><span style='color:#1976D2; font-size:13px'><b>Producción_</b></span>%{hovertext}</b><br>"
                        "<span style='display:block; max-width:480px; white-space:normal; overflow-wrap:break-word; margin-top:6px;'>%{customdata[0]}</span>"
                        "<extra></extra>"
                    )

            # ===== OTRAS VARIABLES: sin labels, sólo puntos (sin línea) =====
            else:
                trace.update(
                    {
                        "mode": "lines",  # 👈 mantiene la línea, pero será punteada
                        "line": {
                            "color": base_color,
                            "width": 2,
                            "dash": "dot",  # 👈 define que sea una línea punteada
                            "shape": "spline",  # 👈 línea suavizada
                            "smoothing": 1.0  # 👈 nivel de suavizado
                        },
                        # "marker": {
                        #    "size": 6,
                        #    "color": base_color,
                        #    "symbol": "circle",
                        #    "line": {"width": 0.5, "color": "#666666"}
                        # }
                    }
                )
                # Hover consistente sin duplicados; si es la última serie, añadir bloque de detalle
                name = axis_config.get("name", column)
                hovertext = [
                    (f"{name} : {format_k(v)}" if v is not None else "")
                    for v in y_values
                ]
                trace["hovertext"] = hovertext
                if is_last:
                    trace["customdata"] = customdata_common
                    # Hover premium con tabla detallada - más compacto
                    trace["hoverlabel"] = {
                        "bgcolor": "rgba(255, 255, 255, 0.97)",
                        "bordercolor": base_color,
                        "font": {
                            "family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace",
                            "size": 9,  # Reducido para casos extremos
                            "color": "#212121"
                        },
                        "align": "left",
                        "namelength": -1
                    }
                    # Formato más compacto con máximo ancho reducido
                    trace["hovertemplate"] = (
                        "<span style='color:#757575; text-align:center; font-size:11px'>----------------------📅 %{customdata[1]}--------------------</span><br>"
                        "<b style='font-size:12px; color:" + base_color + "; max-width:480px; display:block; word-wrap:break-word'><span style='color:#1976D2; font-size:13px'><b>Producción_</b></span>%{hovertext}</b><br>"
                        "<span style='max-width:220px; display:block; overflow:hidden; word-wrap:break-word; white-space:normal'>%{customdata[0]}</span>"
                        "<span style='display:block; max-width:480px; white-space:normal; overflow-wrap:break-word; margin-top:6px;'>%{customdata[0]}</span>"
                        "<extra></extra>"
                    )
                else:
                    # Hover para otras series
                    trace["hoverlabel"] = {
                        "bgcolor": "rgba(255, 255, 255, 0.97)",
                        "bordercolor": base_color,
                        "font": {
                            "family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
                            "size": 12,
                            "color": "#212121"
                        },
                        "align": "left",
                        "namelength": -1
                    }
                    trace["hovertemplate"] = (
                        "<span style='color:#757575; text-align:center; font-size:11px'>----------------------📅 %{customdata[1]}--------------------</span><br>"
                        "<b style='font-size:15px; color:" + base_color + "'><span style='color:#1976D2; font-size:13px'><b>Producción_</b></span>%{hovertext}</b><br>"
                        "<span style='display:block; max-width:480px; white-space:normal; overflow-wrap:break-word; margin-top:6px;'>%{customdata[0]}</span>"
                        "<extra></extra>"
                    )

            traces.append(trace)

        # --- Layout: leyenda horizontal bajo el título y eje X categórico ---
        layout: Dict[str, Any] = {
            "title": {
                "text": chart_config.get("title", "Desempeño de la Producción (Día)"),
                "font": {"size": 18, "family": "Arial, sans-serif"},
                "x": 0.5,
                "xanchor": "center",
            },
            "xaxis": {
                "title": chart_config.get("x_title", "Fecha"),
                "showgrid": chart_config.get("show_grid", True),
                "gridcolor": "#E0E0E0",
                "type": "category",
                "tickmode": "linear",
                # "tickangle": -45,
                "dtick": 1,
                "tickfont": {
                    "size": 10,
                    "family": "Arial, sans-serif",
                },  # 👈 fuente más pequeña
            },
            "yaxis": {
                "title": chart_config.get("y_title", "Producción (BOPD)"),
                "showgrid": chart_config.get("show_grid", True),
                "gridcolor": "#E0E0E0",
            },
            "legend": {
                "orientation": "h",
                "yanchor": "bottom",
                "y": 1.02,  # debajo del título sin superponer
                "xanchor": "center",
                "x": 0.5,
                "bgcolor": "rgba(255,255,255,0)",
                "bordercolor": "#BDBDBD",
                "borderwidth": 0,
            },
            "hovermode": "closest",  # Hover individual, no "x unified"
            "hoverdistance": 20,  # Distancia de detección del hover
            "plot_bgcolor": "#FAFAFA",
            "paper_bgcolor": "white",
            "margin": {"l": 80, "r": 220, "t": 90, "b": 60},  # Margen derecho más amplio para casos extremos
        }

        # Generar frames de animación (sin controles UI)
        frames = self._add_animation_frames(traces, x_values)

        logger.info(f"🎬 Generados {len(frames)} frames para animación")
        logger.info(f"📊 Total puntos de datos: {len(x_values)}")
        if frames:
            logger.info(f"🔹 Primer frame: {frames[0]['name']}, último: {frames[-1]['name']}")

        return {
            "traces": traces,
            "layout": layout,
            "frames": frames,  # Los frames se reproducen automáticamente al cargar
            "title": chart_config.get("title", "Desempeño de la Producción (Día)"),
        }

    def _get_default_chart_config(self) -> Dict[str, Any]:
        """Get default chart configuration"""
        return {
            "chart_config": {
                "type": "multi_line",
                "x_axis": "FECHA",
                "y_axes": [
                    {"column": "Q_Real", "name": "Q Real", "color": "#2E7D32"},
                    {"column": "Q_POP", "name": "Q POP", "color": "#1976D2"},
                    {
                        "column": "ECP_META_741",
                        "name": "ECP META 741",
                        "color": "#D32F2F",
                    },
                    {
                        "column": "ECP_META_747",
                        "name": "ECP META 747",
                        "color": "#F57C00",
                    },
                    {
                        "column": "ECP_META_755",
                        "name": "ECP META 755",
                        "color": "#7B1FA2",
                    },
                ],
                "title": "Desempeño de la Producción (Día)",
                "x_title": "Fecha",
                "y_title": "Producción (BOPD)",
                "show_legend": True,
                "show_grid": True,
            }
        }

    def create_chart_from_report_config(
        self, report_option_id: str, custom_params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Create chart based on report option ID

        Args:
            report_option_id: ID from fixed_reports options
            custom_params: Optional custom parameters (date ranges, etc.)

        Returns:
            Chart result dictionary
        """
        if report_option_id == "daily_performance":
            start_date = custom_params.get("start_date") if custom_params else None
            end_date = custom_params.get("end_date") if custom_params else None
            config = custom_params.get("config") if custom_params else None

            return self.create_daily_performance_chart(
                start_date=start_date, end_date=end_date, config=config
            )
        elif report_option_id == "monthly_balance":
            config = custom_params.get("config") if custom_params else None
            return self.create_monthly_balance_chart(config=config)
        else:
            return {
                "success": False,
                "error": f"Report option '{report_option_id}' is not yet implemented",
                "chart_html": None,
            }


# Factory function
def create_production_report_chart(
    report_type: str, db_connection=None, custom_params: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Factory function to create production report charts

    Args:
        report_type: Type of report ('daily_performance', etc.)
        db_connection: Database connection
        custom_params: Optional parameters for the chart

    Returns:
        Chart result dictionary
    """
    creator = ProductionReportChartCreator(db_connection)
    return creator.create_chart_from_report_config(report_type, custom_params)


__all__ = ["ProductionReportChartCreator", "create_production_report_chart"]


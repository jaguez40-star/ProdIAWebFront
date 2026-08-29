# -*- coding: utf-8 -*-
"""
Genera el heatmap de variaciones porcentuales a partir de la vista
MAP_DATA_MAP_VARIACION y lo guarda como HTML en el mismo directorio.
"""

from pathlib import Path
import importlib.util
import sqlite3
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT_DIR / "chatbot" / "agents" / "analytics" / "map_variation_heatmap.py"

spec = importlib.util.spec_from_file_location("map_variation_heatmap", MODULE_PATH)
if spec is None or spec.loader is None:
    raise ImportError(f"No se pudo cargar el módulo en {MODULE_PATH}")
map_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(map_module)
generate_variation_heatmap_html = map_module.generate_variation_heatmap_html

DB_PATH = r"E:\APLICACIONES\ProdIA\05112025_chatbot\data\ECP_PROD.db"
VIEW_NAME = "MAP_DATA_MAP_VARIACION"


def main() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        df = pd.read_sql_query(
            f"""
            SELECT
                GERENCIA,
                VAR_PCT_MES,
                VAR_PCT_PROG,
                VAR_PCT_POP,
                GEO_LATITUDE,
                GEO_LONGITUDE
            FROM {VIEW_NAME}
            """,
            conn,
        )

    html = generate_variation_heatmap_html(df)
    if not html:
        raise RuntimeError("No fue posible generar el heatmap; verifique los datos.")

    output = Path(__file__).with_name("map_variacion_colorbar_horizontal.html")
    output.write_text(html, encoding="utf-8")
    print(f"[OK] Mapa generado: {output}")


if __name__ == "__main__":
    main()

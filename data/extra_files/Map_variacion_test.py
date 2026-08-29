# -*- coding: utf-8 -*-
"""
map_variation_heatmap_v02.py

Genera un mapa de calor (heatmap) a partir de la vista
MAP_DATA_MAP_VARIACION ubicada en la base SQLite:
E:\APLICACIONES\ProdIA\05112025_chatbot\data\ECP_PROD.db

Replica la última versión que construimos:
- mapa centrado en Colombia
- capa difusa muy extendida (offset x 3.375)
- centros resaltados
- botón de pantalla completa
- marcadores con tooltip (solo Gerencia y VAR_PCT_POP)
- color de marcador #403833 con punto blanco

Requiere:
    pip install pandas folium

"""

import os
import math
import random
import sqlite3

import pandas as pd
import numpy as np
import folium
from folium.plugins import HeatMap, Fullscreen, MarkerCluster, BeautifyIcon


# ---------------------------------------------------------------------------
# 1. Parámetros de entrada
# ---------------------------------------------------------------------------

DB_PATH = r"E:\APLICACIONES\ProdIA\05112025_chatbot\data\ECP_PROD.db"
VIEW_NAME = "MAP_DATA_MAP_VARIACION"
OUTPUT_HTML = r"E:\APLICACIONES\ProdIA\05112025_chatbot\data\extra_files\heatmap_colombia_custom_marker_403833_notnormalized.html"

# centro del mapa (Bogotá aprox)
MAP_CENTER = [4.7110, -74.0721]
MAP_ZOOM = 6


# ---------------------------------------------------------------------------
# 2. Funciones de ayuda
# ---------------------------------------------------------------------------

def normalize_series_with_clip(s: pd.Series) -> pd.Series:
    """
    Normaliza una serie numérica entre 0 y 1,
    antes la recorta entre p5 y p95 para evitar outliers extremos.
    Si todos los valores son iguales, devuelve 0.5 para todos.
    """
    s = s.astype(float)
    p5 = np.percentile(s, 5)
    p95 = np.percentile(s, 95)
    s_clipped = s.clip(lower=p5, upper=p95)

    min_val = s_clipped.min()
    max_val = s_clipped.max()

    if max_val - min_val == 0:
        return pd.Series([0.5] * len(s), index=s.index)

    return (s_clipped - min_val) / (max_val - min_val)


# ---------------------------------------------------------------------------
# 3. Cargar datos desde SQLite
# ---------------------------------------------------------------------------

def load_data():
    conn = sqlite3.connect(DB_PATH)
    try:
        query = f"SELECT * FROM {VIEW_NAME}"
        df = pd.read_sql(query, conn)
    finally:
        conn.close()
    return df


def main():
    # -----------------------------------------------------------------------
    # 3.1 leer datos
    # -----------------------------------------------------------------------
    df = load_data()

    # esperamos al menos estas columnas:
    # GERENCIA, GEO_LATITUDE, GEO_LONGITUDE, VAR_PCT_POP, VAR_PCT_MES, VAR_PCT_PROG
    required_cols = ["GERENCIA", "GEO_LATITUDE", "GEO_LONGITUDE",
                     "VAR_PCT_POP", "VAR_PCT_MES", "VAR_PCT_PROG"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas en la vista {VIEW_NAME}: {missing}")

    # nos quedamos con las que necesitamos
    df = df[required_cols].dropna(subset=["GEO_LATITUDE", "GEO_LONGITUDE"])

    # -----------------------------------------------------------------------
    # 4. Normalizar las 3 columnas pedidas
    # -----------------------------------------------------------------------
    df["VAR_PCT_POP_norm"] = normalize_series_with_clip(df["VAR_PCT_POP"])
    df["VAR_PCT_MES_norm"] = normalize_series_with_clip(df["VAR_PCT_MES"])
    df["VAR_PCT_PROG_norm"] = normalize_series_with_clip(df["VAR_PCT_PROG"])

    # la que usamos para el heatmap (la que veníamos usando)
    weight_col = "VAR_PCT_POP_norm"

    # -----------------------------------------------------------------------
    # 5. Crear mapa base
    # -----------------------------------------------------------------------
    m = folium.Map(location=MAP_CENTER, zoom_start=MAP_ZOOM)
    Fullscreen(position="topright").add_to(m)

    random.seed(42)

    wide_high = []
    wide_mid = []
    wide_low = []
    center_points = []

    # -----------------------------------------------------------------------
    # 6. Generar puntos difusos y guardar centros
    #    (esto replica exactamente el último mapa que hicimos en la conversación)
    # -----------------------------------------------------------------------
    for _, row in df.iterrows():
        lat_c = float(row["GEO_LATITUDE"])
        lon_c = float(row["GEO_LONGITUDE"])
        w_base = float(row[weight_col])  # valor normalizado 0-1

        # 300 puntos alrededor del centro
        n_points = 300

        # offset base según nivel
        if w_base >= 0.7:
            base_offset = 1.0
        elif w_base >= 0.4:
            base_offset = 0.9
        elif w_base >= 0.25:
            base_offset = 0.8
        else:
            base_offset = 0.7

        # expansión grande (3.375x) para que ocupe buena parte del mapa
        max_offset = base_offset * 3.375

        for _ in range(n_points):
            dlat = random.uniform(-max_offset, max_offset)
            dlon = random.uniform(-max_offset, max_offset)
            lat = lat_c + dlat
            lon = lon_c + dlon

            dist = math.sqrt(dlat ** 2 + dlon ** 2)
            rel = min(1, dist / max_offset)

            # degradado cúbico
            falloff = (1 - rel) ** 3
            w = w_base * falloff
            w = max(0.005, w)

            if w_base >= 0.7:
                wide_high.append([lat, lon, w])
            elif w_base <= 0.3:
                wide_low.append([lat, lon, w])
            else:
                wide_mid.append([lat, lon, w])

        # guardar info del centro para el marcador y el “punto” pequeño
        center_points.append(
            {
                "GERENCIA": row["GERENCIA"],
                "lat": lat_c,
                "lon": lon_c,
                "var_pct_pop": float(row["VAR_PCT_POP"]),
                "norm": w_base,
            }
        )

    # -----------------------------------------------------------------------
    # 7. Gradientes (los mismos que usamos)
    # -----------------------------------------------------------------------
    green_gradient = {
        0.0: "rgba(255,255,255,0)",
        0.25: "#cbeed1",
        0.5: "#8cdda1",
        0.75: "#3ca864",
        1.0: "#006b34",
    }
    red_gradient = {
        0.0: "rgba(255,255,255,0)",
        0.25: "#ffe5e5",
        0.5: "#ff9f9f",
        0.75: "#ff5c5c",
        1.0: "#b30000",
    }
    amber_gradient = {
        0.0: "rgba(255,255,255,0)",
        0.25: "#fff3cf",
        0.5: "#ffdd8a",
        0.75: "#ffb347",
        1.0: "#ff8a1f",
    }

    # -----------------------------------------------------------------------
    # 8. Agregar capas difusas
    # -----------------------------------------------------------------------
    if wide_low:
        HeatMap(
            wide_low,
            radius=30,
            blur=30,
            min_opacity=0.02,
            gradient=red_gradient,
        ).add_to(m)
    if wide_mid:
        HeatMap(
            wide_mid,
            radius=32,
            blur=31,
            min_opacity=0.02,
            gradient=amber_gradient,
        ).add_to(m)
    if wide_high:
        HeatMap(
            wide_high,
            radius=36,
            blur=33,
            min_opacity=0.03,
            gradient=green_gradient,
        ).add_to(m)

    # -----------------------------------------------------------------------
    # 9. Centros marcados con un heatmap pequeño encima
    # -----------------------------------------------------------------------
    sharp_red = []
    sharp_amber = []
    sharp_green = []

    for c in center_points:
        if c["norm"] >= 0.7:
            sharp_green.append([c["lat"], c["lon"], 1.0])
        elif c["norm"] <= 0.3:
            sharp_red.append([c["lat"], c["lon"], 1.0])
        else:
            sharp_amber.append([c["lat"], c["lon"], 1.0])

    if sharp_red:
        HeatMap(
            sharp_red,
            radius=12,
            blur=8,
            min_opacity=0.7,
            gradient=red_gradient,
        ).add_to(m)
    if sharp_amber:
        HeatMap(
            sharp_amber,
            radius=12,
            blur=8,
            min_opacity=0.7,
            gradient=amber_gradient,
        ).add_to(m)
    if sharp_green:
        HeatMap(
            sharp_green,
            radius=12,
            blur=8,
            min_opacity=0.7,
            gradient=green_gradient,
        ).add_to(m)

    # -----------------------------------------------------------------------
    # 10. MarkerCluster con color #403833 y tooltip SIN normalizado
    # -----------------------------------------------------------------------
    marker_cluster = MarkerCluster().add_to(m)

    for c in center_points:
        tooltip_html = (
            f"<b>Gerencia:</b> {c['GERENCIA']}<br>"
            f"<b>VAR_PCT_POP:</b> {c['var_pct_pop']:.2f}"
        )

        icon = BeautifyIcon(
            icon_shape="marker",
            border_color="#403833",
            background_color="#403833",
            text_color="white",
            icon="circle",
            inner_icon_style="font-size:14px;color:white;",
        )

        folium.Marker(
            location=[c["lat"], c["lon"]],
            tooltip=tooltip_html,
            icon=icon,
        ).add_to(marker_cluster)

    # -----------------------------------------------------------------------
    # 11. Guardar HTML
    # -----------------------------------------------------------------------
    # crear carpeta si no existe
    out_dir = os.path.dirname(OUTPUT_HTML)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    m.save(OUTPUT_HTML)
    print(f"Mapa guardado en: {OUTPUT_HTML}")


if __name__ == "__main__":
    main()

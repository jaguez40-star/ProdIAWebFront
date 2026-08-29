#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera un mapa de burbujas con capas (CRUDO/BLANCOS) desde SQLite.
- Lee la vista: MAP_DATA_MAP
- DB por defecto: E:\APLICACIONES\ProdIA\05112025_chatbot\data\ECP_PROD.db
- Salida: HTML con base CartoDB fija y control solo para overlays.
- Popup: "Gerencia: VICE" + "Producción CRUDO (BOPD)" + "Producción Productos BLANCOS (BOPD)"
"""

import sqlite3
import pandas as pd
from pathlib import Path
import json
import argparse

# --- Parámetros por defecto (ajústalos si lo necesitas) ---
DB_PATH_DEFAULT = r"E:\APLICACIONES\ProdIA\05112025_chatbot\data\ECP_PROD.db"
VIEW_NAME_DEFAULT = "MAP_DATA_MAP"
OUT_HTML_DEFAULT = r"E:\APLICACIONES\ProdIA\05112025_chatbot\data\extra_files\mapa_popup_bopd_no_baselayers.html"

def _find_col(df, candidates):
    """Devuelve el nombre real de la columna (case-insensitive) si existe."""
    lower = {c.lower(): c for c in df.columns}
    for c in candidates:
        if c in lower:
            return lower[c]
    return None

def build_map_html(df) -> str:
    """Construye el HTML (Leaflet) del mapa con capas CRUDO/BLANCOS y tooltip personalizado."""
    # Normalizar columnas
    df.columns = [c.strip() for c in df.columns]

    # Detectar columnas clave (soporta mayúsculas/minúsculas)
    lat_col     = _find_col(df, ["geo_latitude","lat","latitude","latitud"])
    lon_col     = _find_col(df, ["geo_longitude","lon","lng","long","longitude","longitud"])
    vice_col    = _find_col(df, ["vice","gerencia","vice_presidencia"])
    crudo_col   = _find_col(df, ["total_crudo_agosto","crudo"])
    blancos_col = _find_col(df, ["total_blancos_agosto","blancos"])

    missing = [n for n,v in {
        "lat/latitude": lat_col,
        "lon/longitude": lon_col,
        "total_crudo_agosto": crudo_col,
        "total_blancos_agosto": blancos_col,
        "VICE/gerencia": vice_col
    }.items() if v is None and n in ("lat/latitude","lon/longitude")]  # lat/lon son obligatorias
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en la vista: {missing}")

    # Asegurar numéricos en métricas
    for c in [crudo_col, blancos_col]:
        if c is not None:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    # Filtrar filas con coordenadas válidas
    dfe = df.dropna(subset=[lat_col, lon_col]).copy()

    # Preparar registros para JS
    recs = []
    for _, r in dfe.iterrows():
        recs.append({
            "lat": float(r[lat_col]),
            "lon": float(r[lon_col]),
            "vice": ("" if vice_col is None or pd.isna(r.get(vice_col, "")) else str(r[vice_col])),
            "crudo": (None if crudo_col is None or pd.isna(r.get(crudo_col, None)) else float(r[crudo_col])),
            "blancos": (None if blancos_col is None or pd.isna(r.get(blancos_col, None)) else float(r[blancos_col])),
        })

    html = f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa burbujas (CRUDO/BLANCOS, sin selector de base)</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{{height:100%;margin:0}}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const data = {json.dumps(recs)};
function maxOf(field){{let m=0;data.forEach(d=>{{if(typeof d[field]==='number') m=Math.max(m,d[field]);}});return m;}}
function radiusArea(v,vmax,rmax=24){{if(!v||v<0||!vmax)return 0;return Math.sqrt(v/vmax)*rmax;}}
const fmt = new Intl.NumberFormat('es-CO', {{ maximumFractionDigits: 0 }});

// Base fija (sin incluirla en el control)
const map = L.map('map').setView([4.57,-74.3],5);
L.tileLayer('https://{{s}}.basemaps.cartocdn.com/light_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{
  attribution: '&copy; OpenStreetMap &copy; CARTO'
}}).addTo(map);

// Capas de burbujas
const overlays={{}};
const capas=[
  {{ campo:'crudo',   color:'#e41a1c', nombre:'Producción CRUDO (BOPD)' }},
  {{ campo:'blancos', color:'#377eb8', nombre:'Producción Productos BLANCOS (BOPD)' }}
];

capas.forEach((cfg, idx)=>{{
  const g=L.layerGroup();
  const vmax=maxOf(cfg.campo);
  data.forEach(d=>{{
    const v=d[cfg.campo]; const rad=radiusArea(v, vmax); if(rad<=0) return;
    const popup = `
      <i>Gerencia: ${{d.vice || 'N/D'}}</i><br>
      Producción CRUDO (BOPD): ${{d.crudo!=null ? fmt.format(d.crudo) : 'N/D'}}<br>
      Producción Productos BLANCOS (BOPD): ${{d.blancos!=null ? fmt.format(d.blancos) : 'N/D'}}
    `;
    L.circleMarker([d.lat,d.lon],{{radius:rad,color:cfg.color,weight:0,fillOpacity:0.6}})
      .bindPopup(popup).addTo(g);
  }});
  overlays[cfg.nombre+' (burbujas)']=g;
}});

// Encender ambas y agregar control solo de overlays
overlays[Object.keys(overlays)[0]].addTo(map);
overlays[Object.keys(overlays)[1]].addTo(map);
L.control.layers(null, overlays, {{ collapsed:false }}).addTo(map);
</script></body></html>"""
    return html

def main(db_path: str, view_name: str, out_html: str):
    # Conexión SQLite y lectura de vista
    con = sqlite3.connect(db_path)
    try:
        df = pd.read_sql(f"SELECT * FROM {view_name}", con)
    finally:
        con.close()

    html = build_map_html(df)

    # Guardar HTML
    out_path = Path(out_html)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    print(f"OK: mapa generado en {out_path}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generar mapa (CRUDO/BLANCOS) desde SQLite -> HTML")
    ap.add_argument("--db", default=DB_PATH_DEFAULT, help="Ruta al archivo SQLite (*.db)")
    ap.add_argument("--view", default=VIEW_NAME_DEFAULT, help="Nombre de la vista a consultar")
    ap.add_argument("--out", default=OUT_HTML_DEFAULT, help="Ruta del HTML de salida")
    args = ap.parse_args()

    main(args.db, args.view, args.out)

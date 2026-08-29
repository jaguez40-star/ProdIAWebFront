#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera un mapa de burbujas por CAMPO desde SQLite.
- Origen: vista MAP_DATA_MAP_CAMPO en la BD SQLite indicada.
- Por defecto lee: E:\APLICACIONES\ProdIA\05112025_chatbot\data\ECP_PROD.db
- Salida por defecto: E:\APLICACIONES\ProdIA\05112025_chatbot\data\extra_files\mapa_VICE_CAMPO_bopd_tooltip.html

Características (igual al último mapa entregado):
- Capa base CartoDB fija (sin selector de base).
- Dos overlays de burbujas:
    * Producción CRUDO (BOPD)  -> total_crudo_agosto
    * Producción Productos BLANCOS (BOPD) -> total_blancos_agosto
- Tooltip:
    Campo: <CAMPO>
    Gerencia: <VICE>
    Producción CRUDO (BOPD): <valor>
    Producción Productos BLANCOS (BOPD): <valor>
"""

import sqlite3
import pandas as pd
from pathlib import Path
import json
import argparse

DB_PATH_DEFAULT   = r"E:\APLICACIONES\ProdIA\05112025_chatbot\data\ECP_PROD.db"
VIEW_NAME_DEFAULT = "MAP_DATA_MAP_CAMPO"
OUT_HTML_DEFAULT  = r"E:\APLICACIONES\ProdIA\05112025_chatbot\data\extra_files\mapa_VICE_CAMPO_bopd_tooltip.html"

def _find_col(df, candidates):
    low = {c.lower(): c for c in df.columns}
    for c in candidates:
        if c in low:
            return low[c]
    return None

def _coerce_numeric(df, cols):
    for c in cols:
        if c and c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

def build_map_html(df) -> str:
    df.columns = [c.strip() for c in df.columns]

    lat_col   = _find_col(df, ["geo_latitude","lat","latitude","latitud"])
    lon_col   = _find_col(df, ["geo_longitude","lon","lng","long","longitude","longitud"])
    vice_col  = _find_col(df, ["vice","gerencia","vice_presidencia"])
    campo_col = _find_col(df, ["campo","campo_top_crudo","field_name"])
    crudo_col = _find_col(df, ["total_crudo_agosto","crudo_agosto","crudo"])
    blan_col  = _find_col(df, ["total_blancos_agosto","blancos_agosto","blancos"])

    # Validaciones mínimas
    if not lat_col or not lon_col:
        raise ValueError("Faltan columnas de coordenadas (GEO_LATITUDE/GEO_LONGITUDE).")
    if not crudo_col and not blan_col:
        raise ValueError("No se encontraron columnas de métricas (total_crudo_agosto / total_blancos_agosto).")
    if not campo_col:
        campo_col = ""  # opcional
    if not vice_col:
        vice_col = ""   # opcional

    _coerce_numeric(df, [crudo_col, blan_col])

    dfe = df.dropna(subset=[lat_col, lon_col]).copy()

    # Registros para JS
    recs = []
    for _, r in dfe.iterrows():
        recs.append({
            "lat": float(r[lat_col]),
            "lon": float(r[lon_col]),
            "campo": "" if not campo_col or pd.isna(r.get(campo_col, "")) else str(r[campo_col]),
            "vice": "" if not vice_col  or pd.isna(r.get(vice_col,  "")) else str(r[vice_col]),
            "crudo": None if not crudo_col or pd.isna(r.get(crudo_col, None)) else float(r[crudo_col]),
            "blancos": None if not blan_col or pd.isna(r.get(blan_col, None)) else float(r[blan_col]),
        })

    html = f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa por CAMPO – Producción CRUDO/BLANCOS (BOPD)</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{{height:100%;margin:0}}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const data = {json.dumps(recs)};
function maxOf(field){{let m=0;data.forEach(d=>{{if(typeof d[field]==='number') m=Math.max(m,d[field]);}});return m;}}
function radiusArea(v,vmax,rmax=24){{if(!v||v<0||!vmax)return 0;return Math.sqrt(v/vmax)*rmax;}}
const fmt0 = new Intl.NumberFormat('es-CO', {{ maximumFractionDigits: 0 }});

// Base fija (sin selector de base)
const map=L.map('map').setView([4.57,-74.3],5);
L.tileLayer('https://{{s}}.basemaps.cartocdn.com/light_all/{{z}}/{{x}}/{{y}}{{r}}.png',{{attribution:'&copy; OpenStreetMap &copy; CARTO'}}).addTo(map);

// Overlays: CRUDO y BLANCOS
const overlays={{}};
const layers=[
  {{ key:'crudo',   label:'Producción CRUDO (BOPD)', color:'#e41a1c' }},
  {{ key:'blancos', label:'Producción Productos BLANCOS (BOPD)', color:'#377eb8' }}
];

layers.forEach((cfg, idx)=>{{
  const g=L.layerGroup();
  const vmax=maxOf(cfg.key);
  data.forEach(d=>{{
    const v=d[cfg.key];
    const rad=radiusArea(v, vmax);
    if (rad<=0) return;
    const popup = `
      <b>Campo:</b> ${{d.campo || 'N/D'}}<br>
      <i>Gerencia: ${{d.vice || 'N/D'}}</i><br>
      Producción CRUDO (BOPD): ${{d.crudo!=null ? fmt0.format(d.crudo) : 'N/D'}}<br>
      Producción Productos BLANCOS (BOPD): ${{d.blancos!=null ? fmt0.format(d.blancos) : 'N/D'}}
    `;
    L.circleMarker([d.lat,d.lon],{{radius:rad,color:cfg.color,weight:0,fillOpacity:0.6}})
      .bindPopup(popup).addTo(g);
  }});
  overlays[cfg.label+' (burbujas)']=g;
}});

// Encender ambas y control solo de overlays
Object.values(overlays).forEach(g => g.addTo(map));
L.control.layers(null, overlays, {{ collapsed:false }}).addTo(map);
</script></body></html>"""
    return html

def main(db_path: str, view_name: str, out_html: str):
    con = sqlite3.connect(db_path)
    try:
        df = pd.read_sql(f"SELECT * FROM {view_name}", con)
    finally:
        con.close()

    html = build_map_html(df)

    out_path = Path(out_html)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    print(f"OK: mapa generado en {out_path}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generar mapa por CAMPO (CRUDO/BLANCOS en BOPD) desde SQLite -> HTML")
    ap.add_argument("--db",   default=DB_PATH_DEFAULT,   help="Ruta al archivo SQLite (*.db)")
    ap.add_argument("--view", default=VIEW_NAME_DEFAULT, help="Nombre de la vista a consultar")
    ap.add_argument("--out",  default=OUT_HTML_DEFAULT,  help="Ruta del HTML de salida")
    args = ap.parse_args()
    main(args.db, args.view, args.out)

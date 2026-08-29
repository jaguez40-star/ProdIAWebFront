"""
Renderiza el mapa "MAPA CENTRO" replicando la presentación avanzada del
heatmap de variaciones porcentuales (barra horizontal, selector de métricas,
dos capas para valores positivos y negativos) y respetando los datos reales
provenientes de MAP_DATA_MAP_VARIACION.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

import numpy as np
import pandas as pd


DEFAULT_OUTPUT = (
    Path(__file__).resolve().parent / "extra_files" / "map_centro_heatmap.html"
)
DB_PATH = Path(__file__).resolve().parent / "ECP_PROD.db"
VIEW_NAME = "MAP_DATA_MAP_VARIACION"

# Ajusta la densidad/forma de cada hotspot sin alterar los pesos reales.
SYNTHETIC_POINTS_PER_CENTER = 100
SYNTHETIC_JITTER_DEGREES = 0.08


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (float, int)):
        return float(value)
    try:
        return float(value)
    except Exception:
        return None


def load_map_centro_dataset() -> pd.DataFrame:
    """
    Carga el dataset oficial del mapa desde SQLite sin modificar los valores.
    """
    if not DB_PATH.exists():
        raise FileNotFoundError(f"No se encontró la base de datos: {DB_PATH}")

    with sqlite3.connect(DB_PATH) as conn:
        df = pd.read_sql_query(
            """
            SELECT
                GERENCIA,
                VAR_PCT_MES,
                VAR_PCT_MES_weight,
                VAR_PCT_PROG,
                VAR_PCT_POP,
                GEO_LATITUDE,
                GEO_LONGITUDE
            FROM MAP_DATA_MAP_VARIACION
            WHERE VAR_PCT_MES IS NOT NULL
              AND GEO_LATITUDE IS NOT NULL
            """,
            conn,
        )

    required = [
        "GERENCIA",
        "VAR_PCT_MES",
        "VAR_PCT_PROG",
        "VAR_PCT_POP",
        "GEO_LATITUDE",
        "GEO_LONGITUDE",
    ]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Columnas faltantes en {VIEW_NAME}: {missing}")

    return df


def _row_to_point(row: pd.Series) -> Dict[str, Any]:
    return {
        "lat": float(row["GEO_LATITUDE"]),
        "lon": float(row["GEO_LONGITUDE"]),
        "ger": str(row.get("GERENCIA") or ""),
        "mes": _to_float(row.get("VAR_PCT_MES")),
        "prog": _to_float(row.get("VAR_PCT_PROG")),
        "pop": _to_float(row.get("VAR_PCT_POP")),
    }


def _generate_synthetic_cluster(
    point: Dict[str, Any],
    *,
    count: int,
    jitter: float,
    seed: int,
) -> List[Dict[str, Any]]:
    """
    Crea puntos artificiales alrededor de un centro manteniendo las métricas.
    """
    if count <= 0 or jitter <= 0:
        return []

    lat, lon = point["lat"], point["lon"]
    rng = np.random.default_rng(seed)
    offsets = rng.normal(loc=0.0, scale=jitter, size=(count, 2))

    clones: List[Dict[str, Any]] = []
    for dlat, dlon in offsets:
        clone = dict(point)
        clone["lat"] = lat + float(dlat)
        clone["lon"] = lon + float(dlon)
        clones.append(clone)
    return clones


def _dataframe_to_points(
    df: pd.DataFrame,
    *,
    include_synthetics: bool,
) -> List[Dict[str, Any]]:
    filtered = df.dropna(subset=["GEO_LATITUDE", "GEO_LONGITUDE"]).copy()
    if filtered.empty:
        return []

    points: List[Dict[str, Any]] = []
    for idx, row in filtered.iterrows():
        base = _row_to_point(row)
        points.append(base)
        if include_synthetics:
            points.extend(
                _generate_synthetic_cluster(
                    base,
                    count=SYNTHETIC_POINTS_PER_CENTER,
                    jitter=SYNTHETIC_JITTER_DEGREES,
                    seed=idx,
                )
            )
    return points


def _compute_bounds(points: Sequence[Dict[str, Any]]) -> List[List[float]]:
    if not points:
        # Bounding box general sobre Colombia
        return [[-5.0, -83.0], [14.0, -66.0]]

    lats = [p["lat"] for p in points]
    lons = [p["lon"] for p in points]
    south, north = min(lats), max(lats)
    west, east = min(lons), max(lons)
    pad_lat = max(0.6, (north - south) * 0.25)
    pad_lon = max(0.6, (east - west) * 0.25)
    return [[south - pad_lat, west - pad_lon], [north + pad_lat, east + pad_lon]]


def _build_heatmap_html(
    points: Sequence[Dict[str, Any]],
    bounds: Sequence[Sequence[float]],
) -> str:
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MAPA CENTRO — Variación %</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<style>
  html,body,#map{{height:100%;margin:0}}
  .panel{{position:absolute;z-index:1000;right:12px;top:12px;background:#fff;border-radius:8px;
         padding:10px 12px;box-shadow:0 1px 4px rgba(0,0,0,.25);
         font:12px system-ui,Segoe UI,Roboto,Arial; width:220px}}
  .panel label{{display:block;margin:4px 0}}
  .legend{{position:absolute;left:12px;bottom:72px;background:#fff;padding:10px 12px;border-radius:8px;
          box-shadow:0 1px 4px rgba(0,0,0,.25);font:12px system-ui,Segoe UI,Roboto,Arial}}
  .sw{{display:inline-block;width:16px;height:10px;margin-right:6px;border-radius:2px}}

  .hbar-wrap{{position:absolute;left:50%;transform:translateX(-50%);bottom:14px;z-index:1000;
             background:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.25);
             font:12px system-ui,Segoe UI,Roboto,Arial;min-width:520px}}
  .hbar{{height:16px;border-radius:8px;border:1px solid rgba(0,0,0,.25);
        background: linear-gradient(to right,
           #8b0000 0%,
           #e24a33 20%,
           #ff9d74 35%,
           #ffffff 50%,
           #6ede8a 65%,
           #23b04a 80%,
           #006400 100%);}}
  .ticksX{{display:flex;justify-content:space-between;margin-top:6px}}
  .ticklbl{{font-size:11px;color:#333}}
</style>
</head>
<body>
<div id="map"></div>

<div class="panel">
  <div style="font-weight:600;margin-bottom:6px">Métrica a resaltar</div>
  <label><input type="radio" name="metric" value="mes" checked> VAR_PCT_MES</label>
  <label><input type="radio" name="metric" value="prog"> VAR_PCT_PROG</label>
  <label><input type="radio" name="metric" value="pop"> VAR_PCT_POP</label>
</div>

<div class="legend" id="legend"></div>

<div class="hbar-wrap">
  <div style="text-align:center;margin-bottom:4px;font-weight:600">Escala Variación %</div>
  <div class="hbar"></div>
  <div class="ticksX">
    <span class="ticklbl" id="tmin">-10</span>
    <span class="ticklbl" id="tq1">-7.5</span>
    <span class="ticklbl" id="tq2">-5</span>
    <span class="ticklbl" id="tq3">-2.5</span>
    <span class="ticklbl" id="tzero">0</span>
    <span class="ticklbl" id="tq5">+2.5</span>
    <span class="ticklbl" id="tq6">+5</span>
    <span class="ticklbl" id="tq7">+7.5</span>
    <span class="ticklbl" id="tmax">+10</span>
  </div>
</div>

<script>
const PTS = {json.dumps(points, ensure_ascii=False)};
const boundsPts = {json.dumps(bounds)};

let metric='mes';
let heatPos=null, heatNeg=null;
let auraLayer=null;

const map=L.map('map').fitBounds(boundsPts);
const mapNode=document.getElementById('map');
L.tileLayer('https://{{s}}.basemaps.cartocdn.com/light_all/{{z}}/{{x}}/{{y}}{{r}}.png',
            {{attribution:'&copy; OpenStreetMap &copy; CARTO'}}).addTo(map);

const gradPos = {{0.0:'#c8f7d3', 0.35:'#6ede8a', 0.7:'#23b04a', 1.0:'#006400'}};
const gradNeg = {{0.0:'#ffe0db', 0.35:'#ff9d74', 0.7:'#e24a33', 1.0:'#8b0000'}};

function value(p){{
  if(metric==='mes') return p.mes;
  if(metric==='prog') return p.prog;
  return p.pop;
}}

function updateTicks(maxAbs){{
  function fmt(v){{
    const a=Math.abs(v);
    if(a>=10) return Math.round(v);
    return (Math.round(v*10)/10).toFixed(1);
  }}
  document.getElementById('tmin').textContent='-'+fmt(maxAbs);
  document.getElementById('tq1').textContent='-'+fmt(maxAbs*0.75);
  document.getElementById('tq2').textContent='-'+fmt(maxAbs*0.5);
  document.getElementById('tq3').textContent='-'+fmt(maxAbs*0.25);
  document.getElementById('tzero').textContent='0';
  document.getElementById('tq5').textContent='+'+fmt(maxAbs*0.25);
  document.getElementById('tq6').textContent='+'+fmt(maxAbs*0.5);
  document.getElementById('tq7').textContent='+'+fmt(maxAbs*0.75);
  document.getElementById('tmax').textContent='+'+fmt(maxAbs);
}}

function renderHeat(){{
  map.invalidateSize();
  const size = map.getSize();
  if(size.x === 0 || size.y === 0){{
    waitForVisible(renderHeat);
    return;
  }}
  const vals=PTS.map(p=>value(p)).filter(v=>Number.isFinite(v));
  const maxAbs=Math.max(1,...vals.map(v=>Math.abs(v)));
  updateTicks(maxAbs);

  function weight(v){{
    const w=Math.min(1, Math.abs(v)/maxAbs);
    return Math.pow(w,0.6);
  }}

  const pos=PTS.filter(p=>Number.isFinite(value(p)) && value(p)>0)
               .map(p=>[p.lat,p.lon,weight(value(p))]);
  const neg=PTS.filter(p=>Number.isFinite(value(p)) && value(p)<0)
               .map(p=>[p.lat,p.lon,weight(value(p))]);

  if(heatPos) map.removeLayer(heatPos);
  if(heatNeg) map.removeLayer(heatNeg);

  heatNeg=L.heatLayer(neg, {{radius:46, blur:18, maxZoom:10, gradient:gradNeg, minOpacity:0.62}}).addTo(map);
  heatPos=L.heatLayer(pos, {{radius:46, blur:18, maxZoom:10, gradient:gradPos, minOpacity:0.62}}).addTo(map);

  if(auraLayer) map.removeLayer(auraLayer);
  auraLayer = L.layerGroup().addTo(map);

  PTS.filter(p=>Number.isFinite(value(p))).forEach(p=>{{
    const val = value(p);
    const positive = val >= 0;
    const coreColor = positive ? '#0B5B17' : '#5B0B0B';
    const haloColor = positive ? 'rgba(12,143,32,0.45)' : 'rgba(160,16,16,0.45)';

    L.circle([p.lat, p.lon], {{
      radius: 12000,
      color: '#00000000',
      fillColor: haloColor,
      fillOpacity: 0.75,
      stroke: false
    }}).addTo(auraLayer);

    L.circleMarker([p.lat, p.lon], {{
      radius: 6,
      weight: 2,
      color: '#ffffff',
      fillColor: coreColor,
      fillOpacity: 0.95
    }}).addTo(auraLayer)
      .bindTooltip(
        `<strong>${{p.ger}}</strong><br>${{metric.toUpperCase()}}: ${{val.toFixed(2)}}`,
        {{direction:'top', sticky:true}}
      );
  }});
}}

document.querySelectorAll('input[name=\"metric\"]').forEach(r=>r.addEventListener('change',
  e=>{{ metric=e.target.value; renderHeat(); }}));

document.getElementById('legend').innerHTML =
  '<div><span class=\"sw\" style=\"background:#8b0000\"></span>Negativa</div>' +
  '<div><span class=\"sw\" style=\"background:#006400\"></span>Positiva</div>';

function waitForVisible(callback, attempts=0){{
  const width = mapNode.offsetWidth;
  const height = mapNode.offsetHeight;
  if(width > 0 && height > 0){{
    requestAnimationFrame(callback);
    return;
  }}
  if(attempts > 120){{
    console.warn('MAPA CENTRO: contenedor sin dimensiones tras múltiples intentos.');
    return;
  }}
  requestAnimationFrame(()=>waitForVisible(callback, attempts+1));
}}

function initializeHeat(){{
  waitForVisible(() => {{
    map.invalidateSize();
    renderHeat();
  }});
}}

initializeHeat();
map.on('load', renderHeat);
map.on('resize', renderHeat);
</script>
</body>
</html>
"""


def _generate_demo_points() -> List[Dict[str, Any]]:
    rng = np.random.default_rng(42)
    base_lat, base_lon = 7.3, -73.45
    lats = rng.normal(loc=base_lat, scale=0.6, size=6)
    lons = rng.normal(loc=base_lon, scale=0.6, size=6)
    values = rng.normal(loc=0.0, scale=2.5, size=6)

    demo: List[Dict[str, Any]] = []
    for lat, lon, val in zip(lats, lons, values):
        point = {
            "lat": float(lat),
            "lon": float(lon),
            "ger": "DEMO",
            "mes": float(val),
            "prog": float(val * 0.7),
            "pop": float(val * 1.1),
        }
        demo.append(point)
        demo.extend(
            _generate_synthetic_cluster(
                point,
                count=SYNTHETIC_POINTS_PER_CENTER,
                jitter=SYNTHETIC_JITTER_DEGREES,
                seed=int(lat * 1000),
            )
        )
    return demo


def get_heatmap_points(use_real_data: bool = True) -> List[Dict[str, Any]]:
    """
    Devuelve los puntos (con o sin sintéticos) listos para el heatmap.
    """
    if not use_real_data:
        return _generate_demo_points()

    dataset = load_map_centro_dataset()
    points = _dataframe_to_points(dataset, include_synthetics=True)
    return points or _generate_demo_points()


def generate_map_centro_html(
    save_path: Optional[Path] = DEFAULT_OUTPUT,
    *,
    use_real_data: bool = True,
) -> str:
    """
    Construye el HTML final del mapa y opcionalmente lo guarda en disco.
    """
    if use_real_data:
        dataset = load_map_centro_dataset()
        base_points = _dataframe_to_points(dataset, include_synthetics=False)
        points = _dataframe_to_points(dataset, include_synthetics=True)
        if not points:
            points = _generate_demo_points()
            base_points = points
    else:
        points = _generate_demo_points()
        base_points = points

    bounds = _compute_bounds(base_points)
    html = _build_heatmap_html(points, bounds)

    if save_path is not None:
        save_path = Path(save_path)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_text(html, encoding="utf-8")

    return html


if __name__ == "__main__":
    output_path = DEFAULT_OUTPUT
    generate_map_centro_html(output_path)
    print(f"Mapa de ejemplo guardado en: {output_path}")

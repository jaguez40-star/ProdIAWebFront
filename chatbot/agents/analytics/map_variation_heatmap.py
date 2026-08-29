"""Utilities to build the production variation heatmap HTML."""

from __future__ import annotations

import json
import base64
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd


REQUIRED_COLUMNS = {
    "GERENCIA": "gerencia",
    "VAR_PCT_MES": "var_pct_mes",
    "VAR_PCT_PROG": "var_pct_prog",
    "VAR_PCT_POP": "var_pct_pop",
    "GEO_LATITUDE": "geo_latitude",
    "GEO_LONGITUDE": "geo_longitude",
}

_ICON_PATH = Path(__file__).resolve().parents[3] / "data" / "extra_files" / "prodia_icon_512.png"
try:
    _PANEL_ICON_SRC = base64.b64encode(_ICON_PATH.read_bytes()).decode("ascii")
except Exception:
    _PANEL_ICON_SRC = ""


def _normalize_columns(df: pd.DataFrame) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    for source_name in REQUIRED_COLUMNS:
        alias = next(
            (col for col in df.columns if col.lower() == source_name.lower()),
            None,
        )
        if alias:
            normalized[source_name] = alias
    return normalized


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (float, int)):
        return float(value)
    try:
        return float(value)
    except Exception:
        return None


def _dataframe_to_points(df: pd.DataFrame) -> List[Dict[str, Any]]:
    mapping = _normalize_columns(df)
    lat_col = mapping.get("GEO_LATITUDE")
    lon_col = mapping.get("GEO_LONGITUDE")

    if not lat_col or not lon_col:
        return []

    cleaned = df.dropna(subset=[lat_col, lon_col]).copy()
    if cleaned.empty:
        return []

    points: List[Dict[str, Any]] = []
    for _, row in cleaned.iterrows():
        lat = _to_float(row[lat_col])
        lon = _to_float(row[lon_col])
        if lat is None or lon is None:
            continue

        point: Dict[str, Any] = {"lat": lat, "lon": lon}
        point["ger"] = str(row.get(mapping.get("GERENCIA"), "") or "")
        point["mes"] = _to_float(row.get(mapping.get("VAR_PCT_MES")))
        point["prog"] = _to_float(row.get(mapping.get("VAR_PCT_PROG")))
        point["pop"] = _to_float(row.get(mapping.get("VAR_PCT_POP")))
        points.append(point)
    return points


def _compute_bounds(points: Sequence[Dict[str, Any]]) -> List[List[float]]:
    if not points:
        return [[-5.0, -83.0], [14.0, -66.0]]

    lats = [p["lat"] for p in points]
    lons = [p["lon"] for p in points]
    south, north = min(lats), max(lats)
    west, east = min(lons), max(lons)
    pad_lat = max(0.6, (north - south) * 0.25)
    pad_lon = max(0.6, (east - west) * 0.25)
    return [[south - pad_lat, west - pad_lon], [north + pad_lat, east + pad_lon]]


def _build_heatmap_html(points: Sequence[Dict[str, Any]], bounds: Sequence[Sequence[float]]) -> str:
    panel_icon_markup = (
        f'<img class="panel-icon" src="data:image/png;base64,{_PANEL_ICON_SRC}" alt="ProdIA icon" />'
        if _PANEL_ICON_SRC
        else '<span class="panel-icon">📊</span>'
    )
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa de Calor - Variación de Producción</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet.fullscreen@latest/Control.FullScreen.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<script src="https://unpkg.com/leaflet.fullscreen@latest/Control.FullScreen.js"></script>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body, #map {{ height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }}

  .loader {{
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }}
  .loader-spinner {{
    width: 48px; height: 48px; border: 4px solid rgba(0, 123, 255, 0.1);
    border-top-color: #007bff; border-radius: 50%; animation: spin 0.8s linear infinite;
  }}
  @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
  .loader-text {{ color: #333; font-size: 14px; font-weight: 500; }}
  .loader.hidden {{ display: none; }}

  .control-panel {{
    position: absolute; top: 20px; right: 20px; z-index: 1000;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border-radius: 12px; padding: 20px; width: 280px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }}
  .control-panel:hover {{ box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15); }}

  .panel-header {{
    display: flex; align-items: center; gap: 10px;
    font-size: 16px; font-weight: 700; color: #1a1a1a;
    margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e9ecef;
  }}
  .panel-header .panel-icon {{
    width: 55px; height: 55px; border-radius: 14px;
    object-fit: cover; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
  }}

  .metric-selector {{ display: flex; flex-direction: column; gap: 10px; }}

  .metric-option {{
    position: relative; cursor: pointer; padding: 12px 16px; border-radius: 8px;
    background: #ffffff; border: 2px solid #e9ecef; transition: all 0.2s ease;
    display: flex; align-items: center; gap: 12px;
  }}
  .metric-option:hover {{
    border-color: #CCD32A; background: rgba(204, 211, 42, 0.12); transform: translateX(4px);
  }}
  .metric-option.active {{
    border-color: #CCD32A; background: linear-gradient(135deg, #CCD32A 0%, #A6B021 100%);
    color: #ffffff; box-shadow: 0 4px 12px rgba(204, 211, 42, 0.35);
  }}
  .metric-option input[type="radio"] {{ display: none; }}

  .metric-radio {{
    width: 20px; height: 20px; border: 2px solid #dee2e6; border-radius: 50%;
    position: relative; flex-shrink: 0; transition: all 0.2s ease; display: block;
  }}
  .metric-option.active .metric-radio {{ border-color: #ffffff; background: #ffffff; }}
  .metric-option.active .metric-radio::after {{
    content: ''; position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%); display: block;
    width: 10px; height: 10px; background: #CCD32A; border-radius: 50%;
  }}
  .metric-label {{ font-size: 13px; font-weight: 500; flex: 1; }}

  .search-box {{ margin-top: 16px; padding-top: 16px; border-top: 2px solid #e9ecef; }}
  .search-input {{
    width: 100%; padding: 10px 12px; border: 2px solid #e9ecef; border-radius: 8px;
    font-size: 13px; transition: all 0.2s ease;
  }}
  .search-input:focus {{
    outline: none; border-color: #CCD32A; box-shadow: 0 0 0 3px rgba(204, 211, 42, 0.2);
  }}

  .legend-panel {{
    position: absolute; left: 20px; bottom: 120px; z-index: 1000;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    padding: 16px; border-radius: 12px; min-width: 200px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }}
  .legend-title {{ font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px; }}
  .legend-item {{ display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: 12px; }}
  .legend-color {{ width: 24px; height: 16px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }}

  .colorbar-container {{
    position: absolute; left: 50%; transform: translateX(-50%); bottom: 20px; z-index: 1000;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    padding: 16px 24px; border-radius: 12px; min-width: 520px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }}
  .colorbar-title {{ text-align: center; font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px; }}
  .colorbar {{
    height: 20px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);
    background: linear-gradient(to right,
      #8b0000 0%, #d32f2f 15%, #ff6b6b 30%, #ffb74d 42%, #ffffff 50%,
      #81c784 58%, #4caf50 70%, #2e7d32 85%, #1b5e20 100%);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1); position: relative;
  }}
  .colorbar-ticks {{
    display: flex; justify-content: space-between; margin-top: 8px;
    font-size: 11px; color: #666; font-weight: 500;
  }}

  .leaflet-popup-content-wrapper {{ border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15); }}
  .leaflet-popup-content {{ margin: 16px; font-size: 13px; line-height: 1.6; }}
  .popup-title {{
    font-size: 18.75px; font-weight: 700; color: #004236; text-align: center; margin-bottom: 10px;
    padding-bottom: 8px; border-bottom: 2px solid #e9ecef;
  }}
  .popup-metric {{ display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; }}
  .popup-metric-label {{ color: #666; font-weight: 500; }}
  .popup-metric-value {{ font-weight: 700; color: #1a1a1a; }}
  .popup-metric-value.positive {{ color: #2e7d32; }}
  .popup-metric-value.negative {{ color: #d32f2f; }}

  @media (max-width: 768px) {{
    .control-panel {{ top: 10px; right: 10px; width: 240px; padding: 16px; }}
    .colorbar-container {{ min-width: 90%; left: 5%; transform: none; padding: 12px 16px; }}
    .legend-panel {{ left: 10px; bottom: 140px; }}
  }}
  @media print {{ .control-panel, .leaflet-control-zoom, .leaflet-control-fullscreen {{ display: none !important; }} }}
</style>
</head>
<body>
<div class="loader" id="loader">
  <div class="loader-spinner"></div>
  <div class="loader-text">Cargando mapa de calor...</div>
</div>

<div id="map"></div>

<div class="control-panel">
  <div class="panel-header">
    {panel_icon_markup}
    <span>Seleccionar Métrica</span>
  </div>
  <div class="metric-selector">
    <label class="metric-option active" data-metric="mes">
      <input type="radio" name="metric" value="mes" checked>
      <div class="metric-radio"></div>
      <div class="metric-label">% Variacion Mes a Mes</div>
    </label>
    <label class="metric-option" data-metric="prog">
      <input type="radio" name="metric" value="prog">
      <div class="metric-radio"></div>
      <div class="metric-label">% Var.Producción Programada</div>
    </label>
    <label class="metric-option" data-metric="pop">
      <input type="radio" name="metric" value="pop">
      <div class="metric-radio"></div>
      <div class="metric-label">% Var.Producción POP</div>
    </label>
  </div>
  <div class="search-box">
    <input type="text" class="search-input" id="searchInput" placeholder="🔍 Buscar gerencia...">
  </div>
</div>

<div class="legend-panel">
  <div class="legend-title">Leyenda</div>
  <div class="legend-item">
    <div class="legend-color" style="background: linear-gradient(to right, #8b0000, #ff6b6b);"></div>
    <span>Variación Negativa</span>
  </div>
  <div class="legend-item">
    <div class="legend-color" style="background: linear-gradient(to right, #81c784, #1b5e20);"></div>
    <span>Variación Positiva</span>
  </div>
</div>

<div class="colorbar-container">
  <div class="colorbar-title">Escala de Variación (%)</div>
  <div class="colorbar"></div>
  <div class="colorbar-ticks" id="colorbarTicks">
    <span id="tick0">-10</span>
    <span id="tick1">-7.5</span>
    <span id="tick2">-5</span>
    <span id="tick3">-2.5</span>
    <span id="tick4">0</span>
    <span id="tick5">+2.5</span>
    <span id="tick6">+5</span>
    <span id="tick7">+7.5</span>
    <span id="tick8">+10</span>
  </div>
</div>

<script>
const POINTS = {json.dumps(points, ensure_ascii=False)};
const BOUNDS = {json.dumps(bounds)};

let currentMetric = 'mes';
let heatLayerPos = null;
let heatLayerNeg = null;
let markers = [];
let map = null;
let defaultGerenciaIndex = -1;
let isFirstRender = true;

function initMap() {{
  console.log('=== Starting map initialization ===');

  // Initialize map with bounds
  map = L.map('map', {{
    fullscreenControl: true,
    fullscreenControlOptions: {{ position: 'topleft' }},
    preferCanvas: true,
    zoomControl: true
  }});

  // Force size calculation immediately
  map.invalidateSize(true);

  // Set bounds immediately
  if (BOUNDS && BOUNDS.length === 2) {{
    console.log('Setting bounds:', BOUNDS);
    map.fitBounds(BOUNDS, {{ padding: [50, 50] }});
  }} else {{
    console.log('Using default Colombia center');
    map.setView([4.5, -74], 6);
  }}

  // Add tile layer
  const tileLayer = L.tileLayer('https://{{s}}.basemaps.cartocdn.com/light_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  }});

  tileLayer.addTo(map);
  console.log('Tile layer added');

  // Find GTA gerencia index
  const gtaIndex = POINTS.findIndex(p => (p.ger || '').toUpperCase() === 'GTA');
  defaultGerenciaIndex = gtaIndex !== -1 ? gtaIndex : 0;
  console.log('GTA index:', defaultGerenciaIndex, 'Total points:', POINTS.length);

  // Hide loader immediately
  document.getElementById('loader').classList.add('hidden');

  // Render heatmap immediately
  setTimeout(() => {{
    map.invalidateSize(true);
    console.log('First invalidateSize called');
    renderHeatmap();
  }}, 100);

  // Second invalidation for safety
  setTimeout(() => {{
    map.invalidateSize(true);
    console.log('Second invalidateSize called');
  }}, 300);

  // Simulate click after everything settles
  setTimeout(() => {{
    const mesOption = document.querySelector('.metric-option[data-metric="mes"]');
    if (mesOption) {{
      console.log('Simulating click on VAR_PCT_MES');
      mesOption.click();
    }}
  }}, 500);
}}

function getMetricValue(point) {{
  if (currentMetric === 'mes') return point.mes;
  if (currentMetric === 'prog') return point.prog;
  return point.pop;
}}

function formatNumber(value) {{
  if (!isFinite(value)) return 'N/A';
  const abs = Math.abs(value);
  const formatted = abs < 10 ? (Math.round(value * 10) / 10).toFixed(1) : Math.round(value);
  return value >= 0 ? '+' + formatted : formatted;
}}

function updateColorBarTicks(maxAbs) {{
  const ticks = [-maxAbs, -maxAbs*0.75, -maxAbs*0.5, -maxAbs*0.25, 0, maxAbs*0.25, maxAbs*0.5, maxAbs*0.75, maxAbs];
  ticks.forEach((tick, i) => {{
    const element = document.getElementById('tick' + i);
    if (element) element.textContent = formatNumber(tick);
  }});
}}

function createPopupContent(point) {{
  const getClass = (val) => !isFinite(val) ? '' : val >= 0 ? 'positive' : 'negative';
  return '<div class="popup-title">' + (point.ger ? 'Gerencia Operativa: ' + point.ger : 'Gerencia Operativa: Sin nombre') + '</div>' +
    '<div class="popup-metric"><span class="popup-metric-label">% Var Prod. Real vs Mes:</span><span class="popup-metric-value ' + getClass(point.mes) + '">' + formatNumber(point.mes) + '%</span></div>' +
    '<div class="popup-metric"><span class="popup-metric-label">% Var Prod. Real vs Prog:</span><span class="popup-metric-value ' + getClass(point.prog) + '">' + formatNumber(point.prog) + '%</span></div>' +
    '<div class="popup-metric"><span class="popup-metric-label">% Var Prod. Real vs POP:</span><span class="popup-metric-value ' + getClass(point.pop) + '">' + formatNumber(point.pop) + '%</span></div>';
}}

function renderHeatmap() {{
  console.log('renderHeatmap called, metric:', currentMetric);

  // Ensure map size is correct
  if (map) {{
    map.invalidateSize();
  }}

  const values = POINTS.map(p => getMetricValue(p)).filter(v => isFinite(v));
  if (values.length === 0) {{
    console.log('No valid values to render');
    return;
  }}

  const maxAbs = Math.max(1, ...values.map(v => Math.abs(v)));
  updateColorBarTicks(maxAbs);

  const calcWeight = (value) => {{
    const normalized = Math.min(1, Math.abs(value) / maxAbs);
    return Math.pow(normalized, 0.55);
  }};

  const positivePoints = POINTS.filter(p => isFinite(getMetricValue(p)) && getMetricValue(p) > 0)
    .map(p => [p.lat, p.lon, calcWeight(getMetricValue(p))]);
  const negativePoints = POINTS.filter(p => isFinite(getMetricValue(p)) && getMetricValue(p) < 0)
    .map(p => [p.lat, p.lon, calcWeight(getMetricValue(p))]);

  console.log('Positive points:', positivePoints.length, 'Negative points:', negativePoints.length);

  // Remove old layers
  if (heatLayerPos) map.removeLayer(heatLayerPos);
  if (heatLayerNeg) map.removeLayer(heatLayerNeg);
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const gradientPositive = {{0.0:'#c8f7d3', 0.3:'#81c784', 0.6:'#4caf50', 0.8:'#2e7d32', 1.0:'#1b5e20'}};
  const gradientNegative = {{0.0:'#ffe0db', 0.3:'#ff6b6b', 0.6:'#e24a33', 0.8:'#d32f2f', 1.0:'#8b0000'}};

  // Add negative heatmap if there are negative points
  if (negativePoints.length > 0) {{
    heatLayerNeg = L.heatLayer(negativePoints, {{
      radius: 32, blur: 15, maxZoom: 10, gradient: gradientNegative, minOpacity: 0.65
    }}).addTo(map);
  }}

  // Add positive heatmap if there are positive points
  if (positivePoints.length > 0) {{
    heatLayerPos = L.heatLayer(positivePoints, {{
      radius: 32, blur: 15, maxZoom: 10, gradient: gradientPositive, minOpacity: 0.65
    }}).addTo(map);
  }}

  // Add markers for all points
  POINTS.forEach((point, idx) => {{
    const value = getMetricValue(point);
    if (!isFinite(value)) return;

    const icon = L.divIcon({{
      className: 'custom-marker',
      html: '<div style="width:12px;height:12px;background:' + (value >= 0 ? '#2e7d32' : '#d32f2f') + ';border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    }});

    const marker = L.marker([point.lat, point.lon], {{ icon }})
      .bindPopup(createPopupContent(point), {{ maxWidth: 300, className: 'custom-popup' }})
      .addTo(map);
    markers.push(marker);
  }});

  console.log('Markers created:', markers.length);

  // On first render, focus on default gerencia and open popup
  if (isFirstRender && defaultGerenciaIndex >= 0 && POINTS.length > 0) {{
    isFirstRender = false;
    const defaultPoint = POINTS[defaultGerenciaIndex];

    // Immediately set view to GTA
    setTimeout(() => {{
      map.setView([defaultPoint.lat, defaultPoint.lon], 8, {{ animate: false }});
      // Open popup after map settles
      setTimeout(() => {{
        if (markers[defaultGerenciaIndex]) {{
          markers[defaultGerenciaIndex].openPopup();
        }}
      }}, 300);
    }}, 50);
  }}
}}

document.querySelectorAll('.metric-option').forEach(option => {{
  option.addEventListener('click', function() {{
    document.querySelectorAll('.metric-option').forEach(opt => opt.classList.remove('active'));
    this.classList.add('active');
    currentMetric = this.dataset.metric;
    this.querySelector('input').checked = true;
    map.invalidateSize();
    renderHeatmap();
  }});
}});

document.getElementById('searchInput').addEventListener('input', function(e) {{
  const rawTerm = e.target.value.trim().toLowerCase();
  const normalize = (text) => (text || '').toLowerCase().replace(/\\s+/g, '');
  const normalizedTerm = normalize(rawTerm);

  let exactMatch = null;
  let startsWithMatch = null;
  let partialMatch = null;

  markers.forEach((marker, index) => {{
    const point = POINTS[index];
    const gerencia = point.ger || '';
    const normalizedGer = normalize(gerencia);

    if (normalizedTerm) {{
      if (!exactMatch && normalizedGer === normalizedTerm) {{
        exactMatch = {{ index, priority: 1 }};
      }} else if (!startsWithMatch && normalizedGer.startsWith(normalizedTerm)) {{
        startsWithMatch = {{ index, priority: 2 }};
      }} else if (!partialMatch && normalizedGer.includes(normalizedTerm)) {{
        partialMatch = {{ index, priority: 3 }};
      }}
    }}

    marker.setOpacity(!normalizedTerm || normalizedGer.includes(normalizedTerm) ? 1 : 0.2);
  }});

  const candidate = exactMatch || startsWithMatch || partialMatch;
  const targetIndex = candidate ? candidate.index : -1;
  if (targetIndex !== -1) {{
    const targetPoint = POINTS[targetIndex];
    map.setView([targetPoint.lat, targetPoint.lon], 8, {{ animate: true }});
    markers[targetIndex].openPopup();
  }}
}});

function waitForMapContainer() {{
  const mapEl = document.getElementById('map');
  if (!mapEl) {{
    console.error('Map container not found');
    return;
  }}

  const rect = mapEl.getBoundingClientRect();
  console.log('Map container dimensions:', rect.width, 'x', rect.height);

  if (rect.width === 0 || rect.height === 0) {{
    console.log('Map container has no dimensions, waiting...');
    setTimeout(waitForMapContainer, 50);
    return;
  }}

  console.log('Map container ready, initializing...');
  initMap();
}}

if (document.readyState === 'loading') {{
  document.addEventListener('DOMContentLoaded', waitForMapContainer);
}} else {{
  waitForMapContainer();
}}
</script>
</body>
</html>
"""


def generate_variation_heatmap_html(df: pd.DataFrame) -> Optional[str]:
    """Return the heatmap HTML for the production variation data."""
    points = _dataframe_to_points(df)
    if not points:
        return None
    bounds = _compute_bounds(points)
    return _build_heatmap_html(points, bounds)

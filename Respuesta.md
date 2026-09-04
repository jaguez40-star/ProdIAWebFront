# Resumen de la solicitud
Quiere que la lógica de generación y renderizado de los mapas ("HEATMAP VARIACION % PRODUCCION: GERENCIAS OPERATIVAS" y "DISTRIBUCIÓN DE LA PRODUCCIÓN: GERENCIAS OPERATIVAS") sea **idéntica** en el proyecto `E:\APLICACIONES\ProdIA\12112025_prodIA`, tomando como fuente los archivos del back `E:\APLICACIONES\ProdIA\21122025_ProdIA_Back`. En concreto, desea reemplazar los archivos del proyecto actual por los del back, para que el pipeline completo (backend + endpoint + frontend) renderice los mapas exactamente igual.
el pipeline completo (backend + endpoint + frontend) renderice los mapas exactamente igual.
el pipeline completo (backend + endpoint + frontend) renderice los mapas exactamente igual.
el pipeline completo (backend + endpoint + frontend) renderice los mapas exactamente igual.
el pipeline completo (backend + endpoint + frontend) renderice los mapas exactamente igual.
el pipeline completo (backend + endpoint + frontend) renderice los mapas exactamente igual.


# Pipeline actual (proyecto 12112025_prodIA)
1. **Endpoint**: `routes/api.py` → `@api_bp.route("/generate_fixed_report", methods=["POST"])`.
2. **Chart creator**: `chatbot/agents/analytics/chart_creators/production_reports.py` → `ProductionReportChartCreator.create_daily_performance_chart()`.
3. **Map payload**: `ProductionReportChartCreator._build_maps_payload()`.
4. **Heatmap**: `chatbot/agents/analytics/map_variation_heatmap.py` → `generate_variation_heatmap_html()`.
5. **Respuesta JSON**: el endpoint devuelve `maps` con `map_variation_html`, `map_ger_html`, `map_campo_html`.
6. **Frontend**: `static/js/chat.js` → `renderProductionChart(..., maps)`.
7. **Renderizado de mapas**: `static/js/dailyPerformanceReport.js` → `createMapsTab()` (inyecta `maps.*` en iframes `srcdoc`).
8. **Estilos**: `static/css/style.css` (clases del carrusel de mapas).
9. **Carga scripts**: `templates/main.html` incluye `static/js/dailyPerformanceReport.js`.

# Diferencias detectadas frente al back 21122025_ProdIA_Back
- **Backend (mapas de gerencias y heatmap)**: en este proyecto, el HTML de mapas se genera con **Plotly** (scattergeo) y el heatmap también usa Plotly.
- **Back 21122025_ProdIA_Back**: usa **Leaflet** (mapas) y **Leaflet + leaflet.heat** (heatmap), con paneles, controles y estilos específicos.

Para que el render sea idéntico, debe copiar exactamente los archivos del back.

# Archivos a reemplazar (copiar desde 21122025_ProdIA_Back)
Backend:
- `chatbot/agents/analytics/chart_creators/production_reports.py`
  - Reemplazar para que `_build_maps_payload()` genere mapas Leaflet y use `generate_variation_heatmap_html()` del back.
- `chatbot/agents/analytics/map_variation_heatmap.py`
  - Reemplazar para que el heatmap sea Leaflet/leaflet.heat con paneles y leyendas idénticas.

Frontend:
- `static/js/dailyPerformanceReport.js`
  - Reemplazar para que `createMapsTab()` y el carrusel se comporten igual que en el back.
- `static/js/chat.js`
  - Reemplazar para mantener el pipeline de renderizado y la forma exacta de inyectar `maps`.
- `static/css/style.css`
  - Reemplazar para mantener estilos del carrusel de mapas (`.map-tab-container`, `.map-carousel`, etc.).
- `templates/main.html`
  - Reemplazar para mantener la misma carga de scripts y dependencias.

Infraestructura/arranque:
- `app.py`
  - Reemplazar solo si el back tiene cambios en la carga de templates/estáticos o blueprints que impacten el renderizado (en el diff actual, hay diferencias, por eso debe copiarse si quiere 100% idéntico).

# Pasos para realizar la modificación
1. **Respaldar** los archivos actuales del proyecto `E:\APLICACIONES\ProdIA\12112025_prodIA` listados arriba.
2. **Copiar desde el back** `E:\APLICACIONES\ProdIA\21122025_ProdIA_Back` los archivos:
   - `chatbot/agents/analytics/chart_creators/production_reports.py`
   - `chatbot/agents/analytics/map_variation_heatmap.py`
   - `static/js/dailyPerformanceReport.js`
   - `static/js/chat.js`
   - `static/css/style.css`
   - `templates/main.html`
   - `app.py`
3. **Verificar dependencias front-end**: que Leaflet y leaflet.heat se carguen correctamente en el HTML generado por backend (se incluye en el HTML embebido, pero debe permitir acceso a `https://unpkg.com/...`).
4. **Reiniciar el backend** para que tome los cambios.
5. **Probar endpoint** `POST /api/generate_fixed_report` con `report_id = "daily_performance"` y confirmar que el JSON incluya `maps.map_variation_html` y `maps.map_ger_html`.
6. **Validar en UI**: abrir el reporte diario y confirmar que el tab "Producción-Map" muestra el heatmap y el mapa de gerencias con el mismo estilo y controles del back.

# Código específico a reemplazar
- Todo el contenido de los archivos listados debe ser reemplazado por el contenido de los mismos archivos en `E:\APLICACIONES\ProdIA\21122025_ProdIA_Back`.
- No se recomienda mezclar secciones parciales: el objetivo es **identidad total** con el back.

# Observación
El pipeline y los endpoints ya existen en este proyecto; el principal cambio es que la lógica de generación de mapas (backend) y la UI de renderizado (frontend) deben pasar de Plotly a Leaflet exactamente como en el back.

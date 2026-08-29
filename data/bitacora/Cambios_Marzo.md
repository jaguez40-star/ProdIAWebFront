# Bitácora de Cambios — Marzo 2026

> Resumen semanal de cambios realizados al proyecto ProdIA (ECP Insights Flask).

---

## Semana 1 — 2 al 6 de Marzo

### Resumen
Esta semana se sentaron las bases de la experiencia visual y de navegación del sistema de botones de análisis. El cambio más significativo fue la introducción de los **followup buttons categorizados**, organizados en pills/tabs con 5 categorías temáticas: Económico, Clasificación, Producción, Temporal y Comparativo. Esta primera versión (MVP) activó únicamente el nivel Campo×Producción, pero estableció la arquitectura frontend y backend que se expandiría en las semanas siguientes.

Complementando esto, se implementó la **detección automática de jerarquía** (VP / Gerencia / Campo / Pozo), permitiendo que los botones generados se adapten dinámicamente al nivel de agregación de la consulta.

En paralelo, se realizaron mejoras de presentación relevantes: la tabla de resultados quedó **limitada a 5 filas visibles** con un indicador del total de registros adicionales, reduciendo la sobrecarga visual. Se ajustaron los **espacios CSS** entre la tabla y los botones, y entre botones entre sí. La columna `MES` fue **homologada** de números (1–12) a nombres en español (Enero–Diciembre) tanto en tablas como en ejes de gráficos. Finalmente, el fondo de los mensajes del asistente cambió de blanco a gris `#F2F2F2` para mayor consistencia visual con los mensajes del usuario.

**Archivos modificados:** `analytics_agent.py`, `routes/api.py`, `app.py`, `chat.js`, `style.css`, `html_injector.py`, `line_charts.py`, `bar_charts.py`, `configurable_agent.py`, `enhanced-tables.css`

---

## Semana 2 — 9 al 13 de Marzo

### Resumen
Semana de mayor densidad de cambios. Se completó y estabilizó el sistema de **followup buttons categorizados para ROBUSTEZ**, expandiéndolo a todos los niveles jerárquicos (VP, Gerencia, Campo, Pozo). Cada categoría recibió su propio builder dedicado con SQL dinámico parametrizado según el nivel detectado, cubriendo métricas como EBITDA, Breakeven, Costos Variables, Tasas de Aceite y Agua.

El cambio más notable en experiencia de usuario fue la sustitución del "Resumen Estadístico" estático por **LLM Insights**: textos narrativos generados por inteligencia artificial con badges HTML coloreados (`bg-primary`, `bg-success`, `bg-danger`), con cadena de fallback OpenAI → Ollama → texto estático. Esto aplica a todos los gráficos generados por followup buttons.

Se mejoró el **estilo visual de los gráficos de barras** de producción: barras ordenadas de mayor a menor, color degradado basado en `#CCD32A`, y etiquetas de datos encima de cada barra.

Se corrigió un **bug crítico en Variación % Mes a Mes** causado por mutación del diccionario de configuración (referencia compartida). La solución usó `dict()` shallow copy antes de modificar el config, y se actualizó `stored_data` post-cálculo para que el insight analice los datos correctos.

La categoría Comparativo fue refinada: el botón dual "Aceite vs Agua" fue reemplazado por **2 botones independientes** (Aceite por Campo con gradiente `#CCD32A`, Agua por Campo con gradiente `#0d6efd`), cada uno con su propia escala, mejorando la legibilidad.

Se corrigió también el bug de **followup buttons faltantes en queries ROBUSTEZ vía chat**, añadiendo `context["report_mode"] = "robustez"` al enrutar a `RobustezAgent` en `api.py`.

**Archivos modificados:** `analytics_agent.py`, `routes/api.py`, `chat.js`

---

## Semana 3 — 16 al 20 de Marzo

### Resumen
Sin cambios registrados en la bitácora durante esta semana.

> *Posible período de estabilización, pruebas internas o trabajo no registrado formalmente.*

---

## Semana 4 — 23 al 27 de Marzo

### Resumen
Sin cambios registrados en la bitácora durante esta semana.

> *Posible período de estabilización, pruebas internas o trabajo no registrado formalmente.*

---

*Generado el 2026-03-27 — Fuente: sección "Bitácora de Cambios Recientes" de CLAUDE.md*

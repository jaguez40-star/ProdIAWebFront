# Épicas — Backlog gerencial ProdIA

> **Origen:** feedback de la **gerencia solicitante** en la reunión de "Sistemática"
> (notas en *Observaciones ProdIA.txt*, externo al repo).
> **Auditoría inicial:** 2026-07-24 — sesión de solo análisis, sin cambios de código, para fijar
> avance real vs. percibido antes de seguir construyendo.
> **Estado a:** 2026-07-29.

---

## Estado actual

| # | Épica | 24-jul | Hoy |
|---|-------|--------|-----|
| 1 | Atribución cuantitativa del gap | 🟡 ~90 % | 🟢 **Cerrada** |
| 2 | Baseline P50 vs compromiso | 🔴 ~5 % | 🟢 **Cerrable** (bloqueo de datos) |
| 3 | Modos por instancia de reporte | 🔴 0 % | 🔴 0 % |
| 4 | Mapa semáforo por campo | 🔴 0 % | ⏸️ **En pausa** (bloqueo de datos) |
| 5 | Explicación de desviaciones | 🟡 ~20 % | 🟢 **Cerrada** (alcance reducido) |
| 6 | Traducción a plata / margen | 🔴 0 % | 🟢 **Cerrable** |
| 7 | Experiencia móvil-ejecutiva | 🔴 0 % | 🔴 0 % |

---

## 1 · Atribución cuantitativa del gap 🟢

**Qué se pidió:** *"de esos 80.000 barriles de desviación, 50.000 son por tal cosa…"* — que
el tablero no diga solo *cuánto* falta, sino *dónde* falta.

**Qué existía:** el backend (`_gap_campo`) ya calculaba la contribución por campo en barriles **y**
en porcentaje. El pendiente era de presentación: el rediseño del 24-jul había dejado en el renglón
ECP solo el `%`, escondiendo el número absoluto que ya estaba calculado.

**Qué se cerró (25-jul):**
- El panel derecho del foco muestra "Producido vs Producción esperada por campo" con
  **barriles/MSCF absolutos + % de cumplimiento** por campo.
- **Fix de unidades**: el panel dividía *todo* entre 1e6 y rotulaba crudo como "bbl" → mostraba
  "0,26 bbl" donde eran **260.000 bbl**. Ahora gas en MSCF, crudo/blancos en bbl reales.
- Se verificaron contra la BD los campos que aparecían en 0,00 (ARAUCA/gas, PAUTO SUR/blancos):
  son **mermas reales**, no huecos de datos — la prueba estaba en el fact diario (0 explícito
  durante 30 y 17 días = paro real).

**Deuda abierta (menor, no bloqueante):** a grano mensual un paro real llega como **fila REAL
ausente**, no como 0, y el panel coacciona *ausente→0*. Un hueco genuino de ingesta se vería
idéntico → riesgo teórico de detractor falso. Hoy no produce ninguno.

**El *por qué* causal no es de esta épica** — eso es la 5.

---

## 2 · Baseline P50 vs compromiso + seguimiento 🟢 cerrable

**Qué pidió:** distinguir la **línea base P50** del **compromiso** asumido, y un ciclo
Plan → Gap → Acciones → Seguimiento → Evidencia.

**Dónde estaba:** ~5 %, solo una maqueta con barras hardcodeadas
(`dailyPerformanceReport.js::renderSideBars`).

**Qué se construyó (27-jul):**
- Se identificó que el bloque **RETO CORPORATIVO** de la hoja *P50 Acumulado* **es** el compromiso.
  Se modeló su ingesta (y de paso se arregló un bug preexistente: la Tabla 2 arrastraba el bloque
  RETO y conflaba Filiales con RETO-ECP, pisando datos en la BD).
- 🔑 **El riesgo central era de escala:** el `fact_produccion_mes_ecp` y el mundo P50 **no
  reconcilian** — el factor por producto es inconsistente (crudo 5,8× · gas 36× · blancos 2×).
  Son sistemas de unidades distintos; poner la Real del tablero junto al P50 habría sido mentir.
- La salida fue la hoja **`REPORTE_PRESIDENT`**: única fuente con Real / Proyección / Base P50 /
  Compromiso de los tres productos —incluido **BLANCOS**— toda en kbpe corporativo. Endpoint
  `/analisis/president` + proxy Flask.
- **Frontend (opción A, decisión del usuario):** el encabezado ECP pasa a ser el **compromiso P50**
  (3 tarjetas con anillo) y las tarjetas operativas de HOY (BOPD vs PPTO) **bajan a cada foco**.
  Dos referencias distintas y rotuladas → sin contradicción.

**Qué falta:** re-ingerir `REPORTE_PRESIDENT` en dev y en 139 (el script está listo). **El bloqueo
es de datos, no de diseño ni de código.** Del mockup faltan 3 filas (Proyección cierre · Programa
día · Real día); el tracker de Acciones/Evidencia el propio mockup lo marca *"por definir"*.

---

## 3 · Modos por instancia de reporte 🔴

**Qué pidió:** que el mismo tablero se presente distinto según el foro — Sistemática, BP, POP,
Junta, Diario de presidencia, BH, Comité de gestión.

**Estado: 0 %.** No existe ni selector de instancia ni plantillas por foro. No iniciada.

---

## 4 · Mapa semáforo + severidad relativa por campo ⏸️

**Qué pidió:** un mapa geográfico donde cada campo aparezca con color de semáforo y tamaño
proporcional a la severidad de su desviación.

**Se analizó "de cerca" el 26-jul. Las tres piezas:**

1. **Severidad por campo** ✅ — ya existe (el desglose de cumplimiento construido en la Épica 1).
2. **Tecnología de mapa** ✅ — el ProdIA legacy ya usa Plotly-geo (`production_reports.py`,
   `map_variation_heatmap.py`) y hay Leaflet vendorizado. Reutilizable.
3. **Geolocalización** ⚠️ — **el bloqueador.**

🔑 **El dato duro:** `MAP_DATA_MAP_CAMPO` tiene 141 campos pero solo **82 con coordenadas**.
Cruzado contra los 139 campos de producción reales: **solo 71 (51 %) tienen lat/lon**. Y entre los
68 sin ubicación hay **focos activos** — CAJUA (detractor de crudo al 64 %), CAÑO LIMÓN, PAUTO SUR.
Un "mapa de atención" que omite justo los peores campos es engañoso.

**Decisión (26-jul): en pausa.** No es un problema de código; conseguir las coordenadas es una
tarea de datos (export del maestro GIS corporativo, como se hizo con `Activo_campo.csv`).
Quedaron documentadas tres salidas:

1. Completar coordenadas primero → mapa geográfico real y completo.
2. Mapa parcial ya (71 campos) + lista honesta "N sin ubicación" — pero omite focos activos.
3. Vista de severidad **no geográfica** (burbujas/treemap por campo, color = semáforo,
   tamaño = impacto) → 100 % de cobertura, cero dependencia de coordenadas.

---

## 5 · Explicación de desviaciones 🟢 (alcance reducido)

**Qué pidió originalmente:** conectar cada desviación con los **proyectos** atrasados que la
explican.

**Reducción de alcance explícita (25-jul):** se **retiró "modelar proyecto"**. Los `.xlsm` del
reporte diario no traen portafolio de iniciativas (nombre / campo / aporte esperado / cronograma /
estado). Sin esa fuente, modelarlo habría terminado como la pill "Mantenimientos": un mock sin
datos reales.

**Qué se hizo en su lugar (26-jul):** la sección **Diferidas** dejó de mostrar *frecuencia de
incidentes* y pasa a mostrar **impacto por causa (NV04) en volumen perdido** — bbl para crudo,
MSCF para gas. Eso *es* el "de esos X barriles, Y por tal causa" que se pedía.

🔑 Antes de implementarlo se **verificó la unidad del gas** usando el crudo como ancla: la fracción
perdido/producido del gas cae en la misma banda que la del crudo (0,1–0,9 % vs 0,2–2 %),
confirmando que están en la misma unidad y que el ÷1e6 es honesto.

**Qué queda explícitamente fuera** (para que nadie lea el cierre como más de lo que es):

- El puente a la desviación del **mes puntual** *no* está: la BD de Diferidas termina en jul-2025 y
  el mes analizado es mayo-2026 — **no hay solapamiento**. El enlace month-specific solo sería
  posible vía los comentarios del reporte (~33 % de cobertura medida sobre los detractores reales)
  y quedó como opción abierta, no implementada.
- El campo `causa.texto` del backend sigue hardcodeado a *"sin evento asociado en comentarios"*.

Es decir: cierra el marco **causal-histórico en barriles**, no la atribución causal del gap del mes.

---

## 6 · Traducción a plata / margen 🟢 cerrable

**Qué pidió:** que la desviación no se exprese solo en barriles sino en **impacto económico**.

**Qué se construyó (26-jul):** cuarta pill **"EBITDA-NOPAT"** en cada foco, con un **waterfall
Ingresos → NOPAT** de 18 componentes, leyendo la BD fuente de Robustez (no se replica el dato).
SVG vanilla con toggle KUSD ↔ USD/Bl, carga perezosa.

**Limitación honesta:** solo **crudo**. La fuente únicamente tiene economía de crudo, así que Gas y
Blancos quedan en blanco en vez de fabricar cifras.

---

## 7 · Experiencia móvil-ejecutiva 🔴

**Qué pidió:** la gerencia consume el 80 % desde el teléfono — quiere resumen ejecutivo, mapa, alertas,
top gaps y 1-2 preguntas guiadas.

**Estado: 0 % como tal.** Hay 13 `@media` en `colapsable.css`, así que el layout no se rompe en
pantallas chicas, pero eso es *no romperse*, no una UX móvil diseñada para decisión ejecutiva.
No iniciada.

---

## El patrón que se repite

De las cuatro épicas que no están cerradas, **dos están bloqueadas por datos, no por código**: la 2
espera una re-ingesta y la 4 espera coordenadas. En ambas la mecánica ya está construida y
verificada. Las otras dos (3 y 7) son trabajo de producto no iniciado.

Y la lección recurrente del mes: en la 2 el riesgo real no era construir el componente sino
**descubrir que las escalas no reconciliaban**; en la 5 fue **admitir que la fuente de datos no
existía** y recortar el alcance en vez de simular. Ambos hallazgos ahorraron construir algo que
habría mentido.

---

*Documento de estado. Ver el detalle cronológico en `data/bitacora/Cambios_Julio.md` y
`data/bitacora/Cambios_Agosto.md` (este último incluye la estructura actual del proyecto).*

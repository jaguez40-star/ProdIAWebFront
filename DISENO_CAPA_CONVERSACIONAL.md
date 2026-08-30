# DISEÑO — Capa Conversacional (Slot-Filling) sobre la BD de Producción

> **Qué es este archivo:** acta viva de los **parámetros de diseño acordados** para construir la
> capa conversacional de ProdIA que responde preguntas con números reales de la Ingesta (BD
> Postgres `daily_report_prod`). Complementa el documento de discusión original `Ambi.md` (que
> contiene el *porqué* filosófico) con las **decisiones cerradas** y el estado real verificado.
>
> **Fecha de acuerdo:** 2026-07-08 · **Referenciado desde:** la guia del proyecto (§10) ·
> **Fuente base:** `Ambi.md`, la guia del sub-proyecto de INGESTA

---

## 0. La regla madre (heredada de `Ambi.md`)

> **Python calcula, el LLM solo concluye.** El LLM nunca inventa ni calcula el número: lo *pide*.
> Extrae la intención → Python valida y calcula contra la raw data → el LLM (opcional) redacta.

En la capa conversacional esto se materializa como **herramientas curadas** (no text-to-SQL libre)
+ una **capa de slot-filling** que desambigua la pregunta ANTES de traducirla.

---

## 1. Los dos objetivos acordados (secuenciales y dependientes)

```
OBJ. PRIMARIO  →  produce 2 insumos:  [Catálogo de entidades]  [Densidad temporal]
                                              │                        │
OBJ. SECUNDARIO ──────── los consume ─────────┴────────────────────────┘
```

La capa de datos se construye **UNA vez**: el Primario la pinta (humano), el Secundario la consulta (máquina).

### OBJETIVO PRIMARIO — Fundación visible (pestaña **Análisis** del MultiTab Shell)

Dos módulos con data real de la BD de producción:

| Módulo | Fuente de datos | Qué entrega |
|---|---|---|
| **Catálogo de entidades** | `core.dim_fuente` + `core.dim_vicepresidencia` | Cardinalidad por nivel · tabla navegable · **flag de colisión** · tag ECP vs Filiales · productos válidos (aceite/gas/blancos) |
| **Densidad temporal** | `core.fact_produccion_dia_ecp` + `core.config_reporte` | Heatmap calendario · días únicos/rango/**huecos** por mes · **semáforo por familia estadística** |

- **Doble salida:** endpoints `GET /analisis/catalogo` y `GET /analisis/densidad` (FastAPI :8000
  + proxy Flask, p.ej. `/api/analisis/*`). El módulo los pinta **y** el Secundario los consume.
- **Reuso de frontend:** patrón de la pestaña **Control** de `static/js/multitab_shell.js`
  (zona 2 = menú/navegador → zona 3 = render en `#charts-display-area`). **Plotly ya vendorizado**
  (`static/js/vendor/plotly-2.26.0.min.js`) para el heatmap. Clases CSS `rb-cp`/`ct-*` ya existen.
- **Definición de LISTO:** abrir la pestaña Análisis y ver ambos módulos con números reales.
- **Orden interno:** **Catálogo ANTES que Densidad** (el catálogo es la dependencia dura del Secundario).

✅ **IMPLEMENTADO (2026-07-08)** — ver plan ejecutado
`INGESTA/Rep_Prod/Planes/plan_analisis_fundacion_visible_2026-07-08.md`. Endpoints
`GET /analisis/catalogo` y `GET /analisis/densidad` (FastAPI :8000) + proxies Flask
`/api/analisis/*`; pestaña Análisis del MultiTab Shell rellena con los 2 módulos. Verificado
end-to-end en navegador (Playwright, sin errores de consola). Números reales (BD dev,
`daily_report_prod`, al momento de la verificación):
- **Catálogo:** fuente=185, campo=139, activo=18, area=62, gerencia=17,
  **vicepresidencia=11** (el DDL siembra 7 códigos; el ETL agregó 4 reales de la data 2026:
  GGN/GPU/GOX/GGS — 11 es el valor correcto, no un bug). Colisiones: 151 total (9 duras:
  APIAY/CASTILLA/CHICHIMENE/CUSIANA/RUBIALES + `CAÑO SUR`/`CPO-09`/`NARE`/`PIEDEMONTE`;
  33 medias; 109 blandas). Filiales: America, Hocol, Permian.
- **Densidad:** 174 días con data, rango 2025-11-25 → 2026-05-17 (más amplio que el Ene-May
  2026 estimado al diseñar), huecos totales=38, racha máxima=174 días. Huecos por mes: Nov
  2025 (24, arranca a mitad de mes), Dic 2025 a Abr 2026 sin huecos, Mayo 2026 (14, corte a
  mitad de mes — datos parciales al momento de la verificación). Semáforo: las 5 familias en
  verde (racha máxima ≥20 días continuos).

🔁 **EVOLUCIÓN (2026-07-08b)** — la fundación pasó de "mostrar" a "consultar por entidad". Ver §7
para el detalle: (a) el módulo **"Huella de datos"** (2 gráficos de barras) se reemplazó por
**"Cobertura del reporte"** (tabla única de las 28 hojas por categoría, filtrable); (b) se añadió un
**desplegable de entidad** (filiales + jerarquía ECP) a **Cobertura y Densidad**; (c) se **alineó** la
resolución de entidad de ambos módulos (`operador` + `vice_id` + `gerencia`); (d) se acordó el
**formato de respuesta conversacional** (huella temporal + huella temática ANTES del número).

### OBJETIVO SECUNDARIO — Slot-filling conversacional (pestaña **Consulta** — NUEVA)

Proceso nuevo: dado un texto en español, contrapregunta **solo lo necesario** hasta producir un
*intent* completo y validado.

- **UI (decidido):** **pestaña propia** en el riel del Shell → `Ingesta · Control · Análisis · Consulta`.
- **Termina en (decidido):** el **intent validado**. **NO ejecuta** la consulta (la ejecución es Fase 3).
- **Pipeline de 4 pasos** (Gemma/LLM solo participa en el Paso 1):
  1. **[LLM]** extrae los slots mencionados → JSON.
  2. **[Python]** valida contra el catálogo de entidades (exacto, no adivina).
  3. **[Python]** reglas duro/blando: ¿qué falta? ¿qué asumo? ¿qué pregunto?
  4. **[Python]** decide: EJECUTAR / DEFAULT+AVISAR / CONTRAPREGUNTAR.
- **LLM local** solo en Paso 1: `qwen2.5:3b` (dev) / `gemma4:latest` (prod). Ver §4.
- **Contrapregunta con BOTONES** (de las colisiones del catálogo), no texto libre. Reusar la
  infraestructura de Panel 2 (`_renderCategorizedButtons` en `static/js/chat.js`).
- **Slots duros vs blandos:** duros (jerarquía ambigua) → contrapreguntar SIEMPRE; blandos
  (producto→aceite, tiempo→último mes, agregación→promedio_diario) → asumir + AVISAR.
- **Eco de confirmación** antes de dar por bueno el intent; **memoria de contexto** ("¿y el gas ahí?").
- **`agua` se RECHAZA (decidido):** en el Paso 2, si `producto=agua` → responder "no disponible a
  grano diario" (la BD diaria solo tiene CRUDO/GAS/BLANCOS; ver §3). El modelo SÍ acepta "agua",
  por eso la **validación** debe atajarlo — nunca devolver vacío en silencio.
- **Definición de LISTO:** ante preguntas ambiguas, contrapregunta solo en las colisiones duras,
  asume blandos con aviso, rechaza `agua`, y produce un intent limpio para casos tipo "Rubiales".

### FASE 3 — Fuera de alcance ahora (explícito)

Ejecución real del intent: **vista canónica** (`vol_estimado` = "aceite real", ver §3) + herramienta
curada `produccion_por_nivel(...)` que corre la consulta y devuelve el número. Diferida a propósito.

### Secuencia acordada

**Primario → Secundario → Fase 3.**

---

## 2. Decisiones cerradas (2026-07-08)

| # | Decisión | Valor acordado |
|---|---|---|
| D1 | Alcance del Objetivo Secundario | **Para en el intent validado** (ejecución = Fase 3) |
| D2 | Dónde vive la UI del Secundario | **Pestaña propia** en el riel del Shell (Consulta) |
| D3 | Manejo de `agua` | **Rechazar + PUENTEAR a ROBUSTEZ** ("no está a grano diario aquí; el agua vive en el módulo Robustez"). No dejar un "no" seco — la app SÍ tiene agua en otra BD (V-F). |
| D4 | Filosofía | Herramientas curadas, NO text-to-SQL libre (heredado de `Ambi.md`) |
| D5 | Orden dentro del Primario | Catálogo antes que Densidad |
| D6 | **Entrega por fases del Secundario** (2026-07-08b) | El Secundario se construye en **3 versiones incrementales** sobre la MISMA arquitectura. El `plan:` cubre **solo v1**. G1–H4 son **backlog explícito** (mitiga el riesgo de scope creep). |
| D7 | **Compuertas de aceptación del v1** (2026-07-08b) | El v1 **NO es LISTO** sin sus **DOS sets de prueba**: (a) **golden set** — extracción `texto → slots`, mide al **LLM** (`qwen` dev / `gemma` parity en prod; ~20–40 casos; umbral ≥90%); (b) **fixtures de estado** — round-trip `slots+catálogo → decisión → resume → intent`, **Python determinista, sin LLM**, 100% pass. Ambos son el **primer entregable** del `plan:` v1. |

**Fasing del Secundario (D6):** resolver + frontera LLM/Python + formato "huella primero" + los 3 endpoints
de la fundación son **compartidos por las 3 versiones** → v1 NO es trabajo desechable, es la base.

| Versión | Alcance | Reglas |
|---|---|---|
| **v1** (= Definición de LISTO §1) | **1 entidad · 1 intent** — el esqueleto que camina (caso Rubiales) | resolver · colisión dura → contrapregunta con botones · defaults blandos con aviso · rechazo de `agua` · eco de confirmación · **para en el intent** (no ejecuta) |
| **v2** | multi-entidad | G1, G2 (ver §7.7) |
| **v3** | multi-intent + drill-down | H1, H2, H3, H4 (ver §7.7) |

**Definición de LISTO del v1 (verificable):** dado *"producción de Rubiales"* (y variantes con typo/acento):
① LLM extrae `{entidad:"RUBIALES", nivel:null, …}` → ② Python resuelve → `[campo, activo, gerencia, fuente]`
(colisión dura) → ③ contrapregunta con **botones** (no texto libre) → ④ con la elección, produce un intent
limpio `{entidad, nivel, producto=crudo(aviso), periodo=último(aviso), agregacion=promedio(aviso)}` y
**para ahí**. Sin multi-entidad, sin multi-intent, sin validación de periodo.

**Compuertas de aceptación (D7) — DOS sets, se prueban distinto:**
- **Golden set** (mide al **LLM**): extracción `texto → slots`, **single-turn**, ~20–40 casos con trampas
  (colisión dura, `agua` rechazada, "GOR es campo" con pista errada, "¿y el gas ahí?" con contexto heredado,
  typo/acento). Umbral **≥90%** de exactitud de slots en `qwen2.5:3b`; **parity con `gemma4:latest`** en el
  despliegue (corre donde gemma esté disponible).
- **Fixtures de estado** (**Python determinista, SIN LLM**): el **viaje redondo** de la contrapregunta
  (pregunta → `pendiente` correcto → click de botón → `resume` → intent `completo`) y la re-contrapregunta
  encadenada. 100% pass, corre instantáneo como test de regresión.

Ambos son el **primer entregable** del `plan:` v1, antes que la lógica. Separarlos evita que el round-trip
—que no usa LLM— **contamine la métrica** del golden set (ver §8 para el schema del intent y la máquina de estados).

---

## 3. Hallazgos técnicos que sustentan el diseño (verificados contra la BD real)

- **La vista canónica va sobre el star schema tipado, NO sobre `fact_tabla_hoja`.**
  `core.fact_produccion_dia_ecp` tiene los "5 aceites" como **5 columnas NUMERIC**
  (`volumen, porcentaje, voldismez, vol_estimado, promedio`) unidas a `dim_fuente`/`dim_vice`/
  `dim_tipo_producto`/`dim_fecha`. La decisión canónica **ya está tomada en el código**: las vistas
  `core.vw_wa_resumen_corporativo` / `vw_wa_produccion_por_activo` usan `SUM(vol_estimado)` como
  "real diario". → "aceite real" ≈ `SUM(vol_estimado) WHERE tipo_producto='CRUDO' AND grupo_prod='ECOPETROL'`.
  `fact_tabla_hoja` (EAV genérica, ~62M filas, lenta) queda FUERA del camino conversacional.

- **PROCEDENCIA ≠ FUENTE DE CÁLCULO (principio clave, 2026-07-08).** Son dos cosas distintas:
  - **Procedencia (linaje):** de qué HOJA salió el dato. **SÍ se muestra** — es transparencia. Los facts
    estructurados tienen hoja de origen RAW: `fact_produccion_dia_ecp`←`BDP_datos_dia`,
    `fact_produccion_mes_ecp`←`BDP_datos_mes`, `fact_programa_ecp`←`BDP_Programa`. El módulo "Huella de
    datos" (pestaña Análisis) etiqueta cada barra con su hoja de origen.
  - **Fuente de cálculo:** de qué tabla se COMPUTA la respuesta. Se usa **UNA canónica** para no
    doble-contar. Las hojas **derivadas** (`P50 Acumulado/Quemado`, `DPP`, `Whatsapp`, `NEW MES-AÑO`) son
    pivots/acumulados de los MISMOS datos → si se sumaran con el fact, se contaría doble. Por eso quedan
    fuera del CÁLCULO — pero NO se niega su existencia como procedencia.
  - Resumen: mostrar dónde vive el dato = OK siempre; computar el número = solo desde la fuente canónica.

- **`agua` NO existe como producto en el fact diario.** `core.dim_tipo_producto` solo tiene
  **CRUDO · GAS · BLANCOS**. El agua vive en la BD ROBUSTEZ (SQLite), otro grano/fuente. → D3.

- **Dos jerarquías disjuntas** (el catálogo debe etiquetar la fuente):
  - **ECP:** `dim_vicepresidencia` (VP) → `dim_fuente` (gerencia/activo/area/campo/fuente≈pozo).
  - **Filiales:** `dim_empresa` (Hocol/America/Permian). "Rubiales" es ECP; "Hocol" es Filiales.
  - Ojo con `activo` vs `activos`: la vista WA mapea `grupo1 AS activo` y `activos AS clasificacion`.

- **Colisiones de nombres (base del slot duro), medidas sobre `dim_fuente` (253 entidades):**
  cardinalidad → VP **11** (de `dim_vicepresidencia`, ver bullet abajo) · gerencia 17 · activo 18 · area 62 · campo 139 · fuente 185.
  **151 nombres colisionan** entre niveles. Se agrupan:
  - 🔴 **Duras (~5, en 4 niveles):** `APIAY, CASTILLA, CHICHIMENE, CUSIANA, RUBIALES` → contrapregunta obligatoria.
  - 🟠 **Medias (~24, en 3 niveles area+campo+fuente):** `ABANICO, CAÑO LIMON, CUPIAGUA, ORITO, QUIFA, TELLO, TIBU…` → contrapregunta.
  - 🟡 **Blandas (~120, campo↔fuente):** default a `campo` + aviso, sin interrogar.
  - **Regla:** contrapreguntar solo 🔴+🟠 (~29 nombres), no las 151.

- **⚠️ Colisiones por CONTENCIÓN (hallazgo 2026-07-08b, V-A): 140 pares / 31 nombres.** Aparte de las 151
  colisiones de nivel (mismo nombre en distintos niveles), hay **nombres cortos contenidos en otros largos**:
  `CASTILLA ⊂ CASTILLA ESTE/NORTE`, `CHICHIMENE ⊂ CHICHIMENE SW`, `APIAY ⊂ APIAY ESTE`,
  `GUANDO ⊂ GUANDO SOUTH WEST`, y la peligrosa `OPERADOS ⊂ NO OPERADOS`. **Dos impactos:**
  (1) la presencia de Cobertura vía `ILIKE '%X%'` **sobre-cuenta** esos 31 nombres (suma reportes que solo
  mencionan la variante larga) — está avisado en la UI, ahora **cuantificado**; (2) el resolver necesita un
  **"hint de hermanos"**: si el usuario dice "guando", el match exacto acierta pero **no** avisa que existe
  GUANDO SOUTH WEST (correcto pero silencioso). El **golden set debe MEDIR** (no asumir) la cobertura de la
  Capa 1 del resolver — el "cubre ~99%" del §7.6 es una estimación **no verificada**.

- **⚠️ `dim_vicepresidencia` real ≠ documentada (hallazgo 2026-07-08).** Tiene **11 códigos**, no 7. El
  DDL siembra 7 (VRC/VRO/VAO/VFS/VPI/VEX/VAS) pero el ETL agregó 4 desde la data 2026 (**GGN/GPU/GOX/GGS**,
  `nombre_completo=NULL`). Los que **dominan** el fact diario son GGN/GPU/GOX/GGS; de los 7 sembrados, 4
  (VRC/VRO/VAO/VPI) tienen **0 filas**. Implicación para el Secundario: al ofrecer el nivel "vicepresidencia",
  los valores reales son GGN/GPU/GOX/GGS/VAS/VFS/VEX — el catálogo debe salir de la data, no de la doc.

- **Datos cargados (dev):** 138 reportes NEW, Ene 1 → May 18 2026 (Ene 31·Feb 28·Mar 31·Abr 30·May 18).
  `fact_produccion_dia_ecp` ~435K filas · `fact_produccion_mes_ecp` ~111K · `fact_programa_ecp` ~218K.
  Al ser todos NEW/diarios, la continuidad diaria pinta buena → análisis diario viable (la densidad
  exacta la mide el propio Objetivo Primario). *(Rango REAL verificado: 2025-11-25 → 2026-05-17.)*

- **⚠️ Techo de datos y archivos cifrados (R5, 2026-07-08b) — dependencia de Fase 3/negocio, NO bloquea el
  Secundario.** La data llega hasta **~17-may-2026**: los archivos de **Junio 2026 y May 19–31 están CIFRADOS
  con contraseña** (firma OLE2, openpyxl los rechaza; ver la bitacora S14 del sub-proyecto) → no
  ingeribles sin la clave. Implicación: el sistema hoy **no puede responder sobre nada posterior a mediados de
  mayo**. **Desacople clave:** por **D1** el Secundario **para en el intent** (no ejecuta) → esto **NO bloquea**
  construir ni validar el slot-filling (v1/v2/v3) ni el golden set (mide *intent*, no números), y **H3** lo
  maneja con honestidad (stop + rango disponible). **SÍ es un bloqueo de la UTILIDAD del producto y de Fase 3**
  (dar números frescos). **Acción:** obtener las contraseñas de los `.xlsm` cifrados — pendiente de
  **negocio/ops en PARALELO**, NO predecesor del v1.

---

## 4. Entorno LLM dev/prod (crítico — hardware validado)

- **Prod (servidor 139):** `gemma4:latest` (vía `OLLAMA_MODEL` en `.env`).
- **Dev (este servidor local):** **`qwen2.5:3b` en modo CPU.**
  - La GPU **AMD RX 6700 XT (gfx1031)** NO puede correr el LLM: ROCm no la soporta (warning
    "AMD driver too old" que no se quita ni actualizando driver) y el fallback Vulkan causa
    **BugCheck 0x1A MEMORY_MANAGEMENT → reinicio de Windows** al cargar el modelo (pasó 2 veces).
  - **Config estable adoptada** (persistida en registro User): `OLLAMA_VULKAN=0`,
    `OLLAMA_LLM_LIBRARY=cpu`, `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_KEEP_ALIVE=3m`.
  - `gemma4:e2b` (7.2 GB) solo era viable en GPU → inservible aquí. Fallback si falta RAM: `gemma2:2b`.
  - **RAM ajustada:** 8 GB totales; con el modelo cargado quedan ~0.8 GB libres → no levantar
    Postgres + 2 backends + Ollama a la vez sin cuidado.
- **Paso 1 validado (2026-07-08):** `qwen2.5:3b` extrajo JSON correcto en 4 casos (limpio, completo,
  pozo+agua, trampa "y el gas ahí?" → entidad:null, correcto) + el regex `extraer_json()` funcionó, ~10.5 tok/s.
- **⚠️ Parity dev/prod:** en dev se valida la LÓGICA con `qwen2.5:3b`; en prod corre `gemma4:latest`.
  Como el prompt few-shot puede comportarse distinto entre familias, **revalidar los golden examples
  contra `gemma4:latest`** antes del despliegue final.

---

## 5. Prompt de extracción (Paso 1) — contrato JSON

```
Campos: entidad (nombre|null),
        nivel ("vicepresidencia"|"gerencia"|"activo"|"area"|"campo"|"pozo"|"filial"|null),  ← PISTA, Python valida (§7.6)
        producto ("aceite"|"agua"|"gas"|"blancos"|null),   ← "agua" se ACEPTA y luego se rechaza+puentea (D3)
        periodo (texto|null), agregacion ("promedio_diario"|"acumulado"|null)
```
Notas: **`entidad` es singular en v1**; pasa a `entidades: []` en v2 (G1). El `nivel` cubre los **7 niveles
reales + `filial`** (corrige V-F: el enum anterior `activo|campo|pozo` era anterior a los hallazgos del catálogo).
Reglas: "Devuelve SOLO el JSON". Backstop en Python: regex `\{.*\}` + `json.loads`; si falla →
reintentar o pedir reformular. **Una falla del LLM nunca llega al usuario como error feo ni número inventado.**

---

## 6. Endpoints planeados (nuevos)

| Endpoint FastAPI (:8000) | Proxy Flask | Propósito |
|---|---|---|
| `GET /analisis/catalogo` | `/api/analisis/catalogo` | Catálogo de entidades + niveles + flag colisión + fuente + `entidades_por_nivel` + `filiales` |
| `GET /analisis/densidad?entidad=` | `/api/analisis/densidad` | Densidad temporal (días/huecos + semáforo). **Con `entidad`** → filtra por fuentes ECP; `aplica_ecp=false` si la entidad no tiene grano diario |
| `GET /analisis/cobertura?entidad=` | `/api/analisis/cobertura` | Cobertura del reporte: 28 hojas por categoría, métrica=nº reportes. **Con `entidad`** → presencia por hoja |
| `GET /analisis/huella?entidad=` | `/api/analisis/huella` | (huérfano tras el reemplazo por Cobertura; se conserva, no lo usa el frontend) |
| *(Fase 3)* herramienta `produccion_por_nivel` | — | Ejecuta el intent y devuelve el número real |

---

## 7. Evolución de la fundación y formato de respuesta acordado (2026-07-08b)

> Sesión posterior a la implementación del Primario. Convirtió la fundación en **consultable por
> entidad** y fijó cómo debe **verse la respuesta** del Secundario. Todos los números están
> verificados contra la BD dev `daily_report_prod`.

### 7.1 De "Huella de datos" a "Cobertura del reporte"
El tercer módulo de la pestaña Análisis se rediseñó tras feedback del usuario:
- **Antes:** "Huella de datos" = 2 gráficos de barras (conteo de FILAS por fact/escenario) — se interpretaba mal
  y no cubría todas las hojas del reporte.
- **Ahora:** **"Cobertura del reporte"** = **una tabla** con las **28 hojas** agrupadas en 5 categorías
  (Producción ECP · Filiales · Comentarios · Hojas modeladas (visor) · Preservada en crudo (Bronze)),
  **filtrable por entidad**. Métrica = **nº de REPORTES** (`COUNT(DISTINCT reporte_id)`), NO filas
  (`SUM(ingesta_log.filas_insertadas)` sobre-cuenta ~26× por los upserts idempotentes — descartado).
  - Sin entidad → en cuántos reportes aparece cada hoja. Con entidad → en cuántos reportes aparece **esa
    entidad** por hoja (PRESENCIA): RAW ECP vía facts (exacto, indexado); resto vía `bronze.hoja_landing`
    (ILIKE sobre payload JSONB, ~10s, sin tocar los 62M de `fact_tabla_hoja`).

### 7.2 Filtro por entidad en Cobertura y Densidad (desplegable)
- Ambos módulos ganaron un **`<select>` agrupado** poblado desde `/analisis/catalogo`
  (`filiales` + `entidades_por_nivel`): grupos **Filial (empresa)** · Vicepresidencia · Gerencia ·
  Activo · Área · Campo · Fuente. Helper JS compartido `__anEntidadOpts` (sin duplicar).
- Ajustes de UX del heatmap de Densidad (por feedback): eje Y = **mes + año**; se **quitó** la barra de
  color y la columna "Huecos"; leyenda "celda coloreada = hubo dato / blanca = hueco"; hover con fecha+conteo.

### 7.3 🔑 Alineación de la resolución de entidad (Densidad ↔ Cobertura)
**Hallazgo:** la resolución inicial solo miraba `dim_fuente(nombre/campo/grupo1/activos)` → daba
respuestas **incoherentes** para filiales y vicepresidencias. Corregido: **ambos** módulos resuelven la
entidad con el **mismo criterio**:
- **fuentes** vía `dim_fuente` con `nombre/campo/grupo1/activos/gerencia/**operador**` (el `operador`
  captura filiales como Hocol), y
- **`vice_id`** vía `dim_vicepresidencia.codigo` (los 3 facts ECP tienen columna `vice_id`).

Verificado (nº reportes en `BDP_datos_dia`, antes → después de alinear):

| Entidad | Tipo | Antes | Después | Vía | Densidad |
|---|---|---:|---:|---|---:|
| **Hocol** | filial/operador | 0 | **79** | `operador` (13 fuentes) | 173 días |
| **VAS** | vicepresidencia | 0 | **68** | `vice_id=5` | 174 días |
| **CASTILLA** | campo | 60 | 60 | fuente/campo | 173 días |
| **America / Permian** | filial | 0 | 0 (correcto) | sin grano ECP | no aplica |
| **VAO/VPI/VRO/VRC** | vice sin filas | 0 | 0 (correcto) | vice sin datos en fact | no aplica |

`fact_produccion_dia_ecp` y `fact_produccion_mes_ecp` tienen `fuente_id`+`vice_id`; `fact_programa_ecp`
además `campo`/`area`. Vices con filas en el fact diario: GGN/GGS/GPU/VAS(174) · GOX(173) · VEX(50) ·
VFS(36); VAO/VPI/VRO/VRC = 0.

### 7.4 Caso de estudio HOCOL — entidad DUAL (base de la contrapregunta)
HOCOL tiene **dos identidades** en el modelo → el Secundario **debe contrapreguntar** antes de dar un número:

- **Ⓐ HOCOL como OPERADOR (detalle ECP)** — 13 fuentes (Ballena, Chuchupa, La Hocha, Cañada Norte,
  Guando, El Niño, Guando SW; gerencias GAN/GAO):
  - `fact_produccion_dia_ecp`: 13.960 filas · 173 días (26-nov-2025→17-may-2026) · 8 productos (gas y mezcla por campo).
  - `fact_produccion_mes_ecp`: REAL 1.086 · PPTO 735 · CONTABLE 666 · OPERATIVO 497.
  - `fact_programa_ecp`: 4.073 filas · 187 fechas.
- **Ⓑ HOCOL como FILIAL/EMPRESA (`empresa_id=1`)** — consolidado, sin desglose por pozo:
  - `fact_produccion_diaria`: 183 días (30-nov-2025→31-may-2026) · productos CRUDO+GAS · series **Real y Programa** (`tipo_id`) · métrica `valor_produccion`.
  - `fact_plan_mensual`: 24 meses (ene-2025→dic-2026) · **POP** (`pop_kbd`) presente pero **`ppto_kbd`=NULL** (deuda técnica del ETL: falta la fuente PPTO de filiales).
  - `fact_promedio_validado`: 34 filas (promedio mensual validado por producto).
  - 0 comentarios mencionan "Hocol".

Cifras reales de referencia (rama Ⓑ, último día disponible 17-may-2026): crudo real 19.473 vs programa 19.678
(−1,0%); gas real 12.040 vs 11.557 (+4,2%). Promedio mayo (17 días) coincide con el promedio validado del reporte.

### 7.5 ✅ Formato de respuesta conversacional ACORDADO ("huella primero, número después")
Decisión de UX del Secundario: la respuesta **NO empieza por el número**, empieza por la **huella de la
entidad** (reusando los 2 endpoints de la fundación, ya filtrables y coherentes), y solo entonces
desambigua y entrega la cifra con trazabilidad. Estructura:

1. **① Huella temporal** (vía `/densidad?entidad=`): en qué rango/reportes hay datos, días con data, racha.
2. **② Huella temática** (vía `/cobertura?entidad=`): en qué grupos de hojas aparece la info numérica
   (Producción ECP / Filiales / Hojas modeladas / Bronze…), con nº de reportes por hoja.
3. **Contrapregunta encuadrada** por las huellas: las categorías vuelven **obvia** la elección de NIVEL
   (p.ej. Producción ECP = Ⓐ operador vs Filiales = Ⓑ empresa) → botones, no texto libre.
4. **Número con trazabilidad**: cifra directa + Real/Programa con semáforo de variación + bloque de
   **procedencia** (tabla origen · grano · rango · escenario) + salvedades honestas (p.ej. PPTO ausente,
   unidades distintas bbl/d vs kbd) + puente a la otra rama.

**Principio:** empezar por lo verificable (qué existe) antes de afirmar cifras → cero riesgo de inventar;
y las huellas materializan el principio **PROCEDENCIA ≠ FUENTE DE CÁLCULO** (§3) de forma visual.

**Matices de diseño CERRADOS (2026-07-08b):**
- **M1 — Grano de la huella temporal para entidades duales → CERRADO:** la huella muestra el rango de la
  **rama resuelta**; si la entidad es dual y aún no se desambiguó, mostrar **ambos rangos etiquetados (Ⓐ/Ⓑ)**
  en el perfil. En v1 la rama se fija en la contrapregunta → un solo rango tras resolver.
- **M2 — Qué grupos mostrar → CERRADO:** **solo grupos con presencia > 0**, con "ver todas" opcional (evita
  saturar con hojas en 0).

### 7.6 Resolver de entidad — arquitectura y frontera LLM/Python (2026-07-08b)

El **resolver** ("ubicar la entidad") es el corazón del Paso 2 del slot-filling. Decisión de diseño:

**Técnica elegida — lookup normalizado (hash) + fuzzy, NO embeddings/coseno.** El catálogo es un
vocabulario **cerrado y conocido** (~253 nombres) de **nombres propios y códigos** (RUBIALES, VAS, CPV,
GGN), no un espacio semántico. Por eso:
- ✅ **Núcleo = índice invertido normalizado** (dict `{nombre_norm: [identidades]}`), con normalización
  `upper + trim + colapsar espacios + unaccent` (⚠️ la BD guarda acentos/ñ reales → hay que plegar acentos
  en AMBOS lados o el match exacto falla). Determinista, O(1), cero falsos positivos, explicable.
- ✅ **Red de seguridad = `pg_trgm`** (ya viene en Postgres) para typos/variantes ("caño limon" →
  `CAÑO LIMÓN`). Devuelve **candidatos para confirmar**, nunca autoselecciona.
- ❌ **Coseno/embeddings DESCARTADO** para resolver entidades: los nombres propios/códigos no tienen
  vector semántico útil, rompe la regla "Python valida exacto (no adivina)", **no** desambigua colisiones
  (CASTILLA-campo vs CASTILLA-activo dan el mismo vector), y es sobre-ingeniería para 250 strings. (Sí
  tendría sentido, aparte y más adelante, para *intención semántica* — "pozos del meta" → area — que NO es
  ubicar la entidad.)

**Las 3 capas** (todas Python): (1) normalizar + lookup exacto (cubre ~99%) → (2) fuzzy `pg_trgm`
(similarity ≥ ~0.4, propone candidatos) → (3) si nada/ambiguo → contrapreguntar o pedir reformular.
La ambigüedad se decide por **cuántas identidades** trae la lista, NO por un score de similitud.

**🔒 Frontera LLM / Python (regla NO negociable) — el resolver es 100% Python; el LLM está *bookended*:**

| Etapa | Quién | Nota |
|---|---|---|
| Usuario escribe texto libre | — | entrada |
| **Extraer** texto → JSON `{entidad, nivel, producto, periodo, agregacion}` | 🟣 **LLM** | única tarea; **aguas arriba** del resolver; solo devuelve **strings** |
| Normalizar (`unaccent`/upper/trim) | 🟢 Python | |
| Capa 1 — lookup exacto en índice invertido | 🟢 Python | |
| Capa 2 — fuzzy `pg_trgm` (candidatos) | 🟢 Python + Postgres | propone, no decide |
| Capa 3 — decidir (¿dual? ¿colisión? ¿nada?) | 🟢 Python | reglas sobre la lista de identidades |
| Construir el índice invertido desde el catálogo | 🟢 Python (arranque) | lee la BD viva (el LLM no la conoce) |
| Ensamblar `perfil` (densidad + cobertura) | 🟢 Python | |
| **Redactar** la intro sobre el payload | 🟣 LLM (opcional) | **aguas abajo**, sobre números ya calculados; nunca inventa |

- **Contrato de la frontera:** lo único que cruza del LLM a Python son **strings crudos** (cero IDs, cero
  decisiones, cero acceso al catálogo). Python es el **único** que conoce el catálogo (nombres, niveles,
  `vice_id`, `empresa_id`, colisiones), normaliza, busca, puntúa y decide.
- **El LLM nunca ve el catálogo ni hace el match.** Razones: (1) determinismo/auditabilidad; (2) sin
  entidades alucinadas — Python solo acepta lo que existe; (3) el catálogo es **vivo** (el ETL agregó
  GGN/GPU/GOX/GGS) → Python lo lee en caliente, el entrenamiento del LLM no puede saberlo.
- **El `nivel` que extrae el LLM es una PISTA, no una verdad:** Python lo usa como candidato para
  desempatar una colisión SOLO si coincide con una identidad real; si no coincide, lo ignora y
  contrapregunta. Ej.: *"producción del **campo** Rubiales"* → LLM `{entidad:"RUBIALES", nivel:"campo"}`;
  Python resuelve RUBIALES → [campo, activo, gerencia, fuente]; pista "campo" ∈ identidades → fija campo y
  **evita** la contrapregunta.
- **Resumen:** materializa *"Python calcula, el LLM solo concluye"* en el punto de ubicar la entidad — el
  LLM **traduce lenguaje a slots** (entrada) y opcionalmente **redacta** (salida); Python es dueño del
  catálogo, del match (hash + `pg_trgm`), de la desambiguación y de todos los números.

Endpoints nuevos que esto implica (Objetivo Secundario): un **resolver** (`entidad → identidades/ramas`,
Python sobre el catálogo + `operador`/`vice_id`/`empresa` + `unaccent`/`pg_trgm`) y **`/analisis/perfil?entidad=`**
(orquesta resolver + densidad + cobertura → el JSON que arma la tarjeta "Esto es lo que tenemos de …").

### 7.7 Preguntas compuestas y multi-intent — reglas derivadas (2026-07-08b)

> ⚠️ **Alcance: v2/v3 (backlog), NO v1** (ver **D6**, §2). Estas reglas son restricciones que la
> arquitectura debe soportar al **generalizar**; el **v1 NO las implementa**. Se documentan como deuda
> planificada, no como requisito del primer entregable — mitiga el riesgo de scope creep.

Se analizaron dos preguntas reales bajo la óptica del diseño; ambas **validan la arquitectura** (nada la
rompe) y aportan 6 reglas/extensiones para el `plan:` del Secundario. Todo verificado contra la BD dev.

**Caso A — compuesta, multi-entidad, niveles distintos:**
*"¿variación mensual de producción de aceite para los campos Castilla y GOR?"*
- Verificado: **CASTILLA** = colisión dura (`fuente·campo·area·activo`); **GOR** = **gerencia** (NO campo —
  el usuario lo etiquetó mal).
- `aceite→crudo` (válido, no se rechaza). CASTILLA: la pista `nivel:"campo"` ∈ identidades → fija campo, sin
  contrapregunta. GOR: la pista `"campo"` **no** coincide → Python la ignora, resuelve **gerencia** + AVISAR.

**Caso B — multi-intent con drill-down jerárquico dentro de un scope:**
*"para la empresa Hocol, ¿variación % de producción del último trimestre 2026? ¿qué campo aportó más en
cada mes de ese trimestre?"*
- Verificado: producción REAL mensual de Hocol = **dic-2024 → may-2026** → **Q4-2026 NO tiene datos**.
- Un scope (Hocol, dual A/B) + **dos sub-intents a niveles distintos**: (1) variación % agregada, (2) top-1
  campo por mes. Sub-intent 2 exige **campo** → solo la rama **A (operador ECP)** lo soporta (la filial B es
  consolidada, sin campos) → el drill-down **desambigua la dualidad solo**. El periodo Q4-2026 lo atrapa la
  **huella temporal** ANTES de calcular. `producto=null` en entidad **gas-dominante** → el default `aceite`
  engañaría.

**Reglas / extensiones derivadas (a incorporar al `plan:` del Secundario):**

| # | Regla | Origen |
|---|---|---|
| **G1** | El JSON de slots pasa de `entidad` (singular) a **`entidades: []`** (lista); cada una se resuelve independiente y se juntan como **series** de un intent. | Caso A |
| **G2** | Comparar **niveles distintos** (campo vs gerencia) NO se bloquea: es un **slot blando** → AVISAR el desajuste de escala/granularidad. | Caso A |
| **H1** | Preguntas **multi-intent**: el intent pasa a **header `{scope, periodo}` compartido + lista `sub_intents[]`** (cada uno con su métrica/nivel/herramienta). | Caso B |
| **H2** | **Coherencia de rama:** si un sub-intent exige un nivel que **solo una rama soporta** (p.ej. campo → solo rama A operador), elegir esa rama para TODOS los sub-intents + AVISAR. El drill-down puede **desambiguar** una entidad dual sin contrapreguntar. | Caso B |
| **H3** | **Validar el periodo contra la huella temporal (densidad) ANTES de calcular** — guardrail duro; las fechas relativas ("último trimestre 2026") las resuelve **Python**, no el LLM. Si el periodo cae fuera de los datos → stop honesto + ofrecer el rango/último periodo disponible. **Corolario (R5):** el default blando "último mes/periodo" debe resolver al último **completo con datos** (no a un mes parcial como mayo hasta el día 17), o **avisar** el corte. | Caso B / R5 |
| **H4** | El default blando `producto=aceite` **engaña en entidades gas-dominantes** (Hocol). El default de producto debe ser **sensible al perfil** de la entidad, o hacer una contrapregunta ligera (crudo/gas/total). | Caso B |

**Principio transversal confirmado por ambos casos:** como **Python manda sobre el catálogo y los datos**
(no el LLM), una pista de nivel equivocada ("GOR es campo") o un periodo imposible (Q4-2026) **no** produce
un número inválido — se corrige (AVISAR) o se detiene (huella). El LLM sigue solo en los extremos.

### 7.8 Estado de código (sin commit aún, sobre `8913cee`)
Cambios aplicados y verificados a nivel de datos, **pendientes de verificación en navegador y de commit**:
`INGESTA/Rep_Prod/backend/app/features/analisis/api.py` (cobertura filtrable + `_presencia_entidad`
alineado + densidad con `entidad`/`vice_id`/`operador`), `routes/api.py` (proxies `cobertura`/`densidad`
con `entidad`), `static/js/multitab_shell.js` (módulo Cobertura, desplegable en ambos módulos, ajustes del
heatmap), y este documento.

**Objetivo Secundario v1 — IMPLEMENTADO y VALIDADO (2026-07-08, sin commit).** Feature FastAPI `consulta`
(`normaliza`/`resolver`/`extraccion`/`maquina`/`api`) + golden set + fixtures + proxies Flask + **pestaña
Consulta como tab de 1er nivel del riel** (D2). Plan ejecutado (auditado, I1 corregido):
`INGESTA/Rep_Prod/Planes/plan_secundario_v1_slotfilling_2026-07-08.md`. Validaciones: V1 fixtures 5/5 · V2
resolver · **V3 golden 20/20=100%** (≥90%, `temperature=0`, corrido en lotes memory-safe) · V4 round-trip real
(Rubiales→botones→intent+huella 173 días) · V5 proxy · V7 no regresión. **V6 (navegador) pendiente** (fragilidad
de RAM). Hallazgo ops: el reinicio durante V3 fue **RAM** (qwen2.5:3b = 100% CPU 2.2GB + 2 backends + Postgres
en 8GB), NO la GPU; V3 corre estable con backends abajo. Caveats (honestidad): set mínimo (20 casos), una
expectativa ajustada por normalización, parity `gemma4` pendiente en prod (D7). Ver bitácora INGESTA S19.

---

## 8. Contrato del Intent y máquina de estados de la contrapregunta (v1) — 2026-07-08b

> Cierra las vulnerabilidades **V-B** (máquina de estados sin diseñar), **V-C** (gramática de periodo),
> **V-D** (schema del intent sin formalizar) y **V-E** (cache/latencia) de la evaluación crítica. Insight
> clave: **V-B y V-D son el mismo hueco por dos lados** — se fija el **schema primero** y la máquina de
> estados **cae sola** (el estado ES una función de `pendiente`).

### 8.1 Contrato del Intent (V-D) — la interfaz que consume Fase 3
Por **D1** el intent validado **ES el entregable** del Secundario. Schema pinneado (v1):
```
Intent {
  status:     "pendiente" | "completo"          // = (pendiente == null ? completo : pendiente)
  entidad:    { texto, resuelta: null | { nivel, rama:"A"|"B", ref:{fuente_ids[] | vice_id | empresa_id} } }
  producto:   "crudo" | "gas" | "blancos" | null
  periodo:    null | { tipo:"mes"|"ultimo_mes"|"mes_pasado", desde:date, hasta:date }
  agregacion: "promedio_diario" | "acumulado" | null
  pendiente:  null | { slot:"nivel", opciones:[ { label, nivel, ref } ] }   // lo que se está preguntando
  avisos:     [ string ]                                                     // defaults asumidos, reinterpretaciones
}
```
En v1 `entidad` es una sola y el único `pendiente` posible es la **desambiguación de nivel** en colisión dura.

### 8.2 Máquina de estados de la contrapregunta (V-B) — se dibuja sola sobre el schema
```
S0 EXTRAER   [LLM]  texto → slots crudos → Intent{status:pendiente}
S1 RESOLVER  [Py]   entidad → identidades (resolver §7.6)
                    · 1 identidad      → entidad.resuelta; pendiente=null; status=completo
                    · pista de nivel ∈ identidades → fija esa; status=completo
                    · ≥2 sin desempate → pendiente={slot:nivel, opciones}; status=pendiente → EMITE BOTONES
S2 ESPERAR   [—]    Intent parcial PERSISTIDO (ver 8.3); la UI muestra los botones
S3 REANUDAR  [Py]   click de botón → merge la opción en entidad.resuelta → pendiente=null →
                    status=completo → EMITE el intent y PARA (D1: no ejecuta)
                    · edge — el usuario IGNORA los botones y escribe: re-EXTRAER (S0). Si el nuevo texto
                      resuelve el slot pendiente → úsalo; si es otra pregunta → descartar el parcial y reiniciar.
```
No hay una "máquina" aparte que diseñar: **es una función de `pendiente`**. El *viaje redondo*
(pregunta → botón → resume → intent) queda explícito — lo que faltaba en V-B.

### 8.3 Persistencia del intent parcial
- **Dónde:** server-side, **keyed por `conversation_id`** (la app ya tiene conversaciones); NO en el cliente.
- **Ciclo de vida:** se crea en S1 (si queda `pendiente`), se consume en S3, se **descarta** al completar, al
  llegar una pregunta nueva no relacionada, o por **TTL** (p.ej. 15 min).
- **Un solo `pendiente` a la vez** en v1 (una entidad, un slot). Multi-slot/multi-entidad → v2/v3.

### 8.4 Gramática de periodo v1 (V-C) — acotada y determinista (Python)
- **v1 acepta:** mes absoluto (`"marzo"`, `"marzo 2026"`), `"mes pasado"`, `"último mes"`, `"este mes"`.
- **Implementación:** **mini-parser Python** (dict de meses ES + reglas relativas), NO `dateparser` pesado.
  Python es dueño de las fechas (coherente con §7.6). Resuelve a `{desde, hasta}` reales.
- **Fuera de v1 (→ v3):** trimestres/rangos relativos ("último trimestre 2026"), "YTD", "vs año pasado".
- **Guarda (H3):** el rango resuelto se **valida contra la huella temporal**; `"último mes"` resuelve al
  último mes **COMPLETO con datos** (no a un mes parcial), o avisa el corte (corolario R5).

### 8.5 Cache del índice invertido (V-E) — no opcional
- El **índice invertido del resolver** (`{nombre_norm: [identidades]}`, ~253 entradas) y las **huellas por
  entidad** se **construyen una vez al arranque** y viven en memoria → evita reconstruirlos por request.
- **Invalidación:** en la **ingesta** (cuando cambia el catálogo/los datos). Barato y acota la latencia de la
  1ª respuesta (extracción qwen CPU ~5–10s + cobertura ILIKE ~4–10s ≈ 10–20s sin cache).

---

## 9. Referencias

- `Ambi.md` — documento de discusión original (el *porqué* filosófico completo).
- Guia del sub-proyecto de INGESTA — modelo de datos (star schema), DDL, flujo audit-first.
- `INGESTA/Rep_Prod/db/ddl_v2_postgres.sql` — esquema real (facts, dims, vistas).
- Memoria del proyecto: `objetivos-capa-conversacional`, `modelos-ollama-dev-prod`, `entornos-dev-local-prod-139`.

# Cambios y Mejoras — Julio 2026

> Bitácora consolidada del mes, agrupada por semanas.
> Fuente: historial de Git (`main`) + bitácora de `CLAUDE.md`.
> Rango cubierto: **2026-07-01 → 2026-07-28** · **163 commits**.

---

## Resumen del mes

Julio fue el mes en que la **capa conversacional** dejó de ser un esqueleto y pasó a
responder con cifras reales, prosa generada por IA y un panel analítico completo; y en
que el proyecto adquirió por primera vez un **roadmap explícito** (las 7 épicas del
feedback gerencial) contra el cual medirse.

| Semana | Fechas | Commits | Eje principal |
|--------|--------|--------:|---------------|
| **Semana 1** | 1 – 5 jul | 3 | MultiTab Shell productivo + modelado de hojas RAW |
| **Semana 2** | 6 – 12 jul | 38 | Fundación visible (Análisis), slot-filling v1 y Análisis Ejecutivo (IA) |
| **Semana 3** | 13 – 19 jul | 34 | Fase 3: la cifra real + narración por LLM + catálogo Campo/Activo |
| **Semana 4** | 20 – 26 jul | 78 | Panel ejecutivo por niveles, Filiales, Diferidas, EBITDA y saneamiento de datos |
| **Semana 5** | 27 – 31 jul | 10 | Épica 2 (compromiso P50) + layout final del foco |

**Archivos más intervenidos del mes:** `static/js/multitab_shell.js` (101 commits),
`templates/main.html` (110, casi siempre cache-buster), `static/css/colapsable.css` (55),
`INGESTA/.../features/analisis/api.py` (51), `routes/api.py` (20).

---

## Julio · Semana 1 (1 – 5 de julio)

**3 commits** — 1 de julio.

### MultiTab Shell pasa a producción
- El shell de 3 zonas deja de ser prototipo y se integra a la app principal: al pulsar
  "Análisis avanzado de producción diaria", `MultiTabShell.mount()` oculta el layout de
  2 paneles y monta el shell a ancho completo (`static/js/multitab_shell.js` [NUEVO]).
- **Pestaña Ingesta** = flujo real de carga (reusa las funciones `ig*` de `chat.js`).
- **Pestaña Control** = árbol de reportes ingeridos año→mes→día→hojas→tablas (nuevo
  endpoint FastAPI `GET /tablas/arbol` + proxy Flask).
- **Modal de advertencia de sobreescritura**: pre-check `GET /ingesta/check_existing`
  ANTES de subir; si la fecha ya existe se ofrece *Sobrescribir* / *Cancelar* (cancelar
  resetea la dropzone completa).
- Commit `d5c2b2c`.

### Modelado de hojas RAW (INGESTA)
- `BDP_datos_dia` → `fact_tabla_hoja` (unpivot de 5 medidas, ~40.236 filas) + cap de
  1.000 filas en el visor + fix de scroll horizontal (`d6715bf`).
- `BDP_Programa` y `BDP_datos_mes` → `fact_tabla_hoja` (~314.952 filas, cubo multi-año)
  + visor rápido (`b606fbb`).
- Script `clean_bd.py` para vaciar la BD de desarrollo (`7ac93f1`).

---

## Julio · Semana 2 (6 – 12 de julio)

**38 commits** — 6, 7, 8 y 9 de julio. La semana más densa en features nuevas.

### Ingesta masiva y fix crítico de layout (6 jul)
- CLI `batch` interactivo y resiliente (un archivo con error ya no tumba el lote).
- 🔑 **Fix de pérdida silenciosa**: `load_fact_dia`/`load_fact_mes` resolvían columnas por
  **índice fijo**; el corpus de Febrero 2026 trae otro layout → se descartaba el **100%** de
  `fact_produccion_mes_ecp` sin error visible. Ahora resuelven **por nombre de encabezado**.
- **Hallazgo:** los archivos de Junio 2026 y Mayo 19-31 están **cifrados con contraseña**
  (firma OLE2) → no ingeribles. Commit `188657a`.

### Rendimiento del árbol de Control + despliegue (7 jul)
- Con >50 M filas en `fact_tabla_hoja`, `/tablas/arbol` tardaba **minutos**. Se partió en
  3 capas: árbol año→mes→día (0,2 s), nuevo `GET /tablas/arbol/{reporte_id}` bajo demanda
  (0,2 s vs 16 s) y **carga perezosa** en el frontend (`e617d39`).
- `desplegar_version.bat` [NUEVO]: `git pull` → migraciones pendientes → reinicio de
  backends. Migración `006` (índice cubriente) versionada (`beffefe`).

### Fundación visible: pestaña Análisis (8 jul)
- Nueva feature FastAPI `analisis` (solo lectura, sin LLM) con **Catálogo de entidades**,
  **Densidad temporal** (heatmap) y **Cobertura del reporte**, filtrables por entidad.
- 🔑 **Alineación de resolución de entidad**: antes solo `dim_fuente`; ahora resuelve por
  6 columnas + `vice_id` → Hocol pasa de 0 a 79 reportes, VAS de 0 a 68.
- Commits `8913cee`, y verificación end-to-end con Playwright.

### Capa conversacional v1 — slot-filling (8 jul)
- Nueva feature `consulta`: `normaliza` / `resolver` (índice invertido) / `extraccion`
  (LLM + grounding Python) / `maquina` (estados S0-S3) / `api`.
- **Pestaña Consulta** como tab de 1er nivel del riel; chat real en el panel izquierdo con
  historial persistente y personalización por nombre de usuario.
- 🔑 **Fix de identidad dual Hocol** en `_huella` (resuelve por la columna EXACTA del nivel).
- **Backstop del resolver** (`buscar_en_texto`) para cuando el LLM devuelve `null`.
- Golden set **20/20 = 100%**. Commits `b256304`, `a4f246c` (LLM parametrizable por `.env`),
  `5ccdcd4` (health-check de Ollama respeta `OLLAMA_BASE_URL`).

### Día grande: 9 de julio (31 commits)

**a) Chat "Asimétrico esencial" + acciones**
- Rediseño visual completo del chat de Consulta con clases propias `.rb-chat*` (burbujas
  asimétricas, avatares, opciones como filas con tile+chevron). Commit `3032c42`.
- Tarjeta **"Entidad identificada"** accionable con 2 acciones de siguiente paso (`35d0865`).
- **"Ver el reporte de un día" activado**: árbol de hojas/tablas + visor de tabla en el
  panel derecho, sin backend nuevo (`4ed4a10`).

**b) Análisis Ejecutivo (IA) — brief multi-sección**
- Nuevo `GET /analisis/ejecutivo`: 4 secciones (insights / oportunidades / puntos de
  atención / decisiones) donde **Python calcula y Gemma pule** (`26eae6c`).
- El composer determinista `_ejec_fallback` es entregable de primera clase; el pulido LLM
  es opcional vía flags `EJECUTIVO_USAR_LLM` / `EJECUTIVO_FALLBACK`.
- 🔑 **Saga de la salida de Gemma** (resuelta con diagnóstico `meta.llm_diag`):
  1. Prompt con **lexicón plano** (evita la palabra "gap"), few-shot con nombres ficticios (`4175b2f`, `150a12a`).
  2. `json_invalido` #1 = **JSON truncado** → `num_predict=2048` (`45de86b`).
  3. `json_invalido` #2 = **comillas tipográficas** → `"format":"json"` + parser tolerante (`9d220d2`).
- **Gemma ANALIZA, no describe**: Python pre-deriva la tesis (`sintesis`) y el prompt exige
  narrarla (`be8325b`).
- **Panel de 2 columnas**: brief a la izquierda + **gráficos SVG nativos** a la derecha
  (bullet Meta vs Real + balance por campo divergente), con selector Crudo/Gas/Blancos y
  estirado al alto disponible (`aac7aa0` → `5eff18f`).

**c) Primeros módulos del "Desempeño del mes"**
- Desempeño del mes + Titular ejecutivo IA automático (`2184b22`), multi-tab de análisis con
  rail de previews (`2470072`), grid de 3 columnas a alto completo y varios fixes de
  alineación de la curva diaria (ResizeObserver, `7114225`), caché del desempeño y del
  titular para no regenerarlo al interactuar (`ddb7299`).

**d) Utilidades de operación**
- Scripts `renombrar_mes_reportes.py` y `crear_encabezados_reportes.py` [NUEVOS] (`a9a39a9`, `9ecac12`).
- **Hallazgo de ops:** el upload NEW por navegador es **síncrono** → dejó un lock en
  `config_reporte` que hubo que matar con `pg_terminate_backend`. Solución pendiente:
  volverlo asíncrono con job + progreso.

---

## Julio · Semana 3 (13 – 19 de julio)

**34 commits** — 15 y 16 de julio. La semana en que la Consulta pasó de "intención
validada" a **cifra real narrada en prosa**.

### 15 de julio — Fase 3 y Fase 3.1

**Ejecución determinista (Fase 3)** — `ejecucion.py` [NUEVO]
- `ejecutar()` devuelve la cifra **REAL vs PPTO** del mes reusando `analisis.desempeno`,
  garantizando por construcción que **chat y tablero no puedan divergir** (`2a76602`).

**Desambiguación por colapso** (`dbe3095`)
- `clave_fisica` + `_resolver_colision`: cuando un nombre colisiona pero todos los niveles
  apuntan al mismo `fuente_id` (~70 % de 152 colisiones) se auto-resuelve a **Campo**.
- **D-D5 · Prioridad Campo** (`676da9c`): en colisiones genuinas responde directo como
  Campo y ofrece **zoom a Activo** con nota + botón que reusa `responder()`/S3.

**Narración por LLM (Fase 3.1)** — `narracion.py` [NUEVO]
- "Python calcula, el LLM redacta": el JSON ya calculado se entrega a Gemma para 2-4
  oraciones personalizadas; frontera dura (**no recalcula**), flag `CONSULTA_NARRA_LLM`,
  salvaguarda **D-N5** (volumen literal) y fallback determinista (`8940cf2`).
- 🔑 **Fix decisivo** (`bde9524`): gemma4@139 **devuelve vacío en texto plano**; solo
  responde con `format:"json"`. Con eso, la prosa salió viva en el servidor.

**Cimiento nivel + periodo** (`a256aac`) — los endpoints dejan de ser nivel-ciegos (OR de
6 columnas) y periodo-ciegos (siempre `MAX(fecha)`).

**Valle explicado POR la entidad** (`5d7dcc7`) — antes mostraba eventos globales TIBU/CARACARA.

**Panel "Desempeño Filiales"** [NUEVO] (`0d32413`) — replica el panel sobre
`fact_produccion_diaria`; meta = PROGRAMA (no existe PPTO para filiales) y comparación
**misma-ventana** → cumplimiento realista ~100 % en vez del falso 57 %.

**Ops:** `migra.py` + `deploy_zip.py` [NUEVOS] para empaquetar y desplegar versión portable
en `.zip` (`b1f66ec`); puerto de INGESTA 8000 → **8088** (`04aef10`); fix del venv de Flask
auto-reparable (`211b227`).

> 🔧 **Incidencia:** un reinicio corrompió `refs/heads/main` y `.git/index`; el commit
> `8940cf2` quedó *dangling* y se recuperó reescribiendo el ref — **0 pérdida**.

### 16 de julio — Catálogo Campo/Activo y narración honesta

- 🔑 **El ACTIVO no estaba en la BD**: ninguna columna de `dim_fuente` lo era. `activos`
  era un bucket de **portafolio** (para APIAY agrupaba 13 campos en vez de 4 → cifra
  errónea). Se siembra el catálogo real (**52 activos**) con la migración **008** y
  `data/Activo_campo.csv` [NUEVO] (`c3c04b4`).
- **Rollup honesto (D-A4)**: 15 de 128 campos producen sin meta → se **declaran** en avisos
  en vez de fabricar un PPTO.
- **D-A5**: la respuesta dice el nivel ("el **Campo** APIAY" vs "el **Activo** APIAY").
- **Preguntas meta de catálogo** ("¿qué tipo de entidad es CPO-09?") **100 % deterministas**
  tras un experimento fallido en que el LLM inventaba relaciones falsas (`08047e1`, `5738382`).
- **Narración en 2 etapas** "Python borronea, Gemma reescribe" (`94f74d3`): el borrador es
  correcto Y es el fallback; el LLM solo reescribe (temperature 0.7) → adiós monotonía.
- 🔑 **La cifra del mes en curso es una PROYECCIÓN**, no el acumulado — y ahora lo dice
  (`7c45480`); + ritmo diario real **BOPD-avg** (`da61b7e`); estructura final: primero lo
  producido, luego la proyección, luego el % de la meta (`fc713e2`).
- **El Ejecutivo deja de inventar rezago** cuando no lo hay (`34f6623`); el `json_invalido`
  resultó ser un **aborto de Ollama**, no un JSON malo → ahora se detecta y reintenta (`781c729`).
- Panel de chat **+50 % de ancho** acumulado (372 → 581 px).

---

## Julio · Semana 4 (20 – 26 de julio)

**78 commits** — 21, 23, 24, 25 y 26 de julio. La semana más voluminosa del mes.

### 21 de julio — Panel ejecutivo por niveles + Filiales (33 commits)

**Nivel 1 · Tarjetas KPI de cierre** (`ddb2b73` → `8cac1d7`)
- Reemplazan los chips-semáforo: barra proyectado-vs-meta + brecha en unidades reales +
  badge de estado por producto. Eje de estado propio `_estado_cierre()`.
- Barra de **ritmo diario** (real vs requerido) en Crudo, luego extendida a Gas; Blancos
  queda solo con proyección porque su fact diario no reconcilia.
- **GAS = MSCF**, unidad declarada en código; nunca se fabrica "bbl".

**Nivel 2 · Focos de atención** (`d25431b`)
- Franja de hasta 5 focos (gap por producto + valle de crudo) **rankeados por score Python,
  sin LLM**; los focos pasan a ser SIEMPRE el cuerpo del panel (`2fa2dfd`).
- Fallback a **promedio del año** como meta cuando no hay PPTO/PROGRAMA (`83c6890`), y los
  productos sin PPTO que proyectan bajo su promedio **sí son foco** (`bedd05b`).

**Filiales de punta a punta**
- El chat responde por **filial (rama B)** con tendencia vs su promedio 2026 (`977092c`).
- **D-D6**: las 3 filiales son un solo tipo → Hocol resuelve directo como filial, con zoom
  al sentido ECP (`42f3305`).
- Panel de filiales: panorama agrupado + **desglose por filial** en acordeón exclusivo con
  chips de estado (`939c21a`, `da83fa1`, `7f18d9e`), gráfico de evolución mensual de doble
  eje (`406e8ac`) y panel **exclusivo** por filial (`81b3a69`, `0c22752`, `ff9dad4`).
- Fix de **caché cruzada** auto-sanable (ECP mostrándose bajo Filiales) (`e5daa9b`).

**Comportamiento diario**: barras + promedio a base diaria y valle resaltado (`d9b9830`);
el gráfico izquierdo sigue al **foco #1**, no siempre a crudo (`3107015`).

### 23 de julio — Saneamiento de la BD ECP_DIFERIDAS + unidades (16 commits)

Seis migraciones sobre `ECP_DIFERIDAS` (1,14 M filas), todas validadas en copia antes de
aplicar y con rollback incluido:

| Migración | Problema | Efecto |
|-----------|----------|--------|
| **001** | El BOPD 2025 usaba **dos divisores** (/181 y /212) → 17,1 % de diferencia para el mismo indicador | Nueva vista `DIM_CORTE` calcula los días desde los datos; 11 vistas, 69 sustituciones |
| **002** | Patrón "detalle + bucket otros" roto: el filtro de *otros* estaba **comentado** → cada fila contada **dos veces** | 4 vistas Pareto/Nodo caen ×0,500 y reconcilian 1,000× |
| **003** | `BOPD` cambiaba de **significado** según el año → sumar 2025 daba **7,0× inflado** | Un solo criterio vía `DIM_CORTE`; sin caducidad |
| **004** | Fechas en 2 formatos (ISO + texto local 12 h) → `MIN/MAX` devolvían **orden alfabético** | 4 columnas nuevas ISO + `DUR_HORAS`; parser validado 60.000/60.000 |
| **005** | `END_DATE` usa **centinelas** en el futuro (2124, 2125…) para "evento abierto": 18.972 filas inflaban la duración media **122×** | `EVENTO_ABIERTO` (0/1) y `DUR_HORAS` a NULL |
| **006** | La BD **no tenía ni un índice** sobre 1,14 M filas | 4 índices + ANALYZE → **~1,32×** más rápido, **0 MB** de crecimiento |

- Migración **009** (`6493385`): completa 5 huecos del mapeo CAMPO→ACTIVO usando DIFERIDAS
  como fuente (cierra la deuda de AULLADOR → LISAMA); 0 regresión verificada.
- 🔑 **Fix de unidades del gas** (`befc193`): la mensual compacta y la diaria en crudo
  llevaban la **misma etiqueta MSCF** → la diaria parecía mayor que la mensual (físicamente
  imposible). Ahora el gas se expresa siempre en MSCF (÷1e6), consistente día/mes.
- Los focos **solo listan lo que está por debajo**: se retira el foco tipo "valle"
  (un valle recuperado no es un rezago vigente) y se quitan los textos de diagnóstico (`235aab4`).

### 24 de julio — Sección Diferidas + rediseño A+C (14 commits)

- **Sección "Diferidas"** del acordeón de foco (`357a885`): Pareto por grupo de causa (N2)
  apilado por año, tabla de tendencia por tipo (N4) con semáforo, y pozos afectados por
  grupo. 🔑 **Métrica = INCIDENTES**, no filas: `AVM_DATADIF` es grano **día-pozo**
  (CUSIANA: 516 filas = **278 incidentes**). Ruta Flask **nativa** sobre el SQLite.
- **Rediseño A+C del "Desempeño del mes"** (`124959c`): tarjetas KPI con **anillo** de
  cumplimiento + chip de estado (Fase 1) y focos con **pills master-detail** en vez del
  acordeón apilado (Fase 2).
- **Rendimiento de Diferidas**: de ~3,5 s a ~0,2 s con **un solo escaneo** + caché en memoria
  (`92081a5`), más caché en el frontend para repintar instantáneo al volver (`f09125d`).
- Fixes: **mojibake** de tildes (la ruta decodificaba latin-1 sobre una BD UTF-8), tarjetas a
  la misma altura y "Comportamiento por tipo" solo lista lo que **empeora** (`52c0dcb`);
  "Desempeño Filiales" se reactiva al volver al panorama global (`2859874`).
- ⚠️ **Bloqueo de deploy**: `ECP_DIFERIDAS.db` pesa **954 MB** → no cabe en Git; en el
  servidor 139 la sección queda sin datos hasta subir la BD manualmente.

### 24 de julio — Backlog de 7 épicas (feedback gerencial)

Se auditó cada épica pedida por la gerencia **contra el código real**, para fijar el
avance real vs el percibido:

| # | Épica | Estado al 24-jul |
|---|-------|------------------|
| 1 | Atribución cuantitativa del gap | 🟡 ~90 % (el backend ya lo calcula; faltaba mostrarlo) |
| 2 | Baseline P50 vs compromiso + seguimiento | 🔴 ~5 % (solo maqueta hardcodeada) |
| 3 | Modos por instancia de reporte | 🔴 0 % |
| 4 | Mapa semáforo + severidad por campo | 🔴 0 % |
| 5 | Explicación de desviaciones ↔ proyectos | 🟡 ~20 % |
| 6 | Traducción a plata / margen | 🔴 0 % |
| 7 | Experiencia móvil-ejecutiva | 🔴 0 % |

### 25 de julio — Cierre de Épicas 1 y 5 + hallazgo de BLANCOS (7 commits)

- **Fix de unidades** en `__cnGapCampoInto`: el panel dividía **todo** entre 1e6 y rotulaba
  crudo/blancos como "bbl" → mostraba "0,26 bbl" cuando eran **260.000 bbl**. Ahora gas en
  MSCF y crudo/blancos en **bbl reales**.
- **Verificación de los campos en 0,00** contra la BD: ARAUCA (gas) y PAUTO SUR (blancos)
  son **detractores reales**, no huecos de datos — la prueba estaba en el fact **diario**
  (0 explícito 30+17 días = paro real).
- 🔑 **Deuda técnica descubierta:** a grano mensual un paro real aparece con la **fila REAL
  ausente**, no como 0; el panel coacciona *ausente→0*. Un hueco genuino de ingesta se vería
  idéntico → riesgo de **detractor falso** (hoy no produce ninguno).
- **Épica 1 → 🟢 cerrada** (atribución cuantitativa del gap, unidades honestas, 0,00 verificados).
- 🔑 **Hallazgo BLANCOS (irreconciliable):** la tarjeta KPI decía 72 % y su curva diaria
  134 %. La auditoría descartó la hipótesis de `concepto` y encontró la causa real: el fact
  **diario** de BLANCOS suma **corrientes físicas** (GLP/CONDENSADO/…) mientras el **mensual**
  es un agregado "GAS CONVERTIDO MME" → **dos modelos de negocio del mismo producto**.
  Sin arreglo técnico posible con los datos actuales. **Paso 1 aplicado:** BLANCOS ya no
  compara su curva vs el promedio 2026; Crudo y Gas (que sí reconcilian) lo conservan.
  Documento nuevo: `INGESTA/Rep_Prod/HALLAZGO_concepto_multiplicidad.md`.
- Refinamiento del foco: barra "Producción {mes} vs Producción esperada", millones con 2
  decimales, eje X por día del mes, título unificado de la curva diaria.

### 26 de julio — Impacto de Diferidas, EBITDA y Épica 4 (8 commits)

- **Épica 5 · redefinida e implementada** (`f9d691c`): la sección Diferidas deja de mostrar
  *frecuencia* y pasa a mostrar **IMPACTO por causa NV04 en volumen perdido** (bbl / MSCF)
  — el "de esos X barriles, Y por tal causa" que pedía la gerencia. 🔑 La **unidad del gas
  se verificó antes de implementar**: la fracción perdido/producido del gas cae en la misma
  banda que el crudo (0,1–0,9 % vs 0,2–2 %) → el ÷1e6 es honesto.
- **Épica 6 · EBITDA-NOPAT** (`d6302f8`): 4.ª pill en cada foco con **waterfall
  Ingresos→NOPAT** (18 componentes) leyendo la BD fuente de Robustez, SVG vanilla con
  toggle KUSD↔USD/BI. Gas/Blancos en blanco (la fuente solo tiene economía de crudo).
- **Focos**: los 3 productos siempre en orden fijo Crudo→Gas→Blancos (`31c786e`); el
  desglose por campo muestra detractores **y** compensadores (`c27309b`); color de barra por
  banda de cumplimiento (`e678934`).
- **Épica 4 · en pausa por datos, no por código:** la severidad por campo ✅ y la tecnología
  de mapa ✅ ya existen, pero **solo 71 de 139 campos (51 %) tienen lat/lon** — y entre los
  68 sin coordenadas hay **focos activos** (CAJUA, CAÑO LIMÓN, PAUTO SUR). Un mapa que omite
  los peores campos sería engañoso → decisión del usuario: **pausar**.
- **Decisión de alcance:** se retira "modelar proyecto" de la Épica 5 — no existe fuente de
  datos de portafolio de proyectos en los `.xlsm`.

---

## Julio · Semana 5 (27 – 31 de julio)

**10 commits** — 27 y 28 de julio.

### 27 de julio — Épica 2: baseline P50 vs compromiso (4 commits)

- **Ingesta del bloque RETO CORPORATIVO** de la hoja *P50 Acumulado* = el **"compromiso"**
  de la Épica 2 (`3c9a4bd`). 🔑 De paso se arregló un **bug preexistente**: la Tabla 2
  arrastraba el bloque RETO + basura y **conflaba** Filiales con RETO-ECP → colisión
  `(dims,fecha)` last-wins con dato pisado en la BD (87-89 filas donde deben ser 48).
- 🔑 **Hallazgo de escala (el riesgo central):** `fact_produccion_mes_ecp` y el mundo P50
  **no reconcilian** — el factor por producto es inconsistente (crudo 5,8× · gas 36× ·
  blancos 2×) → son sistemas de unidades distintos. No se puede poner la Real del tablero
  junto al P50 sin mentir.
- **BLANCOS resuelto** vía la hoja **`REPORTE_PRESIDENT`** (`233475f`), **única fuente** con
  Real/Proy/Base P50 + compromiso de los 3 productos en kbpe corporativo.
- Nuevo endpoint **`/analisis/president`** + proxy Flask (`09d8c77`) y script
  `reingesta_hojas_nuevas.py` [NUEVO] para re-ingesta targetada y limpieza en 139.
- **Frontend opción A** (`8f6f4e4`): el **encabezado (ECP) pasa a ser el compromiso P50**
  (3 tarjetas con anillo, con BLANCOS) y las **tarjetas operativas de HOY** (BOPD vs PPTO +
  proyección) **bajan a cada "Comportamiento diario"**. Dos referencias distintas y
  **rotuladas** → sin contradicción. Verificado: Crudo 96,8 % / Gas 101,9 % / Blancos 100,1 %.

### 28 de julio — Layout final de las 3 tarjetas del foco (6 commits)

- La tarjeta operativa deja de ser **fila suelta** arriba (con hueco a su derecha) y pasa a
  ser la **1.ª columna del mismo grid** → 3 tarjetas en fila: **KPI | curva diaria | brecha
  por campo**, con reparto 30 % / 35 % / 35 % y **alto igualado** (`402cd93` → `2c87109`).
- 🔑 **Causa del hueco que persistía:** `.cn-kpi__row--solo` tenía un tope **`max 360px`**
  heredado de cuando era fila de ancho completo — invisible mientras la columna era angosta,
  evidente al retraer el panel de chat (`060ddc5`).
- Alto del contenedor ~500 px → 250 px → **375 px final**; como el recorte solo *cortaba* el
  contenido, se **comprimió** el panel de brecha (barra 20→10 px, paddings/gaps reducidos)
  para que los ~5 campos quepan **completos** (`5fb1ecd`, `57d095c`).

### 29 de julio — Diagnóstico de Ollama en 139 (sin cambios de código)

- 🔑 **El error "Gemma falló (sin fallback)" NO era el modelo: era ARRANQUE EN FRÍO.**
  `/api/tags` respondía 200 con gemma4 presente y `/api/ps` lo mostraba residente. La prueba
  decisiva fueron dos `/api/generate` consecutivos:
  - 1.º: `total_duration` **342,3 s**, de los cuales `load_duration` **342,0 s** (la
    generación en sí: 69 ms + 136 ms).
  - 2.º inmediato: `load_duration` **0,64 s**, total **5,3 s** para 338 tokens.
  La primera petición real de la app caía dentro de esos ~342 s y **reventaba el timeout de
  200 s** del proxy Flask. **Fix estructural pendiente:** warm-up al arrancar Ollama en 139.
- **Persistencia del panel diagnosticada:** las cachés funcionan, pero hay una regla
  deliberada de **no cachear errores de Gemma** → mientras Ollama fallaba, cada visita
  re-disparaba el fetch. Hipótesis: se resuelve sola con Ollama caliente (pendiente de
  re-verificar).
- ⚠️ **Ops:** existen **dos clones locales** del mismo repo (`12112025_prodIA` y
  `ProdIA-2.0`); un commit local no se ve en la otra carpeta hasta `git push` + `git pull`.

---

## Estado del backlog al cierre de julio

| # | Épica | Estado |
|---|-------|--------|
| 1 | Atribución cuantitativa del gap | 🟢 **Cerrada** (25-jul) |
| 2 | Baseline P50 vs compromiso | 🟢 **Cerrable** — fuente + endpoint + UI listos; falta operarla en 139 |
| 3 | Modos por instancia de reporte | 🔴 0 % |
| 4 | Mapa semáforo por campo | ⏸️ **En pausa** — bloqueada por datos (49 % de campos sin lat/lon) |
| 5 | Explicación de desviaciones | 🟢 **Cerrada** en su alcance estructural/histórico (26-jul) |
| 6 | Traducción a plata / margen | 🟢 **Cerrable** — EBITDA-NOPAT en vivo (26-jul) |
| 7 | Experiencia móvil-ejecutiva | 🔴 0 % |

## Pendientes abiertos al 29 de julio

1. **Warm-up de Ollama en 139** para absorber el arranque en frío fuera de una petición de usuario.
2. **Re-ingesta de `REPORTE_PRESIDENT`** en dev y en 139 (script listo) — el encabezado de la
   Épica 2 está bloqueado por **datos**, no por diseño ni código.
3. **Subir `ECP_DIFERIDAS.db`** (954 MB) manualmente al servidor 139.
4. **Irreconciliación de BLANCOS** (diario vs mensual): requiere **decisión de negocio**, no
   tiene arreglo técnico con los datos actuales.
5. **Endurecer el "absent→0"** del gap mensual (deuda técnica menor, hoy no bloqueante).
6. **Ingesta asíncrona** con job + progreso (hoy el upload NEW es síncrono y deja locks).
7. Las 3 filas del mockup que faltan en la tarjeta P50 (Proyección cierre · Programa día · Real día).

---

*Documento generado el 2026-07-29 a partir del historial de Git y la bitácora de `CLAUDE.md`.*

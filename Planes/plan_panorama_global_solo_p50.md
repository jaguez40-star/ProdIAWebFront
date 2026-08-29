# Plan — Panorama global: solo tarjetas P50, saludo estático, sin LLM

**ID tarea:** `panorama_global_solo_p50`
**Fecha:** 2026-08-24
**Versión:** v2 (auditada — flujo profesional §15: Mapeo → Auditoría → Diagnóstico)
**Proyecto:** ProdIA 2.0 (ECP Insights Flask)
**Raíz absoluta:** `c:\APLICACIONES\ProdIA\12112025_prodIA\ProdIA-2.0\ProdIA-2.0\`

---

## 1. Contexto

`/mainchat` (y el layout clásico `/`) tienen un panel de análisis que muestra un
reporte "Desempeño del mes". Cuando el usuario abre la Consulta **sin preguntar por
una entidad** (arranque, o "Volver al panorama"), se pinta el **panorama GLOBAL** con:

1. **Bloque 2** — 3 tarjetas P50 ("ECP · Cumplimiento del compromiso corporativo").
   Determinista, endpoint `/api/analisis/president` (SQL puro, sin LLM).
2. **Bloque 3** — "Focos de atención · rankeados por impacto".
3. **Bloque 4** — gráficos por producto ("Ejecución diaria vs presupuesto", etc.).

Los bloques 3 y 4 vienen de `/api/analisis/ejecutivo`, que **puede invocar al LLM
(Gemma)** y es la parte lenta (timeout de proxy 200s; ~180s de latencia LLM en
producción si `EJECUTIVO_USAR_LLM=true`; ~342s si el modelo está frío).

Además, el **saludo del chat** hoy es **dinámico**: se arma con datos de
`/president` + `/desempeno` + `/ejecutivo`, y muestra un spinner *"Consultando con la
IA, puede tardar un momento…"* mientras espera.

Todo se renderiza client-side en **un solo archivo**: `static/js/multitab_shell.js`
(5375 líneas).

### La MISMA función pinta dos cosas distintas

`window.__cnAnalizar(entidad, …)` (`multitab_shell.js:1550`) sirve a tres flujos:

| Flujo | Llamada | Puntos de entrada |
|---|---|---|
| **Panorama GLOBAL ECP** | `entidad = null`, segmento `ecp` | `:425` (arranque), `:1237` (`__cnVolverPanorama`), `:1537` (tab Desempeño sin entidad) |
| **Insight de una pregunta** | `entidad = "Castilla"`, … | `:5218` (`__cnReanalizar`), `:5337` (`__cnRender`), `:1537` (tab con entidad activa) |
| **Tab Filiales** | `entidad = null`, segmento `filiales` | `:1540` |

> 🔴 **REGLA CENTRAL:** los bloques 3/4 se omiten **solo en el panorama GLOBAL ECP**.
> El flujo de Insight por entidad y el tab Filiales quedan **idénticos**. No se borra
> ninguna función: se hacen condicionales.

---

## 2. Objetivo

En el **panorama GLOBAL ECP** (y solo ahí):

1. Mostrar **únicamente** las 3 tarjetas P50. Omitir bloques 3 y 4.
2. **No** disparar `/api/analisis/ejecutivo` ni `/api/analisis/desempeno` — ni en el
   render ni en el **prefetch de arranque** (§5, H7). Solo el fetch rápido a
   `/api/analisis/president`.
3. **Saludo 100% estático**: sin datos de producción, sin spinner "Consultando con la
   IA…", sin llamadas al backend.

**Sin cambios** en: Insight por entidad, tab Filiales, backend, y la pila de
respuestas del chat (`analiza_foco`).

---

## 3. Prerequisitos

| # | Requisito | Verificación |
|---|---|---|
| 1 | Estar en la raíz del proyecto | `ls app.py static/js/multitab_shell.js` → existen |
| 2 | `multitab_shell.js` tiene 5375 líneas | referencia para ubicar bloques |

> ⚠️ **Los venv locales están rotos** (apuntan a un usuario Windows inexistente). La
> **verificación §8 se hace en el servidor de pruebas**.

---

## 4. Inventario de archivos

| # | Ruta absoluta | Acción |
|---|---|---|
| 1 | `...\static\js\multitab_shell.js` | 4 ediciones (PASOS 1, 2, 3, 4) |
| 2 | `...\MainChat\templates\mainchat_layout.html` | cache-bust (PASO 5) |
| 3 | `...\templates\main.html` | cache-bust (PASO 5) |

**No tocar:** backend (`INGESTA/`, `routes/`), CSS, ni ningún otro JS.

---

## 5. Auditoría — hallazgos que condicionan la implementación

> El v1 de este plan tenía cinco supuestos no verificados. Corregidos abajo.
> **Léela antes de tocar código.**

### H1 🔴 — El disparo de bloques 3/4 son DOS líneas, y el gancho ya existe

`__cnAnalizar` (`:1550`) ya calcula `var esGlobal = !entidad;` (`:1556`). Los dos
fetches caros se disparan **incondicionalmente**:
- `window.__cnAnalisisEjecutivo(entidad);` — **`:1596`** → `/ejecutivo` (bloques 3/4).
- `fetch("/api/analisis/desempeno" …)` — **`:1600`** → `/desempeno`.

### H2 🟢 — Las tarjetas P50 ya se suprimen en drill-down; hay que INVERTIR para global

`__cnRenderEjecutivo` (`:3895-3900`): en global pinta el label P50 + placeholder
`#cn-p50-row`; en entidad `kpiHeader = ""` (comentario `:3891-3894`).
`__cnPaintP50Header()` (`:3396-3412`) es **autónomo**: busca `#cn-p50-row` por id y
hace `fetch("/api/analisis/president")`. No depende de `__cnRenderEjecutivo`.

### H3 🔴 — El saludo se alimenta de TRES fuentes

`__cnSaludoHtml()` (`:4338-4376`) usa `__cnSalDes` (`/desempeno`), `__cnSalP50`
(`/president`, disparado DENTRO de `__cnSaludoDesdeDesemp` en `:4395`) y `__cnSalEje`
(`/ejecutivo`). `__cnSaludoPanorama()` (`:4290-4336`) redacta los bullets y devuelve
`"__LOADING__"`, que pinta el spinner *"Consultando con la IA…"* (`:4351-4354`).

Con el saludo estático, basta que `__cnSaludoHtml()` deje de llamar a
`__cnSaludoPanorama()`. Las inyecciones de `:1619` y `:2358` quedan inertes porque sus
fetches ya no corren en global.

### H4 🟢 — `#cn-desemp-body` puede faltar sin romper nada

Cuatro usos (`:1588, 1603, 1611, 1623`). Los de lógica están dentro del
`.then()`/`.catch()` del fetch de `/desempeno` — que en global ya no corre — y todos
guardan con `if (body)` / `if (!body) return;`. Además
`.cn-desemp__body:empty { display:none }` (`colapsable.css:1059`).

### H5 🟠 — El saludo pierde el corte de fecha, y es aceptable

El saludo decía *"con corte a 12 de agosto"* (fechas de `/desempeno`, `:4342-4348`).
Con saludo estático desaparece — es el precio explícito de "un saludo sin nada
dinámico". El período sigue en las tarjetas P50.

### H6 🔴 — `.cn-ejec-top` tiene `border-bottom` y su CSS espera un hijo `.cn-ejec-body`

**Corrección al v1 de este plan.** `colapsable.css:1327-1328`:
```css
.cn-ejec-top { padding: 12px 16px 6px; border-bottom: 1px solid var(--rb-border, #e3e8e5); }
.cn-ejec-top .cn-ejec-body { width: 100%; }
```
El v1 inyectaba el label P50 **directamente** en `#cn-ejec-top`, sin el wrapper
`.cn-ejec-body`. Eso deja un **borde inferior colgando** bajo las tarjetas P50 sin
nada debajo (antes lo justificaba el bloque de focos que venía después).

→ **Solución (PASO 1):** envolver el contenido en `<div class="cn-ejec-body">` (para
conservar el `width:100%` que espera el CSS) y añadir la clase modificadora
`cn-ejec-top--solo` que anula el `border-bottom` (PASO 4 la define).

### H7 🔴 — El PREFETCH de arranque dispara los MISMOS endpoints (el v1 lo omitía)

**Este es el hallazgo que más cambia el plan.** `__cnPrewarmGlobal()`
(`multitab_shell.js:1460-1489`) hace, al cargar la página y **antes** de que el
usuario abra el shell:
1. `fetch("/api/analisis/desempeno")` con la clave global, y encadenado
2. `fetch("/api/analisis/ejecutivo")` — con el comentario explícito *"deja a Gemma
   caliente"* (`:1445`).

Se expone como `MultiTabShell.prewarm` (`:5374`) y **se invoca desde
`templates/main.html:151`** (layout clásico; MainChat no lo llama).

Si no se toca, **el ahorro se pierde**: los fetches caros seguirían ocurriendo (solo
que antes, en segundo plano), y Gemma se seguiría invocando. El paso 2 del prewarm
(`/ejecutivo`) debe eliminarse; el paso 1 (`/desempeno`) también, porque en global ya
nadie lo consume.

> ⚠️ Efecto colateral **buscado**: al no precalentar, la primera pregunta de Análisis
> por entidad pagará el arranque en frío de Gemma. Ver §11.3 — decisión del usuario.

### H8 🟢 — `analiza_foco` (pila del chat) NO se toca

`__cnAnzCargarFoco` (`:2766`) también hace fetch a `/desempeno` + `/ejecutivo`, pero
pertenece a los bloques **`analiza_foco`** de la pila de respuestas del chat
(`:2878`), que sirven a **preguntas de Análisis**, no al panorama. **Queda intacto.**

### H9 🟢 — `__cnEjecD` / `__cnDesempData` quedan en `null` sin romper nada

Lectores: `__cnPaintFocoCharts` (`:1636`, guarda `if (!ed || !ed.focos || !dd ...) return;`)
y `__cnSeriesToggle` (`:3855`, guarda `&& __cnEjecD`, y vive dentro de
`.cn-foco__wrap`, que no se pinta en global). Sin riesgo.

### H10 🟢 — Clases CSS del header P50 ya existen

`.cn-p50hd__lbl`, `.cn-p50hd__u`, `.cn-p50hd__load`, `.cn-p50hd__na`, `.cn-kpi__row`
están definidas en `static/css/colapsable.css:1137-1148`. No hay que crear CSS para
el header (solo el modificador de H6, PASO 4).

---

## 6. Especificación

### PASO 1 — Panorama global: pintar solo P50, sin fetches caros

**Archivo:** `c:\...\static\js\multitab_shell.js`

Localiza el bloque de las líneas **1593-1596**:

```js
    // ARRIBA: brief ejecutivo (focos). Las gráficas de comportamiento viven DENTRO de cada foco
    // (acordeón por foco), así que el desempeño se pide SIEMPRE en ECP (global y entidad) para poder
    // pintarlas. Filiales no usa este flujo (tiene su propio desglose y no hay grano diario).
    window.__cnAnalisisEjecutivo(entidad);
```

Reemplázalo **exactamente** por:

```js
    // [2026-08-24] Panorama GLOBAL ECP: SOLO el compromiso P50 (determinista, /president).
    // Los focos y gráficos por producto (/ejecutivo, potencialmente Gemma) se omiten aquí
    // para que el panorama cargue instantáneo. Se excluye a Filiales (__cnEsFil): también
    // llega con entidad=null, pero su render vive en __cnRenderEjecutivo y lo perdería.
    // En drill-down a una ENTIDAD (Insight de una pregunta de Análisis) NO cambia nada.
    if (esGlobal && !__cnEsFil()) {
      var topG = el("cn-ejec-top");
      if (topG) {
        // .cn-ejec-body: el CSS lo espera como hijo (colapsable.css:1328, width:100%).
        // --solo: anula el border-bottom de .cn-ejec-top, que sin los focos debajo
        // quedaría como una línea colgando (colapsable.css:1327).
        topG.classList.add("cn-ejec-top--solo");
        topG.innerHTML =
          '<div class="cn-ejec-body">' +
          '  <div class="cn-p50hd__lbl"><i class="bi bi-flag-fill"></i> ECP · Cumplimiento del compromiso corporativo ' +
          '  <b>(P50)</b> <span class="cn-p50hd__u">· promedio del mes en kbpe</span></div>' +
          '  <div class="cn-kpi__row" id="cn-p50-row"><div class="cn-p50hd__load">Cargando compromiso P50…</div></div>' +
          '</div>';
      }
      __cnPaintP50Header();
      return;   // corta ANTES del fetch de /desempeno (:1600): el global termina aquí
    }

    // ARRIBA: brief ejecutivo (focos). Las gráficas de comportamiento viven DENTRO de cada foco
    // (acordeón por foco), así que el desempeño se pide para la ENTIDAD (y para Filiales) para
    // poder pintarlas.
    window.__cnAnalisisEjecutivo(entidad);
```

> **`__cnEsFil()` en la condición es obligatorio (H6/§9.3):** Filiales también llega
> con `entidad = null` → `esGlobal = true`, y sin esa exclusión perdería su panorama.
>
> **El `return` es obligatorio (§9.6):** sin él seguiría corriendo el fetch de
> `/desempeno` de la línea 1600.

### PASO 2 — Saludo 100% estático

Localiza `function __cnSaludoHtml() {` (línea **4338**) y reemplaza la función
**completa** (hasta su `}` de cierre, línea **4376**) por:

```js
  function __cnSaludoHtml() {
    var n = __cnNombre();
    var saludo = __cnSaludo() + (n ? " " + esc(n) : "") + ", bienvenido.";
    // [2026-08-24] Saludo ESTÁTICO: sin datos de producción ni llamadas al backend/LLM.
    // Antes se armaba con /desempeno + /president + /ejecutivo (__cnSaludoPanorama) y
    // mostraba un spinner "Consultando con la IA…" mientras Gemma respondía. Se retiró
    // por decisión del usuario (saludo sin nada dinámico); el panorama del mes vive en
    // el panel derecho (tarjetas P50). Se pierde el "con corte a N de <mes>", que salía
    // de la curva diaria de /desempeno — endpoint que el panorama global ya no pide.
    var cuerpo = "A la derecha tienes el <strong>desempeño del mes</strong>: el " +
      "cumplimiento del compromiso corporativo (P50) por producto.";
    return saludo + " " + cuerpo +
      '<br><br>¿Quieres profundizar en algún tema específico?' +
      '<br>• <strong>Estructura</strong> — cómo se organiza la operación: campos, activos, gerencias, ' +
      'pozos. <em>(«¿Qué campos tiene Castilla?»)</em>' +
      '<br>• <strong>Cifras</strong> — crudo, gas y blancos: del mes, acumulado, variación, rankings y ' +
      'vs presupuesto. <em>(«¿Cuánto crudo produjo Rubiales?»)</em>' +
      // Las sub-intenciones REALES del grupo Analizar (verificadas contra
      // golden/analizar_golden.yaml). Texto conservado literal del commit ec74ced:
      // sin nombrar "diferidas"/"mantenimientos" el usuario no las encontraba en el
      // saludo aunque el motor ya las respondía.
      '<br>• <strong>Análisis</strong> — brechas, causas, diferidas y mantenimientos, proyección de ' +
      'cierre y economía (EBITDA/NOPAT). <em>(«¿A qué se debe el gap de crudo?» · ' +
      '«¿qué mantenimientos hubo en Castilla?»)</em>' +
      '<br><br>Pregúntame en lenguaje natural, ¿por dónde arrancamos?';
  }
```

> **Conserva:** el nombre (`__cnNombre()`) y los tres bullets de ayuda, incluida la
> mención a "diferidas y mantenimientos" del commit `ec74ced`, **literal**.
> **Elimina:** corte de fecha dinámico, bullets de panorama y spinner de IA.

### PASO 3 — Prefetch: no precalentar los endpoints caros (H7)

Localiza `function __cnPrewarmGlobal() {` (línea **1460**) y reemplaza la función
**completa** (hasta su `}` de cierre, línea **1489**) por:

```js
  function __cnPrewarmGlobal() {
    if (__cnPrewarmed) return;
    __cnPrewarmed = true;
    // [2026-08-24] El prewarm queda inerte A PROPÓSITO. Antes precargaba
    // /analisis/desempeno y /analisis/ejecutivo con la clave global para que el panel
    // fuera cache-HIT y "dejar a Gemma caliente". Desde que el panorama GLOBAL muestra
    // solo el compromiso P50 (/president), esos dos endpoints ya NO se consumen en el
    // arranque: precargarlos sería pagar Gemma (~180s, hasta ~342s en frío) por un
    // payload que nadie pinta — justo el costo que este cambio elimina.
    //
    // NO se precarga /president en su lugar: __cnPaintP50Header() lo pide al montar el
    // panel y es SQL puro (rápido, timeout 30s), así que no hay nada que anticipar.
    //
    // Se conserva la función (y MultiTabShell.prewarm, :5374) porque templates/main.html
    // la invoca al cargar; convertirla en no-op es más seguro que quitar el call site.
  }
```

> **No borres** la función ni la entrada `prewarm:` de `window.MultiTabShell`
> (`:5374`): `templates/main.html:151` la llama y quitarla lanzaría un TypeError.

### PASO 4 — CSS: anular el borde del header cuando va solo (H6)

**Archivo:** `c:\...\static\css\colapsable.css`

Localiza la línea **1328**:

```css
.cn-ejec-top .cn-ejec-body { width: 100%; }
```

Añade **inmediatamente después**:

```css
/* [2026-08-24] Panorama global "solo P50": sin los focos debajo, el border-bottom de
   .cn-ejec-top queda como una línea colgando bajo las tarjetas. La clase la pone
   __cnAnalizar cuando pinta el panorama global ECP. */
.cn-ejec-top--solo { border-bottom: none; padding-bottom: 12px; }
```

### PASO 5 — Cache-bust (obligatorio, en DOS plantillas)

Este plan modifica **dos** ficheros servidos con cache-bust: `multitab_shell.js`
(PASOS 1-3) y `colapsable.css` (PASO 4). Ambos se referencian desde **dos** plantillas,
hoy con `?v=` **distintos entre sí** (los 4 valores verificados 2026-08-24).

Deja los **cuatro** en `?v=20260824b`:

| # | Archivo | Línea | Recurso | Hoy | Dejar |
|---|---|---|---|---|---|
| 1 | `c:\...\MainChat\templates\mainchat_layout.html` | 111 | `multitab_shell.js` | `?v=20260824a` | `?v=20260824b` |
| 2 | `c:\...\templates\main.html` | 88 | `multitab_shell.js` | `?v=20260821p5` | `?v=20260824b` |
| 3 | `c:\...\MainChat\templates\mainchat_layout.html` | 13 | `colapsable.css` | `?v=20260824a` | `?v=20260824b` |
| 4 | `c:\...\templates\main.html` | 5 | `colapsable.css` | `?v=20260813p1` | `?v=20260824b` |

> ⚠️ **No basta con incrementar cada uno por su lado.** Son los mismos dos ficheros
> físicos servidos a dos plantillas: el objetivo es que **ambas sirvan la misma
> versión nueva**. `mainchat_layout.html` tiene más apariciones de `?v=20260824a`
> (líneas 10, 14, 15, 112, 113, 114, 117) que corresponden a **otros** ficheros que
> este plan NO modifica: **no las toques**, solo las líneas 111 y 13.

---

## 7. Orden de ejecución

| Orden | Paso | Nota |
|---|---|---|
| 1 | PASO 1 | Render del panorama global |
| 2 | PASO 2 | Saludo estático |
| 3 | PASO 3 | Prefetch inerte |
| 4 | PASO 4 | CSS del borde |
| 5 | PASO 5 | Cache-bust (sin esto, nada llega al usuario) |
| 6 | §8 | Verificación |

---

## 8. Validaciones

**En el servidor de pruebas.** Abrir `http://<host>:8020/mainchat` con sesión.
Usar la pestaña **Red** de F12 con "Deshabilitar caché" activo.

| # | Comprobación | Esperado |
|---|---|---|
| 1 | Arranque de Consulta, sin preguntar nada | Panel derecho: **solo** las 3 tarjetas P50. **Sin** "Focos de atención" ni gráficos por producto |
| 2 | 🔴 Red — panorama global | Se ve `GET /api/analisis/president`. **NO** debe verse `/api/analisis/ejecutivo` **ni** `/api/analisis/desempeno` (ni al montar ni en el prefetch de carga de página) |
| 3 | 🔴 Velocidad | El panorama aparece casi instantáneo (solo SQL) |
| 4 | 🔴 Saludo estático | "Hola Javier, bienvenido. A la derecha tienes el desempeño del mes: el cumplimiento…". **Sin** spinner "Consultando con la IA…", **sin** bullets de productos/puntos de atención, **sin** "con corte a N de …" |
| 5 | Bullets de ayuda | Siguen los tres: Estructura, Cifras, **Análisis (con "diferidas y mantenimientos")** |
| 6 | 🔴 **Borde del header (H6)** | Bajo las tarjetas P50 **no** queda una línea horizontal colgando |
| 7 | 🔴 **No-regresión: Insight por entidad** | Preguntar *"¿A qué se debe el gap de crudo de Castilla?"* → panel derecho con **Focos + gráficos de Castilla, EXACTAMENTE como antes**. En Red: sí aparecen `/ejecutivo?…` y `/desempeno?…` con la entidad |
| 8 | 🔴 **No-regresión: Volver al panorama** | Tras el Insight, "Volver al panorama" → global de solo-P50, instantáneo, sin focos |
| 9 | 🔴 **No-regresión: tab Filiales** | "Desempeño Filiales" → panorama de las 3 filiales como antes. En Red: `/ejecutivo?...filiales...` |
| 10 | 🔴 **No-regresión: layout clásico** | Abrir `/` (main.html): carga sin errores de consola (el prewarm no-op no debe lanzar TypeError) y su panorama global también es solo-P50 |
| 11 | 🔴 **No-regresión: pila del chat** | Una pregunta de Análisis que genere bloque apilado (`analiza_foco`) sigue pintando sus gráficas |
| 12 | Consola F12 | 0 errores |

> **DT-15 (lección del CLAUDE.md de Robustez):** "sin errores en consola" **no** es
> "feature verificada". Los puntos 🔴 son de interacción runtime y exigen prueba
> humana en navegador. Sin navegador → **"PENDIENTE de validación humana"**, nunca
> "verificado".

---

## 9. Reglas no negociables

1. **No tocar el backend.** `/president`, `/ejecutivo`, `/desempeno` quedan intactos:
   los usa el flujo de Insight por entidad.
2. **El flujo de Insight por entidad NO cambia.** Si al terminar, preguntar por
   Castilla ya no muestra focos → está MAL.
3. **El tab Filiales NO cambia.** La condición del PASO 1 **debe** incluir
   `&& !__cnEsFil()`. Sin eso, Filiales pierde su panorama (H6).
4. **No borrar funciones**: `__cnSaludoPanorama`, `__cnSaludoDesdeDesemp`,
   `__cnSaludoDesdeEjec`, `__cnAnalisisEjecutivo`, `__cnPaintEjec`,
   `__cnRenderEjecutivo`, `__cnPaintDesemp`, `__cnPrewarmGlobal`. Solo se dejan de
   invocar (o se vacían, PASO 3). Borrarlas rompería el flujo por entidad o el
   call site de `main.html:151`.
5. **No tocar `__cnAnzCargarFoco`** (`:2766`) ni nada de `analiza_foco`: es la pila de
   respuestas del chat, sirve a preguntas de Análisis (H8).
6. **El `return` del PASO 1 es imprescindible** — sin él seguiría el fetch de
   `/desempeno` (`:1600`).
7. **No tocar** `window.USER_FULL_NAME` ni `__cnNombre()`.
8. **Cache-bust obligatorio** (PASO 5) en las DOS plantillas, JS **y** CSS.
9. **Comentarios en español**, estilo del archivo: explican *por qué*, no *qué*.

---

## 10. Fuera de alcance

- Cambiar el backend o los endpoints.
- El flujo de Insight por entidad, el tab Filiales y la pila `analiza_foco`.
- La variable `EJECUTIVO_USAR_LLM` del `.env` de producción (§11.2).
- Borrar el código muerto de `seccion()` (`:3876-3880`).

---

## 11. Notas para el usuario (reportar, no ejecutar)

### 11.1 🟢 El saludo pierde el corte de fecha
Ya no dice "con corte a N de agosto" (venía de `/desempeno`). Consecuencia directa de
pedir un saludo sin datos. El período sigue visible en las tarjetas P50.

### 11.2 🟠 Gasto de LLM que este plan NO aborda
Si `EJECUTIVO_USAR_LLM=true` en el `.env` del servidor 139, `/ejecutivo` genera un
texto LLM (`secciones`) que la UI **nunca muestra**: `seccion()`
(`multitab_shell.js:3876-3880`) está definida pero jamás se invoca. En el flujo por
entidad se paga latencia de Gemma por texto invisible. Revisar ese valor en
producción es una mejora **independiente** de este plan.

### 11.3 🟠 Efecto del PASO 3: la primera pregunta de Análisis será más lenta
El prewarm existía para "dejar a Gemma caliente" al cargar la página
(`multitab_shell.js:1445`). Al anularlo, **la primera pregunta de Análisis por
entidad pagará el arranque en frío del modelo** (~342s según
`INGESTA/Rep_Prod/backend/app/core/config.py:41-42`) si Ollama descargó el modelo.

Mitigación disponible **sin código**, en el `.env` de INGESTA del servidor:
`CONSULTA_WARMUP=true` y `CONSULTA_KEEP_ALIVE=-1` mantienen el modelo residente por
otra vía (warm-up del backend), sustituyendo lo que hacía el prefetch del navegador.
**Verificar esos dos valores en el servidor antes de dar el cambio por bueno.**

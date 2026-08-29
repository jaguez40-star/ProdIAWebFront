# Plan CN-WAFFLE — el riel de análisis pasa a un botón waffle con popover

**ID tarea:** CN-WAFFLE
**Fecha:** 2026-08-25
**Versión:** v2 (RE-auditada — 5 hallazgos nuevos sobre el v1, ver §1B)
**Alcance:** Frontend puro (`static/js/multitab_shell.js` + `static/css/colapsable.css`)
**Backend:** NO se toca. Cero cambios en Python, en el motor Q v2 y en la API.

**Decisiones cerradas del usuario:**
1. El botón muestra **solo el icono waffle** (no icono + nombre).
2. Se quedan **2 tarjetas** por ahora → el beneficio es recuperar los 158px del riel.
3. Las 2 tarjetas del popover son **las mismas** que hoy («Desempeño del mes», «Desempeño Filiales»), con su miniatura SVG y su badge de estado.

---

## 0. Contexto para el agente EXECUTOR

> El executor NO tiene acceso a conversaciones previas ni al historial de Git.
> Todo lo necesario está aquí.

**Proyecto:** ProdIA 2.0 — asistente conversacional de producción de hidrocarburos de
Ecopetrol. Flask (puerto 8020) sirve el frontend; INGESTA/FastAPI (8088) el motor.

**Raíz del repo:**
`c:\APLICACIONES\ProdIA\12112025_prodIA\ProdIA-2.0\ProdIA-2.0\`

**Archivos que se tocan (solo 2):**
- `static/js/multitab_shell.js` — el shell multi-pestaña de la app
- `static/css/colapsable.css` — su hoja de estilos

**Qué es el riel hoy:** en la pestaña **Consulta**, el panel derecho («Insights») se
divide en dos columnas: `.cn-rail` (158px fijos, franja gris a la izquierda) con 2
tarjetas de preview clicables, y `.cn-col` con el análisis pintado. Al hacer clic en una
tarjeta se cambia el análisis del lienzo.

**Qué se quiere:** sustituir esa franja de 158px por **un botón compacto con icono de
rejilla (waffle)** que despliegue un popover con esas mismas 2 tarjetas. Se recuperan los
158px para los gráficos.

**Convenciones del proyecto (obligatorias):**
- Todo el código, comentarios y nombres **en español**.
- JS **ES5 clásico**: `var`, `function`, sin arrow functions, sin template literals, sin
  `const`/`let`. El archivo entero está escrito así — respetarlo.
- El HTML se compone por concatenación de strings; el texto variable pasa por `esc()`.
- CSS: se usan variables `var(--rb-*, #fallback)` con fallback explícito.

---

## 1. 🔴 Hallazgos de la auditoría — leer ANTES de escribir código

> Estos 6 hallazgos salen de auditar el código real y **determinan el diseño**.
> Explican por qué la §3 es como es. No son opcionales.

### 🔴 H1 — Son CINCO call sites, no cuatro

`__cnRailCards()` se invoca en 5 lugares (verificado con grep sobre el archivo):

| # | Línea | Contexto | Qué pinta |
|---|---|---|---|
| 1 | **422** | markup inicial de la pestaña | `__cnRailCards(__cnLastIntent ? null : "desempeno")` |
| 2 | 1589 | `__cnAnalizar()` | `__cnRailCards(__cnEsFil() ? "filiales" : "desempeno")` |
| 3 | 6053 | `d.status === "huella"` | `__cnRailCards(null)` |
| 4 | 6151 | intent rama B (filial) | `__cnRailCards(null)` |
| 5 | 1551 | `__cnAnalisisTab()` | no llama a la función: manipula `.is-active` a mano sobre el DOM |

**Si se olvida uno, el estado activo se desincroniza.** Por eso la §3.4 centraliza los 5
en una única función `__cnRailSync(activeKey)`.

### 🔴 H2 — BLOQUEANTE: el contenedor se REGENERA al volver a la pestaña

La línea 422 hace `viewer.innerHTML = '...'` — reconstruye **todo** el área del visor cada
vez que se entra a la pestaña Consulta. Cualquier popover que viva **dentro** de
`#cn-viewer-area` sería destruido en ese momento, y sus listeners con él.

**Consecuencia de diseño:** el popover **NO puede vivir dentro del markup de :422**. Debe
montarse una sola vez en `document.body`, igual que hizo el waffle existente
(`mainchat.js:9-11`: *«el menú vive en .mc-shell, fuera de #mainchat-root, para que no lo
destruya innerHTML=''»*). El botón sí va dentro (es barato repintarlo); el popover no.

### 🔴 H3 — `position: absolute` NO sirve: seis `overflow:hidden` en la cadena

El waffle existente documenta exactamente este problema
([mainchat.css:50-53](../MainChat/static/css/mainchat.css)):

> *«fixed, no absolute: el disparador vive dentro del panel Historial, cuya cadena de
> ancestros acumula seis overflow:hidden (historial.css:10, acordeon.css:29 y :146,
> mainchat.css:36, style.css:190/51/40) que lo recortarían.»*

El riel está en esa misma zona de la app, y además `#cn-viewer-area` lleva su propio
`overflow:hidden` inline (línea 420) y `.cn-rail` un `overflow-y:auto`.
→ **`position: fixed` + coordenadas calculadas en JS.** No hay alternativa.

### 🟡 H4 — Existe un waffle YA RESUELTO que hay que clonar, no reinventar

`MainChat/static/js/mainchat.js` (commit WAFFLE-NAV, 2026-08-25) ya resolvió:
`situar()` con tope de viewport, `abrir()` que mide **después** de quitar `hidden`,
cierre por clic fuera / `Escape` / `resize`, y `aria-expanded`.
→ La §3.5 lo adapta. **No inventar un mecanismo nuevo.**

⚠️ Diferencias con aquel caso, deliberadas:
- Aquel abre **hacia arriba** (su botón está al pie). Éste abre **hacia abajo/derecha**
  (el botón está arriba-izquierda del panel).
- Aquel usa `document.getElementById` en cada uso porque su disparador se repinta. Aquí
  el botón también se repinta (H2) → **misma solución: delegación en `document`**.

### 🟡 H5 — El estado «activo» se pierde de vista al colapsar (decisión 1 del usuario)

Hoy el riel muestra en todo momento cuál análisis está activo (borde dorado,
`.cn-railcard.is-active`) y si «Filiales» no aplica (`.is-disabled`, gobernado por
`__cnPanelEntidad`). Con solo el icono, eso desaparece.

**Mitigación acordada:** un **punto indicador** sobre el botón cuando hay un análisis
activo (`.cn-anbtn.is-active::after`). No es el título, pero evita que el botón parezca
inerte. El estado completo sigue visible al abrir el popover.

### 🟢 H6 — `__cnAnalisisTab()` NO se toca

El handler de clic (`window.__cnAnalisisTab`, :1547) ya recibe `(key, cardEl)` y hace todo
el trabajo real (llamar a `__cnAnalizar`, pintar «Próximamente», etc.). El popover invoca
**el mismo handler**; solo hay que cerrar el popover después.
→ Cero riesgo sobre la lógica de análisis. El cambio es puramente de presentación.

---

## 1B. 🔴🔴 RE-AUDITORÍA (v2) — 5 hallazgos que corrigen el v1

> Segunda pasada del flujo §15 sobre el propio plan. Estos 5 salieron de medir el código,
> NO de releer el v1. Tres de ellos habrían producido bugs reales.

### 🔴 R1 — BLOQUEANTE: el prefijo `cn-wf*` YA EXISTE (waterfall EBITDA→NOPAT)

El v1 proponía `.cn-wfbtn` y `.cn-wfpop`. Medido: **`cn-wf` es el namespace del gráfico
waterfall** — 26 clases en `colapsable.css:1670-1695` (`.cn-wf__bar-rect`, `.cn-wf__svg`,
`.cn-wf__hover`…) y 12 usos en `multitab_shell.js:4013-4086`.

Invadir ese prefijo no rompe nada hoy (los nombres exactos no chocan), pero deja dos
componentes sin relación compartiendo namespace: quien haga un grep de `cn-wf` para tocar
el waterfall encontrará el menú, y viceversa. Es deuda inducida a propósito.

**Corrección aplicada en toda la §3:** el prefijo pasa a **`cn-an*`** (analisis):
`.cn-anbtn`, `.cn-anpop`, `.cn-anpop__grid`, `.cn-anpop__hd`. Las funciones JS pasan a
`__cnAnMenu*` (verificado: `cn-an` y `__cnAnMenu` no existen en el proyecto).

### 🔴 R2 — BLOQUEANTE: `unmount()` NO limpiaría el popover → queda huérfano sobre la app

`unmount()` (`multitab_shell.js:672-679`) hace
`el("multitab-shell-container").innerHTML = ""` y devuelve el layout normal. Pero el
popover vive en `document.body` (obligado por H2) → **sobrevive al unmount**. Si el usuario
sale del shell con el menú abierto, queda un panel flotante encima de la app, sin dueño.

**Corrección:** `unmount()` debe cerrar y **desmontar** el popover. Ver §3.9 (nueva).

### 🔴 R3 — El markup :422 ya tiene el precedente EXACTO de H2, y lo confirma

`multitab_shell.js:409-413` documenta que ese mismo `innerHTML` **destruye `#cn-stack`**, y
por eso existe `saveConsultaStackDOM()` justo antes:

> *«El innerHTML de abajo DESTRUYE el #cn-stack actual: hay que salvar sus bloques primero.
> Sin esto, un repintado que no venga de setActiveTab (p.ej. reabrir el panel colapsado)
> borraba la pila en silencio.»*

No es una hipótesis: **ya le pasó al proyecto con otro nodo**. Refuerza que el popover no
puede vivir ahí dentro, y da el nombre del caso al que apelar si alguien lo cuestiona.

### 🟡 R4 — `z-index: 1000` es correcto, pero hay un modal en 9999

Medido en `colapsable.css`: los z-index del panel van de 1 a 5; el único alto es
`.ig-modal-backdrop` en **9999** (modal de sobrescritura de ingesta). El waffle existente
usa **1000** (`mainchat.css:65`).

→ **1000 se mantiene**: queda por encima de todo el panel y por debajo del modal, que es
el orden correcto (un modal debe tapar el menú). Se documenta para que nadie lo suba.

### 🟢 R5 — Confirmaciones que sostienen el plan v1

- **ES5:** verificado — `grep -c "const |let |=>"` da **3**, y los 3 son comentarios en
  prosa («la muestra ahora…»). No hay sintaxis ES6 en el archivo. La regla se mantiene.
- **Icono:** `bi-grid-3x3-gap-fill` **ya se usa** en el proyecto
  (`multitab_shell.js:4703`) → Bootstrap Icons está cargado y el glifo existe. Sin riesgo
  de icono en blanco.
- **Scope:** el archivo es un IIFE (`(function () { "use strict"; … })()`), así que las
  funciones nuevas quedan privadas salvo lo que se cuelgue de `window`. Correcto.
- **Layout:** `.cn-shell` es `display:flex` y `.cn-col` es `flex:1 1 auto`
  (`colapsable.css:1476,1484`) → al encoger la barra izquierda, `.cn-col` **absorbe el
  ancho automáticamente**. No hay que tocar `.cn-col`.

---

## 2. Estado actual (para que el executor sepa qué está mirando)

**Markup, línea 420-427:**

```js
'<div id="cn-viewer-area" style="flex:1;min-height:0;overflow:hidden;">' +
'  <div class="cn-shell">' +
'    <div class="cn-rail" id="cn-rail">' + __cnRailCards(__cnLastIntent ? null : "desempeno") + '</div>' +
'    <div class="cn-col" id="cn-col">' +
'      <div class="cn-canvas" id="cn-canvas"></div>' +
'      <div class="cn-stack" id="cn-stack"></div>' +
'    </div>' +
'  </div></div>';
```

**Datos, línea 1516-1522** — `__CN_ANALISIS`: array de 2 objetos con `key`, `titulo`,
`estado` y `svg` (miniatura inline). **Se conserva intacto.**

**CSS, `colapsable.css:1477-1478`:**

```css
.cn-rail { flex: 0 0 158px; width: 158px; overflow-y: auto; padding: 12px 10px; display: flex;
  flex-direction: column; gap: 10px; border-right: 1px solid var(--rb-border,#e3e8e5); background: #f6f8f7; }
```

Y `colapsable.css:1562` (responsive): `.cn-rail { flex-basis: 120px; width: 120px; }`

---

## 3. Especificación

### 3.1 MODIFICAR — markup del contenedor (`multitab_shell.js` ~línea 422)

**Sustituir** la línea del `.cn-rail` por el botón waffle. El resto del bloque queda igual.

```js
'<div id="cn-viewer-area" style="flex:1;min-height:0;overflow:hidden;">' +
'  <div class="cn-shell">' +
       // [2026-08-25] CN-WAFFLE · el riel de 158px pasó a un botón que abre un popover.
       // El BOTÓN va aquí (se repinta con la pestaña, es barato); el POPOVER vive en
       // document.body y se monta una sola vez — este innerHTML lo destruiría (H2).
'    <div class="cn-railbar">' + __cnAnMenuBtn() + '</div>' +
'    <div class="cn-col" id="cn-col">' +
'      <div class="cn-canvas" id="cn-canvas"></div>' +
'      <div class="cn-stack" id="cn-stack"></div>' +
'    </div>' +
'  </div></div>';
```

> ⚠️ Se elimina `id="cn-rail"`. Los 4 call sites que hacían `el("cn-rail").innerHTML = …`
> dejarían de encontrarlo: por eso TODOS pasan por `__cnRailSync()` (§3.4). No dejar
> ninguna referencia suelta a `el("cn-rail")` — el executor debe verificarlo con grep
> al final (§6, paso 4).

### 3.2 AÑADIR — el botón (`multitab_shell.js`, junto a `__cnRailCards`, ~línea 1523)

```js
  // [2026-08-25] CN-WAFFLE · Botón que abre el popover de análisis. Solo icono (decisión
  // del usuario): con 2 tarjetas el valor es recuperar los 158px del riel, no organizar.
  // El punto indicador (.is-active) compensa que el título del análisis activo ya no se
  // vea — sin él el botón parece inerte (H5).
  // `title` + `aria-label` llevan el nombre del activo: es la única pista textual que queda.
  function __cnAnMenuBtn() {
    var act = __cnRailActiva;
    var cfg = act ? __CN_ANALISIS.filter(function (a) { return a.key === act; })[0] : null;
    var etiq = cfg ? ("Análisis · " + cfg.titulo) : "Análisis";
    return '<button type="button" class="cn-anbtn' + (act ? " is-active" : "") + '"' +
      ' id="cn-anbtn" aria-haspopup="true" aria-expanded="false"' +
      ' title="' + esc(etiq) + '" aria-label="' + esc(etiq) + '">' +
      '<i class="bi bi-grid-3x3-gap-fill"></i></button>';
  }
```

### 3.3 AÑADIR — estado del riel (`multitab_shell.js`, junto a `__CN_ANALISIS`, ~línea 1522)

```js
  // [2026-08-25] CN-WAFFLE · Clave del análisis activo. Antes vivía SOLO en el DOM (la clase
  // .is-active de la tarjeta); al colapsar el riel en un popover que se monta y desmonta,
  // el DOM deja de ser un sitio fiable para guardarla.
  var __cnRailActiva = "desempeno";
```

### 3.4 🔴 AÑADIR — sincronizador único (`multitab_shell.js`, tras `__cnRailCards`)

Es la pieza que evita el bug de H1.

```js
  // [2026-08-25] CN-WAFFLE · ÚNICO punto que refresca el estado del riel. Antes había 4
  // sitios haciendo `el("cn-rail").innerHTML = __cnRailCards(...)` y un 5º manipulando
  // .is-active a mano (H1): con el riel dentro de un popover que puede estar cerrado, cada
  // uno tendría que saber si el popover existe. Centralizado, los 5 llaman aquí.
  // Refresca DOS cosas: el botón (punto indicador + title) y, si el popover está abierto,
  // su rejilla.
  function __cnRailSync(activeKey) {
    __cnRailActiva = activeKey || null;
    // 1. El botón: se repinta entero (es un solo <button>, más simple que mutar clases).
    var barra = document.querySelector(".cn-railbar");
    if (barra) barra.innerHTML = __cnAnMenuBtn();
    // 2. La rejilla del popover, SOLO si está montado y visible (si está cerrado se
    //    repinta al abrirlo — __cnAnMenuAbrir siempre llama a __cnRailCards).
    var pop = document.getElementById("cn-anpop");
    if (pop && !pop.hidden) {
      var grid = pop.querySelector(".cn-anpop__grid");
      if (grid) grid.innerHTML = __cnRailCards(__cnRailActiva);
    }
  }
```

### 3.5 AÑADIR — el popover (`multitab_shell.js`, tras `__cnRailSync`)

Adaptado del waffle existente (`MainChat/static/js/mainchat.js`), con las diferencias de H4.

```js
  // [2026-08-25] CN-WAFFLE · Popover de análisis. Clon adaptado del waffle de usuario
  // (MainChat/static/js/mainchat.js, WAFFLE-NAV 2026-08-25), que ya resolvió los tres
  // problemas difíciles: recorte por overflow de los ancestros, medir antes de situar, y
  // cierre por clic fuera / Escape / resize.
  //
  // 🔒 REGLAS (no relajar):
  //  1) Vive en document.body, NO en #cn-viewer-area: ese contenedor se regenera entero
  //     con innerHTML al volver a la pestaña (:422) y destruiría el nodo y sus listeners (H2).
  //  2) position:fixed, NO absolute: la cadena de ancestros acumula varios overflow:hidden
  //     (#cn-viewer-area inline, .cn-rail, y los del shell) que lo recortarían (H3).
  //  3) Se monta UNA sola vez (guarda __cnAnMenuMontado). El listener de document también.
  var __cnAnMenuMontado = false;
  var __CN_AN_MARGEN = 8;   // separación respecto al botón y a los bordes del viewport

  function __cnAnMenuMontar() {
    if (__cnAnMenuMontado) return;
    __cnAnMenuMontado = true;
    var pop = document.createElement("div");
    pop.id = "cn-anpop";
    pop.className = "cn-anpop";
    pop.hidden = true;
    pop.setAttribute("role", "menu");
    pop.innerHTML = '<div class="cn-anpop__hd">Análisis disponibles</div>' +
                    '<div class="cn-anpop__grid"></div>';
    document.body.appendChild(pop);

    // Delegación en document: el botón se repinta con la pestaña (H2), así que un
    // getElementById fijo apuntaría a un nodo muerto. Mismo criterio que mainchat.js:64-72.
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest("#cn-anbtn")) { e.stopPropagation(); __cnAnMenuAbrir(pop.hidden); return; }
      if (!pop.hidden && !pop.contains(t)) __cnAnMenuAbrir(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !pop.hidden) __cnAnMenuAbrir(false);
    });
    window.addEventListener("resize", function () {
      if (!pop.hidden) __cnAnMenuSituar();
    });
  }

  // Coloca el popover bajo el botón. Requiere que YA esté visible: con hidden, offsetWidth
  // devuelve 0 y quedaría mal situado. __cnAnMenuAbrir garantiza ese orden.
  function __cnAnMenuSituar() {
    var btn = document.getElementById("cn-anbtn");
    var pop = document.getElementById("cn-anpop");
    if (!btn || !pop) return;
    var r = btn.getBoundingClientRect();
    var alto = pop.offsetHeight, ancho = pop.offsetWidth;
    // Hacia ABAJO desde el botón (está arriba-izquierda del panel); si no cabe, hacia arriba.
    var top = r.bottom + __CN_AN_MARGEN;
    if (top + alto > window.innerHeight - __CN_AN_MARGEN) {
      top = r.top - alto - __CN_AN_MARGEN;
      if (top < __CN_AN_MARGEN) top = __CN_AN_MARGEN;
    }
    // Alineado al borde izquierdo del botón, sin salirse del viewport.
    var left = r.left;
    if (left + ancho > window.innerWidth - __CN_AN_MARGEN) {
      left = window.innerWidth - ancho - __CN_AN_MARGEN;
    }
    if (left < __CN_AN_MARGEN) left = __CN_AN_MARGEN;
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  function __cnAnMenuAbrir(mostrar) {
    __cnAnMenuMontar();
    var pop = document.getElementById("cn-anpop");
    if (!pop) return;
    if (mostrar) {
      // Se repinta SIEMPRE al abrir: __cnPanelEntidad pudo cambiar mientras estaba cerrado
      // (p.ej. se analizó un campo → "Filiales" deja de aplicar).
      var grid = pop.querySelector(".cn-anpop__grid");
      if (grid) grid.innerHTML = __cnRailCards(__cnRailActiva);
    }
    pop.hidden = !mostrar;
    var btn = document.getElementById("cn-anbtn");
    if (btn) btn.setAttribute("aria-expanded", mostrar ? "true" : "false");
    if (mostrar) __cnAnMenuSituar();   // medir DESPUÉS de quitar hidden
  }
```

### 3.6 MODIFICAR — `__cnRailCards()` (~línea 1524)

Un solo cambio: el `onclick` debe **cerrar el popover** además de cambiar el análisis.
El resto de la función (badges, disabled, SVG) **queda idéntico**.

**Localizar:**

```js
      var handler = disabled ? '' : ' onclick="window.__cnAnalisisTab(\'' + a.key + '\', this)"';
```

**Sustituir por:**

```js
      // [2026-08-25] CN-WAFFLE · al elegir se cierra el popover. __cnAnalisisTab es el
      // MISMO handler de siempre (H6): la lógica de análisis no cambia.
      var handler = disabled ? ''
        : ' onclick="window.__cnAnalisisTab(\'' + a.key + '\', this); window.__cnAnMenuCerrar();"';
```

Y **exponer el cierre** (junto a los demás `window.__cn*`, tras `__cnAnMenuAbrir`):

```js
  // Expuesto porque lo invoca el onclick inline de las tarjetas (__cnRailCards).
  window.__cnAnMenuCerrar = function () { __cnAnMenuAbrir(false); };
```

### 3.7 🔴 MODIFICAR — los 5 call sites (H1)

Todos pasan a `__cnRailSync()`. **Uno por uno:**

**(1) Línea ~422** — markup inicial. Ya resuelto en §3.1: el `.cn-rail` desaparece y el
botón se pinta con `__cnAnMenuBtn()`. Pero hay que **fijar el estado inicial** justo
después de asignar el `innerHTML` del viewer:

```js
      // [2026-08-25] CN-WAFFLE · el estado inicial ya no viaja en el markup del riel.
      __cnRailActiva = __cnLastIntent ? null : "desempeno";
      __cnAnMenuMontar();   // el popover vive en body: se monta una vez, aquí o al 1er clic
```

> Colocarlo inmediatamente después de la línea que cierra `viewer.innerHTML = '...';`
> y ANTES del `if (__cnLastIntent && __cnLastIntent.rama === "B") …` que le sigue.

**(2) Línea ~1589** (`__cnAnalizar`) — sustituir:

```js
    var _railR = el("cn-rail");
    if (_railR) _railR.innerHTML = __cnRailCards(__cnEsFil() ? "filiales" : "desempeno");
```

por:

```js
    __cnRailSync(__cnEsFil() ? "filiales" : "desempeno");
```

**(3) Línea ~6053** (`status === "huella"`) — sustituir:

```js
        var _r = el("cn-rail");
        if (_r) _r.innerHTML = __cnRailCards(null);   // se muestra la huella, no un análisis del riel
```

por:

```js
        __cnRailSync(null);   // se muestra la huella, no un análisis del riel
```

**(4) Línea ~6151** (intent rama B) — sustituir:

```js
          var _rail = el("cn-rail");
          if (_rail) _rail.innerHTML = __cnRailCards(null);
```

por:

```js
          __cnRailSync(null);
```

**(5) Línea ~1551** (`__cnAnalisisTab`) — hoy manipula `.is-active` a mano sobre `#cn-rail`.
**Localizar:**

```js
    var rail = el("cn-rail");
    if (rail) rail.querySelectorAll(".cn-railcard").forEach(function (c) { c.classList.remove("is-active"); });
    if (cardEl) cardEl.classList.add("is-active");
```

**Sustituir por:**

```js
    // [2026-08-25] CN-WAFFLE · el activo ya no se marca mutando el DOM del riel (que puede
    // no existir si el popover está cerrado): se guarda en __cnRailActiva y __cnRailSync
    // repinta botón y rejilla. `cardEl` queda sin uso — se conserva en la firma porque el
    // onclick inline de las tarjetas lo sigue pasando (`this`).
    __cnRailSync(key);
```

### 3.8 AÑADIR — CSS (`static/css/colapsable.css`)

**Sustituir** las 2 líneas de `.cn-rail` (1477-1478) por `.cn-railbar`, y **añadir** los
estilos nuevos. Clonar los valores del waffle existente donde aplique.

```css
/* [2026-08-25] CN-WAFFLE · el riel de 158px pasó a un botón que abre un popover; la barra
   solo reserva el ancho del botón. Se recuperan ~130px para los gráficos. */
.cn-railbar { flex: 0 0 auto; padding: 12px 8px; border-right: 1px solid var(--rb-border,#e3e8e5);
  background: #f6f8f7; display: flex; flex-direction: column; align-items: center; }

.cn-anbtn { width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--rb-border,#e3e8e5);
  background: #fff; color: #2f4a3d; cursor: pointer; display: grid; place-items: center;
  font-size: 1rem; position: relative; transition: border-color .12s, box-shadow .12s; }
.cn-anbtn:hover { border-color: var(--rb-green,#1f6b4a); }
.cn-anbtn[aria-expanded="true"] { border-color: var(--rb-green,#1f6b4a);
  box-shadow: 0 0 0 1px var(--rb-green,#1f6b4a); }
/* Punto indicador: con solo el icono, el título del análisis activo ya no se ve (H5).
   Sin esto el botón parece inerte. */
.cn-anbtn.is-active::after { content: ""; position: absolute; top: -2px; right: -2px;
  width: 8px; height: 8px; border-radius: 50%; background: var(--rb-chat-gold,#C9962E);
  border: 1.5px solid #fff; }

/* Popover. fixed + coords en JS: la cadena de ancestros tiene varios overflow:hidden que
   lo recortarían con absolute (H3, mismo motivo documentado en mainchat.css:50-53).
   max-height + scroll: sin tope, una rejilla larga desborda el viewport (visto en el
   waffle de usuario, mainchat.css:66-69). */
.cn-anpop { position: fixed; top: 0; left: 0; z-index: 1000; width: 268px; background: #fff;
  border: 1px solid var(--rb-border,#e3e8e5); border-radius: 10px; padding: 12px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 18%); max-height: calc(100vh - 16px); overflow-y: auto; }
.cn-anpop[hidden] { display: none; }
.cn-anpop__hd { font-size: .7rem; font-weight: 700; color: #8a968f; text-transform: uppercase;
  letter-spacing: .04em; margin-bottom: 9px; }
/* auto-fit para que crecer de 2 a N tarjetas no deje filas cojas (mismo criterio que
   mainchat.css:135-139). */
.cn-anpop__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: 8px; }
```

**Y en el bloque responsive** (`@media (max-width: 720px)`, ~línea 1562) **sustituir**:

```css
  .cn-rail { flex-basis: 120px; width: 120px; }
```

por:

```css
  /* [2026-08-25] CN-WAFFLE · el botón ya es compacto; solo se ajusta el padding. */
  .cn-railbar { padding: 8px 6px; }
```

> ⚠️ Las reglas `.cn-railcard*` (1538-1551 y 1568) **NO se tocan**: las tarjetas siguen
> siendo las mismas, ahora dentro del popover.

---

### 3.9 🔴 MODIFICAR — `unmount()` desmonta el popover (fix de R2)

El popover vive en `document.body` (obligado por H2), así que `unmount()` no lo alcanza:
al salir del shell quedaría flotando sobre la app. **Localizar** en `unmount()`
(~línea 678):

```js
    var container = el("multitab-shell-container");
    if (container) { container.innerHTML = ""; container.style.display = "none"; }
```

**Insertar JUSTO ANTES** de esas dos líneas:

```js
    // [2026-08-25] CN-WAFFLE · el menú de análisis vive en document.body (H2: el markup de
    // Consulta se regenera y lo destruiría), así que este innerHTML NO lo alcanza: sin esto
    // queda un panel flotante huérfano sobre la app al salir del shell (R2).
    // Se DESMONTA, no solo se oculta: el mount siguiente lo recrea con __cnAnMenuMontar().
    var _anpop = document.getElementById("cn-anpop");
    if (_anpop && _anpop.parentNode) _anpop.parentNode.removeChild(_anpop);
    __cnAnMenuMontado = false;   // permite que el próximo mount lo vuelva a crear
```

> ⚠️ **No se retiran los listeners de `document`** (clic/keydown) a propósito: son
> idempotentes —comprueban `document.getElementById("cn-anpop")` y salen si no existe— y
> quitarlos exigiría guardar referencias a las funciones. Es el mismo criterio del waffle
> existente, que tampoco los retira. Lo que NO puede repetirse es el `appendChild`: de eso
> se encarga la guarda `__cnAnMenuMontado`.

---

## 4. Orden de ejecución

| # | Acción | Archivo | §  |
|---|---|---|---|
| 1 | Añadir `__cnRailActiva` (variable de estado) | `multitab_shell.js` | 3.3 |
| 2 | Añadir `__cnAnMenuBtn()` | `multitab_shell.js` | 3.2 |
| 3 | Añadir `__cnRailSync()` | `multitab_shell.js` | 3.4 |
| 4 | Añadir popover: montar / situar / abrir / cerrar | `multitab_shell.js` | 3.5 |
| 5 | Modificar `__cnRailCards()` (onclick cierra) | `multitab_shell.js` | 3.6 |
| 6 | Modificar el markup del contenedor | `multitab_shell.js` | 3.1 |
| 7 | Modificar los 5 call sites | `multitab_shell.js` | 3.7 |
| 8 | CSS | `colapsable.css` | 3.8 |
| 9 | **Desmontar el popover en `unmount()`** (R2) | `multitab_shell.js` | 3.9 |
| 10 | Validar (§6) | — | — |

> Las funciones (1-5) van ANTES de los call sites (6-7) para que el archivo nunca quede
> en un estado donde se invoque algo que no existe.

---

## 5. Reglas no negociables

1. **CERO cambios en el backend.** No tocar `INGESTA/`, ni Python, ni la API.
2. **NO modificar `__CN_ANALISIS`** (línea 1516): las 2 tarjetas, sus títulos, sus SVG y
   sus estados quedan **idénticos**.
3. **NO modificar la lógica de `__cnAnalisisTab`** más allá de lo indicado en §3.7(5): las
   ramas `desempeno` / `filiales` / «Próximamente» quedan intactas (H6).
4. **NO tocar** las reglas CSS `.cn-railcard*` — las tarjetas no cambian de aspecto.
5. **JS ES5**: `var` + `function`. Sin `const`/`let`, sin arrow functions, sin template
   literals. El archivo entero está en ese estilo.
6. **El popover se monta en `document.body`**, jamás dentro de `#cn-viewer-area` (H2).
7. **`position: fixed`**, jamás `absolute` (H3).
8. Todo comentario **en español**.
9. **Prefijo `cn-an*` / `__cnAnMenu*`, NUNCA `cn-wf*`** (R1): `cn-wf` es el namespace del
   gráfico waterfall EBITDA→NOPAT (26 clases CSS + 12 usos JS). No invadirlo.
10. **`z-index: 1000`** exacto (R4): por encima del panel, por debajo del modal de ingesta
   (9999). No subirlo.
11. Si algo del plan no calza con el código real → **DETENERSE** y reportar, no improvisar.

---

## 6. Validación

> ⚠️ Es un cambio **puramente visual e interactivo**: no hay tests automáticos que lo
> cubran. La regla R3 del proyecto aplica — *«build verde ≠ feature verificada»*. El
> estado correcto al terminar es **«implementado, pendiente de validación humana»**.

### 6.1 Comprobaciones estáticas (las hace el executor)

| # | Comando / acción | Resultado esperado |
|---|---|---|
| 1 | `grep -n 'el("cn-rail")' static/js/multitab_shell.js` | **0 resultados** — no queda ninguna referencia al id eliminado |
| 2 | `grep -n 'id="cn-rail"' static/js/multitab_shell.js` | **0 resultados** |
| 3 | `grep -n '__cnRailCards' static/js/multitab_shell.js` | Solo 3: la definición, `__cnRailSync` y `__cnAnMenuAbrir` |
| 4 | `grep -n '__cnRailSync' static/js/multitab_shell.js` | 5 usos + 1 definición |
| 5 | `grep -cn 'const \|let \|=>' ` sobre el bloque nuevo | 0 — el archivo es ES5 |
| 6 | `grep -n '\.cn-rail\b' static/css/colapsable.css` | 0 — sustituido por `.cn-railbar` |

### 6.2 Validación humana en navegador ⏳ (la hace el USUARIO)

Arrancar los backends y abrir `http://localhost:8020/mainchat` → pestaña **Consulta**:

1. **El botón aparece** arriba-izquierda del panel derecho, donde estaba el riel, y los
   gráficos ocupan más ancho.
2. **Clic en el botón** → se abre el popover con las 2 tarjetas y sus miniaturas.
3. **Clic en «Desempeño Filiales»** → el análisis cambia **y el popover se cierra**.
4. **El punto dorado** aparece sobre el botón cuando hay análisis activo.
5. **Cierre:** clic fuera lo cierra · `Escape` lo cierra · redimensionar la ventana con el
   popover abierto lo reposiciona (no lo deja flotando).
6. **🔴 Prueba de H2 (la importante):** con el popover abierto, **cambiar a otra pestaña
   del shell y volver a Consulta** → el botón sigue funcionando (el popover no quedó
   huérfano ni murió con el `innerHTML`).
7. **🔴 Prueba de H1:** preguntar «¿qué es CASTILLA?» (analiza una entidad ECP) → abrir el
   popover → **«Desempeño Filiales» debe aparecer deshabilitado** («No aplica»). Luego
   «Volver al panorama» → abrir → **vuelve a estar habilitado**.
8. **Sin recortes:** el popover se ve completo, no cortado por el borde del panel (era el
   riesgo de H3).
9. **🔴 Prueba de R2 (fuga del popover):** abrir el popover y, **con el menú abierto**,
   salir del shell («Volver» / cerrar Análisis Avanzado) → **no debe quedar ningún panel
   flotando** sobre la app. Volver a entrar → el botón funciona igual.
10. **Prueba de R4 (z-index):** con el popover abierto, si es posible disparar el modal de
   ingesta, éste debe quedar **por encima** del menú.
11. **El waterfall EBITDA→NOPAT sigue intacto** (R1): abrir un análisis que lo pinte y
   comprobar que se ve igual — el renombrado de prefijo no debió tocarlo.
12. **F12 → Console:** 0 errores.

---

## 7. Fuera de alcance (explícito)

- **Añadir análisis nuevos** al popover: `__CN_ANALISIS` queda con sus 2 entradas
  (decisión 2 del usuario). La rejilla ya usa `auto-fit` para crecer sin tocar layout.
- **Icono + nombre en el botón**: descartado por el usuario (decisión 1). Si más adelante
  se quiere, es cambiar `__cnAnMenuBtn()` y el `width` de `.cn-anbtn`.
- **Unificar con el waffle de usuario** (`#mc-menu`): son dos popovers con dueños y ciclos
  de vida distintos. Se **clona el patrón**, no se comparte el código — extraer un
  componente común es refactor mayor y no se pidió.
- **Navegación por teclado dentro de la rejilla** (flechas entre tarjetas): el waffle
  existente tampoco la tiene; queda como deuda simétrica.
- **El texto duplicado al pie del panel Insights** (visto en la captura del usuario del
  2026-08-25, donde la respuesta de capacidades aparece también en el panel derecho): es
  de otro riel de render y **no lo toca este plan**. Anotado como pendiente de diagnóstico.

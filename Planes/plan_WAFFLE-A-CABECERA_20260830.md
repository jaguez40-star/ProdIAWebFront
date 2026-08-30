# Plan — Mover el waffle de análisis a la cabecera del panel Insights

| | |
|---|---|
| **ID tarea** | `WAFFLE-A-CABECERA` |
| **Fecha** | 2026-08-30 |
| **Versión** | **v2 — auditada contra los pipelines** (v1: 2026-08-30, superada) |
| **Alcance** | El botón `#cn-anbtn` (waffle de análisis) pasa a la cabecera del panel Insights **en `/mainchat`** |
| **Objetivo** | Recuperar los 51 px de ancho que hoy consume `.cn-railbar`, sin superponer nada |

> **Qué cambió de v1 a v2.** La v1 auditó el componente pero no quién más lo usa. La
> segunda pasada encontró que **el plan rompía la vista clásica `/`** (H-13): allí se
> carga `multitab_shell.js` pero **no** `acordeon.js`, así que al retirar la barra y
> mover el botón a una cabecera que allí no existe, el waffle desaparecía y con él el
> acceso a los análisis. También faltaban **5 sellos de caché en 2 plantillas** (H-14),
> que sin subir dejan a media app ejecutando la versión anterior. La §3 se reformuló
> entera sobre esos hallazgos; los de la v1 se conservan con su numeración.

## Qué NO se toca

- **El popover `#cn-anpop`**: ya vive en `document.body` con `position:fixed` y se monta
  una sola vez. No se mueve ni se cambia su lógica.
- **La lógica de qué análisis se muestra** (`__cnRailActiva`, `__cnRailCards`,
  `__cnAnMenuAbrir`). Solo cambia DÓNDE vive el botón.
- **El badge `Act: <fecha>`** de la cabecera de Insights ni `_cargarAct()`.
- **La vista clásica `/`**: conserva su barra `.cn-railbar` intacta (H-13).
- **La vista `/layout/colapsable`**: no carga ninguno de estos archivos (H-15).
- **Las cabeceras de Historial y Chat**: el waffle es exclusivo de Insights.

## Decisiones cerradas del usuario

1. Opción **(B)**: el botón va a la cabecera verde del panel, junto al de colapsar. Se
   descartó (A) —flotante superpuesto— porque taparía el icono y el inicio del título
   «Desempeño del mes · Global».
2. El cambio aplica a `/mainchat`. La vista clásica queda como está: rediseñarla no se ha
   pedido y su layout no tiene dónde alojar el botón.

---

## §0 · Contexto para el agente EXECUTOR

**Proyecto:** ProdIA — analítica de producción de Ecopetrol. Frontend Flask + Jinja2
(puerto 5029) y backend FastAPI «INGESTA» (5030). Esta tarea es **solo del frontend**.

**Directorio de trabajo:** `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\`

**Qué es el waffle:** el botón con icono de cuadrícula que abre el popover «Análisis
disponibles» (Desempeño del mes / Desempeño Filiales). Hoy vive en una columna propia
(`.cn-railbar`) a la izquierda del contenido del panel Insights.

**🔴 Dato que gobierna todo el plan:** `multitab_shell.js` lo cargan **dos** vistas con
layouts distintos:

| Vista | Plantilla | `multitab_shell.js` | `acordeon.js` | Qué pasa con el waffle |
|---|---|---|---|---|
| `/mainchat` | `MainChat/templates/mainchat_layout.html` | ✅ | ✅ | Va a la cabecera |
| `/` (clásica) | `templates/main.html` | ✅ | ❌ | **Conserva la barra** |
| `/layout/colapsable` | `Colapsable/templates/colapsable_layout.html` | ❌ | ❌ | No afectada |

**Archivos que se tocan (5):**

| # | Ruta absoluta | Acción |
|---|---|---|
| 1 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\js\multitab_shell.js` | MODIFICAR (5 puntos) |
| 2 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\static\js\acordeon.js` | MODIFICAR (2 puntos) |
| 3 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\css\colapsable.css` | MODIFICAR (1 punto: AÑADIR, no sustituir) |
| 4 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\templates\mainchat_layout.html` | MODIFICAR (3 sellos de caché) |
| 5 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\templates\main.html` | MODIFICAR (2 sellos de caché) |

**Convenciones obligatorias:**

- **JavaScript ES5 clásico**: `var` + `function`. Sin arrow functions, template literals,
  `const`/`let` ni spread. Es el estilo de los dos archivos JS que se tocan.
- **Todo en español**: código, comentarios, textos de interfaz.
- **Comentarios autocontenidos**: no referenciar rutas de `Planes/`, `.claude/` ni
  `CLAUDE.md` — esas carpetas están excluidas del despliegue a Azure y no llegan al
  servidor 139, así que serían referencias rotas en el código desplegado (H-18).
- **Regla de cierre:** si algo no calza con el código real, **DETENTE y reporta**.

**Cómo arrancar para probar** (carpeta `C:\APLICACIONES\ProdIA\Repo ProdIA\`, una línea,
consola normal, **sin** administrador):

```powershell
.\frontend\iniciar_frontend.bat
```

Espera `Running on http://127.0.0.1:5029`. La consola queda ocupada; se corta con `Ctrl+C`.

---

## §1 · Hallazgos de la auditoría

### Bloque A — Hallazgos de la v1 (el componente)

#### 🔴 H-1 — La cabecera ES un `<button>`: no se puede anidar otro botón dentro

**Evidencia:** `MainChat/static/js/acordeon.js` líneas 306-317:

```js
var cabecera = document.createElement('button');
cabecera.type = 'button';
cabecera.className = 'mc-cabecera';
...
cabecera.addEventListener('click', function () {
    colapsar(seccion.id);
});
```

Y `static/js/multitab_shell.js` líneas 1638-1641, donde el waffle se genera **como
`<button>`**. Un `<button>` dentro de otro es **HTML inválido**: el parser lo «corrige»
expulsando el anidado fuera de su padre, rompiendo el layout de la cabecera de forma
difícil de diagnosticar.

**Consecuencia:** el waffle pasa a `<span role="button" tabindex="0">`, lo que obliga a
reponer a mano la activación con **Enter** y **Espacio** (§3.1 cambio D).

#### 🔴 H-2 — El clic en el waffle colapsaría el panel

**Evidencia:** el listener de la cabecera (acordeon.js:314-316) **no recibe el objeto de
evento** y colapsa incondicionalmente.

El `e.stopPropagation()` de multitab_shell.js:1722 **no** protege: vive en un listener de
`document`, que en burbujeo corre **después** del de la cabecera. Cuando corta la
propagación, el panel ya se colapsó.

**Consecuencia:** la guarda va en la cabecera, ignorando clics originados en `#cn-anbtn`
(§3.2 cambio B). **No** se usa `stopPropagation` en el waffle: cortaría también el
listener de `document` que **abre su popover** — es el mismo evento.

#### 🟢 H-3 — Existe un precedente exacto en la misma cabecera: el badge «Act:»

**Evidencia:** `acordeon.js` líneas 355-364, con su comentario (351-354): *«Va DESPUÉS de
titulos (que es flex:1 y absorbe el espacio libre) y ANTES del botón de colapsar, así que
cae justo donde estaba el hueco vacío del header»*.

El waffle se inserta en el mismo bloque `if (seccion.id === 'insights')`, justo después.
No se inventa un mecanismo nuevo. Su CSS (`MainChat/static/css/acordeon.css` líneas
146-164) es el patrón visual a clonar: `flex: 0 0 auto`, fondo
`rgb(255 255 255 / 14%)`, icono en `#ccd32a`.

#### 🔴 H-4 — La cabecera se destruye y reconstruye en cada colapsar/expandir

**Evidencia:** `acordeon.js` línea 399: `raiz.innerHTML = '';` dentro de `render()`.

Dos consecuencias:
1. **No se le puede añadir un listener directo que sobreviva**: el nodo muere. Se mantiene
   la delegación en `document` que ya existe, y se añade la del teclado en el mismo sitio.
2. **Debe pintarse con el estado correcto en cada reconstrucción.** `acordeon.js` no conoce
   `__cnRailActiva` (privada del IIFE), así que hay que exponerla (§3.1 cambio E).

#### 🟡 H-5 — `__cnRailSync` busca el botón por `.cn-railbar`

**Evidencia:** `multitab_shell.js` líneas 1677-1682. **Call sites contados con `grep -n`:
4** — líneas 1784, 1819, 7157 y 7254. Todos pasan por esta única función, así que **basta
cambiarla a ella**.

En `/mainchat` la barra ya no existirá, así que `barra` sería `null` y el punto indicador
dejaría de refrescarse. La función debe localizar el botón por su `id` y reemplazarlo en su
sitio, **sirviendo a los dos contextos** (barra en la clásica, cabecera en MainChat).

#### 🟢 H-6 — El popover se sitúa a partir del botón: se recolocará solo

**Evidencia:** `multitab_shell.js` líneas 1736 y 1768, ambas
`var btn = document.getElementById("cn-anbtn");`. El popover es `position:fixed` y se sitúa
desde el `getBoundingClientRect()` del botón, así que **aparecerá junto a él esté donde
esté**. Hay además un listener de `resize` que lo reposiciona (1727-1729).

#### 🟢 H-7 — El listener del clic es por delegación: sobrevive al cambio de sitio

**Evidencia:** `multitab_shell.js` líneas 1720-1723, que buscan con
`t.closest("#cn-anbtn")`. Su propio comentario explica por qué: *«el botón se repinta con
la pestaña, así que un getElementById fijo apuntaría a un nodo muerto»*. **Funciona igual
con el botón en la cabecera.** No se toca.

#### 🟡 H-8 — Cuánto espacio se recupera exactamente

**Evidencia:** `colapsable.css` líneas 1481-1486: 34 px del botón + 8 px de padding a cada
lado + 1 px de borde = **51 px**. En la vista estrecha de la captura del usuario (≈537 px
útiles) es casi un **10 %**.

Precedente: multitab_shell.js:1629-1630 documenta que este riel medía **158 px** y ya se
redujo una vez. Esta tarea remata los 51 px restantes.

#### 🟢 H-9 — `MultiTabShell` ya expone una API pública donde encaja lo nuevo

**Evidencia:** `multitab_shell.js` línea 7303 expone 7 métodos. Añadir `analisisBtnHtml`
sigue el patrón, no lo inaugura. Y `acordeon.js` **ya depende de `MultiTabShell`**
(línea 76), así que la dependencia no es nueva.

#### 🟢 H-10 — Orden de carga garantizado

**Evidencia:** `mainchat_layout.html` líneas 146-149: `multitab_shell.js` va **antes** que
`acordeon.js`, y `defer` preserva el orden relativo. Además `acordeon.js` llama a
`montarShellUnaVez()` (línea 442) **antes** de `render()` (443).

Cuando `render()` construya la cabecera, `MultiTabShell.analisisBtnHtml` existirá. Aun así
la §3.2 lleva guarda defensiva.

#### 🟢 H-12 — Sin relación con la deuda conocida del proyecto

Ninguno de los puntos de la deuda documentada toca este componente. Es layout puro, sin
acceso a datos.

---

### Bloque B — Hallazgos nuevos de la v2 (pipelines y otras vistas)

#### 🔴 H-13 — El plan v1 ROMPÍA la vista clásica `/`: el waffle desaparecía

**Evidencia:**

```
$ grep -rn "multitab_shell.js" templates/ MainChat/templates/
templates/main.html:88                    <script src=".../multitab_shell.js">
MainChat/templates/mainchat_layout.html:146   <script defer src=".../multitab_shell.js">

$ grep -c "acordeon.js" templates/main.html
0
```

`templates/main.html` (vista clásica `/`) **carga `multitab_shell.js` pero NO
`acordeon.js`**. La v1 retiraba `.cn-railbar` del markup del viewer —que es común a ambas
vistas— e inyectaba el waffle solo desde `acordeon.js`.

**Resultado si se aplicase la v1:** en `/` no habría barra **ni** cabecera de acordeón, así
que **el waffle no existiría** y el usuario perdería el acceso al popover de análisis
(Desempeño del mes, Filiales). Regresión funcional en una vista viva: `mainchat_layout.html`
línea 93 tiene un acceso «Clásico» que navega a `main.index`.

**Consecuencia sobre el diseño — reformula la §3 entera:**
la barra `.cn-railbar` **se conserva**, y el markup del viewer la crea **solo cuando no hay
acordeón**. La detección es determinista: `.mc-shell` existe únicamente en
`mainchat_layout.html` (línea 29) y `.two-panel-layout` únicamente en `main.html` (línea 15).

Por el mismo motivo, el CSS de `.cn-railbar` y el estilo base de `.cn-anbtn` **NO se
borran**: la vista clásica los sigue usando. Los estilos del contexto nuevo (fondo verde de
la cabecera) se añaden como regla contextual `.mc-anbtn-caja .cn-anbtn`, sin tocar la base.

#### 🔴 H-14 — Faltan 5 sellos de caché, en 2 plantillas que la v1 no incluía

**Evidencia:**

```
templates/main.html:5                          colapsable.css   ?v=20260824d
templates/main.html:88                         multitab_shell.js ?v=20260826m
MainChat/templates/mainchat_layout.html:13     colapsable.css   ?v=20260825c
MainChat/templates/mainchat_layout.html:146    multitab_shell.js ?v=20260826m
MainChat/templates/mainchat_layout.html:148    acordeon.js      ?v=20260826a
```

Los tres archivos que cambian se sirven con sello **fijo**. Sin subirlos, quien tenga la
versión anterior en caché ejecutaría código viejo con CSS nuevo (o al revés) — por ejemplo
un `multitab_shell.js` que aún crea `.cn-railbar` junto a un `acordeon.js` que ya inyecta el
waffle en la cabecera: **dos waffles a la vez**, ambos con `id="cn-anbtn"` duplicado.

Es el mismo fallo que ya se documentó en la entrega del login. **Los 5 sellos suben a
`20260830a`**, y por eso `main.html` y `mainchat_layout.html` entran en el plan.

#### 🟢 H-15 — La tercera vista no se ve afectada

**Evidencia:** `Colapsable/templates/colapsable_layout.html` → `grep -c "multitab_shell"`
= **0**, `grep -c "acordeon.js"` = **0**. Y su CSS es **otro archivo**: lo sirve
`url_for('colapsable.static', ...)`, un blueprint distinto, no `static/css/colapsable.css`.

`/layout/colapsable` queda fuera del radio de impacto. Confirmado, no hay que tocarla.

#### 🟢 H-16 — Los 5 archivos están versionados en git

**Evidencia:** `git ls-files` devuelve los cinco. A diferencia del incidente de
`PanelLEft.png` en la entrega del login, aquí no hay riesgo de que el cambio no viaje por
falta de seguimiento. Todos son `.js`, `.css` y `.html`: el migrador los copia y coteja su
hash con normalidad.

#### 🟢 H-17 — `verificar_deploy.ps1` no cubre ninguno de estos archivos

**Evidencia:** el script solo comprueba `app.py`, `templates/login.html`,
`static/css/login.css`, `static/js/login.js` y los estáticos que referencia el login.

**Consecuencia:** no hay red de seguridad automática. **La validación humana de §6.2 es el
único gate real** — no habrá ningún `[FALLA]` que avise si algo se rompe.

#### 🟡 H-18 — Los comentarios no deben referenciar `Planes/`

**Evidencia:** `migrar_a_azure.ps1` líneas 65-76 — `$ExcluirRutas` incluye `'Planes'`,
`'.claude'` y `'CLAUDE.md'`: nunca llegan a Azure ni al 139.

Un comentario que diga «ver Planes/plan_X.md» es una referencia rota para quien lea el
código desplegado. Los comentarios de la §3 están escritos **autocontenidos** a propósito.

Confirmado además que ninguno contiene los términos prohibidos del escaneo de trazas
(`'claude'`, `'jaguez40'`), así que no bloquearán la publicación.

---

## §2 · Estado actual

En **ambas** vistas que montan el shell, el panel de contenido se reparte así:

```
.cn-shell (display:flex)
├── .cn-railbar   ← 51px fijos: fondo #f6f8f7, borde derecho, con el botón waffle
└── .cn-col       ← el resto: gráficos, tarjetas, análisis
```

El botón `#cn-anbtn` se genera en `multitab_shell.js:425` dentro del `innerHTML` del viewer,
y se refresca desde `__cnRailSync()` reemplazando el `innerHTML` de `.cn-railbar`. El
popover `#cn-anpop` vive aparte, en `document.body`.

En `/mainchat`, la cabecera de Insights contiene: `[num] [títulos] [badge Act:] [colapsar]`.

---

## §3 · Especificación

### §3.1 · MODIFICAR `static\js\multitab_shell.js`

**Cambio A — detectar en qué vista estamos (H-13).**

LOCALIZAR (línea 1627, la declaración de `__cnRailActiva`):

```js
  var __cnRailActiva = "desempeno";
```

SUSTITUIR POR:

```js
  var __cnRailActiva = "desempeno";

  // [2026-08-30] Este shell lo montan DOS vistas con layouts distintos:
  //   - /mainchat  → tiene acordeón (.mc-shell): el waffle va en la cabecera del panel
  //                  Insights, que lo pinta acordeon.js. No hace falta barra propia.
  //   - /          → NO carga acordeon.js: no hay cabecera donde alojarlo, así que
  //                  conserva la barra .cn-railbar de siempre.
  // Sin esta distinción, la vista clásica se quedaría SIN waffle y sin acceso a los
  // análisis. La marca .mc-shell existe solo en la plantilla de MainChat.
  function __cnHayAcordeon() {
    return !!document.querySelector(".mc-shell");
  }
```

**Cambio B — la barra solo se crea si no hay acordeón (H-13).**

LOCALIZAR (líneas 421-430):

```js
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

SUSTITUIR POR:

```js
        '  <div class="cn-shell">' +
             // [2026-08-25] CN-WAFFLE · el riel de 158px pasó a un botón que abre un popover.
             // El BOTÓN va aquí (se repinta con la pestaña, es barato); el POPOVER vive en
             // document.body y se monta una sola vez — este innerHTML lo destruiría (H2).
             // [2026-08-30] La barra solo se pinta en la vista clásica. En MainChat el
             // botón se fue a la cabecera del panel Insights (lo inyecta acordeon.js
             // llamando a MultiTabShell.analisisBtnHtml), y así esos 51px van a los
             // gráficos. Ver __cnHayAcordeon.
        (__cnHayAcordeon() ? '' :
        '    <div class="cn-railbar">' + __cnAnMenuBtn() + '</div>') +
        '    <div class="cn-col" id="cn-col">' +
        '      <div class="cn-canvas" id="cn-canvas"></div>' +
        '      <div class="cn-stack" id="cn-stack"></div>' +
        '    </div>' +
        '  </div></div>';
```

**Cambio C — el waffle deja de ser `<button>` (H-1).**

LOCALIZAR (líneas 1634-1642, la función completa):

```js
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

SUSTITUIR POR:

```js
  // [2026-08-30] Es un <span role="button">, NO un <button>: en MainChat vive dentro de
  // .mc-cabecera, que a su vez ES un <button> (el que colapsa el panel), y un botón
  // anidado dentro de otro es HTML inválido — el parser lo expulsaría fuera de su padre
  // y rompería el layout de la cabecera.
  // Al no ser un <button> hay que reponer a mano lo que este daba gratis: tabindex para
  // el foco, y Enter/Espacio, que se manejan en el listener de document.
  // Sirve igual en la vista clásica, donde sigue dentro de .cn-railbar.
  function __cnAnMenuBtn() {
    var act = __cnRailActiva;
    var cfg = act ? __CN_ANALISIS.filter(function (a) { return a.key === act; })[0] : null;
    var etiq = cfg ? ("Análisis · " + cfg.titulo) : "Análisis";
    return '<span role="button" tabindex="0" class="cn-anbtn' + (act ? " is-active" : "") + '"' +
      ' id="cn-anbtn" aria-haspopup="true" aria-expanded="false"' +
      ' title="' + esc(etiq) + '" aria-label="' + esc(etiq) + '">' +
      '<i class="bi bi-grid-3x3-gap-fill"></i></span>';
  }
```

**Cambio D — `__cnRailSync` localiza el botón por id, y teclado (H-5, H-1).**

LOCALIZAR (líneas 1677-1682, el principio de la función):

```js
  function __cnRailSync(activeKey) {
    __cnRailActiva = activeKey || null;
    // 1. El botón: se repinta entero (es un solo <button>, más simple que mutar clases).
    var barra = document.querySelector(".cn-railbar");
    if (barra) barra.innerHTML = __cnAnMenuBtn();
```

SUSTITUIR POR:

```js
  function __cnRailSync(activeKey) {
    __cnRailActiva = activeKey || null;
    // 1. El botón: se repinta entero (es un solo nodo, más simple que mutar clases).
    //    [2026-08-30] Se busca por id, no por su contenedor: puede estar en la barra
    //    (vista clásica) o en la cabecera del panel Insights (MainChat), que además
    //    acordeon.js reconstruye en cada colapsar/expandir. Se reemplaza el nodo en su
    //    sitio, sea cual sea, y así vale para los dos casos.
    var btnViejo = document.getElementById("cn-anbtn");
    if (btnViejo && btnViejo.parentNode) {
      var tmp = document.createElement("div");
      tmp.innerHTML = __cnAnMenuBtn();
      btnViejo.parentNode.replaceChild(tmp.firstChild, btnViejo);
    }
```

Y LOCALIZAR (líneas 1724-1726):

```js
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !pop.hidden) __cnAnMenuAbrir(false);
    });
```

SUSTITUIR POR:

```js
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !pop.hidden) { __cnAnMenuAbrir(false); return; }
      // [2026-08-30] Enter y Espacio sobre el waffle. Un <button> los traía de serie,
      // pero ahora es un <span role="button"> (ver __cnAnMenuBtn), así que hay que
      // manejarlos. Va aquí, en la delegación de document, y no en el nodo: la cabecera
      // que lo contiene se reconstruye entera en cada colapsar/expandir.
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var t = e.target;
      if (!t || typeof t.closest !== "function" || !t.closest("#cn-anbtn")) return;
      e.preventDefault();   // Espacio, si no, hace scroll de la página
      __cnAnMenuAbrir(pop.hidden);
    });
```

**Cambio E — exponer el HTML del botón para `acordeon.js` (H-4, H-9).**

LOCALIZAR (línea 7303):

```js
  window.MultiTabShell = { mount: mount, unmount: unmount, prewarm: __cnPrewarmGlobal, setActiveTab: setActiveTab, paintFocoStk: __cnPaintFocoStk, stackScroll: __cnStackScroll, compProdCargar: __cnCompProdCargar };
```

SUSTITUIR POR:

```js
  // [2026-08-30] analisisBtnHtml: acordeon.js lo llama al construir la cabecera del panel
  // Insights, donde ahora vive el waffle. Devuelve el HTML ya con el estado correcto
  // (punto indicador y title del análisis activo), porque esa cabecera se reconstruye en
  // cada colapsar/expandir y __cnRailActiva es privada de este módulo.
  window.MultiTabShell = { mount: mount, unmount: unmount, prewarm: __cnPrewarmGlobal, setActiveTab: setActiveTab, paintFocoStk: __cnPaintFocoStk, stackScroll: __cnStackScroll, compProdCargar: __cnCompProdCargar, analisisBtnHtml: __cnAnMenuBtn };
```

### §3.2 · MODIFICAR `MainChat\static\js\acordeon.js`

**Cambio A — insertar el waffle en la cabecera de Insights (H-3).**

LOCALIZAR (líneas 351-364):

```js
        if (seccion.id === 'insights') {
            var actBadge = document.createElement('span');
            actBadge.className = 'mc-act-badge';
            actBadge.title = 'Fecha del reporte más reciente cargado en la base de datos';
            actBadge.innerHTML = _actBadgeHtml();
            cabecera.appendChild(actBadge);
            _cargarAct();
        }

        cabecera.appendChild(colapsarIco);
```

SUSTITUIR POR:

```js
        if (seccion.id === 'insights') {
            var actBadge = document.createElement('span');
            actBadge.className = 'mc-act-badge';
            actBadge.title = 'Fecha del reporte más reciente cargado en la base de datos';
            actBadge.innerHTML = _actBadgeHtml();
            cabecera.appendChild(actBadge);
            _cargarAct();

            // [2026-08-30] Waffle de análisis. Antes vivía en una columna propia de 51px
            // a la izquierda del contenido; aquí no cuesta ancho porque ocupa el hueco
            // que ya sobraba en el header. Lo pinta el shell, que es quien sabe qué
            // análisis está activo. Guarda defensiva: si el shell no cargó, el panel
            // funciona igual, solo sin waffle.
            if (window.MultiTabShell && typeof window.MultiTabShell.analisisBtnHtml === 'function') {
                var caja = document.createElement('span');
                caja.className = 'mc-anbtn-caja';
                caja.innerHTML = window.MultiTabShell.analisisBtnHtml();
                cabecera.appendChild(caja);
            }
        }

        cabecera.appendChild(colapsarIco);
```

**Cambio B — la cabecera ignora los clics del waffle (H-2).**

LOCALIZAR (líneas 314-316):

```js
        cabecera.addEventListener('click', function () {
            colapsar(seccion.id);
        });
```

SUSTITUIR POR:

```js
        cabecera.addEventListener('click', function (e) {
            // [2026-08-30] El waffle de análisis vive dentro de esta cabecera (solo en
            // Insights). Sin esta guarda, pulsarlo colapsaría el panel: el clic burbujea
            // hasta aquí. No se resuelve con stopPropagation en el waffle porque el
            // listener que ABRE su popover está en document, y cortarlo lo dejaría muerto.
            var t = e && e.target;
            if (t && typeof t.closest === 'function' && t.closest('#cn-anbtn')) return;
            colapsar(seccion.id);
        });
```

### §3.3 · MODIFICAR `static\css\colapsable.css` — AÑADIR, sin borrar nada

> 🔴 **`.cn-railbar` y el estilo base de `.cn-anbtn` NO SE TOCAN**: la vista clásica los
> sigue usando (H-13). Solo se **añade** el bloque contextual del waffle en la cabecera.

LOCALIZAR (línea 1492 aproximadamente, el final del bloque del botón — la regla del punto
indicador):

```css
.cn-anbtn.is-active::after { content: ""; position: absolute; top: -2px; right: -2px;
```

INSERTAR **ANTES** de esa línea el siguiente bloque completo:

```css
/* [2026-08-30] Waffle dentro de la cabecera del panel Insights (solo en MainChat; en la
   vista clásica sigue en .cn-railbar, con los estilos de arriba intactos).
   Sobre el verde #004236 de la cabecera, el borde claro no se ve: el botón pasa a fondo
   translúcido, con los mismos valores que .mc-act-badge —el badge vecino— para que los
   dos se lean como una familia. */
.mc-anbtn-caja { flex: 0 0 auto; display: flex; align-items: center; }

.mc-anbtn-caja .cn-anbtn { width: 30px; height: 30px; border-radius: 8px; border: 0;
  background: rgb(255 255 255 / 14%); color: #fff; font-size: .95rem; }
.mc-anbtn-caja .cn-anbtn:hover { background: rgb(255 255 255 / 26%); border-color: transparent; }
.mc-anbtn-caja .cn-anbtn:focus-visible { outline: 2px solid #ccd32a; outline-offset: 2px; }
.mc-anbtn-caja .cn-anbtn[aria-expanded="true"] { background: rgb(255 255 255 / 30%);
  border-color: transparent; box-shadow: 0 0 0 1px #ccd32a; }

```

> ⚠️ **No borrar** `.cn-railbar` (línea 1481), ni el `.cn-anbtn` base (1484-1486), ni sus
> estados (1487-1489), ni el `.cn-railbar { padding: 8px 6px; }` del media query (1593):
> todo eso da servicio a la vista clásica.
> ⚠️ **No tocar** `.cn-anbtn.is-active::after`: el punto indicador se ve bien sobre ambos
> fondos.

### §3.4 · MODIFICAR `MainChat\templates\mainchat_layout.html` — sellos de caché (H-14)

LOCALIZAR (línea 13):

```html
    <link rel="stylesheet" href="{{ url_for('static', filename='css/colapsable.css') }}?v=20260825c">
```

SUSTITUIR POR:

```html
    <link rel="stylesheet" href="{{ url_for('static', filename='css/colapsable.css') }}?v=20260830a">
```

LOCALIZAR (línea 146):

```html
<script defer src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260826m"></script>
```

SUSTITUIR POR:

```html
<script defer src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260830a"></script>
```

LOCALIZAR (línea 148):

```html
<script defer src="{{ url_for('mainchat.static', filename='js/acordeon.js') }}?v=20260826a"></script>
```

SUSTITUIR POR:

```html
<script defer src="{{ url_for('mainchat.static', filename='js/acordeon.js') }}?v=20260830a"></script>
```

### §3.5 · MODIFICAR `templates\main.html` — sellos de caché (H-14)

LOCALIZAR (línea 5):

```html
    <link rel="stylesheet" href="{{ url_for('static', filename='css/colapsable.css') }}?v=20260824d">
```

SUSTITUIR POR:

```html
    <link rel="stylesheet" href="{{ url_for('static', filename='css/colapsable.css') }}?v=20260830a">
```

LOCALIZAR (línea 88):

```html
<script src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260826m"></script>
```

SUSTITUIR POR:

```html
<script src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260830a"></script>
```

---

## §4 · Orden de ejecución

Lo que se consume va antes que quien lo consume, y los sellos de caché al final, cuando el
código que sirven ya está en su sitio.

| # | Paso | Archivo | Comprobación al terminar |
|---|---|---|---|
| 1 | Detección de vista `__cnHayAcordeon` (§3.1 A) | `multitab_shell.js` | Contiene `__cnHayAcordeon` |
| 2 | Barra condicional (§3.1 B) | `multitab_shell.js` | `cn-railbar` sigue presente, dentro del ternario |
| 3 | Waffle a `<span>` (§3.1 C) | `multitab_shell.js` | Ya no hay `<button ... id="cn-anbtn"` |
| 4 | `__cnRailSync` por id + teclado (§3.1 D) | `multitab_shell.js` | Contiene `getElementById("cn-anbtn")` |
| 5 | Exponer `analisisBtnHtml` (§3.1 E) | `multitab_shell.js` | `window.MultiTabShell` lo incluye |
| 6 | Waffle en la cabecera (§3.2 A) | `acordeon.js` | Contiene `analisisBtnHtml` |
| 7 | Guarda del clic (§3.2 B) | `acordeon.js` | Contiene `closest('#cn-anbtn')` |
| 8 | CSS contextual (§3.3) | `colapsable.css` | Contiene `.mc-anbtn-caja` **y** sigue con `.cn-railbar` |
| 9 | 3 sellos (§3.4) | `mainchat_layout.html` | 3 × `?v=20260830a` |
| 10 | 2 sellos (§3.5) | `main.html` | 2 × `?v=20260830a` |
| 11 | Arrancar Flask y validar §6.1 | — | Sin errores en consola |

**Si cualquier paso falla, DETENERSE.** No continuar ni improvisar una variante.

---

## §5 · Reglas no negociables

1. **JavaScript ES5 clásico** en los dos archivos JS: `var` + `function`. Sin arrow
   functions, template literals, `const`/`let` ni spread.
2. **Todo en español**: código, comentarios, textos.
3. **NO borrar `.cn-railbar`** ni el estilo base de `.cn-anbtn` del CSS, ni la barra del
   markup: la vista clásica `/` los necesita (H-13). La barra pasa a ser **condicional**,
   no desaparece.
4. **El waffle NO puede ser un `<button>`**: dentro de `.mc-cabecera`, que ya lo es, sería
   HTML inválido (H-1).
5. **No usar `stopPropagation` en el waffle** para evitar el colapso: cortaría el listener
   de `document` que abre su popover (H-2). La guarda va en la cabecera.
6. **No mover el popover `#cn-anpop`** de `document.body`, ni cambiar su montaje único.
7. **No añadir listeners directos al nodo del waffle**: la cabecera se reconstruye en cada
   colapsar/expandir y morirían (H-4). Todo por delegación en `document`.
8. **No tocar el badge `Act:`** ni `_cargarAct()`.
9. **No añadir el waffle a las cabeceras de Historial ni Chat**: solo dentro del
   `if (seccion.id === 'insights')`.
10. **No tocar los 4 call sites de `__cnRailSync`**: basta con cambiar la función (H-5).
11. **Los 5 sellos de caché son obligatorios** (H-14): sin ellos puede convivir un JS viejo
    con un CSS nuevo y aparecer dos waffles con el mismo `id`.
12. **No tocar `Colapsable/`**: esa vista no carga estos archivos (H-15).
13. **Los comentarios nuevos no referencian `Planes/`, `.claude/` ni `CLAUDE.md`** (H-18).
14. **Si algo del plan no calza con el código real, DETENTE y reporta.**

---

## §6 · Validación

### §6.1 · Estática — la ejecuta el EXECUTOR

Desde `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, **uno por uno**, consola normal
(**no** requiere administrador).

| # | Comando | Resultado esperado |
|---|---|---|
| 1 | `Select-String -Path static\js\multitab_shell.js -Pattern "__cnHayAcordeon" \| Measure-Object \| Select-Object -ExpandProperty Count` | `3` (comentario, definición, uso) |
| 2 | `Select-String -Path static\js\multitab_shell.js -Pattern "cn-railbar" \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` (sigue existiendo, condicional — H-13) |
| 3 | `Select-String -Path static\css\colapsable.css -Pattern "\.cn-railbar" \| Measure-Object \| Select-Object -ExpandProperty Count` | `2` (NO se borró: la clásica lo usa) |
| 4 | `Select-String -Path static\css\colapsable.css -Pattern "mc-anbtn-caja" \| Measure-Object \| Select-Object -ExpandProperty Count` | `5` |
| 5 | `Select-String -Path static\js\multitab_shell.js -Pattern "analisisBtnHtml" \| Measure-Object \| Select-Object -ExpandProperty Count` | `2` |
| 6 | `Select-String -Path MainChat\static\js\acordeon.js -Pattern "analisisBtnHtml" \| Measure-Object \| Select-Object -ExpandProperty Count` | `2` |
| 7 | `Select-String -Path MainChat\static\js\acordeon.js -Pattern "closest\('#cn-anbtn'\)" \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` |
| 8 | `Select-String -Path static\js\multitab_shell.js -Pattern 'id="cn-anbtn"' \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` (y en un `<span>`, no en un `<button>`) |
| 9 | `Select-String -Path MainChat\templates\mainchat_layout.html -Pattern "v=20260830a" \| Measure-Object \| Select-Object -ExpandProperty Count` | `3` |
| 10 | `Select-String -Path templates\main.html -Pattern "v=20260830a" \| Measure-Object \| Select-Object -ExpandProperty Count` | `2` |
| 11 | `Select-String -Path MainChat\static\js\acordeon.js -Pattern "=>" \| Measure-Object \| Select-Object -ExpandProperty Count` | `0` (sigue en ES5) |

**Arranque** (desde `C:\APLICACIONES\ProdIA\Repo ProdIA\`, una línea; la consola queda
ocupada, se corta con `Ctrl+C`):

```powershell
.\frontend\iniciar_frontend.bat
```

Esperado: `Running on http://127.0.0.1:5029` sin trazas de error.

**🔴 El EXECUTOR NO PUEDE VALIDAR NADA VISUAL.** No tiene navegador: no puede pulsar el
waffle, ver si el popover se abre en su sitio ni comprobar que el panel no se colapsa.
Debe reportar **«implementado, PENDIENTE de validación humana»**, nunca «completado».

### §6.2 · Humana — la ejecuta el USUARIO en el navegador

Con **F12 → Console** abierta y refresco duro (`Ctrl+F5`) en cada vista.

**En `/mainchat`:**

| # | Qué probar | Qué debe pasar |
|---|---|---|
| 1 | Mirar la cabecera de Insights | El waffle aparece entre el badge `Act:` y el botón de colapsar |
| 2 | El contenido del panel | Ya **no** hay columna gris a la izquierda; los gráficos ganan ~51 px |
| 3 | Clic en el waffle | Se abre el popover «Análisis disponibles» **y el panel NO se colapsa** |
| 4 | Posición del popover | Aparece junto al waffle, sin quedar cortado |
| 5 | Elegir un análisis | Se pinta como siempre; el popover se cierra |
| 6 | El punto indicador | Muestra el punto del análisis activo, y su tooltip lo nombra |
| 7 | Clic en el resto de la cabecera | El panel **sí** colapsa, como antes |
| 8 | Colapsar y volver a expandir Insights | El waffle sigue ahí, con el punto correcto, y funciona |
| 9 | Cambiar de análisis y colapsar/expandir | El punto refleja el análisis correcto |
| 10 | Tabular hasta el waffle y pulsar Enter | Abre el popover |
| 11 | Escape con el popover abierto | Se cierra |
| 12 | Redimensionar con el popover abierto | Se recoloca junto al waffle |
| 13 | Cabeceras de Historial y Chat | **No** tienen waffle; colapsan con normalidad |

**🔴 En `/` (vista clásica) — la regresión que evita H-13:**

| # | Qué probar | Qué debe pasar |
|---|---|---|
| 14 | Abrir `/` y mirar el panel de Consulta | La columna gris `.cn-railbar` **sigue ahí**, con su waffle |
| 15 | Clic en ese waffle | Abre el popover con normalidad |
| 16 | Elegir un análisis | Se pinta como siempre |
| 17 | Que NO haya dos waffles | Solo uno en pantalla |

| # | Qué probar | Qué debe pasar |
|---|---|---|
| 18 | `/layout/colapsable` | Sin cambios (no carga estos archivos) |
| 19 | Consola F12 en las tres vistas | **0 errores** |

**Solo el usuario marca ✅ esta feature.**

### §6.3 · Antes de migrar a Azure

Validado §6.2 en el servidor de pruebas, el pipeline es el de siempre, en tres tiempos,
desde `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`:

```powershell
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Aplicar
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Push
```

El primero debe listar los **5** archivos. `verificar_deploy.ps1` no cubre ninguno (H-17),
así que la validación humana de §6.2 es el único gate real.

---

## §7 · Fuera de alcance

- **Llevar el waffle a la cabecera también en la vista clásica `/`.** Su layout no tiene
  una cabecera equivalente donde alojarlo; conserva su barra (H-13). Rediseñarla es tarea
  aparte.
- **Mover el waffle de usuario (`#mc-menu`)**, el otro menú de MainChat: componente
  distinto, funciona bien.
- **Rediseñar el popover** «Análisis disponibles»: solo cambia dónde está su disparador.
- **Añadir análisis nuevos** a `__CN_ANALISIS`.
- **Tocar `.cn-col`, `.cn-canvas` o `.cn-stack`**: heredan el ancho recuperado sin cambios.
- **La opción (A)** del análisis previo (waffle flotante superpuesto): descartada.
- **`Colapsable/`**: fuera del radio de impacto (H-15).
- **Migrar a Azure DevOps**: el plan termina en local; la migración la lanza el usuario tras
  validar §6.2 en Pruebas.

---

## Prompt para el agente EXECUTOR

```
Eres un agente EXECUTOR. Lee completo el plan indicado y ejecútalo AL PIE DE LA LETRA.
Plan: C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\Planes\plan_WAFFLE-A-CABECERA_20260830.md
Reglas: CERO modificaciones. Orden secuencial. Si falla, DETENTE. Reporta: ✅/❌ Paso N.
Al final: archivos tocados + "¿Hago commit?"
```

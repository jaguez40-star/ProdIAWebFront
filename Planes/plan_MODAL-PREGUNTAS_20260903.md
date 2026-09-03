# plan_MODAL-PREGUNTAS_20260903 — Las preguntas de ejemplo pasan de lista plana a modal categorizado

**ID_TAREA:** `MODAL-PREGUNTAS`
**Fecha:** 2026-09-03
**Rol del lector:** agente EXECUTOR
**Repo:** `ProdIAWebFront` (`C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`) — **UN solo repo, un solo commit.**
**Alcance:** 3 archivos (1 HTML, 1 CSS, 1 JS). Cero backend, cero BD.

> **Verificación v2 (2026-09-03, segunda pasada) — el plan pasó la auditoría sin fallos
> bloqueantes.** Todo lo esencial se confirmó midiendo, no razonando:
> - ✅ Los dos bloques a reemplazar de §3.3 (`__cnHistToggle` :1113-1124, `__cnHistUsar`
>   :1125-1130) calzan **exactos** con el código real.
> - ✅ `esc()` (:29) y `el()` (:33) están definidas al inicio del IIFE — las funciones nuevas
>   de §3.3 las ven sin problema.
> - ✅ `bootstrap.bundle.min.js` (bundle completo, incluye el plugin **Tab**) lo carga
>   `base.html:90`, y el modal de Admin **ya usa `data-bs-toggle="pill"` con éxito** — el
>   patrón está probado en producción, no es una apuesta.
> - ✅ `__cnHistSeed` tiene **UN solo consumidor** (:1122, dentro del bloque que se reemplaza):
>   cambiarlo de array-de-strings a array-de-objetos no rompe nada más.
> - ✅ `__cnHistBoton` (:1105) queda **fuera** del bloque reemplazado → el fallback clásico lo
>   sigue usando.
> - ✅ Los IDs de paneles no colisionan: Admin usa `mc-admin-pane-*`, este usa `mc-preg-pane-*`.
> - ✅ Las **8 plantillas originales** están todas repartidas en el nuevo array (verificado por
>   búsqueda literal).
> - 🟢 Precisión añadida (H9): `__cnPregModalPintar` pinta en tab-panes **ocultos** justo antes
>   de `.show()`. Es válido en Bootstrap (el DOM existe aunque el pane esté oculto) y a
>   propósito — a diferencia de Admin, que se puebla con `shown.bs.modal`. Aquí el contenido es
>   síncrono y barato (leer `__cnHistory` + mapear strings), así que no hay motivo para diferirlo.

> **Petición del usuario (2026-09-03):** el desplegable de preguntas de ejemplo se sustituye por
> un **modal categorizado por temática**, del mismo tipo que el de Admin. El primer grupo es
> **Histórico** (las preguntas que el usuario ya formuló en la conversación); los siguientes
> agrupan las preguntas de muestra por tema.
>
> **Decisión del usuario, cerrada:** **solo en MainChat** (`/mainchat`). La vista clásica `/`
> conserva el desplegable actual sin tocarlo.

---

## 0. Contexto para el agente EXECUTOR

### 0.1 Qué se pide y qué NO

Hoy, el botón del reloj (🕐) junto al input abre un **desplegable plano** con dos bloques
concatenados: las preguntas ya formuladas arriba y 8 plantillas de ejemplo abajo, todas
seguidas, sin agrupar. Lo que se pide es que en **MainChat** ese botón abra un **modal de dos
columnas** (nav lateral + panel), con las preguntas repartidas por temática.

**NO se pide** (y NO se hace): cambiar qué pasa al hacer clic en una pregunta, tocar el
backend, ni cambiar la vista clásica `/`.

### 0.2 Rutas absolutas

| Qué | Ruta |
|---|---|
| MODIFICAR 1 (markup del modal) | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\templates\mainchat_layout.html` |
| MODIFICAR 2 (estilos) | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\static\css\mainchat.css` |
| MODIFICAR 3 (lógica) | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\js\multitab_shell.js` |
| Molde a clonar (NO tocar) | el modal `#mc-admin-modal` en MODIFICAR 1, líneas 126-183 |

⚠️ **`multitab_shell.js` lo comparten las DOS interfaces** (`/` y `/mainchat`). Todo lo que se
añada ahí debe **degradar sin ruido** cuando el modal no existe (vista clásica). Es la regla que
más condiciona este plan — ver H3 y NN-2.

### 0.3 Cómo se prueba

El frontend **no compila nada**: es JS y CSS servidos tal cual por Flask.

```powershell
cd 'C:\APLICACIONES\ProdIA\Repo ProdIA\frontend'
node --check static/js/multitab_shell.js
```
→ Esperado: **sin salida** (exit 0). Es la única verificación automática que existe para este
archivo; no hay tests de JS en el proyecto.

Para ver el cambio: recargar `/mainchat` con **Ctrl+F5** (el JS se cachea).

### 0.4 Convenciones que DEBES respetar

1. **El clic RELLENA el input, nunca envía.** Está documentado como deliberado en
   `multitab_shell.js:1094-1095`: *«clic = rellena, NO envía — evita reenvíos accidentales de
   una pregunta vieja»*. `__cnHistUsar` ya hace exactamente eso y **se reutiliza tal cual**.
2. **Escapado:** las preguntas del historial (`b.html`) **ya vienen escapadas** por `__cnBubble`;
   las plantillas nuevas llegan **sin escapar** y pasan por `esc()`. Ese contraste está
   documentado en `:1096-1100` y hay que conservarlo exactamente (ver NN-4).
3. **Bootstrap ya está cargado** en MainChat (`base.html` trae el bundle) — el modal usa
   `data-bs-toggle="pill"` para las secciones: **cero JS propio para el cambio de sección**.

---

## 1. Hallazgos de la auditoría

Auditoría del 2026-09-03: lectura de `multitab_shell.js:1049-1138` (el desplegable completo),
`mainchat_layout.html:82-183` (waffle + modal Admin), `mainchat.js:100-149` (el despacho
`data-modal` y el patrón `shown.bs.modal`), `mainchat.css:213-292` (el CSS del modal), más
`grep` de todos los usos de `cn-hist-drop`.

### 🟢 H1 — El molde existe, es reciente y está documentado: se clona, no se inventa

`#mc-admin-modal` (`mainchat_layout.html:126-183`) ya tiene **exactamente** la estructura pedida:

```
.modal-dialog.modal-xl.modal-dialog-centered.mc-admin-dialog
└─ .modal-body.mc-admin-body            ← flex de 2 columnas
   ├─ .nav.flex-column.mc-admin-nav     ← nav lateral (role="tablist")
   │   └─ .mc-admin-nav__item  ×3       ← data-bs-toggle="pill" + data-bs-target
   └─ .tab-content.mc-admin-content
       └─ .tab-pane.mc-admin-panel ×3   ← una por sección
```

Su CSS (`mainchat.css:213-292`) ya resuelve el ancho, el flex de dos columnas, el scroll
**independiente por columna** y los estados `hover`/`active` del nav. **Este plan reusa ese CSS
tal cual** con clases propias que lo heredan (§3.2), en vez de duplicarlo.

⚠️ El comentario de `:127-132` documenta una decisión que hay que respetar: **NO** se usa
`modal-dialog-scrollable`, porque el scroll lo gestionan las dos columnas por separado.

### 🟢 H2 — Abrir el modal NO necesita JS nuevo: `data-modal` ya es genérico

`mainchat.js:123-132` despacha **cualquier** botón con `data-modal="<id>"`:

```javascript
const modalId = acceso.dataset.modal;
if (modalId) {
    const el = document.getElementById(modalId);
    if (el && typeof window.bootstrap !== 'undefined' && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(el).show();
```

⚠️ Pero eso solo aplica a botones **dentro del waffle** (`menu.querySelectorAll('.mc-acceso')`).
El botón del reloj vive en el **input del chat**, que pinta `multitab_shell.js`. Así que la
apertura se hace desde ahí, con el mismo idiom de Bootstrap (§3.3, `__cnHistToggle`).

### 🔴 H3 — BLOQUEANTE: `multitab_shell.js` lo comparten las dos interfaces

Medido: el botón (`:1063`), el desplegable (`:1058`) y `__cnHistToggle` (`:1113`) están en
`multitab_shell.js`, que montan **`/` (clásica) y `/mainchat`**. El modal, en cambio, vivirá
solo en `mainchat_layout.html`.

⇒ `__cnHistToggle` debe **detectar si el modal existe** y, si no, caer al desplegable de
siempre. Sin esa bifurcación, el botón del reloj **quedaría muerto en la vista clásica** — una
regresión silenciosa en una interfaz que el usuario no pidió tocar.

**Decisión cerrada:** el desplegable **NO se borra**. Se conserva íntegro como camino de la
vista clásica. El modal es un camino nuevo que solo se toma si `#mc-preguntas-modal` está en el
DOM.

### 🔴 H4 — `cn-hist-drop` se cierra desde CUATRO sitios, no uno

`grep` de `cn-hist-drop`, más allá de su propio bloque:

| Línea | Qué hace |
|---|---|
| `:1128` | `__cnHistUsar` lo cierra tras rellenar el input |
| `:1135-1137` | listener global de «clic fuera» |
| `:6411` | lo cierra al preguntar |
| `:7611`, `:7619` | lo cierra al cargar/restaurar una conversación |

⇒ Si el desplegable se hubiera **sustituido**, esos 4 sitios quedarían apuntando a un nodo
inexistente. Como H3 decide **conservarlo**, todos siguen funcionando sin tocarse. **Este plan
NO modifica ninguna de esas 4 líneas.**

🔑 Y al revés: el modal **no necesita** ninguna de ellas. Bootstrap cierra el modal solo (botón
✕, `Esc`, clic en el backdrop), y `__cnHistUsar` ya cierra «lo que haya» de forma defensiva
(§3.3).

### 🟡 H5 — Las preguntas ya formuladas salen de `__cnHistory`, y ya están escapadas

`:1116-1117`:

```javascript
var qs = __cnHistory.filter(function (b) { return b.role === "user"; })
                     .map(function (b) { return b.html; }).reverse();
```

`b.html` **ya viene escapado** (lo guarda `__cnBubble`), y el comentario de `:1096-1100`
advierte que inyectarlo con `innerHTML` lo decodifica **una vez**, de modo que
`btn.textContent` devuelve el texto original. Las plantillas de `__cnHistSeed`, en cambio,
llegan **crudas** y por eso pasan por `esc()` en `:1122`.

⇒ **Ese contraste se replica exacto en el modal.** Escapar dos veces el historial rompería las
tildes y los signos `¿`; no escapar las plantillas sería un XSS de manual.

### 🟡 H6 — `__cnHistSeed` es una lista plana de 8: hay que darle estructura

`:1083-1092` — 8 plantillas, sin categoría. Este plan las convierte en una estructura agrupada
(§3.1) **sin perder ninguna** y añadiendo las capacidades nuevas (H7).

### 🟠 H7 — Oportunidad medida: hay capacidades reales que NADIE descubre

Las preguntas habilitadas hoy mismo **no están** en las 8 plantillas. Verificado contra los
planes ya ejecutados y publicados:

| Capacidad | Commit | ¿Está en las plantillas? |
|---|---|---|
| Distribución % por campo | `1661153`, `2a96e3b` | ❌ |
| Campos de un ACTIVO (panel scoped) | `0939de9`, `113b38e` | ❌ |
| Ranking de activos | `113b38e` | ❌ |
| Ventana móvil («últimos 30 días») | `e90199a` + `bea7bf9` | ❌ |
| «El activo X» vs «el campo X» | `bc0a308`, `7ee5043` | ❌ |

⇒ Se añaden en §3.1. **Es la razón de más peso del cambio**: un catálogo categorizado que no
muestre lo que el motor sabe hacer desaprovecha el trabajo de toda la semana.

### 🟢 H9 — Pintar antes de `.show()` es válido, y aquí es lo correcto

`__cnPregModalPintar()` (§3.3) rellena los `<div id="mc-preg-cat-N">` **antes** de llamar a
`.show()`, cuando los tab-panes aún están ocultos. Es distinto del modal de Admin, que se puebla
con el evento `shown.bs.modal` (`mainchat.js:144`).

⇒ **Es correcto por dos razones:** (1) el DOM de un tab-pane oculto existe y es escribible en
Bootstrap; `innerHTML` funciona igual visible u oculto. (2) Admin difiere la carga porque hace
un `fetch` (coste de red que no conviene pagar en cada apertura); aquí el contenido es
**síncrono y barato** — leer `__cnHistory` en memoria y mapear ~28 strings — así que no hay nada
que diferir. Pintar antes garantiza que el contenido ya está cuando el modal aparece, sin
parpadeo.

### 🟢 H8 — El markup del modal se pinta en el layout, no en JS

`#mc-admin-modal` es HTML estático en `mainchat_layout.html`, **fuera** de `#mc-chat-body`. El
comentario de `:123-125` explica por qué: así el acordeón y el historial no lo destruyen al
repintar. El modal nuevo va **al lado**, con el mismo criterio.

⇒ Las secciones y su nav son **estáticas** (una por categoría, escritas a mano en el HTML). Lo
único dinámico es el contenido de **Histórico** y las listas de botones, que `multitab_shell.js`
rellena al abrir.

---

## 2. Estado actual

| Pieza | Dónde | Qué hace |
|---|---|---|
| Botón 🕐 | `multitab_shell.js:1063-1066` | `onclick="window.__cnHistToggle()"` |
| Desplegable | `multitab_shell.js:1058-1061` | `<div id="cn-hist-drop" hidden>` posicionado sobre el input |
| Plantillas | `multitab_shell.js:1083-1092` | `__cnHistSeed`, 8 strings planos |
| Pintado | `multitab_shell.js:1113-1124` | `__cnHistToggle` concatena historial + cabecera + seeds |
| Clic | `multitab_shell.js:1125-1130` | `__cnHistUsar` rellena el input y cierra |

---

## 3. Especificación

### 3.1 MODIFICAR `multitab_shell.js` — `__cnHistSeed` pasa a estructura categorizada

Localiza el bloque **completo** de `__cnHistSeed` (`:1076-1092`, desde el comentario
`// [2026-08-26] Plantillas de arranque` hasta el `];`) y **reemplázalo** por:

```javascript
  // [2026-08-26] Plantillas de arranque (petición del usuario): dan un punto de partida a quien
  // no sabe qué preguntar. Llevan "…" donde va el dato (producto/campo/mes/año): clic RELLENA el
  // input (nunca envía, mismo contrato que el resto), así que el usuario edita el "…" antes de
  // preguntar.
  //
  // [2026-09-03 · MODAL-PREGUNTAS] De lista plana a CATEGORÍAS. Dos motivos:
  //   1. El desplegable plano mezclaba 8 plantillas sin jerarquía; con el modal hay sitio para
  //      agruparlas por lo que el usuario quiere HACER, no por cómo está construido el motor.
  //   2. Varias capacidades reales NO estaban aquí y por tanto nadie las descubría: distribución
  //      porcentual, campos de un ACTIVO, ranking de activos y la ventana móvil («últimos 30
  //      días») se habilitaron entre el 2026-09-01 y el 09-03 y ninguna tenía plantilla.
  // La estructura es [{cat, icono, items:[...]}, ...]; el orden de este array ES el orden del nav
  // del modal. "Histórico" NO va aquí: es la primera sección y sale de __cnHistory (ver
  // __cnPregModalPintar).
  var __cnHistSeed = [
    {
      cat: "Análisis",
      icono: "bi-graph-up-arrow",
      items: [
        "Analiza el comportamiento del producto …",
        "Analiza el comportamiento de la producción de … en el Campo …",
        "¿Qué campos explican el faltante de …?",
        "¿Cuáles son las causas de las diferidas en el campo …?",
        "¿Cómo vamos este mes?"
      ]
    },
    {
      cat: "Cifras",
      icono: "bi-123",
      items: [
        "¿Cuánto crudo produjo el campo …?",
        "¿Cuál es la producción del activo …?",
        "¿Cuál es el acumulado del año de …?",
        "¿Cuánto produjo … el mes pasado?"
      ]
    },
    {
      cat: "Comparar y ordenar",
      icono: "bi-bar-chart-steps",
      items: [
        "¿Cuáles son los 5 campos que más crudo producen?",
        "¿Cómo se distribuye la producción de crudo, %, entre los campos productores?",
        "¿Cuáles campos del activo … producen más crudo?",
        "¿Cuál es el activo que más crudo produce?",
        "¿Qué campos se quedaron más cortos vs presupuesto?"
      ]
    },
    {
      cat: "En el tiempo",
      icono: "bi-calendar3",
      items: [
        "Muéstrame la producción del campo …, día a día para el mes de …",
        "Muéstrame la producción del campo …, mes a mes para el año …",
        "¿Cuánto produjo … en los últimos 30 días?",
        "¿Cuál ha sido la variación porcentual de la producción de … mes a mes en 2026, para el campo …?",
        "¿Cuál fue el mejor día de … este mes?"
      ]
    },
    {
      cat: "Estructura",
      icono: "bi-diagram-3",
      items: [
        "¿Qué campos tiene el activo …?",
        "¿A qué activo pertenece el campo …?",
        "¿Cuántos pozos tiene …?"
      ]
    },
    {
      cat: "Operación",
      icono: "bi-tools",
      items: [
        "¿Qué mantenimientos se han realizado en el campo …, en el último mes?",
        "¿Qué diferidas hubo en …?"
      ]
    }
  ];
```

⚠️ **Las 8 plantillas originales se conservan todas**, repartidas entre `Análisis` (4),
`En el tiempo` (3) y `Operación` (1). El resto son las capacidades de H7 más formas ya
soportadas y verificadas en los planes de esta semana.

### 3.2 MODIFICAR `mainchat.css` — estilos del modal nuevo

**Ubicación:** al final del archivo. Añade este bloque completo:

```css
/* [2026-09-03 · MODAL-PREGUNTAS] Modal de preguntas de ejemplo, categorizado.
   Hereda la maquetación del modal de Admin (.mc-admin-*, :213-292): mismo flex de dos
   columnas, mismo scroll independiente por columna, mismos estados del nav. Se declaran
   como selectores hermanos en vez de duplicar reglas — si Admin cambia de ancho o de
   paleta, este lo sigue. Lo único propio es la lista de preguntas (.mc-preg-item). */
.mc-preg-dialog { max-width: calc(1140px * 1.05); }

.mc-preg-body { display: flex; gap: 0; padding: 0; min-height: 420px; }

.mc-preg-nav {
    flex: 0 0 210px;
    border-right: 1px solid #e5e7eb;
    padding: 12px 8px;
    overflow-y: auto;
    max-height: 60vh;
}

.mc-preg-nav__item {
    display: flex; align-items: center; gap: 10px;
    width: 100%; text-align: left;
    background: none; border: 0; border-radius: 8px;
    padding: 9px 12px; margin-bottom: 2px;
    font-size: 14px; color: #374151; cursor: pointer;
}

.mc-preg-nav__item i { font-size: 15px; color: #6b7280; }
.mc-preg-nav__item:hover { background: #f3f4f6; }
.mc-preg-nav__item.active { background: #ecfdf5; color: #065f46; font-weight: 600; }
.mc-preg-nav__item.active i { color: #15794C; }

.mc-preg-content { flex: 1 1 auto; padding: 16px 20px; overflow-y: auto; max-height: 60vh; }

.mc-preg-panel__title {
    font-size: 15px; font-weight: 700; color: #111827;
    margin: 0 0 4px;
}

/* La ayuda del "…": el usuario tiene que editarlo ANTES de enviar. Se dice una vez por
   panel, no por pregunta, para no repetir 5 veces la misma línea. */
.mc-preg-panel__hint {
    font-size: 12px; color: #6b7280; margin: 0 0 12px;
}

.mc-preg-item {
    display: block; width: 100%; text-align: left;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 10px 12px; margin-bottom: 6px;
    font-size: 13px; color: #1f2937; cursor: pointer;
    /* Sin white-space:nowrap (a diferencia del desplegable viejo, :1108): aquí hay ancho de
       sobra y una pregunta larga se lee entera en vez de cortarse con puntos suspensivos. */
}

.mc-preg-item:hover { background: #f1f4f1; border-color: #15794C; }

.mc-preg-vacio { font-size: 13px; color: #6b7280; font-style: italic; }
```

### 3.3 MODIFICAR `multitab_shell.js` — pintado del modal y bifurcación

**Ubicación:** localiza `window.__cnHistToggle` (`:1113-1124`) y **reemplaza la función
completa** por este bloque (que añade dos funciones nuevas **antes** de ella):

```javascript
  // [2026-09-03 · MODAL-PREGUNTAS] Pinta el modal categorizado. Solo existe en MainChat: el
  // markup vive en mainchat_layout.html, fuera de #mc-chat-body para que el repintado del
  // acordeón no lo destruya (mismo criterio que el modal de Admin).
  // 🔑 ESCAPADO, dos reglas distintas y deliberadas (ver el comentario de 2026-08-26 abajo):
  //    · el historial (b.html) YA viene escapado por __cnBubble -> se inyecta tal cual;
  //    · las plantillas llegan crudas -> pasan por esc().
  //    Escapar dos veces el historial rompería tildes y "¿"; no escapar las plantillas sería XSS.
  function __cnPregModalPintar() {
    var cont = el("mc-preg-hist");
    if (cont) {
      var qs = __cnHistory.filter(function (b) { return b.role === "user"; })
                          .map(function (b) { return b.html; }).reverse();
      cont.innerHTML = qs.length
        ? qs.map(__cnPregItem).join("")
        : '<p class="mc-preg-vacio">Todavía no has preguntado nada en esta conversación.</p>';
    }
    // Las categorías son estáticas en el HTML; aquí solo se rellenan sus listas. El índice del
    // panel coincide con el del array porque el nav se escribe en el mismo orden (ver §3.4).
    for (var i = 0; i < __cnHistSeed.length; i++) {
      var caja = el("mc-preg-cat-" + i);
      if (caja) caja.innerHTML = __cnHistSeed[i].items.map(esc).map(__cnPregItem).join("");
    }
  }

  function __cnPregItem(h) {
    return '<button type="button" class="mc-preg-item" onclick="window.__cnHistUsar(this)">' +
      h + '</button>';
  }

  window.__cnHistToggle = function () {
    // [2026-09-03 · MODAL-PREGUNTAS] Dos caminos a propósito. multitab_shell.js lo montan LAS
    // DOS interfaces, pero el modal solo existe en /mainchat: si no está en el DOM se cae al
    // desplegable de siempre, que se conserva íntegro. Sin esta bifurcación el botón del reloj
    // quedaría muerto en la vista clásica — una regresión en una interfaz que nadie pidió tocar.
    var m = el("mc-preguntas-modal");
    if (m && typeof window.bootstrap !== "undefined" && window.bootstrap.Modal) {
      __cnPregModalPintar();
      window.bootstrap.Modal.getOrCreateInstance(m).show();
      return;
    }
    var d = el("cn-hist-drop"); if (!d) return;
    if (!d.hidden) { d.hidden = true; return; }
    var qs = __cnHistory.filter(function (b) { return b.role === "user"; })
                         .map(function (b) { return b.html; }).reverse();
    var cabeceraSeed = '<div style="padding:8px 12px 4px;color:#6E7C75;font-size:11px;' +
      'text-transform:uppercase;letter-spacing:.03em;">Preguntas de ejemplo — edita el "…" ' +
      'antes de enviar</div>';
    // [2026-09-03] __cnHistSeed ya no es plano: se aplana aquí para el desplegable de la vista
    // clásica, que sigue siendo una lista sin categorías.
    var planas = [];
    for (var i = 0; i < __cnHistSeed.length; i++) {
      planas = planas.concat(__cnHistSeed[i].items);
    }
    d.innerHTML = qs.map(__cnHistBoton).join("") +
      cabeceraSeed + planas.map(esc).map(__cnHistBoton).join("");
    d.hidden = false;
  };
```

⚠️ **`__cnHistBoton` (`:1105-1112`) NO se toca**: lo sigue usando el desplegable clásico.
El modal usa `__cnPregItem`, que es otro estilo (sin `nowrap`, con borde).

**Edición 2 — `__cnHistUsar` debe cerrar también el modal.** Localiza (`:1125-1130`):

```javascript
  window.__cnHistUsar = function (btn) {
    var inp = el("cn-input"); if (!inp || !btn) return;
    inp.value = btn.textContent;
    var d = el("cn-hist-drop"); if (d) d.hidden = true;
    inp.focus();
  };
```

Reemplázala por:

```javascript
  window.__cnHistUsar = function (btn) {
    var inp = el("cn-input"); if (!inp || !btn) return;
    inp.value = btn.textContent;
    var d = el("cn-hist-drop"); if (d) d.hidden = true;
    // [2026-09-03 · MODAL-PREGUNTAS] Cierra el modal si el clic vino de ahí. `getInstance`
    // (no `getOrCreateInstance`): si el modal nunca se abrió no hay nada que cerrar y crear
    // una instancia para nada sería un efecto colateral silencioso.
    var m = el("mc-preguntas-modal");
    if (m && typeof window.bootstrap !== "undefined" && window.bootstrap.Modal) {
      var inst = window.bootstrap.Modal.getInstance(m);
      if (inst) inst.hide();
    }
    inp.focus();
  };
```

🔑 **El contrato se conserva exacto:** rellena el input, no envía. `btn.textContent` sigue
devolviendo el texto original en ambos caminos (H5).

### 3.4 MODIFICAR `mainchat_layout.html` — el markup del modal

**Ubicación:** inmediatamente **después** del cierre del modal de Admin (la línea `</div>` que
cierra `#mc-admin-modal`, línea 183) y **antes** del comentario `<!-- El "Desempeño del mes"…`
(línea 185).

```html
<!-- [2026-09-03 · MODAL-PREGUNTAS] Catálogo de preguntas, categorizado. Lo abre el botón del
     reloj del input del chat (multitab_shell.js -> __cnHistToggle), NO el waffle: por eso no
     lleva data-modal, se abre por JS.
     Va FUERA de #mc-chat-body, igual que #mc-admin-modal y por el mismo motivo: el acordeón y
     el historial repintan ese contenedor y se llevarían el modal por delante.
     Las secciones son ESTÁTICAS (el orden debe coincidir con el array __cnHistSeed de
     multitab_shell.js); lo único que se rellena por JS son las listas de botones. -->
<div class="modal fade" id="mc-preguntas-modal" tabindex="-1" aria-labelledby="mc-preguntas-modal-label" aria-hidden="true">
    <!-- Sin modal-dialog-scrollable, mismo criterio que Admin: el scroll lo llevan las dos
         columnas por separado (.mc-preg-nav y .mc-preg-content). -->
    <div class="modal-dialog modal-xl modal-dialog-centered mc-preg-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="mc-preguntas-modal-label">
                    <i class="bi bi-chat-square-text" aria-hidden="true" style="color:#15794C"></i>
                    Preguntas
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body mc-preg-body">
                <div class="nav flex-column mc-preg-nav" role="tablist" aria-orientation="vertical">
                    <button class="mc-preg-nav__item active" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-hist" type="button" role="tab" aria-controls="mc-preg-pane-hist" aria-selected="true">
                        <i class="bi bi-clock-history" aria-hidden="true"></i>
                        <span>Histórico</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-0" type="button" role="tab" aria-controls="mc-preg-pane-0" aria-selected="false">
                        <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>
                        <span>Análisis</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-1" type="button" role="tab" aria-controls="mc-preg-pane-1" aria-selected="false">
                        <i class="bi bi-123" aria-hidden="true"></i>
                        <span>Cifras</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-2" type="button" role="tab" aria-controls="mc-preg-pane-2" aria-selected="false">
                        <i class="bi bi-bar-chart-steps" aria-hidden="true"></i>
                        <span>Comparar y ordenar</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-3" type="button" role="tab" aria-controls="mc-preg-pane-3" aria-selected="false">
                        <i class="bi bi-calendar3" aria-hidden="true"></i>
                        <span>En el tiempo</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-4" type="button" role="tab" aria-controls="mc-preg-pane-4" aria-selected="false">
                        <i class="bi bi-diagram-3" aria-hidden="true"></i>
                        <span>Estructura</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-5" type="button" role="tab" aria-controls="mc-preg-pane-5" aria-selected="false">
                        <i class="bi bi-tools" aria-hidden="true"></i>
                        <span>Operación</span>
                    </button>
                </div>
                <div class="tab-content mc-preg-content">
                    <div class="tab-pane fade show active" id="mc-preg-pane-hist" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Histórico</h6>
                        <p class="mc-preg-panel__hint">Preguntas de esta conversación. Clic para reutilizarlas.</p>
                        <div id="mc-preg-hist"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-0" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Análisis</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-0"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-1" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Cifras</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-1"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-2" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Comparar y ordenar</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-2"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-3" role="tabpanel">
                        <h6 class="mc-preg-panel__title">En el tiempo</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-3"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-4" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Estructura</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-4"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-5" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Operación</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-5"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

⚠️ **El orden del nav y los `id="mc-preg-cat-N"` deben coincidir con el orden del array
`__cnHistSeed`** (§3.1): índice 0 = Análisis, 1 = Cifras, 2 = Comparar y ordenar, 3 = En el
tiempo, 4 = Estructura, 5 = Operación. Si se reordena uno, hay que reordenar el otro.

---

## 4. Orden de ejecución

| # | Acción | Archivo | Ref |
|---|---|---|---|
| 0 | **Línea base**: `node --check` sobre el JS **antes** de editar | — | §6.1 |
| 1 | `__cnHistSeed` pasa a categorías | `static/js/multitab_shell.js` | §3.1 |
| 2 | CSS del modal | `MainChat/static/css/mainchat.css` | §3.2 |
| 3 | `__cnHistToggle` + `__cnPregModalPintar` + `__cnHistUsar` | `static/js/multitab_shell.js` | §3.3 |
| 4 | Markup del modal | `MainChat/templates/mainchat_layout.html` | §3.4 |
| 5 | Validación estática | — | §6.1 |

**Un solo commit**, repo `frontend`. Pregunta al usuario antes de commitear.

---

## 5. Reglas no negociables

- **NN-1.** El clic **RELLENA el input, NUNCA envía**. Es una decisión documentada del 2026-08-26
  (evita reenvíos accidentales). `__cnHistUsar` se reutiliza; no se le añade ningún `submit`.
- **NN-2.** **El desplegable `cn-hist-drop` NO se borra.** Es el camino de la vista clásica `/`
  (H3). Si el modal no está en el DOM, `__cnHistToggle` cae a él.
- **NN-3.** **NO tocar las 4 líneas que cierran `cn-hist-drop`** (`:1128`, `:1135-1137`, `:6411`,
  `:7611`, `:7619`) — H4. Siguen siendo válidas.
- **NN-4.** **Escapado asimétrico, a propósito:** el historial (`b.html`) va **sin** `esc()`; las
  plantillas van **con** `esc()`. Igualarlos rompe las tildes o abre un XSS (H5).
- **NN-5.** **No se pierde ninguna de las 8 plantillas originales.** Se reparten, no se sustituyen.
- **NN-6.** **NO tocar `#mc-admin-modal`** ni sus clases `.mc-admin-*`. El modal nuevo tiene
  clases propias (`.mc-preg-*`).
- **NN-7.** **NO tocar `multitab_shell.js` fuera de los tres bloques de §3.1 y §3.3.** Es un
  archivo compartido de 7.600+ líneas.
- **NN-8.** El orden del nav (§3.4) y el del array (§3.1) deben coincidir índice a índice.
- **NN-9.** Si una línea del plan no calza con el código real, **DETENTE y repórtalo.**

---

## 6. Validación

### 6.1 Estática — la ejecuta el EXECUTOR

Desde `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, línea por línea:

```powershell
node --check static/js/multitab_shell.js
```
→ Esperado: **sin salida**, exit 0. Es la única comprobación automática disponible: **no hay
tests de JS en el proyecto**. Córrela **antes** (línea base) y **después**.

```powershell
python -c "import re; s=open('MainChat/templates/mainchat_layout.html',encoding='utf-8').read(); print('modal OK' if 'mc-preguntas-modal' in s else 'FALTA'); print('paneles:', len(re.findall(r'mc-preg-cat-\d', s)))"
```
→ Esperado: `modal OK` y `paneles: 6`.

```powershell
python -c "s=open('static/js/multitab_shell.js',encoding='utf-8').read(); print('cats:', s.count('cat:')); print('drop conservado:', 'cn-hist-drop' in s)"
```
→ Esperado: `cats: 6` y `drop conservado: True` (NN-2).

⚠️ **Estas comprobaciones NO prueban que el modal funcione.** Solo que el JS parsea, que el
markup está y que no se borró el desplegable. Lo demás es §6.2.

### 6.2 Humana — la ejecuta el USUARIO

Tras `git pull` en Pruebas, **reiniciar Flask** y recargar con **Ctrl+F5** (el JS se cachea):

| # | Qué probar | Esperado |
|---|---|---|
| 1 | En `/mainchat`, clic en el botón 🕐 del input | Abre el **modal** de dos columnas, sección **Histórico** activa |
| 2 | Con el chat recién abierto (sin preguntas) | Histórico dice «Todavía no has preguntado nada en esta conversación» |
| 3 | Preguntar algo y volver a abrir el modal | La pregunta aparece en **Histórico**, la más reciente arriba |
| 4 | Clic en una pregunta del Histórico | **Rellena el input** y cierra el modal. **NO envía** |
| 5 | Navegar por las 6 categorías del nav lateral | Cada una muestra sus preguntas; el nav marca la activa |
| 6 | Clic en una plantilla con «…» | Rellena el input con el «…» incluido, listo para editar. **NO envía** |
| 7 | Cerrar con ✕, con `Esc` y con clic en el fondo | Cierra en los tres casos |
| 8 | 🔴 **Regresión:** ir a la vista clásica `/` y pulsar el botón 🕐 | Sigue abriendo el **desplegable de siempre**, con las preguntas en lista plana (NN-2) |
| 9 | 🔴 Abrir el waffle → **Admin** | El modal de Admin sigue funcionando igual (NN-6) |
| 10 | F12 → Console en todo lo anterior | **0 errores** |
| 11 | Con el modal abierto, comprobar tildes y «¿» | Se ven bien, sin `&amp;` ni `&#191;` (NN-4) |

⚠️ **R3 (CLAUDE.md §10.4):** el executor **NO** marca esto. Su estado tras §6.1 es
**«implementado, PENDIENTE de validación humana»** — no tiene navegador y este cambio es
enteramente visual.

### 6.3 Revisión de contenido (usuario)

Las categorías y el reparto de preguntas son **una propuesta**, hecha con criterio de «qué
quiere HACER el usuario» y no de cómo está construido el motor. El usuario dijo que las
revisaría. Los dos puntos a mirar:

- **¿Los 6 grupos son los correctos?** (Análisis · Cifras · Comparar y ordenar · En el tiempo ·
  Estructura · Operación)
- **¿Las preguntas nuevas de H7 están bien redactadas?** Son formas verificadas contra el motor
  esta semana, pero el fraseo se puede afinar.

---

## 7. Fuera de alcance

- **La vista clásica `/`**: conserva el desplegable plano. Decisión del usuario.
- **Persistir el histórico entre conversaciones**: «Histórico» es el de la conversación activa,
  igual que hoy. El historial global ya vive en el panel «Historial» (`historial.js`) y
  mezclarlos duplicaría el concepto — ya está razonado así en `multitab_shell.js:1094-1096`.
- **Buscador dentro del modal**: con ~28 preguntas en 6 grupos no hace falta todavía.
- **Que las categorías salgan del backend**: hoy son estáticas en el JS, que es donde ya vivían.
  Moverlas a un YAML/endpoint sería otro plan.
- **Control de roles**: sigue sin existir (nota del 2026-08-25); este modal es visible para
  cualquier usuario autenticado, igual que el resto.
- Cualquier cambio en el backend, el motor de preguntas o el contrato Flask↔INGESTA.

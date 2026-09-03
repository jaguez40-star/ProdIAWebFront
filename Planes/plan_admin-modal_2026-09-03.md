# Plan ADMIN-MODAL — modal grande de dos columnas para el ítem Admin del waffle

**ID tarea:** ADMIN-MODAL
**Fecha:** 2026-09-03
**Versión:** v2 (RE-auditado — 3 hallazgos nuevos sobre el v1, ver §1B)
**Alcance:** Frontend puro, solo `/mainchat`:
- `frontend/MainChat/templates/mainchat_layout.html`
- `frontend/MainChat/static/css/mainchat.css`
- `frontend/MainChat/static/js/mainchat.js`

**Backend:** NO se toca. Cero cambios en Python, FastAPI, Flask routes o el motor Q v2.

**Decisiones cerradas del usuario:**

1. El ítem **Admin** del waffle (ya existe, commit `1c75fa0`, botón `#mc-acceso-admin`
   sin destino) debe abrir un **modal grande** al hacer clic.
2. El modal tiene **layout de dos columnas**: navegación de secciones a la izquierda,
   contenido de la sección activa a la derecha — mismo formato visual que la captura de
   referencia que dio el usuario (panel de Configuración de Claude.ai: sidebar con lista de
   ítems icono+texto, ítem activo con fondo resaltado, header propio del panel derecho,
   botón de cierre arriba a la derecha, cuerpo con scroll).
3. Las secciones son **exactamente tres, en este orden y con este texto literal**:
   **Grupos**, **Usuarios**, **Usuarios Uso** (así, tal cual la escribió el usuario — no es
   un typo a corregir).
4. **Sin contenido funcional todavía** ("esto por ahora"): cada sección solo debe mostrar su
   título y un texto de marcador de posición. Confirmado en la auditoría (§1, H4): no hay
   ningún dato de usuarios/grupos que traer de ningún lado — no hay nada que "conectar en
   vez de construir" en esta iteración.
5. **Fuera de esta iteración:** control de acceso/roles (quién puede ver Admin), y cualquier
   dato real dentro de las tres secciones. Ver §7.

---

## 0. Contexto para el agente EXECUTOR

**Proyecto:** ProdIA — asistente conversacional de producción de hidrocarburos.
`frontend/` es el repo Flask + Jinja2 (puerto 5029, `ProdIAWebFront`). Este plan toca
únicamente la vista `/mainchat`.

**Raíz de este repo:** `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`

**Los 3 archivos que se tocan (rutas absolutas):**
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\templates\mainchat_layout.html`
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\static\css\mainchat.css`
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\static\js\mainchat.js`

**Qué es el waffle hoy:** un popover (`#mc-menu`, position:fixed) anclado al botón de
usuario del panel Historial. Contiene tarjetas `.mc-acceso` en una rejilla. Cada tarjeta usa
uno de dos atributos de datos para decidir su destino al hacer clic (ver
`mainchat.js:96-116`): `data-tab` abre una pestaña del shell in-situ; `data-ruta` navega de
verdad. El botón `#mc-acceso-admin` (añadido en el commit `1c75fa0`, dentro de
`mainchat_layout.html:86-89`) hoy no tiene ninguno de los dos: el clic no hace nada.

**Qué se quiere:** un tercer destino posible, `data-modal`, que abra un modal de Bootstrap
(ya cargado globalmente por `base.html`, ver H2) con dos columnas: nav izquierda (3
secciones) + contenido derecha (placeholder por sección).

**Convenciones del proyecto (obligatorias, verificadas en `mainchat.js` real, NO en un
genérico "ES5 clásico"):**

- JS de este archivo usa `const`/`let` + `function` clásica (nunca arrow functions, nunca
  template literals). Clonar exactamente ese estilo — es lo que ya hay en
  `mainchat.js:19, 22, 24, 32...`.
- Comentarios y nombres de variables/funciones en español.
- Todo comentario nuevo que documente una decisión no obvia lleva `[YYYY-MM-DD]` al inicio,
  siguiendo el patrón ya usado en el archivo (ej. `mainchat_layout.html:82`).
- Prefijo CSS de este componente: `mc-`. El plan usa el sub-prefijo `mc-admin-`, verificado
  libre en todo el repo (H5).
- **Cada vez que se edita `mainchat.css` o `mainchat.js`, se debe subir el `?v=` de su
  `<link>`/`<script>` en `mainchat_layout.html`** — es el mecanismo de cache-busting del
  proyecto (ver los `?v=20260825h`, `?v=20260825i`, etc. ya presentes). Este plan lo hace en
  §3.1.
- Regla de cierre: si algo de este plan no calza con el código real al momento de ejecutar
  (una línea movió, un id no existe), **DETENERSE y reportarlo**, no improvisar una
  alternativa.

---

## 1. Hallazgos de la auditoría — leer ANTES de escribir código

### 🔴 H1 — El clic en `#mc-acceso-admin` NO puede delegarse al auto-wiring de Bootstrap (`data-bs-toggle="modal"`)

Sería la forma más corta de invocar un modal de Bootstrap, pero `#mc-acceso-admin` vive
**dentro** de `#mc-menu` (el popover del waffle). Si se usa el atributo declarativo
`data-bs-toggle="modal"`, el clic abre el modal pero **no cierra el popover del waffle**,
que queda abierto detrás (`mainchat.js:64-74`: el listener de "clic fuera" no lo cierra
porque el target del clic SIGUE contenido dentro de `#mc-menu`).

**Corrección aplicada:** no se usa el atributo declarativo. Se extiende el mismo `forEach`
que ya despacha `data-tab`/`data-ruta` (`mainchat.js:101-116`) con una tercera rama
`data-modal`, que abre el modal vía la API de JS de Bootstrap y **después** llama a
`abrir(false)` para cerrar el popover — el mismo patrón que ya usa la rama `data-tab`
(`mainchat.js:106-108`). Ver §3.3.

### 🟢 H2 — Bootstrap 5.3.0 (CSS + JS bundle) ya está cargado globalmente, y `bootstrap.Modal` estará disponible cuando `mainchat.js` se ejecute

`templates/base.html:10` carga `bootstrap@5.3.0/dist/css/bootstrap.min.css` y
`templates/base.html:90` carga `bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js` (incluye el
plugin Modal y el plugin Tab/Pill). `mainchat_layout.html` extiende `base.html`, así que
ambos están disponibles en `/mainchat`.

Hay precedente de uso directo de la API JS en este mismo repo:
`static/js/login.js:24` — `new bootstrap.Modal(document.getElementById('accessRequestModal'))`.

**Orden de ejecución verificado, no supuesto:** el bundle de Bootstrap (línea 90 de
`base.html`, SIN `defer`) se ejecuta de forma síncrona mientras el parser todavía está
recorriendo el documento. Los 4 scripts de `/mainchat` (`multitab_shell.js`, `mainchat.js`,
`acordeon.js`, `historial.js`, en `mainchat_layout.html:154-160`) tienen `defer`, así que —
aunque aparecen ANTES en el HTML fuente— se ejecutan DESPUÉS de terminar de parsear todo el
documento, es decir, después de que `bootstrap.bundle.min.js` ya corrió. Esto ya está
verificado y documentado en el propio archivo:
`mainchat_layout.html:149-153` ("invierte el orden de ejecución respecto a
bootstrap.bundle.min.js... pero main.js no usa nada del shell..."; el mismo razonamiento
aplica a `window.bootstrap`, que sí lo necesita `mainchat.js`).
**Conclusión:** `window.bootstrap.Modal` existe de sobra cuando `mainchat.js` corre. Aun así,
§3.3 incluye una guarda defensiva (`typeof window.bootstrap !== 'undefined'`), siguiendo el
mismo estilo defensivo que ya usa el archivo con `window.__rbAbrirTab` (`mainchat.js:106`).

### 🟡 H3 — Usar el plugin **Tab/Pill** de Bootstrap para las 3 secciones, no JS propio

Bootstrap 5.3 (ya cargado, ver H2) incluye el plugin Tab, que con
`data-bs-toggle="pill"` + `data-bs-target="#id-del-panel"` intercambia automáticamente las
clases `active`/`show` tanto en el disparador como en el panel de contenido — sin escribir
ni una línea de JS de por medio. El plugin se auto-inicializa por delegación de eventos en
`document`, igual que el plugin Modal; no requiere una llamada de inicialización explícita.

**Decisión de diseño:** las 3 secciones (Grupos / Usuarios / Usuarios Uso) se implementan
como `nav` + `tab-content` de Bootstrap con clases propias (`mc-admin-nav__item`,
`mc-admin-panel`) en vez de las clases visuales por defecto de Bootstrap (`nav-link`,
`tab-pane` siguen siendo necesarias para que el plugin identifique el panel, pero el look
se sobreescribe por completo con CSS del proyecto — ver §3.2). Cero JS nuevo para el
intercambio de secciones: es el ítem de "conectar antes que construir" de `CLAUDE.md` §7
aplicado a una librería ya cargada, no a código propio del repo.

### 🟢 H4 — No existe ningún dato de usuarios/grupos que traer

Se buscó en `backend/backend/app/features/**` (FastAPI/INGESTA) y en el código de
autenticación de `frontend/` (`grep -i "grupos|groups|roles|is_admin"`, ambos sin
resultados relevantes: los únicos matches de "grupo" en el backend son de
`patrones_grupo.yaml` del clasificador económico, sin relación con usuarios). **No hay
backend de administración de usuarios/grupos hoy.** Confirma la decisión cerrada #4: las 3
secciones son placeholder puro en esta iteración, no una promesa incumplida de "ya debería
mostrar algo".

### 🟢 H5 — El namespace `mc-admin-` está libre

`grep -r "mc-admin" frontend/` no devolvió resultados. Seguro usarlo sin colisión con CSS o
JS existente.

### 🟢 H6 — Sin conflicto de `z-index`

`.mc-menu` (el popover del waffle) usa `z-index: 1000` (`mainchat.css:65`). El modal de
Bootstrap 5.3 usa por defecto `z-index: 1055` (backdrop en 1050) y **no está sobreescrito
en ningún CSS del proyecto** (`grep` de `.modal` y `z-index` en `static/css/style.css` y
`static/css/login.css` no muestra ninguna regla que lo toque). El modal quedará
correctamente por encima del popover del waffle sin tocar ningún `z-index` a mano. (Dato
adicional, no bloqueante: el shell de `multitab_shell.js` tiene su propio overlay a
`z-index: 9999` en `colapsable.css:853` para otro propósito — no interactúa con este modal
porque no coexisten en el mismo flujo.)

### 🟢 H7 — Ningún ancestro usa `transform`, así que `position: fixed` del modal no se recorta

Igual que `#mc-menu` (comentario de `mainchat_layout.html:43-49`), un modal de Bootstrap se
posiciona con `position: fixed`, que escapa a los `overflow:hidden` de la cadena de
ancestros — PERO un ancestro con `transform` crearía un nuevo "containing block" y lo
recortaría igual. Se revisó `mainchat.css`, `acordeon.css` y `historial.css`: los únicos
usos de `transform` son rotaciones de 180° en iconos de chevron (`historial.css:316`,
`acordeon.css:401`), no en ningún contenedor. No hay riesgo de recorte.

---

## 1B. 🔴 RE-AUDITORÍA (v2) — 3 hallazgos que corrigen el v1

### 🔴 R1 — BLOQUEANTE PARA EL PIPELINE: la palabra `claude` NO puede aparecer en ningún archivo publicado

El skill `migrar-a-azure` (`frontend/.claude/skills/migrar-a-azure/migrar_a_azure.ps1:87`)
define `$TerminosProhibidos = @('claude', 'jaguez40')` y **aborta la migración a Azure DevOps
si cualquier archivo versionado que se va a publicar contiene alguno de esos términos**
(salvo `.gitignore` y `migra.py`, exentos). Los 3 archivos que este plan toca
(`mainchat_layout.html`, `mainchat.css`, `mainchat.js`) SÍ se publican: están versionados en
git y `MainChat/` no está en la lista de exclusión del skill (verificado, ver R3).

**Consecuencia de diseño:** ningún comentario, nombre de variable, id, clase o texto nuevo
que introduzca este plan puede contener la cadena `claude` (ni `jaguez40`). El v1 ya cumplía
por casualidad, pero no lo declaraba. Ahora es **regla no negociable** (§5). El executor debe
evitar redactar comentarios del tipo "generado con..." o similares. (Verificado con
`grep -ni "claude"` sobre los 3 archivos actuales: 0 coincidencias hoy — no romper esa
condición.)

### 🟡 R2 — `modal-dialog-scrollable` y el `height` fijo de `.mc-admin-body` se pisan

El v1 ponía a la vez `modal-dialog-scrollable` en el `<div class="modal-dialog ...">` **y**
`height: min(560px, 70vh)` con `display:flex` en `.mc-admin-body` (que ES el `.modal-body`).
`modal-dialog-scrollable` de Bootstrap fuerza `overflow-y:auto` y un `max-height` calculado
sobre el `.modal-body`, pensado para que el CUERPO ENTERO scrollee como una sola columna —
pero aquí el diseño es de DOS columnas que scrollean **independientemente** (`.mc-admin-nav`
y `.mc-admin-content`, cada una con su `overflow-y:auto`). Las dos estrategias compiten y el
resultado en viewport real es impredecible (doble barra, o alto colapsado).

**Corrección aplicada en §3.4 y §3.5:** se **quita** `modal-dialog-scrollable` del
`modal-dialog` (el scroll lo gestionan las dos columnas internas, no el body), y se
**conserva** el `height` fijo en `.mc-admin-body`. Así cada columna controla su propio
overflow, que es el comportamiento del modal de referencia (sidebar y contenido scrollean por
separado).

### 🟢 R3 — Confirmaciones que sostienen el plan

- **MainChat es migrable:** `git ls-files MainChat/` lista los 7 archivos (incluidos los 3 de
  este plan); `$ExcluirRutas` del skill (línea 73-81) contiene `.claude`, `Planes`, `clmd`,
  `data/bitacora`, `CLAUDE.md`, `BITACORA.md` — **no** `MainChat`. Los cambios llegan a
  producción por el pipeline normal.
- **Sin override de las clases Bootstrap que usa el modal:** `grep` de `.nav-link`,
  `.tab-content`, `.tab-pane`, `.nav`, `flex-column`, `.pill` en `static/css/` y
  `MainChat/static/css/` no devuelve ninguna regla que las toque (los únicos `.nav-*` son
  `.nav-modulos`, clases propias distintas, y `.report-tabs-container .nav-tabs`, con selector
  padre que no aplica aquí). El plugin Tab y el look propio conviven sin choque.
- **Sin override del z-index del modal** (confirma H6): el único `.modal` en el CSS del
  proyecto es `#accessRequestModal .modal-content` (`login.css:856`), que solo cambia
  `border-radius` — no toca `z-index`. Los defaults de Bootstrap (1055/1050) mandan.
- **`bootstrap-icons@1.11.3` está cargado** (`base.html:18`): los iconos `bi-diagram-3`,
  `bi-people`, `bi-bar-chart-line`, `bi-shield-lock` existen en esa versión.
- **El modal fuera de `.mc-shell` no se recorta:** cae dentro de `.main-content`, que en
  `/mainchat` NO tiene `overflow:hidden` (solo `margin-left:0; width:100%`,
  `mainchat.css:23-26`); y aunque lo tuviera, `position:fixed` de Bootstrap lo saca de la
  contención. Ningún ancestro usa `transform` (confirma H7).

---

## 2. Estado actual (para que el executor sepa qué está mirando)

**`mainchat_layout.html`, botón Admin actual (líneas 82-89):**

```html
            <!-- [2026-09-03] Ítem visual del módulo Admin, sin destino todavía a propósito
                 (decisión del usuario): ni data-tab ni data-ruta, así que el clic no hace nada.
                 Sigue sin existir /admin ni control de roles (ver nota de 2026-08-25 más abajo);
                 cuando se defina el destino, añadir aquí data-tab="admin" o data-ruta="...". -->
            <button type="button" class="mc-acceso" role="menuitem" id="mc-acceso-admin">
                <i class="bi bi-shield-lock" style="color:#92400E"></i>
                <span>Admin</span>
            </button>
```

**`mainchat_layout.html`, cierre de `.mc-shell` y arranque del bloque siguiente (líneas 117-120):**

```html
    </div>
</div>

<!-- El "Desempeño del mes" NO lo pinta charts.js: es el shell de multitab_shell.js
```

**`mainchat_layout.html`, `<link>`/`<script>` con `?v=` a subir (líneas 10 y 155):**

```html
    <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260825h">
```
```html
<script defer src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260825i"></script>
```

**`mainchat.js`, el `forEach` que despacha los clics del waffle (líneas 101-116):**

```javascript
    menu.querySelectorAll('.mc-acceso').forEach(function (acceso) {
        acceso.addEventListener('click', function () {
            const tab = acceso.dataset.tab;
            if (tab) {
                // El shell se carga en /mainchat; si no está, no hay panel que abrir.
                if (typeof window.__rbAbrirTab === 'function' && window.__rbAbrirTab(tab)) {
                    abrir(false);
                } else {
                    console.warn('MainChat: pestaña "' + tab + '" no disponible en este shell');
                }
                return;
            }
            const ruta = acceso.dataset.ruta;
            if (ruta) window.location.href = ruta;
        });
    });
```

**`mainchat.css`, últimas líneas del archivo (201-205, cola actual, para saber dónde añadir):**

```css
.mc-body {
    flex: 1;
    min-height: 0;
    padding: 16px 0;
}
```

---

## 3. Especificación

### 3.1 MODIFICAR — subir el cache-buster de `mainchat.css` y `mainchat.js`

**Archivo:** `mainchat_layout.html`

**Localizar (línea 10):**
```html
    <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260825h">
```
**Sustituir por:**
```html
    <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260903a">
```

**Localizar (línea 155):**
```html
<script defer src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260825i"></script>
```
**Sustituir por:**
```html
<script defer src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260903a"></script>
```

### 3.2 MODIFICAR — el botón Admin gana `data-modal`

**Archivo:** `mainchat_layout.html`

**Localizar (líneas 82-89):**
```html
            <!-- [2026-09-03] Ítem visual del módulo Admin, sin destino todavía a propósito
                 (decisión del usuario): ni data-tab ni data-ruta, así que el clic no hace nada.
                 Sigue sin existir /admin ni control de roles (ver nota de 2026-08-25 más abajo);
                 cuando se defina el destino, añadir aquí data-tab="admin" o data-ruta="...". -->
            <button type="button" class="mc-acceso" role="menuitem" id="mc-acceso-admin">
                <i class="bi bi-shield-lock" style="color:#92400E"></i>
                <span>Admin</span>
            </button>
```

**Sustituir por:**
```html
            <!-- [2026-09-03] Admin abre el modal #mc-admin-modal (data-modal), tercera clase de
                 destino junto a data-tab/data-ruta — ver mainchat.js. Sigue sin existir control de
                 roles (ver nota de 2026-08-25 más abajo): el modal es visible para cualquier
                 usuario autenticado, igual que el resto del waffle. -->
            <button type="button" class="mc-acceso" role="menuitem" id="mc-acceso-admin" data-modal="mc-admin-modal">
                <i class="bi bi-shield-lock" style="color:#92400E"></i>
                <span>Admin</span>
            </button>
```

### 3.3 MODIFICAR — `mainchat.js`, tercera rama `data-modal` en el despachador de clics

**Archivo:** `mainchat.js`

**Localizar (líneas 96-116):**
```javascript
    // Accesos del waffle. Dos clases de destino:
    //   data-tab   -> pestaña del panel de multitab_shell.js: se abre in-situ, sin navegar.
    //   data-ruta  -> [2026-08-25] WAFFLE-NAV: navega de verdad. Solo quedan aquí rutas que
    //                 existen (Clásico, Colapsable); las que no existían (Admin/Config/Ayuda)
    //                 se retiraron del markup en vez de dejarlas con un aviso en consola.
    menu.querySelectorAll('.mc-acceso').forEach(function (acceso) {
        acceso.addEventListener('click', function () {
            const tab = acceso.dataset.tab;
            if (tab) {
                // El shell se carga en /mainchat; si no está, no hay panel que abrir.
                if (typeof window.__rbAbrirTab === 'function' && window.__rbAbrirTab(tab)) {
                    abrir(false);
                } else {
                    console.warn('MainChat: pestaña "' + tab + '" no disponible en este shell');
                }
                return;
            }
            const ruta = acceso.dataset.ruta;
            if (ruta) window.location.href = ruta;
        });
    });
```

**Sustituir por:**
```javascript
    // Accesos del waffle. Tres clases de destino:
    //   data-tab   -> pestaña del panel de multitab_shell.js: se abre in-situ, sin navegar.
    //   data-ruta  -> [2026-08-25] WAFFLE-NAV: navega de verdad. Solo quedan aquí rutas que
    //                 existen (Clásico, Colapsable); las que no existían (Admin/Config/Ayuda)
    //                 se retiraron del markup en vez de dejarlas con un aviso en consola.
    //   data-modal -> [2026-09-03] abre un modal de Bootstrap (bundle ya cargado por
    //                 base.html, disponible aquí: ver el comentario de más abajo, líneas
    //                 149-153, sobre el orden defer vs. bootstrap.bundle.min.js) y cierra el
    //                 popover del waffle — igual que data-tab, porque el botón vive DENTRO
    //                 de #mc-menu y el listener de "clic fuera" no lo cerraría solo.
    menu.querySelectorAll('.mc-acceso').forEach(function (acceso) {
        acceso.addEventListener('click', function () {
            const tab = acceso.dataset.tab;
            if (tab) {
                // El shell se carga en /mainchat; si no está, no hay panel que abrir.
                if (typeof window.__rbAbrirTab === 'function' && window.__rbAbrirTab(tab)) {
                    abrir(false);
                } else {
                    console.warn('MainChat: pestaña "' + tab + '" no disponible en este shell');
                }
                return;
            }
            const ruta = acceso.dataset.ruta;
            if (ruta) {
                window.location.href = ruta;
                return;
            }
            const modalId = acceso.dataset.modal;
            if (modalId) {
                const el = document.getElementById(modalId);
                if (el && typeof window.bootstrap !== 'undefined' && window.bootstrap.Modal) {
                    window.bootstrap.Modal.getOrCreateInstance(el).show();
                    abrir(false);
                } else {
                    console.warn('MainChat: modal "' + modalId + '" no disponible');
                }
            }
        });
    });
```

### 3.4 AÑADIR — markup del modal en `mainchat_layout.html`

**Archivo:** `mainchat_layout.html`

**Localizar (líneas 117-120):**
```html
    </div>
</div>

<!-- El "Desempeño del mes" NO lo pinta charts.js: es el shell de multitab_shell.js
```

**Insertar ENTRE el `</div>` que cierra `.mc-shell` y el comentario del "Desempeño del mes"**
(es decir, el bloque nuevo va justo después de la línea 118 `</div>` y antes de la línea 120):

```html
<!-- [2026-09-03] Modal del módulo Admin. Vive FUERA de .mc-shell, como #mc-menu (ver el
     comentario de línea 43-49): position:fixed de Bootstrap ya escapa los overflow:hidden
     de la cadena de ancestros, y así tampoco lo destruye el innerHTML='' de
     acordeon.js/historial.js al colapsar o repintar. Dos columnas: nav de secciones
     (izquierda) + panel de contenido (derecha), usando el plugin Tab de Bootstrap
     (data-bs-toggle="pill") para el cambio de sección — cero JS propio para eso. -->
<div class="modal fade" id="mc-admin-modal" tabindex="-1" aria-labelledby="mc-admin-modal-label" aria-hidden="true">
    <!-- [2026-09-03] SIN modal-dialog-scrollable a propósito (ver plan §1B/R2): el scroll lo
         gestionan las dos columnas internas (.mc-admin-nav y .mc-admin-content) por separado,
         no el .modal-body como un todo. -->
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="mc-admin-modal-label">
                    <i class="bi bi-shield-lock" aria-hidden="true" style="color:#92400E"></i>
                    Admin
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body mc-admin-body">
                <div class="nav flex-column mc-admin-nav" role="tablist" aria-orientation="vertical">
                    <button class="mc-admin-nav__item active" data-bs-toggle="pill" data-bs-target="#mc-admin-pane-grupos" type="button" role="tab" aria-controls="mc-admin-pane-grupos" aria-selected="true">
                        <i class="bi bi-diagram-3" aria-hidden="true"></i>
                        <span>Grupos</span>
                    </button>
                    <button class="mc-admin-nav__item" data-bs-toggle="pill" data-bs-target="#mc-admin-pane-usuarios" type="button" role="tab" aria-controls="mc-admin-pane-usuarios" aria-selected="false">
                        <i class="bi bi-people" aria-hidden="true"></i>
                        <span>Usuarios</span>
                    </button>
                    <button class="mc-admin-nav__item" data-bs-toggle="pill" data-bs-target="#mc-admin-pane-usuarios-uso" type="button" role="tab" aria-controls="mc-admin-pane-usuarios-uso" aria-selected="false">
                        <i class="bi bi-bar-chart-line" aria-hidden="true"></i>
                        <span>Usuarios Uso</span>
                    </button>
                </div>
                <div class="tab-content mc-admin-content">
                    <div class="tab-pane fade show active mc-admin-panel" id="mc-admin-pane-grupos" role="tabpanel" aria-labelledby="mc-admin-pane-grupos">
                        <h6 class="mc-admin-panel__title">Grupos</h6>
                        <p class="mc-admin-panel__placeholder">Sección en construcción.</p>
                    </div>
                    <div class="tab-pane fade mc-admin-panel" id="mc-admin-pane-usuarios" role="tabpanel" aria-labelledby="mc-admin-pane-usuarios">
                        <h6 class="mc-admin-panel__title">Usuarios</h6>
                        <p class="mc-admin-panel__placeholder">Sección en construcción.</p>
                    </div>
                    <div class="tab-pane fade mc-admin-panel" id="mc-admin-pane-usuarios-uso" role="tabpanel" aria-labelledby="mc-admin-pane-usuarios-uso">
                        <h6 class="mc-admin-panel__title">Usuarios Uso</h6>
                        <p class="mc-admin-panel__placeholder">Sección en construcción.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- El "Desempeño del mes" NO lo pinta charts.js: es el shell de multitab_shell.js
```

⚠️ La última línea del bloque de arriba (`<!-- El "Desempeño del mes" ...`) **ya existe** en
el archivo — se repite aquí solo para marcar el punto exacto donde termina la inserción. No
duplicarla.

### 3.5 AÑADIR — CSS del modal en `mainchat.css`

**Archivo:** `mainchat.css`

**Añadir al final del archivo**, después de la regla `.mc-body` (líneas 201-205):

```css

/* ── Modal Admin ────────────────────────────────────────────────────── */

/* [2026-09-03] Dos columnas dentro de modal-body: nav de secciones (izquierda, ancho fijo)
   + contenido (derecha, flex:1). padding:0 en el body porque cada columna pone el suyo —
   si no, quedaría un doble margen entre el borde del modal y el fondo de la nav. */
.mc-admin-body {
    display: flex;
    padding: 0;
    height: min(560px, 70vh);
}

.mc-admin-nav {
    flex: 0 0 220px;
    border-right: 1px solid var(--mc-border);
    background: #fafafa;
    padding: 12px;
    gap: 4px;
    overflow-y: auto;
}

.mc-admin-nav__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--mc-navy);
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}

.mc-admin-nav__item i {
    font-size: 16px;
    color: var(--mc-muted);
    flex: 0 0 auto;
}

.mc-admin-nav__item:hover {
    background: var(--mc-lime-soft);
}

/* Bootstrap Tab pone .active en el disparador al seleccionarlo (ver mainchat_layout.html,
   data-bs-toggle="pill"): mismo mecanismo que .mc-acceso:hover, pero fijo mientras esté
   seleccionado en vez de solo al pasar el mouse. */
.mc-admin-nav__item.active {
    background: var(--mc-primary);
    color: #fff;
}

.mc-admin-nav__item.active i {
    color: var(--mc-lime);
}

.mc-admin-content {
    flex: 1;
    min-width: 0;
    padding: 20px 24px;
    overflow-y: auto;
}

.mc-admin-panel__title {
    font-size: 15px;
    font-weight: 800;
    color: var(--mc-navy);
    margin: 0 0 8px;
}

.mc-admin-panel__placeholder {
    font-size: 13px;
    color: var(--mc-muted);
    margin: 0;
}
```

---

## 4. Orden de ejecución

| # | Acción | Archivo |
|---|---|---|
| 1 | Subir `?v=` de `mainchat.css` y `mainchat.js` (§3.1) | `mainchat_layout.html` |
| 2 | Añadir `data-modal="mc-admin-modal"` al botón Admin (§3.2) | `mainchat_layout.html` |
| 3 | Insertar el markup del modal tras `.mc-shell` (§3.4) | `mainchat_layout.html` |
| 4 | Añadir la tercera rama `data-modal` al despachador de clics (§3.3) | `mainchat.js` |
| 5 | Añadir el bloque CSS del modal al final del archivo (§3.5) | `mainchat.css` |
| 6 | Validación estática (§6.1) | — |

El orden 1→3 antes que 4 es deliberado: si el HTML del modal no existe todavía, no importa
en qué orden se toque el JS — pero hacerlo así evita dejar, aunque sea momentáneamente, un
`data-modal` en el botón sin un `#mc-admin-modal` que exista en el DOM.

---

## 5. Reglas no negociables

- **JS**: `const`/`let` + `function` clásica. Cero arrow functions, cero template literals,
  cero `class`. Clonar el estilo exacto de `mainchat.js` (ver §0).
- 🔴 **La palabra `claude` (y `jaguez40`) NO puede aparecer en ningún archivo tocado**
  (ver §1B/R1). El pipeline `migrar-a-azure` aborta la publicación a Azure si la encuentra.
  No redactar comentarios de autoría/generación con esa cadena. Tras editar, verificar con
  `grep -ni "claude" <archivo>` → 0 coincidencias.
- **Cero JS nuevo para el cambio de sección**: el plugin Tab de Bootstrap
  (`data-bs-toggle="pill"`) ya lo hace. Si el executor se encuentra escribiendo un
  `addEventListener` para alternar `.active`/`hidden` entre las 3 secciones, **algo está
  mal** — DETENERSE y releer H3. El único JS nuevo permitido es la rama `data-modal` de §3.3.
- **No tocar** `multitab_shell.js`, `app.py`, `routes/api.py` ni ningún archivo de
  `backend/`. Este plan es frontend puro y no cambia el contrato Flask↔INGESTA.
- **No añadir** contenido real dentro de las 3 secciones (tablas, formularios, llamadas
  `fetch`). Es explícitamente fuera de alcance (decisión cerrada #4, §7).
- **No tocar** el comentario de `mainchat_layout.html:90-94` ("retiradas Admin /
  Configuración / Ayuda...") — sigue siendo información válida sobre por qué no hay
  `/admin` como ruta real; solo cambia el comentario propio del botón (líneas 82-85, ver
  §3.2).
- Todo comentario nuevo lleva `[2026-09-03]` al inicio.
- Si algo de §2 (Estado actual) no coincide exactamente con el archivo real al momento de
  ejecutar — una línea se movió, un id cambió — **DETENERSE y reportarlo**, no adivinar.

---

## 6. Validación

### 6.1 Estática (la hace el executor)

| Comando | Carpeta | Resultado esperado |
|---|---|---|
| `grep -n "mc-admin-modal" MainChat/templates/mainchat_layout.html` | `frontend/` | Aparece en el botón (`data-modal=`) y en el `id` del modal — 2+ coincidencias |
| `grep -n "data-modal" MainChat/static/js/mainchat.js` | `frontend/` | Aparece la rama nueva del despachador |
| `grep -c "mc-admin-nav__item" MainChat/templates/mainchat_layout.html` | `frontend/` | `3` (una por sección) |
| `grep -c "mc-admin-panel" MainChat/templates/mainchat_layout.html` | `frontend/` | `3` |
| `grep -n "?v=20260903a" MainChat/templates/mainchat_layout.html` | `frontend/` | 2 coincidencias (css y js) |
| `grep -ni "claude\|jaguez40" MainChat/templates/mainchat_layout.html MainChat/static/css/mainchat.css MainChat/static/js/mainchat.js` | `frontend/` | **0 coincidencias** (si aparece alguna, el pipeline `migrar-a-azure` abortará — R1) |
| `grep -c "modal-dialog-scrollable" MainChat/templates/mainchat_layout.html` | `frontend/` | `0` (se quitó a propósito — R2) |
| Arranque: `.\iniciar_frontend.bat` (en `frontend/`, consola normal, no admin, queda corriendo — Ctrl+C para parar) | `frontend/` | Levanta sin error en `http://localhost:5029`, sin trazas de error en consola al cargar `/mainchat` |

### 6.2 Humana (la hace el usuario, en navegador — regla R3 de `CLAUDE.md` §10.4)

El executor NO tiene navegador: no puede validar esto. Al terminar, su estado correcto es
**"implementado, PENDIENTE de validación humana"**, nunca "completado". El usuario valida
en `http://localhost:5029/mainchat`:

1. Abrir el waffle (burbuja de usuario) → clic en **Admin** → se abre el modal.
2. El waffle se cierra al abrirse el modal (no queda el popover detrás).
3. El modal muestra dos columnas: nav (Grupos / Usuarios / Usuarios Uso) a la izquierda,
   contenido a la derecha. **Grupos** aparece seleccionada por defecto.
4. Clic en **Usuarios** y en **Usuarios Uso** cambia el panel derecho sin recargar la
   página ni cerrar el modal.
5. El botón **X** y la tecla **Escape** cierran el modal.
6. Clic fuera del modal (en el fondo oscuro) también lo cierra.
7. **F12 → Console con 0 errores** durante todo el flujo anterior.
8. Reabrir el modal una segunda vez (tras haberlo cerrado) funciona igual — sin quedar en
   blanco ni duplicar contenido.

---

## 7. Fuera de alcance

- **Control de acceso/roles** sobre quién ve el botón Admin o el modal. Hoy `@login_required`
  es autenticación, no autorización (deuda ya documentada en `CLAUDE.md` §6 y en el
  comentario de `mainchat_layout.html:90-94`). El modal es visible para cualquier usuario
  autenticado, igual que el resto del waffle.
- **Contenido real** dentro de Grupos / Usuarios / Usuarios Uso: tablas, formularios,
  llamadas a la API de INGESTA, o cualquier dato de usuarios/grupos. Confirmado en H4: hoy no
  existe ese backend. Cuando se decida traerlo, es un plan nuevo — probablemente necesitará
  auditar primero si INGESTA (`backend/backend/app/features/`) va a exponer esos datos o si
  se maneja solo en Flask.
- **Ruta `/admin` independiente**: el usuario cerró explícitamente esta decisión (ver
  pregunta hecha antes de este plan) — el modal no navega a ningún lado.
- **Responsive / vista móvil** del modal: el proyecto no tiene, hasta ahora, un breakpoint
  móvil documentado para `/mainchat`; no se añade uno nuevo aquí.
- **Bootstrap Icons distintos** a `bi-diagram-3` / `bi-people` / `bi-bar-chart-line`: son una
  elección razonable, no una decisión cerrada del usuario — si no gustan visualmente, es un
  cambio de una línea, no amerita replanificar.

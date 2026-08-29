# Plan — Mover la burbuja de usuario al pie del panel Historial

**ID tarea:** `usuario_pie_historial`
**Fecha:** 2026-08-24
**Versión:** v2 (auditada — flujo profesional §15: Mapeo → Auditoría → Diagnóstico)
**Proyecto:** ProdIA 2.0 (ECP Insights Flask)
**Raíz absoluta:** `c:\APLICACIONES\ProdIA\12112025_prodIA\ProdIA-2.0\ProdIA-2.0\`

---

## 1. Contexto

`/mainchat` es una pantalla Flask + Jinja2 + JS vanilla (sin build, sin npm). Se sirve
en el puerto **8020**. Su layout es un acordeón de tres paneles horizontales —
**Historial · Chat · Insights** — generado íntegramente por JavaScript.

Hoy el usuario aparece como una **burbuja circular en la esquina superior derecha**
(navbar de 64 px). Al pulsarla despliega hacia abajo un menú waffle con: email,
insignia ADMIN, cuatro accesos (Test Clas · Admin · Configuración · Ayuda) y
"Cerrar sesión".

### Stack relevante

- **Backend:** Flask, Python 3.13. `routes/mainchat.py` renderiza la plantilla **sin
  pasar contexto** — todo sale del objeto global `session` de Flask.
- **Frontend:** Jinja2 + JS vanilla. Bootstrap 5.3.0 y **bootstrap-icons 1.11.3** ya
  cargados en `templates/base.html:18` y `:90`. Fuente **Inter** cargada en
  `mainchat_layout.html:7-9`.
- **Sin bundler**: los `.js` y `.css` se sirven directos con cache-bust `?v=`.

---

## 2. Objetivo

1. **Eliminar** el avatar de la esquina superior derecha.
2. **Añadir** al pie del panel Historial un disparador con **avatar + Nombre y
   Apellido** del usuario.
3. Al pulsarlo, desplegar **hacia arriba** el mismo menú waffle actual, sin recortes.

**No se toca:** autenticación, backend Python, ni los pipelines de chat/ingesta.

---

## 3. Prerequisitos

| # | Requisito | Verificación |
|---|---|---|
| 1 | Estar en la raíz del proyecto | `ls app.py MainChat/` → ambos existen |
| 2 | Los 4 archivos a tocar existen | ver §4 |
| 3 | Sesión iniciada al probar | `/mainchat` exige `@login_required` (`routes/mainchat.py:28`) |

> ⚠️ **En la máquina de desarrollo actual los venv están rotos** (apuntan a
> `C:\Users\J Guerrero\...\Python312\python.exe`, usuario inexistente). La
> **verificación visual §8 debe hacerse en el servidor de pruebas**, no aquí.

---

## 4. Inventario de archivos

| # | Ruta absoluta | Acción |
|---|---|---|
| 1 | `...\MainChat\templates\mainchat_layout.html` | mover bloque + 2 ediciones |
| 2 | `...\MainChat\static\js\historial.js` | +1 función, +1 línea en `pintar()` |
| 3 | `...\MainChat\static\js\mainchat.js` | reescritura de la IIFE |
| 4 | `...\MainChat\static\css\mainchat.css` | sustituir `.mc-menu`, borrar navbar |
| 5 | `...\MainChat\static\css\historial.css` | +bloque de estilos del disparador |

**No tocar:** `acordeon.js`, `acordeon.css`, `multitab_shell.js`, `routes/`, `utils/`.

---

## 5. Auditoría — hallazgos que condicionan la implementación

> Esta sección existe porque el v1 de este plan contenía cinco supuestos no
> verificados. Están corregidos abajo. **Léela antes de tocar código.**

### H1 🔴 — `absolute` con `bottom:100%` NO funciona: seis ancestros recortan

Cadena desde `#mc-historial-body` hacia fuera:

| # | Elemento | Archivo:línea | overflow |
|---|---|---|---|
| 1 | `#mc-historial-body` | `MainChat/static/css/historial.css:10` | **hidden** |
| 2 | `.mc-cuerpo` | `MainChat/static/css/acordeon.css:146` | **auto** |
| 3 | `.mc-panel` | `MainChat/static/css/acordeon.css:29` | **hidden** (+`border-radius:16px`) |
| 4 | `.mc-acordeon` | `acordeon.css:18-23` | visible |
| 5 | `.mc-body` | `mainchat.css:244-248` | visible |
| 6 | `.mc-shell` | `MainChat/static/css/mainchat.css:36` | **hidden** |
| 7 | `.main-content` | `static/css/style.css:190` | **hidden** |
| 8 | `.app-container` | `static/css/style.css:51` | **hidden** |
| 9 | `body` | `static/css/style.css:40` | **hidden** |

El menú se recortaría en el borde de `#mc-historial-body`, sin llegar al panel.
Además `.mc-cuerpo` es `overflow:auto`: generaría **barras de scroll parásitas**.

→ **Solución: `position:fixed` + coordenadas calculadas en JS.**
`fixed` escapa de todos los `overflow:hidden` **salvo** si un ancestro tiene
`transform`/`filter`/`perspective`/`contain`/`will-change`. **Verificado: ninguno de
los 9 los tiene.** (`.mc-avatar:hover{transform}` en `mainchat.css:93` y
`.mc-tira-titulo{transform}` en `acordeon.css:267` **no** están en esta cadena.)

### H2 🔴 — El DOM del panel se destruye solo

- `acordeon.js:329` → `raiz.innerHTML = ''` **en cada expandir/colapsar**.
- `historial.js:284` → `cont.innerHTML = ...` en cada repintado
  (debounce 1200 ms `historial.js:26`; MutationObserver L168-175).

Un menú pintado dentro de `#mc-historial-body` **se cerraría solo al llegar un
mensaje al chat**.

→ **Solución: el menú vive en `.mc-shell`** (fuera de `#mainchat-root`), y el
**disparador** se pinta desde `historial.js` con **delegación de eventos** — el mismo
patrón que el propio código ya usa (`acordeon.js:64-66` crea `#mc-shell-host`
exactamente por este motivo; `historial.js:325-337` usa delegación por lo mismo).

### H3 🟢 — `esc()` ya existe: NO la crees

`historial.js:223` ya define `function esc(t)`, usada en L264-279. El v1 decía
"si no hay, créala" — **hay**. Reutilízala. Crear una segunda sería duplicación.

### H4 🟢 — bootstrap-icons disponible

`templates/base.html:18` carga `bootstrap-icons@1.11.3`. `bi-chevron-up` funciona sin
añadir nada.

### H5 🟠 — `window.USER_FULL_NAME` es un **gate de funcionalidad**, no solo cosmético

`static/js/multitab_shell.js:40`:
```js
return String(window.USER_FULL_NAME || "").trim().toLowerCase() !== "javier guerrero";
```
Alimenta `__cnSoloConsulta()`, que decide si se renderizan los chips MOTOR v1/v2
(ver el comentario en `mainchat_layout.html:98-105`).

→ **Regla dura: este plan solo LEE `window.USER_FULL_NAME`. Prohibido reasignarlo,
normalizarlo o modificarlo.** Cambiarlo alteraría qué ve el usuario en el chat.

### H6 🟢 — `.mc-avatar` / `.mc-navbar` no se usan fuera de MainChat

Grep sobre `*.html`/`*.js`/`*.css` (excluido `venv/`): solo aparecen en
`mainchat_layout.html` y `mainchat.js`. **Eliminarlos es seguro.**
(Regla DT-16 del CLAUDE.md de Robustez: nunca borrar sin grep previo — hecho.)

### H7 🟢 — Sin colisión de listeners globales

`static/js/main.js:56` registra un `document.addEventListener('click')`, pero solo
actúa si `window.innerWidth <= 768` **y** el sidebar está abierto — y en MainChat el
sidebar está oculto (`mainchat.css:18-22`). `static/js/panels.js:50` no se carga en
`/mainchat` (`base.html:93` solo carga `main.js`). **No hay conflicto.**

### H8 🟠 — Historial arranca COLAPSADO

`acordeon.js:48` → `abiertos = ['insights', 'chat']`. El disparador **no existe en el
DOM** hasta que el usuario abre el panel. Esto es correcto (el menú se ancla al botón,
que no existe si el panel está cerrado), pero **condiciona las pruebas**: hay que
abrir Historial antes de validar.

---

## 6. Especificación

### PASO 1 — `mainchat_layout.html`: sacar el menú de la navbar

**Ruta:** `c:\APLICACIONES\ProdIA\12112025_prodIA\ProdIA-2.0\ProdIA-2.0\MainChat\templates\mainchat_layout.html`

**1.1** — Sustituye el bloque **completo de las líneas 28 a 78** (desde el comentario
`<!-- Navbar superior... -->` hasta `</header>` inclusive) por esto:

```html
    <!-- La navbar superior se eliminó: el control de usuario vive ahora al pie del
         panel Historial (historial.js::bloqueUsuario). Se recuperan sus 64px de alto. -->
```

**1.2** — Inserta el menú **como último hijo de `.mc-shell`**, es decir entre
`</footer>` (L87) y el `</div>` que cierra `.mc-shell` (L88). Pega exactamente:

```html
    <!-- Menú de usuario. Vive AQUÍ, en .mc-shell, y no dentro del panel Historial,
         por dos razones verificadas:
           1. Seis ancestros con overflow:hidden lo recortarían (historial.css:10,
              acordeon.css:29 y :146, mainchat.css:36, style.css:190/51/40).
           2. acordeon.js:329 hace raiz.innerHTML='' en cada colapsar/expandir e
              historial.js:284 repinta el cuerpo entero: el menú se destruiría.
         Lo posiciona situar() en mainchat.js con position:fixed. -->
    <div class="mc-menu" id="mc-menu" role="menu" hidden>
        <div class="mc-menu__user">
            <div class="mc-menu__avatar">{{ _nombre[0] | upper }}</div>
            <div class="mc-menu__datos">
                <div class="mc-menu__fila">
                    <span class="mc-menu__nombre">{{ _nombre }}</span>
                    <span class="mc-menu__insignia">ADMIN</span>
                </div>
                <div class="mc-menu__email">{{ _u.get('email', session.get('user_email', '')) }}</div>
            </div>
        </div>

        <div class="mc-menu__sep"></div>

        <nav class="mc-menu__accesos">
            <button type="button" class="mc-acceso" role="menuitem" data-ruta="/test-clas">
                <i class="bi bi-flask" style="color:#1f2937"></i>
                <span>Test<br>Clas</span>
            </button>
            <button type="button" class="mc-acceso" role="menuitem" data-ruta="/admin">
                <i class="bi bi-shield-check" style="color:#004236"></i>
                <span>Admin</span>
            </button>
            <button type="button" class="mc-acceso" role="menuitem" data-ruta="/settings">
                <i class="bi bi-gear" style="color:#6b7280"></i>
                <span>Configuración</span>
            </button>
            <button type="button" class="mc-acceso" role="menuitem" data-ruta="/help">
                <i class="bi bi-question-circle" style="color:#7c3aed"></i>
                <span>Ayuda</span>
            </button>
        </nav>

        <div class="mc-menu__sep"></div>

        <button type="button" class="mc-menu__salir" role="menuitem" id="mc-logout">
            <i class="bi bi-box-arrow-right"></i>
            <span>Cerrar sesión</span>
        </button>
    </div>
```

> **Cambio respecto al original:** solo `.mc-menu__nombre` — antes
> `{{ _u.get('username', _nombre) }}` (que es el **email**), ahora `{{ _nombre }}`
> (que es `full_name`, ya calculado en L24). El email sigue visible en
> `.mc-menu__email`, así que no se pierde información.

**1.3** — **NO toques** las líneas 106-110 (`window.USER_FIRST_NAME` /
`USER_LAST_NAME` / `USER_FULL_NAME`). Ver H5: son un gate de funcionalidad.

**1.4 — Cache-bust obligatorio.** Reemplaza **todas** las apariciones de
`?v=20260821t` por `?v=20260824a` en las líneas 10, 13, 14, 15, 112, 113, 114 y 118.
Sin esto, los usuarios seguirán con el JS/CSS antiguo en caché.

---

### PASO 2 — `historial.js`: pintar el disparador al pie

**Ruta:** `...\MainChat\static\js\historial.js`

**2.1** — Añade esta función **justo después** de `mockEstadoSistema()`
(que termina en L320):

```js
    // Disparador del menú de usuario: pie fijo, fuera de .mc-hist__scroll, con el
    // mismo flex:0 0 auto que .mc-hist__sistema — no debe irse con el scroll de la
    // lista. El MENÚ no se pinta aquí: vive en .mc-shell (ver mainchat_layout.html)
    // porque este contenedor tiene overflow:hidden y se repinta entero.
    // USER_FULL_NAME solo se LEE: multitab_shell.js:40 la usa como gate de UI.
    function bloqueUsuario() {
        var nombre = String(window.USER_FULL_NAME || '').trim() || 'Usuario';
        var inicial = nombre.charAt(0).toUpperCase();
        return '' +
            '<button type="button" class="mc-hist__usuario" id="mc-usuario-btn" ' +
                    'aria-haspopup="menu" aria-expanded="false" aria-label="Menú de usuario">' +
                '<span class="mc-hist__usuario-avatar" aria-hidden="true">' + esc(inicial) + '</span>' +
                '<span class="mc-hist__usuario-nombre">' + esc(nombre) + '</span>' +
                '<i class="bi bi-chevron-up mc-hist__usuario-chevron" aria-hidden="true"></i>' +
            '</button>';
    }
```

> `esc()` **ya existe** en L223 — reutilízala, no la redefinas (H3).

**2.2** — En `pintar()`, localiza la asignación `cont.innerHTML = ...` (L284-294) y
añade `bloqueUsuario()` como **último** elemento concatenado:

```js
        cont.innerHTML =
            '<button type="button" class="mc-hist__nueva" id="mc-hist-nueva">' +
            '<i class="bi bi-plus-lg" aria-hidden="true"></i> Nueva conversación</button>' +
            aviso +
            '<div class="mc-hist__scroll">' +
                /* … lista o vacío, SIN CAMBIOS … */
            '</div>' +
            mockEstadoSistema() +
            bloqueUsuario();          // ← NUEVO, siempre el último
```

> ⚠️ **No modifiques nada más de `pintar()`.** En particular NO toques la guarda de
> firma (`firmaDe()`, L233-238, y su uso en L257): controla cuándo se repinta.

**2.3** — **NO añadas ningún `addEventListener` aquí.** El botón se recrea en cada
repintado; enganchar por elemento dejaría listeners huérfanos. El clic lo recoge
`mainchat.js` por delegación (Paso 3).

---

### PASO 3 — `mainchat.js`: reanclar el menú

**Ruta:** `...\MainChat\static\js\mainchat.js`

**Reemplaza el archivo COMPLETO** por:

```js
/**
 * MainChat — menú de usuario anclado al pie del panel Historial.
 *
 * El disparador (#mc-usuario-btn) lo pinta historial.js dentro de
 * #mc-historial-body, que se repinta entero en cada cambio de la lista y en cada
 * colapsar/expandir del acordeón (acordeon.js:329). Por eso:
 *   · el clic se recoge por DELEGACIÓN en document, no con getElementById;
 *   · el menú (#mc-menu) vive en .mc-shell, fuera de #mainchat-root, para que no
 *     lo destruya innerHTML='' ni lo recorten los seis overflow:hidden de la
 *     cadena de ancestros del panel;
 *   · position:fixed + coordenadas calculadas: absolute se recortaría.
 *
 * Cierra por clic fuera, por Escape y al colapsar/expandir un panel: un menú que
 * solo se cierra con su propio botón atrapa al usuario que lo abrió por error.
 */
(function () {
    'use strict';

    const menu = document.getElementById('mc-menu');
    if (!menu) return;

    const MARGEN = 8;   // separación respecto al botón y a los bordes del viewport

    function btnActual() {
        return document.getElementById('mc-usuario-btn');
    }

    // Coloca el menú sobre el botón. Requiere que el menú YA esté visible: con
    // display:none (.mc-menu[hidden]) offsetHeight devuelve 0 y quedaría mal
    // situado. abrir() garantiza ese orden.
    function situar() {
        const btn = btnActual();
        if (!btn) return;

        const r = btn.getBoundingClientRect();
        const alto = menu.offsetHeight;
        const ancho = menu.offsetWidth;

        // Hacia ARRIBA desde el botón; si no cabe, se apoya en el borde superior.
        let top = r.top - alto - MARGEN;
        if (top < MARGEN) top = MARGEN;

        // Alineado al borde izquierdo del botón, sin salirse del viewport.
        let left = r.left;
        if (left + ancho > window.innerWidth - MARGEN) {
            left = window.innerWidth - ancho - MARGEN;
        }
        if (left < MARGEN) left = MARGEN;

        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function abrir(mostrar) {
        menu.hidden = !mostrar;
        const btn = btnActual();
        if (btn) btn.setAttribute('aria-expanded', mostrar ? 'true' : 'false');
        if (mostrar) situar();   // medir DESPUÉS de quitar hidden
    }

    // Un solo listener para abrir y para cerrar por clic fuera. La guarda de
    // closest() replica la de historial.js:328 (H7): el target de un clic no
    // siempre es un Element.
    document.addEventListener('click', function (e) {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;

        if (t.closest('#mc-usuario-btn')) {
            e.stopPropagation();
            abrir(menu.hidden);
            return;
        }
        if (!menu.hidden && !menu.contains(t)) abrir(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !menu.hidden) abrir(false);
    });

    window.addEventListener('resize', function () {
        if (!menu.hidden) situar();
    });

    // Colapsar/expandir mueve el panel durante 320ms (transición flex,
    // acordeon.css:33-36). Perseguir el botón durante la animación se ve peor que
    // cerrar, así que se cierra.
    const raiz = document.getElementById('mainchat-root');
    if (raiz) {
        raiz.addEventListener('click', function (e) {
            const t = e.target;
            if (!t || typeof t.closest !== 'function') return;
            if (t.closest('.mc-cabecera') && !menu.hidden) abrir(false);
        });
    }

    // Accesos del waffle: las rutas aún no existen, así que se avisa en
    // consola en vez de navegar a un 404.
    menu.querySelectorAll('.mc-acceso').forEach(function (acceso) {
        acceso.addEventListener('click', function () {
            const ruta = acceso.dataset.ruta;
            console.info('MainChat: acceso "' + ruta + '" pendiente de implementar');
            abrir(false);
        });
    });

    const salir = document.getElementById('mc-logout');
    if (salir) {
        salir.addEventListener('click', function () {
            fetch('/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
                .then(function () {
                    window.location.href = '/login';
                })
                .catch(function (err) {
                    console.error('MainChat: error cerrando sesión', err);
                    window.location.href = '/login';
                });
        });
    }
})();
```

> **Los listeners de `.mc-acceso` y `#mc-logout` SÍ van por `getElementById` /
> `querySelectorAll`**: viven dentro de `#mc-menu`, que es estático y no se repinta.
> Solo el disparador necesita delegación.

---

### PASO 4 — `historial.css`: estilos del disparador

**Ruta:** `...\MainChat\static\css\historial.css`

**Añade al FINAL del archivo:**

```css
/* ── Disparador del menú de usuario ─────────────────────────────────────
   Pie fijo, fuera de .mc-hist__scroll: mismo patrón que .mc-hist__sistema
   (flex:0 0 auto), para que no se vaya con el scroll de la lista. */

.mc-hist__usuario {
    all: unset;
    box-sizing: border-box;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 8px;
    border-top: 1px solid var(--mc-border);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.mc-hist__usuario:hover {
    background: rgb(0 66 54 / 6%);
}

.mc-hist__usuario:focus-visible {
    outline: 2px solid var(--mc-primary);
    outline-offset: 2px;
}

.mc-hist__usuario-avatar {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--mc-primary);
    border: 2px solid var(--mc-lime);
    color: #fff;
    font: 800 13px/1 'Inter', -apple-system, 'Segoe UI', system-ui, arial, sans-serif;
    display: grid;
    place-items: center;
}

/* min-width:0 + ellipsis: el panel Historial ocupa el 25% del ancho
   (acordeon.js:167-169), así que un nombre largo debe recortarse, no ensanchar. */
.mc-hist__usuario-nombre {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    font: 600 13px/1.3 'Inter', -apple-system, 'Segoe UI', system-ui, arial, sans-serif;
    color: #1f2937;
}

.mc-hist__usuario-chevron {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--mc-muted);
    transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.mc-hist__usuario[aria-expanded="true"] .mc-hist__usuario-chevron {
    transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
    .mc-hist__usuario,
    .mc-hist__usuario-chevron {
        transition: none;
    }
}
```

---

### PASO 5 — `mainchat.css`: menú en `fixed` y limpieza de la navbar

**Ruta:** `...\MainChat\static\css\mainchat.css`

**5.1** — Sustituye la regla `.mc-menu` (**líneas 103-114**) por:

```css
/* fixed, no absolute: el disparador vive dentro del panel Historial, cuya cadena de
   ancestros acumula seis overflow:hidden (historial.css:10, acordeon.css:29 y :146,
   mainchat.css:36, style.css:190/51/40) que lo recortarían. Las coordenadas las
   calcula situar() en mainchat.js; top/left aquí son solo el valor de arranque. */
.mc-menu {
    position: fixed;
    top: 0;
    left: 0;
    width: 330px;
    background: #fff;
    border: 1px solid var(--mc-border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgb(0 0 0 / 18%);
    padding: 14px;
    z-index: 1000;
}
```

**5.2** — **Elimina** estas reglas, ya sin uso (verificado H6):
- `.mc-navbar` — líneas **52-63**
- `.mc-navbar__right` — líneas **65-67**
- `.mc-avatar`, `.mc-avatar:hover`, `.mc-avatar:focus-visible` — líneas **73-99**
- el comentario `/* ── Navbar ── */` de la línea **50**
- la variable `--mc-navbar-h: 64px;` — línea **12**

**5.3** — **NO toques**: `.mc-menu[hidden]` (L116-118) ni ninguna regla interna del
menú (`.mc-menu__user`, `__avatar`, `__nombre`, `__insignia`, `__email`, `__sep`,
`__accesos`, `.mc-acceso`, `.mc-menu__salir` — L120-234). Se reutilizan tal cual.

---

## 7. Orden de ejecución

| Orden | Paso | Por qué este orden |
|---|---|---|
| 1 | PASO 1 (plantilla) | Mueve el marcado; sin él, el JS no encuentra `#mc-menu` |
| 2 | PASO 2 (`historial.js`) | Crea el disparador que el JS del paso 3 busca |
| 3 | PASO 3 (`mainchat.js`) | Cablea el comportamiento |
| 4 | PASO 4 (`historial.css`) | Estilos del disparador |
| 5 | PASO 5 (`mainchat.css`) | `fixed` + limpieza |
| 6 | §8 | Verificación completa |

> Entre los pasos 1 y 3 la pantalla queda **transitoriamente sin control de usuario**.
> Es esperado. No lo reportes como fallo si aún no llegaste al paso 3.

---

## 8. Validaciones

**Ejecutar en el servidor de pruebas** (los venv locales están rotos, §3).
Abrir `http://<host>:8020/mainchat` con sesión iniciada.

| # | Comprobación | Resultado esperado |
|---|---|---|
| 1 | Abrir el panel **Historial** (arranca colapsado, H8) | El disparador se ve al pie, bajo "Estado del sistema" |
| 2 | Esquina superior derecha | **Sin** burbuja; la navbar ya no ocupa alto |
| 3 | Texto del disparador | "Javier Guerrero" — **nombre**, no el email |
| 4 | Clic en el disparador | Menú se despliega **hacia arriba**, **completo**, sin recortes |
| 5 | Cabecera del menú | `.mc-menu__nombre` muestra el **nombre**; el email sigue debajo |
| 6 | Chevron | Apunta arriba; rota 180° al abrir |
| 7 | 🔴 **Supervivencia al repintado** | Menú abierto → enviar un mensaje en Chat → esperar ~2 s → **el menú sigue abierto y en su sitio** |
| 8 | 🔴 **Supervivencia al acordeón** | Colapsar y expandir Historial → **el disparador reaparece y sigue funcionando** |
| 9 | Cierre | Clic fuera ✓ · Escape ✓ · clic en cabecera de panel ✓ |
| 10 | Reposicionamiento | Redimensionar con el menú abierto → sigue pegado al botón y dentro del viewport |
| 11 | Nombre largo | Elipsis; el panel **no** se ensancha ni desborda |
| 12 | Teclado | Tab llega al disparador · Enter abre · Escape cierra · foco visible |
| 13 | Consola F12 | **0 errores**. Los accesos waffle siguen emitiendo su `console.info` |
| 14 | 🔴 **No-regresión del chat** | El saludo sigue diciendo "Hola Javier, bienvenido" y los chips MOTOR se comportan igual que antes (H5) |
| 15 | Logout | "Cerrar sesión" → `POST /auth/logout` → `/login` |

> **DT-15 (lección del CLAUDE.md de Robustez):** "sin errores en consola" **no** es
> "feature verificada". Los puntos 7, 8 y 14 son de **interacción runtime** y exigen
> prueba humana en navegador. Si no puedes abrir navegador, el estado correcto es
> **"PENDIENTE de validación humana"**, nunca "verificado".

---

## 9. Reglas no negociables

1. **No toques** `window.USER_FIRST_NAME` / `USER_LAST_NAME` / `USER_FULL_NAME`
   (`mainchat_layout.html:106-110`). Solo se **leen**. Son un gate de UI en
   `multitab_shell.js:40` (H5).
2. **No dupliques `esc()`** — ya existe en `historial.js:223` (H3).
3. **No añadas listeners al disparador dentro de `pintar()`** — se recrea en cada
   repintado; solo delegación.
4. **No uses `position:absolute`** para el menú (H1).
5. **No pintes el menú dentro de `#mc-historial-body`** (H2).
6. **No toques** `acordeon.js` ni `acordeon.css`.
7. **No modifiques** la guarda de firma de `historial.js` (`firmaDe()`, L233-238, y
   su uso en L257).
8. **No implementes** las rutas `/test-clas`, `/admin`, `/settings`, `/help`.
9. **Cache-bust obligatorio** (§6, paso 1.4) — sin él el cambio no llega al usuario.
10. **Comentarios en español** y en el estilo del archivo: explican *por qué*, no
    *qué* (convención observable en todo el repo).

---

## 10. Fuera de alcance

- Implementar los cuatro accesos del waffle.
- Traer el nombre real desde LDAP (§11).
- Cambiar el pipeline de autenticación.
- El mock de "Estado del sistema" (`historial.js:308-320`), hardcodeado a positivo.
- **La insignia ADMIN** — ver §11.

---

## 11. Pendientes que este plan NO resuelve (reportar al usuario)

### 11.1 🟠 La insignia ADMIN es falsa

`mainchat_layout.html:43` pinta `ADMIN` a **todo** usuario. No existe campo `role` ni
`is_admin` en `session["user"]` (`routes/auth.py:129`, `:210`, `:306`).

Al pasar el menú a un lugar más visible, la etiqueta falsa queda más expuesta.
**El executor la deja tal cual** — corregirla exige decidir de dónde sale el rol
(quitarla, o añadir `is_admin` en los tres puntos de `auth.py` con lista blanca).
Es una decisión del usuario, no del executor.

### 11.2 🟠 `full_name` se deriva del email, no de LDAP

`routes/auth.py:295-303` (y clones en L116-124 y L201-208):

```python
local_part = user_email.split("@")[0]   # "javier.guerrero"
name_parts = local_part.split(".")      # ["javier", "guerrero"]
```

`utils/auth_service.py::authenticate_user` (L160-272) hace `conn.bind()` (L240) y
`conn.unbind()` (L253) — **no hay ni un `conn.search()` en todo el repo**, así que
nunca se leen `displayName`/`givenName`/`sn`.

| Email | `full_name` | |
|---|---|---|
| `javier.guerrero@…` | "Javier Guerrero" | ✅ |
| `jguerrero@…` | "Jguerrero" | feo, no vacío |
| `maria.jose.perez@…` | "Maria Jose Perez" | ✅ |
| cualquiera | **sin tildes** | el email no las lleva |

Hoy no se nota porque el menú muestra el email. **Al ponerlo de cara, estos casos se
harán visibles.** Traer el nombre real exigiría un `conn.search()` entre el bind y el
unbind, **conservando** este fallback (`DEVELOPMENT_MODE` en `auth.py:278` y el bypass
de L200 saltan LDAP por completo). Es un cambio de backend, fuera de este plan.

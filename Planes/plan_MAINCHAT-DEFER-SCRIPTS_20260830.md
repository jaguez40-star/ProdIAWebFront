# Plan — `defer` en los 4 scripts de arranque de MainChat

| | |
|---|---|
| **ID tarea** | `MAINCHAT-DEFER-SCRIPTS` |
| **Fecha** | 2026-08-30 |
| **Versión** | **v2 — auditada contra los pipelines** (v1: 2026-08-30, superada) |
| **Alcance** | `MainChat/templates/mainchat_layout.html` — únicamente el orden de carga de sus 4 `<script>` |
| **Origen** | Investigación de por qué `/mainchat` se ve "congelado" unos segundos tras la transición de salida del login (`LOGIN-TRANSICION-SALIDA_20260830`) |

> **Qué cambió de v1 a v2.** La v1 auditó el código y sus dependencias (H-1…H-9), pero no
> los pipelines de despliegue. Esta segunda pasada añade H-10…H-15: confirma que
> `Planes/` no migra a Azure (H-10), corrige un comentario que habría quedado como
> referencia rota en el código que sí migra (H-11), documenta una inconsistencia
> estructural preexistente que se deja fuera a propósito (H-12), y confirma que no hay
> red de seguridad automática para este archivo (H-13/H-14/H-15) — la validación humana
> sigue siendo el único gate real.

## Qué NO se toca

- **`templates/base.html`** (`socket.io`, `plotly-2.26.0.min.js`, cargados en `<head>`,
  bloqueantes). Hallazgo real (v1 §1 H-5) pero fuera de este plan: afecta a *todas* las
  páginas de la app, y su auditoría completa (8 archivos JS que usan `Plotly.`, sin
  verificar uno a uno) es una tarea propia y más grande.
- **`templates/main.html`** (la vista clásica `/`). Bloque de scripts distinto y más
  interdependiente, sin auditar.
- **La estructura de `mainchat_layout.html`**: los 4 `<script>` permanecen dentro de
  `{% block content %}`, no se mueven a `{% block scripts %}` aunque ese es el bloque que
  `base.html` ofrece para esto (ver H-12). Mover markup es más invasivo que lo que este
  cambio necesita.
- **`multitab_shell.js`, `mainchat.js`, `acordeon.js`, `historial.js`**: no se edita su
  contenido, solo el atributo del `<script>` que los carga.
- **`Planes/plan_LOGIN-TRANSICION-SALIDA_20260830.md`** ni el código que ya referencia sus
  rutas (`login.html`, `login.css`, `login-transition.js`, `login.js`,
  `verificar_deploy.ps1`). H-11 encontró el mismo patrón de comentario ahí, pero
  corregirlo retroactivamente es una tarea aparte, no pedida — se deja como observación.

## Decisión cerrada del usuario

Alcance reducido a lo auditado como seguro (`defer` en `mainchat_layout.html`); la
reordenación de `base.html` queda fuera por su radio de impacto (confirmado en v1 y v2).

---

## §0 · Contexto para el agente EXECUTOR

**Proyecto:** ProdIA — analítica de producción de Ecopetrol. Frontend Flask + Jinja2
(puerto 5029). Esta tarea toca **un solo archivo**.

**Directorio de trabajo:** `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\`

**Archivo que se toca (1):**

| # | Ruta absoluta | Acción |
|---|---|---|
| 1 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\templates\mainchat_layout.html` | MODIFICAR |

**Convenciones obligatorias:**

- No se escribe JavaScript nuevo en esta tarea: es un cambio de un atributo HTML.
- Todo comentario nuevo, en español.
- **Comentarios en código que SÍ se publica: autocontenidos.** No referenciar rutas de
  `Planes/`, `.claude/` ni `CLAUDE.md` — esas carpetas están en `$ExcluirRutas` de
  `migrar_a_azure.ps1` (H-10) y **no llegan** al repositorio de Azure ni al 139. Un
  comentario que diga "ver Planes/plan_X.md" es una referencia rota para quien lea el
  código ya desplegado (H-11). Explicar el motivo **en el propio comentario**.
- **Regla de cierre:** si el archivo real no coincide con lo citado abajo, **DETENTE y
  reporta**. No improvises.

**Cómo arrancar para probar** (carpeta `C:\APLICACIONES\ProdIA\Repo ProdIA\`, una sola
línea, consola normal — **no** requiere administrador):

```powershell
.\frontend\iniciar_frontend.bat
```

Espera `Running on http://127.0.0.1:5029`. La consola queda ocupada; se corta con `Ctrl+C`.

---

## §1 · Hallazgos de la auditoría

### Bloque A — Hallazgos de la v1 (código y dependencias)

#### 🟢 H-1 — El servidor no es el cuello de botella

**Evidencia:** medido con `curl -w`, `/mainchat` autenticado responde en **15 ms** de
servidor (TTFB). El retraso percibido es 100% del navegador (descarga+parseo+ejecución de
JS), no del backend Flask.

#### 🔴 H-2 — Los 4 scripts se cargan sin `defer`/`async`, bloqueando el pintado

**Evidencia:** `MainChat/templates/mainchat_layout.html` líneas 134-140 (archivo de 141
líneas):

```html
<script src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260826m"></script>
<script src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260825i"></script>
<script src="{{ url_for('mainchat.static', filename='js/acordeon.js') }}?v=20260826a"></script>
<script src="{{ url_for('mainchat.static', filename='js/historial.js') }}?v=20260826b"></script>
```

`multitab_shell.js` pesa **448 KB sin minificar** (7304 líneas). Al ser scripts clásicos
(sin `defer`), el navegador los descarga+parsea+ejecuta **síncronamente, en serie**, y no
puede pintar nada del `<main class="mc-body" id="mainchat-root">` (línea 35) hasta que
terminan.

#### 🟢 H-3 — Existe precedente: `main.html` ya resolvió el mismo síntoma, sin tocar `base.html`

**Evidencia:** `templates/main.html` líneas 100-103:

```
// Monta el shell directo en "Consulta" apenas terminan de cargar sus dependencias reales
// (multitab_shell.js + chat.js, ya cargados en este punto del documento), sin esperar a
// panels.js/charts.js/auth.js/DOMContentLoaded — reduce al mínimo el hueco en blanco entre
// el login y la vista final.
```

El equipo ya identificó el "hueco en blanco" tras el login, y lo resolvió **montando el
shell tan pronto como sus dependencias reales cargan** — no reordenando
`Plotly`/`socket.io` en `base.html`. Es el patrón a seguir.

#### 🟢 H-4 — `acordeon.js` tiene guarda defensiva: `defer` es seguro si se aplica a los 4 juntos

**Evidencia:** `MainChat/static/js/acordeon.js`:

```js
// líneas 74-77
function montarShellUnaVez() {
    if (shellMontado) return;
    if (!window.MultiTabShell || typeof window.MultiTabShell.mount !== 'function') return;
    shellMontado = true;
    ...

// líneas 437-443 (nivel superior de la IIFE, se ejecuta al parsear el archivo)
montarShellUnaVez();
render();
})();
```

`montarShellUnaVez()` depende de que `window.MultiTabShell` ya exista; si no, **sale en
silencio sin reintentar**. Los scripts con `defer` se ejecutan en el mismo orden relativo
en que aparecen en el documento, nunca entrelazados entre sí. Aplicado a **los 4 juntos**,
`multitab_shell.js` (primero) sigue terminando antes que `acordeon.js` (tercero).

**Por eso la regla no negociable §5.1: los 4 reciben `defer`, nunca un subconjunto.**

#### 🔴 H-5 — El hallazgo de mayor impacto queda FUERA de este plan: `Plotly` en `<head>` de `base.html`

**Evidencia:** `templates/base.html` líneas 22 y 33 cargan, en el `<head>`, bloqueante,
`socket.io` y **`plotly-2.26.0.min.js` (3.5 MB)**, antes de cualquier HTML del `<body>`.

**Por qué no entra en este plan:** `base.html` la extienden todas las páginas de la app;
`Plotly.` se usa en 8 archivos JS sin auditar uno a uno; y `main.html` (H-3) tuvo el mismo
síntoma y no tocó estos scripts. **Recomendación separada:** una tarea propia con lectura
completa de los 8 archivos antes de proponer nada.

#### 🟢 H-6 — Sin `document.write` en ninguno de los 4 scripts

**Evidencia:** `grep "document\.write"` sobre los 4 archivos → sin coincidencias.
`document.write` en un script diferido borraría el documento entero; al no usarse, `defer`
no tiene ese riesgo.

#### 🟢 H-7 — `main.js` no depende del orden: solo registra un listener a nivel superior

**Evidencia:** `grep "MultiTabShell\|DOMContentLoaded"` sobre `static/js/main.js` → una
sola coincidencia, línea 407: `document.addEventListener('DOMContentLoaded', () => {`.

`main.js` no toca `MultiTabShell` a nivel superior — toda su lógica real está detrás de
`DOMContentLoaded`, que dispara **después** de que todos los scripts `defer` terminen,
sin importar su posición en el documento.

**Consecuencia (ampliada en H-12):** aplicar `defer` a los 4 scripts invierte su orden de
ejecución respecto a `bootstrap.bundle.min.js` y `main.js` — inofensivo, verificado.

#### 🟢 H-8 — La variable inline de usuario no se ve afectada

**Evidencia:** `mainchat_layout.html` líneas 128-132, un `<script>` **sin** `src`
(`window.USER_FIRST_NAME = ...`). `defer` no afecta a scripts sin `src`: se ejecuta en su
posición de parseo, antes de que terminen los diferidos. Sin cambios de comportamiento.

#### 🟢 H-9 — El comentario existente sobre el orden `acordeon.js` → `historial.js` sigue siendo válido

**Evidencia:** `mainchat_layout.html` líneas 137-139. Es una dependencia de orden relativo
entre los 4, que `defer` preserva (H-4). No necesita reescribirse.

---

### Bloque B — Hallazgos nuevos de la v2 (pipelines)

#### 🟢 H-10 — `Planes/` NO migra a Azure: la alarma inicial era falsa, pero reveló H-11

**Evidencia:** `.claude/skills/migrar-a-azure/migrar_a_azure.ps1` líneas 65-76:

```powershell
$ExcluirRutas = @(
    '.claude',
    '.codex',
    'Planes',
    'clmd',
    'data/bitacora',
    'CLAUDE.md',
    'BITACORA.md'
)
```

y línea 82: `$TerminosProhibidos = @('claude', 'jaguez40')`.

`plan_LOGIN-TRANSICION-SALIDA_20260830.md` (ya commiteado y pusheado a GitHub en `b4dfe19`)
menciona la cadena `CLAUDE.md` doce veces. En PowerShell, `-match` es **insensible a
mayúsculas** por defecto, así que en teoría "CLAUDE.md" coincide con el patrón `'claude'`.
Verificado el flujo completo (líneas 90-93, comentario de `Test-Excluido`): la función que
decide qué migra es la **misma** que filtra qué se escanea en `Find-Trazas` — "Se usa para
filtrar lo versionado, para copiar, para inspeccionar el destino y **para el chequeo de
trazas**". Como `Planes` está en `$ExcluirRutas`, **nunca llega a escanearse**: no hay
riesgo real de que el pipeline se bloquee por esto.

**Consecuencia:** ningún cambio necesario en `migrar_a_azure.ps1` ni en los planes
existentes. Pero la comprobación expuso H-11.

#### 🟡 H-11 — Los comentarios que apuntan a `Planes/...md` son referencias rotas en el código que SÍ migra

**Evidencia:** derivado de H-10. Como `Planes/` nunca sale de GitHub/local, cualquier
comentario en un archivo que **sí** se publica (`.html`, `.css`, `.js`, `.ps1`) que diga
"ver `Planes/plan_X.md`" es, para quien lea el código ya desplegado en Azure o en el 139,
una ruta que no existe ahí.

**Ya ocurre en código ya shipped:** `login-transition.js` (cabecera), `login.js` (guarda
del redirect) y `verificar_deploy.ps1` (comentario del marcador nuevo) del plan
`LOGIN-TRANSICION-SALIDA` referencian su ruta de `Planes/` de esta forma. No es nuevo de
esta tarea y **no se corrige aquí** — retocar código ya validado y pusheado por un hallazgo
de estilo, sin que el usuario lo pida, es más alcance del que esta tarea necesita. Queda
como observación para cuando se revise ese archivo por otro motivo.

**Consecuencia sobre ESTE plan:** el comentario nuevo que se añade en §3.1 se escribe
**autocontenido** — explica el motivo del cambio con sus propias palabras, sin depender de
que el lector tenga acceso a `Planes/`. Ver la regla nueva en §0 y el texto reformulado en
§3.1.

#### 🟡 H-12 — Hallazgo estructural: `mainchat_layout.html` no usa el bloque `{% block scripts %}` que `base.html` ofrece

**Evidencia:** `templates/base.html` línea 95: `{% block scripts %}{% endblock %}`, situado
**después** de `bootstrap.bundle.min.js` (línea 90) y `main.js` (línea 93). `main.html`
línea 78 sí lo usa: `{% block scripts %}` envuelve todo su bloque de scripts de página.

`mainchat_layout.html`, en cambio, incrusta sus 4 `<script>` dentro de `{% block content
%}` (líneas 134-140), que se renderiza **antes** de `bootstrap.bundle.min.js`/`main.js`
(el bloque `content` está en la línea 71 de `base.html`, muy por delante de las líneas
90-95). Es la causa estructural de por qué `defer` invierte ese orden concreto (ya
verificado inofensivo en H-7).

**Por qué no se corrige en este plan:** mover los 4 `<script>` de `{% block content %}` a
un nuevo `{% block scripts %}` en `mainchat_layout.html` es un cambio de **estructura**,
no de un atributo — más invasivo que lo que este plan necesita, y sin beneficio adicional
sobre lo que `defer` ya consigue (el orden entre los 4 se preserva igual con o sin mover el
bloque). Se documenta como inconsistencia preexistente para quien reorganice esta plantilla
en el futuro.

#### 🟢 H-13 — `verificar_deploy.ps1` no verifica nada de `mainchat_layout.html`

**Evidencia:** `grep -in "mainchat" verificar_deploy.ps1` → **sin coincidencias**. El
verificador solo cubre `app.py`, `login.html`/`login.css`/`login.js` y sus estáticos.

**Consecuencia:** no hay red de seguridad automática para esta tarea. No es una razón para
no hacer el cambio (es de bajo riesgo, auditado H-1 a H-9), pero refuerza que **la
validación humana de §6.2 es el único gate real** — no hay `[FALLA]` que vaya a avisar si
algo se rompe.

#### 🟢 H-14 — `mainchat_layout.html` SÍ está versionada en git

**Evidencia:** `git ls-files MainChat/templates/mainchat_layout.html` → devuelve la ruta.
A diferencia del incidente de `PanelLEft.png` (plan `LOGIN-TRANSICION-SALIDA` H-15), aquí
no hay riesgo de que el cambio no llegue a producción por falta de seguimiento en git.

#### 🟢 H-15 — Nada más depende de `mainchat_layout.html`

**Evidencia:** `grep -rn "mainchat_layout"` sobre `frontend/` → 12 resultados, todos
documentación (planes, bitácora) salvo uno: `historial.js:349`, que es un comentario
("el menú vive en `.mc-shell`, ver `mainchat_layout.html`"), no una dependencia funcional.
`routes/mainchat.py` es la única ruta que la renderiza (`render_template`). El radio de
impacto de este cambio es exactamente el archivo tocado.

---

## §2 · Estado actual

`mainchat_layout.html` carga sus 4 scripts como etiquetas `<script src="...">` clásicas,
sin `defer` ni `async`, dentro de `{% block content %}` (no de `{% block scripts %}`, a
diferencia de `main.html` — H-12). El navegador los descarga, parsea y ejecuta en serie,
bloqueando cualquier pintado del contenido ya parseado hasta que los 4 terminan.

---

## §3 · Especificación

### §3.1 · MODIFICAR `MainChat\templates\mainchat_layout.html`

LOCALIZAR (líneas 134-140, el bloque completo de los 4 scripts):

```html
<script src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260826m"></script>
<script src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260825i"></script>
<script src="{{ url_for('mainchat.static', filename='js/acordeon.js') }}?v=20260826a"></script>
<!-- Después de acordeon.js: historial.js se registra en window.MainChatHistorial y
     pinta por su cuenta al final de su IIFE, porque el primer render() del acordeón
     ya ocurrió al parsear el script anterior. -->
<script src="{{ url_for('mainchat.static', filename='js/historial.js') }}?v=20260826b"></script>
```

SUSTITUIR POR:

```html
<!-- [2026-08-30] defer en los 4: el navegador puede parsear y pintar el HTML ya
     presente (.mc-shell, #mainchat-root) ANTES de descargar+ejecutar estos ~500KB+ de
     JS, en vez de bloquear el pintado hasta que terminan.
     SIEMPRE los 4 juntos, nunca un subconjunto: acordeon.js espera que
     window.MultiTabShell ya exista al montarse (si no existe, sale en silencio sin
     reintentar), y defer preserva el orden relativo entre scripts diferidos — pero
     solo entre sí; quitarle defer a uno solo rompería esa garantía.
     Efecto colateral verificado inofensivo: invierte el orden de ejecución respecto a
     bootstrap.bundle.min.js y main.js (que van después en el documento y siguen sin
     defer) — pero main.js no usa nada del shell fuera de su propio listener
     DOMContentLoaded, que de todas formas dispara después de que todo lo diferido
     termine. -->
<script defer src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260826m"></script>
<script defer src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260825i"></script>
<script defer src="{{ url_for('mainchat.static', filename='js/acordeon.js') }}?v=20260826a"></script>
<!-- Después de acordeon.js: historial.js se registra en window.MainChatHistorial y
     pinta por su cuenta al final de su IIFE, porque el primer render() del acordeón
     ya ocurrió al parsear el script anterior. -->
<script defer src="{{ url_for('mainchat.static', filename='js/historial.js') }}?v=20260826b"></script>
```

> ⚠️ **No** tocar el `<script>` inline de las líneas 128-132 (`window.USER_FIRST_NAME`
> etc.): no lleva `src`, así que `defer` no le aplica (H-8), y no debe añadirse el
> atributo a una etiqueta sin `src`.
> ⚠️ **No** propagar este cambio a `templates/main.html` ni a `templates/base.html`.
> ⚠️ El comentario nuevo es **autocontenido a propósito** (H-11): no referencia
> `Planes/plan_MAINCHAT-DEFER-SCRIPTS_20260830.md`, porque esa carpeta no llega al
> repositorio de Azure ni al servidor 139.

---

## §4 · Orden de ejecución

| # | Paso | Comprobación al terminar |
|---|---|---|
| 1 | Aplicar el cambio de §3.1 | `MainChat\templates\mainchat_layout.html` |
| 2 | Arrancar Flask y validar §6.1 | Sin errores en consola |

**Si falla, DETENERSE.** No improvisar una variante.

---

## §5 · Reglas no negociables

1. **Los 4 scripts reciben `defer` juntos, o ninguno.** Un subconjunto rompe la garantía
   de `montarShellUnaVez()` (H-4).
2. **No tocar el `<script>` inline** de `window.USER_FIRST_NAME`/etc.
3. **No tocar `templates/base.html`** ni `templates/main.html`. H-5 es una recomendación
   separada, no parte de esta especificación.
4. **No mover los 4 `<script>` a `{% block scripts %}`.** H-12 es un hallazgo documentado,
   no un cambio de este plan.
5. **No tocar el contenido** de `multitab_shell.js`, `mainchat.js`, `acordeon.js` ni
   `historial.js`.
6. **No cambiar los sellos de caché** (`?v=...`) de ninguno de los 4 scripts: no hay
   cambio de contenido que lo justifique, solo un atributo HTML.
7. **No retocar el código ya shipped del plan `LOGIN-TRANSICION-SALIDA`** por el hallazgo
   de estilo H-11: fuera de alcance de esta tarea.
8. **Los comentarios nuevos en código que se publica no referencian `Planes/`, `.claude/`
   ni `CLAUDE.md`** (H-11): esas rutas no llegan a Azure ni al 139.
9. **Si algo del plan no calza con el código real, DETENTE y reporta.**

---

## §6 · Validación

### §6.1 · Estática — la ejecuta el EXECUTOR

Desde `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, consola normal (**no** administrador).

| # | Comando | Resultado esperado |
|---|---|---|
| 1 | `Select-String -Path MainChat\templates\mainchat_layout.html -Pattern "<script defer" \| Measure-Object \| Select-Object -ExpandProperty Count` | `4` |
| 2 | `Select-String -Path MainChat\templates\mainchat_layout.html -Pattern "USER_FIRST_NAME" \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` (sigue intacto, sin `defer`) |
| 3 | `Select-String -Path MainChat\templates\mainchat_layout.html -Pattern "Planes[\\/]" \| Measure-Object \| Select-Object -ExpandProperty Count` | `0` (sin referencias rotas, H-11) |

**Arranque** (desde `C:\APLICACIONES\ProdIA\Repo ProdIA\`, una línea; la consola queda
ocupada, se corta con `Ctrl+C`):

```powershell
.\frontend\iniciar_frontend.bat
```

Esperado: `Running on http://127.0.0.1:5029` sin trazas de error.

**🔴 El EXECUTOR NO PUEDE VALIDAR NADA VISUAL.** No tiene navegador: no puede medir cuánto
mejora el tiempo hasta el primer pintado, ni confirmar que el shell sigue montándose. Debe
reportar **«implementado, PENDIENTE de validación humana»**.

### §6.2 · Humana — la ejecuta el USUARIO en el navegador

Con **F12 → Network** (throttling normal) y **Console** abiertas, refresco duro (`Ctrl+F5`)
en `/mainchat` tras iniciar sesión:

| # | Qué probar | Qué debe pasar |
|---|---|---|
| 1 | Cargar `/mainchat` directamente (URL, ya autenticado) | El shell (Historial + Chat, mascota, "Escribe tu pregunta...") aparece igual que antes |
| 2 | Tras el login, con la transición de salida | El hueco entre que el panel se va y que `/mainchat` pinta algo se siente **igual o más corto** que antes de este cambio |
| 3 | Historial | Sigue listando/creando conversaciones con normalidad |
| 4 | Pestañas del waffle (Consulta, Análisis, Test Clas) | Abren y funcionan igual que antes |
| 5 | Consola F12 | **0 errores nuevos** (en particular, nada de `MultiTabShell is not defined` ni similar) |
| 6 | Recargar `/` (vista clásica) y `/consulta`, `/analisis` si aplica | Sin cambios — no deberían verse afectadas, ya que no se tocó `main.html` ni `base.html` |

**Solo el usuario marca ✅ esta feature.**

### §6.3 · Antes de migrar a Azure

Sigue el pipeline de siempre (`CLAUDE.md` §9): validar §6.2 en Pruebas, luego

```powershell
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Aplicar
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Push
```

Confirmado en H-10 que este cambio no dispara el escaneo de términos prohibidos
(`mainchat_layout.html` no está en `$ExcluirRutas` y no contiene "claude"/"jaguez40").

---

## §7 · Fuera de alcance

- **Diferir `socket.io`/`plotly` en `base.html`** (H-5). Recomendado como tarea separada,
  con auditoría propia de los 8 archivos que usan `Plotly.`.
- **Minificar `multitab_shell.js`** (448 KB sin minificar). Cambio de build/tooling, no de
  este plan.
- **Tocar `main.html`.** Árbol de dependencias de scripts distinto y no auditado.
- **Mover los 4 `<script>` a `{% block scripts %}`** (H-12). Documentado, no aplicado.
- **Corregir las referencias a `Planes/` en el código ya shipped** del plan
  `LOGIN-TRANSICION-SALIDA` (H-11). Es una observación, no un pedido del usuario.
- **Migrar a Azure DevOps.** Sigue el pipeline de siempre, después de validar §6.2.

---

## Prompt para el agente EXECUTOR

```
Eres un agente EXECUTOR. Lee completo el plan indicado y ejecútalo AL PIE DE LA LETRA.
Plan: C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\Planes\plan_MAINCHAT-DEFER-SCRIPTS_20260830.md
Reglas: CERO modificaciones. Orden secuencial. Si falla, DETENTE. Reporta: ✅/❌ Paso N.
Al final: archivos tocados + "¿Hago commit?"
```

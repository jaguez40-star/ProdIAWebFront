# Plan MC-CHAT-V02 — Portar la máquina de preguntas V02 al panel «Chat» de MainChat

---

# 🛑 OBSOLETO — NO EJECUTAR (2026-08-21 05:10)

**Este plan quedó invalidado por la re-auditoría.** No lo ejecutes.

Entre las 05:03 y 05:08 otra sesión cargó **`multitab_shell.js` dentro de MainChat**
(`mainchat_layout.html:97`) y montó el shell completo en el panel Insights
(`acordeon.js:82-97`, `MultiTabShell.mount('consulta')`).

Consecuencia: **el chat V02 ya existe en `/mainchat`** — vive dentro del panel #3,
en `#rb-cp-panel-body`. Este plan crea una **segunda** copia del núcleo con los
mismos ids (`cn-messages`, `cn-input`, `cn-send-btn`) y los mismos globales
(`window.__v2Votar`, `window.__v2No`). Ejecutarlo produciría colisión de ids:
`getElementById` devuelve el primero y los dos chats se pelearían por el DOM.

El trabajo ya no es *portar* sino **reubicar**. Ver plan sucesor.

---

> **Versión:** v2 auditada (flujo profesional §15, pasos 1-3 aplicados) — **SUPERADA**
> **Fecha:** 2026-08-21
> **Modo:** Planner — el executor implementa, no decide.
> **Estado del código auditado:** `acordeon.js`, `acordeon.css` y `mainchat_layout.html` a fecha 2026-08-21 04:51-04:52.

---

## ⚠️ AVISO DE CONCURRENCIA — LEER ANTES DE EMPEZAR

Durante la auditoría se detectó que **otra sesión modificó MainChat a las 04:51-04:52 del 2026-08-21**:

| Archivo | Cambio detectado |
|---|---|
| `MainChat/static/js/acordeon.js` | +`guardarInsights()`/`restaurarInsights()`; el panel Insights recibe `id="charts-display-area"` |
| `MainChat/static/css/acordeon.css` | +`#charts-display-area.mc-cuerpo { display:block !important }` |
| `MainChat/templates/mainchat_layout.html` | +`<script src=".../charts.js">`; cache-bust subido a `?v=20260821e` |

**Acción obligatoria del executor antes del Paso 1:** confirmar que los números de línea de la §5 siguen coincidiendo. Si no coinciden, **DETENERSE** y reportar — el plan se re-audita, no se improvisa.

---

## 1. Contexto

**Proyecto:** ProdIA 2.0 — Flask + Jinja2 + JavaScript vanilla (sin build step, sin bundler, sin npm).
**Raíz absoluta:** `c:\APLICACIONES\ProdIA\ProdIA-2.0\`

### 1.1 Qué es la «máquina de preguntas V02»

Existen **dos** chats distintos en el repositorio. El que se porta es el segundo:

| | `static/js/chat.js` (legacy) | **`__cn*` en `static/js/multitab_shell.js` ← ESTE** |
|---|---|---|
| Transporte | Socket.IO | **fetch HTTP** |
| Endpoint | `send_message` / `new_message` | `POST /api/consulta2/preguntar` |
| Markup | `templates/components/chat.html` | `renderConsultaBody()` — string JS |
| IDs DOM | `chat-messages`, `message-input` | `cn-messages`, `cn-input`, `cn-send-btn` |
| Estado | servidor + sidebar | `__cnHistory` (memoria) + `__cnCid` |

`chat.js` **no se toca y no se carga** en MainChat. El propio `mainchat_layout.html:88-89` ya lo documenta: *«NO se carga chat.js: no hace falta y son 4.794 líneas de más»*.

### 1.2 Estado actual de MainChat

- Ruta `/mainchat` → `routes/mainchat.py:28`, blueprint `mainchat_bp` registrado en `app.py:85`.
- Acordeón de 3 paneles: **1 Historial · 2 Chat · 3 Insights**. Los tres cuerpos están vacíos salvo Insights, que ya está cableado a `charts.js`.
- `base.html` ya carga globalmente: Bootstrap 5.3, FontAwesome 6, Bootstrap Icons 1.11, **Plotly 2.26**, `style.css`, `enhanced-tables.css`.

### 1.3 Backend — CERO cambios

`routes/api.py:703-762` expone proxies **puros y sin estado** hacia `INGESTA_API_URL`. No guardan sesión ni identifican al llamante:

| Endpoint | Línea | Uso en este plan |
|---|---|---|
| `POST /api/consulta2/preguntar` | `api.py:722` | ✅ el chat |
| `POST /api/consulta2/veredicto` | `api.py:730` | ✅ votos ✓/✗ |
| `POST /api/consulta2/senal` | `api.py:746` | ❌ solo motor v1 |
| `POST /api/consulta/preguntar` | `api.py:703` | ❌ solo motor v1 |

`api_bp` va con `url_prefix="/api"` (`app.py:82`), global → las mismas URLs responden desde `/mainchat` sin tocar nada.

---

## 2. Objetivo

Que el panel **#2 «Chat»** del acordeón de `/mainchat` muestre el chat V02 funcional (motor v2), conservando el historial al expandir/colapsar paneles.

**Solo frontend. El backend no se modifica.**

---

## 3. Hallazgos de la auditoría (§15 pasos 1-3)

Estos 10 hallazgos corrigen la versión anterior del plan. Cada paso de la §6 ya los incorpora.

| # | Sev. | Hallazgo | Dónde se corrige |
|---|---|---|---|
| **H1** | 🔴 CRÍTICO | `.rb-cp` **no es solo un contenedor de variables**: `colapsable.css:108-121` le da `display:flex`, `flex:1 1 auto`, `height:100%`, `background`, `border:1px`, `border-radius:12px`, `box-shadow`, `overflow:hidden`. Aplicarla a `.mc-cuerpo` mete un borde y un radio **anidados** dentro de `.mc-panel` (que ya tiene los suyos, `acordeon.css:28-30`) y cambia el `flex-basis` de `0` a `auto`. | Paso 3 — override de especificidad 0,2,0 |
| **H2** | 🔴 CRÍTICO | **Orden de scripts.** `acordeon.js` es un IIFE que ejecuta `render()` en su última línea (`acordeon.js:254`). Si `consulta_v02.js` se carga *después*, en el primer render `window.ConsultaV02` no existe y **el chat no aparece hasta que el usuario toca un panel**. | Paso 2 — se carga ANTES de `acordeon.js` |
| **H3** | 🔴 CRÍTICO | Sesión paralela modificó 3 archivos de MainChat (ver aviso de concurrencia). Todos los números de línea del plan anterior quedaron obsoletos. | §5 re-auditada + check previo obligatorio |
| **H4** | 🟠 ALTO | **Ya existe patrón de casa** para el problema del remount: `guardarInsights()`/`restaurarInsights()` (`acordeon.js:55-79`), caché de `DocumentFragment` + `Plotly.Plots.resize()`. El plan anterior proponía `__cnReplay()`, divergiendo del vecino. | Paso 4 — se adopta el patrón de caché DOM |
| **H5** | 🟠 ALTO | **Colisión de pipelines en Insights.** El panel está cableado a `charts.js` / `window.AnalyticsManager`, alimentado por eventos `panel_3_update` de `chat.js`… que no se carga. El V02 emite `d.panel` para `__cnPintarPanelCuant` (renderer `cn-stack`), **incompatible** con el anterior. | Fuera de alcance §9 — decisión escalada |
| **H6** | 🟡 MEDIO | Cache-bust: la convención vigente es `?v=20260821e`. Tocar JS/CSS sin subirla deja a los usuarios con CSS viejo + JS nuevo. | Todos los pasos usan `?v=20260821f` |
| **H7** | 🟡 MEDIO | `#charts-display-area.mc-cuerpo { display:block !important }` (`acordeon.css:153-155`) bloqueará cualquier `display:flex` que el viewer V02 necesite en fase 4. | §9 — deuda documentada |
| **H8** | 🟡 MEDIO | **CLAUDE.md §17.5 R3 / DT-15:** «build verde ≠ feature verificada». El executor no tiene navegador; no puede declarar completada una feature visual. | §8 — validación partida en automática + humana |
| **H9** | 🟢 BAJO | **CLAUDE.md DT-16:** antes de eliminar código, grep de todos los call sites. El plan elimina la línea `4537` y el bloque `cn-motor`. | Paso 5 — greps obligatorios |
| **H10** | 🟢 BAJO | **CLAUDE.md §17.5 R2 / P2:** un plan con Plotly debe declarar que el `data` no depende de estado de UI interactivo. | §7 regla R-6 (aplica a fase 4) |

---

## 4. Prerequisitos

| # | Condición | Comando de verificación | Esperado |
|---|---|---|---|
| P1 | Estás en la raíz correcta | `ls c:/APLICACIONES/ProdIA/ProdIA-2.0/app.py` | el archivo existe |
| P2 | El origen de la copia existe | `wc -l c:/APLICACIONES/ProdIA/ProdIA-2.0/static/js/multitab_shell.js` | **5331** líneas |
| P3 | Los estilos origen existen | `wc -l c:/APLICACIONES/ProdIA/ProdIA-2.0/static/css/colapsable.css` | **2103** líneas |
| P4 | El acordeón no cambió otra vez | `grep -n "restaurarInsights();" MainChat/static/js/acordeon.js` | línea **239** |
| P5 | El template no cambió otra vez | `grep -n "acordeon.js" MainChat/templates/mainchat_layout.html` | línea **92** |
| P6 | Backend accesible (solo para validar) | `grep -n "consulta2/preguntar" routes/api.py` | línea **722** |

> **Si P2, P3, P4 o P5 no coinciden exactamente → DETENERSE y reportar.**

---

## 5. Inventario de archivos

| Archivo (ruta absoluta) | Acción | Alcance |
|---|---|---|
| `c:\APLICACIONES\ProdIA\ProdIA-2.0\MainChat\static\js\consulta_v02.js` | **CREAR** | ~300 líneas |
| `c:\APLICACIONES\ProdIA\ProdIA-2.0\MainChat\templates\mainchat_layout.html` | **MODIFICAR** | 3 ediciones |
| `c:\APLICACIONES\ProdIA\ProdIA-2.0\MainChat\static\js\acordeon.js` | **MODIFICAR** | 3 ediciones |
| `c:\APLICACIONES\ProdIA\ProdIA-2.0\MainChat\static\css\acordeon.css` | **MODIFICAR** | 1 bloque nuevo |
| `static\js\multitab_shell.js` | **SOLO LECTURA** | origen de la copia — prohibido editar |
| `static\css\colapsable.css` | **SOLO LECTURA** | se reutiliza tal cual |
| `static\js\chat.js`, `routes\*.py`, `app.py` | **NO TOCAR** | — |

---

## 6. Especificación — orden de ejecución estricto

### PASO 1 · Cargar `colapsable.css` en MainChat

**Archivo:** `MainChat\templates\mainchat_layout.html`
**Acción:** insertar **después** de la línea 11.

```html
    <!-- Estilos del chat V02: .rb-chat* (burbujas), .cn-answer* y .v2-* (motor v2).
         Se reutiliza la hoja del shell tal cual en vez de copiarla, para no
         duplicar la paleta. Auditado: colapsable.css NO redefine ninguna clase
         global (.panel, .btn, .app-footer, body) — todo va namespaced en
         .rb-* / .cn-* / .ig-* / .colapsable-*, así que no contamina MainChat. -->
    <link rel="stylesheet" href="{{ url_for('static', filename='css/colapsable.css') }}?v=20260821f">
```

> 🔴 `url_for('static', …)` — **NO** `url_for('mainchat.static', …)`. El archivo vive en `static/css/`, no en `MainChat/static/css/`.

---

### PASO 2 · Variables de usuario + carga del módulo

**Archivo:** `MainChat\templates\mainchat_layout.html`
**Acción:** reemplazar el bloque de las líneas **86-92** por:

```html
<!-- charts.js pinta el panel derecho (Insights): se autoprovee window.AnalyticsManager
     (charts.js, ~L2010, dentro de try/catch) y sus únicas referencias a ChatManager/app
     son de interacción, no de arranque. NO se carga chat.js: no hace falta y son 4.794
     líneas de más. -->
<script src="{{ url_for('static', filename='js/charts.js') }}?v=20260821f"></script>

<script>
    // Mismas variables que main.html:96-98. El chat V02 las lee para personalizar
    // el saludo y la inicial del avatar en las burbujas de usuario.
    window.USER_FIRST_NAME = {{ session.get('user', {}).get('first_name', '')|tojson }};
    window.USER_LAST_NAME  = {{ session.get('user', {}).get('last_name', '')|tojson }};
    window.USER_FULL_NAME  = {{ session.get('user', {}).get('full_name', '')|tojson }};
</script>

<script src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260821f"></script>

<!-- ANTES de acordeon.js, no después: acordeon.js es un IIFE que llama a render()
     en su última línea, y ese primer render ya consulta window.ConsultaV02 para
     montar el chat. Invertir el orden deja el panel #2 vacío hasta que el usuario
     toca un panel. -->
<script src="{{ url_for('mainchat.static', filename='js/consulta_v02.js') }}?v=20260821f"></script>
<script src="{{ url_for('mainchat.static', filename='js/acordeon.js') }}?v=20260821f"></script>
```

**Además:** en las líneas 10 y 11, cambiar `?v=20260821e` → `?v=20260821f` (H6).

---

### PASO 3 · CSS del cuerpo del panel de chat

**Archivo:** `MainChat\static\css\acordeon.css`
**Acción:** insertar **después** de la línea 155 (cierre de `#charts-display-area.mc-cuerpo`).

```css
/* ── Cuerpo del panel Chat (chat V02) ───────────────────────────────────── */

/* El chat V02 trae su propio scroller (.rb-chat) y su input al pie, así que este
   cuerpo debe ser solo la columna flex que los contiene: sin padding (el chat ya
   trae el suyo) y sin overflow (dos scrollers anidados despegarían el input).
   Equivale a los estilos inline de renderPanelBody() en multitab_shell.js:326-329.
   `display:flex` no es opcional: .rb-chat trae `flex:1;min-height:0`, inerte si el
   padre no es flex-column → el chat colapsaría o crecería sin tope. */
.mc-cuerpo--chat {
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
}

/* La clase .rb-cp se añade al cuerpo SOLO para heredar las variables --rb-*, que
   colapsable.css:83 declara ahí y no en :root — sin ellas las burbujas pierden
   todos sus colores. Pero .rb-cp arrastra además layout y decoración propios
   (colapsable.css:108-121): borde, radio de 12px y sombra que quedarían ANIDADOS
   dentro de .mc-panel, que ya tiene los suyos, y un flex-basis:auto que rompe el
   alto. Se neutraliza aquí con especificidad 0,2,0 — gana sobre .rb-cp (0,1,0)
   sin depender del orden de las hojas. */
.mc-cuerpo--chat.rb-cp {
    flex: 1;
    height: auto;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
    flex-direction: column;
}

/* style.css:907-917 está cargado globalmente (base.html:16) y ya alcanza a este
   input. Su `position:sticky; bottom:0` se anclaría al scroller equivocado; aquí
   el input es el último hijo de la columna flex, así que se ancla solo. El JS del
   V02 ya neutraliza inline min-height/padding/border-radius, pero NO el sticky. */
.mc-cuerpo--chat .chat-input-container {
    position: static;
    min-height: auto;
    flex: 0 0 auto;
}
```

---

### PASO 4 · Acordeón — montaje y preservación del chat

**Archivo:** `MainChat\static\js\acordeon.js`

#### 4.a — Caché del chat, simétrica a la de Insights

Insertar **después** de la línea 79 (cierre de `restaurarInsights`):

```js
    // Mismo patrón que guardarInsights()/restaurarInsights(): render() destruye el
    // DOM entero en cada expandir/colapsar, y el chat no puede perder la
    // conversación. Se cachea el DOM en vez de repintar desde __cnHistory (que es
    // lo que hace __cnReplay en el shell) porque así sobreviven también el scroll y
    // el texto a medio escribir en el input.
    var chatCache = null;

    function guardarChat() {
        var cuerpo = document.getElementById('mc-chat-body');
        if (cuerpo && cuerpo.firstChild) {
            var frag = chatCache || document.createDocumentFragment();
            while (cuerpo.firstChild) frag.appendChild(cuerpo.firstChild);
            chatCache = frag;
        }
    }

    function restaurarChat() {
        var cuerpo = document.getElementById('mc-chat-body');
        if (!cuerpo) return;            // Chat colapsado: se conserva la caché
        if (chatCache) {
            cuerpo.appendChild(chatCache);
            chatCache = null;           // solo se suelta si de verdad se restauró
            if (window.ConsultaV02 && typeof window.ConsultaV02.alRestaurar === 'function') {
                window.ConsultaV02.alRestaurar();
            }
            return;
        }
        // Primera apertura del panel: se construye el chat desde cero.
        if (window.ConsultaV02 && typeof window.ConsultaV02.montar === 'function') {
            window.ConsultaV02.montar(cuerpo);
        }
    }
```

#### 4.b — Marcar el cuerpo del panel Chat

Reemplazar las líneas **209-213** por:

```js
        var cuerpo = document.createElement('div');
        cuerpo.className = 'mc-cuerpo';
        if (seccion.id === 'insights') {
            cuerpo.id = 'charts-display-area';
        }
        // El panel de Chat hospeda el chat V02: necesita ser columna flex sin
        // padding ni overflow propios (ver .mc-cuerpo--chat en acordeon.css). La
        // clase rb-cp NO es decorativa — aporta las variables --rb-* que
        // colapsable.css declara en ese selector y no en :root.
        if (seccion.id === 'chat') {
            cuerpo.id = 'mc-chat-body';
            cuerpo.classList.add('mc-cuerpo--chat', 'rb-cp');
        }
```

#### 4.c — Enganchar guardar/restaurar en `render()`

En `render()`, reemplazar la línea **224** (`guardarInsights();`) por:

```js
        guardarInsights();
        guardarChat();
```

y la línea **239** (`restaurarInsights();`) por:

```js
        restaurarInsights();
        restaurarChat();
```

---

### PASO 5 · Crear `consulta_v02.js`

**Archivo a crear:** `c:\APLICACIONES\ProdIA\ProdIA-2.0\MainChat\static\js\consulta_v02.js`

#### 5.0 — Greps obligatorios previos (CLAUDE.md DT-16)

Antes de copiar nada, confirmar que los símbolos que se van a **omitir** no tienen otros usos dentro del rango copiado:

```bash
cd c:/APLICACIONES/ProdIA/ProdIA-2.0
grep -n "__tcCargarTabla\|__tcFiltroActual\|__tcHistory" static/js/multitab_shell.js
grep -n "__cnMotor\|__cnSetMotor" static/js/multitab_shell.js
grep -n "__cnSoloConsulta" static/js/multitab_shell.js
```

Resultado esperado: los `__tc*` solo aparecen en `4531-4537` y en el bloque Test Clas (`4574+`, **no se copia**); `__cnMotor` en `986, 988, 4416, 4465-4477`; `__cnSoloConsulta` en `38, 591, 983`. Si aparecen dentro de otros rangos a copiar → **DETENERSE**.

#### 5.1 — Estructura

IIFE `(function(){ "use strict"; … })()`, con esta cabecera literal:

```js
/**
 * Chat V02 (Motor de preguntas v2) para MainChat — panel #2 del acordeón.
 *
 * COPIA del núcleo conversacional de la pestaña «Consulta» de
 * static/js/multitab_shell.js (bloques __cn* y __v2*). Se copió en vez de
 * extraerse a un módulo compartido porque ese archivo tiene 611 referencias a
 * __cn repartidas en 5331 líneas dentro de un solo IIFE: extraerlas tocaría la
 * pantalla productiva `/`. Aquí solo vive la rama del MOTOR v2 (el default para
 * todos los usuarios); v1 y el viewer de análisis no se portaron.
 *
 * ⚠️ Si el chat de `/` cambia, este archivo NO se entera.
 * ⚠️ Nunca cargar este archivo junto a multitab_shell.js: ambos registran
 *    window.__v2Votar / window.__v2No sobre el mismo nombre global.
 *
 * Backend: sin cambios. Usa los proxies ya existentes de routes/api.py:722+.
 */
```

#### 5.2 — Bloques a copiar desde `static\js\multitab_shell.js`

Copiar **literal** salvo donde la columna «Cambios» indique lo contrario:

| # | Símbolo | Líneas origen | Cambios |
|---|---|---|---|
| 1 | `esc(t)`, `el(id)` | **29–33** | literal |
| 2 | `renderConsultaBody()` | **978–1001** | ver 5.3 |
| 3 | `__cnCid`, `__cnHistory` | **1002–1003** | literal |
| 4 | `__cnNombre`, `__cnConNombre` | **1034–1039** | literal |
| 5 | `__cnAppendRaw` … `__cnEnableLastOpts` | **4210–4263** | literal |
| 6 | `__cnSaludo()` | **4275** | literal (`return "Hola";`) |
| 7 | `__cnSaludoHtml()` | **4331–4363** | ver 5.4 |
| 8 | `__cnReplay()` | **4396–4405** | literal |
| 9 | `__cnPreguntar` (**solo rama v2**) | **4407–4427** + **4443** | ver 5.5 |
| 10 | Bloque v2 `__V2_GRUPO` … `__v2No` | **4456–4572** | ver 5.6 |
| 11 | Export público | — | ver 5.7 |

> El bloque 10 contiene `__cnMarcador` (**4486-4488**), requerido por `__cnRenderV2`. Copiar el rango completo lo cubre.

#### 5.3 — `renderConsultaBody()`

- **Eliminar** las líneas **983-990** (bloque `(__cnSoloConsulta() ? "" : '<div class="cn-motor">…')`). Sin motor v1 el selector no tiene sentido.
- **No copiar** `__cnSoloConsulta()` (38-42) ni `window.__cnSetMotor` (4471-4477).
- **Conservar literal** la línea **991** (`<div class="rb-chat" id="cn-messages" …>`) y las **992-1000** (`.chat-input-container` con `#cn-input` y `#cn-send-btn`).
- Los handlers inline (`onkeydown`, `onclick`) llaman a `window.__cnPreguntar()` — mantenerlos, el export del 5.7 los provee.

> 🔴 **No declarar `__cnMotor` ni leer `localStorage.cn_motor`.** El módulo llama a `/api/consulta2/preguntar` incondicionalmente. Motivo: un usuario con `cn_motor="v1"` heredado de `/` quedaría atrapado en un motor que este módulo no implementa.

#### 5.4 — `__cnSaludoHtml()`

**No copiar:** `__cnSaludoPanorama` (4283-4329), `__cnSaludoRefresh` (4366-4373), `__cnSaludoDesdeDesemp` (4375-4387), `__cnSaludoDesdeEjec` (4389-4394) ni las variables `__cnSalDes/__cnSalP50/__cnSalEje/__cnSalP50Pedido` (4273).

**Motivo:** esas tres fuentes solo se llenan desde el viewer (`__cnAnalizar` @1619, `__cnAnalisisEjecutivo` @2358), que no se porta. Sin ellas el original cae al fallback de las líneas 4351-4352, que dice *«A la derecha tienes el desempeño del mes…»* — **falso en MainChat**, donde Insights está vacío.

Escribir en su lugar:

```js
  function __cnSaludoHtml() {
    var n = __cnNombre();
    var saludo = __cnSaludo() + (n ? " " + esc(n) : "") + ", bienvenido.";
    // A diferencia del shell, aquí NO se promete un panorama en el panel derecho:
    // el viewer (Insights) todavía no está portado a MainChat.
    var cuerpo = "Pregúntame sobre la producción de crudo, gas y blancos.";
    return saludo + " " + cuerpo +
      '<br><br>¿Quieres profundizar en algún tema específico?' +
      // ↓↓↓ líneas 4355-4362 del original, COPIADAS LITERALES ↓↓↓
      '<br>• <strong>Estructura</strong> — …' +
      '<br>• <strong>Cifras</strong> — …' +
      '<br>• <strong>Análisis</strong> — …' +
      '<br><br>Pregúntame en lenguaje natural, ¿por dónde arrancamos?';
  }
```

#### 5.5 — `__cnPreguntar`

Copiar **4407-4427** y **4443**. **Omitir 4428-4442** (rama v1 + señal P2).

Sustituir la línea **4423**:

```js
          if (d.panel) __cnPintarPanelCuant(d.panel, texto);   // 1d: panel derecho (SOLO Consulta)
```

por:

```js
          // El viewer de Insights aún no está portado: la carga útil se descarta a
          // propósito en vez de encolarse. Punto de enganche único para la fase 4.
          if (d.panel && typeof API._onPanel === "function") API._onPanel(d.panel, texto);
```

#### 5.6 — Bloque v2 (4456-4572)

1. **No copiar** `__cnMotor` (4465-4468) ni `window.__cnSetMotor` (4471-4477).
2. En `__v2MarcarVotado` (4525-4538): **eliminar la línea 4537** (`if (el("tc-tabla")) __tcCargarTabla(__tcFiltroActual);`). `#tc-tabla` no existe en MainChat y daría `ReferenceError`.
3. En la misma función, de la reescritura doble de historiales (4531-4534) **conservar solo la de `__cnHistory`**; eliminar la de `__tcHistory`.

#### 5.7 — Export público

```js
  var API = {
    // Construye el chat dentro de `cont`. Idempotente y tolerante a null (el
    // panel #2 puede estar colapsado). __cnReplay siembra el saludo la primera
    // vez y repinta el historial si ya lo hubiera.
    montar: function (cont) {
      if (!cont) return;
      if (!el("cn-messages")) cont.innerHTML = renderConsultaBody();
      __cnReplay();
    },
    // Llamado por acordeon.js tras devolver el DOM cacheado al panel. El DOM
    // vuelve intacto, así que no se repinta: solo se recupera el scroll al fondo,
    // que se pierde al reinsertar los nodos.
    alRestaurar: function () {
      var m = el("cn-messages");
      if (m) m.scrollTop = m.scrollHeight;
    },
    // Fase 4: asignar para recibir los paneles cuantitativos del motor v2.
    _onPanel: null
  };

  window.ConsultaV02 = API;
```

---

## 7. Reglas no negociables

| # | Regla |
|---|---|
| **R-1** | **Prohibido editar** `static/js/multitab_shell.js`, `static/js/chat.js`, `static/css/colapsable.css`, `static/css/style.css`, `routes/*.py`, `app.py`. Son solo lectura. |
| **R-2** | **Prohibido cargar `multitab_shell.js` en MainChat.** Colisionaría en `window.__v2Votar` / `window.__v2No` y en los ids `cn-*`. |
| **R-3** | **Orden secuencial estricto.** Los pasos 1→5 en ese orden. Si un paso falla, **DETENERSE** y reportar; no improvisar un arreglo. |
| **R-4** | **Cero refactors de oportunidad.** No renombrar, no «limpiar» código vecino, no reordenar imports. Solo lo especificado. |
| **R-5** | **Cache-bust `?v=20260821f` en TODOS los assets tocados**, sin excepción. Mezclar versiones deja CSS viejo con JS nuevo. |
| **R-6** | *(fase 4, no aplica hoy)* Con Plotly: el trace **nunca** se reconstruye por hover/selección — solo por datos. Ver CLAUDE.md §17.5 R2 / DT-14. |
| **R-7** | El executor **no declara «completado»** una feature visual. Ver §8. |

---

## 8. Validaciones

### 8.a — Automáticas (las ejecuta el executor)

| # | Comando | Resultado esperado |
|---|---|---|
| V1 | `ls MainChat/static/js/consulta_v02.js` | existe |
| V2 | `node --check MainChat/static/js/consulta_v02.js` | exit 0, sin salida |
| V3 | `node --check MainChat/static/js/acordeon.js` | exit 0, sin salida |
| V4 | `grep -c "consulta_v02.js" MainChat/templates/mainchat_layout.html` | `1` |
| V5 | `grep -n "consulta_v02.js\|acordeon.js" MainChat/templates/mainchat_layout.html` | consulta_v02 en línea **menor** que acordeon |
| V6 | `grep -c "20260821e" MainChat/templates/mainchat_layout.html` | `0` (todo migrado a `f`) |
| V7 | `grep -n "mc-chat-body" MainChat/static/js/acordeon.js` | 3 coincidencias (guardar, restaurar, panelAbierto) |
| V8 | `grep -c "__tcCargarTabla\|__tcHistory\|__cnSetMotor\|localStorage" MainChat/static/js/consulta_v02.js` | `0` |
| V9 | `grep -c "consulta/preguntar\|consulta/responder" MainChat/static/js/consulta_v02.js` | `0` (solo v2) |
| V10 | `grep -c "consulta2/preguntar" MainChat/static/js/consulta_v02.js` | `1` |
| V11 | `git diff --stat` *(o mtime)* sobre `static/js/multitab_shell.js`, `static/js/chat.js`, `routes/` | **sin cambios** |

> `node --check` solo valida sintaxis. Si Node no está disponible, reportarlo como ⏳ en vez de ✅.

### 8.b — Validación humana en navegador — 🔴 OBLIGATORIA

**CLAUDE.md §17.5 R3 / DT-15:** «build verde + lint verde ≠ feature verificada». El executor no tiene navegador y **no puede** marcar esto. Su reporte debe cerrar con *«Validación visual humana ⏳ PENDIENTE»*.

Checklist para la persona, con el backend arriba (`INGESTA_API_URL` accesible) y sesión iniciada:

| # | Prueba | Criterio de aceptación |
|---|---|---|
| H1 | Abrir `/mainchat` | El panel #2 muestra el chat con burbuja de saludo y el nombre del usuario |
| H2 | Inspeccionar colores | Fondo del chat `#f6f9fb`, burbuja del bot blanca con borde → confirma que `.rb-cp` resolvió las variables |
| H3 | Inspeccionar bordes | **Un solo** borde redondeado (el de `.mc-panel`). Si se ven dos anidados → el override de H1 falló |
| H4 | Escribir «¿Cuánto crudo produjo Rubiales?» + Enter | Burbuja de usuario a la derecha; indicador «Entendiendo tu pregunta…» y a ~900 ms «Consultando con la IA…» |
| H5 | F12 → Network | `POST /api/consulta2/preguntar` → **200**, payload `{texto, conversation_id:"cn-…", usuario}` |
| H6 | Respuesta | Burbuja del bot con badge «Motor v2» y chip de grupo coloreado |
| H7 | Clic en ✓ | `POST /api/consulta2/veredicto` → 200; la franja se reemplaza por el acuse |
| H8 | Clic en ✗ | Aparecen los chips de corrección |
| H9 | **Colapsar el panel #2 y reexpandirlo** | Toda la conversación reaparece, **y también el texto a medio escribir en el input** |
| H10 | Scroll | Una sola barra de scroll; el input queda pegado abajo |
| H11 | Redimensionar 1000 px ↔ ancho completo | Sin scroll horizontal en el body |
| H12 | Abrir Insights junto al chat | Insights sigue funcionando; los gráficos ya pintados no se pierden |
| H13 | **Sin regresión en `/`** | Ir a `/` → Consulta → preguntar: idéntico a antes |
| H14 | F12 → Console en ambas rutas | 0 errores, 0 warnings |

---

## 9. Fuera de alcance

| Tema | Estado |
|---|---|
| **Panel #3 «Insights» alimentado por el chat V02** | 🔴 **Decisión escalada (H5).** Hoy Insights está cableado a `charts.js`/`AnalyticsManager`, cuyo productor natural es `chat.js` — que MainChat no carga. El V02 emite `d.panel` para `__cnPintarPanelCuant` (renderer `cn-stack`), **incompatible** con ese pipeline. Hay que elegir uno antes de la fase 4. Enganche ya listo: `ConsultaV02._onPanel`. |
| Deuda: `!important` en Insights | `acordeon.css:153-155` fuerza `display:block !important`. Si el viewer V02 necesita flex ahí, habrá que revisarlo (H7). |
| Deuda: doble copia del núcleo | `consulta_v02.js` y `multitab_shell.js` divergirán. Unificar en `static/js/consulta_core.js` cuando el port esté validado. |
| Panel #1 «Historial» | No se toca. |
| Motor v1 y desambiguación por botones | No se porta (~347 líneas y arrastra todo el viewer). |
| `__cnPrewarmGlobal()` | Sin viewer no aporta nada visible. |
| Backend | **Cero cambios.** |

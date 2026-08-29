# Plan MC-CHAT-V03 — Reubicar el chat del shell al panel «Chat» de MainChat

> **Versión:** v2 auditada — pasos 1-3 del flujo de 6 (Mapeo → Auditoría → Diagnóstico)
> aplicados contra el código real, no desde memoria (`ProdIA_V02/CLAUDE.md` §0).
> **Fecha:** 2026-08-21
> **Modo:** Planner. El executor implementa, no decide.
> **Sucesor de** `plan_MC-CHAT-V02_20260821.md`, que se declaró obsoleto a sí mismo
> (líneas 5-21) al detectar que el chat V02 **ya existe** en `/mainchat`. Su conclusión
> — *«el trabajo ya no es portar sino reubicar»* — es el objetivo de este documento.

---

## 0. Marco normativo — leer antes que nada

### 0.1 🔴 Qué CLAUDE.md gobierna esto, y cuál no

**El único `CLAUDE.md` del workspace es `c:/APLICACIONES/ProdIA_V02/CLAUDE.md`**
(392 líneas, secciones §0-§11, deuda DT-1…DT-6). Verificado:

```
find c:/APLICACIONES -maxdepth 4 -iname "CLAUDE.md"   → solo ./ProdIA_V02/CLAUDE.md
```

- `ProdIA-2.0` (este proyecto, Flask) **no tiene CLAUDE.md**.
- `robustez-v02` **tampoco**.

Ese documento gobierna **otro proyecto** (React 19 + monorepo pnpm/uv). Sus reglas se
aplican aquí **por analogía y por decisión explícita del usuario**, no por autoridad
sobre este repositorio. Donde una regla dependa del stack (pnpm, vitest, ESLint) **no
aplica**; donde sea de método (planner, verificación, R3) **sí**.

### 0.2 🔴 Citas normativas del plan predecesor: no verificables

`plan_MC-CHAT-V02` cita `CLAUDE.md §15`, `§17.5 R2/R3`, `DT-14`, `DT-15` y `DT-16`.
**Ninguna existe.** Corrección de anclas:

| Cita del predecesor | Realidad verificada | Ancla correcta |
|---|---|---|
| «flujo profesional §15, pasos 1-3» | No hay §15. El flujo de 6 pasos (Mapeo → Auditoría → Diagnóstico → Propuesta → Aplicación → Verificación) está en **§0** | `ProdIA_V02/CLAUDE.md` §0, viñeta «Flujo de 6 pasos» |
| «§17.5 R3 / DT-15: build verde ≠ feature verificada» | No hay §17.5 ni DT-15. La regla existe y es literal | `ProdIA_V02/CLAUDE.md` §0, **R3** |
| «§17.5 R2 / DT-14: Plotly y estado de hover» | No hay DT-14. La regla existe en §0 **R2**, que a su vez remite a un «CLAUDE.md de Robustez V02 §17.5» **ausente del workspace** | `ProdIA_V02/CLAUDE.md` §0, **R2** (con la remisión rota documentada) |
| «DT-16: grep de call sites antes de eliminar código» | **No existe en ningún documento.** | Se elimina la cita. La práctica es sana → se conserva como **R-9** propia de este plan |

> Consecuencia de método: **ninguna regla de este plan se justifica citando un
> documento sin verificar la cita.** El executor puede exigir el ancla.

### 0.3 🟠 Qué pipelines existen realmente en ProdIA-2.0

Verificado: **ninguno.** Sin `.github/workflows`, sin `.pre-commit-config.yaml`, sin
hooks en `.git/hooks`, sin `package.json`, sin suite de tests.

Esto **cambia la naturaleza del riesgo**: no hay CI que pueda ponerse en rojo. El único
peligro real es la **regresión silenciosa en `/`**, que ningún automatismo detectaría.
Por eso V2 de §8.a (diff vacío sobre archivos compartidos) no es una formalidad: es la
**única barrera automática que existe**.

Las deudas DT-5/DT-6 de `ProdIA_V02/CLAUDE.md` §9 son de su CI y **no aplican aquí**.

### 0.4 🟠 Coherencia estratégica — se declara, no se decide aquí

`ProdIA_V02/CLAUDE.md` §10 sitúa **F4 = Consulta, Motor Q v2 completo + panel apilable**
como fase pendiente del proyecto nuevo, y §11 registra que **F1a ya construyó los mismos
3 paneles Historial/Chat/Insights** en React. Es decir: existen **dos implementaciones
paralelas** del mismo cascarón, y este plan invierte en la de Flask, que el usuario
describió como *«una primera versión que estamos desechando»*.

Se deja constancia porque es una incoherencia real de portafolio. **No bloquea**: el
usuario ha reafirmado esta dirección de forma explícita y repetida. Decisión suya.

---

## 1. Contexto

**Proyecto:** ProdIA 2.0 — Flask + Jinja2 + JavaScript vanilla. Sin build step, sin
bundler, sin npm. Raíz: `c:\APLICACIONES\ProdIA\ProdIA-2.0\`.

**Estado de MainChat:** ruta `/mainchat` (`routes/mainchat.py`, blueprint registrado en
`app.py`). Acordeón de 3 paneles — **1 Historial · 2 Chat · 3 Insights**. Historial y
Chat están vacíos; Insights hospeda el shell completo de `multitab_shell.js` montado en
la pestaña Consulta, con el riel y el panel de chat del propio shell ocultos por CSS.

**Lo que pidió el usuario** (marcado en verde sobre su captura):

| Elemento | Selector |
|---|---|
| Hilo de mensajes | `#cn-messages` (`.rb-chat`) |
| Caja de escritura | `.chat-input-container` con `#cn-input` / `#cn-send-btn` |

Marcado en rojo, **excluido**: el multitab vertical (`.rb-cp__rail`), ya oculto.

### 1.1 Decisiones pendientes del usuario — BLOQUEAN el Paso 4

| # | Elemento | Lectura del planner | Estado |
|---|---|---|---|
| D1 | `.rb-cp__panel-head` — barra `← CONSULTA · PRODIA · −` | **Ocultar.** El acordeón ya aporta cabecera y botón de colapsar; sería una segunda cabecera anidada. Mismo criterio con el que se ocultó `.rb-cp-vhead` en Insights. | ⏳ |
| D2 | `.cn-motor` — chips `MOTOR v1 / v2` | El trazo verde empieza justo debajo. **No es cosmético:** decide con qué motor se responde. | ⏳ |
| D3 | N8 — salida A o B (§9) | Ninguna es gratis: A degrada, B rompe R-1. | ⏳ |

> Si D1/D2/D3 no están confirmadas al llegar al Paso 4 → **DETENERSE** y preguntar.

---

## 2. Objetivo

Que el panel **#2 «Chat»** muestre el chat del shell (hilo + caja de escritura) y el
panel **#3 «Insights»** conserve el análisis gráfico, **con una sola instancia del
shell**, sin tocar `multitab_shell.js` ni el backend, y sin perder el estado al
expandir o colapsar paneles.

**Solo frontend de MainChat.**

### 2.1 Lo que se gana al reubicar: el análisis gráfico por tipo de pregunta

Es la diferencia funcional más importante entre los dos enfoques, y **no es un extra a
construir: ya funciona y este plan lo conserva.**

El motor v2 clasifica cada pregunta en un **grupo** (`__V2_GRUPO` — el chip coloreado de
la respuesta) y devuelve un `d.panel`. `__cnPintarPanelCuant()` despacha por
`panel.tipo` a un renderer **ya prediseñado** y apila el bloque en `#cn-stack`, que vive
**dentro del viewer** (panel derecho):

| `panel.tipo` | Renderer |
|---|---|
| `cuant_serie` | serie temporal (`__cnCuantSerieHtml`) |
| `cuant_var` | variación (`__cnCuantVarHtml`) |
| `cuant_rank` | ranking — dot plot si `metrica==="real"`, lista si es `gap` |
| `jerarq_arbol` · `jerarq_operador` · `jerarq_rank` | jerarquías (`__cnJer*Html`) |
| `p50_vp` | serie mensual P50 vs REAL de una vicepresidencia |
| `analiza_foco` | acordeón causal con Plotly (fetch propio, **asíncrono**) |
| *(no reconocido)* | tarjeta KPI de fallback (`__cnCuantCardHtml`) |

**Se hereda gratis** porque se conserva una única instancia del shell y todo direcciona
por id. `__cnStackEnsure()` localiza su destino con
`document.querySelector("#cn-viewer-area .cn-shell")` — consulta a nivel de documento,
indiferente a dónde viva el nodo.

> El plan predecesor **descartaba** esta funcionalidad: dejaba `_onPanel: null` y la
> mandaba a su §9 como «decisión escalada», porque al copiar solo el núcleo
> conversacional se quedaba sin viewer donde pintar.

**El port no está completo si el panel derecho no reacciona a las preguntas.** De ahí
B5b/B5c/B5d en §8.b, y de ahí que N8 sea 🔴.

### 2.2 Por qué no se resuelve con CSS

Los dos ajustes anteriores (ocultar `.rb-cp__rail` / `.rb-cp__panel`, ocultar
`.rb-cp-vhead`) fueron CSS puro. Este no puede serlo: **CSS oculta, no reubica.**

### 2.3 Por qué no se resuelve copiando el núcleo

`plan_MC-CHAT-V02` creaba `consulta_v02.js` con ~300 líneas copiadas. Con
`multitab_shell.js` ya cargado, esa copia registra **los mismos ids** (`cn-messages`,
`cn-input`, `cn-send-btn`) y **los mismos globales** (`window.__v2Votar`,
`window.__v2No`): `getElementById` devuelve el primero y los dos chats se pelean por el
DOM.

---

## 3. Prerequisitos verificables

Anclas por `grep -c` **contra el código real, nunca por número de línea ni por hash de
commit** (`ProdIA_V02/CLAUDE.md` §0, «Formato de plan de fase»).

> **Por qué importa:** la v1 de este plan anclaba en `git log -1 → 809e505` y en números
> de línea de `acordeon.js`. Entre su redacción y esta auditoría **esos números ya se
> habían movido** (el bloque de `Plotly.Plots.resize` pasó de 70-78 a 75-81, `mount()`
> de 82-97 a 87-102, `raiz.innerHTML=''` de 249 a 270). El plan se habría detenido solo.

| # | Comando | Esperado |
|---|---|---|
| P1 | `grep -c 'class="rb-cp" id="rb-cp"' static/js/multitab_shell.js` | `1` |
| P2 | `grep -c 'id="rb-cp-panel"' static/js/multitab_shell.js` | `1` |
| P3 | `grep -c 'id="rb-cp-viewer"' static/js/multitab_shell.js` | `1` |
| P4 | `grep -c 'id="rb-cp-panel-body"' static/js/multitab_shell.js` | `1` |
| P5 | `grep -c "^\.rb-cp {" static/css/colapsable.css` | `1` (allí viven las `--rb-*`) |
| P6 | `grep -c "width: 581px" static/css/colapsable.css` | `1` (N5) |
| P7 | `grep -c "position: sticky" static/css/style.css` | `≥1` (N6, en `.chat-input-container`) |
| P8 | `grep -c "data-pend-paint" static/js/multitab_shell.js` | `2` (encolar + vaciar → N8) |
| P9 | `grep -c "__cnPaintFocoStk" static/js/multitab_shell.js` | `≥2`, y **`0`** en la línea de `window.MultiTabShell =` → confirma que **no está exportado** |
| P10 | `grep -c "MultiTabShell.mount" MainChat/static/js/acordeon.js` | `1` (R-2: una sola instancia) |
| P11 | `grep -c "20260821k" MainChat/templates/mainchat_layout.html` | `6` (punto de partida del cache-bust) |
| P12 | `grep -c "consulta2/preguntar" routes/api.py` | `1` (backend intacto, solo lectura) |

> **Si P1-P5, P9 o P10 no coinciden → DETENERSE y reportar.** El plan se re-audita, no
> se improvisa.

---

## 4. Inventario de archivos

| Archivo | Acción |
|---|---|
| `MainChat/static/js/acordeon.js` | **MODIFICAR** — host, montaje único, reparto, preservación de dos zonas |
| `MainChat/static/css/acordeon.css` | **MODIFICAR** — cuerpos receptores, neutralización de `.rb-cp`, N5, N6 |
| `MainChat/templates/mainchat_layout.html` | **MODIFICAR** — solo cache-bust |
| `static/js/multitab_shell.js` · `static/css/colapsable.css` · `static/css/style.css` · `templates/base.html` | **SOLO LECTURA** |
| `routes/*.py` · `app.py` · `static/js/chat.js` | **NO TOCAR** |

---

## 5. Hallazgos

### 5.1 Heredados del predecesor — vigentes, con el ancla corregida

| # | Sev. | Hallazgo | Se aplica en |
|---|---|---|---|
| **H1** | 🔴 | **Las `--rb-*` se declaran en `.rb-cp`, no en `:root`** (P5). El shell envuelve sus 3 zonas en `<div class="rb-cp" id="rb-cp">` (P1). Sacar una zona de ese envoltorio le quita **toda la paleta**. Y `.rb-cp` arrastra layout y decoración propios (`display:flex`, `flex:1 1 auto`, `height:100%`, `border`, `border-radius:12px`, `box-shadow`, `overflow:hidden`) que quedarían **anidados** dentro de `.mc-panel`, que ya tiene los suyos. | Paso 4 |
| **H2** | 🔴 | `acordeon.js` es un IIFE que llama a `render()` en su última línea. Toda dependencia suya se carga **antes**. | Ya se cumple: `multitab_shell.js` precede a `acordeon.js` en la plantilla |
| **H6** | 🟡 | Cache-bust en **todos** los assets tocados. | R-6 |
| **H8** | 🟡 | «Build verde ≠ feature verificada» — **`ProdIA_V02/CLAUDE.md` §0 R3**, no «§17.5/DT-15». | §8.b |
| **H9** | 🟢 | Grep de call sites antes de eliminar o mover. **La cita «DT-16» no existe** → se conserva como regla propia R-9. | Paso 1 |

### 5.2 Propios del enfoque de reubicar

| # | Sev. | Hallazgo | Se aplica en |
|---|---|---|---|
| **N1** | 🔴 | **H1 es simétrico.** Al repartir, el `viewer` pierde las variables igual que el `panel`. Hoy no se nota porque el esqueleto entero vive en `#mc-insights-cuerpo`. | Paso 4 — la clase `rb-cp` va en **los dos** cuerpos |
| **N2** | 🔴 | **¿Dónde vive el esqueleto si Insights está colapsado?** Hoy `mount()` se dispara desde `restaurarInsights()`: el chat solo existiría si el usuario abre el panel #3. | Paso 2 — host permanente |
| **N3** | 🟠 | El acordeón **destruye el DOM** en cada expandir/colapsar (`raiz.innerHTML=''`). Hoy se preserva **un** nodo; pasan a ser **dos**, y cada uno debe volver a su panel — o al host si su panel está colapsado. | Paso 5 |
| **N4** | 🟠 | **El saludo del chat lo produce el análisis.** `__cnSaludoDesdeDesemp(d)` se dispara desde `__cnAnalizar(null)`. El panel #2 se llena gracias a un fetch que pertenece al #3. | §9 — deuda |
| **N5** | 🟡 | `.rb-cp__panel` trae `width: 581px; flex: 0 0 auto` (P6): dentro del panel Chat se quedaría clavado en 581 px. | Paso 4 |
| **N6** | 🟡 | `.chat-input-container` tiene `position:sticky; bottom:0; min-height:80px` (P7, global vía `base.html`). El sticky se ancla al scroller equivocado. | Paso 4 |
| **N7** | 🟢 | `unmount()` vacía `#multitab-shell-container`. Con las zonas fuera, dejaría huérfanos. MainChat nunca desmonta. | §9 — deuda |
| **N8** | 🔴 | **La cola `data-pend-paint` se queda sin quien la vacíe.** Con el viewer sin dimensiones, un bloque `analiza_foco` se encola marcado; ese pendiente **solo se vacía dentro de `renderViewer()`** (P8) — y con el riel oculto `renderViewer()` no vuelve a ejecutarse tras el mount. El gráfico quedaría sin pintar de forma permanente. `__cnPaintFocoStk` **no está exportado** (P9). | Paso 5 + §9 (D3) |

### 5.3 🔴 Nuevos — detectados en esta auditoría

| # | Sev. | Hallazgo | Se aplica en |
|---|---|---|---|
| **N9** | 🔴 | **Móvil rompe el diseño entero.** `maxAbiertos()` devuelve **1** bajo 1023 px. Con un solo panel abierto, **una de las dos zonas está siempre en el host**: si el usuario tiene Chat abierto, el análisis no existe visualmente y **N8 se dispara en cada pregunta causal**, no como caso raro sino como estado normal. El estado inicial `['insights','chat']` se recorta a `['chat']`. Ninguna prueba del plan v1 cubría móvil. | Paso 5 + B14/B15 |
| **N10** | 🔴 | **Falta `padding: 0` en los cuerpos receptores.** `.mc-cuerpo` aplica `padding: 16px` y `overflow: auto`. La regla `.mc-cuerpo--rb.rb-cp` de la v1 neutralizaba el overflow pero **no el padding** → 16 px de aire parásito dentro del chat y del viewer, y el input despegado del borde. El plan predecesor sí lo contemplaba; se perdió al reformular. | Paso 4 |
| **N11** | 🟡 | **El host con atributo `hidden` es frágil.** `[hidden]` aplica `display:none` desde la hoja del navegador, con especificidad mínima: cualquier `display` de autor que alcance ese nodo lo anula en silencio. | Paso 2 — regla CSS explícita |
| **N12** | 🟡 | **La salida A de N8, tal como estaba escrita, no funciona.** Un `position:absolute; left:-99999px` **sin `width`/`height` explícitos colapsa a 0×0** — Plotly seguiría sin poder medir, que es justo lo que se pretendía evitar. Y necesita un contenedor con `position: relative`. | §9 |
| **N13** | 🟢 | El ancla del footer del plan v1 (`multitab_shell.js:546-548`) **es incorrecta**: `querySelector(".app-footer")` está en **535** (guardado) y **657** (restauración). Corregido a ancla por `grep`. | Paso 3 |

### 5.4 Hallazgos del predecesor que quedaron sin objeto

| # | Estado |
|---|---|
| **H3** (concurrencia) | Consumido: este plan re-audita contra el código actual |
| **H4** (adoptar `guardarInsights`/`restaurarInsights`) | Ya es el patrón vigente; se extiende a dos zonas |
| **H5** (colisión `charts.js` / `AnalyticsManager`) | **Sin objeto.** El «Desempeño del mes» lo pinta el shell en su `cn-canvas`; `charts.js` no se carga en MainChat |
| **H7** (`!important` sobre `#charts-display-area.mc-cuerpo`) | **Sin objeto.** Regla e id retirados con la hipótesis de `charts.js` |
| **H10 / R-6 del predecesor** (Plotly y estado de hover) | No aplica: este plan no crea trazas, solo mueve nodos ya pintados. La regla real es **§0 R2** |

### 5.5 Oportunidad detectada

| # | Oportunidad |
|---|---|
| **O1** | `window.MultiTabShell` ya exporta **`prewarm`** (`__cnPrewarmGlobal`). Es un camino legítimo — **sin editar el archivo compartido** — para precalentar el desempeño global y, de paso, atacar N4 (el saludo que hoy depende del fetch del análisis). **Fuera de alcance de este plan**; se registra para una fase posterior. |

---

## 6. Reglas no negociables

| # | Regla |
|---|---|
| **R-1** | **Prohibido editar** `static/js/multitab_shell.js`, `static/js/chat.js`, `static/css/colapsable.css`, `static/css/style.css`, `templates/base.html`, `templates/main.html`. Son compartidos con `/`. |
| **R-2** | **Una sola instancia del shell.** Prohibido copiar el núcleo `__cn*` a otro archivo (es lo que mató al plan predecesor). |
| **R-3** | **Backend intacto.** Restricción explícita del usuario: *«Solo sería a nivel de front, el back funcionaría como está hasta ahora»*. |
| **R-4** | **Orden secuencial estricto** 1→6. Si un paso falla, **DETENERSE** y reportar; no improvisar. |
| **R-5** | **Cero refactors de oportunidad.** O1 no se ejecuta en este plan. |
| **R-6** | **Cache-bust `?v=20260821m` en todos los assets tocados.** Se salta la letra `l` a propósito: se confunde con `1` en la URL. |
| **R-7** | El executor **no declara «completado»** una feature visual (§0 **R3** de `ProdIA_V02/CLAUDE.md`). Su reporte cierra con *«Validación visual humana ⏳ PENDIENTE»*. |
| **R-8** | **D1, D2 y D3 confirmadas antes del Paso 4.** |
| **R-9** | **Grep de call sites antes de mover o eliminar cualquier símbolo.** Regla propia de este plan — la «DT-16» que citaba el predecesor no existe en ningún documento. |
| **R-10** | **Ninguna regla se justifica citando un documento sin verificar la cita.** Ver §0.2. |

---

## 7. Especificación

### PASO 1 · Verificación previa (R-9)

Ejecutar P1-P12 de §3. Si P1-P5, P9 o P10 fallan → **DETENERSE**.

Confirmar además que los únicos puntos donde el shell consulta su contenedor raíz son
el mount y el unmount, ambos por `getElementById`:

```bash
grep -n "multitab-shell-container" static/js/multitab_shell.js    # esperado: 2 resultados
```

Todo lo demás direcciona por id global — **eso es lo que hace segura la reubicación**.

---

### PASO 2 · Host permanente (N2, N11)

**Archivo:** `MainChat/static/js/acordeon.js` + `acordeon.css`

Crear al inicializar el módulo un `<div id="mc-shell-host">` anexado a `.mc-shell`,
**fuera** de `#mainchat-root` (que es lo que `render()` arrasa). Dentro vive
`#multitab-shell-container`.

Ocultarlo con **regla CSS explícita**, no con el atributo `hidden` (N11):

```css
#mc-shell-host { display: none; }
```

> Razón del host: desacopla el montaje de qué panel esté abierto. El esqueleto
> (`#rb-cp` con el riel oculto) se queda ahí para siempre; solo viajan las dos zonas.

---

### PASO 3 · Montaje único y reparto (N13)

**Archivo:** `MainChat/static/js/acordeon.js`

Orden de arranque **explícito y no negociable**:

```
crear host  →  montarShellUnaVez()  →  render()  →  repartir()
```

1. **`montarShellUnaVez()`** — `MultiTabShell.mount('consulta')`, una sola vez, con el
   host **ya anexado al documento**. `mount()` usa `getElementById` internamente: con el
   contenedor desconectado esas búsquedas fallan **en silencio** — es el bug de secuencia
   que ya se corrigió una vez en este mismo archivo.
2. **Restaurar el footer** inmediatamente después. `mount()` guarda y oculta el
   resultado de `document.querySelector(".app-footer")` — **cualquiera** del documento,
   incluido el de MainChat. Lógica ya presente en `acordeon.js`, se conserva.
   > Ancla correcta: `grep -n 'querySelector(".app-footer")' static/js/multitab_shell.js`
   > → **535** (guardado) y **657** (restauración). El plan v1 citaba 546-548: **erróneo**.
3. **`repartir()`** tras cada `render()`:
   - `#rb-cp-panel` → `#mc-chat-body` si el panel #2 está abierto; si no, al host.
   - `#rb-cp-viewer` → `#mc-insights-cuerpo` si el #3 está abierto; si no, al host.

`renderPanelBody()` y `renderViewer()` escriben por id, así que siguen funcionando estén
donde estén los nodos.

---

### PASO 4 · CSS de los cuerpos receptores (H1, N1, N5, N6, N10)

**Archivo:** `MainChat/static/css/acordeon.css`

**4.a — Variables sin decoración ni padding (H1 + N1 + N10).** Los **dos** cuerpos
receptores llevan la clase `rb-cp` únicamente para heredar las `--rb-*`, con layout,
decoración **y el padding de `.mc-cuerpo`** neutralizados a especificidad `0,2,0` — gana
sobre `.rb-cp` (`0,1,0`) sin depender del orden de las hojas ni de `!important`:

```css
.mc-cuerpo--rb.rb-cp {
    display: flex;
    flex-direction: column;
    flex: 1;
    height: auto;
    padding: 0;          /* N10: .mc-cuerpo aplica 16px — sin esto, aire parásito */
    overflow: hidden;    /* el chat y el viewer traen su propio scroller */
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
}
```

**4.b — El panel llena su hueco (N5):**

```css
#mc-chat-body .rb-cp__panel {
    width: auto;
    flex: 1 1 auto;
    border-right: none;
}
```

**4.c — Input anclado abajo (N6).** `position: static` + `min-height: auto` +
`flex: 0 0 auto`: como último hijo de la columna flex se ancla solo, sin buscar un
scroller ajeno.

**4.d — D1**, si se confirma: `#mc-chat-body .rb-cp__panel-head { display: none !important; }`

**4.e — D2**, si se confirma: `#mc-chat-body .cn-motor { display: none !important; }`

> ⚠️ **Oculta el control, no cambia el motor.** El valor efectivo lo sigue decidiendo
> `__cnMotor`, que lee `localStorage.cn_motor` y puede venir heredado de `/`. Forzar v2
> exigiría editar `multitab_shell.js` → **prohibido por R-1, escalar**.

**4.f** — Retirar las reglas de `#mc-insights-cuerpo` que pierden sentido con el
esqueleto fuera del panel: `.colapsable-layout { height: 100% }`,
`#multitab-shell-container { display:flex; … }` y el `display:none` de `.rb-cp__rail` /
`.rb-cp__panel`. **Conservar** el `display:none` de `.rb-cp-vhead`.

---

### PASO 5 · Preservación entre re-renders (N3, N8, N9)

**Archivo:** `MainChat/static/js/acordeon.js`

Generalizar `guardarInsights()`/`restaurarInsights()` a **una sola** pareja que opere
sobre las dos zonas. Antes de `raiz.innerHTML=''`, **ambas** vuelven al host; después de
anexar todos los paneles, cada una va a su cuerpo si ese panel está abierto.

> **Invariante:** una zona nunca queda huérfana. O está en su panel, o está en el host.

**5.a — Plotly ya pintado.** Al reinsertar el `viewer`, `Plotly.Plots.resize()` sobre
`.js-plotly-plot` (lógica ya presente). Un nodo desconectado o dentro de un contenedor
`display:none` no tiene dimensión real. **No** llamar a `resize` mientras está en el host.

**5.b — Plotly PENDIENTE (N8, N9).** `resize()` no basta: un bloque `analiza_foco` que
llegó con el viewer en el host **nunca se pintó**, solo quedó marcado. Tras reinsertar
el viewer hay que vaciar esa cola, replicando lo que hace `renderViewer()`:

```js
cuerpo.querySelectorAll('[data-pend-paint="1"]').forEach(function (b) {
    if (b.__cnAnzEd && b.__cnAnzDd) window.__cnPaintFocoStk(b, b.__cnAnzEd, b.__cnAnzDd, b.__cnAnzSufijo || "");
    delete b.dataset.pendPaint;
});
```

> 🔴 **`__cnPaintFocoStk` NO está exportado** (P9): `window.MultiTabShell` expone solo
> `{mount, unmount, prewarm, setActiveTab}`. Exportarlo **es editar
> `multitab_shell.js`, prohibido por R-1** → **DETENERSE y escalar (D3, §9)**.
>
> 🔴 **N9 lo convierte en bloqueante, no en caso raro.** Bajo 1023 px solo cabe **un**
> panel abierto: una zona está *siempre* en el host, así que en móvil esta cola se
> llena en cada pregunta causal. **Sin D3 resuelta, el plan no puede completarse.**

---

### PASO 6 · Cache-bust (R-6)

`?v=20260821k` → `?v=20260821m` en las 6 ocurrencias de `mainchat_layout.html`.

---

## 8. Validaciones

### 8.a — Automáticas

| # | Comando | Esperado |
|---|---|---|
| V1 | `node --check MainChat/static/js/acordeon.js` | exit 0 |
| **V2** | `git diff --stat -- static/ templates/ routes/ app.py` | **vacío** — 🔴 **única barrera automática que existe** (§0.3): R-1 y R-3 dependen enteramente de ella |
| V3 | `grep -c "20260821k" MainChat/templates/mainchat_layout.html` | `0` |
| V4 | `grep -c "20260821m" MainChat/templates/mainchat_layout.html` | `6` |
| V5 | `grep -c "mc-shell-host" MainChat/static/js/acordeon.js` | `≥1` |
| V6 | `grep -c "mc-chat-body" MainChat/static/js/acordeon.js` | `≥3` (crear, guardar, restaurar) |
| V7 | `grep -c "MultiTabShell.mount" MainChat/static/js/acordeon.js` | `1` (R-2) |
| V8 | `grep -c "padding: 0" MainChat/static/css/acordeon.css` | `≥2` (N10 + la regla previa de Insights) |
| V9 | `curl -s -o /dev/null -w "%{http_code}"` sobre `/`, `/login`, `/mainchat`, `/layout/colapsable` | `200` en las cuatro |

> `node --check` solo valida sintaxis. Si Node no está disponible, reportar ⏳, no ✅.

### 8.b — Humana en navegador — 🔴 OBLIGATORIA (§0 R3 / R-7)

| # | Prueba | Criterio |
|---|---|---|
| B1 | Abrir `/mainchat` | Panel #2 con la burbuja de saludo y el nombre; panel #3 con el «Desempeño del mes» |
| B2 | Colores del chat | Fondo `#f6f9fb`, burbuja del bot blanca con borde → las `--rb-*` resolvieron (H1) |
| B3 | Bordes | **Un solo** borde redondeado por panel. Dos anidados → falló la neutralización |
| B4 | Ancho y aire | El chat llena el panel #2, no se queda en 581 px (N5), y **no hay 16 px de margen parásito** (N10) |
| B5 | Preguntar + Enter | `POST /api/consulta2/preguntar` → 200; respuesta en el panel #2 con su chip de grupo |
| **B5b** | Con ambos paneles abiertos, preguntar algo cuantitativo | **El análisis gráfico aparece apilado en el panel #3**, bajo el «Desempeño del mes» |
| **B5c** | Preguntar por variación, ranking y jerarquía | Cada `panel.tipo` pinta su renderer propio, no la tarjeta KPI de fallback |
| **B5d** | **N8** — colapsar Insights, preguntar algo causal, reexpandir | El bloque `analiza_foco` aparece **con sus gráficas pintadas**. Placeholder vacío → N8 sin resolver |
| B6 | Scroll | Una sola barra en el chat; input pegado abajo (N6) |
| B7 | Colapsar el #2 y reexpandir | La conversación vuelve entera, incluido el texto a medio escribir |
| B8 | Colapsar el #3 y reexpandir | Los gráficos vuelven pintados, sin re-fetch |
| B9 | Colapsar el #2 dejando solo el #3 | El análisis sigue vivo; consola sin errores (N3) |
| B10 | Abrir Historial (#1) | Ninguna zona se pierde |
| **B14** | **N9 — estrechar bajo 1023 px** | Queda **un** panel. Alternar entre Chat e Insights: ninguna zona se pierde y la consola queda limpia |
| **B15** | **N9 — en móvil, preguntar algo causal con Insights cerrado y luego abrirlo** | Mismo criterio que B5d. Es el **estado normal** en móvil, no un caso raro |
| B11 | **Sin regresión en `/`** | `/` → Consulta → preguntar: idéntico a antes |
| B12 | Consola en ambas rutas | 0 errores |

---

## 9. Fuera de alcance / deuda / decisiones escaladas

| Tema | Estado |
|---|---|
| **D3 · N8 — salida A: «el viewer nunca queda sin medidas»** | 🔴 **Escalada.** Si el viewer permanece medible, la cola nunca existe y N8 desaparece **sin tocar el archivo compartido**. ⚠️ **N12: `position:absolute; left:-99999px` a secas NO sirve** — sin `width`/`height` explícitos el nodo colapsa a 0×0 y Plotly sigue sin poder medir; además exige un contenedor con `position: relative`. Coste real: Plotly calculando layout de gráficas invisibles de forma permanente, y en móvil (N9) eso es el estado por defecto. |
| **D3 · N8 — salida B: exportar `__cnPaintFocoStk`** | 🔴 **Escalada.** Solución limpia: una línea en el export de `window.MultiTabShell`. Pero **edita `multitab_shell.js`**, compartido con `/` → **rompe R-1**. Requiere autorización explícita del usuario. |
| **N4 · El saludo del chat depende del fetch del análisis** | Documentado, no se corrige. Desacoplarlo exigiría editar `multitab_shell.js` (R-1). Hoy es inocuo en escritorio; **en móvil (N9) merece revisión**. |
| **N7 · `unmount()` dejaría nodos huérfanos** | MainChat nunca desmonta. Si algún día lo hiciera, devolver las zonas al contenedor antes. |
| **D2 · Forzar motor v2** | No se puede solo con CSS: `__cnMotor` lee `localStorage` dentro del archivo compartido. Escalar. |
| **O1 · `prewarm` para atacar N4** | Registrado, **no se ejecuta** (R-5). |
| **§0.4 · Duplicación Flask / React del mismo cascarón** | Declarada, no bloquea. Decisión de portafolio del usuario. |
| **Panel #1 «Historial»** | No se toca. Sigue vacío. |
| **Pestañas Ingesta/Control del shell** | Inalcanzables (riel oculto). `chat.js` sigue sin cargarse. |
| **Backend** | **Cero cambios** (R-3). |

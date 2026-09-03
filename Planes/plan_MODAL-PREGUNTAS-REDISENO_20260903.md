# Plan — Rediseño visual del modal de Preguntas (MainChat): cabecera verde, sidebar con conteos, ficha de categoría con filtro, filas con hueco resaltado

## 0. Contexto para el agente EXECUTOR

- **Proyecto:** ProdIA — asistente conversacional de producción. Interfaz `/mainchat` (Flask + Jinja2, puerto 5029).
- **Repo:** `frontend\` (ProdIAWebFront). Trabajas en local (Windows, sin VPN). Solo editas código; la BD no interviene.
- **Qué es esto:** el modal «Preguntas» de MainChat (botón 🕐) ya tiene 8 pestañas (Histórico + 7 categorías de catálogo, 30 preguntas de ejemplo) desde el commit `d39c955`. Este plan **NO cambia el contenido informativo** de esas categorías — cambia **cómo se presentan**: cabecera verde con total, sidebar con icono+conteo por categoría, ficha de la categoría activa con filtro de texto, y las preguntas como filas compactas con el hueco `…` resaltado en una pastilla ámbar en vez de texto plano.
- **Origen del pedido:** el usuario adjuntó `moda_q.md` (spec de diseño) y una captura de pantalla del resultado esperado. **Ver §1 H1**: ese documento describe una arquitectura (React 19 + TypeScript + react-bootstrap, `src/features/consulta/questions-modal/*.tsx`) que **no existe en este repo** — se verificó por auditoría. Este plan traduce la intención VISUAL de ese documento (colores, layout, jerarquía) al stack real de esta app: **HTML/Jinja2 + JS vanilla + CSS plano**, sin crear ningún archivo `.tsx` ni tocar el frontend React de `backend\frontend\` (que solo cubre Ingesta/KPIs/Reportes, nada de chat).
- **Archivos que tocarás (exactamente 3):**
  1. `c:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\js\multitab_shell.js` — catálogo + render + filtro (§3.1, §3.4)
  2. `c:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\static\css\mainchat.css` — bloque `.mc-preg-*` (§3.2)
  3. `c:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\templates\mainchat_layout.html` — markup del modal (§3.3) **y los dos cache-busters (§3.5)**
- **NO tocas:** `backend\frontend\` (React, otro producto), `routes/api.py`, `app.py`, el clasificador, ni nada del backend. Es 100% presentación.

---

## 1. Hallazgos de la auditoría (determinan el diseño)

### 🔴 H1 — `moda_q.md` describe una arquitectura que no existe en este repo
Verificado con `Glob`: `backend\frontend\src\features\` contiene únicamente `ingesta/`, `kpis_prod/`, `reportes/` (exactamente lo que dice `CLAUDE.md` §1). **No hay `features/consulta/`, ni `questions-modal/`, ni ningún componente `.tsx` de chat.** El chat de Consulta/MainChat es 100% Flask+Jinja2+JS vanilla. `resp.md` y `jerarq_elem.md` (reglas de contraste que el documento referencia) tampoco existen en ningún punto del repo.
**Consecuencia:** este plan **adapta el diseño** (paleta, layout, jerarquía visual, interacción) a `multitab_shell.js` + `mainchat_layout.html` + `mainchat.css`, tal como ya se construyó el modal el 2026-09-03. No se crea React, TypeScript, Sass ni `react-bootstrap`. La regla de contraste del documento (§2 de `moda_q.md`) se adopta directamente en este plan porque es una buena práctica objetivamente válida y no depende de los archivos ausentes.

### 🔴 H2 — El catálogo de `moda_q.md` (27 preguntas, 7 categorías con nombres antiguos) es DISTINTO del catálogo real vigente
El documento trae su propio catálogo de ejemplo (`Histórico, Análisis, Cifras, Comparar y ordenar, En el tiempo, Estructura, Operación` — 27 plantillas). Ese **no es** el catálogo de esta app: el commit `d39c955` (mismo día) ya renombró y reestructuró las categorías a **Diagnóstico de causas, Cifras de producción, Cumplimiento vs metas, Rankings y contribución, Evolución en el tiempo, Catálogo y jerarquía, Eventos operativos** — 30 preguntas — confirmado leyendo `multitab_shell.js:1090-1163` tal como está ahora. **Este plan aplica el FORMATO al catálogo REAL, no reemplaza su contenido por el del documento.** La captura de pantalla adjunta por el usuario muestra nombres de categoría antiguos («Estructura», conteos 4/5/6/4/3/3/2=27) — se toma como **referencia del patrón visual únicamente** (cabecera, sidebar, ficha, filas), no como fuente de verdad del contenido.

### 🔴 H3 — El «Histórico» del documento y el «Histórico» real de esta app son conceptos distintos — no se fusionan
En `moda_q.md`, `hist` es una categoría más del catálogo estático (preguntas de ejemplo sobre periodos ya cerrados). En esta app, la pestaña **Histórico real** (`__cnPregModalPintar`, `multitab_shell.js:1191-1199`) muestra las **preguntas que el usuario YA hizo en la conversación activa** — dato dinámico de sesión (`__cnHistory`), no una plantilla. **Decisión cerrada: la pestaña Histórico queda FUERA de este rediseño** — conserva su presentación actual (título fijo + hint fijo + lista simple, sin filtro, sin pastillas). El rediseño (ficha con filtro + filas con pastilla ámbar) se aplica **solo** a las 7 categorías de catálogo estático. El sidebar sí se rediseña también para Histórico (mismo tratamiento visual de icono en tile + conteo), porque esa parte es puramente CSS y no depende del contenido.

### 🔴 H4 — La pastilla ámbar exige romper cada pregunta en fragmentos `t / slot / t2 / slot2 / t3`
El catálogo actual guarda cada pregunta como **un string plano** con `…` inline (p. ej. `"¿Qué campos tiene el activo …?"`). Para resaltar el hueco como pastilla hay que dejar de tratarlo como texto libre y pasar a **fragmentos con nombre**: texto fijo antes del hueco (`t`), el nombre del dato a completar (`slot`, ej. `"activo"`), texto entre huecos (`t2`), segundo hueco opcional (`slot2`) y texto final (`t3`). Este plan reescribe las 30 preguntas a ese formato en `multitab_shell.js` (código exacto en §3.1). **El contenido informativo no cambia**: se sigue pidiendo exactamente el mismo dato, en el mismo orden.

**Redundancia detectada y corregida en 6 de las 30 preguntas:** cuando la palabra justo antes del `…` original coincidía literalmente con el nombre que le tocaría a la pastilla (p. ej. `"el activo …"` con pastilla `activo` → se leería «el activo `[🖊 activo]`», redundante), se recorta esa palabra antecedente del texto fijo, dejando que la pastilla la reemplace («¿Qué campos tiene `[🖊 activo]`?»). El **significado y el dato pedido no cambian** — solo se evita la repetición visual. Los 6 casos (de los 30) están marcados con `⚠️` en la tabla de §3.1 para que quede explícito qué se tocó y por qué.

**5 preguntas no tienen ningún hueco** (`"¿Cómo vamos este mes?"`, `"¿Cuáles son los 5 campos que más crudo producen?"`, `"¿Cómo se distribuye la producción de crudo, %, entre los campos productores?"`, `"¿Cuál es el activo que más crudo produce?"`, `"¿Qué campos se quedaron más cortos vs presupuesto?"`) — se listan solo como `{ t: "..." }`, sin `slot`, y se renderizan como fila normal sin pastilla (fallback explícito, ver §3.3 helper `__cnPregTextoHTML`).

### 🟡 H5 — La paleta del documento es compatible con la marca ya usada en este modal
`mainchat.css` tiene tokens globales en `:root` (`--mc-primary:#004236`, etc., líneas 4-11) que **el modal de Preguntas nunca usó** — se construyó el 2026-09-03 con hex sueltos propios (`#15794C`, `#e5e7eb`, `#6b7280`...), un espacio de color independiente del resto de la app. El verde `#15794C` que ya usa el modal (`mainchat.css:392,416`) **coincide exactamente** con `$mq-green-mid` de `moda_q.md` — confirma que la paleta del documento es coherente con esta app y no un color inventado. **Decisión:** se mantiene el patrón ya establecido (namespace propio `.mc-preg-*` con hex directos, sin tocar `--mc-*` globales) y se adoptan los hex del documento tal cual — no se inventan colores nuevos, no se toca la paleta del resto de la app.

### 🟢 H6 — `.mc-preg-*` y `.mc-admin-*` son bloques CSS totalmente independientes
Se leyó completo el bloque `.mc-admin-*` (`mainchat.css:207-354`, modal de Admin) y el bloque `.mc-preg-*` (`:364-419`). El comentario "hereda la maquetación del modal de Admin" (línea 365-368) es informal — **no hay ningún `@extend`, mixin ni selector compartido**: son clases con nombres y valores propios, coincidentes solo porque se copiaron a mano. **Rediseñar `.mc-preg-*` no puede romper el modal de Admin.** Confirmado por lectura completa de ambos bloques.

### 🔴 H7 — No usar buscar-y-reemplazar de texto suelto en `mainchat_layout.html` (mismo principio que el plan anterior, H8)
Los nombres de categoría actuales (`Diagnóstico de causas`, etc.) y textos como `Histórico`, `Preguntas` pueden coincidir con otros lugares de la plantilla (p. ej. el menú lateral, línea ~80, ya tiene un `<span>Análisis</span>` — aunque ya no coincide con ningún nombre de categoría del modal tras `d39c955`, la regla se mantiene por disciplina). **Todo cambio de este plan va anclado al contenedor `#mc-preguntas-modal`**, reemplazando bloques completos, nunca por coincidencia de texto.

### 🟢 H8 — Bootstrap 5.3.0 completo ya está cargado; no hace falta ninguna librería nueva
`frontend\templates\base.html:90` carga `bootstrap.bundle.min.js` (el bundle **incluye** Modal, Tab, Popper — todo junto). El evento `shown.bs.tab` que este plan necesita (para sincronizar la ficha+filtro+pie con la pestaña activa) ya está disponible sin ningún `<script>` adicional. Confirmado también que Bootstrap Icons ya carga el set **completo** (el proyecto ya usa iconos poco comunes como `bi-123`, `bi-diagram-3`), así que los iconos nuevos de este plan (`bi-search`, `bi-pencil-fill`, `bi-x-lg` vía `.btn-close`, `bi-patch-question-fill`) existen con certeza.

### 🟢 H9 — `.btn-close-white` ya viene con Bootstrap, no se inventa CSS de cierre
El botón de cerrar (`.btn-close`) es oscuro por defecto (pensado para fondo claro); sobre la cabecera verde nueva sería casi invisible. Bootstrap 5.3 trae la variante oficial `.btn-close-white` — se añade esa clase, cero CSS propio.

### 🟡 H10 — Alcance del icono de fila: un icono por CATEGORÍA, no uno por PREGUNTA
`moda_q.md` asigna un icono Bootstrap distinto a cada una de sus 27 preguntas de ejemplo. Para evitar el riesgo de teclear un nombre de icono que no existe (fallaría en silencio: no hay error visual, solo un hueco vacío) y mantener el plan 100% verificable por grep, **cada fila usa el mismo icono que ya tiene su categoría en el sidebar** (ya validados y en uso: `bi-graph-up-arrow`, `bi-123`, `bi-bullseye`, `bi-bar-chart-steps`, `bi-calendar3`, `bi-diagram-3`, `bi-tools`). Decisión cerrada, no reabrir — sigue diferenciándose cada fila por su texto y por el badge de categoría a la derecha.

### 🔴 H12 — Los estáticos llevan cache-buster `?v=`: si no se sube, el navegador sirve el JS VIEJO con el HTML NUEVO
`mainchat_layout.html` versiona sus estáticos con un token en la URL:
- línea 10: `css/mainchat.css` → **`?v=20260903d`**
- línea 320: `js/multitab_shell.js` → **`?v=20260831j`**

Este plan cambia el **modelo de datos** de `__cnHistSeed` (de strings a objetos `{t,slot,...}`) y todo el render vive en el JS. Si el token no cambia, el navegador reusa el `multitab_shell.js` cacheado: se serviría **HTML nuevo + JS viejo**, y el resultado es un modal a medio construir — total vacío, sin conteos en el sidebar, la ficha de categoría nunca se muestra (el JS viejo no tiene `__cnPregCatbarSync`), sin filtro y sin pastillas. **Falla en silencio y es indistinguible de un bug de código**, con el archivo correcto en disco: exactamente el síntoma que ya costó una sesión el 2026-09-03 en el 139.

⚠️ El commit anterior (`d39c955`, el renombrado) **no subió el token** y se salvó por casualidad: los rótulos visibles venían del HTML (que no se cachea, se renderiza en servidor) y el campo `cat:` del JS no se pinta en ningún sitio. **Este cambio no tiene esa suerte.**

**Consecuencia:** subir **los dos** tokens es un paso obligatorio del plan (§3.5), en el mismo commit. Las plantillas Jinja2 no necesitan token (se renderizan en servidor, siempre frescas tras reiniciar Flask); solo los estáticos.

### 🔴 H13 — `.btn-close` de Bootstrap ya trae `margin-left:auto`: colisiona con el total y ambos se reparten el hueco
Bootstrap define `.modal-header .btn-close { margin: -.5rem -.5rem -.5rem auto; }`. Si el total (`.mc-preg-head__total`) también lleva `margin-left:auto`, **hay dos márgenes automáticos compitiendo** y el espacio libre se reparte entre ambos: el total quedaría flotando a media cabecera en vez de pegado al botón de cerrar, en el extremo derecho. Hay que neutralizar el margen del `.btn-close` dentro de esta cabecera (`margin: 0 0 0 4px`), conservando el efecto buscado (total + cerrar juntos a la derecha, icono + título a la izquierda). Incluido en el CSS de §3.2.

### 🟡 H14 — `92vh` en el body solo (sin contar la cabecera) desborda en pantallas bajas
`moda_q.md` aplica `height:min(560px,92vh)` al **shell completo** (cabecera incluida). Aquí la cabecera es un hermano del body dentro de `.modal-content`, así que poner `92vh` en `.mc-preg-body` da `92vh + ~56px de cabecera` → desborda el viewport en pantallas bajas. El repo ya resolvió esto en el modal de Admin, y lo dejó comentado (`mainchat.css:220-221`: *«El tope en vh evita que con modal-dialog-centered el diálogo desborde el viewport en pantallas bajas»*), usando `min(588px, 73.5vh)`. Se sigue ese precedente: **`height: min(560px, 78vh)`** (78vh + cabecera ≈ 85vh, con aire).

### 🟡 H15 — Los listeners van por delegación en `document`, clonando el patrón ya resuelto del archivo
`multitab_shell.js` se carga con **`defer`** (línea 320), así que el markup del modal ya está parseado cuando corre el script: un `addEventListener` directo sobre `#mc-preg-filtro` **funcionaría**. Pero el archivo ya tiene un precedente resuelto para esto y lo justifica por escrito (`multitab_shell.js:1255-1256`): *«Un solo listener a nivel documento (se registra una vez al cargar el script): busca los nodos por id en cada clic, así que sigue funcionando aunque `renderConsultaBody()` reconstruya el DOM al cambiar de pestaña»*. Se clona ese patrón (CLAUDE.md §10.2: *«Casi siempre hay un precedente resuelto — clonarlo, no reinventarlo»*): `input` y `shown.bs.tab` **burbujean**, así que la delegación en `document` cubre ambos y elimina toda dependencia del orden de carga o de que el nodo sobreviva a un repintado.

### 🟢 H16 — `frontend\Planes\` está excluido del pipeline: los planes pueden citar `CLAUDE.md` sin romper nada
`migrar_a_azure.ps1:73-81` define `$ExcluirRutas = @('.claude', '.codex', 'Planes', 'clmd', 'data/bitacora', 'CLAUDE.md', 'BITACORA.md')`, y el comentario de `Test-Excluido` (líneas 95-98) es explícito: **la misma lista decide qué se copia Y qué se escanea** en el chequeo de trazas. Medido: hay **168 ocurrencias de «claude» en 17 archivos de `Planes\`** y la migración nunca ha fallado por eso — porque esa carpeta ni se publica ni se inspecciona. **Conclusión: este documento de plan no necesita evitar la palabra.** Lo que sí se escanea son los 3 archivos de código que toca este plan; se verificó que ninguno de los comentarios nuevos contiene «claude» ni «jaguez40» (§3 y §5 regla 9).

### 🟡 H17 — Los comentarios del código NO deben citar la ruta del plan (no existe en el repo publicado)
Como `Planes/` no se copia a Azure (H16), un comentario en el código que diga «ver plan_MODAL-PREGUNTAS-REDISENO_20260903.md» apunta a un archivo **inexistente en el repo desplegado**. La convención ya establecida en este mismo archivo es una **etiqueta de fecha + feature** (`[2026-09-03 · MODAL-PREGUNTAS]`, `[2026-08-26]`), sin rutas. Todos los comentarios de este plan usan `[2026-09-03 · MODAL-PREGUNTAS-REDISEÑO]` y explican el *por qué* en el propio comentario, sin remitir a un archivo que el desplegado no tiene.

### 🟡 H11 — Accesibilidad: se adopta la regla de contraste del documento; NO se implementa roving-tabindex nuevo
La regla dura de contraste de `moda_q.md` §2 (texto ≤12px nunca en `$mq-muted`/`#6E7C75`, mínimo `#3C4A44`; tamaño mínimo de badge/conteo 10.5px; `::placeholder` también a `#3C4A44` con `opacity:1`) se aplica en todo el CSS nuevo de este plan (ver hex en §3.2). En cambio, la navegación por teclado con flechas (`role="tablist"` + roving tabindex) que el documento pide en su §7 **no se implementa**: el modal de Admin —la única otra referencia de este mismo patrón en el repo— tampoco la tiene, y añadirla sería infraestructura nueva no solicitada por el usuario. Bootstrap ya resuelve `Esc` para cerrar, el focus-trap del modal, y el `aria-selected`/`.active` al cambiar de pestaña (nativo del componente Tab). Decisión cerrada; se anota en Fuera de alcance (§7).

---

## 2. Estado actual (lo que el executor va a ver)

### 2.1 `multitab_shell.js:1090-1163` — `__cnHistSeed`, 7 categorías, strings planos con `…`
(Contenido completo y vigente tras el commit `d39c955` — no reproducido aquí por espacio; el executor debe **leer el archivo real** antes de tocarlo, líneas 1090-1163. Cada objeto tiene `{ cat, icono, items: [ "string con …", ... ] }`.)

### 2.2 `multitab_shell.js:1191-1254` — funciones a modificar
- `__cnPregModalPintar()` (1191-1206): pinta Histórico + rellena las 7 cajas `mc-preg-cat-N` con `__cnHistSeed[i].items.map(esc).map(__cnPregItem)`.
- `__cnPregItem(h)` (1208-1211): botón simple `.mc-preg-item`, usado hoy para Histórico Y catálogo por igual.
- `__cnHistToggle()` (1213-1240): abre el modal (rama MainChat) o aplana `__cnHistSeed` para el desplegable clásico (rama `/`, líneas 1233-1236: `planas = planas.concat(__cnHistSeed[i].items)`).
- `__cnHistUsar(btn)` (1241-1254): copia `btn.textContent` al input y cierra el modal si aplica.

### 2.3 `mainchat_layout.html:192-274` — el modal completo (header + nav de 8 botones + 8 panes)
Header simple (icono+título+cerrar, fondo blanco por defecto de Bootstrap). Nav con 8 `<button class="mc-preg-nav__item">` (Histórico + 7 categorías), cada uno con un `<i class="bi ...">` suelto y un `<span>` con el nombre — **sin conteo**. 8 `<div class="tab-pane">`, el de Histórico con su propio `<h6>`+`<p class="hint">`, los 7 de categoría también con su propio `<h6>`+`<p class="hint">` cada uno (redundante entre sí, se centraliza en este plan).

### 2.4 `mainchat.css:364-419` — bloque `.mc-preg-*` a reemplazar por completo
Ver contenido íntegro ya citado en la auditoría de la conversación (16 reglas, hex Tailwind-esque, sin sidebar con conteo, sin ficha de categoría, sin filtro, sin pastilla, sin pie).

---

## 3. Especificación

### 3.1 MODIFICAR `multitab_shell.js` — reemplazar el array `__cnHistSeed` completo (líneas 1090-1163)

**Tabla de conversión** (`⚠️` = se recortó una palabra antecedente redundante, ver H4; el dato pedido no cambia):

| Categoría | Pregunta original | Fragmentos nuevos |
|---|---|---|
| Diagnóstico de causas | Analiza el comportamiento del producto … | `t:"Analiza el comportamiento de ", slot:"producto"` ⚠️ |
| | Analiza el comportamiento de la producción de … en el Campo … | `t:"...de ", slot:"producto", t2:" en ", slot2:"campo"` ⚠️ |
| | ¿Qué campos explican el faltante de …? | `t:"...faltante de ", slot:"producto", t2:"?"` |
| | ¿Cuáles son las causas de las diferidas en el campo …? | `t:"...diferidas en ", slot:"campo", t2:"?"` ⚠️ |
| Cifras de producción | ¿Cuánto crudo produjo el campo …? | `t:"¿Cuánto crudo produjo ", slot:"campo", t2:"?"` ⚠️ |
| | ¿Cuál es la producción del activo …? | `t:"¿Cuál es la producción de ", slot:"activo", t2:"?"` ⚠️ |
| | ¿Cuál es el acumulado del año de …? | `t:"...año de ", slot:"entidad", t2:"?"` |
| | ¿Cuánto ha producido … en lo que va del año? | `t:"¿Cuánto ha producido ", slot:"entidad", t2:" en lo que va del año?"` |
| | ¿Cuál es el acumulado de gas de …? | `t:"...gas de ", slot:"entidad", t2:"?"` |
| | ¿Cuánto produjo … el mes pasado? | `t:"¿Cuánto produjo ", slot:"entidad", t2:" el mes pasado?"` |
| Cumplimiento vs metas | ¿Cómo vamos este mes? | `t:"¿Cómo vamos este mes?"` (sin slot) |
| | ¿Cómo va … frente al presupuesto este mes? | `t:"¿Cómo va ", slot:"entidad", t2:" frente al presupuesto este mes?"` |
| | ¿Cuánto produjo … en … vs el operativo? | `t:"¿Cuánto produjo ", slot:"entidad", t2:" en ", slot2:"mes", t3:" vs el operativo?"` |
| | ¿Cuánto produjo … en … contra el contable? | `t2:" en ", slot2:"mes", t3:" contra el contable?"` |
| | ¿Cómo va … frente al promedio del año? | `t:"¿Cómo va ", slot:"entidad", t2:" frente al promedio del año?"` |
| Rankings y contribución | ¿Cuáles son los 5 campos que más crudo producen? | `t:"..."` (sin slot) |
| | ¿Cómo se distribuye la producción de crudo, %, entre los campos productores? | `t:"..."` (sin slot) |
| | ¿Cuáles campos del activo … producen más crudo? | `t:"¿Cuáles campos de ", slot:"activo", t2:" producen más crudo?"` ⚠️ |
| | ¿Cuál es el activo que más crudo produce? | `t:"..."` (sin slot) |
| | ¿Qué campos se quedaron más cortos vs presupuesto? | `t:"..."` (sin slot) |
| Evolución en el tiempo | Muéstrame la producción del campo …, día a día para el mes de … | `t:"Muéstrame la producción de ", slot:"campo", t2:", día a día en ", slot2:"mes"` ⚠️⚠️ |
| | Muéstrame la producción del campo …, mes a mes para el año … | `t:"...de ", slot:"campo", t2:", mes a mes en ", slot2:"año"` ⚠️⚠️ |
| | ¿Cuánto produjo … en los últimos 30 días? | `t:"¿Cuánto produjo ", slot:"entidad", t2:" en los últimos 30 días?"` |
| | ¿Cuál ha sido la variación porcentual de la producción de … mes a mes en 2026, para el campo …? | `t:"...de ", slot:"producto", t2:" mes a mes en 2026, para ", slot2:"campo", t3:"?"` ⚠️ |
| | ¿Cuál fue el mejor día de … este mes? | `t:"¿Cuál fue el mejor día de ", slot:"entidad", t2:" este mes?"` |
| Catálogo y jerarquía | ¿Qué campos tiene el activo …? | `t:"¿Qué campos tiene ", slot:"activo", t2:"?"` ⚠️ |
| | ¿A qué activo pertenece el campo …? | `t:"¿A qué activo pertenece ", slot:"campo", t2:"?"` ⚠️ |
| | ¿Cuántos pozos tiene …? | `t:"¿Cuántos pozos tiene ", slot:"entidad", t2:"?"` |
| Eventos operativos | ¿Qué mantenimientos se han realizado en el campo …, en el último mes? | `t:"...realizado en ", slot:"campo", t2:", en el último mes?"` ⚠️ |
| | ¿Qué diferidas hubo en …? | `t:"¿Qué diferidas hubo en ", slot:"entidad", t2:"?"` |

**Acción:** localizar `var __cnHistSeed = [ ... ];` (líneas 1090-1163) y reemplazarlo entero por:

```js
  var __cnHistSeed = [
    {
      cat: "Diagnóstico de causas",
      icono: "bi-graph-up-arrow",
      hint: "Por qué pasó: faltantes y causas del comportamiento",
      items: [
        { t: "Analiza el comportamiento de ", slot: "producto" },
        { t: "Analiza el comportamiento de la producción de ", slot: "producto", t2: " en ", slot2: "campo" },
        { t: "¿Qué campos explican el faltante de ", slot: "producto", t2: "?" },
        { t: "¿Cuáles son las causas de las diferidas en ", slot: "campo", t2: "?" }
      ]
    },
    {
      cat: "Cifras de producción",
      icono: "bi-123",
      hint: "El cuánto directo: volúmenes y acumulados",
      items: [
        { t: "¿Cuánto crudo produjo ", slot: "campo", t2: "?" },
        { t: "¿Cuál es la producción de ", slot: "activo", t2: "?" },
        { t: "¿Cuál es el acumulado del año de ", slot: "entidad", t2: "?" },
        { t: "¿Cuánto ha producido ", slot: "entidad", t2: " en lo que va del año?" },
        { t: "¿Cuál es el acumulado de gas de ", slot: "entidad", t2: "?" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " el mes pasado?" }
      ]
    },
    {
      cat: "Cumplimiento vs metas",
      icono: "bi-bullseye",
      hint: "Real contra presupuesto, operativo, contable y promedio",
      items: [
        { t: "¿Cómo vamos este mes?" },
        { t: "¿Cómo va ", slot: "entidad", t2: " frente al presupuesto este mes?" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " en ", slot2: "mes", t3: " vs el operativo?" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " en ", slot2: "mes", t3: " contra el contable?" },
        { t: "¿Cómo va ", slot: "entidad", t2: " frente al promedio del año?" }
      ]
    },
    {
      cat: "Rankings y contribución",
      icono: "bi-bar-chart-steps",
      hint: "Quién más o menos produce, y cómo se distribuye",
      items: [
        { t: "¿Cuáles son los 5 campos que más crudo producen?" },
        { t: "¿Cómo se distribuye la producción de crudo, %, entre los campos productores?" },
        { t: "¿Cuáles campos de ", slot: "activo", t2: " producen más crudo?" },
        { t: "¿Cuál es el activo que más crudo produce?" },
        { t: "¿Qué campos se quedaron más cortos vs presupuesto?" }
      ]
    },
    {
      cat: "Evolución en el tiempo",
      icono: "bi-calendar3",
      hint: "Día a día, mes a mes y variaciones en el tiempo",
      items: [
        { t: "Muéstrame la producción de ", slot: "campo", t2: ", día a día en ", slot2: "mes" },
        { t: "Muéstrame la producción de ", slot: "campo", t2: ", mes a mes en ", slot2: "año" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " en los últimos 30 días?" },
        { t: "¿Cuál ha sido la variación porcentual de la producción de ", slot: "producto", t2: " mes a mes en 2026, para ", slot2: "campo", t3: "?" },
        { t: "¿Cuál fue el mejor día de ", slot: "entidad", t2: " este mes?" }
      ]
    },
    {
      cat: "Catálogo y jerarquía",
      icono: "bi-diagram-3",
      hint: "Campos, activos y a qué gerencia pertenecen",
      items: [
        { t: "¿Qué campos tiene ", slot: "activo", t2: "?" },
        { t: "¿A qué activo pertenece ", slot: "campo", t2: "?" },
        { t: "¿Cuántos pozos tiene ", slot: "entidad", t2: "?" }
      ]
    },
    {
      cat: "Eventos operativos",
      icono: "bi-tools",
      hint: "Mantenimientos y diferidas registradas",
      items: [
        { t: "¿Qué mantenimientos se han realizado en ", slot: "campo", t2: ", en el último mes?" },
        { t: "¿Qué diferidas hubo en ", slot: "entidad", t2: "?" }
      ]
    }
  ];
```

> Verificación de conteo: 4+6+5+5+5+3+2 = **30** — igual que antes de este plan. No se añadió ni se quitó ninguna pregunta.

---

### 3.2 MODIFICAR `mainchat.css` — reemplazar el bloque `.mc-preg-*` completo (líneas 364-419)

**Acción:** localizar desde el comentario `/* [2026-09-03 · MODAL-PREGUNTAS] Modal de preguntas de ejemplo...` (línea 364) hasta la regla `.mc-preg-vacio { ... }` (línea 418, inclusive la línea 419 en blanco si la hay) y reemplazar todo ese bloque por:

```css
/* [2026-09-03 · MODAL-PREGUNTAS-REDISEÑO] Cabecera verde + sidebar con conteo + ficha de
   categoría con filtro + filas con el hueco resaltado en pastilla ámbar.
   El verde de acento (#15794C) es el que este modal YA usaba antes del rediseño: no es una
   paleta nueva, es la misma marca; el resto de la escala (#0E5C3A, #1E9E5A, #E9F3EC) la
   completa alrededor de ese mismo tono. El ámbar (#FBF3DF / #E0C489 / #8A6516) es solo para
   el hueco editable, y su texto está a ~6,4:1 sobre su propio fondo.
   Regla de contraste: ningún texto ≤12px usa #6E7C75 (ese gris queda SOLO para iconos);
   mínimo #3C4A44. Tamaño mínimo de badge/conteo: 10.5px. */

.mc-preg-dialog { max-width: min(1010px, calc(100% - 3.5rem)); }

.mc-preg-head {
    display: flex; align-items: center; justify-content: flex-start; gap: 11px;
    padding: 14px 18px; background: #0E5C3A; border-bottom: 0;
}
.mc-preg-head__icon { font-size: 16px; color: #C9962E; }
.mc-preg-head__title { font-size: 15px; font-weight: 800; color: #fff; letter-spacing: .2px; margin: 0; }
.mc-preg-head__total {
    margin-left: auto;
    font-family: ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    font-size: 10.5px; color: rgba(255,255,255,.78);
}
/* Bootstrap le pone `margin-left:auto` al .btn-close del .modal-header. Con el total
   llevando OTRO margin-left:auto, los dos se reparten el hueco libre y el total quedaría
   flotando a media cabecera. Se neutraliza aquí para que total y cerrar queden juntos a la
   derecha, y el icono + título a la izquierda. */
.mc-preg-head .btn-close { margin: 0 0 0 4px; }

/* Alto: la cabecera es hermana de este body dentro de .modal-content, así que el tope en vh
   tiene que dejarle sitio (78vh + ~56px de cabecera ≈ 85vh). Mismo criterio que
   .mc-admin-body, que ya lo dejó comentado: sin ese margen, con .modal-dialog-centered el
   diálogo desborda el viewport en pantallas bajas. */
.mc-preg-body { display: flex; gap: 0; padding: 0; height: min(560px, 78vh); min-height: 0; }

.mc-preg-nav {
    flex: 0 0 216px;
    background: #F7FAF8;
    border-right: 1px solid #EEF2EF;
    padding: 10px 8px;
    overflow-y: auto;
}

.mc-preg-nav__item {
    position: relative;
    display: flex; align-items: center; gap: 10px;
    width: 100%; text-align: left;
    background: transparent; border: 0; border-radius: 9px;
    padding: 9px 10px; margin-bottom: 2px;
    cursor: pointer;
}
.mc-preg-nav__item:hover { background: #F3F9F4; }
.mc-preg-nav__item.active { background: #fff; box-shadow: 0 1px 3px rgba(20,40,30,.07); }
.mc-preg-nav__item.active::before {
    content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
    border-radius: 3px; background: #1E9E5A;
}
.mc-preg-nav__tile {
    flex: 0 0 auto; width: 26px; height: 26px; border-radius: 7px;
    display: grid; place-items: center;
    background: #fff; border: 1px solid #E4E9E5;
}
.mc-preg-nav__item.active .mc-preg-nav__tile { background: #E9F3EC; border-color: #E9F3EC; }
.mc-preg-nav__tile i { font-size: 12.5px; color: #6E7C75; }
.mc-preg-nav__item.active .mc-preg-nav__tile i { color: #15794C; }
.mc-preg-nav__label {
    flex: 1; min-width: 0;
    font-size: 12.5px; font-weight: 600; color: #3C4A44;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mc-preg-nav__item.active .mc-preg-nav__label { font-weight: 800; color: #1A2A24; }
.mc-preg-nav__count {
    flex: 0 0 auto;
    font-family: ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    font-size: 10.5px; font-weight: 700; color: #3C4A44;
}
.mc-preg-nav__item.active .mc-preg-nav__count { color: #15794C; }

.mc-preg-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }

.mc-preg-catbar {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px; border-bottom: 1px solid #EEF2EF; flex: 0 0 auto;
}
.mc-preg-catbar[hidden] { display: none; }
.mc-preg-catbar__tile {
    flex: 0 0 auto; width: 38px; height: 38px; border-radius: 11px;
    background: #0E5C3A; display: grid; place-items: center;
}
.mc-preg-catbar__tile i { font-size: 17px; color: #C9962E; }
.mc-preg-catbar__text { flex: 1; min-width: 0; }
.mc-preg-catbar__title { font-size: 15px; font-weight: 800; color: #1A2A24; margin: 0; }
.mc-preg-catbar__hint { font-size: 11.5px; color: #3C4A44; margin: 1px 0 0; }
.mc-preg-catbar__filtro { flex: 0 0 auto; width: 196px; position: relative; }
.mc-preg-catbar__filtro i {
    position: absolute; left: 11px; top: 10px; font-size: 12px; color: #6E7C75; pointer-events: none;
}
.mc-preg-catbar__filtro input {
    width: 100%; height: 32px; box-sizing: border-box;
    padding: 0 10px 0 30px; border: 1px solid #E4E9E5; border-radius: 8px;
    font-size: 12px; color: #3C4A44; background: #fff;
}
.mc-preg-catbar__filtro input::placeholder { color: #3C4A44; opacity: 1; }

.mc-preg-content { flex: 1 1 auto; padding: 14px 18px 18px; overflow-y: auto; min-height: 0; }

.mc-preg-panel__title { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 4px; }
.mc-preg-panel__hint { font-size: 12px; color: #6b7280; margin: 0 0 12px; }

.mc-preg-row {
    display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; cursor: pointer;
    border: 1px solid transparent; border-radius: 9px; background: #F7FAF8; padding: 10px 12px;
    margin-bottom: 6px;
    transition: border-color .15s, background .15s;
}
.mc-preg-row:hover, .mc-preg-row:focus-visible { border-color: #1E9E5A; background: #F3F9F4; }
.mc-preg-row:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(30,158,90,.35); }
.mc-preg-row__icon { font-size: 13px; color: #6E7C75; flex: 0 0 auto; }
.mc-preg-row__text { flex: 1; min-width: 0; font-size: 12px; line-height: 1.55; color: #1A2A24; }
.mc-preg-row__badge {
    flex: 0 0 auto; font-size: 10.5px; font-weight: 700; color: #3C4A44;
    background: #fff; border: 1px solid #E4E9E5; border-radius: 5px; padding: 2px 7px;
}

.mc-preg-slot {
    display: inline-flex; align-items: center; gap: 4px;
    background: #FBF3DF; border: 1px dashed #E0C489; border-radius: 5px;
    padding: 0 6px; margin: 0 1px;
    font-family: ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    font-size: 10.5px; font-weight: 700; color: #8A6516;
}
.mc-preg-slot i { color: #A8791F; font-size: 9px; }

.mc-preg-foot {
    display: flex; align-items: center; padding: 10px 18px;
    border-top: 1px solid #EEF2EF; background: #F7FAF8; flex: 0 0 auto;
    font-family: ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    font-size: 10.5px; color: #3C4A44;
}
.mc-preg-foot[hidden] { display: none; }

.mc-preg-vacio { font-size: 13px; color: #6b7280; font-style: italic; }

@media (prefers-reduced-motion: reduce) {
    .mc-preg-row, .mc-preg-nav__item { transition: none; }
}
```

> `.mc-preg-item` (la clase de fila antigua) **desaparece de este bloque**, pero sigue usándose para Histórico (§3.3, H3) — ver §3.4 punto 3: se conserva su regla en el HTML tal cual (no requiere CSS nuevo, ya la tenía; se mantiene fuera de este reemplazo si el executor la encuentra en otra parte del archivo — no es el caso: estaba dentro del mismo bloque `364-419` que se reemplaza, así que **hay que volver a declararla**). Añadir, dentro del mismo bloque de arriba (puede ir justo después de `.mc-preg-panel__hint`):

```css
.mc-preg-item {
    display: block; width: 100%; text-align: left;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 10px 12px; margin-bottom: 6px;
    font-size: 13px; color: #1f2937; cursor: pointer;
}
.mc-preg-item:hover { background: #f1f4f1; border-color: #15794C; }
```

(Este fragmento es una **continuación** del bloque anterior, no un bloque aparte — insertarlo dentro del mismo reemplazo, en cualquier posición después de `.mc-preg-panel__hint` y antes de `.mc-preg-vacio`.)

---

### 3.3 MODIFICAR `mainchat_layout.html` — reemplazar el modal completo (líneas 192-274)

> ⚠️ **H7 — anclar al contenedor.** Reemplazar el `<div class="modal fade" id="mc-preguntas-modal" ...> ... </div>` **completo** (abre en la línea 192, cierra en la línea 274) por el bloque de abajo. No editar por coincidencia de texto suelto.

**Acción:** reemplazar íntegro por:

```html
<!-- [2026-09-03 · MODAL-PREGUNTAS-REDISEÑO] Cabecera verde + sidebar con conteo + ficha de
     categoría con filtro + filas con el hueco resaltado en pastilla ámbar.
     Va FUERA de #mc-chat-body, igual que #mc-admin-modal, por el mismo motivo: el acordeón y
     el historial repintan ese contenedor y se llevarían el modal por delante.
     Las 7 categorías de catálogo son ESTÁTICAS: su orden y sus iconos deben coincidir con el
     array __cnHistSeed de multitab_shell.js, porque el JS rellena #mc-preg-cat-N buscando por
     ÍNDICE. Lo que se pinta por JS: el total de la cabecera, los conteos del sidebar, la ficha
     (#mc-preg-catbar), las listas de filas y el pie.
     La pestaña "Histórico" NO forma parte del catálogo: son las preguntas que el usuario ya
     hizo en ESTA conversación (dato de sesión, no plantillas). Por eso conserva su propio
     título/hint fijos y se queda fuera de la ficha compartida y del filtro — la ficha y el pie
     nacen con `hidden` justamente porque Histórico es la pestaña activa por defecto. -->
<div class="modal fade" id="mc-preguntas-modal" tabindex="-1" aria-labelledby="mc-preguntas-modal-label" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered mc-preg-dialog">
        <div class="modal-content">
            <div class="modal-header mc-preg-head">
                <i class="bi bi-patch-question-fill mc-preg-head__icon" aria-hidden="true"></i>
                <h5 class="modal-title mc-preg-head__title" id="mc-preguntas-modal-label">Preguntas</h5>
                <span class="mc-preg-head__total" id="mc-preg-total"></span>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body mc-preg-body">
                <div class="nav flex-column mc-preg-nav" role="tablist" aria-orientation="vertical">
                    <button class="mc-preg-nav__item active" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-hist" type="button" role="tab" aria-controls="mc-preg-pane-hist" aria-selected="true">
                        <span class="mc-preg-nav__tile"><i class="bi bi-clock-history" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Histórico</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-hist"></span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-0" type="button" role="tab" aria-controls="mc-preg-pane-0" aria-selected="false">
                        <span class="mc-preg-nav__tile"><i class="bi bi-graph-up-arrow" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Diagnóstico de causas</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-0"></span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-1" type="button" role="tab" aria-controls="mc-preg-pane-1" aria-selected="false">
                        <span class="mc-preg-nav__tile"><i class="bi bi-123" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Cifras de producción</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-1"></span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-2" type="button" role="tab" aria-controls="mc-preg-pane-2" aria-selected="false">
                        <span class="mc-preg-nav__tile"><i class="bi bi-bullseye" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Cumplimiento vs metas</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-2"></span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-3" type="button" role="tab" aria-controls="mc-preg-pane-3" aria-selected="false">
                        <span class="mc-preg-nav__tile"><i class="bi bi-bar-chart-steps" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Rankings y contribución</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-3"></span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-4" type="button" role="tab" aria-controls="mc-preg-pane-4" aria-selected="false">
                        <span class="mc-preg-nav__tile"><i class="bi bi-calendar3" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Evolución en el tiempo</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-4"></span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-5" type="button" role="tab" aria-controls="mc-preg-pane-5" aria-selected="false">
                        <span class="mc-preg-nav__tile"><i class="bi bi-diagram-3" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Catálogo y jerarquía</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-5"></span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-6" type="button" role="tab" aria-controls="mc-preg-pane-6" aria-selected="false">
                        <span class="mc-preg-nav__tile"><i class="bi bi-tools" aria-hidden="true"></i></span>
                        <span class="mc-preg-nav__label">Eventos operativos</span>
                        <span class="mc-preg-nav__count" id="mc-preg-navcount-6"></span>
                    </button>
                </div>
                <div class="mc-preg-panel">
                    <div class="mc-preg-catbar" id="mc-preg-catbar" hidden>
                        <div class="mc-preg-catbar__tile"><i id="mc-preg-catbar-icon" class="bi" aria-hidden="true"></i></div>
                        <div class="mc-preg-catbar__text">
                            <h6 class="mc-preg-catbar__title" id="mc-preg-catbar-title"></h6>
                            <p class="mc-preg-catbar__hint" id="mc-preg-catbar-hint"></p>
                        </div>
                        <div class="mc-preg-catbar__filtro">
                            <i class="bi bi-search" aria-hidden="true"></i>
                            <input type="text" id="mc-preg-filtro" placeholder="Filtrar…" aria-label="Filtrar preguntas" autocomplete="off">
                        </div>
                    </div>
                    <div class="tab-content mc-preg-content">
                        <div class="tab-pane fade show active" id="mc-preg-pane-hist" role="tabpanel">
                            <h6 class="mc-preg-panel__title">Histórico</h6>
                            <p class="mc-preg-panel__hint">Preguntas de esta conversación. Clic para reutilizarlas.</p>
                            <div id="mc-preg-hist"></div>
                        </div>
                        <div class="tab-pane fade" id="mc-preg-pane-0" role="tabpanel"><div id="mc-preg-cat-0"></div></div>
                        <div class="tab-pane fade" id="mc-preg-pane-1" role="tabpanel"><div id="mc-preg-cat-1"></div></div>
                        <div class="tab-pane fade" id="mc-preg-pane-2" role="tabpanel"><div id="mc-preg-cat-2"></div></div>
                        <div class="tab-pane fade" id="mc-preg-pane-3" role="tabpanel"><div id="mc-preg-cat-3"></div></div>
                        <div class="tab-pane fade" id="mc-preg-pane-4" role="tabpanel"><div id="mc-preg-cat-4"></div></div>
                        <div class="tab-pane fade" id="mc-preg-pane-5" role="tabpanel"><div id="mc-preg-cat-5"></div></div>
                        <div class="tab-pane fade" id="mc-preg-pane-6" role="tabpanel"><div id="mc-preg-cat-6"></div></div>
                    </div>
                    <footer class="mc-preg-foot" id="mc-preg-foot" hidden></footer>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Diferencias clave frente al HTML actual** (para que el executor sepa qué está cambiando y por qué, no solo copie):
1. `.modal-header` gana la clase `mc-preg-head` (fondo verde) y el `.btn-close` gana `btn-close-white`.
2. Cada botón de nav pasa de `<i>` suelto + `<span>` a `<span class="mc-preg-nav__tile"><i>...</i></span>` + `<span class="mc-preg-nav__label">` + `<span class="mc-preg-nav__count" id="mc-preg-navcount-N">` (nuevo, lo rellena JS).
3. Aparece `<div class="mc-preg-panel">` envolviendo lo que antes eran hermanos directos de `.mc-preg-nav` — dentro va la ficha compartida `#mc-preg-catbar` (nueva, oculta por defecto — H3: Histórico no la usa), el `.tab-content` (igual que antes) y el pie `#mc-preg-foot` (nuevo, oculto por defecto).
4. Los 7 `<div class="tab-pane" id="mc-preg-pane-N">` de categoría **pierden** su `<h6>`+`<p class="hint">` propios (se centralizan en `#mc-preg-catbar`) y quedan reducidos a solo el contenedor `<div id="mc-preg-cat-N">`.
5. El pane de Histórico **no cambia** (conserva su `<h6>`+`<p class="hint">`+`<div id="mc-preg-hist">`).

---

### 3.4 MODIFICAR `multitab_shell.js` — funciones de render, filtro y sincronización (líneas 1184-1254)

**Acción:** localizar desde el comentario `// [2026-09-03 · MODAL-PREGUNTAS] Pinta el modal categorizado...` (línea 1184) hasta el cierre de `window.__cnHistUsar` (línea 1254) — es decir, TODO el bloque que incluye `__cnPregModalPintar`, `__cnPregItem`, `__cnHistToggle` y `__cnHistUsar` — y reemplazarlo por:

```js
  // [MODAL-PREGUNTAS · rediseño] Pinta el modal categorizado. Solo existe en MainChat: el
  // markup vive en mainchat_layout.html, fuera de #mc-chat-body para que el repintado del
  // acordeón no lo destruya (mismo criterio que el modal de Admin).
  // 🔑 ESCAPADO, dos reglas distintas y deliberadas (ver el comentario de 2026-08-26 arriba):
  //    · el historial (b.html) YA viene escapado por __cnBubble -> se inyecta tal cual;
  //    · las plantillas de __cnHistSeed llegan crudas (t/slot/t2/slot2/t3) -> cada fragmento
  //      pasa por esc() antes de montar el HTML de la fila (ver __cnPregTextoHTML).
  //
  // [MODAL-PREGUNTAS · rediseño] El hueco "…" de cada plantilla ya no es texto libre: cada
  // pregunta es {t, slot, t2, slot2, t3} y el hueco se resalta como pastilla ámbar
  // (.mc-preg-slot) en vez de un carácter "…" perdido en medio de la frase. Dos vistas del
  // mismo dato: __cnPregTextoHTML() arma el HTML con la pastilla (para pintar la fila);
  // __cnPregTextoPlano() reconstruye el texto plano con "…" real (para el input del chat, el
  // desplegable clásico y el buscador de filtro) — NO se parsea con regex, se compone desde
  // los mismos fragmentos con nombre.
  function __cnPregSlotHTML(nombre) {
    return '<span class="mc-preg-slot"><i class="bi bi-pencil-fill" aria-hidden="true"></i>' + esc(nombre) + '</span>';
  }
  function __cnPregTextoHTML(tpl) {
    var h = esc(tpl.t);
    if (tpl.slot) h += __cnPregSlotHTML(tpl.slot);
    h += esc(tpl.t2 || "");
    if (tpl.slot2) h += __cnPregSlotHTML(tpl.slot2);
    h += esc(tpl.t3 || "");
    return h;
  }
  function __cnPregTextoPlano(tpl) {
    var s = tpl.t;
    if (tpl.slot) s += "…";
    s += (tpl.t2 || "");
    if (tpl.slot2) s += "…";
    s += (tpl.t3 || "");
    return s;
  }
  // Fila de catálogo (icono de categoría + texto con pastilla(s) + badge de categoría a la
  // derecha). `data-plano` guarda el texto reconstruido con "…" para insertarlo en el input
  // al hacer clic (ver __cnHistUsar) — el navegador des-escapa el atributo solo, no hace
  // falta un unescape manual (mismo mecanismo que ya usa __cnPregItem con b.html).
  function __cnPregFila(tpl, catLabel, catIcono) {
    return '<button type="button" class="mc-preg-row" data-plano="' + esc(__cnPregTextoPlano(tpl)) + '" onclick="window.__cnHistUsar(this)">' +
      '<i class="bi ' + catIcono + ' mc-preg-row__icon" aria-hidden="true"></i>' +
      '<span class="mc-preg-row__text">' + __cnPregTextoHTML(tpl) + '</span>' +
      '<span class="mc-preg-row__badge">' + esc(catLabel) + '</span>' +
      '</button>';
  }
  // Pinta la caja mc-preg-cat-IDX filtrando por `q` (substring, sin distinguir mayúsculas).
  // q="" pinta el catálogo completo de esa categoría. Devuelve cuántas filas quedaron
  // visibles (lo usa el pie y el conteo del sidebar).
  function __cnPregFiltrar(idx, q) {
    var cont = el("mc-preg-cat-" + idx);
    var cat = __cnHistSeed[idx];
    if (!cont || !cat) return 0;
    var qq = (q || "").trim().toLowerCase();
    var filtrados = qq
      ? cat.items.filter(function (tpl) { return __cnPregTextoPlano(tpl).toLowerCase().indexOf(qq) !== -1; })
      : cat.items;
    cont.innerHTML = filtrados.length
      ? filtrados.map(function (tpl) { return __cnPregFila(tpl, cat.cat, cat.icono); }).join("")
      : '<p class="mc-preg-vacio">Sin resultados' + (qq ? ' para «' + esc(q.trim()) + '»' : '') + '.</p>';
    return filtrados.length;
  }
  // Total de plantillas del catálogo (30 hoy), derivado — nunca hardcodeado.
  function __cnPregTotalCatalogo() {
    var t = 0;
    for (var i = 0; i < __cnHistSeed.length; i++) t += __cnHistSeed[i].items.length;
    return t;
  }
  function __cnPregPie(idx, n) {
    var pie = el("mc-preg-foot");
    if (!pie) return;
    var total = __cnPregTotalCatalogo();
    pie.textContent = n + " de " + total + (total === 1 ? " plantilla" : " plantillas");
  }
  // Sincroniza la ficha compartida (icono/nombre/hint) + el filtro + el pie con la pestaña
  // que esté activa AHORA MISMO (lee el DOM, no guarda estado propio). Si la activa es
  // Histórico (o cualquier cosa que no matchee "mc-preg-pane-N"), oculta ficha y pie: H3 del
  // plan — Histórico no es parte del catálogo, no tiene filtro ni pastillas.
  function __cnPregCatbarSync() {
    var barra = el("mc-preg-catbar"), pie = el("mc-preg-foot");
    if (!barra || !pie) return;
    var idx = __cnPregIdxActivo();
    if (idx === -1) {          // Histórico (o nada activo): sin ficha, sin filtro, sin pie
      barra.hidden = true;
      pie.hidden = true;
      return;
    }
    var cat = __cnHistSeed[idx];
    var icono = el("mc-preg-catbar-icon"); if (icono) icono.className = "bi " + cat.icono;
    var titulo = el("mc-preg-catbar-title"); if (titulo) titulo.textContent = cat.cat;
    var hint = el("mc-preg-catbar-hint"); if (hint) hint.textContent = cat.hint || "";
    var filtro = el("mc-preg-filtro"); if (filtro) filtro.value = "";
    barra.hidden = false;
    pie.hidden = false;
    __cnPregPie(idx, __cnPregFiltrar(idx, ""));
  }
  function __cnPregModalPintar() {
    var cont = el("mc-preg-hist");
    var qs = [];
    if (cont) {
      qs = __cnHistory.filter(function (b) { return b.role === "user"; })
                       .map(function (b) { return b.html; }).reverse();
      cont.innerHTML = qs.length
        ? qs.map(__cnPregItem).join("")
        : '<p class="mc-preg-vacio">Todavía no has preguntado nada en esta conversación.</p>';
    }
    var histCnt = el("mc-preg-navcount-hist");
    if (histCnt) histCnt.textContent = qs.length;
    // Las categorías son estáticas en el HTML; aquí se rellenan sus listas + el conteo del
    // sidebar. El índice del panel coincide con el del array porque el nav se escribe en el
    // mismo orden (ver mainchat_layout.html).
    for (var i = 0; i < __cnHistSeed.length; i++) {
      var n = __cnPregFiltrar(i, "");
      var cnt = el("mc-preg-navcount-" + i);
      if (cnt) cnt.textContent = n;
    }
    var totEl = el("mc-preg-total");
    if (totEl) {
      var total = __cnPregTotalCatalogo();
      totEl.textContent = total + (total === 1 ? " plantilla" : " plantillas");
    }
    __cnPregCatbarSync();
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
    // [MODAL-PREGUNTAS · rediseño] __cnHistSeed ya no es plano ni de strings: se aplana aquí
    // reconstruyendo el texto de cada plantilla con __cnPregTextoPlano, para el desplegable de
    // la vista clásica, que sigue siendo una lista sin categorías ni pastillas.
    var planas = [];
    for (var i = 0; i < __cnHistSeed.length; i++) {
      for (var j = 0; j < __cnHistSeed[i].items.length; j++) {
        planas.push(__cnPregTextoPlano(__cnHistSeed[i].items[j]));
      }
    }
    d.innerHTML = qs.map(__cnHistBoton).join("") +
      cabeceraSeed + planas.map(esc).map(__cnHistBoton).join("");
    d.hidden = false;
  };
  window.__cnHistUsar = function (btn) {
    var inp = el("cn-input"); if (!inp || !btn) return;
    // [MODAL-PREGUNTAS · rediseño] Las filas de catálogo cargan su texto plano en
    // data-plano (con "…" real, ver __cnPregFila); el resto (Histórico real, desplegable
    // clásico) sigue usando textContent como siempre.
    inp.value = (btn.dataset && btn.dataset.plano) ? btn.dataset.plano : btn.textContent;
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
    // [MODAL-PREGUNTAS · rediseño] Deja seleccionado el primer "…" para que el usuario
    // escriba encima sin tener que borrarlo a mano (equivalente, con nuestro marcador "…",
    // al "hueco seleccionado" del documento de diseño §6 Paso 9).
    var idx = inp.value.indexOf("…");
    if (idx !== -1 && inp.setSelectionRange) { inp.setSelectionRange(idx, idx + 1); }
  };
  // [2026-09-03 · MODAL-PREGUNTAS-REDISEÑO] Dos listeners a nivel `document`, mismo criterio
  // que el listener de clic de más abajo y por el mismo motivo: se registran una vez al cargar
  // el script y resuelven los nodos por id EN CADA evento, así que no dependen del orden de
  // carga ni de que el nodo sobreviva a un repintado. `input` y `shown.bs.tab` burbujean,
  // así que la delegación los alcanza igual.
  //   · input        -> filtra SOLO la categoría activa y repinta su pie.
  //   · shown.bs.tab -> lo dispara Bootstrap al cambiar de pestaña; resincroniza ficha,
  //                     filtro (lo vacía) y pie. Por eso no hace falta limpiar el filtro
  //                     en ningún otro sitio.
  // __cnPregIdxActivo() devuelve el índice de la categoría activa, o -1 si la activa es
  // Histórico (que no es una categoría del catálogo).
  function __cnPregIdxActivo() {
    var activo = document.querySelector("#mc-preguntas-modal .mc-preg-nav__item.active");
    var destino = activo ? (activo.getAttribute("data-bs-target") || "") : "";
    var m = destino.match(/^#mc-preg-pane-(\d+)$/);
    if (!m) return -1;
    var idx = parseInt(m[1], 10);
    return __cnHistSeed[idx] ? idx : -1;
  }
  document.addEventListener("input", function (ev) {
    if (!ev.target || ev.target.id !== "mc-preg-filtro") return;
    var idx = __cnPregIdxActivo();
    if (idx === -1) return;
    __cnPregPie(idx, __cnPregFiltrar(idx, ev.target.value));
  });
  document.addEventListener("shown.bs.tab", function (ev) {
    if (!ev.target || !ev.target.closest || !ev.target.closest("#mc-preguntas-modal")) return;
    __cnPregCatbarSync();
  });
```

---

### 3.5 🔴 MODIFICAR `mainchat_layout.html` — subir los DOS cache-busters (H12, OBLIGATORIO)

Sin este paso el navegador sirve el JS cacheado y el modal queda a medio construir, con el archivo correcto en disco (H12). Dos ediciones de una línea cada una:

**a) Línea 10 — CSS:**
```
ANTES:  <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260903d">
DESPUÉS: <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260903e">
```

**b) Línea 320 — JS:**
```
ANTES:  <script defer src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260831j"></script>
DESPUÉS: <script defer src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260903e"></script>
```

⚠️ **No tocar** los tokens de `mainchat.js`, `acordeon.js`, `historial.js` ni `colapsable.css`: este plan no modifica esos archivos, y subirlos sin motivo invalida cachés buenas.
⚠️ **No quitar el `defer`** del `<script>` (líneas 311-314 explican por qué los 4 van juntos y con defer: `acordeon.js` espera que `window.MultiTabShell` ya exista, y `defer` preserva el orden relativo).

---

## 4. Orden de ejecución

| # | Acción | Archivo | Verificación estática |
|---|---|---|---|
| 1 | Reemplazar `__cnHistSeed` con fragmentos `t/slot/t2/slot2/t3` (§3.1) | `multitab_shell.js` | 7 categorías, 30 items (comando 1) |
| 2 | Reemplazar las funciones de render/filtro/sync (§3.4) | `multitab_shell.js` | 8 funciones nuevas (comando 2) |
| 3 | Reemplazar el bloque `.mc-preg-*` en CSS (§3.2) | `mainchat.css` | Clases nuevas presentes (comandos 6 y 7) |
| 4 | Reemplazar el modal completo en HTML (§3.3) | `mainchat_layout.html` | Comandos 3, 4 y 5 |
| 5 | 🔴 Subir los dos cache-busters (§3.5) | `mainchat_layout.html` | Comando 8 |
| 6 | Consistencia cruzada | todos | Comando 9: los 7 `icono:` del JS coinciden letra a letra con los 7 `<i class="bi ...">` de los tiles del nav |

**Comandos de verificación estática.** PowerShell, **en `c:\APLICACIONES\ProdIA\Repo ProdIA\frontend`**, **línea por línea** (no como bloque: cada uno imprime un número que hay que leer). No requieren consola de administrador.

```powershell
# 1) 30 preguntas en el catálogo nuevo. -SimpleMatch a propósito: con -Pattern, la llave "{"
#    es sintaxis de cuantificador en regex .NET y el patrón queda ambiguo.
(Select-String -Path 'static\js\multitab_shell.js' -SimpleMatch -Pattern '{ t: ' | Measure-Object).Count
# esperado: 30

# 2) Las 8 funciones nuevas existen (una por línea de declaración):
(Select-String -Path 'static\js\multitab_shell.js' -Pattern 'function __cnPreg(SlotHTML|TextoHTML|TextoPlano|Fila|Filtrar|TotalCatalogo|Pie|IdxActivo)\(' | Measure-Object).Count
# esperado: 8

# 3) Los 8 contadores del sidebar:
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'mc-preg-navcount-' | Measure-Object).Count
# esperado: 8

# 4) La ficha, el filtro, el pie y el total existen (una línea cada uno):
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'id="mc-preg-catbar"' | Measure-Object).Count      # esperado: 1
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'id="mc-preg-filtro"' | Measure-Object).Count      # esperado: 1
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'id="mc-preg-foot"' | Measure-Object).Count        # esperado: 1
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'id="mc-preg-total"' | Measure-Object).Count       # esperado: 1

# 5) Los 7 panes de categoría YA NO tienen título propio: solo queda el de Histórico:
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'mc-preg-panel__title' | Measure-Object).Count
# esperado: 1

# 6) Las clases nuevas del rediseño están en el CSS (una regla base por clase):
(Select-String -Path 'MainChat\static\css\mainchat.css' -Pattern '^\.mc-preg-(head|catbar|row|slot|foot|panel) ?\{' | Measure-Object).Count
# esperado: 6

# 7) .mc-preg-item SIGUE en el CSS: Histórico la usa y se reemplazó todo el bloque:
(Select-String -Path 'MainChat\static\css\mainchat.css' -SimpleMatch -Pattern '.mc-preg-item {' | Measure-Object).Count
# esperado: 1

# 8) 🔴 Cache-busters subidos (H12): el token viejo NO debe quedar en ninguno de los dos:
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'multitab_shell.js'' }}?v=20260831j' | Measure-Object).Count
# esperado: 0   (si da 1 -> NO subiste el token del JS; el navegador servirá el JS viejo)
(Select-String -Path 'MainChat\templates\mainchat_layout.html' -SimpleMatch -Pattern 'mainchat.css'' }}?v=20260903d' | Measure-Object).Count
# esperado: 0   (si da 1 -> NO subiste el token del CSS)

# 9) Los 7 iconos de categoría coinciden entre JS y HTML (compara las dos listas en orden):
$js  = Select-String -Path 'static\js\multitab_shell.js' -Pattern 'icono: "(bi-[a-z0-9-]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value }
$htm = Select-String -Path 'MainChat\templates\mainchat_layout.html' -Pattern 'mc-preg-nav__tile"><i class="bi (bi-[a-z0-9-]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value }
"JS : $($js -join ', ')"; "HTML: $($htm -join ', ')"; "Iguales: $(($js -join ',') -eq (($htm | Select-Object -Skip 1) -join ','))"
# esperado: JS lista 7 iconos; HTML lista 8 (el primero es bi-clock-history de Histórico);
#           "Iguales: True" al descartar ese primero.
```

---

## 5. Reglas no negociables

1. **No tocar** `backend\frontend\` (React), `routes/api.py`, `app.py`, el clasificador ni nada del backend (H1).
2. **No reemplazar el contenido del catálogo por el de `moda_q.md`.** El catálogo real (7 categorías renombradas el `d39c955`, 30 preguntas) es la única fuente de verdad de contenido (H2). Este plan solo cambia el fragmentado (`t/slot/...`) y, en 6 casos marcados `⚠️`, recorta una palabra antecedente redundante — nunca el dato que se pide.
3. **La pestaña Histórico no se toca en su lógica de datos** (sigue leyendo `__cnHistory`, dinámico); solo su fila del sidebar recibe el tratamiento visual común (tile+conteo). Su panel conserva `<h6>`+`<p class="hint">` propios, sin ficha compartida ni filtro (H3).
4. **No inventar iconos por pregunta.** Cada fila usa el icono de su categoría, ya validado en el nav (H10).
5. **Regla de contraste:** ningún texto ≤12px en `#6E7C75` (queda solo para iconos); mínimo `#3C4A44`; badges/conteos ≥10.5px (H11, aplicado en todo el CSS de §3.2).
6. **No añadir roving-tabindex ni navegación por flechas nueva** — no existe en ningún otro modal de este repo y no fue pedido explícitamente (H11). Bootstrap ya resuelve `Esc`, focus-trap y `aria-selected`.
7. **El total y los conteos del sidebar se derivan siempre de `items.length`**, nunca se hardcodean (ver `__cnPregTotalCatalogo`).
8. **El filtro se limpia automáticamente al cambiar de categoría** (`__cnPregCatbarSync` vacía `#mc-preg-filtro` y repinta sin filtro cada vez).
9. **Ni «claude» ni «jaguez40» en los 3 archivos de código.** Son los `$TerminosProhibidos` de `migrar_a_azure.ps1:87`: si aparecen en un archivo publicable, **la migración a Azure aborta** (ya pasó el 2026-09-03 con un comentario de `routes/api.py`). Los comentarios de este plan usan la etiqueta `[2026-09-03 · MODAL-PREGUNTAS-REDISEÑO]` y **no citan rutas de `Planes/`** (H16, H17). Este documento de plan sí puede nombrarlos: `Planes/` está excluido del pipeline.
10. **🔴 Subir los dos cache-busters (§3.5) va en el MISMO commit que el código.** Separarlos deja una ventana en la que el navegador sirve JS viejo con HTML nuevo (H12). No subir tokens de archivos que este plan no toca.
11. **No quitar `defer`** del `<script>` de `multitab_shell.js` (líneas 311-314 del HTML explican la garantía de orden que rompería).

---

## 6. Validación

### 6.1 Estática (la ejecuta el executor)
- Los **9 comandos** `Select-String` de §4 dan los valores esperados. Los comandos **8** (cache-busters) y **9** (iconos JS↔HTML) son los que no pueden fallar: el 8 evita el fallo silencioso por caché y el 9 el desalineamiento de índices.
- Recuento manual: 4+6+5+5+5+3+2 = **30** preguntas en el catálogo — igual que antes de este plan.
- `py_compile` no aplica (JS/HTML/CSS). Sustituto: verificar que el archivo JS no quedó a medias comparando el balance de llaves antes y después —
  ```powershell
  $t = Get-Content 'static\js\multitab_shell.js' -Raw
  "abre: $(([regex]::Matches($t,'\{')).Count)  cierra: $(([regex]::Matches($t,'\}')).Count)"
  ```
  Los dos números deben ser **iguales**. (No prueba que el JS sea correcto, pero detecta un bloque truncado, que es el error típico de un reemplazo grande.)

### 6.2 Humana (la valida el usuario) — ⚠️ el único que marca ✅ una feature visual
0. **Comprobar primero que el navegador trae el JS nuevo** (H12): abrir `/mainchat`, F12 → pestaña **Network** → filtrar por `multitab_shell` → la URL pedida debe terminar en **`?v=20260903e`**, no en `?v=20260831j`. Si aparece el token viejo, el paso §3.5 no se aplicó y **todo lo que sigue dará un falso negativo**.
1. `.\frontend\iniciar_frontend.bat` → abrir `http://localhost:5029/mainchat` con **Ctrl+F5**.
2. Clic en 🕐 → el modal abre con **cabecera verde**, icono dorado, «Preguntas» en blanco y el total («30 plantillas») a la derecha, antes del botón de cerrar (blanco, visible sobre el verde).
3. El sidebar muestra las 8 filas (Histórico + 7 categorías), cada una con su icono en una caja, el nombre y un número a la derecha (conteo). La pestaña activa (Histórico, por defecto) tiene fondo blanco + barra verde a la izquierda.
4. Clic en **Cifras de producción** → aparece, arriba de la lista, una ficha con tile verde+icono dorado, el nombre de la categoría, la descripción («El cuánto directo: volúmenes y acumulados») y un campo «Filtrar…» a la derecha.
5. Las preguntas de esa categoría se ven como filas con icono a la izquierda, el hueco resaltado en una **pastilla ámbar con lápiz** (p. ej. «¿Cuál es la producción de `[🖊 activo]`?») y una etiqueta «Cifras de producción» a la derecha. Al pie del panel: «6 de 30 plantillas».
6. Escribir «gas» en el filtro → la lista baja a las preguntas que mencionan «gas»; el pie cambia a «N de 30 plantillas» (N menor).
7. Cambiar a otra categoría → el filtro queda vacío otra vez y la lista vuelve a mostrar el catálogo completo de esa categoría.
8. Clic en una pregunta con un solo hueco → se cierra el modal, el texto aparece en el input **con el `…` seleccionado** (fondo resaltado), listo para escribir encima sin borrar nada.
9. Clic en «¿Cómo vamos este mes?» (sin hueco) → se copia igual, sin selección (no hay `…` que seleccionar), el input queda con el cursor al final.
10. Clic en **Histórico** → vuelve a verse como antes (título fijo, sin ficha, sin filtro, sin pastillas) — comportamiento sin cambios.
11. **F12 → Console con 0 errores** en cualquiera de los pasos anteriores.
12. (Opcional) En la vista clásica `/`, el desplegable del botón 🕐 sigue funcionando con la lista plana (con `…`, sin categorías ni pastillas — sin cambios de comportamiento ahí).

---

## 7. Fuera de alcance

- Reemplazar el catálogo real por el de ejemplo de `moda_q.md` (H2).
- Crear cualquier archivo `.tsx`, Sass o tocar `backend\frontend\` (H1).
- Aplicar ficha compartida, filtro o pastillas a la pestaña Histórico (H3).
- Un icono distinto por cada una de las 30 preguntas (H10).
- Navegación por teclado con flechas / roving tabindex (H11).
- Foco automático en el filtro al abrir el modal (Bootstrap no lo hace por defecto en ningún otro modal de este repo; no se añade infraestructura nueva para esto).
- Accesibilidad "leído en voz alta" del conteo (`<span class="visually-hidden">plantillas</span>` tras el número) — mejora menor, no bloqueante, candidata a una iteración futura si se pide explícitamente.
- Cualquier cambio en el clasificador, el backend o cómo se responde una pregunta.

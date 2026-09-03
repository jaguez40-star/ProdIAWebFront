# Plan — Renombrar y reestructurar las categorías del modal de Preguntas (MainChat)

## 0. Contexto para el agente EXECUTOR

- **Proyecto:** ProdIA — asistente conversacional de producción. Interfaz `/mainchat` (Flask, puerto 5029).
- **Repo:** `frontend\` (ProdIAWebFront). Trabajas en local (Windows, sin VPN). Solo editas código; la BD no interviene en esta tarea.
- **Qué es esto:** el modal «Preguntas» de MainChat agrupa preguntas de ejemplo en categorías. Se abre con el botón 🕐 (reloj). Hoy tiene **6 categorías**; este plan las **renombra** y **parte una en dos** → quedan **7**.
- **Naturaleza del cambio:** 100% cosmético + reorganización de listas de texto. **No toca el clasificador, ni `maquina_q.py`, ni el backend, ni cómo se responde una pregunta.** Solo cambian rótulos visibles y en qué grupo aparece cada pregunta de ejemplo.
- **Archivos que tocarás (exactamente 2):**
  1. `c:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\js\multitab_shell.js`
  2. `c:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\templates\mainchat_layout.html`
- **NO tocas:** `mainchat.css` (verificado: no usa `nth-child` ni índices; todo por clase → una categoría más no requiere CSS nuevo).

---

## 1. Hallazgos de la auditoría (determinan el diseño)

### 🔴 H1 — El índice del array y el índice del panel HTML DEBEN coincidir
`multitab_shell.js:1196-1199` rellena las categorías con este bucle:
```js
for (var i = 0; i < __cnHistSeed.length; i++) {
  var caja = el("mc-preg-cat-" + i);
  if (caja) caja.innerHTML = __cnHistSeed[i].items.map(esc).map(__cnPregItem).join("");
}
```
Es decir: `__cnHistSeed[0]` se pinta en `#mc-preg-cat-0`, `[1]` en `#mc-preg-cat-1`, etc.
**Consecuencia:** el orden de los objetos en `__cnHistSeed` (JS) debe ser IDÉNTICO al orden de los `<div id="mc-preg-cat-N">` (HTML), y hay que respetar el índice N. Si en el JS insertas «Cumplimiento vs metas» en la posición 2, en el HTML el panel de esa categoría debe ser `mc-preg-cat-2`, y todos los índices posteriores se corren en +1.

### 🔴 H2 — Cada categoría vive en 3 sitios que deben quedar consistentes
1. **JS** `__cnHistSeed[N].cat` (`multitab_shell.js:1090-1157`) — el nombre canónico.
2. **HTML nav** — el `<span>` del botón de pestaña (`mainchat_layout.html:210-233`).
3. **HTML panel** — el `<h6 class="mc-preg-panel__title">` (`mainchat_layout.html:241-270`).
Los tres deben mostrar el mismo texto. El `.cat` del JS hoy **no se pinta** en ningún sitio (el modal usa los textos del HTML; el `.cat` solo documenta), pero se mantiene sincronizado por higiene y porque es la etiqueta semántica del grupo.

### 🔴 H3 — Añadir una categoría = 4 fragmentos HTML nuevos, en orden
Cada categoría del modal necesita, en `mainchat_layout.html`:
- **1 botón de nav** (`<button class="mc-preg-nav__item" ... data-bs-target="#mc-preg-pane-N">`), líneas 210-233.
- **1 panel** (`<div class="tab-pane fade" id="mc-preg-pane-N">` con `<h6>`, `<p class="mc-preg-panel__hint">` y `<div id="mc-preg-cat-N">`), líneas 241-270.
El `data-bs-target`, el `aria-controls` y el `id` del panel deben coincidir (`#mc-preg-pane-N` ↔ `id="mc-preg-pane-N"`), y el `id` de la caja interna debe ser `mc-preg-cat-N` con el N que le toca por orden (H1).

### 🟡 H4 — La vista clásica (`/`) NO se ve afectada por este cambio
`__cnHistToggle` (`multitab_shell.js:1207-1234`) bifurca: si existe `#mc-preguntas-modal` (solo en MainChat) usa el modal; si no, aplana `__cnHistSeed` a una lista sin categorías (líneas 1227-1230). El aplanado recorre `__cnHistSeed` sea cual sea su longitud → **funciona con 7 categorías sin tocar nada**. La vista clásica seguirá mostrando la lista plana con las nuevas preguntas incluidas, sin categorías, como hoy.

### 🟡 H5 — El icono de cada categoría se define en el HTML (nav), no en el JS
El `.icono` del `__cnHistSeed` (ej. `"bi-graph-up-arrow"`) **no se usa en el modal**: el icono que se ve sale del `<i class="bi ...">` del botón de nav en el HTML (líneas 211, 215, 219...). Para la categoría nueva hay que elegir un icono Bootstrap y ponerlo en el botón de nav. Se mantiene también en el `.icono` del JS por coherencia.

### 🟢 H6 — El CSS no depende del número de categorías
`mainchat.css:368-416` estiliza `.mc-preg-nav__item`, `.mc-preg-panel__title`, `.mc-preg-item` por clase, sin `nth-child` ni índices. **No se toca.**

### 🟢 H7 — Sin cobertura de test automática
No hay test que asevere estos textos ni la estructura del modal (es HTML/JS de presentación). La validación es exclusivamente humana en el navegador (§6.2). No hay que crear tests.

### 🔴 H8 — `<span>Análisis</span>` y `Cifras` existen DOS veces en `mainchat_layout.html` — NO reemplazar por texto
Verificado con grep sobre el archivo real:
- `<span>Análisis</span>` está en **línea 80** (menú lateral izquierdo, dentro de un botón `data-tab="analisis"` — es la **pestaña real de Análisis de la app**, NADA que ver con el modal) **y** en **línea 212** (el modal).
- `<h6 ...>Análisis</h6>` y `<h6 ...>Cifras</h6>` solo existen dentro del modal, pero el executor NO debe usar buscar-y-reemplazar de cadena para nada.
**Consecuencia:** todo cambio en `mainchat_layout.html` se hace **anclado al bloque del modal** (el `<div class="nav ... mc-preg-nav">` de §3.2 y el `<div class="tab-content mc-preg-content">` de §3.3), reemplazando el conjunto completo de botones/paneles como una unidad. **Prohibido** editar por coincidencia de texto suelto: tocar la línea 80 rompería el menú de navegación de la app. Los tres nombres restantes (`En el tiempo`, `Estructura`, `Operación`) sí aparecen solo 2 veces (nav+panel del modal), pero se aplica la misma regla por uniformidad.

### 🟢 H9 — El pipeline `migrar-a-azure` NO se ve afectado
El skill `frontend\.claude\skills\migrar-a-azure\migrar_a_azure.ps1` tiene un trace-guard (`$TerminosProhibidos = @('claude', 'jaguez40')`, línea 87) que **aborta la publicación si el contenido de un archivo versionado contiene esas palabras** (línea 180-185, escanea `ReadAllText`). Los rótulos nuevos («Diagnóstico de causas», «Cumplimiento vs metas», «Rankings y contribución», «Evolución en el tiempo», «Catálogo y jerarquía», «Eventos operativos») **no contienen** ninguno de los dos términos → el guard no se dispara. Ambos archivos ya pasaron el guard en el deploy anterior. **Pipeline seguro.**

---

## 2. Estado actual (lo que el executor va a ver)

### 2.1 `multitab_shell.js:1090-1157` — el array `__cnHistSeed` (6 categorías)
```js
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
        "¿Cuánto ha producido … en lo que va del año?",
        "¿Cuál es el acumulado de gas de …?",
        "¿Cuánto produjo … el mes pasado?",
        "¿Cómo va … frente al presupuesto este mes?",
        "¿Cuánto produjo … en … vs el operativo?",
        "¿Cuánto produjo … en … contra el contable?",
        "¿Cómo va … frente al promedio del año?"
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

### 2.2 `mainchat_layout.html:205-234` — nav del modal (7 botones: Histórico + 6)
Ver líneas exactas en el archivo. El primer botón es «Histórico» (`#mc-preg-pane-hist`, NO se toca), luego 6 botones para las categorías (`#mc-preg-pane-0` a `#mc-preg-pane-5`).

### 2.3 `mainchat_layout.html:235-271` — paneles del modal (7 paneles: Histórico + 6)
El panel Histórico (`#mc-preg-pane-hist`, líneas 236-240) **NO se toca**. Los 6 paneles de categoría (`#mc-preg-pane-0` a `#mc-preg-pane-5`) llevan `<h6>`, un `<p class="mc-preg-panel__hint">` (todos con el mismo texto «Edita el «…» antes de enviar.») y un `<div id="mc-preg-cat-N">`.

---

## 3. Especificación

### 3.0 Mapa de la transformación (de 6 a 7 categorías)

| Índice | Nombre ACTUAL | Nombre NUEVO | Cambio en items |
|---|---|---|---|
| 0 | Análisis | **Diagnóstico de causas** | quitar «¿Cómo vamos este mes?» (se mueve a la 2) |
| 1 | Cifras | **Cifras de producción** | quitar las 4 preguntas «vs presupuesto/operativo/contable/promedio» (se mueven a la 2) |
| **2** | *(no existía)* | **Cumplimiento vs metas** | **categoría nueva** — recibe las 5 preguntas movidas |
| 3 | Comparar y ordenar | **Rankings y contribución** | sin cambio de items |
| 4 | En el tiempo | **Evolución en el tiempo** | sin cambio de items |
| 5 | Estructura | **Catálogo y jerarquía** | sin cambio de items |
| 6 | Operación | **Eventos operativos** | sin cambio de items |

**Preguntas que se mueven a «Cumplimiento vs metas» (índice 2), en este orden:**
1. `"¿Cómo vamos este mes?"` (venía de Análisis)
2. `"¿Cómo va … frente al presupuesto este mes?"` (venía de Cifras)
3. `"¿Cuánto produjo … en … vs el operativo?"` (venía de Cifras)
4. `"¿Cuánto produjo … en … contra el contable?"` (venía de Cifras)
5. `"¿Cómo va … frente al promedio del año?"` (venía de Cifras)

**Icono de la categoría nueva:** `bi-bullseye` (diana = «metas»).

---

### 3.1 MODIFICAR `multitab_shell.js` — reemplazar el array `__cnHistSeed` completo

**Acción:** localizar el bloque `var __cnHistSeed = [ ... ];` (líneas 1090-1157, mostrado íntegro en §2.1) y **reemplazarlo entero** por este:

```js
  var __cnHistSeed = [
    {
      cat: "Diagnóstico de causas",
      icono: "bi-graph-up-arrow",
      items: [
        "Analiza el comportamiento del producto …",
        "Analiza el comportamiento de la producción de … en el Campo …",
        "¿Qué campos explican el faltante de …?",
        "¿Cuáles son las causas de las diferidas en el campo …?"
      ]
    },
    {
      cat: "Cifras de producción",
      icono: "bi-123",
      items: [
        "¿Cuánto crudo produjo el campo …?",
        "¿Cuál es la producción del activo …?",
        "¿Cuál es el acumulado del año de …?",
        "¿Cuánto ha producido … en lo que va del año?",
        "¿Cuál es el acumulado de gas de …?",
        "¿Cuánto produjo … el mes pasado?"
      ]
    },
    {
      cat: "Cumplimiento vs metas",
      icono: "bi-bullseye",
      items: [
        "¿Cómo vamos este mes?",
        "¿Cómo va … frente al presupuesto este mes?",
        "¿Cuánto produjo … en … vs el operativo?",
        "¿Cuánto produjo … en … contra el contable?",
        "¿Cómo va … frente al promedio del año?"
      ]
    },
    {
      cat: "Rankings y contribución",
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
      cat: "Evolución en el tiempo",
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
      cat: "Catálogo y jerarquía",
      icono: "bi-diagram-3",
      items: [
        "¿Qué campos tiene el activo …?",
        "¿A qué activo pertenece el campo …?",
        "¿Cuántos pozos tiene …?"
      ]
    },
    {
      cat: "Eventos operativos",
      icono: "bi-tools",
      items: [
        "¿Qué mantenimientos se han realizado en el campo …, en el último mes?",
        "¿Qué diferidas hubo en …?"
      ]
    }
  ];
```

> Nota executor: no cambies nada fuera de este bloque en el JS. El bucle de pintado (líneas ~1196-1199) y el aplanado de la vista clásica (líneas ~1227-1230) ya recorren el array por longitud → funcionan con 7 elementos sin tocarse.

---

### 3.2 MODIFICAR `mainchat_layout.html` — el NAV del modal (botones de pestaña)

> ⚠️ **H8 — NO uses buscar-y-reemplazar de texto.** `<span>Análisis</span>` también está en la línea 80 (menú lateral de la app) y `<span>Cifras</span>` podría estar en otros sitios. **Ancla el cambio al bloque del modal**: el contenedor `<div class="nav flex-column mc-preg-nav" ...>` (empieza en la línea 205). Todo lo que edites en este paso vive DENTRO de ese `<div>`.

**Acción:** dentro del `<div class="nav flex-column mc-preg-nav">`, localizar el bloque de los 6 botones de categoría (líneas 210-233, los que empiezan en `#mc-preg-pane-0` y terminan en `#mc-preg-pane-5`; el botón «Histórico» de las líneas 206-209 **NO se toca**) y **reemplazar esos 6 botones** por estos **7**:

```html
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-0" type="button" role="tab" aria-controls="mc-preg-pane-0" aria-selected="false">
                        <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>
                        <span>Diagnóstico de causas</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-1" type="button" role="tab" aria-controls="mc-preg-pane-1" aria-selected="false">
                        <i class="bi bi-123" aria-hidden="true"></i>
                        <span>Cifras de producción</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-2" type="button" role="tab" aria-controls="mc-preg-pane-2" aria-selected="false">
                        <i class="bi bi-bullseye" aria-hidden="true"></i>
                        <span>Cumplimiento vs metas</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-3" type="button" role="tab" aria-controls="mc-preg-pane-3" aria-selected="false">
                        <i class="bi bi-bar-chart-steps" aria-hidden="true"></i>
                        <span>Rankings y contribución</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-4" type="button" role="tab" aria-controls="mc-preg-pane-4" aria-selected="false">
                        <i class="bi bi-calendar3" aria-hidden="true"></i>
                        <span>Evolución en el tiempo</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-5" type="button" role="tab" aria-controls="mc-preg-pane-5" aria-selected="false">
                        <i class="bi bi-diagram-3" aria-hidden="true"></i>
                        <span>Catálogo y jerarquía</span>
                    </button>
                    <button class="mc-preg-nav__item" data-bs-toggle="pill" data-bs-target="#mc-preg-pane-6" type="button" role="tab" aria-controls="mc-preg-pane-6" aria-selected="false">
                        <i class="bi bi-tools" aria-hidden="true"></i>
                        <span>Eventos operativos</span>
                    </button>
```

---

### 3.3 MODIFICAR `mainchat_layout.html` — los PANELES del modal

> ⚠️ **H8 — Mismo cuidado.** Ancla el cambio al contenedor `<div class="tab-content mc-preg-content">` (empieza en la línea 235). Los `<h6>` de este paso viven DENTRO de ese `<div>`. No edites por coincidencia de texto.

**Acción:** dentro del `<div class="tab-content mc-preg-content">`, localizar el bloque de los 6 paneles de categoría (líneas 241-270, los `<div class="tab-pane fade" id="mc-preg-pane-0">` … `id="mc-preg-pane-5">`; el panel «Histórico» de las líneas 236-240 **NO se toca**) y **reemplazar esos 6 paneles** por estos **7**:

```html
                    <div class="tab-pane fade" id="mc-preg-pane-0" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Diagnóstico de causas</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-0"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-1" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Cifras de producción</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-1"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-2" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Cumplimiento vs metas</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-2"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-3" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Rankings y contribución</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-3"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-4" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Evolución en el tiempo</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-4"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-5" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Catálogo y jerarquía</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-5"></div>
                    </div>
                    <div class="tab-pane fade" id="mc-preg-pane-6" role="tabpanel">
                        <h6 class="mc-preg-panel__title">Eventos operativos</h6>
                        <p class="mc-preg-panel__hint">Edita el «…» antes de enviar.</p>
                        <div id="mc-preg-cat-6"></div>
                    </div>
```

---

## 4. Orden de ejecución

| # | Acción | Archivo | Verificación estática |
|---|---|---|---|
| 1 | Reemplazar `__cnHistSeed` (§3.1) | `multitab_shell.js` | El archivo tiene **7** objetos con `cat:`; grep de los 7 nombres nuevos da 1 cada uno; grep de `"Análisis"`/`"Cifras"`/`"Comparar y ordenar"`/`"En el tiempo"`/`"Estructura"`/`"Operación"` **como valor de `cat:`** da 0 |
| 2 | Reemplazar los 6 botones de nav por 7 (§3.2) | `mainchat_layout.html` | Existe `data-bs-target="#mc-preg-pane-6"` en un botón; los 7 `<span>` tienen los nombres nuevos |
| 3 | Reemplazar los 6 paneles por 7 (§3.3) | `mainchat_layout.html` | Existe `id="mc-preg-pane-6"` y `id="mc-preg-cat-6"`; los 7 `<h6>` tienen los nombres nuevos |
| 4 | Consistencia cruzada | ambos | Para cada N de 0 a 6: el `.cat` del JS[N], el `<span>` del botón N y el `<h6>` del panel N dicen el MISMO texto (ver tabla §3.0) |

**Comandos de verificación estática (PowerShell, en `c:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, línea por línea):**
```powershell
# 1) El array JS tiene 7 categorías (patrón anclado a inicio de propiedad, evita contar comentarios):
Select-String -Path 'static\js\multitab_shell.js' -Pattern 'cat: "[^"]' | Measure-Object | Select-Object -ExpandProperty Count
# esperado: 7

# 2) La 7ª categoría existe en el HTML (panel + caja):
Select-String -Path 'MainChat\templates\mainchat_layout.html' -Pattern 'mc-preg-cat-6' | Measure-Object | Select-Object -ExpandProperty Count
# esperado: 1
Select-String -Path 'MainChat\templates\mainchat_layout.html' -Pattern 'mc-preg-pane-6' | Measure-Object | Select-Object -ExpandProperty Count
# esperado: 3  (nav: data-bs-target + aria-controls ; panel: id)

# 3) La categoría nueva aparece 2 veces en el HTML (<span> nav + <h6> panel) y 1 en el JS:
Select-String -Path 'MainChat\templates\mainchat_layout.html' -Pattern 'Cumplimiento vs metas' | Measure-Object | Select-Object -ExpandProperty Count
# esperado: 2
Select-String -Path 'static\js\multitab_shell.js' -Pattern 'Cumplimiento vs metas' | Measure-Object | Select-Object -ExpandProperty Count
# esperado: 1

# 4) 🔴 REGRESIÓN H8 — el menú lateral de la app NO se tocó: "Análisis" debe seguir existiendo (línea 80) y "Cifras" NO debe existir como <span> suelto fuera del modal.
#    Tras el cambio, <span>Análisis</span> debe quedar SOLO en la línea 80 (el modal ya no lo usa):
Select-String -Path 'MainChat\templates\mainchat_layout.html' -Pattern '<span>Análisis</span>' | Measure-Object | Select-Object -ExpandProperty Count
# esperado: 1   (SOLO el menú lateral; si da 0 -> rompiste el menú; si da 2 -> no renombraste el modal)
```

---

## 5. Reglas no negociables

1. **No tocar** `mainchat.css`, ni `routes/api.py`, ni `app.py`, ni ningún archivo del backend.
2. **No tocar** el botón ni el panel «Histórico» (`#mc-preg-pane-hist`) — es la primera pestaña y no es una categoría.
3. **No tocar** el bucle de pintado del JS (`for ... mc-preg-cat-i`) ni el aplanado de la vista clásica. Ya soportan 7 categorías por longitud.
4. **El orden manda:** el objeto N del array, el botón N del nav y el panel N deben corresponder al mismo índice y al mismo texto (H1). No reordenar por gusto.
5. **No inventar preguntas nuevas ni borrar preguntas existentes.** Solo se mueven las 5 indicadas en §3.0. El total de items debe conservarse: 30 antes (5+10+5+5+3+2), 30 después (4+6+5+5+5+3+2).
6. **Texto exacto:** copiar los rótulos y las preguntas tal cual están en §3, con sus tildes, «…», «¿» y «%». No normalizar comillas ni espacios.

---

## 6. Validación

### 6.1 Estática (la ejecuta el executor)
- Los comandos `Select-String` de §4 dan los valores esperados — **incluido el de regresión H8** (`<span>Análisis</span>` = 1, solo el menú lateral).
- Recuento manual de items: 4+6+5+5+5+3+2 = **30** (igual que antes).
- Cruce §3.0: los 7 nombres coinciden en JS / nav / panel.
- El menú lateral izquierdo (línea ~78-81, `data-tab="analisis"`) quedó intacto.

### 6.2 Humana (la valida el usuario) — ⚠️ el único que marca ✅ una feature visual
La app real corre en Pruebas, pero este cambio es HTML/JS estático y se puede validar en local:
1. `.\frontend\iniciar_frontend.bat` → abrir `http://localhost:5029/mainchat` con **Ctrl+F5** (el JS está cacheado).
2. Clic en el botón 🕐 → el modal abre.
3. La barra izquierda muestra, en orden: **Histórico, Diagnóstico de causas, Cifras de producción, Cumplimiento vs metas, Rankings y contribución, Evolución en el tiempo, Catálogo y jerarquía, Eventos operativos** (8 pestañas: 1 + 7).
4. Clic en **Cumplimiento vs metas** → aparecen las 5 preguntas (¿Cómo vamos este mes?, frente al presupuesto, vs el operativo, contra el contable, frente al promedio del año).
5. Clic en **Cifras de producción** → ya NO están las 4 «vs …» ni «¿Cómo vamos este mes?».
6. Clic en cualquier pregunta → se copia al input (no se envía). El modal se cierra.
7. **F12 → Console con 0 errores.**
8. (Opcional) En la vista clásica `/` el botón 🕐 sigue abriendo la lista plana, ahora con las mismas preguntas sin categorías.

---

## 7. Fuera de alcance

- Cambiar el icono, color o estilo del modal (solo se añade un icono a la categoría nueva).
- Cambiar el texto del hint «Edita el «…» antes de enviar.» (se conserva idéntico).
- Añadir o quitar preguntas de ejemplo más allá de los 5 movimientos especificados.
- Cualquier cambio en el clasificador, el backend o cómo se responde una pregunta.
- La vista clásica `/`: no se modifica; hereda el cambio automáticamente vía el aplanado.

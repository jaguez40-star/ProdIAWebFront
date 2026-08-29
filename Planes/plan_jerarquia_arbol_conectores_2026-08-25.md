# Plan · Rediseño del panel JERARQUIZAR — árbol con conectores

**Fecha:** 2026-08-25
**Origen:** `jerarq_elem.md` (diseño aprobado, artboard B · Árbol con conectores)
**Tipo:** rediseño de **presentación**. El backend, el clasificador, el SQL y el LLM **no se tocan**.
**Archivos que se modifican:** 3 (`multitab_shell.js`, `colapsable.css`, `mainchat_layout.html`).

---

## 0 · Contexto para quien ejecuta

El panel derecho ("Insights") pinta una tarjeta por respuesta. Cuando el Motor Q v2 clasifica
la pregunta como **jerarquizar**, el backend
(`INGESTA/Rep_Prod/backend/app/features/consulta_v2/respuesta_jerarquizar.py`) devuelve un
`panel` con `tipo: "jerarq_arbol"` o `"jerarq_operador"`, y el frontend lo despacha en
`multitab_shell.js:2980-2982` hacia funciones **puras que devuelven un string HTML**.

Ese render actual es un listado plano con sangría por `padding-left` inline. Se reemplaza por
un árbol con conectores L en CSS.

> ⚠️ **`jerarq_elem.md` está escrito contra React 19 + TypeScript + Sass + Vitest.**
> Este proyecto **no tiene nada de eso**: es JS ES5 plano y un `.css` sin compilador.
> Las §3 (estructura de archivos `.tsx`), §5 (`HierarchyPayload`), §7 (bloque Sass) y §10
> (tests RTL) **no se aplican literalmente** — se traducen según este plan.
> Lo que sí se respeta al pie de la letra: **los valores exactos** (hex, px, iconos) de §4,
> §Paso 4, §Paso 5, §Paso 6 y las reglas de contraste de §2.

---

## 0.1 · Verificación previa del plan (2026-08-25) — LEER ANTES DE EJECUTAR

Este plan se auditó contra el código real. Cinco hallazgos cambiaron su contenido:

| # | Hallazgo | Efecto en el plan |
|---|---|---|
| **H1** | **`__cnJerRankHtml` NO usa `.cn-jer*`** — usa `.cn-rank*` (`multitab_shell.js:3547-3568`, verificado línea a línea). | El riesgo que la v1 dejaba abierto **no existe**. El bloque `.cn-jer*` se elimina limpio: `__cnJer­ArbolHtml` y `__cnJerOperadorHtml` son sus **únicos** consumidores. Se elimina el paso de "verificar antes de borrar". |
| **H2** | **`.cn-stk__body` ya aporta padding**: el bloque contenedor es `.cn-stk { padding:10px 12px 12px }` (`colapsable.css:1414`) dentro de `.cn-stack { padding:14px }` (`:1411`). | El `padding:10px 14px 13px` que §Paso 1 pide para `.jq-tree` **se sumaría** al del contenedor → ~26px de margen interno. Se reduce a `padding:2px 0 0` y el pie compensa con márgenes negativos. Ver §5. |
| **H3** | **La animación de entrada `.cn-stk--in` es frágil por diseño**: `colapsable.css:1417-1424` documenta que **nada** puede alterar el ALTO del bloque, porque `__cnStackScroll` mide con ResizeObserver y espera 600ms de calma. Animar `height`/`scale` retrasaría la bajada hasta el techo de 8s. | **Regla dura añadida:** el CSS nuevo no lleva `transition`/`animation` sobre propiedades que afecten el alto. Esto conecta directo con el bug de scroll que costó 3 intentos (`leccion_frontend_medir_antes_2026-08-24.md`). Ver §5 y la verificación §7.2-8. |
| **H4** | **`esc()` no escapa `'`** (`multitab_shell.js:29-31`: solo `& < > "`). | El `title="..."` del plan v1 usa comillas dobles → **es seguro** con esta `esc()`. Queda documentado para que el executor no cambie a comillas simples. |
| **H5** | **No existe `CLAUDE.md`** en el repo. | Las convenciones vinculantes son las que el propio código documenta en sus comentarios: scroll único (`:1400-1405`), no alterar alturas (`:1417-1424`), reusar paleta existente (`:2103`). Este plan las cita explícitamente. |

**Oportunidad de mejora detectada (fuera de alcance, anotada para después):** el backend recorta
a 14 items en `_tope_panel` **sin** que el mensaje del chat lo diga; solo el panel muestra el
"+N más". Si en el futuro se quiere el expandible de §8 del diseño, el cambio mínimo es que
`_tope_panel` devuelva también los sobrantes. No se hace aquí.

---

## 1 · Decisiones ya tomadas (no reabrir)

| Tema | Decisión | Razón |
|---|---|---|
| Stack | JS ES5 + CSS plano, funciones puras que devuelven string | Es el patrón de los 8 renders de panel que ya existen. Introducir React aquí sería un proyecto aparte. |
| Prefijo de clases | **`jq-`** tal como pide el diseño | No colisiona con `cn-jer` ni con nada del repo (verificado). |
| Clases `.cn-jer*` viejas | **Se eliminan del CSS** (2085-2098) | H1: sus únicos consumidores son las dos funciones que se reescriben. `__cnJerRankHtml` usa `.cn-rank*`, no depende de ellas. |
| Alturas y animaciones | **Ningún** `transition`/`animation` en `.jq-*` | H3: `__cnStackScroll` mide con ResizeObserver y espera 600ms de calma (`colapsable.css:1417-1424`). Animar el alto rompe la bajada del panel. |
| Comillas del `title` | **Dobles**, siempre | H4: `esc()` escapa `"` pero **no** `'`. Con comillas simples un nombre con apóstrofo rompería el atributo. |
| Sass `$jq-*` | Sustituir por el hex literal de §4 | No hay compilador de Sass en el proyecto. |
| Scroll | `text-overflow:ellipsis` + `title`, **nunca** overflow propio | Regla de oro documentada en `colapsable.css:2102`: el único scroller del panel es `.cn-col`. |
| Backend | **Cero cambios** | Ver §3 para el "+N más". |

---

## 2 · El payload real (lo que de verdad llega)

`jerarq_elem.md` §5 inventa un `HierarchyPayload` con `shape:'path'|'fan'`. **Ese objeto no
existe.** Lo que el backend envía (`respuesta_jerarquizar.py:538-559`) es:

```js
// tipo: "jerarq_arbol"
{
  entidad: "CHICHIMENE",
  nivel: "activo",                    // campo|activo|gerencia|vicepresidencia
  puente: null,                       // o un nivel: el level-shift (§4.4)
  padres: [ {nivel:"vicepresidencia", items:["GCH"]},
            {nivel:"gerencia",        items:["PDH"]} ],
  hijos_grupos: [ {nivel:"campo", items:["CHICHIMENE","CHICHIMENE SW"],
                   total:2, truncado:false, es_hermanos:false} ],
  pozos: 289,                         // puede ser null
  operador: null,
  fuera_estructura: false,
}

// tipo: "jerarq_operador"
{ entidad:"...", campos:[...], total:N, truncado:bool }
```

**Correspondencia con el diseño — se deriva, no se recibe:**

- `shape:'path'` ⟺ `padres.length > 0` → los grupos hijos cuelgan de la entidad.
- `shape:'fan'` ⟺ `padres.length === 0` → root a depth 0, grupos con `GroupDivider`.
- `focus` ⟺ la fila de la entidad consultada (siempre existe, es `d.entidad`).
- `count` del focus ⟺ **suma de `total` de todos los `hijos_grupos`**.
- `items[]` de `padres` puede traer **más de uno** por nivel → se unen con `", "` en una sola fila, como hoy (`multitab_shell.js:3491`).

**No hay adapter.** Se lee el payload real directamente. Escribir un adapter hacia el
`HierarchyPayload` ficticio de §5 añadiría una capa sin ningún consumidor.

---

## 3 · Cuatro campos que el diseño ignora — y qué hacer con ellos

| Campo | El diseño | Qué se hace | Decisión |
|---|---|---|---|
| **`puente`** | No lo menciona | Nota de level-shift (Opción A, decisión de producto 2026-08-02): *"Lo que en el reporte diario llamas «Gerencia GOR» es, en la estructura oficial, Vicepresidencia GOR"*. **Se conserva**, encima del árbol. | Estilo ámbar actual, reetiquetado `.jq-nota` (ver §5). Es un aviso, debe seguir leyéndose como aviso. |
| **`fuera_estructura`** | No lo menciona | Campo de tercero, sin ancestros. **Se conserva** el render propio: cabecera + nota, sin árbol. | Estilo ámbar, igual que `puente`. |
| **`es_hermanos`** | No lo menciona | Cambia el título del grupo a *"Otros campos del mismo Activo"* en vez de *"Campos (N)"*. **Se conserva** en el `GroupDivider`. | — |
| **`truncado`/`total`** | §8 pide "8 + botón +N más que **expande al hacer clic**" | **Imposible**: el backend ya recorta a 14 en `_tope_panel` y los sobrantes **no viajan en el payload**. | Se mantiene el tope de 14 y el "+N más" queda **informativo, no pulsable** (como hoy, `multitab_shell.js:3514`). Sin backend, no hay nada que expandir. |

**`jerarq_operador`** es un cuarto caso que `jerarq_elem.md` tampoco menciona
(`multitab_shell.js:3527`): "operador" no es un nivel de la jerarquía, se pinta sin árbol.
Se migra al nuevo lenguaje visual pero conserva su estructura.

---

## 4 · Implementación

Todo en `static/js/multitab_shell.js`, en el bloque que hoy ocupan `__cnJerArbolHtml` y
`__cnJerOperadorHtml` (**líneas 3466-3541**). Se reescriben en sitio; el despacho de
`:2980-2982` no cambia (mismos nombres de función, mismos tipos de panel).

**`__cnJerRankHtml` (`:3543`, tipo `jerarq_rank`) queda intacto** — es el ranking estructural,
otro panel, fuera de alcance.

### 4.1 Metadatos de nivel

Reemplaza la constante `__CN_JER_LVL` de `:3468`:

```js
// [2026-08-25] Metadatos por nivel del árbol jerárquico (jerarq_elem.md §4).
// `abbr` va en el chip mono; `label` completo va al lector de pantalla (§9) y a los
// títulos de grupo. "operador" NO está aquí a propósito: no es un nivel de la jerarquía.
var __CN_JER_NIV = {
  vicepresidencia: {label: "Vicepresidencia", abbr: "VP",  icon: "diagram-3-fill"},
  gerencia:        {label: "Gerencia",        abbr: "GER", icon: "buildings-fill"},
  activo:          {label: "Activo",          abbr: "ACT", icon: "layers-fill"},
  campo:           {label: "Campo",           abbr: "CMP", icon: "geo-alt-fill"},
  pozo:            {label: "Pozo",            abbr: "POZ", icon: "record-circle"}
};
function __cnJerNiv(k) {
  return __CN_JER_NIV[k] || {label: String(k || ""), abbr: String(k || "").slice(0,3).toUpperCase(),
                             icon: "dot"};
}
```

> Los 5 iconos son de **Bootstrap Icons**, ya cargado en el proyecto (el código usa `bi bi-*`
> en `:1029` y en los chips de `:4674`). No se añade ninguna dependencia.

### 4.2 Nodo — `__cnJerNodoHtml`

El corazón. Traduce §Paso 4. Rieles + cuerpo, todo con las medidas exactas del diseño.

```js
// Nodo del árbol: `depth` rieles de 20px + cuerpo. El último riel es el CODO (is-elbow);
// si el nodo es el último de su grupo, el codo se corta a media altura (is-last → "└").
// aria-level = depth+1 (§9). Los rieles son decorativos.
function __cnJerNodoHtml(nivel, valor, opts) {
  opts = opts || {};
  var L = __cnJerNiv(nivel), depth = opts.depth || 0, rails = "";
  for (var i = 0; i < depth; i++) {
    var cls = "jq-rail";
    if (i === depth - 1) { cls += " is-elbow"; if (opts.last) cls += " is-last"; }
    rails += '<span class="' + cls + '" aria-hidden="true"></span>';
  }
  var tile = opts.focus ? "is-focus" : (opts.leaf ? "is-leaf" : "");
  var count = (opts.count != null)
    ? '<span class="jq-node__count">' + opts.count + '</span>' : "";
  var badge = opts.focus
    ? '<span class="jq-node__badge">CONSULTADO</span>' : "";
  return '<div class="jq-node" role="treeitem" aria-level="' + (depth + 1) + '">' + rails +
    '<div class="jq-node__body">' +
      '<span class="jq-node__tile ' + tile + '" aria-hidden="true">' +
        '<i class="bi bi-' + L.icon + '"></i></span>' +
      '<span class="jq-node__abbr" aria-hidden="true">' + esc(L.abbr) + '</span>' +
      '<span class="jq-vh">' + esc(L.label) + '</span>' +
      '<span class="jq-node__value ' + (opts.focus ? "is-focus" : "") + '" title="' +
        esc(valor) + '">' + esc(valor) + '</span>' +
      count + badge +
    '</div></div>';
}
```

- `esc()` ya existe en el archivo — **usarla en todo valor**, los nombres vienen de BD.
- `.jq-vh` = `visually-hidden`: el chip abreviado es decorativo, el nombre completo del nivel
  es lo que se lee (§9).
- `title` en el valor cubre el caso de nombres largos con ellipsis (§8).

### 4.3 Separador de grupo — `__cnJerGrupoHtml`

Traduce §Paso 5. Se usa en **ambos** casos (ruta y abanico), no solo en abanico: el listado
de hijos necesita el mismo encabezado que hoy da `.cn-jer__kidshd`.

```js
// Encabezado de un grupo de hijos: "CAMPOS (2)" + regla horizontal. `es_hermanos` conserva
// el texto especial de hoy (:3501) — el usuario preguntó por un campo y se listan sus pares.
function __cnJerGrupoHtml(g, first) {
  var L = __cnJerNiv(g.nivel);
  var txt = g.es_hermanos
    ? "Otros campos del mismo Activo"
    : L.label + (g.total === 1 ? "" : "s") + (g.total != null ? " (" + g.total + ")" : "");
  return '<div class="jq-group' + (first ? " is-first" : "") + '">' +
    '<span class="jq-group__label">' + esc(txt) + '</span>' +
    '<span class="jq-group__rule" aria-hidden="true"></span></div>';
}
```

> `Vicepresidencia` no se pluraliza (§4). Con el payload real esto **no se da**: un grupo de
> hijos nunca es de nivel vicepresidencia (es la raíz de la jerarquía). No se añade lógica
> para un caso que no puede ocurrir.

### 4.4 Árbol — `__cnJerArbolHtml` (reescribe `:3476`)

```js
function __cnJerArbolHtml(d) {
  // Fuera de estructura (campo de tercero): sin ancestros que dibujar → nodo + nota, sin árbol.
  if (d.fuera_estructura) {
    return '<div class="jq-tree" role="tree">' +
      __cnJerNodoHtml("campo", d.entidad || "", {depth: 0, focus: true}) +
      '<div class="jq-nota">Fuera de la estructura económica de ECP: sin activo, gerencia ' +
      'ni vicepresidencia en la fuente oficial.' +
      (d.operador ? " Operador: " + esc(d.operador) + " (tercero)." : "") + '</div></div>';
  }

  var padres = d.padres || [], grupos = d.hijos_grupos || [], html = "", depth = 0;

  // Level-shift (Opción A): el término del usuario no se niega, se reconoce. Va ARRIBA,
  // antes del árbol — es contexto para leer lo que viene, no una nota al pie.
  if (d.puente) {
    html += '<div class="jq-nota">Lo que en el reporte diario llamas «' +
      esc(__cnJerNiv(d.puente).label) + ' ' + esc(d.entidad || "") + '» es, en la estructura ' +
      'oficial, ' + esc(__cnJerNiv(d.nivel).label) + ' ' + esc(d.entidad || "") + '.</div>';
  }

  // Ancestros, de VP hacia abajo. Varios items del mismo nivel → una fila, unidos por coma
  // (comportamiento actual, :3491).
  padres.forEach(function (g) {
    html += __cnJerNodoHtml(g.nivel, (g.items || []).join(", "), {depth: depth});
    depth++;
  });

  // La entidad consultada. `count` = total de hijos sumando TODOS los grupos (§5).
  var total = 0, hay = false;
  grupos.forEach(function (g) { if (g.total != null) { total += g.total; hay = true; } });
  html += __cnJerNodoHtml(d.nivel, d.entidad || "",
                          {depth: depth, focus: true, count: hay ? total : null});
  depth++;

  // Grupos de hijos. El divisor se sangra al mismo nivel que los nodos que encabeza.
  grupos.forEach(function (g, gi) {
    html += __cnJerGrupoHtml(g, gi === 0);
    var items = g.items || [];
    if (!items.length) {
      // Sin hijos (§8): no dejar el árbol truncado — decirlo explícitamente.
      html += '<div class="jq-node" role="treeitem" aria-level="' + (depth + 1) + '">' +
        '<span class="jq-rail is-elbow is-last" aria-hidden="true"></span>' +
        '<div class="jq-node__body"><span class="jq-vacio">' +
        (g.es_hermanos ? "Ninguno (es el único)" : "Sin " + __cnJerNiv(g.nivel).label.toLowerCase() +
         "s asociados") + '</span></div></div>';
      return;
    }
    items.forEach(function (nm, i) {
      // `truncado` → el "+N más" es el último renglón visible, así que el codo "└" le
      // corresponde a él, no al último item.
      var esUltimo = (i === items.length - 1) && !g.truncado;
      html += __cnJerNodoHtml(g.nivel, nm, {depth: depth, leaf: true, last: esUltimo});
    });
    if (g.truncado) {
      html += '<div class="jq-node" role="treeitem" aria-level="' + (depth + 1) + '">' +
        '<span class="jq-rail is-elbow is-last" aria-hidden="true"></span>' +
        '<div class="jq-node__body"><span class="jq-more">+' + (g.total - items.length) +
        ' más (' + g.total + ' en total)</span></div></div>';
    }
  });

  return '<div class="jq-tree" role="tree">' + html + '</div>' + __cnJerPieHtml(d.pozos);
}
```

> **El caso ruta y el caso abanico salen del mismo código.** Con `padres:[]` (abanico), el
> bucle de ancestros no itera, el focus queda a depth 0 y los hijos a depth 1 — exactamente
> lo que pide §Paso 3. No hacen falta dos funciones.

### 4.5 Pie de pozos — `__cnJerPieHtml`

Traduce §Paso 6.

```js
// §8: sin dato de pozos NO se muestra "0" — se oculta el pie. `pozos` llega null cuando
// robustez_v02 no está disponible (p.ej. el servidor 139): el árbol debe seguir íntegro.
function __cnJerPieHtml(pozos) {
  if (pozos == null) return "";
  var n = Number(pozos);
  var fmt = isFinite(n) ? n.toLocaleString("es-CO") : String(pozos);
  return '<div class="jq-foot">' +
    '<i class="bi bi-record-circle" aria-hidden="true"></i>' +
    '<span class="jq-foot__label">Pozos asociados</span>' +
    '<span class="jq-foot__value">' + esc(fmt) + '</span></div>';
}
```

### 4.6 Operador — `__cnJerOperadorHtml` (reescribe `:3527`)

```js
// "operador" NO es un nivel de la jerarquía (lo dice el backend) → sin árbol ni rieles:
// la empresa a depth 0 y sus campos como hojas a depth 1, con el mismo lenguaje visual.
function __cnJerOperadorHtml(d) {
  var campos = d.campos || [], total = d.total || 0;
  var html = '<div class="jq-node" role="treeitem" aria-level="1"><div class="jq-node__body">' +
    '<span class="jq-node__tile is-focus" aria-hidden="true">' +
      '<i class="bi bi-building"></i></span>' +
    '<span class="jq-node__abbr" aria-hidden="true">OPE</span>' +
    '<span class="jq-vh">Operador</span>' +
    '<span class="jq-node__value is-focus">' + esc(d.entidad || "") + '</span>' +
    '<span class="jq-node__count">' + total + '</span></div></div>' +
    '<div class="jq-nota">Empresa — no es un nivel de la jerarquía.</div>' +
    __cnJerGrupoHtml({nivel: "campo", total: total, es_hermanos: false}, true);
  campos.forEach(function (nm, i) {
    html += __cnJerNodoHtml("campo", nm,
      {depth: 1, leaf: true, last: (i === campos.length - 1) && !d.truncado});
  });
  if (d.truncado) {
    html += '<div class="jq-node" role="treeitem" aria-level="2">' +
      '<span class="jq-rail is-elbow is-last" aria-hidden="true"></span>' +
      '<div class="jq-node__body"><span class="jq-more">+' + (total - campos.length) +
      ' más (' + total + ' en total)</span></div></div>';
  }
  return '<div class="jq-tree" role="tree">' + html + '</div>';
}
```

---

## 5 · CSS — `static/css/colapsable.css`

**Sustituye** el bloque `.cn-jer*` de **líneas 2085-2098** por lo siguiente. Traduce §7 de Sass
a CSS plano, con los hex literales de §4.

```css
/* [2026-08-25] Panel JERARQUIZAR — árbol con conectores (plan_jerarquia_arbol_conectores_
   2026-08-25.md; diseño jerarq_elem.md, artboard B). Reemplaza el bloque .cn-jer* anterior
   (listado plano con sangría inline). Consumidores: __cnJerArbolHtml / __cnJerOperadorHtml.

   TRES REGLAS DEL PROYECTO QUE ESTE BLOQUE RESPETA (no son opcionales):
   1. SCROLL ÚNICO (:1400-1405): el único scroller del panel derecho es .cn-col. Ningún
      elemento de aquí lleva overflow propio. Nombres largos → ellipsis + title.
   2. NO ALTERAR ALTURAS (:1417-1424): .cn-stk--in anima la entrada del bloque y
      __cnStackScroll mide con ResizeObserver esperando 600ms de calma. Cualquier
      transition/animation sobre height, padding, margin, font-size o scale RETRASARÍA la
      bajada del panel hasta el techo de 8s. Aquí no hay ninguna, a propósito.
   3. PADDING: el contenedor .cn-stk ya aporta 10px 12px 12px (:1414) dentro de .cn-stack
      con 14px (:1411). El diseño pide 10px 14px 13px para .jq-tree, pero SUMADO daría ~26px
      de margen interno. Se deja casi a cero y el pie sangra en negativo para tocar los
      bordes del bloque, que es el efecto que el diseño busca.

   CONTRASTE (jerarq_elem.md §2): todo texto <=12px va en #3C4A44 o más oscuro. #98A69E queda
   PROHIBIDO en texto (solo rieles y bordes). Mínimo de chip/etiqueta: 10.5px. */
.jq-tree { padding: 2px 0 0; font-family: inherit; color: #3C4A44; }

.jq-node { display: flex; align-items: stretch; min-height: 34px; }

/* Riel: 20px por nivel de profundidad. Vertical completa salvo en el codo del último
   hermano, donde se corta a 17px para formar la "└". */
.jq-rail { width: 20px; flex: 0 0 auto; position: relative; }
.jq-rail::before { content: ''; position: absolute; left: 9px; top: 0; bottom: 0;
  width: 1.5px; background: #EEF2EF; }
.jq-rail.is-elbow::after { content: ''; position: absolute; left: 9px; top: 17px;
  width: 11px; height: 1.5px; background: #EEF2EF; }
.jq-rail.is-elbow.is-last::before { bottom: auto; height: 17px; }

.jq-node__body { display: flex; align-items: center; gap: 8px; padding: 6px 0;
  min-width: 0; flex: 1; }

.jq-node__tile { width: 22px; height: 22px; border-radius: 6px; flex: 0 0 auto;
  display: grid; place-items: center; background: #F3F9F4; border: 1px solid #E9F3EC; }
.jq-node__tile i { font-size: 10.5px; color: #15794C; line-height: 1; }
.jq-node__tile.is-leaf { background: #fff; border-color: #E4E9E5; }
.jq-node__tile.is-focus { background: #0E5C3A; border-color: #0E5C3A; }
.jq-node__tile.is-focus i { color: #C9962E; }

.jq-node__abbr { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10.5px; font-weight: 700; letter-spacing: .5px; color: #3C4A44;
  border: 1px solid #E4E9E5; border-radius: 4px; padding: 1px 6px; flex: 0 0 auto; }

.jq-node__value { font-size: 12.5px; font-weight: 600; color: #1A2A24;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.jq-node__value.is-focus { font-size: 13.5px; font-weight: 800; }

.jq-node__count { flex: 0 0 auto;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10.5px; font-weight: 700; color: #15794C; background: #E9F3EC;
  border-radius: 20px; padding: 2px 8px; }

/* Badge CONSULTADO: verde OSCURO sobre oro CLARO (~11:1). Oro sobre oro claro da 2.4:1
   y está explícitamente prohibido en jerarq_elem.md §2. */
.jq-node__badge { flex: 0 0 auto; font-size: 10.5px; font-weight: 800; letter-spacing: .5px;
  color: #0A4A2E; background: #FBF3DF; border-radius: 5px; padding: 2px 7px; }

.jq-group { display: flex; align-items: center; gap: 8px; margin-left: 20px;
  margin-top: 7px; margin-bottom: 1px; }
.jq-group.is-first { margin-top: 4px; }
.jq-group__label { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10.5px; font-weight: 700; letter-spacing: .7px; color: #15794C;
  text-transform: uppercase; }
.jq-group__rule { flex: 1; height: 1px; background: #EEF2EF; }

/* Texto secundario a #3C4A44, NO al #98A69E de antes: 11.5px exige el mínimo de contraste. */
.jq-more, .jq-vacio { font-size: 11.5px; color: #3C4A44; font-style: italic; }

/* Nota de level-shift y de fuera-de-estructura: es un AVISO, mantiene el ámbar. */
.jq-nota { margin: 0 0 8px; font-size: 12px; color: #8A6D3B; background: #FBF6EC;
  border-radius: 6px; padding: 6px 10px; }

/* El pie va a sangre: márgenes negativos que cancelan el padding de .cn-stk (:1414 —
   10px arriba / 12px a los lados / 12px abajo) para que la banda gris toque los bordes
   del bloque y su borde superior lea como separador real, tal como el diseño §Paso 6.
   El -12px inferior debe coincidir con el padding-bottom de .cn-stk: si ese cambia, este
   también. */
.jq-foot { display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  margin: 10px -12px -12px; border-top: 1px solid #EEF2EF; background: #F7FAF8;
  border-radius: 0 0 9px 9px; }
.jq-foot i { font-size: 12px; color: #15794C; }
.jq-foot__label { font-size: 11.5px; color: #3C4A44; }
.jq-foot__value { margin-left: auto;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px; font-weight: 800; color: #1A2A24; font-variant-numeric: tabular-nums; }

/* Profundidad >4 (§8): rieles a 16px para que no se coma el ancho del panel. */
.jq-tree--deep .jq-rail { width: 16px; }
.jq-tree--deep .jq-rail::before,
.jq-tree--deep .jq-rail.is-elbow::after { left: 7px; }
.jq-tree--deep .jq-rail.is-elbow::after { width: 9px; }

.jq-vh { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
```

> **Nota sobre `.jq-tree--deep`:** el CSS queda listo, pero **no se activa en esta entrega**.
> Con el payload real la profundidad máxima es 4 (VP→GER→ACT→CMP) + 1 de hijos = 5 rieles como
> mucho, y a 20px eso son 100px, que caben. Si en pruebas se ve apretado, basta añadir la clase
> al contenedor. No se implementa lógica de conmutación para un caso que hoy no se da.

---

## 6 · Cache-bust (obligatorio, no es un extra)

Editar `.css`/`.js` **sin** subir el `?v=` invalida cualquier prueba posterior — es la causa
documentada de un ciclo de medición perdido (`Planes/leccion_frontend_medir_antes_2026-08-24.md` §3).

En `MainChat/templates/mainchat_layout.html`:

| Línea | Ahora | Pasa a |
|---|---|---|
| 13 | `colapsable.css?v=20260824e` | `?v=20260825a` |
| 113 | `multitab_shell.js?v=20260824k` | `?v=20260825a` |

**`templates/main.html` (líneas 5 y 88) NO se toca:** es el layout viejo; el chat de Consulta
vive en `/mainchat`. Si tras desplegar se comprueba que ese layout también expone el panel,
se sube ahí en un commit aparte.

---

## 7 · Verificación — medir, no suponer

**Requisito previo: la app local levantada** (`SETUP_LOCAL.md`). Sin app corriendo, todo lo
que sigue es adivinar — ver `frontend-medir-no-suponer`.

### 7.1 Casos a lanzar en el chat de Consulta

| # | Pregunta | Qué debe verse |
|---|---|---|
| 1 | ¿Cuántos campos tiene el activo Chichimene? | **Ruta.** VP `GCH` → GER `PDH` → ACT `CHICHIMENE` (tile verde, icono dorado, badge `CONSULTADO`, contador `2`), grupo `CAMPOS (2)`, 2 hojas, pie `Pozos asociados · 289`. El último campo con codo `└`. |
| 2 | ¿Qué campos tiene la vicepresidencia GOR? | **Abanico.** `GOR` a depth 0 sin rieles, contador = suma de los grupos, un divisor por grupo (`GERENCIAS (n)`, `ACTIVOS (n)`, `CAMPOS (n)`), todos los items a depth 1. |
| 3 | ¿A qué activo pertenece Cajúa? | Ruta con focus en **campo** (nivel más profundo), sin grupo de hijos o con `es_hermanos`. |
| 4 | Una entidad con `puente` (p.ej. "la gerencia GOR") | La nota ámbar **arriba** del árbol; el árbol muestra el nivel oficial. |
| 5 | Un campo de tercero (`fuera_estructura`) | Nodo focus + nota ámbar, **sin** rieles ni árbol. |
| 6 | Un operador | Empresa a depth 0, nota "no es un nivel", campos como hojas. |
| 7 | Una entidad con >14 hijos | Los 14 + `+N más (T en total)` como último renglón, con el codo `└`. |

### 7.2 Comprobaciones medidas (DOM real, no el archivo)

Procedimiento con Edge headless en `SETUP_LOCAL.md` §"Depurar el frontend". Verificar:

1. `getComputedStyle($0.querySelector('.jq-rail')).width === "20px"`.
2. El **último** nodo de cada grupo tiene `.is-last` y su `::before` mide `17px` de alto.
3. Ningún nodo de texto ≤12px computa `color: rgb(152,166,158)` (`#98A69E`) — regla dura §2.
4. `.jq-node__badge` computa `color:#0A4A2E` sobre `background:#FBF3DF` (**nunca** `#C9962E`
   como color de texto).
5. `.jq-tree` **no** tiene `overflow` propio: `getComputedStyle(...).overflowY === "visible"`.
   Si aparece un scroller anidado, se rompe el scroll único del panel.
6. Caso 1: el pie muestra `289`; con `pozos:null` **no existe** `.jq-foot` en el DOM.
7. Nombre largo → `text-overflow:ellipsis` activo y `title` con el valor completo; el panel
   **no** scrollea en horizontal.
8. **(H3, crítico)** Ningún selector `.jq-*` declara `transition` ni `animation`. Comprobar
   en la app: `getComputedStyle($0).transitionProperty === "all"` con duración `0s`, o
   directamente `transitionDuration === "0s"` en `.jq-tree`, `.jq-node`, `.jq-foot`. Y a ojo:
   al lanzar una pregunta de jerarquía el panel derecho **baja solo** al bloque nuevo en
   ~1s, no en 8s.
9. **(H2)** El margen interno del árbol respecto al borde del `.cn-stk` es de ~12px, no ~26px.
   Medir `.jq-tree` contra su ancestro `.cn-stk__body`: no debe haber un segundo escalón
   de padding visible.

### 7.3 Regresión

- El panel del grupo **cuantificar** y el `p50_vp` no deben cambiar: el despacho de `:2977-2994`
  es el mismo y sus clases (`cn-cuant*`, `cn-p50vp*`) no se tocan.
- **`jerarq_rank` (`__cnJerRankHtml`, `:3547-3568`) es seguro** — H1: usa `.cn-rank*`, no
  `.cn-jer*`. Se puede borrar el bloque CSS viejo sin tocarlo. Aun así, **lanzar una pregunta
  de ranking estructural** ("¿qué activo tiene más pozos?") y confirmar que el panel sigue
  igual: es el vecino más cercano al código modificado.
- **Scroll del panel (H3, el bug que costó 3 intentos en agosto).** Tras pintar el árbol,
  el panel debe **bajar solo** al bloque nuevo. Si se queda arriba o tarda ~8s, el CSS nuevo
  está alterando el alto durante la animación de entrada y `__cnStackScroll` está esperando
  la calma de 600ms que nunca llega. Comprobación en §7.2-8.

---

## 8 · Definition of Done — ejecutado y verificado (2026-08-25)

Implementado y verificado end-to-end contra la app local corriendo (Flask 8020 + INGESTA 8088 +
Postgres local), con **datos reales** de `core.map_campo_robustez` (no inventados — consultados
por Python/psycopg antes de escribir las preguntas de prueba). Harness: Edge headless que hace
login por bypass, activa la pestaña Consulta, escribe cada pregunta en `#cn-input`, llama a
`window.__cnPreguntar()` real y mide `getComputedStyle()` sobre el DOM resultante. Los dos
archivos de prueba (`static/_p.html`, `static/_s.html` y sus variantes `_p2`/`_s2`) se usaron y
se **borraron** al terminar (viven en `static/`, público).

- [x] Árbol con conectores L en CSS puro — riel `width:20px` medido en 6/6 casos con ancestros;
      `.is-last ::before height:17px` medido en 6/6 casos con hojas.
- [x] Tile de 22px por nivel, 3 variantes — confirmado por inspección visual (caso 1 reproduce
      exacto el screenshot original) + `icono focus class=bi bi-building` en el caso operador.
      El tamaño de 22px es CSS estático (no depende del payload); no remedido en px por caso.
- [x] Chip `VP/GER/ACT/CMP/POZ` a 10.5px — CSS estático, sin regresión detectada.
- [x] Nodo consultado — badge `CONSULTADO`: `color:rgb(10,74,46)` sobre
      `background:rgb(251,243,223)` medido en **7/7** casos con focus (= `#0A4A2E`/`#FBF3DF`
      exactos).
- [x] **Ruta y abanico desde la misma función** — confirmado con datos reales: "¿Cuántos campos
      tiene el activo Chichimene?" (`padres.length=2`, ruta) y "¿Qué campos tiene la
      vicepresidencia GOR?" (`padres=[]`, abanico) ambos correctos desde `__cnJerArbolHtml`.
- [x] `fuera_estructura` — "¿A qué activo pertenece Aguas Blancas?" (tercero, operador PAREX
      RESOURCES): sin rieles, sin pie, nota ámbar con el operador incluido.
- [x] `operador` — "¿Qué campos tiene Sierracol Energy Arauca?" (20 campos, tercero): tile
      `is-focus` con icono `bi-building`, grupo "Campos (20)", **truncado real**: 14 hojas +
      "+6 más (20 en total)", 16 `.jq-node` en total. Ver nota de clasificación abajo.
- [x] **`puente` conservado** — "¿Qué campos tiene la gerencia GOR?" (GOR es VP): nota renderizada
      *"Lo que en el reporte diario llamas «Gerencia GOR» es, en la estructura oficial,
      Vicepresidencia GOR."* — texto exacto, encima del árbol.
- [x] **`es_hermanos` conservado** — "¿A qué activo pertenece Chichimene Sw?": grupo mostró
      *"Otros campos del mismo Activo"* con el hermano real (CHICHIMENE).
- [x] Pie de pozos — `toLocaleString('es-CO')` confirmado: `289` (sin separador, <1000) y
      `2.556` (con separador de miles). **Ausente** cuando `pozos:null` (caso Aguas Blancas) —
      no se pintó `.jq-foot`.
- [x] `role="tree"` / `aria-level` — confirmado (`role=tree`, primer nodo `aria-level=1`) en
      7/7 casos.
- [x] Contraste — **`NINGUNO` `#98A69E` en texto** medido en **7/7** casos (`.jq-more`,
      `.jq-vacio`, `.jq-group__label`, `.jq-node__abbr`, `.jq-foot__label`).
- [x] Truncado — **dos casos reales**, no sintéticos: operador Sierracol (20→14+6) y VP GPA
      (27→14+13, `"+13 más (27 en total)"`).
- [x] Sin pozos — confirmado (Aguas Blancas, `pozos:null` → sin pie).
- [ ] **Sin hijos** y **nombres largos** — **no verificados con datos reales**: no encontré en
      `core.map_campo_robustez` una entidad con un grupo de hijos vacío ni un nombre lo bastante
      largo para forzar el ellipsis. El código (`html += ... "Sin " + nivel + "s asociados"` y
      `title="..."` + `text-overflow:ellipsis` en CSS) se revisó por lectura, **no por medición**.
      Dejar constancia en vez de marcarlo como hecho.
- [x] `?v=` subido en `mainchat_layout.html` — línea 13 (`colapsable.css?v=20260825a`), línea 113
      (`multitab_shell.js?v=20260825a`; la versión previa real era `20260824l`, no `20260824k`
      como decía el plan original — sin efecto, se sobrescribió igual).
- [x] **(H1)** Bloque CSS `.cn-jer*` eliminado por completo (2085-2098 reemplazadas). Grep
      posterior: cero selectores `.cn-jer*` vivos en el repo (solo un comentario que lo cita
      como referencia histórica).
- [x] **(H3)** `transitionDuration=0s` / `animationName=none` medido en `.jq-tree`, `.jq-node`,
      `.jq-foot`, `.jq-rail`, `.jq-node__tile`, `.jq-group` en **6/6** casos con árbol.
      **`scroll_al_fondo(t1) = true`** medido en **6/6** casos: el panel bajó solo al bloque
      nuevo dentro de la ventana de medición (t0 al insertar, t1 a t0+1800ms) — el bug de agosto
      no reapareció.
- [x] **(H2)** Margen interno medido: **13px** en 6/6 casos (esperado ~12px por el padding de
      `.cn-stk`), **no** los ~26px que habría dado sin la corrección.
- [x] `jerarq_rank` probado — pregunta real del golden set: *"¿Cuáles son los campos con más
      pozos?"* → `.cn-rank` presente, `.jq-tree` **ausente**, header/5 items/footer con el aviso
      de "Conteo de REGISTRO" intactos. **Sin regresión.**

### Hallazgo de clasificación (no es un defecto del código de este plan)

La frase "¿Qué campos **opera** Sierracol Energy Arauca?" no clasificó (timeout >20s: la
pregunta probablemente no matchea ningún patrón Capa 1 de `jerarquizar` y escaló a Capa 2, que
sin Ollama local se degrada mal). Rephraseada a *"¿Qué campos **tiene** Sierracol Energy
Arauca?"* (mismo patrón que las demás preguntas que sí funcionan) clasificó correctamente y
confirmó el render. **No se tocó ningún archivo por esto** — es una observación sobre el
vocabulario del clasificador, fuera del alcance de un rediseño de presentación.

---

## 9 · Fuera de alcance (explícito)

- **Backend.** Cero cambios en `respuesta_jerarquizar.py`. El tope de `_tope_panel` sigue en 14.
- **"+N más" pulsable** (§8 del diseño): imposible sin backend — los sobrantes no viajan.
- **Nodos navegables** (§9 del diseño: clic para consultar ese elemento): funcionalidad nueva,
  no un rediseño. Propuesta aparte si se quiere.
- **React / TypeScript / Sass / Vitest** (§2, §3, §10 del diseño): el proyecto no los tiene.
- **`jerarq_rank`** (ranking estructural): otro panel.
- **`templates/main.html`**: layout viejo.

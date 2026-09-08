# plan_TARJETA-N1-EXTRA — 2026-09-08 · v2 (auditado y corregido)

**ID tarea:** TARJETA-N1-EXTRA
**Fecha:** 2026-09-08
**Repo:** `ProdIAWebFront` — `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`
**Alcance:** un bloque HTML nuevo + CSS nuevo, ambos aislados a un único punto de uso.
**Qué NO se toca:** el backend (**cero cambios** — todos los datos que hacen falta ya viajan
en el payload), `__cnTarjetasKpiHtml` (la función compartida por 6 sitios), el clasificador,
el drill, los goldens, la BD.

### Decisión cerrada del usuario

**El artifact es el diseño aprobado**: `https://claude.ai/code/artifact/3b0c91f3-30d4-4c9c-9596-72119e065c4b`.
La tarjeta del panel de N1 debe llevar, además de lo que ya pinta hoy: **Presupuesto** (o la
referencia que aplique), **Días reportados** y un **chip GAP**. Dos ajustes sobre el mockup,
explicados en H-03 y H-08:

1. Se retira la fila «Media del mes»: es el mismo número que la cifra principal (H-03).
2. El «Presupuesto»/GAP no salen de la misma fuente que el anillo (H-08), para no repetir el
   error que motivó quitar esta tarjeta en N1D: dos cifras casi iguales de fuentes distintas.

Y un efecto de layout declarado (H-05): el panel de N1 pasa de **375px a 470px** de alto para
que el bloque nuevo quepa sin desbordar. La curva de la derecha crece en la misma proporción.

---

## §0.-1 · Changelog v1 → v2

El v1 se auditó **leyendo el CSS que rodea al punto de inserción**, no solo el que ya citaba.
Salieron **tres errores**, dos de ellos capaces de romper el panel:

| # | Qué decía el v1 | Qué se midió | Efecto |
|---|---|---|---|
| C-1 | `.cp-foco__extra { … overflow: auto; }` | 🔴 **Viola una regla de oro del proyecto.** `colapsable.css:1558-1561` y `:2527-2528`: *«el único scroller del panel derecho es `.cn-col`»*, y *«dos scrollers anidados atrapan la rueda del ratón y dejan la pila inalcanzable»* (`:1480-1481`) | Un scroller anidado dentro del panel del chat. **Se elimina el `overflow`** |
| C-2 | No contemplaba la **altura del contenedor** | 🔴 `colapsable.css:2529` fija **`height: 375px`** en la pila del chat, y `:2530-2531` fuerza `overflow: visible` en los hijos. Meter ~92px más de contenido en un alto fijo lo **desborda visualmente** | El bloque nuevo se saldría del panel. Se añade un modificador `--ext` **en el grid**, con 470px |
| C-3 | Modificador `.cp-foco__kpicol--ext` + regla sobre `.cn-kpi__row--solo` | 🟢 **Innecesario.** El `flex: 1 1 auto` que ya tiene esa regla (`:1196`) es exactamente lo correcto: la tarjeta se estira para llenar **lo que quede** tras el bloque extra, que va con `flex: 0 0 auto` | Se eliminan el modificador y la regla. **Desaparece por completo el riesgo de H-04 del v1**: ya no se toca ninguna regla compartida |

**El v2 es más pequeño que el v1**: dos reglas CSS nuevas en vez de ocho, y cero contacto con
selectores que usen otros paneles.

---

## §0 · Contexto para el agente EXECUTOR

**Proyecto ProdIA** (Ecopetrol). Repo `frontend\` — Flask + Jinja2, puerto 5029. Este plan
**no toca el backend**: todo lo que pide el diseño ya está en el payload del panel
`cuant_dia_panel` (lo confirma la auditoría, §1).

El panel de una pregunta puntual mensual (N1) muestra hoy dos columnas: una tarjeta KPI
(izquierda) y una curva diaria (derecha). La tarjeta la pinta `__cnTarjetasKpiHtml`, una
función **compartida por 6 paneles distintos** del tablero de Análisis — no se toca. Este plan
añade un bloque **nuevo y propio**, debajo de esa tarjeta, solo en el panel de N1.

**Archivos que se tocan (rutas absolutas):**

| # | Acción | Ruta |
|---|---|---|
| 1 | MODIFICAR | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\js\multitab_shell.js` |
| 2 | MODIFICAR | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\css\colapsable.css` |
| 3 | MODIFICAR | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\templates\main.html` *(2 líneas: los dos cache-busters, §3.4)* |

**Convenciones obligatorias:**

- **JS ES5 clásico**: `var` + `function`. Sin arrow functions, sin template literals, sin
  `const`/`let`.
- Todo el código y **todos los comentarios en español**.
- Los comentarios explican **por qué**, citando la evidencia (archivo:línea). El bloque nuevo
  lleva la marca `[2026-09-08 · TARJETA-N1-EXTRA]`.
- **Si algo del plan no calza con el código real, DETENERSE y reportar. No improvisar.**

---

## §1 · Hallazgos de la auditoría

### 🔴 H-01 (bloqueante) — `__cnTarjetasKpiHtml` tiene 6 call sites: NO se toca

`grep -n "__cnTarjetasKpiHtml("` → `:1785`, `:3959`, `:6656`, `:6833`, `:6887`, más su propia
definición (`:3708`). Identificadas las funciones que la envuelven:

| Línea | Función | Panel |
|---|---|---|
| `:1785` | `__cnFilSeriePlot` | serie de filiales |
| `:3959` | `__cnCompProdHtml` | **el nuestro** — panel de N1 |
| `:6656` | `__cnFocosHtml` | Focos, tablero de Análisis |
| `:6833` | `__cnRenderEjecutivo` | panel ejecutivo, tablero de Análisis |
| `:6887` | `__cnPorFilialHtml` | por filial |

Modificar `__cnTarjetasKpiHtml` para añadir filas cambiaría el diseño en **los 5 paneles
ajenos**, no solo en el chat. **Se descarta.** El bloque nuevo va aparte, como hermano.

### 🟢 H-02 (confirmación) — `__cnCompProdHtml` tiene UN único call site: se puede extender

`grep -n "__cnCompProdHtml("` → `:3946` (la definición) y `:4376` (**la única llamada**), dentro
de `__cnCompProdCargar`. Añadirle un parámetro nuevo es seguro: no hay un segundo lugar que
rompa por firma cambiada.

### 🟡 H-03 (relevante) — «Media del mes» es el mismo número que la cifra principal: se retira

El contrato de `_tarjetas_kpi` (`analisis/api.py:798-809`) lo dice explícito:

> «`proyectado_cierre` = t['real'] SIN recalcular: **titular.real YA es la proyección de
> cierre del mes completo**»

Y el HTML de la tarjeta usa ese mismo valor dos veces: como `figVal` (la cifra grande) y dentro
de `proyTxt` (la fila «Proyección de cierre»). En este contrato **no existe** un «real
producido hasta hoy» distinto de «proyección de cierre» — son el mismo número. La fila «Media
del mes» del artifact duplicaría una cifra ya visible arriba. Se quita del diseño final.

### 🔴 H-04 (bloqueante) — 🆕 v2 · Prohibido `overflow` en el bloque nuevo: regla de oro del scroll único

El CSS lo repite en siete sitios distintos. `colapsable.css:1558-1561`:

> «**SCROLL ÚNICO**: `.cn-col` es el ÚNICO scroller del panel derecho […] ni `.cn-canvas` ni
> `.cn-stack` pueden volver a llevar overflow»

Y el motivo, en `:1480-1481`:

> «un SCROLLER ANIDADO dentro de `.cn-col`, y la regla de oro lo prohíbe: **dos scrollers
> anidados atrapan la rueda del ratón y dejan la pila inalcanzable**»

El propio bloque donde vamos a insertar lo reafirma (`:2527-2528`):

> «🔑 `overflow: visible` en los hijos, **NO auto** […] Verificado en la medición: ningún
> scroller anidado»

**Consecuencia:** el bloque nuevo va **sin `overflow`**. Su alto se resuelve dándole el
espacio que necesita (H-05), no metiéndole una barra de scroll propia.

### 🔴 H-05 (bloqueante) — 🆕 v2 · El contenedor tiene ALTURA FIJA: hay que ampliarla

`colapsable.css:2529-2531`:

```css
.cn-stk__body .cp-foco__panel .cn-compprod__grid { height: 375px; min-height: 0; }
.cn-stk__body .cp-foco__panel .cn-compprod__grid > * {
  height: 100%; min-height: 0; overflow: visible; }
```

**375px fijos**, y los hijos con `overflow: visible`. El bloque nuevo mide ~92px:

| Parte | Alto |
|---|---|
| `margin-top` + `padding-top` + `border-top` | 19px |
| 2 filas de 12px con su interlineado | 36px |
| 2 `gap` de 4px | 8px |
| chip GAP (5+5 de padding + texto) | 27px |
| **Total** | **~90px** |

Meterlos en un alto fijo con `overflow: visible` **desborda el panel**: el contenido se sale
por abajo y pisa lo que haya debajo en la pila.

**Solución:** un modificador **en el grid** (no en la columna), que solo se añade cuando hay
bloque extra, subiendo el alto a **470px** (375 + 90 + 5 de aire).

⚠️ Efecto lateral **deseable y declarado**: la curva de la derecha también es `height: 100%`,
así que pasa de ~327px a ~422px de alto. Para una serie diaria de 30 puntos eso es más
legible, no menos. El panel de N1 queda algo más alto que el de N1D — justificado, porque
tiene más contenido. Se valida a ojo en H-6 de la §6.2.

### 🟢 H-06 (confirmación) — 🆕 v2 · La regla de la tarjeta NO se toca: su `flex` ya es el correcto

`colapsable.css:1196`:

```css
.cp-foco__kpicol .cn-kpi__row--solo { flex: 1 1 auto; min-height: 0; }
```

El v1 planeaba cambiarlo a `flex: 0 0 auto` mediante un modificador. **No hace falta y es
peor**: con el bloque nuevo en `flex: 0 0 auto` (altura natural, no crece ni se encoge), la
tarjeta con su `flex: 1 1 auto` actual **se estira sola para llenar lo que quede**. Es
exactamente el reparto que se busca.

**Consecuencia:** este plan **no toca ninguna regla CSS existente**. Solo añade dos nuevas.
Desaparece el riesgo de afectar a `__cnFocosHtml` (`:6656`), que comparte esa clase.

### 🟢 H-08 (confirmación) — El Presupuesto y el GAP deben salir del ejecutor N1, no de `/ejecutivo`

Son **dos fuentes de cálculo independientes** para la misma pregunta:

| Dato | De dónde sale | Lo usa hoy |
|---|---|---|
| `d["real"]`, `d["ppto"]` | Ejecutor de Cuantificar (`respuesta_cuantificar.py:248`) | El **texto** de la respuesta |
| `k.meta_mes`, `k.proyectado_cierre` | `/analisis/ejecutivo` → `_tarjetas_kpi` | La **tarjeta** (anillo) |

Ya se confirmó (tras el fix FIX-NIVEL-N1) que ambas coinciden en cifra para el caso probado.
Pero son cálculos distintos, y el propio proyecto ya sufrió el bug de «dos cifras casi
iguales, invitando a confundirse» (motivo por el que se quitó esta tarjeta en N1D,
`:4361-4365`). Para el Presupuesto y el GAP —que SÍ se comparan visualmente contra la cifra
del texto— se usa **`datos.ppto`/`datos.real`**, la misma fuente que arma el mensaje. Así el
número de la tarjeta nunca puede divergir del texto: es literalmente el mismo dato.

El «Promedio 2026» que ya pinta `__cnTarjetasKpiHtml` (de `/ejecutivo`) se deja como está: es
información de contexto, no algo que el texto también afirme — no hay riesgo de contradicción.

### 🟡 H-09 (relevante) — El rótulo de la referencia debe ser dinámico, no fijo «Presupuesto»

`respuesta_cuantificar.py` (`_REF_LABEL`, visto en el plan PANEL-N1-ENRIQUECIDO H-04) puede
dar `"presupuesto"`, `"presupuesto operativo"`, `"cierre contable"` o `"promedio mensual del
año"` — esta última cuando la entidad **no tiene PPTO formal** y el sistema usa el promedio
como meta de respaldo. Poner «Presupuesto» a secas ahí sería afirmar un dato que no existe
(la misma familia de fallo que `CLAUDE.md §6` marca como grave). El rótulo sale de
`datos.referencia_label`, capitalizado.

### 🟢 H-10 (confirmación) — El P50 ya viaja; cuando existe, manda sobre el PPTO

`datos.p50` (`{valor, label}` o `None`) ya lo emite el backend desde el plan
PANEL-N1-ENRIQUECIDO, sin cambios de este plan. Cuando existe (VP/global), el rótulo pasa a
«GAP P50» y la referencia usada es `datos.p50.valor`, no `datos.ppto` — es la regla de nivel
ya establecida (H-05 de aquel plan): el P50 no está definido por campo.

### 🟢 H-11 (confirmación) — `datos.dias_con_dato`/`dias_del_mes` ya viajan

Se añadieron en el plan PANEL-N1-ENRIQUECIDO (Cambio 3) y no se han tocado desde entonces.
Están disponibles sin ningún cambio de backend.

### 🟢 H-12 (confirmación) — Sin backend que tocar: los 5 datos que pide el diseño ya están

| Dato del diseño | Payload | Ya existe |
|---|---|---|
| Presupuesto | `datos.ppto` | ✅ desde N1 base |
| Rótulo de la referencia | `datos.referencia_label` | ✅ desde N1 base |
| Días reportados | `datos.dias_con_dato` / `datos.dias_del_mes` | ✅ desde PANEL-N1-ENRIQUECIDO |
| P50 (si aplica) | `datos.p50` | ✅ desde PANEL-N1-ENRIQUECIDO |
| Cifra real (para el GAP) | `datos.real` | ✅ desde N1 base |

Cero cambios al backend. Este plan es **puramente frontend**.

### 🟢 H-13 (confirmación) — `datos.unidad` ya viaja para formatear

`_panel_datos` arma `d = {"nivel": …, "entidad_cualificada": …, "producto": …, "unidad":
res["unidad"], …}` desde su primera línea (`respuesta_cuantificar.py:175`), antes de cualquier
rama. Disponible siempre.

### 🟢 H-14 (confirmación) — No hay test automatizado posible para este cambio

El proyecto no tiene suite de tests de JavaScript. Este cambio es 100% visual/frontend, así
que su única validación real es humana en navegador (§6.2), consistente con la regla R3 de
`CLAUDE.md §10.4`: *«build verde NO es feature verificada»*. La validación estática (§6.1) solo
puede comprobar que el código existe y no rompe la sintaxis — nunca que se vea bien.

---

## §2 · Estado actual

```
multitab_shell.js:3708   __cnTarjetasKpiHtml(tarjetas, periodo)   -- NO SE TOCA, 6 usos
multitab_shell.js:3946   __cnCompProdHtml(focos, meta, tarjetas, sufijo)  -- 1 solo uso
multitab_shell.js:3957     kpi = '<div class="cp-foco__kpicol">…' + __cnTarjetasKpiHtml(…) + '…'
multitab_shell.js:4376   __cnCompProdCargar → host.innerHTML = __cnCompProdHtml(focosF, ed.meta, _tarj, sufijo);

colapsable.css:1194      .cp-foco__kpicol { height:100%; display:flex; flex-direction:column; }
colapsable.css:1196      .cp-foco__kpicol .cn-kpi__row--solo { flex: 1 1 auto; }  -- usada TAMBIÉN por :6656
```

---

## §3 · Especificación

### 3.1 · MODIFICAR `multitab_shell.js`

#### Cambio 1 de 4 — Helper `__cnN1ExtraHtml`, definido antes de su uso

**LOCALIZAR** (línea que abre la función que lo va a invocar):

```javascript
  function __cnCompProdHtml(focos, meta, tarjetas, sufijo) {
```

**INSERTAR INMEDIATAMENTE ANTES** de esa línea:

```javascript
  // [2026-09-08 · TARJETA-N1-EXTRA] Bloque propio del panel de N1 (cuant_dia_panel), HERMANO de
  // la tarjeta __cnTarjetasKpiHtml — NO se integra dentro de ella porque esa función la comparten
  // otros 5 paneles del tablero de Análisis (H-01) y esto no debe pintarse ahí.
  // 🔑 Presupuesto y GAP salen de `extra.real`/`extra.ppto` — la MISMA fuente que arma el TEXTO
  //    de la respuesta (respuesta_cuantificar.py:248), no de la tarjeta de arriba (que consulta
  //    /analisis/ejecutivo, un cálculo independiente). Es la lección de :4361-4365: dos cifras
  //    casi iguales de fuentes distintas generan desconfianza aunque ambas sean correctas.
  // 🔑 El rótulo de la referencia es DINÁMICO (`extra.referencia_label`), nunca "Presupuesto" a
  //    secas: hay entidades sin PPTO formal donde esa clave vale "promedio mensual del año"
  //    (respuesta_cuantificar.py, _REF_LABEL). Rotular "Presupuesto" ahí sería inventar un dato
  //    que no existe.
  // 🔑 El P50 MANDA sobre el PPTO cuando existe (VP/global): es la regla de nivel ya establecida
  //    (plan PANEL-N1-ENRIQUECIDO, H-05) — el P50 no está definido por campo.
  function __cnN1ExtraHtml(extra) {
    if (!extra) return "";
    var fmtV = __cnBeq;                                             // [BEQ]
    var uni = extra.unidad ? (" " + esc(extra.unidad)) : "";
    var conP50 = !!(extra.p50 && extra.p50.valor != null);
    var refVal = conP50 ? extra.p50.valor : extra.ppto;
    var refLbl = conP50 ? "P50"
      : (extra.referencia_label
          ? extra.referencia_label.charAt(0).toUpperCase() + extra.referencia_label.slice(1)
          : "Referencia");
    var filas = "";
    // Sin referencia (entidad sin PPTO ni promedio) -> se omite la fila, NUNCA se inventa un "—".
    if (refVal != null) {
      filas += '<div class="cp-foco__extra-r"><span>' + esc(refLbl) + '</span><b>' +
        fmtV(refVal) + uni + '</b></div>';
    }
    if (extra.dias_con_dato != null && extra.dias_del_mes) {
      filas += '<div class="cp-foco__extra-r"><span>Días reportados</span><b>' +
        extra.dias_con_dato + ' / ' + extra.dias_del_mes + '</b></div>';
    }
    if (!filas) return "";
    var gapHtml = "";
    if (refVal != null && extra.real != null) {
      var gap = extra.real - refVal;
      var pos = gap >= 0;
      gapHtml = '<div class="cp-foco__extra-gap' + (pos ? " cp-foco__extra-gap--pos" : " cp-foco__extra-gap--neg") + '">' +
        '<span>GAP ' + esc(refLbl) + '</span><b>' + (pos ? "+" : "") + fmtV(gap) + uni + '</b></div>';
    }
    return '<div class="cp-foco__extra">' + filas + gapHtml + '</div>';
  }

  function __cnCompProdHtml(focos, meta, tarjetas, sufijo) {
```

> ⚠️ La línea `function __cnCompProdHtml(focos, meta, tarjetas, sufijo) {` queda **duplicada**
> en el bloque de arriba a propósito: es el ancla de inserción (queda tal cual, sin tocarla) Y
> la primera línea del Cambio 2. **No borrarla** — el Cambio 2 la sustituye a continuación.

#### Cambio 2 de 4 — `__cnCompProdHtml` recibe `extra` y lo pinta

**LOCALIZAR** (tras aplicar el Cambio 1, es la línea que queda sin modificar):

```javascript
  function __cnCompProdHtml(focos, meta, tarjetas, sufijo) {
```

**SUSTITUIR POR:**

```javascript
  function __cnCompProdHtml(focos, meta, tarjetas, sufijo, extra) {
```

**Y ADEMÁS**, dentro de la misma función, **LOCALIZAR** (las 5 líneas seguidas, tal cual):

```javascript
      var kpi = tarProd.length
        ? '<div class="cp-foco__kpicol"><div class="cn-kpi__row cn-kpi__row--solo">' +
            __cnTarjetasKpiHtml(tarProd, meta.periodo) + '</div></div>'
        : "";
      var gridCls = "cn-compprod__grid" + (tarProd.length ? "" : " cn-compprod__grid--solo");
```

**SUSTITUIR POR:**

```javascript
      // [2026-09-08 · TARJETA-N1-EXTRA] `extra` solo llega en el panel de N1 (el único caller,
      // :4376, lo pasa condicionado a que la pregunta sea mensual). El bloque va DENTRO de
      // .cp-foco__kpicol, hermano de la tarjeta — nunca dentro de __cnTarjetasKpiHtml, que la
      // comparten otros 5 paneles (H-01).
      var _extraHtml = __cnN1ExtraHtml(extra);
      var kpi = tarProd.length
        ? '<div class="cp-foco__kpicol"><div class="cn-kpi__row cn-kpi__row--solo">' +
            __cnTarjetasKpiHtml(tarProd, meta.periodo) + '</div>' + _extraHtml + '</div>'
        : "";
      // 🔑 El modificador --ext va en el GRID porque es el grid quien fija la altura (375px en
      //    la pila, colapsable.css:2529). Solo se añade si HAY bloque extra: N1D/N1DSEL/N1DSER
      //    y el tablero de Análisis se quedan en 375px, intactos (H-05).
      var gridCls = "cn-compprod__grid" + (tarProd.length ? "" : " cn-compprod__grid--solo") +
                    (_extraHtml ? " cn-compprod__grid--ext" : "");
```

#### Cambio 3 de 4 — `__cnCompProdCargar` arma `extra` desde `datos` y lo pasa

**LOCALIZAR** (`:4374-4376`, verificado):

```javascript
      var _esMes = datos.dia_marcado == null;
      var _tarj = _esMes ? (ed.tarjetas || []) : [];
      host.innerHTML = __cnCompProdHtml(focosF, ed.meta, _tarj, sufijo);
```

**SUSTITUIR POR:**

```javascript
      var _esMes = datos.dia_marcado == null;
      var _tarj = _esMes ? (ed.tarjetas || []) : [];
      // [2026-09-08 · TARJETA-N1-EXTRA] `extra` viaja SOLO cuando la pregunta es mensual (N1) —
      // mismo criterio que `_tarj` arriba. Los campos salen de `datos` (el ejecutor de
      // Cuantificar, lo que arma el TEXTO), NO de `ed`/`ed.tarjetas` (/analisis/ejecutivo): son
      // los que se comparan visualmente contra la cifra del texto y deben ser la MISMA fuente
      // (H-05) — evita el bug de "dos cifras casi iguales que no cuadran".
      var _extra = _esMes ? {
        real: datos.real, ppto: datos.ppto, unidad: datos.unidad,
        referencia_label: datos.referencia_label,
        dias_con_dato: datos.dias_con_dato, dias_del_mes: datos.dias_del_mes,
        p50: datos.p50
      } : null;
      host.innerHTML = __cnCompProdHtml(focosF, ed.meta, _tarj, sufijo, _extra);
```

#### Cambio 4 de 4 — Verificación de que el resto de call sites de `__cnCompProdHtml` no existen

No hay Cambio 4 de código: es la comprobación V-3 de la §6.1. Se deja constancia aquí de que
**no hace falta tocar ningún otro sitio**, porque `:4376` es la única llamada (H-02).

### 3.2 · MODIFICAR `colapsable.css`

Son **dos inserciones**, en dos puntos distintos del archivo. **Ninguna regla existente se
modifica** (H-06).

#### CSS 1 de 2 — Los estilos del bloque

**LOCALIZAR** (`:1194-1197`, verificado — se deja **intacto**, es solo el punto de inserción):

```css
.cp-foco__kpicol { min-width: 0; height: 100%; display: flex; flex-direction: column; }
.cp-foco__kpicol .cn-kpi__row--solo { flex: 1 1 auto; min-height: 0; }
.cp-foco__kpicol .cp-mes__kpi { height: 100%; justify-content: space-between; }
```

**INSERTAR INMEDIATAMENTE DESPUÉS** de esas 3 líneas:

```css
/* [2026-09-08 · TARJETA-N1-EXTRA] Bloque propio del panel de N1, HERMANO de la tarjeta dentro
   de .cp-foco__kpicol. La tarjeta (.cn-kpi__row--solo) conserva su `flex: 1 1 auto` de arriba
   SIN TOCARLO: con este bloque en `flex: 0 0 auto` (alto natural), aquella se estira sola para
   llenar lo que quede. Ese reparto es justo el que se busca, así que no hace falta ningún
   modificador sobre la regla compartida -- que también usa __cnFocosHtml (:6656).
   🔑 SIN `overflow`. La regla de oro del proyecto (:1558-1561, :2527-2528) prohíbe un segundo
      scroller dentro de .cn-col: "dos scrollers anidados atrapan la rueda del ratón y dejan la
      pila inalcanzable" (:1480-1481). El alto se resuelve ampliando el contenedor (CSS 2/2),
      nunca metiendo una barra aquí. */
.cp-foco__extra { flex: 0 0 auto; display: flex; flex-direction: column; gap: 4px;
  margin-top: 8px; padding-top: 10px; border-top: 1px solid #E5E9E6; font-size: 12px; }
.cp-foco__extra-r { display: flex; justify-content: space-between; gap: 8px; color: #6E7C75; }
.cp-foco__extra-r b { color: #1A211E; font-variant-numeric: tabular-nums; font-weight: 600; }
.cp-foco__extra-gap { display: flex; justify-content: space-between; gap: 8px; margin-top: 2px;
  padding: 5px 9px; border-radius: 7px; font-weight: 700; font-size: 11.5px; }
.cp-foco__extra-gap--pos { background: #E9F3EC; color: #1f6b4a; }
.cp-foco__extra-gap--neg { background: #FBECEA; color: #C5311E; }
```

#### CSS 2 de 2 — El contenedor crece cuando lleva bloque extra

**LOCALIZAR** (`:2529-2531`, verificado — se deja **intacto**, es solo el punto de inserción):

```css
.cn-stk__body .cp-foco__panel .cn-compprod__grid { height: 375px; min-height: 0; }
.cn-stk__body .cp-foco__panel .cn-compprod__grid > * {
  height: 100%; min-height: 0; overflow: visible; }
```

**INSERTAR INMEDIATAMENTE DESPUÉS** de esas 3 líneas:

```css
/* [2026-09-08 · TARJETA-N1-EXTRA] El panel de N1 lleva ~90px más en la columna izquierda (las
   filas de referencia, días reportados y el chip GAP). Con los 375px fijos de arriba y
   `overflow: visible` en los hijos, ese contenido se saldría del panel por abajo y pisaría el
   bloque siguiente de la pila. 470px = 375 + 90 + 5 de aire.
   🔑 El modificador va en el GRID, no en la columna: es el grid quien fija la altura. Lo añade
      __cnCompProdHtml SOLO cuando hay bloque extra que pintar, así que N1D/N1DSEL/N1DSER y el
      tablero de Análisis (:2516, que ni siquiera cuelga de .cn-stk__body) siguen en 375px.
   🔑 La curva de la derecha también es height:100%, así que pasa de ~327px a ~422px. Es una
      MEJORA declarada: una serie diaria de 30 puntos se lee mejor con más alto. */
.cn-stk__body .cp-foco__panel .cn-compprod__grid--ext { height: 470px; }
```

### 3.3 · Cache-buster · dos archivos, dos versiones

Se tocaron `multitab_shell.js` y `colapsable.css`: **ambos** cache-busters suben.

**LOCALIZAR** en `main.html` (`:5`, verificado):

```html
    <link rel="stylesheet" href="{{ url_for('static', filename='css/colapsable.css') }}?v=20260907b">
```

**SUSTITUIR POR:**

```html
    <link rel="stylesheet" href="{{ url_for('static', filename='css/colapsable.css') }}?v=20260908a">
```

**LOCALIZAR** en `main.html` (`:88`, verificado — la letra final puede haber avanzado desde
que se escribió este plan; usar el valor **real** del archivo, no asumirlo):

```html
<script src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260908h"></script>
```

**SUSTITUIR POR** (misma línea, la letra final avanza una posición respecto a la que esté):

```html
<script src="{{ url_for('static', filename='js/multitab_shell.js') }}?v=20260908i"></script>
```

> ⚠️ Si al llegar aquí la versión actual **no** es `20260908h`, usar la letra siguiente a la
> que sí esté (nunca reescribir a una anterior) y anotarlo en el reporte final.

> ⚠️ Hay un `<link rel="prefetch">` de cada archivo en `login.html` (`colapsable.css:39`,
> `multitab_shell.js` — ver plan anterior), con versiones más antiguas. **No se tocan** — son
> precargas, no lo que se ejecuta.

---

## §4 · Orden de ejecución

Secuencial. Si un paso falla, **DETENERSE** y reportar.

| # | Paso | Detalle |
|---|---|---|
| 1 | Situarse | `cd 'C:\APLICACIONES\ProdIA\Repo ProdIA\frontend'` |
| 2 | Árbol limpio **+ línea base de V-5c** | `git status --short`, y `Select-String -Path static\css\colapsable.css -Pattern 'overflow: auto' -CaseSensitive` → **anotar la cifra** antes de tocar nada |
| 3 | Cambio 1 (helper `__cnN1ExtraHtml`) | §3.1 — va antes de su uso |
| 4 | Cambio 2 (firma + pintado en `__cnCompProdHtml`) | §3.1 |
| 5 | Cambio 3 (`__cnCompProdCargar` arma `extra`) | §3.1 |
| 6 | CSS | §3.2 |
| 7 | Cache-busters (2 líneas en `main.html`) | §3.3 |
| 8 | Validación | §6.1, V-1 → V-6 |

El orden 3 → 4 → 5 no es opcional: el helper debe existir antes de que `__cnCompProdHtml` lo
invoque, y `__cnCompProdHtml` debe aceptar `extra` antes de que `__cnCompProdCargar` se lo
pase.

---

## §5 · Reglas no negociables

1. **CERO cambios en el backend.** Los 5 datos que pide el diseño ya están en el payload
   (H-09). Si al ejecutar se descubre que falta alguno, **DETENERSE y reportar** — no añadirlo
   por cuenta propia en `respuesta_cuantificar.py`.
2. **No tocar `__cnTarjetasKpiHtml`** ni ninguno de sus otros 5 call sites (H-01).
3. **No tocar la regla genérica `.cn-kpi__row--solo` fuera del selector `--ext`** (H-04):
   cualquier ajuste de layout va en el selector descendiente nuevo, nunca en la regla base.
4. **JS en ES5**: `var` + `function`. Sin arrow functions, sin template literals, sin
   `const`/`let`.
5. El rótulo de la referencia es **siempre** `extra.referencia_label` o `"P50"` — nunca la
   cadena fija `"Presupuesto"` (H-06).
6. Código y comentarios **en español**, con la marca `[2026-09-08 · TARJETA-N1-EXTRA]`.
7. Copiar los bloques de la §3 **literalmente**, comentarios incluidos.
8. **Si algo no calza con el código real, DETENERSE y reportar.** Las anclas se verificaron
   contra los archivos el 2026-09-08.
9. **No hacer commit.** Al terminar, reportar archivos tocados y preguntar «¿Hago commit?».

---

## §6 · Validación

### 6.1 · Estática (la ejecuta el EXECUTOR)

Desde `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, línea por línea, PowerShell normal.

| # | Comando | Resultado esperado |
|---|---|---|
| V-1 | `node --check static\js\multitab_shell.js` | Sin salida. Si no hay `node`, anotarlo — es obligatorio intentarlo (un error de sintaxis deja el shell entero en blanco) |
| V-2 | `Select-String -Path static\js\multitab_shell.js -Pattern '__cnN1ExtraHtml' -CaseSensitive` | **≥2 líneas**: la definición y su uso dentro de `__cnCompProdHtml` |
| V-3 | `Select-String -Path static\js\multitab_shell.js -Pattern '__cnCompProdHtml\(' -CaseSensitive` | **2 líneas**: la definición y su único caller. Si sale más de 2, algo cambió respecto a H-02 — **detenerse** |
| V-4 | `Select-String -Path static\css\colapsable.css -Pattern 'cp-foco__extra' -CaseSensitive` | **≥5 líneas** — los estilos del bloque nuevo (CSS 1/2) |
| V-5 | `Select-String -Path static\css\colapsable.css -Pattern 'cn-compprod__grid--ext' -CaseSensitive` | **1 línea** — la regla de altura (CSS 2/2) |
| V-5b | `Select-String -Path static\js\multitab_shell.js -Pattern 'cn-compprod__grid--ext' -CaseSensitive` | **1 línea** — el JS que la añade al `gridCls` |
| V-5c | `Select-String -Path static\css\colapsable.css -Pattern 'overflow: auto' -CaseSensitive` | **La MISMA cifra que antes del cambio** (anotarla en el paso 2). Si sube, se coló un scroller anidado — **detenerse**, viola la regla de oro (H-04) |
| V-5d | `Select-String -Path static\css\colapsable.css -Pattern '\.cp-foco__kpicol \.cn-kpi__row--solo \{ flex: 1 1 auto; min-height: 0; \}' -CaseSensitive` | **1 línea** — la regla compartida sigue **intacta y sin modificar** (H-06) |
| V-6 | `Select-String -Path templates\main.html -Pattern 'colapsable.css.*v=20260908a\|multitab_shell.js.*v=20260908'` | **2 líneas** — el CSS con `20260908a` y el JS con la letra siguiente a la que tenía antes de este plan |

### 6.2 · Humana (la ejecuta el USUARIO, en el servidor de pruebas)

⚠️ **R3 · El executor NO puede marcar esto como verificado** (H-11): es un cambio 100% visual
y no hay suite de JS. El estado correcto al terminar la §6.1 es **«implementado, PENDIENTE de
validación humana»**.

En `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`:

```powershell
git pull origin main
```

Reiniciar el frontend (`iniciar_frontend.bat`) y en el navegador **Ctrl+F5** (se tocó JS y
CSS).

| # | Prueba | Resultado esperado |
|---|---|---|
| H-1 | «¿Cuánto produjo Castilla en abril?» | Bajo la tarjeta de siempre, un bloque nuevo: **Presupuesto 52,1**, **Días reportados 30/30**, chip **GAP Presupuesto +2,9** en verde |
| H-2 | El valor del GAP de H-1 | Coincide con la resta exacta de las cifras del **texto** de la respuesta (55,0 − 52,1) |
| H-3 | «¿Cuánto produjo la VRO en abril?» *(si «VRO» se resuelve — brecha aparte, §7)* | El bloque dice **GAP P50**, no GAP Presupuesto, y el color es rojo si el gap es negativo |
| H-4 | Tablero de Análisis → «Desempeño del mes» | **Sin cambios** — ninguna tarjeta de ese panel lleva el bloque nuevo. Es el control de no-regresión de H-01 |
| H-5 | Un N1D («¿cuánto produjo Castilla el 15 de agosto?») | **Sin cambios** — sigue sin tarjeta, como siempre (`_esMes` es falso) |
| H-6 | La tarjeta y el bloque nuevo, juntos | Ninguno se corta ni se sale del panel. El panel de N1 es **más alto que antes** (470px en vez de 375px) y la curva se ve más alta — es el efecto declarado en H-05 |
| H-7 | Rueda del ratón sobre el panel de N1 | La pila **sigue desplazándose con normalidad**. Si la rueda se queda «atrapada» dentro de la columna izquierda, hay un scroller anidado → **reportar**, viola la regla de oro (H-04) |
| H-8 | F12 → Console | **0 errores** |

**H-4 es el control más importante**: si el tablero de Análisis cambia, algo se salió de su
sitio y afectó a los 5 paneles que este plan promete no tocar.

---

## §7 · Fuera de alcance

- **«La VRO» no se resuelve como vicepresidencia.** Brecha preexistente (`CLAUDE.md §6`); H-3
  de la validación humana queda condicionada a que se resuelva aparte.
- **El rótulo REAL/P50 del anillo** de `__cnTarjetasKpiHtml` (arriba, no en el bloque nuevo).
  Sigue fuera, como en los planes anteriores.
- El desglose de hijos (`zoom`) y la curva del acumulado (N2) que no se pinta.
- Cualquier cambio en el backend, el clasificador, el drill, los goldens, la BD o el ETL.

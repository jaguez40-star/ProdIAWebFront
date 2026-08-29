# Plan MC-HIST-V01 — Panel «Historial» de MainChat (opción A · localStorage)

> **Versión:** v2 auditada — pasos 1-3 del flujo de 6 (Mapeo → Auditoría → Diagnóstico)
> ejecutados contra el código real el 2026-08-21, no desde memoria.
> **Modo:** Planner. El executor implementa, no decide.
> **Depende de:** `plan_MC-CHAT-V03_20260821.md`. **Verificado ya aplicado:**
> `repartir()` coloca `rb-cp-panel` en `#mc-chat-body`.

---

## 0. Marco normativo

El `CLAUDE.md` que gobierna por decisión del usuario es **`c:/APLICACIONES/ProdIA_V02/CLAUDE.md`**
(392 líneas, §0-§11). `ProdIA-2.0` (este repositorio, Flask) no tiene uno propio. Sus reglas
se aplican **por analogía**: las de método sí, las de stack (pnpm, vitest, ESLint) no.

| Regla | Ancla real y verificada | Uso aquí |
|---|---|---|
| Flujo de 6 pasos · Modo Planner | §0, viñetas 2-3 | Este plan nace v2 auditado |
| **R3** — «build verde» ≠ feature verificada | §0, R3 | §8.b es obligatoria |
| Todo en español | §0, viñeta 1 | Código, comentarios y commits |
| Formato de plan | §0, última viñeta | Estructura de este documento |
| **Q2** — se declara, nunca se fabrica | §7, Motor Q v2 | Estados vacíos y degradados honestos (H1) |
| **Q5** — el dispatcher valida el tipo; nunca fallback silencioso | §7, Motor Q v2 | Validación de forma al leer `localStorage` (H4) |

> ⚠️ `plan_MC-CHAT-V02` citaba «§15», «§17.5 R2/R3», «DT-14», «DT-15», «DT-16».
> **Ninguna existe.** No se reutilizan.

### 0.1 Pipelines configurados: ninguno

Verificado: sin `.github/`, sin `package.json`, sin `.pre-commit-config.yaml`, sin hooks
activos en `.git/hooks/`, sin suite de tests.

**Consecuencia de método:** no hay CI que pueda ponerse en rojo, así que *ningún automatismo
detectaría una regresión en `/`*. La validación **V8** de §8.a (diff de solo-inserciones sobre
el archivo compartido) no es una formalidad: es la **única barrera automática que existe**.

---

## 1. Contexto

### 1.1 Qué hay hoy

`/mainchat` monta el shell de `multitab_shell.js` y **reparte sus zonas** entre los paneles:

| Zona del shell | Panel | Cuerpo receptor |
|---|---|---|
| `#rb-cp-panel` (chat V02) | #2 «Chat» | `#mc-chat-body` |
| `#rb-cp-viewer` (análisis) | #3 «Insights» | `#mc-insights-cuerpo` |
| — | #1 «Historial» | **vacío — sin id** |

Invariante documentado en `acordeon.js`: *«una zona nunca queda huérfana — o está en su panel,
o está en el aparcadero»*.

### 1.2 Por qué NO se copia el sidebar clásico

`templates/components/sidebar.html` se auditó y descartó. Sus cuatro elementos están muertos
en MainChat:

| Elemento | Diagnóstico verificado |
|---|---|
| Lista de conversaciones | `data/chat_history.db` → **0 conversaciones, 0 mensajes**. Únicos escritores: `app.py:169`, `app.py:238` (handler Socket.IO) y `main.py:62` — todos del chat **legacy**, y `chat.js` no se carga en MainChat |
| Clic / 🗑 | Cableado en `chat.js` (`#conversations-list`). Sin él, inertes |
| `Reconectando…` | Lo mueve `updateConnectionStatus` de `chat.js` vía Socket.IO. Se congelaría |
| Badge `IA` | `ollama_status` solo lo pasa `routes/main.py`; `routes/mainchat.py` no → `Undefined` en Jinja → **siempre** pinta «IA offline» |

El chat V02 **no persiste nada** en ese store. El historial se construye desde cero, en el
navegador. Backend intacto.

### 1.3 El bloqueante y su solución autorizada

`__cnCid` y `__cnHistory` son `var` **privadas** del IIFE. Sin acceso, un historial solo podría
tocar el DOM de `#cn-messages`, y eso **se desincroniza**: el siguiente `__cnReplay()` repinta
la conversación anterior, y «Nueva conversación» no cambiaría `__cnCid`.

El usuario **autorizó** exponer una API mínima aditiva (Paso 1). Sigue el precedente ya presente
en el archivo: `paintFocoStk` se expuso igual, con el comentario *«Solo se expone la función;
el flujo de '/' no cambia»*.

---

## 2. Objetivo

Que el panel **#1 «Historial»** liste las conversaciones del navegador, permita abrirlas, crear
una nueva y borrarlas — persistiendo en `localStorage`, **sin tocar el backend**.

---

## 3. Hallazgos de la auditoría

Los 10 hallazgos ya están integrados en la especificación. Se listan para que el executor
entienda **por qué** el código tiene la forma que tiene y no lo «simplifique».

| # | Sev. | Hallazgo | Dónde se resuelve |
|---|---|---|---|
| **H1** | 🔴 | **`conversation_id` es estado del backend, no una etiqueta local.** Viaja en el POST (`multitab_shell.js:4418`) y el backend mantiene memoria conversacional — `CLAUDE.md` §1: *«Memoria conversacional volátil: un dict de proceso, se perdía al reiniciar»*, y §7 **Q3** describe drills de reescritura conversacional. Restaurar un `cid` viejo **asume que esa memoria sigue viva**. Tras un reinicio del backend, la UI mostraría la conversación entera mientras el backend la trata como nueva: una pregunta de seguimiento («¿y en julio?») perdería el contexto **sin aviso** | §5 Paso 2 — aviso explícito en la UI de conversación restaurada, y §9 como limitación declarada (**Q2**: se declara, no se disimula) |
| **H2** | 🔴 | **Incoherencia chat ↔ Insights al restaurar.** `__cnHistory` solo guarda las burbujas. El viewer (`#cn-stack`) conserva los paneles de la conversación **anterior**: el chat mostraría la conversación A junto a los gráficos de B | Paso 2 — `limpiarViewer()` vacía `#cn-stack` al restaurar. DOM puro, sin tocar el shell (`cn-stack` verificado en `multitab_shell.js:416` y `:2697`) |
| **H3** | 🟠 | **Cuota de `localStorage`.** Se guarda el HTML renderizado de hasta 30 conversaciones; las burbujas del V02 llevan tablas y tarjetas. El límite ronda 5 MB. Un reintento único soltando la última **no basta** | Paso 2 — `escribir()` purga en bucle hasta que quepa; además tope por conversación |
| **H4** | 🟠 | **Sin validación de forma al leer** (espíritu de **Q5**: nunca un fallback silencioso). `JSON.parse` puede devolver entradas de una versión anterior o manipuladas; el plan v1 solo comprobaba que fuera un array | Paso 2 — `valida()` filtra entrada por entrada |
| **H5** | 🟡 | **Reordenamiento invisible.** `unshift` sube la conversación al tope al guardarla, así que *abrir* una la reordena. Defendible, pero debe ser una decisión declarada, no un efecto colateral | Paso 2 — comentario explícito: el orden es «actividad reciente», no fecha de creación |
| **H6** | 🟡 | **Repintado destructivo.** Repintar la lista entera en cada autoguardado recrea los botones y **roba el foco** al usuario que esté navegando con teclado | Paso 2 — `pintar()` compara una firma y sale si nada cambió |
| **H7** | 🟡 | `e.target.closest` sin guarda: revienta si el destino del clic no es un `Element` | Paso 2 — guarda de tipo en el listener |
| **H8** | 🟡 | **Trampa de arranque.** El primer `render()` de `acordeon.js` corre al parsear ese script, **antes** de `historial.js` → el panel quedaría vacío hasta el siguiente render | Paso 5.b — `pintar()` al cierre del IIFE, con la guarda del Paso 4.b |
| **H9** | 🟢 | Sin pipelines de CI (verificado). El único riesgo es la regresión silenciosa en `/` | §0.1 + validación **V8** |
| **H10** | 🟢 | `?v=` vigente es `n` (verificado). El plan debe usar la letra siguiente | Paso 5.c |

---

## 4. Prerequisitos verificables

Ejecutar desde `c:\APLICACIONES\ProdIA\ProdIA-2.0`. **Anclas por `grep`, no por número de
línea** — otras sesiones editan estos archivos en paralelo y las líneas ya se movieron 3 veces.

| # | Comando | Esperado |
|---|---|---|
| P1 | `grep -c "window.MultiTabShell = {" static/js/multitab_shell.js` | `1` |
| P2 | `grep -c "var __cnCid" static/js/multitab_shell.js` | `1` |
| P3 | `grep -c "var __cnHistory" static/js/multitab_shell.js` | `1` |
| P4 | `grep -c "function __cnReplay" static/js/multitab_shell.js` | `1` |
| P5 | `grep -c "var __cnOptsOpen" static/js/multitab_shell.js` | `1` |
| P6 | `grep -c "window.ConsultaHist" static/js/multitab_shell.js` | `0` (aún no existe) |
| P7 | `grep -c "colocar('rb-cp-panel', 'mc-chat-body'" MainChat/static/js/acordeon.js` | `1` (V03 aplicado) |
| P8 | `grep -c "function repartir()" MainChat/static/js/acordeon.js` | `1` |
| P9 | `grep -c "mc-historial-body" MainChat/static/js/acordeon.js` | `0` (aún no existe) |
| P10 | `grep -o "?v=[0-9a-z]*" MainChat/templates/mainchat_layout.html \| sort -u` | **un solo** valor |

> **P1-P5, P7, P8 fallan → DETENERSE.** El código cambió y el plan se re-audita.
> **P6 o P9 devuelven `1`** → ese paso ya está hecho: no repetirlo.
> Anotar el valor de **P10**: es la versión vigente `V`. Todo el plan usa la **letra siguiente**.

---

## 5. Inventario y especificación

| Ruta absoluta | Acción | Alcance |
|---|---|---|
| `...\ProdIA-2.0\static\js\multitab_shell.js` | **MODIFICAR** | +18 líneas, **solo aditivas** |
| `...\ProdIA-2.0\MainChat\static\js\historial.js` | **CREAR** | ~260 líneas |
| `...\ProdIA-2.0\MainChat\static\css\historial.css` | **CREAR** | ~135 líneas |
| `...\ProdIA-2.0\MainChat\static\js\acordeon.js` | **MODIFICAR** | 2 ediciones |
| `...\ProdIA-2.0\MainChat\templates\mainchat_layout.html` | **MODIFICAR** | 2 inserciones + bump |
| `templates\components\sidebar.html` | **NO TOCAR** | descartado, §1.2 |
| `routes\*.py`, `app.py`, `static\js\chat.js` | **NO TOCAR** | backend intacto |

---

### PASO 1 · Exponer la API mínima en el shell

**Archivo:** `static\js\multitab_shell.js`
**Ancla:** la línea que empieza por `window.MultiTabShell = {`.
**Acción:** insertar **inmediatamente ANTES** de esa línea. Ahí `__cnCid`, `__cnHistory`,
`__cnOptsOpen` y `__cnReplay` están en alcance (verificado: P2, P3, P5, P4).

```js
  // MainChat necesita un historial de conversaciones, y __cnCid/__cnHistory son privadas
  // del IIFE. Manipular solo el DOM de #cn-messages no sirve: __cnHistory quedaría
  // desincronizado y el siguiente __cnReplay() repintaría la conversación anterior; además
  // "nueva conversación" debe cambiar el cid, o el backend sigue hilando el mismo thread.
  // Aditivo, como paintFocoStk: el flujo de '/' no cambia — nadie llama a esto allí.
  window.ConsultaHist = {
    snapshot: function () { return { cid: __cnCid, hist: __cnHistory.slice() }; },
    cargar: function (s) {
      if (!s || !s.cid || !Array.isArray(s.hist)) return false;
      __cnCid = s.cid;
      __cnHistory = s.hist.slice();
      __cnOptsOpen = false;   // una conversación restaurada no tiene desambiguación viva
      __cnReplay();
      return true;
    },
    nueva: function () {
      __cnCid = "cn-" + Math.floor(Math.random() * 1e9);
      __cnHistory = [];
      __cnOptsOpen = false;
      __cnReplay();           // con el historial vacío, siembra el saludo
      return __cnCid;
    }
  };
```

> 🔴 **Es la ÚNICA edición permitida en este archivo.** Un solo hunk contiguo de inserción.
> No reformatear, no reordenar, no tocar `window.MultiTabShell` (validación V8).

---

### PASO 2 · Crear `MainChat\static\js\historial.js`

Archivo completo, literal:

```js
/**
 * Panel «Historial» de MainChat — conversaciones del chat V02.
 *
 * Persiste en localStorage, NO en servidor: el chat V02 no guarda nada
 * (__cnCid vive en memoria y /api/consulta2/preguntar es un proxy a INGESTA).
 * El sidebar clásico (templates/components/sidebar.html) NO se reutilizó: su lista
 * la alimenta chat_history.db, que solo escribe el chat legacy vía Socket.IO — y
 * chat.js no se carga aquí. Habría salido siempre vacío.
 *
 * Alcance por navegador, no por usuario: quien entre desde otro equipo no ve estas
 * conversaciones. Es la consecuencia aceptada de no tocar el backend.
 *
 * ⚠️ LÍMITE CONOCIDO (H1): conversation_id es estado del BACKEND, no una etiqueta
 * local. Al restaurar una conversación se reutiliza su cid con la esperanza de que
 * el backend aún conserve su memoria — que es un dict de proceso y se pierde al
 * reiniciar. Cuando eso pasa, las burbujas siguen ahí pero el hilo del backend
 * empieza de cero. No es detectable desde el navegador, así que se DECLARA en la
 * interfaz al restaurar en vez de disimularlo.
 */
(function () {
    'use strict';

    var CLAVE = 'mc_historial_v1';
    var MAX = 30;              // conversaciones conservadas
    var MAX_BYTES_CONV = 300000;  // ~300 KB por conversación (H3)
    var GUARDADO_MS = 1200;    // debounce del autoguardado

    // Espejo en memoria: si localStorage falla (modo privado, cuota, políticas del
    // navegador) el panel sigue funcionando durante la sesión en vez de reventar.
    var memoria = null;

    // ── Almacén ─────────────────────────────────────────────────────────────

    // H4 (espíritu de Q5: nunca un fallback silencioso). Lo que hay en localStorage
    // puede venir de una versión anterior o estar manipulado: se valida entrada por
    // entrada y se descarta lo que no encaje, en vez de arrastrar objetos a medias.
    function valida(c) {
        return !!c && typeof c.cid === 'string' && c.cid &&
            Array.isArray(c.hist) && c.hist.length >= 2 &&
            typeof c.ts === 'number' && isFinite(c.ts);
    }

    function leer() {
        if (memoria) return memoria;
        var lista = [];
        try {
            var crudo = localStorage.getItem(CLAVE);
            var datos = crudo ? JSON.parse(crudo) : [];
            if (Array.isArray(datos)) lista = datos.filter(valida);
        } catch (e) {
            lista = [];
        }
        memoria = lista;
        return memoria;
    }

    // H3: el HTML de las burbujas incluye tablas y tarjetas, así que la cuota se
    // agota antes de llegar a MAX. Se purga en bucle desde la más antigua hasta que
    // quepa; si ni una sola entra, se conserva solo en memoria.
    function escribir(lista) {
        memoria = lista;
        var intento = lista.slice();
        while (true) {
            try {
                localStorage.setItem(CLAVE, JSON.stringify(intento));
                return;
            } catch (e) {
                if (!intento.length) return;   // almacenamiento bloqueado: solo memoria
                intento.pop();                 // suelta la más antigua y reintenta
            }
        }
    }

    function api() { return window.ConsultaHist || null; }

    // ── Título y fecha ──────────────────────────────────────────────────────

    // El título es la primera pregunta del usuario. __cnHistory guarda HTML ya
    // renderizado (y escapado), así que el texto se extrae con un nodo desechable
    // en vez de una regex: decodifica entidades sin inventarse un parser.
    function tituloDe(hist) {
        for (var i = 0; i < hist.length; i++) {
            if (hist[i].role === 'user') {
                var d = document.createElement('div');
                d.innerHTML = hist[i].html || '';
                var t = (d.textContent || '').trim();
                if (t) return t;
            }
        }
        return null;
    }

    function dd(n) { return (n < 10 ? '0' : '') + n; }

    function sello(ts) {
        var f = new Date(ts);
        return 'CHAT ' + dd(f.getDate()) + '/' + dd(f.getMonth() + 1) +
            ' ' + dd(f.getHours()) + ':' + dd(f.getMinutes());
    }

    function fechaLarga(ts) {
        var f = new Date(ts);
        return dd(f.getDate()) + '/' + dd(f.getMonth() + 1) + '/' + f.getFullYear() +
            ' ' + dd(f.getHours()) + ':' + dd(f.getMinutes());
    }

    // ── Guardado ────────────────────────────────────────────────────────────

    /**
     * Vuelca la conversación viva al almacén. Devuelve true si guardó.
     * Una conversación de una sola burbuja es el saludo que siembra __cnReplay():
     * no es una conversación y no se guarda.
     */
    function guardarActual() {
        var a = api();
        if (!a) return false;
        var s = a.snapshot();
        if (!s || !Array.isArray(s.hist) || s.hist.length < 2) return false;

        var hist = s.hist;
        // H3: una sola conversación desmedida (reportes con tablas largas) puede
        // agotar la cuota de todas las demás. Se recorta por la cola, conservando
        // las burbujas más recientes, que son las que el usuario espera ver.
        try {
            while (hist.length > 2 && JSON.stringify(hist).length > MAX_BYTES_CONV) {
                hist = hist.slice(0, hist.length - 1);
            }
        } catch (e) { /* si no se puede medir, se guarda tal cual */ }

        var lista = leer();
        var ya = -1;
        for (var i = 0; i < lista.length; i++) {
            if (lista[i].cid === s.cid) { ya = i; break; }
        }

        var entrada = {
            cid: s.cid,
            hist: hist,
            ts: ya >= 0 ? lista[ya].ts : Date.now(),
            titulo: tituloDe(hist)
        };

        // H5: el orden de la lista es ACTIVIDAD RECIENTE, no fecha de creación —
        // por eso unshift y no un sort por ts. Abrir una conversación la sube al
        // tope; es deliberado, no un efecto colateral.
        if (ya >= 0) lista.splice(ya, 1);
        lista.unshift(entrada);
        if (lista.length > MAX) lista.length = MAX;
        escribir(lista);
        return true;
    }

    var temporizador = null;
    function guardarConRetraso() {
        if (temporizador) clearTimeout(temporizador);
        temporizador = setTimeout(function () {
            temporizador = null;
            if (guardarActual()) pintar();
        }, GUARDADO_MS);
    }

    // El chat no emite eventos, así que el disparador es el propio DOM. Se reengancha
    // porque #cn-messages se recrea al cambiar de pestaña dentro del shell; moverlo
    // entre paneles, en cambio, no rompe el observador.
    var observador = null;
    var vigilado = null;

    function vigilarChat() {
        var m = document.getElementById('cn-messages');
        if (!m || m === vigilado) return;
        if (observador) observador.disconnect();
        observador = new MutationObserver(guardarConRetraso);
        observador.observe(m, { childList: true, subtree: true });
        vigilado = m;
    }

    // ── Acciones ────────────────────────────────────────────────────────────

    // H2: __cnHistory solo guarda las burbujas. Los paneles del viewer pertenecen a
    // la conversación que los produjo, así que al cambiar de conversación hay que
    // vaciarlos o Insights mostraría los gráficos de otra. Es DOM puro: no hace
    // falta ampliar la API del shell.
    function limpiarViewer() {
        var stack = document.getElementById('cn-stack');
        if (stack) stack.innerHTML = '';
    }

    function nueva() {
        var a = api();
        if (!a) return;
        guardarActual();
        limpiarViewer();
        a.nueva();
        avisoRestaurada = null;
        pintar(true);
    }

    // Se recuerda para el aviso de H1: solo aparece al restaurar, no al conversar.
    var avisoRestaurada = null;

    function abrir(cid) {
        var a = api();
        if (!a) return;
        guardarActual();
        var lista = leer();
        for (var i = 0; i < lista.length; i++) {
            if (lista[i].cid === cid) {
                limpiarViewer();
                if (a.cargar(lista[i])) avisoRestaurada = lista[i].ts;
                break;
            }
        }
        pintar(true);
    }

    function borrar(cid) {
        escribir(leer().filter(function (c) { return c.cid !== cid; }));
        pintar(true);
    }

    // ── Pintado ─────────────────────────────────────────────────────────────

    function esc(t) {
        return String(t == null ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // H6: repintar en cada autoguardado recrearía los botones y le robaría el foco
    // a quien navegue con teclado. Se compara una firma de lo que se ve y se sale si
    // no cambió nada.
    var firmaPintada = null;

    function firmaDe(lista, activa) {
        return lista.map(function (c) {
            return c.cid + '|' + (c.titulo || c.ts);
        }).join('~') + '#' + (activa || '') + '#' + (avisoRestaurada || '');
    }

    function pintar(forzar) {
        var cont = document.getElementById('mc-historial-body');
        if (!cont) return;   // panel colapsado: el almacén sigue intacto

        var a = api();
        if (!a) {
            // Q2: se declara el fallo, no se disimula con una lista vacía.
            cont.innerHTML =
                '<p class="mc-hist__vacio">El historial no está disponible: no se pudo ' +
                'enlazar con el chat.</p>';
            firmaPintada = null;
            return;
        }

        var lista = leer();
        var activa = (a.snapshot() || {}).cid;
        var firma = firmaDe(lista, activa);
        if (!forzar && firma === firmaPintada) return;
        firmaPintada = firma;

        var filas = lista.map(function (c) {
            var etiqueta = c.titulo || sello(c.ts);
            var tip = etiqueta + '\n' + fechaLarga(c.ts);
            return '<li class="mc-hist__item' + (c.cid === activa ? ' is-activa' : '') + '">' +
                '<button type="button" class="mc-hist__abrir" data-cid="' + esc(c.cid) + '" ' +
                'title="' + esc(tip) + '">' +
                '<i class="bi bi-chat-left-text" aria-hidden="true"></i>' +
                '<span class="mc-hist__txt">' + esc(etiqueta) + '</span></button>' +
                '<button type="button" class="mc-hist__borrar" data-borrar="' + esc(c.cid) + '" ' +
                'aria-label="Eliminar ' + esc(etiqueta) + '" title="Eliminar">' +
                '<i class="bi bi-trash3" aria-hidden="true"></i></button>' +
                '</li>';
        }).join('');

        // H1: el aviso es la parte honesta del trato. La memoria del hilo vive en el
        // backend y no hay forma de comprobarla desde aquí, así que se advierte en vez
        // de aparentar que la conversación continúa intacta.
        var aviso = avisoRestaurada
            ? '<p class="mc-hist__aviso"><i class="bi bi-info-circle" aria-hidden="true"></i> ' +
              'Conversación restaurada del ' + esc(fechaLarga(avisoRestaurada)) + '. ' +
              'Si el servidor se reinició desde entonces, no recordará lo anterior: ' +
              'repite el contexto en tu próxima pregunta.</p>'
            : '';

        cont.innerHTML =
            '<button type="button" class="mc-hist__nueva" id="mc-hist-nueva">' +
            '<i class="bi bi-plus-lg" aria-hidden="true"></i> Nueva conversación</button>' +
            aviso +
            (lista.length
                ? '<ul class="mc-hist__lista" role="list">' + filas + '</ul>'
                : '<p class="mc-hist__vacio">Todavía no hay conversaciones. ' +
                  'Las del panel Chat aparecerán aquí.</p>');
    }

    // Delegación en el contenedor del acordeón: render() destruye y recrea el DOM en
    // cada expandir/colapsar, así que enganchar por elemento dejaría listeners
    // huérfanos y botones muertos.
    var raiz = document.getElementById('mainchat-root');
    if (raiz) {
        raiz.addEventListener('click', function (e) {
            // H7: el destino de un clic no siempre es un Element con closest().
            var t = e.target;
            if (!t || typeof t.closest !== 'function') return;
            var b = t.closest('[data-borrar]');
            if (b) { borrar(b.getAttribute('data-borrar')); return; }
            var a = t.closest('[data-cid]');
            if (a) { abrir(a.getAttribute('data-cid')); return; }
            if (t.closest('#mc-hist-nueva')) nueva();
        });
    }

    // Cerrar la pestaña no debe perder la conversación en curso.
    window.addEventListener('beforeunload', function () { guardarActual(); });

    // API para acordeon.js: se llama en cada render(), cuando el cuerpo ya existe.
    // forzar=true porque render() acaba de recrear el DOM: la firma anterior ya no
    // describe nada que siga en pantalla.
    window.MainChatHistorial = {
        pintar: function () { pintar(true); vigilarChat(); }
    };

    // H8: el primer render() de acordeon.js ya ocurrió al parsear ese script, antes
    // que este archivo. Sin esta llamada el panel quedaría vacío hasta el siguiente.
    pintar(true);
    vigilarChat();
})();
```

---

### PASO 3 · Crear `MainChat\static\css\historial.css`

```css
/* Panel «Historial» de MainChat.
   Prefijo mc-hist- para no colisionar con .rb-*/.cn-* del shell ni con las mc-*
   del acordeón. La paleta sale de las variables que mainchat.css declara en :root. */

#mc-historial-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
}

.mc-hist__nueva {
    all: unset;
    box-sizing: border-box;
    flex: 0 0 auto;
    width: 100%;
    cursor: pointer;
    text-align: center;
    background: var(--mc-primary);
    color: #fff;
    border-radius: 8px;
    padding: 10px 12px;
    font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, arial, sans-serif;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    transition: background 0.18s;
}

.mc-hist__nueva:hover { background: #00584a; }
.mc-hist__nueva:focus-visible { outline: 2px solid var(--mc-lime); outline-offset: 2px; }

/* Aviso de conversación restaurada (H1). Ámbar, no rojo: no es un error, es una
   condición que el usuario debe tener presente al preguntar. */
.mc-hist__aviso {
    margin: 0;
    flex: 0 0 auto;
    background: #fdf6e3;
    border: 1px solid #e8d9a8;
    border-radius: 8px;
    padding: 8px 10px;
    color: #6b5518;
    font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, arial, sans-serif;
    font-size: 11.5px;
    line-height: 1.45;
}

.mc-hist__aviso i { color: #b8860b; margin-right: 4px; }

.mc-hist__lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
}

.mc-hist__item { display: flex; align-items: stretch; gap: 8px; }

.mc-hist__abrir {
    all: unset;
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 9px;
    border: 1px solid var(--mc-border);
    border-radius: 8px;
    padding: 9px 11px;
    background: #fff;
    color: var(--mc-navy);
    font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, arial, sans-serif;
    font-size: 12.5px;
    transition: border-color 0.18s, background 0.18s;
}

.mc-hist__abrir:hover { border-color: var(--mc-primary); background: var(--mc-lime-soft); }
.mc-hist__abrir:focus-visible { outline: 2px solid var(--mc-primary); outline-offset: -2px; }
.mc-hist__abrir i { color: var(--mc-primary); flex-shrink: 0; font-size: 13px; }

/* Título de largo libre: una sola línea con elipsis, texto completo en el tooltip.
   min-width:0 es obligatorio para que el truncado funcione dentro del flex. */
.mc-hist__txt {
    min-width: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mc-hist__item.is-activa .mc-hist__abrir {
    border-color: var(--mc-primary);
    background: var(--mc-lime-soft);
    font-weight: 600;
}

.mc-hist__borrar {
    all: unset;
    box-sizing: border-box;
    flex: 0 0 auto;
    width: 36px;
    cursor: pointer;
    display: grid;
    place-items: center;
    border: 1px solid var(--mc-border);
    border-radius: 8px;
    background: #fff;
    color: var(--mc-muted);
    font-size: 13px;
    transition: background 0.18s, color 0.18s, border-color 0.18s;
}

.mc-hist__borrar:hover {
    background: var(--mc-neg);
    border-color: var(--mc-neg);
    color: #fff;
}

.mc-hist__borrar:focus-visible { outline: 2px solid var(--mc-neg); outline-offset: 2px; }

.mc-hist__vacio {
    margin: 0;
    color: var(--mc-muted);
    font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
    .mc-hist__nueva, .mc-hist__abrir, .mc-hist__borrar { transition: none; }
}
```

---

### PASO 4 · Enganchar el panel en `acordeon.js`

#### 4.a — Dar id al cuerpo de Historial

**Ancla:** la cadena `if (seccion.id === 'insights') { … } else if (seccion.id === 'chat') { … }`
dentro de `panelAbierto()`.
**Acción:** añadir una rama `else if` **al final** de esa cadena.

```js
        } else if (seccion.id === 'historial') {
            // Historial NO es una zona del shell: su contenido lo pinta historial.js.
            // Por eso solo lleva id, sin rb-cp ni mc-cuerpo--rb — no usa la paleta
            // --rb-* y conserva su propio scroll y padding.
            cuerpo.id = 'mc-historial-body';
        }
```

#### 4.b — Pintarlo en cada render

**Ancla:** la llamada `repartir();` al final de `render()`.
**Acción:** insertar **inmediatamente DESPUÉS**.

```js
        // Después de repartir(): el chat ya está en su panel, así que #cn-messages
        // existe y el observador de historial.js puede engancharse. Pintar antes
        // dejaría el autoguardado sin vigilancia hasta el siguiente render.
        // La guarda cubre el primer render(), que corre antes de cargar historial.js.
        if (window.MainChatHistorial) window.MainChatHistorial.pintar();
```

---

### PASO 5 · Registrar los assets

**Archivo:** `MainChat\templates\mainchat_layout.html`

**5.a** — En `{% block head %}`, tras el `<link>` de `acordeon.css`:

```html
    <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/historial.css') }}?v=NUEVA">
```

**5.b** — Tras el `<script>` de `acordeon.js`:

```html
<!-- Después de acordeon.js: historial.js se registra en window.MainChatHistorial y
     pinta por su cuenta al final de su IIFE, porque el primer render() del acordeón
     ya ocurrió al parsear el script anterior. -->
<script src="{{ url_for('mainchat.static', filename='js/historial.js') }}?v=NUEVA"></script>
```

**5.c** — Sustituir `NUEVA` y **todas** las apariciones de `?v=` por la letra siguiente a la
registrada en P10 (si P10 dio `n`, usar `o`). Debe quedar **un único valor** en el documento.

---

## 6. Orden de ejecución

1. Prerequisitos §4 (anotar `V` de P10)
2. Paso 1 — `multitab_shell.js`
3. Paso 2 — `historial.js`
4. Paso 3 — `historial.css`
5. Paso 4 — `acordeon.js` (4.a, luego 4.b)
6. Paso 5 — plantilla (5.a, 5.b, 5.c)
7. Validaciones §8.a

---

## 7. Reglas no negociables

| # | Regla |
|---|---|
| **R-1** | En `static\js\multitab_shell.js`, **solo** el bloque del Paso 1. Un único hunk de inserción. Nada más. |
| **R-2** | **Prohibido tocar** `routes\*.py`, `app.py`, `static\js\chat.js`, `templates\components\sidebar.html`, `static\css\colapsable.css`, `static\css\style.css`. |
| **R-3** | Cero refactors de oportunidad: no renombrar, no reordenar, no «limpiar» código vecino. |
| **R-4** | Orden secuencial estricto. Si un paso falla → **DETENERSE** y reportar. No improvisar. |
| **R-5** | Un único `?v=` en toda la plantilla. Mezclar versiones sirve CSS viejo con JS nuevo. |
| **R-6** | Todo en español: código, comentarios y commits (`CLAUDE.md` §0). |
| **R-7** | El executor **no declara «completado»** una feature visual (§0 **R3**). Ver §8.b. |
| **R-8** | Todo acceso a `localStorage` va en `try/catch`. Almacenamiento bloqueado degrada, no rompe. |
| **R-9** | **No «simplificar» las defensas del Paso 2.** El bucle de purga, la firma de repintado, la validación por entrada y el aviso de restauración responden a hallazgos concretos (§3, H1-H7). Quitarlos reintroduce el bug. |

---

## 8. Validaciones

### 8.a — Automáticas (las ejecuta el executor)

| # | Comando | Esperado |
|---|---|---|
| V1 | `node --check MainChat/static/js/historial.js` | exit 0 |
| V2 | `node --check MainChat/static/js/acordeon.js` | exit 0 |
| V3 | `node --check static/js/multitab_shell.js` | exit 0 |
| V4 | `grep -c "window.ConsultaHist" static/js/multitab_shell.js` | `1` |
| V5 | `grep -c "mc-historial-body" MainChat/static/js/acordeon.js` | `1` |
| V6 | `grep -c "MainChatHistorial.pintar" MainChat/static/js/acordeon.js` | `1` |
| V7 | `grep -o "?v=[0-9a-z]*" MainChat/templates/mainchat_layout.html \| sort -u \| wc -l` | `1` |
| **V8** | `git diff --numstat static/js/multitab_shell.js` | **solo inserciones**, borrados `0` |
| V9 | `git status --short routes/ app.py static/js/chat.js templates/components/` | **vacío** |
| V10 | `grep -c "cn-stack" MainChat/static/js/historial.js` | `1` (H2 aplicado) |
| V11 | `grep -c "intento.pop()" MainChat/static/js/historial.js` | `1` (H3 aplicado) |

> Sin Node disponible, reportar V1-V3 como ⏳, **nunca** como ✅.
> **V8 es la barrera crítica**: no hay CI (§0.1). Un borrado en ese archivo = regresión en `/`.

### 8.b — Validación humana en navegador — 🔴 OBLIGATORIA

`CLAUDE.md` §0 **R3**. El executor no tiene navegador y **no puede** marcar esto. Su reporte
cierra con *«Validación visual humana ⏳ PENDIENTE»*.

| # | Prueba | Criterio |
|---|---|---|
| H-1 | Abrir `/mainchat` con Historial expandido | Botón «Nueva conversación» + aviso de lista vacía |
| H-2 | Preguntar en el panel Chat, esperar ~2 s | Aparece una entrada **con el texto de la pregunta** como título |
| H-3 | Segunda pregunta | **No se duplica**: se actualiza la misma entrada |
| H-4 | Escribir en el input y esperar el autoguardado | El texto a medio escribir **no se pierde** y el foco no salta (H6) |
| H-5 | «Nueva conversación» | Chat vuelve al saludo, **Insights queda vacío** (H2), la anterior sigue listada |
| H-6 | Abrir la conversación anterior | Se repinta completa, queda marcada activa, **aparece el aviso ámbar** (H1) e Insights se vació |
| H-7 | Preguntar tras H-6 | F12 → Network: el `conversation_id` del POST coincide con el `cid` restaurado |
| H-8 | 🗑 | Desaparece y no vuelve al recargar |
| H-9 | **F5** | La lista sobrevive; la conversación en curso también |
| H-10 | Colapsar y reexpandir Historial | Lista correcta, botones vivos (delegación) |
| H-11 | Título largo | Una línea con elipsis; texto completo + fecha en el tooltip |
| H-12 | Conversación con reporte de tablas grandes | Se guarda sin romper la lista (H3) |
| H-13 | **Sin regresión en `/`** | `/` → Consulta → preguntar, cambiar de pestaña, volver: idéntico |
| H-14 | Consola F12 en `/mainchat` y en `/` | 0 errores, 0 warnings |
| H-15 | Incógnito con almacenamiento bloqueado | Funciona durante la sesión, **sin excepciones** |

---

## 9. Fuera de alcance y limitaciones declaradas

| Tema | Estado |
|---|---|
| **Memoria del hilo en el backend (H1)** | ⚠️ **Limitación declarada, no resuelta.** `conversation_id` indexa un dict de proceso en el backend. Restaurar reutiliza el cid, pero si el backend se reinició esa memoria no existe. No es detectable desde el navegador → se **avisa en la UI** (Q2: se declara, no se disimula). Resolverlo exige persistir la conversación en servidor |
| Historial por usuario y multi-dispositivo | Requiere backend (opción B). Decisión abierta |
| **«Estado del Sistema»** (Reconectando / Datos / IA) | Auditado y descartado: uno depende de Socket.IO (ausente), otro de `ollama_status` que `routes/mainchat.py` no pasa, el tercero está hardcodeado en verde. Rehacerlo con fuentes reales **exige backend** |
| Reutilizar `chat_history.db` | Su store pertenece al chat legacy; el V02 no escribe ahí |
| Renombrar conversaciones | No pedido |
| Bloque de usuario del sidebar clásico | Redundante: MainChat ya tiene avatar + waffle con logout |
| Backend | **Cero cambios** |

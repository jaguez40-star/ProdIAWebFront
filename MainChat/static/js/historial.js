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
        // [2026-08-26] Bug reportado: "Nuevo chat" vaciaba la PILA (analiza_foco) pero dejaba
        // intacto el bloque de arriba (#cn-ejec-top — Desempeño/Focos de atención). Si la
        // conversación anterior había pintado ahí algo distinto del panorama (p.ej. "muéstrame
        // bloque 3"), esa vista sobrevivía al nuevo chat. __cnVolverPanorama() es la MISMA
        // función del botón "Volver al panorama": repinta el global (solo P50), instantáneo.
        if (window.__cnVolverPanorama) window.__cnVolverPanorama();
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

        // [2026-08-24] MEDIDO en la app: el elemento computaba display:block pese a la regla
        // `#mc-historial-body { display:flex }` de historial.css — el acordeón lo crea con la
        // clase .mc-cuerpo y algo del cascade lo dejaba en block. Sin columna flex,
        // `margin-top:auto` del pie se resuelve a 0px y el bloque de usuario quedaba pegado al
        // contenido con la franja en blanco debajo (493px medidos). Se fija en línea, que es lo
        // único que no depende del orden de las hojas ni de la especificidad.
        cont.style.display = 'flex';
        cont.style.flexDirection = 'column';

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
            '<div class="mc-hist__scroll">' +
            (lista.length
                ? '<ul class="mc-hist__lista" role="list">' + filas + '</ul>'
                : '<p class="mc-hist__vacio">Todavía no hay conversaciones. ' +
                  'Las del panel Chat aparecerán aquí.</p>') +
            '</div>' +
            pieGrupo();
    }

    // [2026-08-26] Grupo de pie (petición del usuario): Estado del sistema + el disparador
    // de usuario ahora viven JUNTOS en una sola sección anclada al fondo del panel, en vez de
    // "Estado" fijo justo debajo de la lista y "Usuario" fijo al fondo con una franja vacía
    // entre los dos. El ancla (margin-top:auto + separador) se mueve del antiguo .mc-hist__pie
    // a este wrapper — VER el comentario de .mc-hist__pie-grupo en historial.css: depende de
    // que ningún hermano en #mc-historial-body tenga flex-grow>0, igual que antes.
    function pieGrupo() {
        return '<div class="mc-hist__pie-grupo">' + mockEstadoSistema() + bloqueUsuario() + '</div>';
    }

    // ⚠️ MOCK — puramente visual, NO conectado a nada real. Petición explícita:
    // "que otro contenido usamos" — un lugar para EVALUAR el layout con el bloque
    // de estado del sidebar clásico, mientras se decide si vale la pena cablearlo.
    //
    // Los tres indicadores están hardcodeados a positivo A PROPÓSITO — replican,
    // sin resolver, el mismo problema por el que el sidebar clásico se descartó en
    // §1.2 del plan MC-HIST-V01: "Reconectando…" depende de Socket.IO (ausente en
    // MainChat) y el badge IA depende de `ollama_status`, que routes/mainchat.py no
    // pasa a la plantilla. Cablear esto de verdad exige tocar el backend — no se
    // hace aquí. Si este bloque se conserva más allá de la evaluación visual, hay
    // que decidir esa dependencia antes, o seguirá mintiendo igual que el original.
    function mockEstadoSistema() {
        return '<div class="mc-hist__sistema" aria-hidden="true">' +
            '<div class="mc-hist__sistema-titulo">' +
            '<i class="bi bi-gear" aria-hidden="true"></i> Estado del sistema</div>' +
            '<div class="mc-hist__sistema-linea">' +
            '<i class="bi bi-wifi" aria-hidden="true"></i> Conectado</div>' +
            '<div class="mc-hist__sistema-grid">' +
            '<span class="mc-hist__sistema-chip mc-hist__sistema-chip--ok">' +
            '<i class="bi bi-database" aria-hidden="true"></i> Datos</span>' +
            '<span class="mc-hist__sistema-chip mc-hist__sistema-chip--ok">' +
            '<i class="bi bi-robot" aria-hidden="true"></i> IA</span>' +
            '</div></div>';
    }

    // Disparador del menú de usuario: pie fijo, fuera de .mc-hist__scroll, con el
    // mismo flex:0 0 auto que .mc-hist__sistema — no debe irse con el scroll de la
    // lista. El MENÚ no se pinta aquí: vive en .mc-shell (ver mainchat_layout.html)
    // porque este contenedor tiene overflow:hidden y se repinta entero.
    // USER_FULL_NAME solo se LEE: multitab_shell.js:40 la usa como gate de UI.
    // [2026-08-24] El botón va dentro de una SECCIÓN de pie propia (.mc-hist__pie), no
    // suelto al final del flujo. El anclaje al fondo lo llevaba margin-top:auto sobre el
    // propio botón, y bastaba con que un hermano creciera para dejarlo pegado al contenido
    // con la franja en blanco debajo. Con la sección envolvente el pie es una zona con
    // identidad propia (separador arriba, fondo del panel abajo), como el pie del sidebar
    // de Claude que pidió el usuario.
    function bloqueUsuario() {
        var nombre = String(window.USER_FULL_NAME || '').trim() || 'Usuario';
        var inicial = nombre.charAt(0).toUpperCase();
        return '' +
            '<div class="mc-hist__pie">' +
                '<button type="button" class="mc-hist__usuario" id="mc-usuario-btn" ' +
                        'aria-haspopup="menu" aria-expanded="false" aria-label="Menú de usuario">' +
                    '<span class="mc-hist__usuario-avatar" aria-hidden="true">' + esc(inicial) + '</span>' +
                    '<span class="mc-hist__usuario-nombre">' + esc(nombre) + '</span>' +
                    '<i class="bi bi-chevron-up mc-hist__usuario-chevron" aria-hidden="true"></i>' +
                '</button>' +
            '</div>';
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

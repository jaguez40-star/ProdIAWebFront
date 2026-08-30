/**
 * Acordeón horizontal de MainChat — port de AcordeonHorizontal.tsx de ProdIA_V02.
 *
 * Tres paneles colapsables con reparto de ancho por PAREJA abierta (no por
 * panel) y reglas de auto-emparejamiento: Historial es un panel de apoyo, no de
 * trabajo, y por eso rompe la simetría (ver expandir/colapsar).
 *
 * Los cuerpos quedan vacíos a propósito: aquí se construirá el contenido real.
 */
(function () {
    'use strict';

    var SECCIONES = [
        {
            id: 'historial',
            num: 1,
            titulo: 'Historial',
            subtitulo: 'Conversaciones anteriores',
            icono: 'bi-chat-square-text',
        },
        {
            id: 'chat',
            num: 2,
            titulo: 'Chat',
            subtitulo: 'Consulta en lenguaje natural',
            icono: 'bi-chat-dots',
        },
        {
            id: 'insights',
            num: 3,
            titulo: 'Insights',
            subtitulo: 'Gráficos de la respuesta',
            icono: 'bi-bar-chart',
        },
    ];

    var MAX_ESCRITORIO = 2;
    var MAX_MOVIL = 1;
    var CONSULTA_MOVIL = '(max-width: 1023px)';

    // Estado inicial: la pareja de trabajo (Chat + Insights), con Historial
    // colapsado. Insights abierto de entrada implica que el shell de Consulta
    // se monta al cargar la página, no en el primer clic.
    //
    // El orden importa: el más reciente queda al final, porque slice(-max)
    // conserva la cola. Chat va último para que sea el que sobreviva en móvil,
    // donde solo cabe un panel abierto.
    var abiertos = ['insights', 'chat'];

    var raiz = document.getElementById('mainchat-root');
    if (!raiz) return;

    // ── Shell de multitab_shell.js: una sola instancia, repartida en dos ──────
    //
    // El shell envuelve tres zonas en <div class="rb-cp" id="rb-cp">: el riel de
    // pestañas (oculto por CSS), su PANEL de chat y su VIEWER de análisis. El chat
    // va al panel #2 del acordeón y el análisis al #3, así que las dos zonas viajan
    // a paneles distintos. No se copia el núcleo a otro archivo: duplicaría los ids
    // cn-* y los globales __v2* y ambos chats se pelearían por el DOM.
    //
    // El esqueleto vive en un HOST permanente fuera de #mainchat-root (que render()
    // arrasa con innerHTML=''), no dentro de un panel: si colgara de Insights, el
    // chat solo existiría cuando el usuario abriera el panel #3.
    var host = document.createElement('div');
    host.id = 'mc-shell-host';
    (document.querySelector('.mc-shell') || document.body).appendChild(host);

    var shellContainer = document.createElement('div');
    shellContainer.id = 'multitab-shell-container';
    host.appendChild(shellContainer);

    var shellMontado = false;

    function montarShellUnaVez() {
        if (shellMontado) return;
        if (!window.MultiTabShell || typeof window.MultiTabShell.mount !== 'function') return;
        shellMontado = true;

        // mount() oculta con display:none CUALQUIER '.app-footer' del documento
        // (piensa que es el layout de dos paneles de '/'), y ese selector también
        // encuentra el footer real de MainChat. Se restaura inmediatamente después.
        window.MultiTabShell.mount('consulta');
        var footer = document.querySelector('.mc-shell > .app-footer');
        if (footer) footer.style.display = '';
    }

    // Aparcadero de las zonas cuando su panel está colapsado: su propio padre
    // original (#rb-cp), que sigue vivo dentro del host. Invariante del reparto:
    // una zona nunca queda huérfana — o está en su panel, o está aquí.
    function aparcadero() {
        return document.getElementById('rb-cp') || host;
    }

    function guardarZonas() {
        var p = aparcadero();
        ['rb-cp-panel', 'rb-cp-viewer'].forEach(function (id) {
            var z = document.getElementById(id);
            if (z && z.parentNode !== p) p.appendChild(z);
        });
    }

    function repartir() {
        colocar('rb-cp-panel', 'mc-chat-body', false);
        colocar('rb-cp-viewer', 'mc-insights-cuerpo', true);
    }

    function colocar(idZona, idCuerpo, esViewer) {
        var zona = document.getElementById(idZona);
        if (!zona) return;
        var cuerpo = document.getElementById(idCuerpo);
        var destino = cuerpo || aparcadero();
        if (zona.parentNode !== destino) destino.appendChild(zona);
        if (esViewer && cuerpo) repintarPlotly(cuerpo);
    }

    // El host está en display:none y un nodo sin dimensión real no lo puede medir
    // Plotly, así que al devolver el viewer a un panel visible hay dos deudas que
    // saldar: las gráficas ya pintadas necesitan resize, y las que llegaron
    // mientras el panel estaba colapsado ni siquiera se pintaron.
    function repintarPlotly(cuerpo) {
        if (window.Plotly && window.Plotly.Plots && typeof window.Plotly.Plots.resize === 'function') {
            cuerpo.querySelectorAll('.js-plotly-plot').forEach(function (g) {
                try {
                    window.Plotly.Plots.resize(g);
                } catch (e) {
                    // nodo aún sin medidas reales; se ignora
                }
            });
        }

        // Los bloques "analiza_foco" que llegaron sin medidas quedan marcados con
        // data-pend-paint="1" (multitab_shell.js, __cnStackPush). El shell solo
        // vacía esa cola dentro de renderViewer(), que aquí NO vuelve a ejecutarse
        // nunca porque el riel de pestañas está oculto: sin esto, esa gráfica se
        // quedaría en blanco para siempre. __cnAnzEd/__cnAnzDd/__cnAnzSufijo viven
        // como propiedades JS del propio nodo y sobreviven a moverlo de padre.
        var pintar = window.MultiTabShell && window.MultiTabShell.paintFocoStk;
        if (typeof pintar !== 'function') return;
        cuerpo.querySelectorAll('[data-pend-paint="1"]').forEach(function (b) {
            if (b.__cnAnzEd && b.__cnAnzDd) {
                try {
                    pintar(b, b.__cnAnzEd, b.__cnAnzDd, b.__cnAnzSufijo || '');
                } catch (e) {
                    // se deja marcado para el próximo intento
                    return;
                }
            }
            delete b.dataset.pendPaint;
        });

        // [2026-08-24] El resize y el pintado diferido CAMBIAN la altura del contenido: al volver
        // de un panel colapsado la vista quedaba arriba, no en el último set de gráficos. Se delega
        // en el shell (stackScroll) para no duplicar aquí la búsqueda del scroller ni la doble
        // medición. Sobre el ÚLTIMO bloque de la pila, que es el último resultado.
        var bajar = window.MultiTabShell && window.MultiTabShell.stackScroll;
        if (typeof bajar !== 'function') return;
        var pila = cuerpo.querySelector('#cn-stack');
        if (pila && pila.lastElementChild) bajar(pila.lastElementChild);
    }

    // Sin matchMedia se trata como escritorio, en vez de reventar.
    var mql =
        typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_MOVIL) : null;

    function maxAbiertos() {
        return mql && mql.matches ? MAX_MOVIL : MAX_ESCRITORIO;
    }

    function expandir(id) {
        if (abiertos.indexOf(id) !== -1) return;

        // Simétrico a colapsar(): abrir Historial siempre lo empareja con Chat
        // (25/75), sin importar qué estuviera abierto antes — si Insights estaba
        // abierto, se colapsa. 'historial' va al final del array para que
        // sobreviva el slice(-max) también en móvil (max 1).
        if (id === 'historial') {
            abiertos = ['chat', 'historial'].slice(-maxAbiertos());
        } else {
            abiertos = abiertos.concat([id]).slice(-maxAbiertos());
        }

        render();
    }

    function colapsar(id) {
        if (abiertos.length <= 1) return;

        // Historial es un panel de apoyo, no de trabajo: cerrarlo siempre revela
        // el par de trabajo completo (Chat + Insights), sin importar cuál de los
        // dos estuviera abierto antes. Cerrar Chat o Insights, en cambio, se
        // comporta de forma normal — queda el otro solo.
        if (id === 'historial') {
            abiertos = ['chat', 'insights'].slice(-maxAbiertos());
        } else {
            abiertos = abiertos.filter(function (x) {
                return x !== id;
            });
        }

        render();
    }

    // Reparto de la pareja de trabajo Chat + Insights, en % de ancho: el
    // análisis gráfico (anillos + tarjetas P50 + focos de atención) necesita
    // más ancho que el chat para no comprimirse. Partió del 50/50, bajó a
    // 37,5 (−25 % relativo) y de ahí a 31,875 (−15 % relativo adicional).
    var CHAT_PCT = 31.875;

    // Historial (1) y Chat (3) valen lo mismo que desde el principio para que
    // esa pareja conserve su 25/75. Insights se DERIVA del reparto de arriba
    // en vez de fijarse a mano, así ajustar CHAT_PCT no descuadra la aritmética
    // ni obliga a tocar la pareja con Historial.
    var GROW_HISTORIAL = 1;
    var GROW_CHAT = 3;
    var GROW_INSIGHTS = (GROW_CHAT * (100 - CHAT_PCT)) / CHAT_PCT; // ≈ 6,4118

    /**
     * El ancho depende de la PAREJA abierta, no del panel: los grow se reparten
     * proporcionalmente entre los abiertos.
     */
    function growDe(id) {
        if (id === 'historial') return GROW_HISTORIAL;
        if (id === 'insights') return GROW_INSIGHTS;
        return GROW_CHAT;
    }

    function panelColapsado(seccion) {
        var panel = document.createElement('div');
        panel.className = 'mc-panel mc-panel--colapsado';

        var tira = document.createElement('button');
        tira.type = 'button';
        tira.className = 'mc-tira';
        tira.setAttribute('aria-expanded', 'false');
        tira.setAttribute('aria-label', 'Abrir ' + seccion.titulo);
        tira.addEventListener('click', function () {
            expandir(seccion.id);
        });

        var icono = document.createElement('span');
        icono.className = 'mc-tira-icono';
        icono.innerHTML = '<i class="bi ' + seccion.icono + '" aria-hidden="true"></i>';

        var titulo = document.createElement('span');
        titulo.className = 'mc-tira-titulo';
        titulo.textContent = seccion.titulo;

        tira.appendChild(icono);
        tira.appendChild(titulo);
        panel.appendChild(tira);
        return panel;
    }

    // ── Badge "Act:" del panel Insights (petición del usuario, 2026-08-26) ─────────────────
    //
    // Fecha del reporte MÁS RECIENTE cargado en la BD (core.config_reporte, MAX(fecha_reporte)),
    // vía /api/reportes/ultimo -> INGESTA /reportes/ultimo. Cacheada en memoria: la fecha no
    // cambia durante la sesión, así que una sola petición basta aunque el usuario colapse/
    // expanda Insights varias veces (cada expandir() reconstruye el header desde cero).
    var _actTxt = null;       // 'Act: 19 ago 2026' una vez resuelve la 1ª carga; null mientras tanto
    var _actPromise = null;   // evita pedir 2 veces si el 2º render llega antes de que responda la 1ª
    var _MESES_CORTOS = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago',
        'sep', 'oct', 'nov', 'dic'];

    function _fmtFechaCorta(iso) {
        // 'YYYY-MM-DD' -> '19 ago 2026'. Si no parsea, el ISO crudo (nunca revienta el badge).
        try {
            var p = String(iso).split('-');
            return parseInt(p[2], 10) + ' ' + _MESES_CORTOS[parseInt(p[1], 10)] + ' ' + p[0];
        } catch (e) {
            return String(iso);
        }
    }

    function _pintarActEnBadges() {
        var nodos = document.querySelectorAll('.mc-act-badge__txt');
        for (var i = 0; i < nodos.length; i++) nodos[i].textContent = _actTxt;
    }

    function _cargarAct() {
        if (_actPromise) return;
        _actPromise = fetch('/api/reportes/ultimo')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                _actTxt = 'Act: ' + (d && d.fecha_reporte ? _fmtFechaCorta(d.fecha_reporte) : '—');
                _pintarActEnBadges();
            })
            .catch(function () {
                _actTxt = 'Act: —';
                _pintarActEnBadges();
            });
    }

    // DOM del badge: icono fijo + span de texto que _pintarActEnBadges() rellena al resolver.
    // '…' de arranque en vez de vacío: dice "esto está cargando", no "esto está roto".
    function _actBadgeHtml() {
        return '<i class="bi bi-database" aria-hidden="true"></i>' +
            '<span class="mc-act-badge__txt">' + (_actTxt || 'Act: …') + '</span>';
    }

    function panelAbierto(seccion, puedeColapsar) {
        var panel = document.createElement('div');
        panel.className = 'mc-panel mc-panel--abierto';
        panel.style.setProperty('--pv-panel-grow', String(growDe(seccion.id)));

        var cabecera = document.createElement('button');
        cabecera.type = 'button';
        cabecera.className = 'mc-cabecera';
        cabecera.setAttribute('aria-expanded', 'true');
        cabecera.setAttribute('aria-label', 'Colapsar ' + seccion.titulo);
        if (!puedeColapsar) {
            cabecera.disabled = true;
            cabecera.title = 'Debe quedar al menos un panel abierto';
        }
        cabecera.addEventListener('click', function (e) {
            // [2026-08-30] El waffle de análisis vive dentro de esta cabecera (solo en
            // Insights). Sin esta guarda, pulsarlo colapsaría el panel: el clic burbujea
            // hasta aquí. No se resuelve con stopPropagation en el waffle porque el
            // listener que ABRE su popover está en document, y cortarlo lo dejaría muerto.
            var t = e && e.target;
            if (t && typeof t.closest === 'function' && t.closest('#cn-anbtn')) return;
            colapsar(seccion.id);
        });

        var num = document.createElement('span');
        num.className = 'mc-num';
        num.textContent = String(seccion.num);

        var titulos = document.createElement('span');
        titulos.className = 'mc-titulos';

        var titulo = document.createElement('span');
        titulo.className = 'mc-titulo';
        titulo.innerHTML =
            '<i class="bi ' + seccion.icono + ' mc-titulo-icono" aria-hidden="true"></i>';
        titulo.appendChild(document.createTextNode(seccion.titulo));

        var subtitulo = document.createElement('span');
        subtitulo.className = 'mc-subtitulo';
        subtitulo.textContent = seccion.subtitulo;

        titulos.appendChild(titulo);
        titulos.appendChild(subtitulo);

        var colapsarIco = document.createElement('span');
        colapsarIco.className = 'mc-colapsar';
        colapsarIco.setAttribute('aria-hidden', 'true');
        colapsarIco.innerHTML = '<i class="bi bi-layout-sidebar-inset"></i>';

        cabecera.appendChild(num);
        cabecera.appendChild(titulos);

        // Badge "Act: <fecha>" — SOLO en Insights (petición del usuario). Va DESPUÉS de titulos
        // (que es flex:1 y absorbe el espacio libre) y ANTES del botón de colapsar, así que
        // cae justo donde estaba el hueco vacío del header. _cargarAct() es idempotente (usa
        // _actPromise como guarda) así que no importa cuántas veces se reconstruya el header.
        if (seccion.id === 'insights') {
            var actBadge = document.createElement('span');
            actBadge.className = 'mc-act-badge';
            actBadge.title = 'Fecha del reporte más reciente cargado en la base de datos';
            actBadge.innerHTML = _actBadgeHtml();
            cabecera.appendChild(actBadge);
            _cargarAct();

            // [2026-08-30] Waffle de análisis. Antes vivía en una columna propia de 51px
            // a la izquierda del contenido; aquí no cuesta ancho porque ocupa el hueco
            // que ya sobraba en el header. Lo pinta el shell, que es quien sabe qué
            // análisis está activo. Guarda defensiva: si el shell no cargó, el panel
            // funciona igual, solo sin waffle.
            if (window.MultiTabShell && typeof window.MultiTabShell.analisisBtnHtml === 'function') {
                var caja = document.createElement('span');
                caja.className = 'mc-anbtn-caja';
                caja.innerHTML = window.MultiTabShell.analisisBtnHtml();
                cabecera.appendChild(caja);
            }
        }

        cabecera.appendChild(colapsarIco);

        var cuerpo = document.createElement('div');
        cuerpo.className = 'mc-cuerpo';

        // Los cuerpos que hospedan una zona del shell llevan id estable (para que
        // repartir() los encuentre) y la clase rb-cp. Esa clase NO es decorativa:
        // colapsable.css declara ahí toda la paleta --rb-* — al sacar una zona de
        // su envoltorio original perdería los colores de las burbujas. Trae además
        // layout y decoración propios, que .mc-cuerpo--rb.rb-cp neutraliza.
        //
        // Aquí NO se coloca la zona: repartir() lo hace después, cuando el árbol ya
        // forma parte del documento — el shell engancha por getElementById y sobre
        // un nodo desconectado esas búsquedas fallan en silencio.
        if (seccion.id === 'insights') {
            cuerpo.id = 'mc-insights-cuerpo';
            cuerpo.classList.add('mc-cuerpo--rb', 'rb-cp');
        } else if (seccion.id === 'chat') {
            cuerpo.id = 'mc-chat-body';
            cuerpo.classList.add('mc-cuerpo--rb', 'rb-cp');
        } else if (seccion.id === 'historial') {
            // Historial NO es una zona del shell: su contenido lo pinta historial.js.
            // Por eso solo lleva id, sin rb-cp ni mc-cuerpo--rb — no usa la paleta
            // --rb-* y conserva su propio scroll y padding.
            cuerpo.id = 'mc-historial-body';
        }

        panel.appendChild(cabecera);
        panel.appendChild(cuerpo);
        return panel;
    }

    function render() {
        var puedeColapsar = abiertos.length > 1;

        // Devolver las zonas del shell al aparcadero ANTES de destruir el DOM:
        // innerHTML='' se llevaría por delante el chat y el análisis ya pintados.
        guardarZonas();

        raiz.innerHTML = '';
        raiz.classList.add('mc-acordeon');

        // Se recorre SECCIONES, no `abiertos`: el orden visual es siempre
        // Historial · Chat · Insights, independiente de cuál se abrió primero.
        SECCIONES.forEach(function (seccion) {
            var estaAbierto = abiertos.indexOf(seccion.id) !== -1;
            raiz.appendChild(
                estaAbierto ? panelAbierto(seccion, puedeColapsar) : panelColapsado(seccion)
            );
        });

        // AQUÍ, no dentro de panelAbierto(): todos los paneles ya se anexaron a
        // `raiz`, que está adjunta al documento, así que los cuerpos receptores ya
        // forman parte del árbol vivo. Mover una zona a un nodo desconectado dejaría
        // sin dimensión a sus gráficas.
        repartir();

        // Después de repartir(): el chat ya está en su panel, así que #cn-messages
        // existe y el observador de historial.js puede engancharse. Pintar antes
        // dejaría el autoguardado sin vigilancia hasta el siguiente render.
        // La guarda cubre el primer render(), que corre antes de cargar historial.js.
        if (window.MainChatHistorial) window.MainChatHistorial.pintar();
    }

    // Al encoger a móvil el máximo baja a 1: se conservan los últimos abiertos,
    // que son los que el usuario tocó más recientemente.
    if (mql && typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', function () {
            var max = maxAbiertos();
            if (abiertos.length > max) abiertos = abiertos.slice(-max);
            render();
        });
    }

    // Estado inicial: si se carga ya en móvil, se recorta antes del primer render.
    abiertos = abiertos.slice(-maxAbiertos());

    // Orden de arranque, no negociable: el shell se monta ANTES del primer render
    // para que sus zonas existan cuando repartir() las busque. El montaje ocurre
    // dentro del host (oculto), así que las gráficas que el shell pinta por su
    // cuenta al arrancar nacen sin medidas — repartir() las repinta al colocar el
    // viewer en un panel visible.
    montarShellUnaVez();
    render();
})();

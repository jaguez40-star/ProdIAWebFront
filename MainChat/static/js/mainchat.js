/**
 * MainChat — menú de usuario anclado al pie del panel Historial.
 *
 * El disparador (#mc-usuario-btn) lo pinta historial.js dentro de
 * #mc-historial-body, que se repinta entero en cada cambio de la lista y en cada
 * colapsar/expandir del acordeón (acordeon.js:329). Por eso:
 *   · el clic se recoge por DELEGACIÓN en document, no con getElementById;
 *   · el menú (#mc-menu) vive en .mc-shell, fuera de #mainchat-root, para que no
 *     lo destruya innerHTML='' ni lo recorten los seis overflow:hidden de la
 *     cadena de ancestros del panel;
 *   · position:fixed + coordenadas calculadas: absolute se recortaría.
 *
 * Cierra por clic fuera, por Escape y al colapsar/expandir un panel: un menú que
 * solo se cierra con su propio botón atrapa al usuario que lo abrió por error.
 */
(function () {
    'use strict';

    const menu = document.getElementById('mc-menu');
    if (!menu) return;

    const MARGEN = 8;   // separación respecto al botón y a los bordes del viewport

    function btnActual() {
        return document.getElementById('mc-usuario-btn');
    }

    // Coloca el menú sobre el botón. Requiere que el menú YA esté visible: con
    // display:none (.mc-menu[hidden]) offsetHeight devuelve 0 y quedaría mal
    // situado. abrir() garantiza ese orden.
    function situar() {
        const btn = btnActual();
        if (!btn) return;

        const r = btn.getBoundingClientRect();
        const alto = menu.offsetHeight;
        const ancho = menu.offsetWidth;

        // Hacia ARRIBA desde el botón; si no cabe, se apoya en el borde superior.
        let top = r.top - alto - MARGEN;
        if (top < MARGEN) top = MARGEN;

        // Alineado al borde izquierdo del botón, sin salirse del viewport.
        let left = r.left;
        if (left + ancho > window.innerWidth - MARGEN) {
            left = window.innerWidth - ancho - MARGEN;
        }
        if (left < MARGEN) left = MARGEN;

        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function abrir(mostrar) {
        menu.hidden = !mostrar;
        const btn = btnActual();
        if (btn) btn.setAttribute('aria-expanded', mostrar ? 'true' : 'false');
        if (mostrar) situar();   // medir DESPUÉS de quitar hidden
    }

    // Un solo listener para abrir y para cerrar por clic fuera. La guarda de
    // closest() replica la de historial.js:328 (H7): el target de un clic no
    // siempre es un Element.
    document.addEventListener('click', function (e) {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;

        if (t.closest('#mc-usuario-btn')) {
            e.stopPropagation();
            abrir(menu.hidden);
            return;
        }
        if (!menu.hidden && !menu.contains(t)) abrir(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !menu.hidden) abrir(false);
    });

    window.addEventListener('resize', function () {
        if (!menu.hidden) situar();
    });

    // Colapsar/expandir mueve el panel durante 320ms (transición flex,
    // acordeon.css:33-36). Perseguir el botón durante la animación se ve peor que
    // cerrar, así que se cierra.
    const raiz = document.getElementById('mainchat-root');
    if (raiz) {
        raiz.addEventListener('click', function (e) {
            const t = e.target;
            if (!t || typeof t.closest !== 'function') return;
            if (t.closest('.mc-cabecera') && !menu.hidden) abrir(false);
        });
    }

    // Accesos del waffle. Tres clases de destino:
    //   data-tab   -> pestaña del panel de multitab_shell.js: se abre in-situ, sin navegar.
    //   data-ruta  -> [2026-08-25] WAFFLE-NAV: navega de verdad. Solo quedan aquí rutas que
    //                 existen (Clásico, Colapsable); las que no existían (Admin/Config/Ayuda)
    //                 se retiraron del markup en vez de dejarlas con un aviso en consola.
    //   data-modal -> [2026-09-03] abre un modal de Bootstrap (bundle ya cargado por
    //                 base.html, disponible aquí: ver el comentario de más abajo, líneas
    //                 149-153, sobre el orden defer vs. bootstrap.bundle.min.js) y cierra el
    //                 popover del waffle — igual que data-tab, porque el botón vive DENTRO
    //                 de #mc-menu y el listener de "clic fuera" no lo cerraría solo.
    menu.querySelectorAll('.mc-acceso').forEach(function (acceso) {
        acceso.addEventListener('click', function () {
            const tab = acceso.dataset.tab;
            if (tab) {
                // El shell se carga en /mainchat; si no está, no hay panel que abrir.
                if (typeof window.__rbAbrirTab === 'function' && window.__rbAbrirTab(tab)) {
                    abrir(false);
                } else {
                    console.warn('MainChat: pestaña "' + tab + '" no disponible en este shell');
                }
                return;
            }
            const ruta = acceso.dataset.ruta;
            if (ruta) {
                window.location.href = ruta;
                return;
            }
            const modalId = acceso.dataset.modal;
            if (modalId) {
                const el = document.getElementById(modalId);
                if (el && typeof window.bootstrap !== 'undefined' && window.bootstrap.Modal) {
                    window.bootstrap.Modal.getOrCreateInstance(el).show();
                    abrir(false);
                } else {
                    console.warn('MainChat: modal "' + modalId + '" no disponible');
                }
            }
        });
    });

    // [2026-09-03] Admin > Usuarios Uso: se puebla al abrir el modal, no al cargar la
    // página — así no se paga la lectura del log en cada visita a /mainchat. Una sola
    // vez por sesión de página: 'shown.bs.modal' se dispara en cada apertura, pero el
    // guard de cargado evita releer.
    const modalAdmin = document.getElementById('mc-admin-modal');
    if (modalAdmin) {
        let usoCargado = false;

        modalAdmin.addEventListener('shown.bs.modal', function () {
            if (usoCargado) return;
            usoCargado = true;
            cargarUsuariosUso();
        });
    }

    function escapar(txt) {
        const d = document.createElement('div');
        d.textContent = txt == null ? '' : String(txt);
        return d.innerHTML;
    }

    function filasEntraron(lista) {
        let html = '';
        for (let i = 0; i < lista.length; i++) {
            const r = lista[i];
            html += '<tr>' +
                '<td>' + escapar(r.usuario) + '</td>' +
                '<td class="mc-uso-num">' + escapar(r.sesiones) + '</td>' +
                '<td>' + escapar(r.fechas.join(', ')) + '</td>' +
                '<td>' + escapar(r.que_hizo) + '</td>' +
                '</tr>';
        }
        return html;
    }

    function filasRechazados(lista) {
        let html = '';
        for (let i = 0; i < lista.length; i++) {
            const r = lista[i];
            html += '<tr>' +
                '<td>' + escapar(r.usuario) + '</td>' +
                '<td class="mc-uso-num">' + escapar(r.intentos) + '</td>' +
                '<td>' + escapar(r.fechas.join(', ')) + '</td>' +
                '<td>' + escapar(r.observacion) + '</td>' +
                '</tr>';
        }
        return html;
    }

    function cargarUsuariosUso() {
        const caja = document.getElementById('mc-admin-uso');
        if (!caja) return;

        fetch('/api/admin/usuarios-uso', { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                const entraron = data.entraron || [];
                const rechazados = data.rechazados || [];

                if (!entraron.length && !rechazados.length) {
                    caja.innerHTML = '<p class="mc-admin-panel__placeholder">' +
                        'Todavía no hay accesos registrados. La tabla se irá poblando ' +
                        'con los inicios de sesión y la actividad a partir de ahora.</p>';
                    return;
                }

                let html = '';

                html += '<div class="mc-uso-bloque">' +
                    '<h6 class="mc-uso-titulo mc-uso-titulo--ok">Entraron</h6>' +
                    '<table class="mc-uso-tabla"><thead><tr>' +
                    '<th>Usuario</th><th>Sesiones</th><th>Fechas</th><th>Qué hizo</th>' +
                    '</tr></thead><tbody>' +
                    (entraron.length
                        ? filasEntraron(entraron)
                        : '<tr><td colspan="4" class="mc-uso-vacio">Sin registros</td></tr>') +
                    '</tbody></table></div>';

                html += '<div class="mc-uso-bloque">' +
                    '<h6 class="mc-uso-titulo mc-uso-titulo--no">Rechazados</h6>' +
                    '<table class="mc-uso-tabla"><thead><tr>' +
                    '<th>Usuario</th><th>Intentos</th><th>Fechas</th><th>Observación</th>' +
                    '</tr></thead><tbody>' +
                    (rechazados.length
                        ? filasRechazados(rechazados)
                        : '<tr><td colspan="4" class="mc-uso-vacio">Sin registros</td></tr>') +
                    '</tbody></table></div>';

                caja.innerHTML = html;
            })
            .catch(function (err) {
                console.error('MainChat: error cargando Usuarios Uso', err);
                caja.innerHTML = '<p class="mc-admin-panel__placeholder">' +
                    'No se pudo cargar el reporte de accesos.</p>';
            });
    }

    // [2026-09-03] Admin > Usuarios: la lista blanca de correos autorizados.
    // Listener propio: el de Usuarios Uso tiene un return temprano por su guard.
    if (modalAdmin) {
        let usuariosCargado = false;

        modalAdmin.addEventListener('shown.bs.modal', function () {
            if (usuariosCargado) return;
            usuariosCargado = true;
            cargarUsuariosLista();
        });
    }

    function cargarUsuariosLista() {
        const caja = document.getElementById('mc-admin-usuarios');
        if (!caja) return;

        fetch('/auth/authorized-emails', { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                const lista = (data.authorized_emails || []).slice().sort();

                if (!lista.length) {
                    caja.innerHTML = '<p class="mc-admin-panel__placeholder">' +
                        'La lista blanca está vacía.</p>';
                    return;
                }

                let filas = '';
                for (let i = 0; i < lista.length; i++) {
                    filas += '<tr>' +
                        '<td class="mc-uso-num">' + (i + 1) + '</td>' +
                        '<td>' + escapar(lista[i]) + '</td>' +
                        '</tr>';
                }

                caja.innerHTML = '<div class="mc-uso-bloque">' +
                    '<h6 class="mc-uso-titulo mc-uso-titulo--ok">Lista blanca</h6>' +
                    '<p class="mc-lb-resumen">' + escapar(lista.length) +
                    ' correos autorizados</p>' +
                    '<table class="mc-uso-tabla"><thead><tr>' +
                    '<th>#</th><th>Correo</th>' +
                    '</tr></thead><tbody>' + filas + '</tbody></table></div>';
            })
            .catch(function (err) {
                console.error('MainChat: error cargando la lista blanca', err);
                caja.innerHTML = '<p class="mc-admin-panel__placeholder">' +
                    'No se pudo cargar la lista de usuarios autorizados.</p>';
            });
    }

    const salir = document.getElementById('mc-logout');
    if (salir) {
        salir.addEventListener('click', function () {
            fetch('/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
                .then(function () {
                    window.location.href = '/login';
                })
                .catch(function (err) {
                    console.error('MainChat: error cerrando sesión', err);
                    window.location.href = '/login';
                });
        });
    }
})();

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

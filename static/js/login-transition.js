/**
 * Transición de salida del login — ProdIA 2.0
 *
 * Al autenticar, el panel del formulario viaja a la izquierda cruzando sobre la
 * imagen de la app (Imagen1.png), que en paralelo pasa de gris a color y se
 * reencuadra a pantalla completa. Al terminar, redirect a /mainchat.
 *
 * Diseño: anime_log.md. Plan: Planes/plan_LOGIN-TRANSICION-SALIDA_20260830.md
 *
 * CONTRATO — este archivo NUNCA debe poder romper el login:
 *   - Se carga DESPUÉS de login.js y de login-steps.js (ver login.html). Si falla
 *     al parsear, ambos ya se ejecutaron completos y el login funciona igual.
 *   - La única huella en login.js es la guarda del redirect (3 líneas, plan §1
 *     H-6): si window.__ltRedirigir no existe, login.js se comporta como siempre.
 *   - Se engancha por monkey-patch de window.showSuccess, exactamente igual que
 *     login-steps.js (líneas 217-239 de ese archivo).
 *
 * POR QUÉ CONGELA EL BOTÓN (plan §1 H-2): el bloque finally de login.js
 * (líneas 203-208) reactiva el botón SIEMPRE, también tras un login correcto.
 * Sin esta contramedida el usuario vería el botón revivir a mitad de la
 * animación. showSuccess se invoca en login.js L182, ANTES del finally, así que
 * congelarBoton() se repite con setTimeout(0) para correr también después de él.
 */
(function () {
  'use strict';

  // Fase 1 — cuánto se ve la captura encendida antes de empezar a retirarla.
  // 900ms: el filtro de encendido (.9s con .1s de retardo) ya está prácticamente
  // completo, así que el color se aprecia, pero no se deja la imagen ahí parada.
  var SHOW_MS = 900;

  // Fase 2 — la captura se desvanece y deja la pantalla limpia con solo el
  // indicador de carga. Sin esto, la imagen se queda congelada a pantalla
  // completa durante TODO el hueco de red posterior al redirect: el navegador
  // mantiene la página vieja a la vista hasta que /mainchat pinta, y eso puede
  // ser varios segundos. Debe coincidir con la transition de opacity en
  // login.css (.25s).
  var FADE_MS = 250;

  // El redirect espera DOS cosas: que la pantalla ya esté limpia
  // (SHOW_MS + FADE_MS = 1150) y que el panel haya completado su recorrido
  // (transform 1.2s), o se cortaría a medias (anime_log.md §10, error nº7).
  // Manda la segunda, que es la más larga.
  var EXIT_MS = 1200;

  var DESTINO = '/mainchat';

  var body = document.body;
  var form = document.getElementById('login-form');
  var loginBtn = document.getElementById('login-btn');
  var loginText = document.getElementById('login-text');
  var loginSpinner = document.getElementById('login-spinner');

  // Guarda de arranque: si falta cualquier pieza, el módulo se desactiva en
  // silencio y el login sigue comportándose como siempre.
  if (!body || !form || !loginBtn || !loginText || !loginSpinner) {
    return;
  }

  // prefers-reduced-motion: el CSS de login.css (líneas 51-58) ya colapsa todas
  // las transiciones a 0.01ms. Si el JS siguiera esperando 1250 ms, el usuario
  // se quedaría mirando una pantalla ya quieta (plan §1 H-3).
  var reducido = false;
  try {
    reducido = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* noop */ }

  if (reducido) {
    SHOW_MS = 0;
    FADE_MS = 0;
    EXIT_MS = 0;
  }

  var lanzada = false;     // la transición corre una sola vez
  var navegando = false;   // el redirect se dispara una sola vez

  // Devuelve el botón a su estado "ocupado" y lo deja así hasta que la página
  // navegue. Contrarresta el finally de login.js (plan §1 H-2), y de paso pone
  // el texto VERIFICANDO… que pide el documento de diseño (anime_log.md §7).
  function congelarBoton() {
    try {
      loginBtn.disabled = true;
      loginText.textContent = 'VERIFICANDO…';
      loginSpinner.classList.remove('d-none');
    } catch (e) {
      console.warn('[login-transition] congelarBoton() falló', e);
    }
  }

  function redirigir() {
    if (navegando) { return; }
    navegando = true;
    window.location.href = DESTINO;
  }

  // Arranca la transición. Las dos clases se ponen en el MISMO frame: la app se
  // enciende exactamente cuando el panel arranca, y eso es lo que hace que se
  // perciba como un relevo y no como dos animaciones sueltas (anime_log.md §4).
  function arrancar() {
    if (lanzada) { return; }
    lanzada = true;

    try {
      congelarBoton();

      // Repetido en la siguiente vuelta del bucle de eventos: el finally de
      // login.js todavía no ha corrido cuando showSuccess devuelve el control.
      window.setTimeout(congelarBoton, 0);

      body.classList.add('lt-is-live');
      body.classList.add('lt-is-gone');

      // Fase 2: retira la captura una vez terminado el encendido, para no dejarla
      // congelada a pantalla completa mientras se espera a /mainchat.
      window.setTimeout(function () {
        body.classList.add('lt-is-loading');
      }, SHOW_MS);

      window.setTimeout(redirigir, EXIT_MS);
    } catch (e) {
      console.warn('[login-transition] arrancar() falló', e);
      // Si la animación revienta, el usuario NO puede quedarse atrapado en el
      // login: se navega igualmente.
      redirigir();
    }
  }

  // Expuesto para que login.js delegue aquí su redirect (plan §1 H-6). Si este
  // archivo no cargara, login.js conserva su setTimeout de siempre.
  window.__ltRedirigir = arrancar;

  // GUARDA: showSuccess NO es exclusiva del login — login.js L260 la usa también
  // para la solicitud de acceso enviada con éxito. Sin comprobar que hay un
  // login en curso, enviar una solicitud de acceso dispararía la transición y
  // echaría al usuario a /mainchat sin haberse autenticado. Es el mismo hallazgo
  // que documenta login-steps.js en su cabecera (líneas 23-29).
  var loginEnCurso = false;

  form.addEventListener('submit', function () {
    loginEnCurso = true;
  });

  // Enganche: monkey-patch de showSuccess, mismo patrón que login-steps.js.
  // El original SIEMPRE se invoca vía apply() — el mensaje que ve el usuario no
  // se pierde pase lo que pase aquí.
  var origShowSuccess = window.showSuccess;

  if (typeof origShowSuccess === 'function') {
    window.showSuccess = function () {
      try {
        if (loginEnCurso) {
          arrancar();
        }
      } catch (e) {
        console.warn('[login-transition] patch(showSuccess) falló', e);
      }
      return origShowSuccess.apply(this, arguments);
    };
  }

  // Un login fallido o el modal de acceso denegado devuelven el formulario a su
  // estado normal: hay que permitir un intento nuevo.
  function rearmar() {
    loginEnCurso = false;
  }

  var origShowError = window.showError;

  if (typeof origShowError === 'function') {
    window.showError = function () {
      rearmar();
      return origShowError.apply(this, arguments);
    };
  }

  var origModal = window.showAccessRequestModal;

  if (typeof origModal === 'function') {
    window.showAccessRequestModal = function () {
      rearmar();
      return origModal.apply(this, arguments);
    };
  }
})();

/**
 * Animación decorativa de "pasos LDAP" para el login.
 *
 * Puramente cosmética: el backend nunca ha reportado etapas reales del
 * bind LDAP (ni aquí ni en el proyecto del que se portó esta idea,
 * robustez-v02). Los 4 pasos avanzan por temporizador mientras el POST
 * real a /auth/login corre en paralelo, y se completan de golpe cuando
 * el backend confirma.
 *
 * CONTRATO: este archivo NUNCA debe poder romper el login.
 *   - Se carga DESPUÉS de login.js (ver login.html) — si este script
 *     falla al parsear o no carga, login.js ya se ejecutó completo y
 *     el login funciona exactamente igual que sin esta animación.
 *   - No se modifica login.js. Se engancha desde fuera:
 *       1) listener propio de 'submit' en #login-form (se registra
 *          después del de login.js, por tanto corre después)
 *       2/3/4) monkey-patch de window.showSuccess / showError /
 *          showAccessRequestModal — las 3 son "function" declaradas en
 *          login.js (script clásico, sin 'use strict'), por lo que son
 *          propiedades de window reasignables. El original SIEMPRE se
 *          invoca, pase lo que pase con la animación.
 *
 * HALLAZGO IMPORTANTE (verificado por grep en login.js): showError y
 * showSuccess NO son exclusivas del login — también las usa el flujo
 * de "solicitud de acceso" del modal (líneas 234/259/262/266). Sin la
 * guarda `running`, enviar una solicitud de acceso con éxito pintaría
 * los 4 pasos en verde con "Sesión establecida", que es falso y confuso.
 * Por eso los 3 parches solo actúan si `running` es true, y `running`
 * únicamente lo pone en true el arranque de ESTE listener de submit.
 */
(function () {
  'use strict';

  var STEPS = [
    'Resolviendo red.ecopetrol.com.co',
    'Bind LDAP contra Active Directory',
    'Leyendo grupos de seguridad',
    'Sesión establecida'
  ];

  var form = document.getElementById('login-form');
  var container = document.getElementById('ldap-steps');
  var usernameInput = document.getElementById('username');
  var passwordInput = document.getElementById('password');

  // Guarda de arranque: si falta cualquier elemento, el módulo se
  // desactiva en silencio. Nunca debe interferir con el login.
  if (!form || !container || !usernameInput || !passwordInput) {
    return;
  }

  var reduced = false;
  try {
    reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* noop */ }

  var UNIT = reduced ? 50 : 450;       // ms por paso
  var FLOOR = reduced ? 40 : 400;      // suelo extra tras completar la revelación natural
  var WATCHDOG_MS = UNIT * STEPS.length + 8000;

  var timers = [];
  var running = false;   // hay un intento de login EN CURSO (sin resolver aún)
  var mounted = false;   // los pasos están EN PANTALLA (resueltos o no)
  var step = -1;
  var startedAt = 0;

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) {
      window.clearTimeout(timers[i]);
    }
    timers = [];
  }

  function at(ms, fn) {
    timers.push(window.setTimeout(fn, ms));
  }

  function render() {
    var html = '';
    for (var i = 0; i < STEPS.length; i++) {
      var state = i < step ? 'is-done' : (i === step ? 'is-active' : '');
      var mark = '';
      if (i < step) {
        mark = '<i class="fas fa-check" aria-hidden="true"></i>';
      } else if (i === step) {
        mark = '<span class="ldap-dot" aria-hidden="true"></span>';
      }
      html += '<div class="ldap-row ' + state + '">' +
        '<span class="ldap-circle">' + mark + '</span>' +
        '<span class="ldap-label">' + STEPS[i] + '</span>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  // El backend corre en paralelo — esto es solo el "teatro".
  function start() {
    try {
      clearTimers();
      running = true;
      mounted = true;
      step = 0;
      startedAt = now();
      container.setAttribute('aria-hidden', 'false');
      container.classList.remove('d-none');
      render();

      for (var i = 0; i < STEPS.length; i++) {
        (function (idx) {
          at(UNIT * (idx + 1), function () {
            step = idx + 1;
            render();
          });
        })(i);
      }

      // Red de seguridad: si nadie llama succeed()/abort() en un tiempo
      // razonable, la animación no debe quedar huérfana en pantalla.
      at(WATCHDOG_MS, function () {
        if (running) {
          abort();
        }
      });
    } catch (e) {
      console.warn('[login-steps] start() falló', e);
      running = false;
    }
  }

  // El backend confirmó. Se espera a que termine el recorrido natural de
  // los 4 pasos (nunca se acelera) más un suelo de FLOOR ms, y entonces
  // se fuerza el estado "todo completado" como red de seguridad.
  //
  // `running = false` se hace AQUÍ, de forma síncrona, no dentro del
  // setTimeout: el flag indica "esta animación ya tiene dueño", y el
  // dueño se decide en el instante en que el backend responde. Si se
  // dejara para el callback (~1,8 s después) habría una ventana en la
  // que un showError/showAccessRequestModal posterior podría abortar
  // una animación ya resuelta. Los timers pendientes siguen vivos a
  // propósito — completan la revelación natural de los pasos.
  function succeed() {
    running = false;
    try {
      var elapsed = now() - startedAt;
      var fullReveal = UNIT * STEPS.length;
      var remaining = Math.max(0, fullReveal - elapsed);

      at(remaining + FLOOR, function () {
        step = STEPS.length;
        render();
      });
    } catch (e) {
      console.warn('[login-steps] succeed() falló', e);
    }
  }

  // El backend falló, o se abrió el modal de solicitud de acceso:
  // desmontar sin estado de error visual (igual que el original).
  function abort() {
    try {
      clearTimers();
      running = false;
      mounted = false;
      step = -1;
      container.innerHTML = '';
      container.classList.add('d-none');
      container.setAttribute('aria-hidden', 'true');
    } catch (e) {
      console.warn('[login-steps] abort() falló', e);
    }
  }

  // Réplica deliberada de la validación de login.js (username >= 3
  // caracteres, password no vacío) para no arrancar el teatro en un
  // submit que login.js ya abortó por su propio validateForm(). Leer
  // clases 'is-invalid' sería más frágil por timing.
  function isFormValid() {
    var u = usernameInput.value.trim();
    var p = passwordInput.value;
    return u.length >= 3 && p.length > 0;
  }

  // Enganche 1: listener propio. Se registra DESPUÉS del de login.js
  // (login-steps.js carga después en login.html), así que corre
  // segundo: login.js ya hizo preventDefault() y lanzó el fetch antes
  // de que esto se ejecute. No se toca el evento en absoluto.
  form.addEventListener('submit', function () {
    try {
      if (isFormValid()) {
        start();
      }
    } catch (e) {
      console.warn('[login-steps] submit hook falló', e);
    }
  });

  // Enganches 2/3/4: monkey-patch de las funciones globales de login.js.
  // El original SIEMPRE se invoca vía apply() — pase lo que pase en el
  // bloque de arriba, el mensaje real que ve el usuario no se pierde.
  //
  // `guard` decide CUÁNDO actúa cada parche, y no es el mismo para todos:
  //
  //   - showSuccess → solo si `running` (hay un login sin resolver). Es
  //     la guarda que impide que enviar una SOLICITUD DE ACCESO con éxito
  //     (login.js L259, mismo showSuccess) pinte los 4 pasos en verde con
  //     "Sesión establecida" — sería rotundamente falso.
  //
  //   - showError / showAccessRequestModal → si `mounted` (hay pasos en
  //     pantalla, resueltos o no). Más amplio a propósito: tras un login
  //     con éxito `running` ya es false pero los checks verdes siguen
  //     visibles; si entonces aparece un error, hay que retirarlos o el
  //     usuario vería "Sesión establecida" junto a un mensaje de fallo.
  function patch(name, guard, onCall) {
    var orig = window[name];
    if (typeof orig !== 'function') {
      return; // login.js cambió o no cargó — este módulo no hace nada
    }
    window[name] = function () {
      try {
        if (guard()) {
          onCall();
        }
      } catch (e) {
        console.warn('[login-steps] patch(' + name + ') falló', e);
      }
      return orig.apply(this, arguments);
    };
  }

  var isRunning = function () { return running; };
  var isMounted = function () { return mounted; };

  patch('showSuccess', isRunning, succeed);
  patch('showError', isMounted, abort);
  patch('showAccessRequestModal', isMounted, abort);
})();

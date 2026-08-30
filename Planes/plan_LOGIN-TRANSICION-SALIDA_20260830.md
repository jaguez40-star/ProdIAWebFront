# Plan — Transición de salida del login (panel que se desplaza a la izquierda)

| | |
|---|---|
| **ID tarea** | `LOGIN-TRANSICION-SALIDA` |
| **Fecha** | 2026-08-30 |
| **Versión** | **v2 — auditada contra los pipelines** (v1: 2026-08-30, superada) |
| **Alcance** | Animación de salida del login en `/login` (Flask, puerto 5029) |
| **Origen del diseño** | `anime_log.md` (documento de diseño aprobado, stack React) |

> **Qué cambió de v1 a v2.** La v1 auditó el código de la pantalla, pero **no** los
> pipelines. La segunda pasada encontró que el plan, tal como estaba, **rompía el
> despliegue en dos puntos distintos** (H-13 y H-14) y **perdía la imagen por el camino
> a producción** (H-15). Los hallazgos nuevos son H-13 … H-20; los de la v1 se conservan
> con su numeración. La §3 y la §4 se reformularon a partir de ellos.

## Qué NO se toca

- `routes/auth.py` ni ningún endpoint de autenticación.
- El pipeline de login: validación, `fetch('/auth/login')`, modal de solicitud de acceso.
- `login-steps.js` — **ni una línea** (ver H-7).
- La constelación SVG: **permanece en el DOM**, se oculta por CSS (ver Decisión 3 y H-13).
- `/mainchat` y cualquier plantilla que no sea `login.html`.
- `migrar_a_azure.ps1` — no necesita cambios (verificado en H-16).

## Decisiones cerradas del usuario

1. **La imagen del panel izquierdo es `static/img/PanelLEft.png`**, ya existente. Se usa
   tal cual, sin regenerar.
2. **El encendido a color queda atenuado**, porque el PNG ya viene en escala de grises
   quemada (H-1). El CSS se escribe preparado para la versión a color: cuando llegue, se
   activa descomentando una línea. No se pide recaptura ahora.
3. **La constelación SVG sale de la vista de login**, sustituida por la imagen. Se oculta
   con `display:none`, no se borra del HTML — el rollback es una línea de CSS, y además
   `verificar_deploy.ps1` depende de que su marcador siga presente (H-13).
4. **Sin iframe ni SPA.** La app de fondo es la imagen estática; el redirect a `/mainchat`
   ocurre al terminar la animación.
5. **Opción (A) para el redirect** (H-6): `login.js` delega la navegación en el módulo
   nuevo mediante una guarda de 3 líneas. Se descarta parchear `window.setTimeout`.

---

## §0 · Contexto para el agente EXECUTOR

**Proyecto:** ProdIA — analítica de producción de Ecopetrol. Son **dos procesos**: un
frontend Flask + Jinja2 (puerto 5029) y un backend FastAPI llamado INGESTA (puerto 5030).
Esta tarea es **exclusivamente del frontend Flask**. INGESTA no interviene.

**Directorio de trabajo:** `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\`

**Archivos que se tocan (5):**

| # | Ruta absoluta | Acción |
|---|---|---|
| 1 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\js\login-transition.js` | **CREAR** |
| 2 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\templates\login.html` | MODIFICAR |
| 3 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\css\login.css` | MODIFICAR |
| 4 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\static\js\login.js` | MODIFICAR (3 líneas) |
| 5 | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\verificar_deploy.ps1` | MODIFICAR (ver H-13/H-14) |

**Además:** `static\img\PanelLEft.png` debe **añadirse a git** (H-15). No se edita el
binario; solo se versiona.

**Convenciones obligatorias del proyecto:**

- **JavaScript ES5 clásico.** `var` + `function`. **Sin** arrow functions, **sin** template
  literals, **sin** `const`/`let`, **sin** `async/await`. Es el estilo de `login-steps.js`,
  y el navegador objetivo del servidor 139 no está fijado.
- **Todo el código y todos los comentarios, en español.**
- CSS: variables ya definidas en `:root` de `login.css` (prefijo `--pv-`). No introducir un
  sistema de tokens nuevo.
- **PowerShell 5.1**: al escribir archivos, **nunca** `Set-Content -Encoding utf8` (mete BOM
  y rompe cosas — `CLAUDE.md` §5). En esta tarea se editan archivos existentes con las
  herramientas de edición, así que no aplica, pero conviene saberlo.
- **Regla de cierre:** si algo de este plan no calza con el código real que encuentres,
  **DETENTE y reporta**. No improvises una variante.

**Cómo arrancar para probar** (carpeta `C:\APLICACIONES\ProdIA\Repo ProdIA\`, una sola
línea, consola normal — **no** requiere administrador):

```powershell
.\frontend\iniciar_frontend.bat
```

Espera `Running on http://127.0.0.1:5029`. La consola queda ocupada; se corta con `Ctrl+C`.

---

## §1 · Hallazgos de la auditoría

### Bloque A — Hallazgos de la v1 (código de la pantalla)

#### 🔴 H-1 — La imagen ya viene en gris quemado: el «encendido a color» no es posible hoy

**Evidencia:** lectura directa de `static/img/PanelLEft.png` — 813×639 px, la captura de
MainChat (Historial + Chat con la mascota) **ya renderizada en escala de grises y
aclarada**. Fondo blanco.

El documento de diseño (`anime_log.md` §5.3) aplica
`filter: grayscale(1) opacity(.42) contrast(.96)` sobre una captura **a color** y la
enciende retirando el filtro. Aquí no hay color al que volver.

**Consecuencia:** el filtro de reposo se reduce a `opacity(.55) contrast(.92)` y el
encendido lo devuelve a `opacity(1) contrast(1)`. Se percibe como «la app se aclara y toma
nitidez», no como un paso a color. El velo blanco **sí funciona igual** y aporta la mayor
parte del efecto. La línea a color queda escrita y comentada en el CSS.

**No** intentar recolorear el PNG por CSS: `saturate()` sobre gris no devuelve color.

#### 🔴 H-2 — El bloque `finally` de `login.js` restaura el botón también en caso de éxito

**Evidencia:** `static/js/login.js` líneas 203-208:

```js
    } finally {
        loading = false;
        loginBtn.disabled = false;
        loginText.textContent = 'ACCESO';
        loginSpinner.classList.add('d-none');
    }
```

`finally` corre **siempre**, incluido tras un login correcto. Hoy no se nota porque el
redirect llega 500 ms después. Con la animación de 1250 ms, el usuario **vería el botón
despertar** a mitad del viaje del panel.

**Consecuencia:** el módulo nuevo vuelve a poner el botón en estado ocupado desde su gancho
de éxito, diferido con `setTimeout(0)` para correr **después** del `finally`. Se aprovecha
para poner «VERIFICANDO…» (documento §7). Ver §3.1, `congelarBoton()`.

#### 🔴 H-3 — `prefers-reduced-motion` ya está resuelto en CSS, y obliga a acortar el redirect

**Evidencia:** `static/css/login.css` líneas 51-58:

```css
@media (prefers-reduced-motion: reduce) {
  body.login-page *, ... { transition-duration: 0.01ms !important; }
}
```

El requisito del documento (§2) **ya está cubierto**: todas las transiciones colapsan a
0.01 ms. No hay que escribir CSS nuevo.

**Pero** deja el JS desincronizado: si el CSS termina instantáneamente y el JS espera
`EXIT_MS = 1250`, el usuario mira 1,25 s una pantalla quieta — peor que sin animación. El
módulo **debe leer `matchMedia` y usar `EXIT_MS = 0`**.

#### 🟡 H-4 — El grid `1fr 460px` impide que el panel cruce sin reflow

**Evidencia:** `static/css/login.css` líneas 62-75. Un hijo de grid participa del flujo:
`translateX` lo mueve visualmente pero su celda sigue reservada.

**Consecuencia:** `.form-panel` pasa a `position:absolute; right:0` y `.login-grid` a
`position:relative` de una sola columna. El ancho se fija en **460px** (los de hoy) en vez
del `25%` del documento: en 2000px da 77/23, indistinguible del 75/25 pedido, y no altera
la proporción que el usuario ya aprobó. Se descarta el `min-width:330px` del documento.

#### 🟡 H-5 — Animar `width` no sirve aquí: hay que animar `padding-right`

**Evidencia:** derivado de H-4. Con la capa de imagen ya al 100% del ancho, no hay `width`
que animar.

**Consecuencia:** el reencuadre se consigue animando `padding-right: 460px → 40px`. Como el
`<img>` usa `object-fit: contain`, reducir el padding **agranda la imagen** igual que
ensanchar el contenedor. `padding` dispara layout igual que `width` — el documento acepta
esa excepción explícitamente (§2). Se mantiene **1.15s**, por delante de los 1.2s del panel
(documento §5.3 y error nº8).

#### 🔴 H-6 — El `setTimeout(500)` de `login.js` cortaría la animación a mitad

**Evidencia:** `static/js/login.js` líneas 184-187 — redirige a los 500 ms, con la
animación en 1250 ms.

**Decisión cerrada del usuario (nº5): opción (A).** `login.js` recibe una guarda de 3
líneas: si `window.__ltRedirigir` existe, el módulo gobierna la navegación; si no, se
conserva el `setTimeout` de siempre. Se descarta parchear `window.setTimeout` por frágil.

Es la **única** edición en `login.js`, y es reversible borrando el `if`.

#### 🟢 H-7 — Existe un precedente exacto: `login-steps.js`

**Evidencia:** `static/js/login-steps.js` (240 líneas) resuelve **el mismo problema**:
enganchar una animación al ciclo de login sin tocar `login.js`. Su cabecera documenta el
contrato (líneas 10-29) y las líneas 217-239 implementan el monkey-patch de `showSuccess` /
`showError` / `showAccessRequestModal`.

**El módulo nuevo clona este patrón**: carga después de `login.js`, se autodesactiva en
silencio si falta un elemento, envuelve todo en `try/catch` con `console.warn`, e invoca
siempre el original vía `apply`.

**Convivencia:** ambos parchean `showSuccess`. Como cada uno invoca el original,
los dos se ejecutan. `login-transition.js` carga **después** para que su gancho corra
primero y congele el botón cuanto antes.

#### 🟢 H-8 — El namespace `lt-` está libre

**Evidencia:** `grep -rn "\.lt-|lt-root|lt-app|lt-login|lt-spinner|is-gone|is-live"` sobre
`frontend/` → **sin coincidencias**. Sin colisión con `lg-` (constelación) ni `ldap-`.

> **Matiz de la v2:** las clases de estado se llaman `lt-is-live` / `lt-is-gone` (con
> prefijo), **no** `is-live` / `is-gone` como en el documento. Van sobre `<body>`, que es un
> espacio compartido con Bootstrap: un `is-live` suelto ahí es deuda silenciosa.

#### 🟢 H-9 — El spinner y el `disabled` del botón ya existen

**Evidencia:** `templates/login.html` líneas 337-342 (`#login-btn`, `#login-text`,
`#login-spinner`, spinner de Bootstrap) y `login.js` líneas 161-163.

**No se crea el `lt-spinner`** del documento (§7): se reutiliza el de Bootstrap.

#### 🟡 H-10 — En móvil (≤767.98px) el panel ocupa toda la pantalla

**Evidencia:** `login.css` líneas 72-75 — a ≤767.98px `.brand-panel` es `display:none` y el
formulario ocupa el 100%. Ahí `translateX(-104vw)` dejaría **la pantalla en blanco** 1,2 s.

**Consecuencia:** en ese breakpoint la transición degrada a **fade puro**. Solo CSS.

#### 🟡 H-11 — El overlay SSO es un camino de entrada distinto, sin submit

**Evidencia:** `login.html` líneas 20-36 y `login.js` líneas 109-146 — `trySsoLogin`
redirige en la línea 137 sin pasar por el formulario ni por `showSuccess`.

**Decisión:** el SSO **no** recibe la transición. Queda en §7.

#### 🟢 H-12 — La corrupción de `core.fact_tabla_hoja` no afecta

**Evidencia:** `CLAUDE.md` §6. Es corrupción de la BD local en una tabla de producción.
Esta tarea es HTML, CSS y JS: no consulta la BD.

---

### Bloque B — Hallazgos nuevos de la v2 (pipelines y despliegue)

#### 🔴 H-13 — `verificar_deploy.ps1` FALLA el despliegue si se borra la constelación

**Evidencia:** `verificar_deploy.ps1` líneas 48-63:

```powershell
$hasConstelacion = Select-String -Path $loginHtml -Pattern "constelaci" -Quiet
$has13Nodos      = Select-String -Path $loginHtml -Pattern "13 nodos" -Quiet
...
} else {
    Check-Fail "login.html NO tiene el rediseno de la constelacion -- version VIEJA"
}
```

Comprobado en el código actual: `grep -c "constelaci" templates/login.html` → **1**, y
`grep -c "13 nodos"` → **1**. El script usa esas dos cadenas como **marcador de versión**
para detectar despliegues viejos.

**Este es exactamente el fallo que costó el incidente del puerto 5007**: el verificador
diría «version VIEJA» sobre un deploy correcto y reciente, y quien lo viera creería que la
copia falló.

**Consecuencia sobre el diseño:** confirma y refuerza la Decisión 3 — **el SVG y sus
comentarios se quedan en `login.html`**, ocultos por CSS. Además el marcador de versión
debe **actualizarse** para que apunte a lo nuevo (H-14): un marcador que ya no describe la
pantalla deja de servir para lo que existe.

#### 🔴 H-14 — El chequeo de tamaño de `login.css` es un umbral que hay que revisar

**Evidencia:** `verificar_deploy.ps1` líneas 69-76:

```powershell
$lines = (Get-Content $loginCss).Count
if ($lines -ge 400) { Check-Pass "login.css tiene $lines lineas (esperado ~508)" }
else { Check-Fail "login.css tiene solo $lines lineas -- parece una version vieja" }
```

Medido hoy: `login.css` = **511** líneas, `login.js` = **310**, `login.html` = **446**.

El cambio **suma** líneas a `login.css` (el bloque de las dos capas es más largo que el grid
que sustituye), así que el umbral `≥400` no se rompe. **No es un fallo, es una trampa
latente**: los mensajes «esperado ~508» y «se esperan ~446» quedan desfasados y la próxima
persona que lea la salida no sabrá si el número es correcto.

**Consecuencia:** se actualizan los textos informativos y se **añade un marcador propio de
esta feature** (`lt-app__img` en `login.html`), para que el verificador detecte un deploy
que se quedó sin la transición. Ver §3.5.

#### 🔴 H-15 — `PanelLEft.png` NO está versionada: no llegaría a producción

**Evidencia:**

```
$ git ls-files --error-unmatch static/img/PanelLEft.png
error: pathspec 'static/img/PanelLEft.png' did not match any file(s) known to git

$ git status --porcelain static/img/
?? static/img/PanelLEft.png
```

El archivo está **sin seguimiento**. Y el pipeline (`CLAUDE.md` §9) es
`local → GitHub → pruebas → migrar-a-azure → Azure DevOps → 139`.

`migrar_a_azure.ps1` copia **archivos versionados** y verifica su hash de blob (`CLAUDE.md`
§9: «compara el hash de blob de cada archivo versionado contra el origen»). Un archivo sin
seguimiento **no viaja**.

**Resultado si no se corrige:** `login.html` referenciaría `PanelLEft.png` y en producción
daría **404** — el panel izquierdo saldría en blanco. Y lo detectaría el chequeo genérico
de la línea 101 del verificador… **solo si el archivo se versiona**; si nunca llega, el
verificador del 139 sí lo cazaría, pero después de desplegar.

**Consecuencia:** `git add static/img/PanelLEft.png` es un **paso obligatorio del plan**,
no un detalle de commit. Va en la §4 con número propio.

**Comprobado que nada lo ignora:** `.gitignore` no tiene reglas para `*.png`, `img/` ni
`static/` (`git check-ignore -v` no devuelve regla). El archivo pesa 38 KB — irrelevante
frente a los ~151 MB de binarios heredados que menciona `CLAUDE.md` §8.

#### 🟢 H-16 — `migrar_a_azure.ps1` no necesita cambios

**Evidencia:** `migrar_a_azure.ps1` línea 63:

```powershell
$ExcluirArchivos = @('.env', '*.bak', '*.pyc')
```

y líneas 165-171, dentro de `Find-Trazas`:

```powershell
$binarios = @('.png','.jpg', ...)
if ($binarios -contains [System.IO.Path]::GetExtension($nombre).ToLower()) { continue }
```

**Importante no malinterpretarlo:** los `.png` se saltan **únicamente** en el escaneo de
trazas de texto (`Find-Trazas` lee el archivo como texto buscando términos prohibidos —
leer un binario ahí no tiene sentido). **No** están excluidos de la copia ni del cotejo de
hash. La imagen migra con normalidad **una vez versionada** (H-15).

Confirmación adicional: `.png` no aparece en `$ExcluirArchivos`.

#### 🟡 H-17 — El cache-bust de `login.js` es un precedente que hay que respetar

**Evidencia:** `templates/login.html` líneas 440-443:

```html
    <!-- Cache-bust necesario: login.js decide a dónde va el usuario tras entrar.
         Sin él, quien tuviera la versión anterior en caché seguiría cayendo en '/'
         (el layout viejo) en vez de /mainchat. -->
    <script src="{{ url_for('static', filename='js/login.js') }}?v=20260821s"></script>
```

`login.css` ya se cache-bustea con `?v={{ range(1000,9999)|random }}` (línea 16), pero
`login-steps.js` **no lleva ninguno** (línea 444).

**Consecuencia:** el cambio de §3.4 modifica `login.js`, cuyo `?v=20260821s` es **fijo**.
Sin tocarlo, un usuario con la versión cacheada ejecutaría el `login.js` viejo —
**redirigiría a los 500 ms cortando la animación**, que es justo el bug de H-6 reapareciendo
solo para quien tenga caché. Hay que **subir ese sello a `?v=20260830a`**, y ponerle uno
igual al módulo nuevo.

Es el mismo razonamiento que documenta el comentario ya existente. No es una mejora
opcional: sin esto el despliegue produce comportamiento distinto según el navegador.

#### 🟡 H-18 — El `beforeunload` de `login.js` restaura estilos justo al navegar

**Evidencia:** `static/js/login.js` líneas 304-310:

```js
window.addEventListener('beforeunload', () => {
    document.body.style.overflow = '';
    ...
});
```

Se dispara al iniciar la navegación a `/mainchat`. Devuelve `overflow` y `height` del
`body` y del `html` a su valor por defecto.

**Riesgo evaluado:** ocurre **al final** de la transición (cuando el módulo llama a
`redirigir()`), no durante. El `overflow:hidden` que de verdad contiene el panel viajando
está en **`.login-grid`** (§3.3), no en el `body`, así que restaurar el del `body` no
reintroduce scroll horizontal.

**Conclusión: no requiere cambios.** Se documenta porque parece un problema y no lo es —
para que nadie «arregle» algo que funciona.

#### 🟡 H-19 — `login.js` inyecta estilos inline en `DOMContentLoaded`

**Evidencia:** `static/js/login.js` líneas 290-299 — pone `overflow:hidden` y `height:100vh`
en `body` y `html` por JS.

**Consecuencia:** el `min-height:100vh` de `.login-grid` convive con un `body` de altura
fija `100vh`. Al pasar `.form-panel` a absoluto (H-4), su `overflow-y:auto` sigue siendo
necesario para pantallas bajas — **se conserva**. Y el `.form-panel` absoluto se ancla con
`top:0; bottom:0`, que respeta esa altura fija sin depender del flujo.

Verificado que no hay conflicto: el `height:100vh` del `html`/`body` y el `inset` del panel
son compatibles.

#### 🟢 H-20 — El plan no toca nada compartido fuera del login

**Evidencia:** la cabecera de `login.css` (líneas 1-7) declara: *«este archivo es exclusivo
del login, ninguna otra plantilla lo enlaza»*. Comprobado: `login.css` y `login.js` solo se
referencian desde `templates/login.html`.

No se toca `multitab_shell.js`, `app.py`, `routes/api.py` ni ningún CSS global — los cuatro
archivos que `CLAUDE.md` §10.2 marca como compartidos. **El radio de impacto es la pantalla
de login y nada más.**

---

## §2 · Estado actual

Al abrir `http://localhost:5029/login`:

- `.login-grid` es un grid de 2 columnas: `1fr` (constelación SVG animada) + `460px`
  (formulario).
- El panel izquierdo muestra la **constelación neuronal** (SVG inline con SMIL,
  `login.html` líneas 44-280) y el pie «Inteligencia conectada».
- `static/img/PanelLEft.png` **existe en disco, sin versionar en git y sin referenciar en
  ningún archivo**.
- Al enviar el formulario: el botón muestra «Iniciando sesión...», los pasos LDAP se animan
  (`login-steps.js`), y 500 ms después de la respuesta correcta el navegador salta a
  `/mainchat` **sin transición visual**.

Métricas de referencia (medidas hoy, para §6.1): `login.css` **511** líneas, `login.js`
**310**, `login.html` **446**.

---

## §3 · Especificación

### §3.1 · CREAR `static\js\login-transition.js`

Archivo completo. **ES5 clásico**, comentarios en español, patrón calcado de
`login-steps.js` (H-7).

```js
/**
 * Transición de salida del login — ProdIA 2.0
 *
 * Al autenticar, el panel del formulario viaja a la izquierda cruzando sobre la
 * imagen de la app (PanelLEft.png), que en paralelo se aclara y se reencuadra a
 * pantalla completa. Al terminar, redirect a /mainchat.
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

  // Duración del recorrido del panel. Debe ser >= la transition más larga
  // (1.2s del transform), o el redirect cortaría la animación a medias
  // (anime_log.md §10, error nº7).
  var EXIT_MS = 1250;

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
```

### §3.2 · MODIFICAR `templates\login.html`

**Cambio A — añadir la capa de imagen.**

LOCALIZAR (línea 39):

```html
    <div class="login-grid">
```

SUSTITUIR POR:

```html
    <div class="login-grid">
        <!-- [2026-08-30] Capa de la app de fondo (anime_log.md §5.3), adaptada a Flask.
             La imagen ya viene en escala de grises quemada, así que el "encendido" es
             una subida de opacidad y contraste, no un paso a color (ver plan §1 H-1).
             Decorativa: aria-hidden.
             MARCADOR DE VERSIÓN: verificar_deploy.ps1 busca la cadena 'lt-app__img'
             para detectar un deploy que se quedó sin la transición (plan §1 H-14). -->
        <img src="{{ url_for('static', filename='img/PanelLEft.png') }}"
             class="lt-app__img" alt="" aria-hidden="true">
        <div class="lt-app__veil" aria-hidden="true"></div>
```

> El `<img>` y el velo van como **primeros hijos** de `.login-grid`, antes de
> `.brand-panel`. El CSS los posiciona en absoluto: no alteran el flujo.

**Cambio B — cache-bust de `login.js` y carga del módulo nuevo (H-17).**

LOCALIZAR (líneas 443-444, las dos últimas etiquetas `<script>`):

```html
    <script src="{{ url_for('static', filename='js/login.js') }}?v=20260821s"></script>
    <script src="{{ url_for('static', filename='js/login-steps.js') }}"></script>
```

SUSTITUIR POR:

```html
    <!-- [2026-08-30] Sello subido a 20260830a: login.js cambia en esta entrega
         (delega el redirect en login-transition.js). Sin subirlo, quien tuviera la
         versión anterior en caché seguiría redirigiendo a los 500 ms y vería la
         animación cortada a la mitad. Ver plan §1 H-17. -->
    <script src="{{ url_for('static', filename='js/login.js') }}?v=20260830a"></script>
    <script src="{{ url_for('static', filename='js/login-steps.js') }}"></script>
    <!-- Transición de salida. DEBE cargar el último: parchea showSuccess igual que
         login-steps.js, y al registrarse después su gancho corre primero,
         congelando el botón antes de que se vea revivir (plan §1 H-2 y H-7). -->
    <script src="{{ url_for('static', filename='js/login-transition.js') }}?v=20260830a"></script>
```

> ⚠️ **No** tocar el comentario existente de las líneas 440-442: explica por qué el
> cache-bust es necesario y sigue siendo cierto.

### §3.3 · MODIFICAR `static\css\login.css`

**Cambio A — el grid pasa a capa única con posicionamiento absoluto.**

LOCALIZAR (líneas 60-75, el bloque completo «Grid 2 columnas»):

```css
/* ── Grid 2 columnas ──────────────────────────────────────────── */

.login-grid {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 460px;
}

@media (max-width: 1023.98px) {
  .login-grid { grid-template-columns: 1fr 400px; }
}

@media (max-width: 767.98px) {
  .login-grid { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
}
```

SUSTITUIR POR:

```css
/* ── Layout de dos capas ──────────────────────────────────────── */
/* [2026-08-30] Antes era un grid de 2 columnas. Ahora el formulario está en
   posición absoluta para poder CRUZAR sobre la imagen sin reflow al salir
   (plan §1 H-4). El reencuadre de la imagen se consigue animando el
   padding-right de la propia imagen, no un width (plan §1 H-5).
   overflow:hidden es OBLIGATORIO: sin él, el panel viajando a -104vw genera
   scroll horizontal (anime_log.md §10, error nº2). Va aquí y no en el body,
   porque login.js restaura el overflow del body en beforeunload (plan §1 H-18). */

.login-grid {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

/* Capa 1 — la app de fondo (captura estática de MainChat) */

.lt-app__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center center;
  padding: 40px 460px 40px 40px;
  /* Reposo: la imagen YA es gris en el PNG, así que solo se apaga un poco más.
     🔧 CUANDO LLEGUE LA CAPTURA A COLOR: borrar la línea de abajo y descomentar
     la siguiente, que es la del documento de diseño (anime_log.md §5.3). */
  filter: opacity(.55) contrast(.92);
  /* filter: grayscale(1) opacity(.42) contrast(.96); */
  transition: filter .9s ease .1s, padding 1.15s cubic-bezier(.7, 0, .2, 1);
  pointer-events: none;
  z-index: 0;
}

.lt-app__veil {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, .34);
  opacity: 1;
  transition: opacity .8s ease;
  pointer-events: none;
  z-index: 1;
}

/* Encendido: la clase la pone login-transition.js sobre <body>.
   El padding-right baja a 40px (no a 0) para que la captura conserve un margen
   respirable al ocupar la pantalla completa. */

body.lt-is-live .lt-app__img {
  padding-right: 40px;
  filter: opacity(1) contrast(1);
  /* 🔧 VERSIÓN A COLOR: filter: grayscale(0) opacity(1) contrast(1); */
}

body.lt-is-live .lt-app__veil { opacity: 0; }

@media (max-width: 1023.98px) {
  .lt-app__img { padding-right: 400px; }
}

/* Móvil: no hay imagen visible detrás del formulario, así que la capa de app
   se retira por completo (plan §1 H-10). */
@media (max-width: 767.98px) {
  .lt-app__img,
  .lt-app__veil { display: none; }
}
```

**Cambio B — la constelación se oculta (sin borrarla).**

LOCALIZAR (líneas 81-91, el bloque `.brand-panel`):

```css
.brand-panel {
  position: relative;
  background: #fff;
  overflow: hidden;
  /* [2026-08-26] Centrado real (petición del usuario): antes el SVG se posicionaba
     con top:44px fijo (solo centrado horizontal). flex lo centra en las DOS direcciones
     dentro de todo el alto del panel. */
  display: flex;
  align-items: center;
  justify-content: center;
}
```

SUSTITUIR POR:

```css
/* [2026-08-30] La constelación cede el sitio a la captura de MainChat
   (plan, Decisión 3). Se oculta por CSS en vez de borrarla del HTML por DOS
   motivos: el rollback es esta única regla, y verificar_deploy.ps1 usa las
   cadenas "constelaci" y "13 nodos" de login.html como marcador de versión —
   borrarlas haría FALLAR la verificación de un deploy correcto (plan §1 H-13). */

.brand-panel { display: none; }
```

> **No borrar** los bloques `.lg-constellation`, `.lg-caption`, `.lg-caption__t` ni
> `.lg-caption__s` (líneas 93-134 del original). Quedan inertes al estar oculto su
> contenedor, y su presencia hace el rollback trivial.

**Cambio C — el panel de formulario pasa a absoluto y recibe la transición.**

LOCALIZAR (líneas 138-149, el bloque `.form-panel` y su media query):

```css
.form-panel {
  background: #fff;
  border-left: 1px solid var(--pv-border);
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

@media (max-width: 767.98px) {
  .form-panel { border-left: none; padding: 32px 20px; }
}
```

SUSTITUIR POR:

```css
/* [2026-08-30] Absoluto sobre la derecha: no participa del flujo, por eso puede
   cruzar la imagen sin provocar reflow (anime_log.md §5.2). z-index:3 lo mantiene
   por encima de la capa de app y del velo. overflow-y:auto se conserva: sigue
   siendo necesario en pantallas bajas (plan §1 H-19). */

.form-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 460px;
  z-index: 3;
  background: #fff;
  border-left: 1px solid var(--pv-border);
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: -14px 0 34px rgba(20, 40, 30, .06);
  transform: translateX(0);
  opacity: 1;
  /* El retardo de 100 ms en la opacidad evita que el panel "se apague" antes de
     moverse: primero se percibe el desplazamiento, luego el desvanecimiento
     (anime_log.md §5.2). */
  transition:
    transform 1.2s cubic-bezier(.7, 0, .2, 1),
    opacity   1.1s ease .1s,
    filter    1.1s ease;
}

/* Salida: -104vw, NO -100%. El porcentaje se resuelve contra el ancho del propio
   panel (460px), así que apenas lo movería (anime_log.md §10, error nº1). */

body.lt-is-gone .form-panel {
  transform: translateX(-104vw);
  opacity: 0;
  filter: blur(2px);
  pointer-events: none;
}

@media (max-width: 1023.98px) {
  .form-panel { width: 400px; }
}

/* Móvil: ocupa todo el ancho y degrada a fade puro — desplazarlo dejaría la
   pantalla en blanco, porque no hay imagen detrás (plan §1 H-10). */
@media (max-width: 767.98px) {
  .form-panel {
    position: static;
    width: 100%;
    border-left: none;
    box-shadow: none;
    padding: 32px 20px;
    min-height: 100vh;
  }
  body.lt-is-gone .form-panel { transform: none; }
}
```

### §3.4 · MODIFICAR `static\js\login.js` (guarda del redirect — 3 líneas)

Única edición en este archivo. Motivo en H-6, Decisión 5.

LOCALIZAR (líneas 181-187):

```js
        if (response.ok && data.success && data.user_info) {
            showSuccess(data.message || 'Autenticación exitosa');

            // Redirect a MainChat (antes '/', el layout viejo de dos paneles)
            setTimeout(() => {
                window.location.href = '/mainchat';
            }, 500);
```

SUSTITUIR POR:

```js
        if (response.ok && data.success && data.user_info) {
            showSuccess(data.message || 'Autenticación exitosa');

            // [2026-08-30] Si login-transition.js está cargado, él gobierna la
            // navegación: la anima y redirige al terminar (~1250 ms). Si no lo
            // está, se conserva el comportamiento de siempre.
            // Ver Planes/plan_LOGIN-TRANSICION-SALIDA_20260830.md §1 H-6.
            if (typeof window.__ltRedirigir !== 'function') {
                // Redirect a MainChat (antes '/', el layout viejo de dos paneles)
                setTimeout(() => {
                    window.location.href = '/mainchat';
                }, 500);
            }
```

> ⚠️ El `showSuccess` de la línea 182 ya habrá disparado la transición cuando se evalúe
> este `if` — el orden es correcto y deliberado.
> ⚠️ **No** tocar el `finally` (líneas 203-208): se contrarresta desde el módulo nuevo.
> ⚠️ Se respeta la sintaxis moderna de este archivo (arrow function): es preexistente.

### §3.5 · MODIFICAR `verificar_deploy.ps1` (H-13 y H-14)

Sin este cambio, el verificador no detecta un deploy que se quedó sin la transición, y sus
mensajes de referencia quedan desfasados.

**Cambio A — añadir el marcador de la transición.**

LOCALIZAR (líneas 48-63, el bloque «2) templates/login.html»), y SUSTITUIR el bloque
`if/elseif/else` interno. El bloque queda así **completo**:

```powershell
# --- 2) templates/login.html: rediseno de la constelacion (13 nodos) + transicion de salida ---
$loginHtml = Join-Path $Path "templates\login.html"
if (-not (Test-Path $loginHtml)) {
    Check-Fail "No existe templates\login.html"
} else {
    $lines = (Get-Content $loginHtml).Count
    $hasConstelacion = Select-String -Path $loginHtml -Pattern "constelaci" -Quiet
    $has13Nodos = Select-String -Path $loginHtml -Pattern "13 nodos" -Quiet
    if ($hasConstelacion -and $has13Nodos) {
        Check-Pass "login.html tiene el rediseno de la constelacion (13 nodos), $lines lineas"
    } elseif ($hasConstelacion) {
        Check-Warn "login.html tiene la constelacion pero NO la marca de '13 nodos' -- puede ser una version intermedia (12 nodos), $lines lineas"
    } else {
        Check-Fail "login.html NO tiene el rediseno de la constelacion -- version VIEJA ($lines lineas, se esperan ~453)"
    }

    # [2026-08-30] Marcador de la transicion de salida del login.
    # La constelacion sigue en el HTML pero oculta por CSS, asi que los dos
    # marcadores de arriba ya no distinguen un deploy CON transicion de uno SIN
    # ella. Este chequeo si. Ver plan LOGIN-TRANSICION-SALIDA.
    $hasTransicion = Select-String -Path $loginHtml -Pattern "lt-app__img" -Quiet
    if ($hasTransicion) {
        Check-Pass "login.html tiene la transicion de salida (capa lt-app__img)"
    } else {
        Check-Fail "login.html NO tiene la transicion de salida -- version anterior al 2026-08-30"
    }
}
```

**Cambio B — actualizar los tamaños de referencia.**

LOCALIZAR (línea 72):

```powershell
        Check-Pass "login.css tiene $lines lineas (esperado ~508)"
```

SUSTITUIR POR:

```powershell
        Check-Pass "login.css tiene $lines lineas (esperado ~560)"
```

LOCALIZAR (línea 74):

```powershell
        Check-Fail "login.css tiene solo $lines lineas -- parece una version vieja (esperado ~508)"
```

SUSTITUIR POR:

```powershell
        Check-Fail "login.css tiene solo $lines lineas -- parece una version vieja (esperado ~560)"
```

> El umbral funcional (`-ge 400`) **no se toca**: el cambio suma líneas, nunca resta.
> Solo se corrigen los textos informativos, que si no quedan desfasados (H-14).
>
> ⚠️ Los números `~453` y `~560` son **aproximados a propósito**. Si el conteo real al
> terminar difiere en unas pocas líneas, **no** es un fallo y **no** hay que reajustarlos.

---

## §4 · Orden de ejecución

Las piezas nuevas van antes que sus call sites, para que el árbol nunca quede en un estado
donde se invoque algo inexistente. El paso 1 es el que la v1 no tenía y sin el cual el
despliegue llega roto a producción.

| # | Paso | Archivo / comando | Comprobación al terminar |
|---|---|---|---|
| 1 | **Versionar la imagen** (H-15) | `git add static/img/PanelLEft.png` | `git ls-files static/img/PanelLEft.png` devuelve la ruta |
| 2 | Crear el módulo de transición (§3.1) | `static\js\login-transition.js` | El archivo existe y define `window.__ltRedirigir` |
| 3 | Capa de imagen + scripts + cache-bust (§3.2 A y B) | `templates\login.html` | Contiene `PanelLEft`, `lt-app__img` y `?v=20260830a` |
| 4 | Reescribir el layout (§3.3 A, B y C) | `static\css\login.css` | Contiene `lt-is-gone` dos veces |
| 5 | Guarda del redirect (§3.4) | `static\js\login.js` | Contiene `__ltRedirigir` una vez |
| 6 | Actualizar el verificador (§3.5 A y B) | `verificar_deploy.ps1` | Contiene `lt-app__img` |
| 7 | Arrancar Flask y validar §6.1 | — | Sin errores en consola |
| 8 | Correr el verificador (§6.1) | `.\verificar_deploy.ps1` | `TODO OK` |

**Si cualquier paso falla, DETENERSE.** No continuar con el siguiente ni improvisar.

---

## §5 · Reglas no negociables

1. **JavaScript ES5 clásico** en `login-transition.js`: `var` + `function`. Prohibidos:
   arrow functions, template literals, `const`/`let`, `async/await`, spread. El único
   archivo con sintaxis moderna es `login.js`, preexistente, **cuya edición se limita
   estrictamente a las líneas de §3.4** respetando su estilo.
2. **Todo en español**: código, comentarios, textos de interfaz.
3. **No tocar `login-steps.js`.** Ni una línea.
4. **No tocar `routes/auth.py`** ni ningún endpoint.
5. **No borrar el SVG de la constelación** de `login.html`, ni las cadenas «constelaci» y
   «13 nodos». Romperían `verificar_deploy.ps1` (H-13).
6. **No regenerar ni editar `PanelLEft.png`.** Solo versionarla.
7. **No tocar `migrar_a_azure.ps1`** — no lo necesita (H-16).
8. **No bajar el umbral `-ge 400`** de `verificar_deploy.ps1`. Solo se actualizan textos.
9. **Solo se animan** `transform`, `opacity`, `filter` y el `padding` justificado en H-5.
   Nunca `left`, `right` ni `margin`.
10. **`EXIT_MS` (1250) debe seguir siendo ≥ 1200 ms**, la transición más larga.
11. **No subir nada a Azure DevOps ni configurar remotos corporativos.** Este plan termina
    en local (`CLAUDE.md` §9, regla 4).
12. **Si algo del plan no calza con el código real, DETENERSE y reportar.** No improvisar.

---

## §6 · Validación

### §6.1 · Estática — la ejecuta el EXECUTOR

Todos los comandos desde `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, **uno por uno**,
consola normal (**no** requiere administrador).

| # | Comando | Resultado esperado |
|---|---|---|
| 1 | `git ls-files static/img/PanelLEft.png` | `static/img/PanelLEft.png` (no vacío) |
| 2 | `Select-String -Path templates\login.html -Pattern "PanelLEft" \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` |
| 3 | `Select-String -Path templates\login.html -Pattern "lt-app__img" \| Measure-Object \| Select-Object -ExpandProperty Count` | `2` |
| 4 | `Select-String -Path templates\login.html -Pattern "login-transition.js" \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` |
| 5 | `Select-String -Path templates\login.html -Pattern "v=20260830a" \| Measure-Object \| Select-Object -ExpandProperty Count` | `2` |
| 6 | `Select-String -Path templates\login.html -Pattern "13 nodos" \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` (sigue ahí — H-13) |
| 7 | `Select-String -Path static\css\login.css -Pattern "lt-is-gone" \| Measure-Object \| Select-Object -ExpandProperty Count` | `2` |
| 8 | `Select-String -Path static\js\login.js -Pattern "__ltRedirigir" \| Measure-Object \| Select-Object -ExpandProperty Count` | `1` |
| 9 | `Select-String -Path static\js\login-transition.js -Pattern "=>" \| Measure-Object \| Select-Object -ExpandProperty Count` | `0` (sin arrow functions) |
| 10 | `Select-String -Path static\js\login-transition.js -Pattern "\bconst\b\|\blet\b" \| Measure-Object \| Select-Object -ExpandProperty Count` | `0` (ES5) |
| 11 | `Test-Path static\img\PanelLEft.png` | `True` |

**Arranque** (desde `C:\APLICACIONES\ProdIA\Repo ProdIA\`, una línea; la consola queda
ocupada, se corta con `Ctrl+C`):

```powershell
.\frontend\iniciar_frontend.bat
```

Esperado: `Running on http://127.0.0.1:5029` sin trazas de error.

**Verificador de despliegue** (desde `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, una
línea, consola normal):

```powershell
.\verificar_deploy.ps1
```

Esperado: **`TODO OK -- el deploy tiene la version actual del codigo.`** en verde, con la
línea nueva `[OK] login.html tiene la transicion de salida (capa lt-app__img)` y
`[OK] static/img/PanelLEft.png existe`. **Cero `[FALLA]`.**

**🔴 El EXECUTOR NO PUEDE VALIDAR NADA VISUAL.** No tiene navegador: no ve si el panel se
desplaza, si la imagen se aclara ni si el redirect llega a tiempo. Al terminar debe
reportar **«implementado, PENDIENTE de validación humana»**, nunca «completado».

### §6.2 · Humana — la ejecuta el USUARIO en el navegador

Abrir `http://localhost:5029/login` con **F12 → Console** abierta.
**Hacer antes un refresco duro (`Ctrl+F5`)** para descartar la caché del `login.js` viejo.

| # | Qué probar | Qué debe pasar |
|---|---|---|
| 1 | Cargar la página | El panel izquierdo muestra la captura de MainChat, apagada bajo un velo blanco. La constelación **no** aparece |
| 2 | Login correcto | El panel del formulario viaja **a la izquierda** cruzando sobre la imagen, se desvanece y se desenfoca |
| 3 | En paralelo | La imagen se aclara, gana nitidez y se reencuadra a pantalla completa |
| 4 | El botón | Muestra «VERIFICANDO…» con spinner y **no vuelve a «ACCESO»** en ningún momento |
| 5 | Al terminar (~1,25 s) | Llega a `/mainchat` sin cortes ni parpadeo |
| 6 | Scroll horizontal | **No aparece** en ningún momento del viaje |
| 7 | Credenciales incorrectas | **No se anima nada**; sale el mensaje de error y se puede reintentar |
| 8 | Acceso denegado (whitelist) | Se abre el modal de solicitud; **no se anima nada** |
| 9 | Enviar una solicitud de acceso con éxito | **No se anima nada** y **no** salta a `/mainchat` |
| 10 | Doble clic rápido en ACCESO | La transición corre **una sola vez** |
| 11 | Ventana estrecha (<768px) | El formulario ocupa todo; al entrar hace **fade**, sin desplazarse ni dejar pantalla en blanco |
| 12 | Entrada por SSO (`?token=`) | Sigue entrando **igual de rápido que antes**, sin transición (H-11) |
| 13 | Consola F12 | **0 errores** (los `console.warn` del módulo tampoco deben aparecer) |

**Solo el usuario marca ✅ esta feature.**

### §6.3 · Antes de migrar a Azure (la ejecuta el USUARIO, en el servidor de pruebas)

Nada llega a Azure sin haber corrido en Pruebas (`CLAUDE.md` §9, regla 2). Una vez validado
§6.2 allí, el pipeline es el de siempre, **en tres tiempos** (desde
`C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`, una línea cada uno):

```powershell
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Aplicar
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Push
```

El primero debe listar `static/img/PanelLEft.png` entre los archivos pendientes. **Si no
aparece, el paso 1 de la §4 no se hizo** y la imagen daría 404 en producción (H-15).

---

## §7 · Fuera de alcance

- **El flujo SSO por token** (`?token=`). Camino automático con su propio overlay y sin
  submit; añadirle 1,25 s empeoraría una entrada hoy inmediata (H-11).
- **Regenerar `PanelLEft.png` a color o en mayor resolución.** El CSS queda preparado con la
  línea comentada y rotulada. La imagen actual (813×639) se verá algo blanda al ampliarse a
  pantalla completa: es esperado, no un defecto de la implementación.
- **El `lt-spinner`** del documento (§7): se reutiliza el de Bootstrap (H-9).
- **El foco al entrar** (documento §8). Aquí hay navegación completa de página: `/mainchat`
  gestiona su propio foco.
- **Los tests Vitest** del documento (§11). No hay infraestructura de tests JS en el frontend
  Flask; montarla excede esta tarea.
- **Borrar el SVG de la constelación.** Prohibido: rompería `verificar_deploy.ps1` (H-13).
- **Modificar `migrar_a_azure.ps1`.** No lo necesita (H-16).
- **Ejecutar la migración a Azure DevOps.** El plan termina en local; la migración la lanza
  el usuario desde el servidor de pruebas tras validar §6.2.
- **Sacar del índice los ~151 MB de binarios heredados** que menciona `CLAUDE.md` §8. Es
  deuda conocida y tarea aparte; este plan solo añade 38 KB.

---

## Prompt para el agente EXECUTOR

```
Eres un agente EXECUTOR. Lee completo el plan indicado y ejecútalo AL PIE DE LA LETRA.
Plan: C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\Planes\plan_LOGIN-TRANSICION-SALIDA_20260830.md
Reglas: CERO modificaciones. Orden secuencial. Si falla, DETENTE. Reporta: ✅/❌ Paso N.
Al final: archivos tocados + "¿Hago commit?"
```

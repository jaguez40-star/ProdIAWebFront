# Plan ADMIN-USUARIOS-USO — instrumentar actividad y poblar la sección «Usuarios Uso»

**ID tarea:** ADMIN-USUARIOS-USO
**Fecha:** 2026-09-03
**Versión:** v2 (RE-auditado — 2 hallazgos nuevos sobre el v1, ver §1B)
**Alcance:**
- `frontend/utils/auth_logger.py` — un método nuevo
- `frontend/app.py` — un `@app.after_request` nuevo (archivo compartido, ver H2)
- `frontend/routes/api.py` — un endpoint nuevo (archivo compartido, ver H2)
- `frontend/MainChat/templates/mainchat_layout.html` — panel «Usuarios Uso»
- `frontend/MainChat/static/css/mainchat.css` — estilos de la tabla
- `frontend/MainChat/static/js/mainchat.js` — carga de datos al abrir el modal

**Backend INGESTA (:5030):** NO se toca. Cero cambios en FastAPI, motor Q v2 o BD.
El contrato Flask↔INGESTA no cambia: el endpoint nuevo lee un archivo local de Flask.

**Decisiones cerradas del usuario:**

1. La sección **Usuarios Uso** del modal Admin muestra una tabla de accesos con el formato
   del Excel de referencia: **Usuario · Sesiones · Fechas · Qué hizo**, más un segundo
   bloque de **Rechazados** (Usuario · Intentos · Fechas · Observación).
2. **Fuente de datos: el log vivo** `data/logs/auth_operations.log` (decisión explícita del
   usuario). NO se lee `stderr.txt`. Consecuencia aceptada: la tabla arranca casi vacía y se
   puebla con los accesos nuevos; el histórico jun-ago del Excel NO aparecerá. Ver H5.
3. **La columna «Qué hizo» SÍ va**, por tipo de actividad (Chat / Reportes / Gráficas /
   Solo entró), no por tema. Como el log vivo hoy no contiene actividad (H1), este plan
   **instrumenta la app** para que la registre de aquí en adelante — esa es la opción "A"
   que eligió el usuario.
4. Sin control de roles: la sección la ve cualquier usuario autenticado, igual que el resto
   del waffle (deuda conocida, `CLAUDE.md` §6). Ver §7.

---

## 0. Contexto para el agente EXECUTOR

**Proyecto:** ProdIA — asistente conversacional de producción de hidrocarburos.
`frontend/` es el repo Flask + Jinja2 (puerto 5029, `ProdIAWebFront`).

**Raíz del repo:** `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend`

**Los 6 archivos que se tocan (rutas absolutas):**
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\utils\auth_logger.py`
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\app.py`
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\routes\api.py`
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\templates\mainchat_layout.html`
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\static\css\mainchat.css`
- `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\MainChat\static\js\mainchat.js`

**De dónde viene esto:** el modal Admin ya existe (plan `plan_admin-modal_2026-09-03.md`,
commits `4204cf9` y `f6be145`). Tiene tres secciones — Grupos, Usuarios, Usuarios Uso —
las tres con un placeholder «Sección en construcción.». Este plan llena **solo la tercera**.

**Convenciones obligatorias (verificadas en los archivos reales):**

- **JS de `mainchat.js`:** `const`/`let` + `function` clásica. Cero arrow functions, cero
  template literals, cero `class`. Es el estilo real del archivo (líneas 19, 24, 101…).
- **Python:** el proyecto usa type hints sueltos y docstrings en español (ver
  `auth_logger.py`). Seguir ese estilo, no imponer uno nuevo.
- Comentarios y nombres en español. Todo comentario nuevo lleva `[2026-09-03]` al inicio.
- **Cache-buster:** al editar `mainchat.css` o `mainchat.js` hay que subir su `?v=` en
  `mainchat_layout.html`. Hoy ambos están en `?v=20260903b` → pasan a `?v=20260903c`.
- 🔴 **La palabra `claude` y `jaguez40` NO puede aparecer en ningún archivo tocado**: el
  skill `migrar-a-azure` (`migrar_a_azure.ps1:87`, `$TerminosProhibidos`) aborta la
  publicación a Azure si la encuentra. Ver R1 del plan anterior.
- Regla de cierre: si algo del §2 no calza con el código real, **DETENERSE y reportar**.

---

## 1. Hallazgos de la auditoría — leer ANTES de escribir código

### 🔴 H1 — El log vivo NO contiene actividad: hay que instrumentarla (esta es la tarea)

`grep -n "auth_logger\.log_"` sobre todo `frontend/` devuelve **7 llamadas, todas en
`routes/auth.py`** (líneas 141, 222, 254, 319, 343, 366, 410) y **todas son login/logout**.
`auth_logger.py` solo expone `log_login_success`, `log_login_failure`, `log_logout` y
`log_session_expired`. **Ninguna registra qué hizo el usuario dentro de la app.**

La reconstrucción de actividad que sí es posible sobre el histórico (`stderr.txt`) sale de
las líneas de **werkzeug**, que NO llegan a `auth_operations.log`. Por eso, con la fuente
elegida (decisión #2), la columna «Qué hizo» solo puede existir si la app **empieza a
registrarla**. Eso es §3.1 + §3.2.

### 🔴 H2 — Instrumentar 55 rutas una por una está PROHIBIDO: hay un `after_request` central

Conteo real de rutas: `routes/api.py` 36 · `routes/auth.py` 9 · `routes/chat.py` 4 ·
`routes/main.py` 4 · `routes/colapsable.py` 1 · `routes/mainchat.py` 1, más `/login` en
`app.py:112`. **55 rutas.** Tocarlas una a una sería frágil, enorme, y metería cambios en
`routes/api.py` y `routes/chat.py` (archivos compartidos, `CLAUDE.md` §10.2).

**Ya existe el punto único correcto:** `app.py:88` tiene un `@app.after_request`
(`compress_response`). Un segundo `@app.after_request` registra **todas** las peticiones sin
tocar ni una ruta. Flask ejecuta los `after_request` en orden inverso al de registro; son
independientes entre sí y ninguno interfiere con el otro (el de compresión modifica el
body, el nuevo solo lee `request.path` y devuelve `response` intacta).

**Corrección de diseño:** §3.2 añade UN hook en `app.py`. Cero cambios en las 55 rutas.
`routes/api.py` solo recibe el endpoint de lectura (§3.3), no instrumentación.

### 🟢 H3 — `session["user_email"]` está disponible y es la clave correcta para atribuir

`routes/auth.py` escribe `session["user"]` (dict) y `session["user_email"]` (str) en los
tres caminos de login (líneas 129/139, 210/220, 306/316). El `after_request` puede leer
`session.get("user_email")` para saber quién hizo la petición. Si no hay sesión (usuario no
autenticado), no se registra nada — es tráfico anónimo de `/login` y estáticos.

### 🟢 H4 — El volumen es bajo: no hay riesgo de inflar el log

Medido sobre el histórico real (`stderr.txt`, 2-jun a 27-ago, 13 días con actividad):
**469 peticiones totales**, de las cuales **223 son útiles** (excluyendo `/static/`,
`favicon`, `.css`, `.js`, `.png`, `.ico` y `/socket`). Son ~17 peticiones útiles por sesión
de login. Con el filtro de §3.2 (solo rutas de negocio, no estáticos), el log de actividad
crece de forma despreciable. **No hace falta un archivo separado ni rotación distinta**: cabe
en `auth_operations.log` junto a los eventos de auth.

### 🟡 H5 — La tabla arrancará vacía, y eso es consecuencia directa de la decisión #2

Estado real HOY de la fuente elegida: `data/logs/auth_operations.log` = **92 bytes, 1 línea**
(un login de prueba del 2026-09-03) + un rotado `auth_operations.log.2026-08-30` de 4 líneas.
Los 6 usuarios del Excel de referencia (juan.rincon, enrique.gallardo, francisco.gonzalez.ext,
gustavo.morenobe, dagoberto.porras) **NO están ahí** — están en `stderr.txt`, que la decisión
#2 excluye.

**Consecuencia que el executor debe respetar:** la sección debe verse **correcta y explicable
con la tabla vacía o casi vacía**. Por eso §3.5 incluye un estado vacío explícito
("Todavía no hay accesos registrados…"), no una tabla en blanco que parezca rota. NO
inventar datos de ejemplo ni hardcodear los usuarios del Excel.

### 🟡 H6 — Retención de 30 días: la tabla se vaciará por la cola

`auth_logger.py:44-50` usa `TimedRotatingFileHandler(when="midnight", backupCount=30)`. El
log activo se rota cada medianoche y solo se conservan 30 archivos. **Los accesos de hace más
de 30 días desaparecen del disco.** Para que la tabla no mienta, §3.3 lee el log activo **y
los rotados** (`auth_operations.log*`), y §3.5 muestra el rango de fechas cubierto. Subir
`backupCount` NO entra en este plan (ver §7): es una decisión de retención del usuario.

### 🟢 H7 — El formato del log es parseable sin ambigüedad

Formato real (`auth_logger.py:53-55`): `%(asctime)s | %(levelname)s | %(message)s` con
`datefmt="%Y-%m-%d %H:%M:%S"`. Líneas reales verificadas:

```
2026-08-30 17:05:36 | INFO | LOGIN_SUCCESS | Usuario: javier.guerrero@ecopetrol.com.co | Dominio: ECOPETROL
2026-09-03 04:58:15 | INFO | LOGIN_SUCCESS | Usuario: javier.guerrero | Dominio: ECOPETROL
```

⚠️ **Inconsistencia detectada:** el mismo usuario aparece como `javier.guerrero@ecopetrol.com.co`
y como `javier.guerrero` (según el camino de login: `user_email` en unos, `username` en otros).
**Si no se normaliza, el mismo usuario sale partido en dos filas.** §3.3 normaliza quitando el
dominio antes de agrupar. Es un hallazgo que el v1 del parser habría pasado por alto.

### 🔴 H9 — `routes/api.py` NO usa `login_required`: hay que importarlo explícitamente

Medido: `grep -oE "^@[a-z_]+" routes/api.py` devuelve **36 ocurrencias de `@api_bp` y nada
más**. Las 36 rutas de ese blueprint **no tienen `@login_required`** (a diferencia de
`routes/main.py`, `routes/mainchat.py` y `routes/colapsable.py`, que sí lo usan). El
decorador vive en `utils/auth_middleware.py:13` pero **`routes/api.py` ni siquiera lo
importa**.

**Consecuencia:** escribir `@login_required` en el endpoint nuevo sin añadir el import
revienta con `NameError` al cargar el módulo — es decir, **la app no arranca**. §3.3 añade
el import explícito.

**Decisión de diseño:** el endpoint SÍ lleva `@login_required` aunque sus 36 vecinas no lo
lleven. Expone quién entra y quién fue rechazado: es la ruta más sensible del blueprint y no
puede quedar abierta. Que las otras 36 estén sin proteger es deuda preexistente y **no se
toca en este plan** (§7).

**Verificado:** `app.py:15` ya importa `session` y `request`
(`from flask import Flask, jsonify, redirect, render_template, request, session, url_for`),
así que §3.2 **no** necesita tocar imports. `routes/api.py:5` ya importa `jsonify` y
`session`.

### 🟢 H8 — `LOGIN_FAILURE` ya trae la razón: el bloque «Rechazados» sale gratis

`routes/auth.py:254` y `:343` registran `reason="Acceso no autorizado - Email no en lista
blanca"` — exactamente el criterio del segundo bloque del Excel. `:366` registra otras razones
(credenciales inválidas). §3.3 separa ambas: la lista blanca va al bloque «Rechazados»; el
resto se agrupa como «Credenciales inválidas».

---

## 1B. 🔴 RE-AUDITORÍA (v2) — 2 hallazgos que corrigen el v1

### 🔴 R1 — El chat clásico va por socket.io: un `after_request` NO lo ve

Medido: el chat real de la vista clásica (`/`) se procesa en
`@socketio.on("send_message")` (`app.py:150`), un evento **WebSocket**. Los `after_request`
de Flask corren **solo en el ciclo HTTP request/response** — un mensaje por socket.io NO pasa
por ahí. Confirmado en el histórico (`stderr.txt`): las preguntas del chat de esa época NO
aparecen como líneas HTTP; lo único que quedó del chat fueron `POST /new_conversation` (crear
conversación) y `GET /select_conversation/<id>` (abrirla).

**Consecuencia — límite conocido, no bug:** con el chat clásico, la columna «Qué hizo»
marcará «Chat» cuando el usuario **crea o abre** una conversación, no cuando pregunta. Es lo
máximo que el mecanismo HTTP puede capturar sin instrumentar los handlers de socket (fuera de
alcance, §7). El v1 vendía «Chat» como "preguntó", lo cual era impreciso. **La validación
humana §6.2 se ajusta**: el paso que probaba "mandar una pregunta" pasa a "crear una
conversación nueva".

### 🟡 R2 — El chat de `/mainchat` SÍ va por HTTP: capturarlo mejora la columna

Medido sobre `static/js/multitab_shell.js` (el shell que monta `/mainchat`, donde vive el
modal Admin): pregunta por **HTTP** a `/api/consulta/preguntar` y `/api/consulta2/preguntar`,
con **cero** usos de `send_message`. A diferencia del chat clásico (R1), estas preguntas SÍ
las ve un `after_request`.

**Corrección aplicada en §3.2:** el mapeo `ACTIVIDAD_RUTAS` **añade** esos dos prefijos con
acción `CHAT`. Así la columna «Qué hizo» registra preguntas reales del chat que la gente usa
hoy en `/mainchat`, no solo la creación de conversaciones. Es aditivo y de bajo riesgo (son
prefijos nuevos en una tupla; no cambia nada más).

**Prefijos finales verificados** (blueprint + `url_prefix`, `app.py:80-85`):
`/new_conversation` (main, sin prefijo), `/select_conversation` (main), `/api/conversation`
(api +`/api`), `/api/generate_fixed_report` (api), `/api/ai/generate_chart` (api),
`/api/consulta/preguntar` y `/api/consulta2/preguntar` (api). Los 7 apuntan a rutas reales.

---

## 2. Estado actual (para que el executor sepa qué está mirando)

**`utils/auth_logger.py`, últimos métodos (líneas 96-107):**

```python
    def log_session_expired(self, username):
        """
        Registra una sesión expirada

        Args:
            username (str): Nombre del usuario
        """
        self.logger.info(f"SESSION_EXPIRED | Usuario: {username}")


# Instancia global del logger de autenticación
auth_logger = AuthLogger()
```

**`app.py`, el `after_request` existente y lo que sigue (líneas 87-115):**

```python
    # Compresión gzip para respuestas JSON grandes
    @app.after_request
    def compress_response(response):
```
…(cuerpo de la función)…
```python
        response.headers['Vary'] = 'Accept-Encoding'
        return response

    # Login route
    @app.route("/login")
    def login():
        """Login page"""
        return render_template("login.html")
```

**`MainChat/templates/mainchat_layout.html`, el panel a llenar (dentro del modal Admin):**

```html
                    <div class="tab-pane fade mc-admin-panel" id="mc-admin-pane-usuarios-uso" role="tabpanel" aria-labelledby="mc-admin-pane-usuarios-uso">
                        <h6 class="mc-admin-panel__title">Usuarios Uso</h6>
                        <p class="mc-admin-panel__placeholder">Sección en construcción.</p>
                    </div>
```

**`MainChat/templates/mainchat_layout.html`, cache-busters actuales (líneas 10 y 208):**

```html
    <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260903b">
```
```html
<script defer src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260903a">
```

⚠️ Ojo: el CSS está en `20260903b` y el JS en `20260903a` (el commit `f6be145` solo subió el
CSS). Ambos pasan a `20260903c` en §3.6.

**`MainChat/static/js/mainchat.js`, final del IIFE (líneas 118-134 aprox.):**

```javascript
    const salir = document.getElementById('mc-logout');
    if (salir) {
        salir.addEventListener('click', function () {
```
…(cuerpo)…
```javascript
    }
})();
```

---

## 3. Especificación

### 3.1 AÑADIR — método `log_actividad` en `utils/auth_logger.py`

**Localizar** (final del archivo, antes de la instancia global):

```python
    def log_session_expired(self, username):
        """
        Registra una sesión expirada

        Args:
            username (str): Nombre del usuario
        """
        self.logger.info(f"SESSION_EXPIRED | Usuario: {username}")


# Instancia global del logger de autenticación
auth_logger = AuthLogger()
```

**Sustituir por:**

```python
    def log_session_expired(self, username):
        """
        Registra una sesión expirada

        Args:
            username (str): Nombre del usuario
        """
        self.logger.info(f"SESSION_EXPIRED | Usuario: {username}")

    def log_actividad(self, username, accion, ruta):
        """
        [2026-09-03] Registra una acción del usuario dentro de la app.

        Alimenta la columna "Qué hizo" del panel Admin > Usuarios Uso. Se emite
        desde el after_request de app.py, no desde cada ruta: así las 55 rutas
        quedan cubiertas sin tocar ninguna.

        Args:
            username (str): Correo o usuario de la sesión
            accion (str): Categoría de actividad (CHAT, REPORTE, GRAFICA, VISTA)
            ruta (str): Ruta HTTP que originó la acción
        """
        self.logger.info(
            f"ACTIVIDAD | Usuario: {username} | Accion: {accion} | Ruta: {ruta}"
        )


# Instancia global del logger de autenticación
auth_logger = AuthLogger()
```

### 3.2 AÑADIR — `after_request` de actividad en `app.py`

**Localizar** (el final de `compress_response` y el inicio de la ruta de login, líneas 106-115):

```python
        compressed = gzip.compress(data, compresslevel=6)
        response.set_data(compressed)
        response.headers['Content-Encoding'] = 'gzip'
        response.headers['Content-Length'] = len(compressed)
        response.headers['Vary'] = 'Accept-Encoding'
        return response

    # Login route
    @app.route("/login")
```

**Sustituir por:**

```python
        compressed = gzip.compress(data, compresslevel=6)
        response.set_data(compressed)
        response.headers['Content-Encoding'] = 'gzip'
        response.headers['Content-Length'] = len(compressed)
        response.headers['Vary'] = 'Accept-Encoding'
        return response

    # [2026-09-03] Registro de actividad para Admin > Usuarios Uso.
    # Un solo hook en vez de instrumentar las 55 rutas de los 6 blueprints: cubre
    # todo sin tocar routes/api.py ni routes/chat.py (archivos compartidos).
    # Solo registra peticiones de negocio con sesión iniciada; los estáticos, el
    # polling de socket.io y el tráfico anónimo se descartan (serían ruido: el
    # histórico medido da 469 peticiones totales frente a 223 útiles).
    # [2026-09-03] R2: /api/consulta*/preguntar son las preguntas reales del chat de
    # /mainchat (multitab_shell.js pregunta por HTTP). El chat clásico (/) va por
    # socket.io y NO pasa por aquí (R1, límite conocido): de él solo se capta crear/abrir
    # conversación. El orden importa: prefijos más específicos ANTES que los genéricos si
    # se solaparan (aquí no se solapan, pero se mantiene el criterio).
    ACTIVIDAD_RUTAS = (
        ("/api/consulta/preguntar", "CHAT"),
        ("/api/consulta2/preguntar", "CHAT"),
        ("/new_conversation", "CHAT"),
        ("/select_conversation", "CHAT"),
        ("/api/conversation", "CHAT"),
        ("/api/generate_fixed_report", "REPORTE"),
        ("/api/ai/generate_chart", "GRAFICA"),
    )

    @app.after_request
    def registrar_actividad(response):
        try:
            if response.status_code >= 400:
                return response

            usuario = session.get("user_email")
            if not usuario:
                return response

            ruta = request.path
            for prefijo, accion in ACTIVIDAD_RUTAS:
                if ruta.startswith(prefijo):
                    from utils.auth_logger import auth_logger

                    auth_logger.log_actividad(
                        username=usuario, accion=accion, ruta=ruta
                    )
                    break
        except Exception:
            # El registro de actividad NUNCA debe tumbar una respuesta buena.
            logger.debug("No se pudo registrar la actividad", exc_info=True)

        return response

    # Login route
    @app.route("/login")
```

✅ **Imports ya verificados (H9):** `app.py:15` es
`from flask import Flask, jsonify, redirect, render_template, request, session, url_for` —
`session` y `request` ya están. **No hay que tocar la cabecera de `app.py`.** `logger` también
existe ya en el módulo.

### 3.3 AÑADIR — endpoint de lectura en `routes/api.py`

**Añadir al final del archivo** (no modificar ninguna ruta existente):

⚠️ **H9:** `login_required` NO está importado en este archivo (sus 36 rutas no lo usan). El
import va DENTRO de la función para no alterar la cabecera del módulo — patrón que el propio
archivo ya usa. Sin él, `NameError` y la app no arranca.

```python


# ─────────────────────────────────────────────────────────────────────
# [2026-09-03] Reporte de accesos para Admin > Usuarios Uso
# ─────────────────────────────────────────────────────────────────────

from utils.auth_middleware import login_required  # noqa: E402  (H9)


@api_bp.route("/admin/usuarios-uso", methods=["GET"])
@login_required
def admin_usuarios_uso():
    """
    Devuelve el reporte de accesos agregado por usuario.

    Lee el log de autenticación (activo + rotados) y agrupa por usuario:
    sesiones, fechas, actividad y rechazos. No consulta INGESTA ni la BD.
    """
    import glob
    import os
    import re
    from collections import OrderedDict

    from config.settings import BASE_DIR

    LOG_DIR = os.path.join(str(BASE_DIR), "data", "logs")
    PATRON = os.path.join(LOG_DIR, "auth_operations.log*")

    # Formato real (auth_logger.py:53): "%(asctime)s | %(levelname)s | %(message)s"
    RE_LINEA = re.compile(
        r"^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2} \| \w+ \| "
        r"(LOGIN_SUCCESS|LOGIN_FAILURE|ACTIVIDAD) \| Usuario: ([^|]+?)"
        r"(?: \| (?:Dominio|Razón|Razon|Accion): ([^|]+?))?"
        r"(?: \| Ruta: .+)?$"
    )

    ETIQUETA = {
        "CHAT": "Chat",
        "REPORTE": "Reportes",
        "GRAFICA": "Gráficas",
    }

    def normalizar(usuario):
        # H7: el mismo usuario aparece con y sin dominio según el camino de login.
        # Sin esto, sale partido en dos filas.
        return usuario.strip().lower().split("@")[0]

    entraron = OrderedDict()
    rechazados = OrderedDict()

    for archivo in sorted(glob.glob(PATRON)):
        try:
            with open(archivo, encoding="utf-8", errors="replace") as fh:
                for linea in fh:
                    m = RE_LINEA.match(linea.strip())
                    if not m:
                        continue
                    fecha, evento, usuario, extra = m.groups()
                    clave = normalizar(usuario)

                    if evento == "LOGIN_SUCCESS":
                        reg = entraron.setdefault(
                            clave,
                            {
                                "usuario": usuario.strip(),
                                "sesiones": 0,
                                "fechas": [],
                                "acciones": set(),
                            },
                        )
                        reg["sesiones"] += 1
                        if fecha not in reg["fechas"]:
                            reg["fechas"].append(fecha)

                    elif evento == "ACTIVIDAD":
                        reg = entraron.setdefault(
                            clave,
                            {
                                "usuario": usuario.strip(),
                                "sesiones": 0,
                                "fechas": [],
                                "acciones": set(),
                            },
                        )
                        if extra:
                            reg["acciones"].add(
                                ETIQUETA.get(extra.strip(), extra.strip())
                            )

                    elif evento == "LOGIN_FAILURE":
                        motivo = (extra or "").strip()
                        # H8: separar "no está en la lista blanca" del resto.
                        if "lista blanca" in motivo.lower():
                            observacion = "No está en la lista blanca"
                        else:
                            observacion = motivo or "Credenciales inválidas"
                        reg = rechazados.setdefault(
                            clave,
                            {
                                "usuario": usuario.strip(),
                                "intentos": 0,
                                "fechas": [],
                                "observacion": observacion,
                            },
                        )
                        reg["intentos"] += 1
                        if fecha not in reg["fechas"]:
                            reg["fechas"].append(fecha)
        except OSError:
            continue

    def salida_entraron(reg):
        acciones = sorted(reg["acciones"])
        return {
            "usuario": reg["usuario"],
            "sesiones": reg["sesiones"],
            "fechas": sorted(reg["fechas"]),
            "que_hizo": ", ".join(acciones) if acciones else "Solo entró",
        }

    return jsonify(
        {
            "success": True,
            "entraron": [salida_entraron(r) for r in entraron.values()],
            "rechazados": [
                {
                    "usuario": r["usuario"],
                    "intentos": r["intentos"],
                    "fechas": sorted(r["fechas"]),
                    "observacion": r["observacion"],
                }
                for r in rechazados.values()
            ],
        }
    )
```

✅ **Verificado (H9):** `routes/api.py:5` ya importa `jsonify` y `session`
(`from flask import Blueprint, request, jsonify, session`), y el blueprint es
`api_bp = Blueprint("api", __name__)` (línea 23), registrado en `app.py:82` con
`url_prefix="/api"` → la URL final es **`/api/admin/usuarios-uso`**. `login_required` lo
añade el import del bloque de arriba.

### 3.4 MODIFICAR — panel «Usuarios Uso» en `mainchat_layout.html`

**Localizar:**

```html
                    <div class="tab-pane fade mc-admin-panel" id="mc-admin-pane-usuarios-uso" role="tabpanel" aria-labelledby="mc-admin-pane-usuarios-uso">
                        <h6 class="mc-admin-panel__title">Usuarios Uso</h6>
                        <p class="mc-admin-panel__placeholder">Sección en construcción.</p>
                    </div>
```

**Sustituir por:**

```html
                    <div class="tab-pane fade mc-admin-panel" id="mc-admin-pane-usuarios-uso" role="tabpanel" aria-labelledby="mc-admin-pane-usuarios-uso">
                        <h6 class="mc-admin-panel__title">Usuarios Uso</h6>
                        <!-- [2026-09-03] Lo puebla mainchat.js al abrir el modal, leyendo
                             /api/admin/usuarios-uso. Arranca con el aviso de carga: la tabla
                             puede quedar vacía y eso es correcto (el log vivo se puebla con
                             los accesos nuevos, no trae histórico). -->
                        <div id="mc-admin-uso" class="mc-admin-uso">
                            <p class="mc-admin-panel__placeholder">Cargando accesos…</p>
                        </div>
                    </div>
```

### 3.5 AÑADIR — render de la tabla en `mainchat.js`

**Localizar** el final del IIFE:

```javascript
    const salir = document.getElementById('mc-logout');
```

**Insertar JUSTO ANTES** de esa línea:

```javascript
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
```

⚠️ **Nota de estilo:** el `let` de `usoCargado` y de `html` es correcto — el archivo ya usa
`let` (`mainchat.js:40`, `let top = ...`). Lo prohibido son arrow functions y template
literals, no `let`.

### 3.6 AÑADIR — CSS de la tabla en `mainchat.css`

**Añadir al final del archivo:**

```css

/* ── Admin > Usuarios Uso ───────────────────────────────────────────── */

/* [2026-09-03] Tabla de accesos. Sin .table de Bootstrap: sus estilos traen
   márgenes y bordes pensados para páginas completas y desentonan dentro del
   panel del modal, que ya tiene su propio ritmo de espaciado. */
.mc-uso-bloque {
    margin-bottom: 22px;
}

.mc-uso-titulo {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin: 0 0 8px;
}

.mc-uso-titulo--ok {
    color: var(--mc-primary);
}

.mc-uso-titulo--no {
    color: var(--mc-neg);
}

.mc-uso-tabla {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
}

.mc-uso-tabla th {
    text-align: left;
    font-weight: 700;
    color: #fff;
    background: var(--mc-primary);
    padding: 7px 10px;
    white-space: nowrap;
}

.mc-uso-titulo--no + .mc-uso-tabla th {
    background: var(--mc-neg);
}

.mc-uso-tabla td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--mc-border);
    color: var(--mc-navy);
    vertical-align: top;
}

.mc-uso-num {
    text-align: center;
    font-weight: 700;
}

.mc-uso-vacio {
    color: var(--mc-muted);
    font-style: italic;
}
```

### 3.7 MODIFICAR — subir los cache-busters en `mainchat_layout.html`

**Localizar (línea 10):**
```html
    <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260903b">
```
**Sustituir por:**
```html
    <link rel="stylesheet" href="{{ url_for('mainchat.static', filename='css/mainchat.css') }}?v=20260903c">
```

**Localizar (línea 208 aprox.):**
```html
<script defer src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260903a"></script>
```
**Sustituir por:**
```html
<script defer src="{{ url_for('mainchat.static', filename='js/mainchat.js') }}?v=20260903c"></script>
```

---

## 4. Orden de ejecución

| # | Acción | Archivo |
|---|---|---|
| 1 | Método `log_actividad` (§3.1) | `utils/auth_logger.py` |
| 2 | Hook `registrar_actividad` + verificar import de `session` (§3.2) | `app.py` |
| 3 | Endpoint `/api/admin/usuarios-uso` (§3.3) | `routes/api.py` |
| 4 | Panel «Usuarios Uso» con contenedor `#mc-admin-uso` (§3.4) | `mainchat_layout.html` |
| 5 | Render de la tabla (§3.5) | `mainchat.js` |
| 6 | CSS de la tabla (§3.6) | `mainchat.css` |
| 7 | Cache-busters a `20260903c` (§3.7) | `mainchat_layout.html` |
| 8 | Validación estática (§6.1) | — |

El orden 1→2 importa: el hook llama a `log_actividad`, que debe existir antes. El 3 antes
que el 5 por la misma razón: el JS consume el endpoint.

---

## 5. Reglas no negociables

- 🔴 **NO instrumentar rutas una por una.** Las 55 rutas quedan cubiertas por el único
  `after_request` de §3.2. Si el executor se encuentra editando `routes/chat.py`,
  `routes/main.py` o alguna de las 36 rutas de `routes/api.py` para añadir logging,
  **algo está mal** — DETENERSE y releer H2. `routes/api.py` solo recibe el endpoint
  NUEVO del §3.3, al final del archivo.
- 🔴 **La palabra `claude` y `jaguez40` NO puede aparecer en ningún archivo tocado.** El
  pipeline `migrar-a-azure` aborta la publicación a Azure si la encuentra
  (`migrar_a_azure.ps1:87`). Verificar con `grep -ni` al terminar.
- 🔴 **El registro de actividad NUNCA puede tumbar una respuesta.** El `try/except` de §3.2
  es obligatorio y debe capturar `Exception`, no una clase concreta. Un fallo al escribir el
  log no puede convertir un 200 en un 500.
- **NO inventar datos de ejemplo** para que la tabla "se vea llena" (H5). Si el log está
  vacío, se muestra el estado vacío de §3.5 y ya.
- **NO leer `stderr.txt`.** Decisión cerrada #2 del usuario: la fuente es
  `auth_operations.log*`. El histórico jun-ago queda fuera de este plan (ver §7).
- **NO cambiar `backupCount`** ni la configuración de rotación de `auth_logger.py` (H6).
- **JS**: `const`/`let` + `function` clásica. Cero arrow functions, cero template literals.
- Todo comentario nuevo lleva `[2026-09-03]`.
- Si algo del §2 no coincide con el archivo real, **DETENERSE y reportar**.

---

## 6. Validación

### 6.1 Estática (la hace el executor)

| Comando | Carpeta | Resultado esperado |
|---|---|---|
| `grep -c "def log_actividad" utils/auth_logger.py` | `frontend/` | `1` |
| `grep -c "def registrar_actividad" app.py` | `frontend/` | `1` |
| `grep -c "admin/usuarios-uso" routes/api.py` | `frontend/` | `1` |
| `grep -c "from utils.auth_middleware import login_required" routes/api.py` | `frontend/` | `1` (H9 — sin esto, `NameError` al arrancar) |
| `grep -c "mc-admin-uso" MainChat/templates/mainchat_layout.html` | `frontend/` | `1` |
| `grep -c "cargarUsuariosUso" MainChat/static/js/mainchat.js` | `frontend/` | `2` (definición + llamada) |
| `grep -c "=>" MainChat/static/js/mainchat.js` | `frontend/` | `0` (sin arrow functions) |
| `grep -n "?v=20260903c" MainChat/templates/mainchat_layout.html` | `frontend/` | 2 coincidencias |
| `grep -ni "claude\|jaguez40" utils/auth_logger.py app.py routes/api.py MainChat/templates/mainchat_layout.html MainChat/static/css/mainchat.css MainChat/static/js/mainchat.js` | `frontend/` | **0 coincidencias** |
| `./venv/Scripts/python.exe -c "import ast;[ast.parse(open(f,encoding='utf-8').read()) for f in ['app.py','routes/api.py','utils/auth_logger.py']];print('OK sintaxis')"` | `frontend/` | `OK sintaxis` |
| Arranque `./iniciar_frontend.bat` (consola normal, queda corriendo) | `frontend/` | Levanta en 5029 sin traceback |
| `curl -s -o /dev/null -w "%{http_code}" http://localhost:5029/api/admin/usuarios-uso` | `frontend/` | `302` sin sesión (protegido por `@login_required`) — **no** 404 ni 500 |

⚠️ Un `404` en el último check significa que el blueprint o el prefijo no es el esperado:
**DETENERSE y reportar**, no cambiar el prefijo por ensayo y error.

### 6.2 Humana (la hace el usuario, en navegador — regla R3, `CLAUDE.md` §10.4)

El executor no tiene navegador. Estado correcto al terminar: **«implementado, PENDIENTE de
validación humana»**. El usuario valida en `http://localhost:5029/mainchat`:

1. Waffle → **Admin** → pestaña **Usuarios Uso**: se ve la tabla (o el aviso de que todavía
   no hay accesos, que es correcto — ver H5).
2. Aparece al menos la propia sesión del usuario en el bloque **Entraron**.
3. En **`/mainchat`**, escribir una pregunta en el chat (va por HTTP, R2). Cerrar el modal,
   volver a abrirlo y **recargar la página**: la columna **Qué hizo** debe mostrar «Chat».
   ⚠️ En el chat clásico (`/`), preguntar NO se registra (va por socket.io, R1); allí solo
   se registra crear una conversación nueva.
4. Generar un reporte → tras recargar, la columna suma «Reportes».
5. **F12 → Console con 0 errores** y la petición a `/api/admin/usuarios-uso` en 200.
6. La app sigue funcionando normal: chat, reportes y navegación sin lentitud perceptible
   (el hook corre en cada respuesta).

---

## 7. Fuera de alcance

- **El histórico de junio-agosto** (`stderr.txt`). Decisión cerrada #2: la fuente es el log
  vivo. Se midió que ese histórico ES recuperable —16 de 16 eventos fechables emparejando
  con el `POST /auth/login` adyacente de werkzeug, y contrastado contra el Excel de
  referencia cuadra en 5 de 6 usuarios— pero queda para un plan aparte si se quiere.
- **Retención del log** (H6): hoy son 30 días (`backupCount=30`). Subirlo es una decisión de
  política de retención del usuario, no se toca aquí.
- **El detalle temático de «Qué hizo»**: el plan registra *tipo* de actividad (Chat,
  Reportes, Gráficas), no el tema. «Gráficas de EBITDA/Breakeven» exigiría registrar el
  contenido de cada consulta — es otra discusión, con implicaciones de privacidad.
- **Las secciones Grupos y Usuarios** del modal: siguen con su placeholder.
- **Control de acceso por rol**: la sección la ve cualquier usuario autenticado. Deuda
  conocida (`CLAUDE.md` §6): `@login_required` es autenticación, no autorización.
- **Exportar a Excel/CSV** desde el panel: no se pidió.
- **Paginación / filtros por fecha** en la tabla: con el volumen medido (H4) no hacen falta
  todavía.


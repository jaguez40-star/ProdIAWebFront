# Cambios y Mejoras — Agosto 2026

> Bitácora consolidada del mes.
> Fuente: historial de Git (`main`).
> Rango cubierto: **2026-08-01 → 2026-08-26** · **229 commits**.

---

## Resumen del mes

Agosto se divide en tres bloques. Los dos primeros (2 – 13 de agosto, 109 commits) son
la **consolidación del Motor Q v2**: los cuatro grupos de intención —Cuantificar,
Jerarquizar, Analizar y OUT— pasan de esqueleto a responder con cifras reales, memoria
conversacional y paneles gráficos apilados. El tercero (20 – 24 de agosto, 38 commits)
cambia de eje hacia la **capa de presentación**: rediseño del login, MainChat pasa de
cascarón a interfaz real (portada, panel Historial con menú de usuario al pie, panorama
solo-P50), se corrige el scroll del panel Insights (5 iteraciones hasta medir la causa
real) y el panel Jerarquizar se rediseña como árbol con conectores. El 25 cierra con dos
frentes distintos: por la mañana **Cuantificar a grano día**, y por la tarde la
**resiliencia del chat ante timeouts** más la puesta al día de la ingesta —que destapó
corrupción física en la BD local, ajena al ETL. La noche arranca con una sesión de **diseño
sin código** —el panel «Comportamiento {Producto}», especificado y maquetado— que acaba
implementándose por la vía del grano día, y sigue con **navegación**: módulos que existían
pero no eran alcanzables desde la UI pasan al waffle y al sidebar. Tras ese cierre, la noche
continúa con un bloque de **conversación e interfaz del chat**: el clasificador gana un
cuarto detector (preguntas sobre el propio asistente y saludos, antes despachadas como
«fuera de contexto»), las burbujas asimétricas se reemplazan por un **hilo tipo timeline**
de una columna, y el riel de previews de análisis en Consulta pasa a un **botón con
popover**. El cierre del día son dos plantillas ejecutadas en paralelo: una corrige **cuatro
fallos de grano día y de hilo conversacional** detectados por el usuario en vivo, y otra
añade un **mapa de pozos sobre Colombia** al panel de Jerarquizar, verificado contra datos
reales de `robustez_v02` (que resultaron tener grano de zona, no de pozo, y coordenadas
invertidas respecto al contorno de los campos — dos hallazgos que cambiaron el diseño antes
de escribir código). El 26 la sesión se dedica a **pulir lo que el usuario probó en vivo**:
el mapa de pozos dejaba un hueco muerto bajo el árbol (medido con Edge headless: el
`<canvas>` aportaba un alto fantasma por su ratio intrínseco 2:1), dos avisos dejaron de
destacar lo que la app NO tiene ("sin contorno" en el mapa, "sin presupuesto diario" en
cada respuesta de grano día) y **"la producción del mes" dejó de perder el hilo** — si la
pregunta anterior fijó un mes, un "el mes" posterior lo hereda en vez de asumir hoy.
Cierra con una mejora de rendimiento: Diferidas/Mantenimientos/EBITDA-NOPAT, antes en carga
perezosa al hacer clic, ahora se precargan en paralelo apenas se pinta la tarjeta de Focos
de atención. Una **tercera sesión del 26** corre en paralelo con la de "el periodo de la
pregunta": dos atajos de chat que reactivan bajo demanda lo que el panorama global omite por
defecto (las tarjetas P50 solas y los Focos de atención), un fix de "Nuevo chat" que dejaba
el bloque superior del panel Insights sin reiniciar, el desplegable de preguntas ganando 8
plantillas de arranque siempre visibles y un fix de posicionamiento (`acordeon.css` pisaba el
`position:sticky` con `static`, dejando el desplegable fuera de la vista), el panel Historial
agrupando "Estado del sistema" y el usuario en un solo pie anclado y centrado, un badge
"Act: `<fecha>`" con la fecha del reporte más reciente en el header de Insights, y el rediseño
completo del panel izquierdo del login — de un degradado verde sólido a una constelación
neuronal animada en SVG+SMIL, adaptada de un documento de diseño escrito para React/Sass al
stack real (Jinja2 + CSS plano).

| Bloque | Fechas | Commits | Eje principal |
|--------|--------|--------:|---------------|
| **Motor Q v2** | 2 – 4 ago | 60 | Los 4 grupos de intención + filtro de dominio + Test Clas |
| **Paneles y gráficos** | 11 – 12 ago | 15 | Pila acumulativa, dot plot, dona, identidad por producto |
| **P50 y mantenimientos** | 13 ago | 9 | P50 como referencia, Eventos_OW real, panel por vicepresidencia |
| **Despliegue e ingesta** | 20 ago | 2 | Ingesta por lote no interactiva para el servidor 139 |
| **UI y entorno** | 21 ago | 7 | Login rediseñado, MainChat, arranque en Consulta, `install.bat` |
| **MainChat real + Jerarquizar** | 24 ago | 31 | MainChat con portada/Historial funcionales, scroll de Insights corregido, panel Jerarquizar rediseñado, ajustes de Capa 1 |
| **Cuantificar a grano día** | 25 ago | 6 | Vocabulario de arranque (8 formas), grano día N1D/N1DSEL, fix del demostrativo en la entidad |
| **Resiliencia e ingesta** | 25 ago (pm) | 1 | El timeout del Motor v2 deja de perder la pregunta; observabilidad del fallo; carga de agosto (19 reportes, 0 con IRM) y hallazgo de corrupción física en la BD local |
| **Diseño de panel** | 25 ago (noche) | 0 | Panel «Comportamiento {Producto}» especificado y maquetado: 2 gráficos, sin pestañas |
| **Panel de día + rendimiento** | 25 ago (noche) | 4 | El panel se implementa por la vía del grano día; la caché del proxy deja de duplicarse por `pulir`; limpieza y rótulos de la curva |
| **Navegación de módulos** | 25 ago (cierre) | 1 | Consulta/Análisis al waffle sin perder estado, `tabExiste()`, navegación entre las 3 vistas, fuera los 3 accesos a rutas inexistentes |
| **El asistente responde sobre sí mismo** | 25 ago (noche) | 3 | Cuarto detector del clasificador (`capacidades.py`): «¿qué puedes hacer?», «ayuda», saludos — antes despachados como fuera de dominio |
| **Hilo tipo timeline** | 25 ago (noche) | 6 | Burbujas asimétricas → hilo de una columna con riel, avatar y hora por turno (CN-HILO-D); autor «ProdIA» |
| **Menú de análisis en waffle** | 25 ago (noche) | 1 | El riel de 158px de previews en Consulta pasa a un botón con popover (CN-WAFFLE) |
| **Cuatro fallos de grano día e hilo** | 25 ago (noche) | 1 | Día puntual devolvía otro mes sin avisar, mes inexistente (diciembre→13), hilo perdido al cambiar de mes (QV2-HILO-DIA) |
| **Mapa de pozos en Jerarquizar** | 25 ago (noche) | 1 | Panel de estructura organizacional gana un mapa de pozos sobre Colombia, con la BD deduplicada por pozo y las coordenadas corregidas (QV2-MAPA) |
| **Pulido de UX medido en vivo** | 26 ago | 4 | El mapa de pozos deja de estirar el árbol (canvas fuera del flujo), dos avisos que no aportan se retiran, "la producción del mes" hereda el mes de la charla en vez de asumir hoy |
| **Rendimiento de Focos de atención** | 26 ago | 1 | Diferidas/Mantenimientos/EBITDA-NOPAT pasan de carga perezosa (clic) a precarga en paralelo apenas se pinta la tarjeta |
| **El periodo de la pregunta + paneles que faltaban** | 26 ago (2ª) | 6 | Panel de Diferidas al preguntar directo por causas, warm-up de sus cachés, waterfall de variación a escala real, burbuja de fallo con duración+código, Analizar deja de ser ciego al mes, EBITDA respeta el mes de Mantenimientos |
| **Atajos de panorama, login y pulido de UI** | 26 ago (3ª) | 11 | Atajos "bloque 2"/"bloque 3" en el chat, fix de "Nuevo chat" sin reiniciar Insights, desplegable de preguntas con plantillas siempre visibles, pie agrupado y centrado en Historial, badge "Act: fecha" en Insights, constelación neuronal animada en el login |

---

## Sesión del 21 de agosto — UI de acceso, MainChat y entorno

**7 commits.** La sesión no toca el pipeline de autenticación ni la lógica de negocio:
es capa de presentación más una pieza de infraestructura que faltaba.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-21 | **Arranque directo en Consulta** tras el login, eliminando el flash del layout de dos paneles y de la pestaña Ingesta antes de montar | `static/js/multitab_shell.js`, `templates/main.html` |
| 2026-08-21 | **Rediseño del login** — grid de 2 columnas con panel de marca en degradado Ecopetrol, más animación decorativa de pasos LDAP | `static/css/login.css`, `templates/login.html`, `static/js/login-steps.js` [NUEVO] |
| 2026-08-21 | **MainChat** como cascarón vacío en `/mainchat` | `MainChat/`, `routes/mainchat.py` [NUEVO], `app.py` |
| 2026-08-21 | **`install.bat`** para preparar el entorno desde cero | `install.bat` [NUEVO] |
| 2026-08-21 | Login: se retira la placa blanca y el logo de Ecopetrol del panel izquierdo; el logo de Prod-IA pasa al panel del formulario | `static/css/login.css`, `templates/login.html` |
| 2026-08-21 | MainChat: navbar blanca con burbuja de usuario y menú waffle; luego se retira el sidebar y la marca | `MainChat/static/css/mainchat.css`, `MainChat/static/js/mainchat.js`, `MainChat/templates/mainchat_layout.html` |
| 2026-08-21 | Login: el panel de marca queda solo con el degradado, sin texto | `static/css/login.css`, `templates/login.html` |

### Rediseño del login (`7a5ed0e`, `7fbe65d`, `3f1fcc3`)

El login pasa de la card centrada de Bootstrap a un **grid de dos columnas**: panel
izquierdo con degradado corporativo (`#004236 → #00302a`) y panel derecho blanco de
460 px con el formulario. La paleta y las medidas se portan de ProdIA_V02.

🔑 **Restricción que gobernó todo el trabajo:** `static/js/login.js` toma referencias
DOM **a nivel de módulo**, y la línea 24 hace
`new bootstrap.Modal(document.getElementById('accessRequestModal'))`. Si falta
cualquiera de los 18 IDs que consume, esa línea lanza y **ningún listener posterior se
registra**: el formulario se ve perfecto y no hace nada. Por eso el rediseño preserva
el contrato completo de IDs y **no modifica `login.js`** (verificado por hash).

Detalles estructurales que sostienen el comportamiento:

- `.field-input-wrap` va en **columna**: el `div.invalid-feedback` debe ser hermano del
  input (Bootstrap solo lo revela con `.is-invalid ~ .invalid-feedback`) pero caer
  debajo, no al lado. Con `flex` en fila el mensaje comprimía el input.
- Los iconos se anclan con `top` fijo, no centrados: al aparecer el error el wrapper
  crece y un `top:50%` los desalinearía.
- Se quitan `required`/`minlength` del markup. Sin `novalidate`, el navegador
  bloqueaba el submit **antes** de que corriera la validación de `login.js`, y los
  mensajes de error nunca llegaban a mostrarse.
- El botón conserva el texto `ACCESO` porque `login.js:205` lo resetea a esa cadena
  tras cada intento.
- `login.css` pasa a enlazarse con cache-buster, como ya hacía `base.html`.

### Animación de pasos LDAP (`static/js/login-steps.js`) [NUEVO]

Cuatro pasos que avanzan durante la verificación (`UNIT = 450 ms`, o 50 ms con
`prefers-reduced-motion`). Es **decorativa**: el backend nunca ha reportado etapas
reales del bind LDAP. Cubre la espera real del AD en vez de fabricarla — el redirect
de `login.js` ocurre a los 500 ms y no es cancelable desde fuera.

Se engancha **sin tocar `login.js`**: un listener propio de `submit` más monkey-patch
de `showSuccess` / `showError` / `showAccessRequestModal`, invocando siempre el
original con `apply()`. Si el archivo no carga, el login funciona igual que antes.

🔑 **Hallazgo que evitó un bug visible:** `showError` y `showSuccess` **no son
exclusivas del login** — el flujo de solicitud de acceso las usa también
(`login.js:234/259/262/266`). Sin guarda, enviar una solicitud con éxito habría
pintado los 4 pasos en verde con «Sesión establecida», siendo que el usuario sigue sin
poder entrar. Se resuelve con dos estados distintos:

- `running` (login en curso) → gobierna `showSuccess`.
- `mounted` (pasos en pantalla) → gobierna `showError` y `showAccessRequestModal`. Más
  amplio a propósito: tras un login correcto `running` ya es `false` pero los checks
  verdes siguen visibles, y un error posterior debe retirarlos.

Verificado con 23 aserciones sobre 10 escenarios en DOM simulado.

### `install.bat` [NUEVO]

`run.bat` indicaba «ejecuta install.bat primero», pero **ese archivo no existía en el
repo**: una instalación nueva no tenía forma de crear los entornos virtuales ni los
`.env`. Cubre 6 pasos idempotentes: verificación de Python ≥3.12 y `uv`, creación de
`venv\`, instalación de `requirements-windows.txt`, `uv sync` en INGESTA y creación de
ambos `.env` desde sus plantillas.

No instala Python, `uv` ni bases de datos. Las migraciones quedan como paso manual
documentado: aplicarlas contra una BD de estado desconocido es destructivo, y el orden
correcto depende de si viene del backup o está vacía.

Complementa a `desplegar_version.bat`, que hace `git pull` y solo sirve para
**actualizar** una instalación ya montada.

---

## Motor Q v2 — los cuatro grupos de intención (2 – 4 de agosto)

**60 commits.** El bloque más denso del mes: el Motor Q v2 pasa de clasificador a
sistema que responde con cifras reales.

| Grupo | Qué responde | Commits clave |
|---|---|---|
| **Cuantificar** | Cifras: crudo, gas y blancos; mes, acumulado, serie mensual, variación, rankings top/bottom y vs PPTO | `f157a40`, `6d196ac`, `12144ad`, `fd3bda7`, `74c19e1` |
| **Jerarquizar** | Estructura: campos, activos, gerencias, pozos — desde la jerarquía de ROBUSTEZ | `cb12536`, `cb5eceb`, `7fa64fe`, `a0db67e` |
| **Analizar** | Causas: brechas, diferidas, mantenimientos, proyección de cierre y economía (EBITDA/NOPAT) | `8c08680`, `cb8e45b`, `829b2ce`, `a29e234` |
| **OUT** | Filtro de dominio: rechazo honesto redactado por LLM, con contexto reciente | `dc3429b`, `27a4900`, `3bbae0f`, `bf1eecd` |

Piezas transversales:

- **Clasificador de grupo** con libreta de veredictos y pestaña **Test Clas** para
  calificación rápida por lote (`1901da8`, `df39604`).
- **Memoria conversacional**: follow-ups con pronombre elidido, drills que no
  reescriben preguntas autocontenidas, y el hilo que sobrevive al cambio de mes
  (`d39821a`, `2e1b20a`, `dc25ee0`, `57cfa66`).
- 🔑 **El orden de los drills es la corrección**: el drill de REFERENCIA colisionaba
  con el de ACUMULADO (`268fe7c`), y `norm()` no retiraba `¿`/`?`, por lo que un token
  pegado al signo fallaba el match (`739ecd7`).
- **Warm-up del LLM** al arrancar el backend (`5a8515f`) y **precarga del reporte
  global desde el login** con caché anti-estampida (`bce37b2`).
- **RBAC de pestañas**: solo Javier Guerrero ve todas; el resto solo Consulta
  (`3c2785d`, `5dda9f2`).

---

## Paneles y gráficos del Motor Q v2 (11 – 12 de agosto)

**15 commits.** El panel derecho de Consulta deja de mostrar un resultado a la vez.

- **Pila acumulativa** de resultados: el Panorama general queda arriba y los resultados
  se apilan debajo, sin perder el panel al cambiar de pestaña mientras responde
  (`b0c4c8d`, `b77144a`, `d4116d0`, `7ae2ee0`).
- **Dot plot + dona de participación** para el ranking N5 de Cuantificar, con reparto
  50-50 y luego dona a tamaño pleno con leyenda al costado (`ff09a3d`, `0fd517f`,
  `5710e7e`, `440a2a4`).
- **Identidad de color por producto** (Crudo / Gas / Blancos) en todo el panel
  (`3d3f59e`, `39c854f`).
- **Árbol jerárquico** para JERARQUIZAR, apilado igual que Cuantificar (`7ed529a`).
- El ranking N5 responde **con la lectura, no con la tabla** (`f81ac59`, `43e350c`).

---

## P50, mantenimientos y diferidas (13 de agosto)

**9 commits.**

- El **P50 se pide como cifra, no como causa** — nueva sub-intención de referencia
  (`1872779`), con panel derecho por vicepresidencia (`582e163`).
- 🔑 **La hoja del P50 está en promedio DIARIO, no en la escala del fact** (`1446092`).
  Aplicarle la conversión de otra escala daba cifras mil veces menores **sin error
  visible**. Es el caso canónico de por qué cada producto necesita su propio
  formateador.
- El P50 por vicepresidencia **no debe anclarse al último reporte** (`dd8ffa2`).
- La pill **Mantenimientos** se conecta a `Eventos_OW.xlsx` real, no a un mock
  (`2f41928`); un mes fuera de rango devolvía HTTP 500 (`d6bfa4b`).

---

## Sesión del 24 de agosto — MainChat real, scroll de Insights y Jerarquizar rediseñado

**31 commits.** El día más denso del mes en número de commits, con tres hilos que
corren en paralelo: afinamiento del Motor Q v2 (Capa 1), la odisea del scroll del
panel Insights, y MainChat dejando de ser un cascarón para convertirse en la interfaz
real (portada, panel Historial, panorama solo-P50). Cierra con el rediseño del panel
Jerarquizar.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-24 | Motor Q v2 (Capa 1): formas causales coloquiales ("me pegó", "jalando"), y decisión de dominio — "qué/cuántos campos + situación medible" pasa a CUANTIFICAR. Golden set 75→92 casos (95%→96%) | `consulta_v2/config/patrones_grupo.yaml`, `config/vocabulario_dominio.yaml`, `golden/clasificacion_golden.yaml` |
| 2026-08-24 | Fix de "¿y eso por qué?" para continuar el análisis causal (cierra C1 del bloque Q1) — **revertido el mismo día** tras detectar un efecto secundario no deseado | `maquina_q.py`, `test_consulta_v2_clasificador.py` |
| 2026-08-24 | Botón «Correr golden» en Test Clas: el gate de calidad del clasificador (≥90% accuracy) se dispara desde la UI en vez de terminal | `consulta_v2/api.py`, `golden/run_golden.py`, `routes/api.py`, `mainchat_layout.html`, `colapsable.css` |
| 2026-08-24 | Motor Q v2 acepta la oferta de "acumulado" con una frase natural (antes exigía coincidencia casi literal) | `maquina_q.py`, `test_consulta_v2_clasificador.py` |
| 2026-08-24 | 🔑 Scroll del panel Insights: **5 iteraciones** hasta la causa real — un listener de scroll en `document` capturaba el auto-scroll del propio chat y abortaba la bajada del panel. Se resolvió midiendo la traza en la app real, no razonando sobre el archivo (lección documentada aparte) | `static/js/multitab_shell.js`, `static/css/colapsable.css` |
| 2026-08-24 | Burbuja de error visible cuando el Motor v2 falla — antes un "Desconocido" mudo (sin ✓/✗) disfrazaba una caída de INGESTA como si fuera una clasificación real | `static/js/multitab_shell.js` |
| 2026-08-24 | La respuesta del chat se revela línea por línea y palabra por palabra, con un piso de duración mínima (antes se notaba "casi instantánea") | `static/js/multitab_shell.js`, `static/css/colapsable.css` |
| 2026-08-24 | 🔑 Menú de usuario reubicado al pie del panel Historial — **2 intentos fallidos** por investigar el bug de anclaje ya conocido en vez de construir literalmente lo pedido; resuelto midiendo `getComputedStyle` (el contenedor computaba `display:block` pese a declarar `display:flex`) | `MainChat/static/js/historial.js`, `MainChat/static/css/historial.css`, `MainChat/static/js/mainchat.js`, `MainChat/templates/mainchat_layout.html` |
| 2026-08-24 | Lección aprendida documentada: medir el DOM real (`getComputedStyle`, trazas) antes de razonar sobre archivos CSS/JS — regla de alarma a los 2 intentos fallidos | `Planes/leccion_frontend_medir_antes_2026-08-24.md`, `SETUP_LOCAL.md` |
| 2026-08-24 | Login: el logo dice "ProdIA" (antes "PRODIA" en mayúsculas), título de pestaña actualizado | `templates/login.html` |
| 2026-08-24 | Panorama global de Consulta reducido a tarjetas P50 + saludo estático — se retira el panorama dinámico con LLM que mostraba "Consultando con la IA…" | `static/js/multitab_shell.js`, `static/css/colapsable.css`, `MainChat/templates/mainchat_layout.html`, `templates/main.html` |
| 2026-08-24 | Acceso a Test Clas desde el menú waffle de MainChat (antes solo existía en el shell viejo) | `MainChat/static/js/mainchat.js`, `MainChat/templates/mainchat_layout.html`, `static/js/multitab_shell.js`, `templates/main.html` |
| 2026-08-24 | Pantalla de bienvenida (portada) de MainChat: mascota + saludo centrados junto a la caja de entrada — **5 ajustes** de alineación/especificidad CSS hasta que "la portada ES el saludo" y no reaparece como burbuja al preguntar | `MainChat/static/css/acordeon.css`, `static/js/multitab_shell.js`, `MainChat/templates/mainchat_layout.html` |
| 2026-08-24 | **Panel Jerarquizar rediseñado**: árbol con conectores (rieles CSS, tile por nivel, badge CONSULTADO) reemplaza el listado plano con sangría inline. Verificado end-to-end contra la app real con datos reales de `core.map_campo_robustez` (Chichimene, GOR, Sierracol, GPA, Aguas Blancas): ruta, abanico, operador, campo de tercero, level-shift y truncado. Ajuste posterior: centrado horizontal y tipografía +10% | `static/js/multitab_shell.js`, `static/css/colapsable.css`, `MainChat/templates/mainchat_layout.html` |
| 2026-08-24 | Guía de arranque bajo las tarjetas P50 del panel Insights | `static/js/multitab_shell.js`, `static/css/colapsable.css`, `MainChat/templates/mainchat_layout.html` |
| 2026-08-24 | Auditoría de seguridad + hilo de preguntas de la tarjeta P50 (documentación, sin cambios de comportamiento) | `arq_log.md`, `hilo.md` |

**Plan de referencia del rediseño de Jerarquizar:**
`Planes/plan_jerarquia_arbol_conectores_2026-08-25.md` — incluye el payload real del
backend, los 4 campos que el diseño original (`jerarq_elem.md`, pensado para
React/TypeScript/Sass) no contemplaba (`puente`, `fuera_estructura`, `es_hermanos`,
`truncado`), y la verificación medida caso por caso.

---

## Sesión del 25 de agosto — CUANTIFICAR a grano día y vocabulario de arranque

**6 commits.** Una sola línea de trabajo: cerrar las brechas del grupo **Cuantificar**,
medidas contra el motor real. El punto de partida fue un análisis de 11 variaciones de
pregunta pedido por el usuario, que reveló que **solo 3 de las 11 funcionaban**: todo
Cuantificar colgaba de un único patrón interrogativo (`CUANT[OA]S?\b`, literalmente la
palabra "cuánto"). La sesión cierra las 8 restantes y añade el grano día.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **Vocabulario de jerarquía** — 4 formas naturales ("¿de qué campos cuelga?", "¿en qué VP está?", "desglósame X por campo", "¿a qué te refieres?") que caían a desconocido | `consulta_v2/config/patrones_grupo.yaml`, `test_consulta_v2_clasificador.py` |
| 2026-08-25 | 🔑 «¿De cuántos campos se compone el activo X?» devolvía **PRODUCCIÓN** (4.368.100 bbl) en vez del conteo. Corrige un error de planteamiento propio: se había ofrecido "cuantificar — solo el número" sin advertir que en este motor **cuantificar significa producción, no conteo** | `patrones_grupo.yaml`, `test_consulta_v2_clasificador.py` |
| 2026-08-25 | **Cierre de brechas de Cuantificar**: 8 formas de arranque que caían a desconocido — VOLUMEN, CERRÓ/QUEDÓ, imperativa ("dame el crudo de X"), telegráfica ("Producción Castilla ayer"), PRODUJO suelto, selector de día. Dos de ellas daban `nivel_dominio='fuerte'`: el motor **sabía** que la pregunta era suya y la descartaba igual | `patrones_grupo.yaml`, `no_soportado.py`, `respuesta_cuantificar.py`, `test_no_soportado.py`, `test_consulta_v2_clasificador.py` |
| 2026-08-25 | 🔑 **Error silencioso corregido**: "¿cuánto produjo Castilla **ayer**?" devolvía la cifra de **mayo completo** sin avisar (y "el 15 de mayo" devolvía también el mes). Es el bug #5 en su forma más peligrosa — el usuario nota un "no entendí", no nota que le dieron el mes cuando pidió un día | `no_soportado.py`, `respuesta_cuantificar.py`, `test_no_soportado.py` |
| 2026-08-25 | **«Castilla este mes» resolvía el campo CASTILLA ESTE** — un campo real del catálogo. `detectar_entidad` prueba n-gramas de mayor a menor, así que el bigrama ganaba y el demostrativo quedaba pegado al nombre. Medido: 5 campos expuestos (APIAY, CAÑO SUR, CASTILLA, REDONDO, TISQUIRAMA). NORTE/SUR quedan fuera de la guarda a propósito: nunca son demostrativos | `maquina_q.py`, `test_consulta_v2_clasificador.py` |
| 2026-08-25 | **Grano DÍA implementado** (N1D fecha puntual + N1DSEL mejor/peor día). Revierte la sobre-generalización del commit anterior: se había verificado que "ayer" no tiene dato y de ahí se concluyó, **sin comprobarlo**, que ninguna fecha era respondible | `analisis/api.py` (+90 líneas aditivas), `cuantificar/slots.py`, `cuantificar/ejecutor.py`, `cuantificar/validador.py`, `respuesta_cuantificar.py`, `static/js/multitab_shell.js`, `mainchat_layout.html`, `tests/test_cuantificar_dia.py` [NUEVO] |

### Grano día: por qué se responde «el 15 de mayo» pero se rechaza «ayer»

Tres hechos **medidos contra la BD**, no supuestos:

1. `core.fact_produccion_dia_ecp` **no tiene columna `escenario_id`** → a grano día solo
   existe REAL, jamás PPTO. Se comprobó además que `core.vw_proyeccion_diaria` (que sí
   trae `valor_programa`) solo cubre America/Hocol/Permian: **cero filas** para campos ECP.
2. El dato diario termina el **2026-05-17**; la fecha del sistema es 2026-08-25 → 100 días
   de desfase. "Ayer" no tiene dato — **pero el 15 de mayo sí** (223.752 bbl para Castilla).
3. `produccion_blancos.granos.dia` es `confianza: no` en el catálogo (×2 irreconciliable).

De las tres razones que se dieron para rechazar el grano día, **solo la 3 era realmente
bloqueante**. La 1 limita la *forma* de la respuesta (sin cumplimiento), no su existencia;
la 2 solo aplica a fechas relativas cercanas a hoy. El rechazo ahora **cita el techo real
consultado** ("el dato diario llega hasta el domingo 17 de mayo de 2026"), nunca una
constante ni un motivo genérico.

**Bloqueante evitado en la auditoría del plan:** el fork de RANKING (N5) usa el mismo
detector de formas no soportadas que la ruta de entidad, y es **mensual por construcción**
(`ranking.py::_fin_mes` sobre `fact_produccion_mes_ecp`). Quitar `dia` de un set único
habría hecho que «top 5 campos el 15 de mayo» devolviera el ranking del **mes entero** en
silencio — el bug #5 reintroducido por otra puerta. Se separó en dos sets
(`_FORMAS_RECHAZO` / `_FORMAS_RECHAZO_RANKING`).

**Dos bugs encontrados en la verificación posterior** (defectos del plan, no de la
ejecución): «el 31 de febrero» construía la fecha `2026-02-31` y lanzaba
`ValueError: day is out of range for month` — excepción **no capturada** que tumbaba la
respuesta entera; y al corregirlo, la rama de "día + mes" caía por descuido al regex de
día suelto y respondía sobre el **31 de mayo**, cambiando en silencio el mes que el usuario
nombró. Ambos cerrados con `_fecha_valida()` contra el calendario real y un `return`
explícito.

### En curso al cierre de la sesión (sin commitear)

**Panel «Comportamiento {Producto}» para las preguntas de grano día** — plan
`Planes/plan_panel_comportamiento_dia_2026-08-25.md`, implementado y con suite verde,
**pendiente de validación humana en navegador**. Conecta las preguntas N1D/N1DSEL al panel
de gauge + curva diaria, con una decisión explícita del usuario: *«si me preguntan por
mayo, gauge y gráfico muestran mayo — lo que se solicite»*, es decir el panel entero sigue
el periodo de la **pregunta**, no el último mes con datos.

Dos deudas conocidas, **ninguna bloqueante**, documentadas para no perderlas:

- `_panel_datos` sobrescribe la clave `nivel` (queda `"campo"` en vez de `"N1D"/"N1DSEL"`).
  Inofensivo hoy —el panel nuevo no lee ese campo—, pero deja inservible el fallback
  `__cnCuantDiaHtml`, que sí lo consulta para distinguir selector de fecha puntual.
- `__cnAnzCacheKey` no incluye `pulir`, así que un payload cacheado con `pulir=false`
  (sin pulido LLM) puede servirse al **Análisis Ejecutivo del tablero**, que sí renderiza
  `secciones`. Degradación cosmética e intermitente.

---

## Sesión del 25 de agosto (tarde) — Resiliencia del Motor v2 e ingesta de agosto

**1 commit** (`39eacc0`) + diagnóstico de infraestructura. Dos líneas de trabajo disparadas
por incidentes reales del usuario: un timeout del chat y la carga de reportes pendientes.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **La pregunta ya no se pierde en un timeout.** El chat mostraba *«la pregunta no se perdió»* mientras `inp.value = ""` la borraba antes del fetch y no la restauraba: el usuario tenía que reescribirla. Se repone en el input **solo** en la rama de fallo real, con guarda `if (!inp.value)` para no pisar lo que se haya escrito durante los 90 s de espera | `static/js/multitab_shell.js`, `templates/main.html` (cache-buster) |
| 2026-08-25 | **Reenvíos concurrentes bloqueados** con flag de módulo `__cnEnVuelo` + `.finally()`. NO se usa `btn.disabled`: la pestaña se remonta y recrea `#cn-send-btn`, y el `onkeydown` Enter de `#cn-input` llama a `__cnPreguntar()` directo, esquivando el `disabled`. Importa porque **Ollama serializa las inferencias del mismo modelo**: cada reenvío impaciente empeoraba la cola que causó el timeout | `static/js/multitab_shell.js` |
| 2026-08-25 | **Detalle técnico crudo fuera del chat.** El usuario veía `HTTPConnectionPool(host='localhost', port=8088): Read timed out` — el `repr` de una excepción de `urllib3`, que además filtra infraestructura. Ahora va a `console.error`; se conserva en pantalla **solo** en Test Clas (3er parámetro `mostrarDetalle`), que es donde el diagnóstico es la función del panel | `static/js/multitab_shell.js` |
| 2026-08-25 | **Observabilidad del timeout**: `logger.error` con duración y tipo de excepción en el proxy. **Sin el body** — lleva la pregunta de negocio y el usuario, y `api_bp` no tiene control de sesión (`arq_log.md` H-01, crítico) | `routes/api.py` |

### Por qué NO se tocó `timeout=90` (decisión explícita del usuario)

El diagnóstico midió que **el presupuesto interno de INGESTA iguala o supera el del proxy**:

| Etapa | Timeout |
|---|---|
| Capa 2 del clasificador (`clasificador_llm.py:53`) | 30 s |
| Bucle de intro ×2 (`respuesta_cuantificar.py:66-71`) | 60 s |
| **Total ruta cuantificar** | **90 s exactos**, sin contar SQL |

Se evaluó bajarlo a 45 s. Se descartó: **no haría que las preguntas lentas respondan, solo
que fallen antes**, y alejaría todavía más el fallback determinista D4 —que sí entrega una
respuesta útil— de llegar a tiempo. El valor original entró en `1901da8` **sin justificación
documentada** en el mensaje, `arq_log.md`, `docs/` ni bitácoras.

Tampoco se añadió reintento con backoff (el patrón ya existe en `chat.js:1542-1572`):
duplicaría la carga sobre un Ollama que ya serializa. Queda condicionado a medir primero.

### Causa raíz del timeout — pendiente de medir en el 139

Dos candidatos, con arreglos **opuestos**; sin medición sería adivinar:

1. **Modelo en frío (~342 s medidos**, `warmup.py:1-10`). `config.py:45-52` describe el
   síntoma textualmente: si una petición real no reafirma `keep_alive=-1`, Ollama descarga
   gemma tras 5 min y *«la siguiente petición vuelve a pagar el frío»*.
2. **`p50_por_vp` sin acotar por `reporte_id`** (`p50_referencia.py:106-108`): **62 M filas,
   >120 s medidos**. La pregunta del incidente («¿a qué se debe la baja…?») es literal de
   `_CAUSAL_EXPL` y cae en la rama causal, la más cara del motor.

### Ingesta de agosto — 19 reportes, 0 bloqueados por seguridad

Se verificó la carpeta `OneDrive_2_25-8-2026` (19 `.xlsm`, del 1 al 20 de agosto, **falta
el 09**) por tres vías independientes: firma de bytes, contenido interno del ZIP, y el script
oficial `ingesta_lote_139.py --dry-run`. Resultado: **19 ingeribles, 0 cifrados con IRM** —
a diferencia de julio, cuando 22 de 29 venían protegidos (`OCR_REPORTES_CIFRADOS.md`).
Parece que el generador del reporte ya los entrega sin restricción: el workaround OCR no
hace falta.

**Prueba de ingesta real** de un archivo (13-ago) con rollback: 337.827 filas escritas en
las 10 tablas del modelo, `nivel_detalle=FULL`, `tiene_raw=True`. Los archivos son válidos.

🔑 **Hallazgo de infraestructura — corrupción física en la BD local.** La ingesta fallaba con
`psycopg.errors.DataCorrupted: invalid page in block 19727`. Un escaneo completo de `bronze`
y `core` encontró **dos relaciones dañadas**:

| Relación | Tipo | Tamaño | Estado |
|---|---|---|---|
| `bronze.idx_landing_payload` | índice GIN | 192 MB | **Reparado** — `DROP` + `CREATE`, filenode nuevo 184015 |
| `core.fact_tabla_hoja` | **tabla** | **41 GB** | **Sin reparar** — falla en 7 de 9 rangos sondeados; ni `count(*)` responde |

Causa raíz en los eventos de Windows: `disk` ID 51 (*«Error detectado en el dispositivo
\Device\Harddisk1\DR1 durante una operación de paginación»*, ×11) el 23-ago, `Ntfs` ID 55
el 23 y 24-ago, y **apagado inesperado** el 24-ago 18:54. Es decir: **disco con errores de
E/S**, no un problema del ETL. Cualquier reconstrucción sobre el mismo hardware puede volver
a corromperse.

**Lección de método:** dos intentos de `REINDEX` reportaron OK **sin aplicarse** — se usó
`raw_connection()` con autocommit y el cambio no persistía (el filenode seguía siendo 62471).
Solo funcionó con `engine.begin()`. Un "OK" del motor no prueba que el cambio se escribió:
hay que verificar el efecto (aquí, que el filenode cambiara).

**Los datos de agosto están en el 139, no en local.** Esta copia local quedó congelada en
`2026-05-18` (última ingesta el 7 de julio). El proyecto paralelo `12112025_prodIA_v02`
apunta a `10.100.26.139` en su `.env` y desde allí se lanzó la carga de los 19.

---

## Sesión del 25 de agosto (noche) — Diseño del panel «Comportamiento {Producto}»

**0 commits de código.** Sesión de diseño: se especifica un panel nuevo a partir de una
captura del panel de Focos de atención. No se toca `multitab_shell.js`; el entregable es una
maqueta HTML validada en navegador, un plan de implementación y la decisión de alcance. El
disparador —el grupo de preguntas que invoca el panel— queda **por definir** con el usuario.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **Panel nuevo «Comportamiento {Producto}», especificado y maquetado.** Variante autónoma del foco ECP: **sin** las 4 pestañas (`__CP_TABS`), **sin** cabecera de producto ni widget de alcance, **sin** rank ni badge de faltante, y con **2 gráficos en vez de 3** —gauge PPTO + curva diaria, fuera el gap por campo. Reutiliza `__cnTarjetasKpiHtml` y `__cnDailyInto` sin modificarlos. Maqueta con los 3 productos (crudo/gas/blancos) publicada como Artifact | `~/.claude/plans/identificas-este-panel-autogenerado-floating-abelson.md` [NUEVO], Artifact `63d65a61` |
| 2026-08-25 | 🔑 **El layout costó 8 iteraciones a ciegas y se resolvió en 1 midiendo.** La tarjeta KPI medía **336 px dentro de una fila de 300**: `height:100%` no comprime un contenido que no cabe, lo desborda —por eso terminaba siempre más abajo que el gráfico. Y el anillo, «centrado» en su bloque (29/29), estaba **18 px sobre el centro de la tarjeta**, porque el pie pesa más que la cabecera. Ambas causas eran invisibles leyendo el CSS | — (diagnóstico) |
| 2026-08-25 | **Reglas de layout que quedan documentadas**: `min-height:0` en toda la cadena flex (sin él un hijo no cede por debajo de su contenido); **una sola** altura declarada en el grid (`grid-auto-rows`), nunca una por columna —que cada una fijara la suya era lo que las desalineaba; `flex:0 0 auto` en cabecera y pie del KPI para que solo el bloque central ceda | plan de implementación |
| 2026-08-25 | **El gráfico llena la tarjeta con `preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`.** Se probó antes recalcular coordenadas y proporciones del `viewBox` —callejón sin salida—; el estirado del lienzo era la respuesta de una línea. Los rótulos de eje van en **HTML, no en `<text>`**: dentro del SVG estirado el texto rotado se deforma y desborda | maqueta |
| 2026-08-25 | **Eje Y con techo = máximo de la serie + 35%** y ambos ejes rotulados con su unidad (`bbl/día` · `MSCF/día`), que hoy no existen en `__cnDailyPlot`. La escala **no se comparte entre productos**: 39.420 en crudo, 59.265 en gas, 4.576 en blancos —una común aplastaría blancos contra el suelo | plan (afecta a `__cnDailyPlot`) |
| 2026-08-25 | 🔑 **Producto y estado son dos paletas independientes.** Gas sale rojo por identidad de producto (`__CP_PROD`) y rojo por estado «Actuar» (`__CP_STATUS`): coincidencia, no la misma causa. La maqueta las mantiene en tokens separados para no inducir el error al implementar | maqueta, plan |
| 2026-08-25 | **Método de depuración de CSS incorporado**: instrumentar la página con `getBoundingClientRect()` volcado a `document.title` y leerlo con `chrome --headless --dump-dom`, más `--screenshot` para verlo. Verificado el resultado final: desnivel 0 px, anillo 29/29, gráfico ≥95% del ancho | memoria de proyecto |

### Alcance explícito

Lo que **no** se tocó, por decisión: `__cnFocosHtml` y sus dos call sites quedan byte-idénticos
—el panel de Focos sigue con sus 4 pestañas y sus 3 bloques—; tampoco `__CP_TABS`,
`__cnFocoTab`, los dos pintores ni `__cnGapCampoInto`. Sin cambios en INGESTA ni en el proxy:
el panel nuevo consume los endpoints existentes `/api/analisis/ejecutivo` y
`/api/analisis/desempeno`, filtrados por producto.

**Contrato que hay que respetar al implementar:** conservar `f.rank` y el patrón de ID
`cn-foco-day-{rank}{sufijo}` aunque el número ya no se muestre —es la clave con la que
`__cnPaintFocoStk`/`__cnPaintFocoCharts` y la cola `data-pend-paint` de `acordeon.js` localizan
el contenedor—, y emitir el panel con `class="cp-foco__panel is-active"`: sin pestañas nadie
dispara el resize y Plotly pintaría sobre un contenedor de altura cero.

---

## Sesión del 25 de agosto (noche, 2ª parte) — El panel de día se implementa y deja de ir lento

**4 commits** (`3610a72`, `a5e3668`, `4813f44`, `eee07ab`). El panel diseñado en la sesión
anterior se implementa, pero **no** con el `panel.tipo` genérico que preveía el plan: el
disparador que quedaba «por definir» se resolvió por la ruta de **grano día** de `consulta_v2`.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **Panel «Comportamiento {Producto}» implementado** (`__cnCompProdHtml`, `__cnCompProdCargar`, `__cnCompProdMarcarDia`): gauge PPTO + curva diaria, sin las 4 pestañas ni el gap por campo. Se emite con `is-active` porque sin pestañas nadie dispara el resize y Plotly pintaría sobre altura cero | `static/js/multitab_shell.js`, `static/css/colapsable.css` |
| 2026-08-25 | 🔑 **El insight tardaba minutos en renderizar: la caché del proxy se partía en dos.** La clave incluía el parámetro `pulir`, así que un mismo payload generaba **dos entradas distintas** y el panel nunca reutilizaba la del tablero —ni el single-flight las agrupaba—. Se excluye `pulir` de la clave; y una respuesta **sin pulir no sobrescribe** la entrada compartida, porque solo afecta al texto de `secciones`, no a las figuras | `routes/api.py` |
| 2026-08-25 | **Limpieza y rótulos de la curva**: fuera la leyenda «trace 0» y el pie de gráfico; techo del eje Y a **máximo + 35%** y títulos con unidad en ambos ejes. Aplicado con **parámetros opcionales** (`holgura`, `ejes`) sobre `__cnDailyPlot`, que es compartido: el panel de Focos queda intacto | `static/js/multitab_shell.js` |
| 2026-08-25 | ⚠️ **Casi rompo `__cnFilialSerieInto` con un `replace` global.** Sustituir `margin: {...}` por `margin: mrg` alcanzó **dos** sitios, no uno: el segundo se quedaba con una variable inexistente (`ReferenceError`). Detectado con `grep -n "mrg"` **antes** del commit y revertido a literal | `static/js/multitab_shell.js` (detectado, no llegó a commit) |

---

## Sesión del 25 de agosto (cierre) — Navegación: módulos en el waffle y salida de cada vista

**1 commit** (`5fb11cf`). Se abre el acceso a módulos que existían pero eran inalcanzables
desde la UI: 4 de las 5 pestañas del shell y la vista `/layout/colapsable`, que **no tenía un
solo enlace en toda la app**. Ejecutado en dos fases con validación en navegador entre ambas.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **Fase 1 · Consulta y Análisis al waffle.** Se añaden como tarjetas `data-tab` —el mismo mecanismo de Test Clas—, así que abren la pestaña **in-situ sin navegar**: el estado del shell (pila del Motor Q v2, análisis cargados) sobrevive. Iconos tomados de `TABS` para que waffle y rail no diverjan | `MainChat/templates/mainchat_layout.html` |
| 2026-08-25 | **Guarda real para `data-tab` inválidos**: `tabExiste()`. La guarda `if (!tabDef(tabId))` de `__rbAbrirTab` era **inalcanzable** —`tabDef` cae a `TABS[0]`, nunca a falsy—, así que un typo abría Ingesta en silencio. Ahora devuelve `false` y `mainchat.js` emite su `console.warn`, que hasta hoy era código muerto | `static/js/multitab_shell.js` |
| 2026-08-25 | **Rejilla del waffle adaptativa y con scroll.** `repeat(4, 1fr)` fijo dejaba filas cojas al pasar de 4 tarjetas → `auto-fit`. Y `.mc-menu` no tenía `max-height` ni `overflow`: al crecer **desbordaba el viewport sin scroll**, porque `situar()` lo topa en `MARGEN=8` sin límite de alto → `max-height: calc(100vh - 16px)` | `MainChat/static/css/mainchat.css` |
| 2026-08-25 | **Fase 2 · Navegación entre las 3 vistas HTML.** Parcial único `components/nav_modulos.html` incluido desde el `{% block sidebar %}` que las 3 plantillas heredan de `base.html`; `request.path` marca la activa sin JS. Antes no existía forma de volver al chat principal desde ninguna otra vista | `templates/components/nav_modulos.html` [NUEVO], `templates/components/sidebar.html`, `Colapsable/templates/colapsable_layout.html`, `static/css/style.css` |
| 2026-08-25 | **Retiradas Admin / Configuración / Ayuda del waffle**: apuntaban a `/admin`, `/settings` y `/help`, que **no existen** (grep: cero rutas). El JS hacía `console.info` en vez de navegar, fingiendo que estaban activas. En su lugar entran **Clásico** y **Colapsable** con `url_for`, y la rama `data-ruta` pasa a navegar de verdad | `MainChat/templates/mainchat_layout.html`, `MainChat/static/js/mainchat.js` |

### 🔑 Dos hallazgos de auditoría que cambiaron el plan

**H-01 — `tabDef` no podía devolver `null`.** El plan inicial proponía justo eso para activar la
guarda. El grep exhaustivo encontró **4 llamadores y 3 desreferencian `.icon`/`.label` sin
protección** (`:351`, `:502`, `:633`): el cambio habría lanzado `TypeError` con la app rota al
arrancar. Se añadió `tabExiste()` **aparte**, con cero impacto en los otros llamadores. Sin build
ni tests de frontend que lo taparan, habría llegado directo a producción.

**El sidebar está oculto por CSS en `/mainchat`.** Al ejecutar la Fase 2 se descubrió que
`mainchat.css:17-21` oculta `.sidebar` con `!important` siempre que existe `.mc-shell` —o sea,
siempre en esa vista—. El parcial de navegación habría quedado **en el DOM pero invisible**: sin
error de Jinja, sin error de consola, fallando solo la prueba visual. Por eso en `/mainchat` la
navegación vive en el **waffle** y no en el sidebar; en `/` y `/layout/colapsable`, al revés.

### Restricciones que condicionan el diseño

- **Toda tarjeta que pueda ser pestaña, debe serlo**: navegar destruye el estado del shell
  (`mount()` resetea la pila), y por eso Consulta/Análisis van con `data-tab` y no como ruta.
- **Ingesta y Control quedan fuera del waffle**: `/mainchat` no carga `chat.js` a propósito
  (4.794 líneas), así que esas dos pestañas se ven pero **no responden**. Añadirlas sería exponer
  módulos muertos.
- **Sin control de roles**: `@login_required` es autenticación, no autorización, y la insignia
  `ADMIN` del menú es **texto fijo que ve todo usuario**. Si Admin llega a existir, necesita roles
  construidos desde cero. Deuda registrada.

### Validación (medida en navegador, no supuesta)

Con ambos backends arriba y Edge headless midiendo el DOM real (`getBoundingClientRect`):
6 tarjetas sin desbordar a 1366×768 y 1280×720; el marcador inyectado en `#cn-stack` sobrevive
al ciclo Consulta→Análisis→Consulta (prueba de que **no** se pierde estado); `data-tab` alterado
a un id inexistente no cambia de pestaña y emite el `warn`; cadena de navegación real
`/` → `/layout/colapsable` → `/mainchat` → `/` completada por clics, con `is-active` correcto en
las tres y **0 errores JS** en las 4 cargas encadenadas.

---

## Estructura actual del proyecto

*Sección de estado — se REEMPLAZA en cada actualización (a diferencia de las secciones
fechadas de arriba, que son histórico y no se tocan). Última actualización: 2026-08-26 (3ª parte).*

Tras los cambios de agosto, así queda ProdIA 2.0:

```
ProdIA-2.0/
├── app.py                      Flask factory · SocketIO · puerto 8020
├── install.bat                 prepara el entorno desde cero
├── run.bat / iniciar_backends.bat / desplegar_version.bat
├── requirements-windows.txt
├── SETUP_LOCAL.md               [NUEVO 24-ago] entorno de desarrollo local + procedimiento
│                                 de depuración con Edge headless (medir DOM real, no suponer)
│                                 [25-ago noche] variante con Chrome: instrumentar la página
│                                 con getBoundingClientRect() → document.title y leerlo con
│                                 `chrome --headless --dump-dom`; `--screenshot` para verlo
│
├── routes/                     Blueprints Flask
│   ├── main.py                 vistas principales
│   ├── auth.py                 login LDAP · SSO por token · lista blanca · solicitud de acceso
│   ├── chat.py                 chat del asistente (SocketIO)
│   ├── api.py                  proxy hacia el backend FastAPI de INGESTA
│   │                            [24-ago] + proxy GET /consulta2/golden (botón «Correr golden»)
│   │                            [25-ago] reenvía `pulir` a /analisis/ejecutivo — sin él
│   │                            INGESTA dispara el pulido LLM de Gemma (~180s)
│   │                            [25-ago pm] logger.error en el timeout de /consulta2/preguntar
│   │                            (duración + tipo de excepción, NUNCA el body: lleva la
│   │                            pregunta y el usuario, y api_bp no exige sesión)
│   │                            [25-ago noche] `pulir` FUERA de la clave de caché (partía
│   │                            en dos entradas el mismo payload y el panel de día no
│   │                            reusaba la del tablero); una respuesta sin pulir no
│   │                            sobrescribe la compartida
│   │                            [26-ago 3ª] + proxy GET /reportes/ultimo — badge "Act:
│   │                            <fecha>" del header de Insights (mismo patrón simple que
│   │                            /analisis/catalogo, sin caché TTL)
│   ├── colapsable.py           paneles colapsables
│   └── mainchat.py             blueprint de /mainchat
│
├── templates/
│   ├── base.html               layout de la app (sidebar, chat, analytics)
│   ├── main.html               vista principal (layout viejo) · arranca en Consulta
│   ├── login.html              grid de 2 columnas · logo "ProdIA" [corregido 24-ago]
│   │                            [26-ago 3ª] panel izquierdo: constelación neuronal SVG+SMIL
│   │                            (13 nodos, 18 aristas) reemplaza el degradado verde —
│   │                            adaptado de log_in.md (React/Sass) al stack real
│   └── components/
│       ├── nav_modulos.html    [NUEVO 25-ago cierre] navegación entre las 3 vistas HTML.
│       │                        Se incluye desde el {% block sidebar %} que las 3 plantillas
│       │                        heredan de base.html; request.path marca la activa sin JS.
│       │                        NO aplica a /mainchat: ahí .sidebar está oculto por CSS
│       ├── sidebar.html        historial + estado + usuario · [25-ago cierre] incluye
│       │                        nav_modulos al inicio (lo hereda `/`)
│       └── chat.html · analytics.html
│
├── static/
│   ├── css/                    style · colapsable · enhanced-tables · ingesta
│   │   ├── style.css           layout clásico · [25-ago cierre] .nav-modulos / __item /
│   │   │                        .is-active — estilos del parcial de navegación
│   │   ├── colapsable.css      shell de pestañas + panel Insights (prefijo cn-/jq-/rb-cp)
│   │   │                        [24-ago] .jq-* — árbol de Jerarquizar con conectores
│   │   │                        [25-ago noche] .cn-compprod__grid — 30fr/70fr del panel
│   │   │                        «Comportamiento {Producto}»
│   │   └── login.css           tokens Ecopetrol + pasos LDAP
│   │                            [26-ago 3ª] .brand-panel a flex (centra la constelación en
│   │                            las 2 direcciones) · .lg-constellation max-width 400→560px
│   └── js/
│       ├── multitab_shell.js   shell de pestañas (Ingesta/Control/Análisis/Consulta/Test Clas)
│       │                        [24-ago] árbol Jerarquizar, revelado palabra por palabra,
│       │                        burbuja de error del Motor v2, botón golden, guía de arranque
│       │                        [25-ago pm] resiliencia del timeout: la pregunta vuelve al
│       │                        input, flag __cnEnVuelo (no btn.disabled — el Enter lo
│       │                        esquiva y la pestaña recrea el botón), detalle técnico a
│       │                        consola salvo en Test Clas (__cnErrorV2 3er parámetro)
│       │                        [25-ago noche] __cnCompProdHtml / __cnCompProdCargar /
│       │                        __cnCompProdMarcarDia — panel «Comportamiento {Producto}»
│       │                        (2 gráficos, sin pestañas). IMPLEMENTADO en 3610a72
│       │                        [25-ago cierre] tabExiste() — comprobación de existencia
│       │                        APARTE de tabDef(), que nunca devuelve falsy (cae a TABS[0]
│       │                        y 3 llamadores hacen def.icon/.label sin guarda)
│       │                        [26-ago] __cnSerieMesPlot / __cnVarWaterfallSVG — paneles
│       │                        de N3/N4; el waterfall MIDE su lienzo (viewBox = caja, sin
│       │                        las bandas muertas del preserveAspectRatio fijo)
│       │                        [26-ago 2ª] __cnDifPanelHtml / __cnDifPanelCargar — panel
│       │                        "analiza_dif"; REUSA __cnDiferidasInto (un solo camino de
│       │                        pintado, misma caché por ámbito)
│       │                        [26-ago 2ª] __cnEbitdaInto manda year/month (data-per-eb):
│       │                        sin ellos el motor caía al último mes de PRODUCCIÓN y esta
│       │                        pestaña contestaba un mes distinto al resto de la respuesta
│       │                        [26-ago 2ª] __cnErrorV2 recibe los segundos medidos en el
│       │                        cliente — el mensaje ya no afirma "tardó" ante un fallo
│       │                        instantáneo, y la traza (NN s · HTTP NNN) se ve en Consulta
│       │                        [26-ago 3ª] __cnEsPanoramaTxt/__cnEsBloque3Txt — atajos
│       │                        "bloque 2"/"bloque 3" en __cnPreguntar(), antes del
│       │                        clasificador · __cnHistSeed — 8 plantillas de arranque en
│       │                        el desplegable, siempre visibles bajo el historial real ·
│       │                        position:relative restaurado en .chat-input-container
│       │                        (acordeon.css:211-215 pisaba el sticky con static)
│       ├── chat.js · main.js · panels.js · charts.js
│       ├── login.js            ⚠️ pipeline de auth — NO se modifica
│       └── login-steps.js      animación decorativa, se engancha desde fuera
│
├── MainChat/                   módulo autónomo — [24-ago] pasa de cascarón a UI REAL
│   ├── templates/mainchat_layout.html   monta multitab_shell.js dentro de sí misma
│   │                                     [25-ago cierre] waffle con 5 accesos; su
│   │                                     {% block sidebar %} queda vacío A PROPÓSITO
│   └── static/
│       ├── css/mainchat.css             navbar, menú waffle
│       │                                 ⚠️ :17-21 oculta .sidebar con !important siempre
│       │                                 que hay .mc-shell — por eso la navegación de esta
│       │                                 vista va en el waffle y no en el sidebar
│       │                                 [25-ago cierre] rejilla auto-fit + max-height/scroll
│       ├── css/acordeon.css             [24-ago] portada de bienvenida (mascota + saludo)
│       │                                 [26-ago 3ª] .mc-act-badge — badge "Act:" del
│       │                                 header de Insights, misma pastilla que .mc-num
│       ├── css/historial.css            [24-ago] panel Historial + pie con menú de usuario
│       │                                 [26-ago 3ª] margin-top:auto movido a
│       │                                 .mc-hist__pie-grupo (agrupa Estado+usuario);
│       │                                 justify-content:center en ambas secciones
│       ├── js/mainchat.js               menú de usuario · accesos del waffle
│       │                                 [25-ago cierre] data-ruta navega de verdad
│       ├── js/acordeon.js               3 paneles colapsables: Chat · Insights · Historial
│       │                                 [26-ago 3ª] badge "Act: <fecha>" en la cabecera
│       │                                 de Insights — fetch a /api/reportes/ultimo,
│       │                                 cacheado en memoria (_actPromise)
│       └── js/historial.js              [24-ago] acordeón de conversaciones + pie de usuario
│                                          [26-ago 3ª] limpiarViewer() también llama a
│                                          __cnVolverPanorama() (antes solo vaciaba #cn-stack,
│                                          "Nuevo chat" dejaba Focos de atención pegado) ·
│                                          pieGrupo() envuelve Estado del sistema + usuario
│
├── INGESTA/Rep_Prod/           sub-proyecto FastAPI (puerto 8088, gestionado con uv)
│   ├── backend/app/features/
│   │   ├── consulta_v2/        Motor Q v2 — los 4 grupos de intención
│   │   │   ├── maquina_q.py            drills de continuación (memoria conversacional)
│   │   │   │                    [25-ago] guarda del demostrativo en detectar_entidad
│   │   │   │                    («Castilla este mes» ya no resuelve CASTILLA ESTE)
│   │   │   ├── respuesta_jerarquizar.py   árbol/operador/ranking — fuente: robustez
│   │   │   ├── respuesta_cuantificar.py   [25-ago] 2 sets de rechazo (entidad vs ranking);
│   │   │   │                    panel de grano día con periodo y día a marcar
│   │   │   │                    [26-ago] fallback GLOBAL: sin entidad responde toda ECP
│   │   │   ├── respuesta_analizar.py   causal · proyeccion · diferidas · economia ·
│   │   │   │                    referencia (sub-router determinista, sin LLM)
│   │   │   │                    [26-ago 2ª] 🔑 el PERIODO de la pregunta llega al ejecutivo
│   │   │   │                    Y al panel (antes periodo=None fijo → siempre el mes
│   │   │   │                    vigente, sin declararlo). Si no se puede honrar, se avisa
│   │   │   │                    ANTES de las cifras · panel "analiza_dif" en `diferidas`
│   │   │   ├── warmup.py        warm-up al arrancar, en hilos daemon best-effort
│   │   │   │                    warmup_llm (gemma, ~342 s en frío) +
│   │   │   │                    [26-ago 2ª] warmup_diferidas — precalienta los 2 scans de
│   │   │   │                    AVM_DATADIF que `causal` paga en cada arranque
│   │   │   ├── no_soportado.py  [25-ago] formas `dia` y `selector_dia` + guarda H4
│   │   │   │                    («acumulado hasta hoy» es N2, no un día suelto)
│   │   │   ├── cuantificar/     [25-ago] GRANO DÍA — slots.detectar_dia (módulo PURO: el
│   │   │   │                    techo entra por parámetro) · ejecutor.ejecutar_n1d /
│   │   │   │                    ejecutar_n1dsel · validador con rama N1D antes de N1
│   │   │   │                    [26-ago] N1DSER (serie diaria de un mes) · selector
│   │   │   │                    min/max por ventana · _mes_nombrado por TOKEN
│   │   │   │                    [26-ago 2ª] slots.periodo_texto() PÚBLICO — el detector de
│   │   │   │                    periodo lo comparten cuantificar y analizar. También pasa
│   │   │   │                    a match por token: "mayo" es substring de "mayor" y
│   │   │   │                    "producción de MAYOR volumen" resolvía al mes de mayo
│   │   │   ├── config/patrones_grupo.yaml · vocabulario_dominio.yaml
│   │   │   │                    [25-ago] vocabulario de arranque de cuantificar (VOLUMEN,
│   │   │   │                    CERRÓ/QUEDÓ, imperativa, telegráfica, PRODUJO, selector)
│   │   │   └── golden/          [24-ago] run_golden.py con ejecutar() reusable (UI + CLI);
│   │   │                         clasificacion_golden.yaml — 92 casos, gate ≥90%
│   │   ├── analisis/           9 endpoints · ejecutivo · desempeño · president
│   │   │                        [25-ago] +3 helpers de grano día AISLADOS (techo_dia,
│   │   │                        produccion_dia, curva_dia_mes) — reusan _ambito, NO tocan
│   │   │                        desempeno (mismo criterio que escenario_mes, AF-4.2)
│   │   ├── ingesta/            ETL de .xlsm · 17 extractores
│   │   ├── tablas/ · reportes/ · kpis_prod/ · ebitda/
│   │   │                    [26-ago 3ª] reportes/api.py: + GET /ultimo (MAX(fecha_reporte)
│   │   │                    de core.config_reporte) — badge "Act:" del header de Insights
│   │   └── consulta/           v1 — congelada desde 2026-07-30
│   ├── db/migrations/          001 → 010
│   └── frontend/               React (no desplegado)
│
├── chatbot/                    asistente clásico · agentes SQL · SQLite ECP_PROD.db
├── data/
│   ├── bitacora/               Cambios_Marzo · Cambios_Julio · Cambios_Agosto (este archivo)
│   └── ...                     BD y corpus (excluidos de git)
├── Planes/                     planes ejecutables por tarea (uno por feature/fix)
│                                 [24-ago] leccion_frontend_medir_antes, plan_jerarquia_arbol_conectores
├── INGESTA/Rep_Prod/Planes/    planes del backend
│                                 [25-ago] plan_cuantificar_grano_dia, plan_panel_comportamiento_dia
└── docs/ROUTING_ARCHITECTURE.md
```

### Dos interfaces de chat en paralelo

Desde el 21 de agosto conviven dos layouts que montan el **mismo** `multitab_shell.js`:

| | `/` (`templates/main.html`) | `/mainchat` (`MainChat/`) |
|---|---|---|
| Estado | Layout original | **[24-ago] Interfaz real** — ya no es un cascarón |
| Paneles | Un solo cuerpo | 3 acordeones: **Chat** · **Insights** · **Historial** |
| Bienvenida | Saludo en burbuja | **Portada**: mascota + saludo centrados junto a la caja de entrada |
| Menú de usuario | Navbar superior | Al **pie** del panel Historial (`historial.js::bloqueUsuario`) |
| Revelado de respuesta | Aparece completo | Palabra por palabra, con piso de duración mínima |

Ambos comparten `multitab_shell.js`/`colapsable.css` — un fix ahí (p. ej. el árbol de
Jerarquizar) se ve en las dos, salvo que dependa de markup exclusivo de un layout.

### Navegación entre módulos (25-ago cierre)

Tres vistas HTML, cada una con salida hacia las otras dos. **Dos mecanismos distintos** según
dónde se pueda pintar el control:

| Vista | Dónde vive la navegación | Por qué |
|---|---|---|
| `/` (clásico) | Sidebar — `components/nav_modulos.html` | Hereda el bloque de `base.html` |
| `/layout/colapsable` | Ídem | Ídem |
| `/mainchat` | **Waffle** (`#mc-menu`) | Su `.sidebar` está oculto con `!important` por `mainchat.css:17-21` mientras exista `.mc-shell` |

**Accesos del waffle** (5, tras retirar los 3 muertos):

| Tarjeta | Atributo | Efecto |
|---|---|---|
| Test Clas · Consulta · Análisis | `data-tab` | Abre la pestaña **in-situ**, sin navegar → **no se pierde el estado** del shell |
| Clásico · Colapsable | `data-ruta` | Navega de verdad (`window.location.href`) — al ser páginas distintas, **sí** se descarta la pila de Consulta |

🔑 **Ingesta y Control no están en el waffle** y es deliberado: `/mainchat` no carga `chat.js`,
así que esas pestañas se ven pero no responden. Exponerlas sería ofrecer módulos muertos.

⚠️ **El panel de BD (pestaña Control) tiene un gate solo de frontend**: `__cnSoloConsulta()`
(`multitab_shell.js:38-42`) fuerza la pestaña Consulta para todo usuario cuyo `USER_FULL_NAME`
no sea exactamente «javier guerrero», dejando Control inalcanzable para el resto. Los endpoints
`/api/tablas-hoja/*` **no comprueban identidad**, así que no es un control de acceso real.

### Motor Q v2 — estado del clasificador (25-ago)

- **Golden set**: 92 casos, **96%** de accuracy (gate: ≥90%). Corrible desde Test Clas
  con el botón «Correr golden» o por CLI (`run_golden.py`).
- **Suite de pruebas**: **502 pasan** · 10 fallan. Los 10 son **preexistentes y ajenos**:
  7 de siempre + 3 de `test_cuantificar_ranking.py` que comparan rankings **hardcodeados**
  contra la BD en vivo (el top 1 pasó de RUBIALES a TERECAY) — deriva de datos del entorno
  compartido, no regresión. Verificado con `git stash` sobre el árbol limpio.
- **Grupos**: Jerarquizar (árbol con conectores) · Cuantificar (KPI, serie, variación,
  ranking dot-plot+dona, **[25-ago] grano día**) · Analizar (foco causal) · Desconocido.
- **Capa 1** (regex) resuelve la mayoría de los casos sin depender de Ollama; **Capa 2**
  (LLM) solo interviene en la franja estructural ambigua — ver `SETUP_LOCAL.md` para
  cómo se degrada sin LLM local.

### Cuantificar — niveles temporales (25-ago)

| Nivel | Qué responde | Fuente |
|---|---|---|
| **N1** | mes puntual, REAL vs referencia | `fact_produccion_mes_ecp` |
| **N2** | acumulado del año (meses cerrados) | idem |
| **N3 / N4** | serie mensual · variación mes a mes | idem |
| **N5** | ranking de entidades (top/bottom) | idem — **mensual por construcción** |
| **N1D** ⬅ nuevo | producción REAL de **una fecha** | `fact_produccion_dia_ecp` |
| **N1DSEL** ⬅ nuevo | **mejor/peor día** dentro de un mes (argmax sobre la curva) | idem |

🔑 N1D/N1DSEL **no llevan cumplimiento**: a grano día no existe presupuesto en la BD y
está **prohibido fabricarlo** — la respuesta lo declara explícitamente. Es también la razón
por la que el panel de día no reusa la tarjeta KPI (que gira sobre el anillo REAL/PPTO).

### Paneles autogenerados del análisis (25-ago noche · ampliado 26-ago)

Todos se construyen en cliente por concatenación de HTML en `static/js/multitab_shell.js`
(no hay render server-side) y se alimentan de `/api/analisis/ejecutivo` +
`/api/analisis/desempeno` vía el proxy con caché de `routes/api.py`.

| Panel | Función | Contenido | Estado |
|---|---|---|---|
| **Focos de atención** | `__cnFocosHtml` (:3959) | Tarjeta por producto con 4 pestañas —Comportamiento diario, Diferidas, Mantenimientos, EBITDA-NOPAT— y 3 bloques en la primera: gauge PPTO, curva diaria y gap por campo | En producción · tablero (`__cnRenderEjecutivo`) y pila de chat (`__cnAnzCargarFoco`) |
| **Comportamiento {Producto}** | `__cnCompProdHtml` · `__cnCompProdCargar` · `__cnCompProdMarcarDia` | Panel autónomo: gauge PPTO + curva diaria. Sin pestañas, sin cabecera, sin gap por campo. Título y unidad dinámicos por producto | **En producción** (`3610a72`) · lo dispara la ruta de **grano día** de `consulta_v2`, no un `panel.tipo` genérico · **(26-ago)** sin la tarjeta KPI, que repetía la cifra que ya da el texto |
| **Serie mensual / Variación** | `__cnSerieMesPlot` · `__cnVarWaterfallSVG` | N3 pinta la curva mensual con Plotly; N4 un waterfall SVG hecho a mano (verde/rojo por signo, anclas en el color del producto). Antes eran tablas de texto | **En producción** (26-ago) · `panel.tipo` = `cuant_serie` / `cuant_var` |
| **Diferidas** | `__cnDifPanelHtml` → `__cnDiferidasInto` | Pérdida por causa (NV04) + comportamiento por tipo 2023/24/25. El mismo render que la pestaña del acordeón — no un gemelo | **En producción** (26-ago 2ª) · `panel.tipo` = `analiza_dif` |

🔑 El `rank` del ECP **no ordena por impacto** pese al rótulo «rankeados por impacto»: el
orden es fijo por producto (`_ORDEN = ["CRUDO","GAS","BLANCOS"]`, `analisis/api.py:1491`).
Se calcula un `score = abs(faltante)` que no se usa para reordenar. Solo la variante de
filiales (`_focos_filiales`) sí ordena por score. Deuda conocida, no corregida.

🔑 **Dos paletas que no deben mezclarse**: identidad de PRODUCTO (`__CP_PROD` — crudo
`#004236`, gas `#EF4444`, blancos `#EAB308`) y ESTADO de cumplimiento (`__CP_STATUS` —
ajustado `#E8912B`, actuar `#C5311E`). Que gas salga rojo por ambas vías es coincidencia.

### Dos backends, dos bases de datos

| Servicio | Puerto | Stack | Base de datos |
|---|---|---|---|
| ProdIA (Flask) | 8020 | Flask + SocketIO + Jinja | SQL Server / Azure Synapse (`pyodbc`) · SQLite `ECP_PROD.db` |
| INGESTA | 8088 | FastAPI + SQLAlchemy | PostgreSQL `daily_report_prod` (`psycopg`) |

Cada uno tiene su propio `.env` y su propio gestor de dependencias (`pip` con `venv\`
para Flask; `uv` con `.venv\` para INGESTA). No se mezclan. Entorno de desarrollo local
completo (ambos backends + Postgres local, sin depender del servidor de pruebas) en
`SETUP_LOCAL.md`.

### Ingesta de reportes diarios — cómo se carga y dónde (25-ago)

**Carga por consola, no interactiva** — recibe la carpeta como argumento, recorre en orden
cronológico, descarta por firma de bytes los cifrados con IRM, y es resiliente (un archivo
con error no tumba el lote). **Idempotente**: upsert «última gana» por `fecha_reporte`, así
que reprocesar lo ya cargado no duplica.

```
cd INGESTA/Rep_Prod/backend
.\.venv\Scripts\python.exe ingesta_lote_139.py "<carpeta>"          # carga
.\.venv\Scripts\python.exe ingesta_lote_139.py "<carpeta>" --dry-run # solo clasifica
```

| Aspecto | Detalle |
|---|---|
| Registro maestro | `core.config_reporte` — dedup por `fecha_reporte` (UNIQUE), **no** por hash |
| Fecha del reporte | primeros 8 dígitos del nombre (`20260813_Reporte…xlsm`) |
| Ruta de la API/UI | `data_dir` de settings (`GET /ingesta/disponibles`); el script de lote **no** la usa |
| Detección de IRM | firma de 4 bytes: `50 4B 03 04` = OOXML libre · `D0 CF 11 E0` = OLE2/IRM |
| Destino | **el que diga `DATABASE_URL`** del `.env` de cada copia del proyecto |

⚠️ **Dos copias del proyecto con destinos distintos**: `12112025_prodIA` (esta) apunta a
`localhost`; `12112025_prodIA_v02` apunta a `10.100.26.139`. La carga de agosto se hizo
contra el **139** — la BD local sigue congelada en `2026-05-18` (última ingesta 7-jul).

⚠️ **BD local con corrupción física pendiente** (25-ago): `core.fact_tabla_hoja` (41 GB)
falla con `DataCorrupted` en 7 de 9 rangos; ni `count(*)` responde. `bronze.idx_landing_payload`
ya fue reparado. Origen: errores de disco (`disk` ID 51) y apagado inesperado el 23–24 de
agosto — **no** es un fallo del ETL. Revisar SMART antes de confiar en esta copia local.

---

## Sesión del 25 de agosto (noche) — El asistente responde sobre sí mismo

**3 commits** (`0a968a1`, `6a049d9`, `d88fee5`). «¿Cuál es tu finalidad?» y «hola» caían en
la rama OUT y el LLM las redactaba con la orden literal de decir que el tema «se sale del
contexto de este asistente» — el motor le decía a quien preguntaba qué sabe hacer que su
pregunta era ajena. Mismo bug de trato que ya había motivado `incompleta.py`: la
clasificación `desconocido` era correcta, lo que fallaba era la respuesta.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **`capacidades.py`** — cuarto detector determinista de la familia (`dominio.py` / `no_soportado.py` / `incompleta.py`): reconoce preguntas sobre el propio asistente y saludos, y responde con un inventario fijo de los tres frentes (estructura, cifras, análisis) con ejemplos tecleables. Determinista, nunca por el LLM — un modelo pequeño prometería capacidades que `no_soportado.py` niega al turno siguiente | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/capacidades.py` [NUEVO], `maquina_q.py`, `tests/test_capacidades.py` [NUEVO] |
| 2026-08-25 | 🔑 **Guarda en `_continuacion`**: con contexto vivo, «¿cuál es tu finalidad?» y «cuáles son tus capacidades» (`CUAL` ∈ `_ESTRUCT_KW`) y «para qué sirves» (`A QUE` ⊂ «p**ARA QUÉ**») se reescribían a `"que es {entidad}"` y devolvían la ficha jerárquica de un campo en vez del inventario | `maquina_q.py` |
| 2026-08-25 | La respuesta pasa de párrafo corrido a **lista con negrita** por frente, usando el marcador `⟦…⟧` que el propio motor ya convierte a `<strong>` — no markdown, el mensaje se escapa antes de pintarse | `capacidades.py`, `tests/test_capacidades.py` |
| 2026-08-25 | Regex ampliado tras verlo fallar en la app: «ayuda»/«help» sueltos, familia «qué temas…», y «qué **más** puedes hacer» (el `MAS` intermedio rompía la secuencia) | `capacidades.py`, `tests/test_capacidades.py` |

---

## Sesión del 25 de agosto (noche) — Hilo tipo timeline en el chat de Consulta (CN-HILO-D)

**6 commits** (`7093712`, `200453b`, `1f31c1d`, `a04bda5`, `9f5d670`, `1b0d6a2`). Reemplaza
las burbujas asimétricas por un hilo de una sola columna con riel vertical, avatar, nombre
y hora por turno. **El NLP, el enrutado y los endpoints no cambian: solo la capa de
render.** Diseño de origen: `chat_n.md` — artboard «D · Hilo con timeline», traducido de su
stack original (React 19 + TS) a Flask + JS vanilla ES5 sin build step.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **`__cnAppendRaw` pinta `.cn-row`** (riel + cabecera de autor + `.cn-bubble`); el riel que une turnos es un `::after` anulado en `:last-child` — ningún append repinta la fila anterior. La hora se sella al **crear** el turno y viaja en `__cnHistory` (calcularla al pintar daría la hora del repintado de `__cnReplay`) | `static/js/multitab_shell.js`, `static/css/colapsable.css` |
| 2026-08-25 | Los badges «Motor v2» / grupo / vía salen de la vista del usuario; el grupo sobrevive como **filete lateral de color** + `title`. Nunca fondo: el tono suave de «cuantificar» es el mismo `#E9F3EC` que `--rb-user-bg` y confundiría la burbuja del bot con la del usuario | `static/css/colapsable.css` |
| 2026-08-25 | 🔑 **Dos arreglos de la auditoría previa**: `__cnSaludoRefresh` machacaba la primera pregunta del usuario (guarda `length !== 1` obsoleta desde que el saludo dejó de sembrarse el 24-ago); y `#cn-messages` pasa a `role="log" aria-live="polite"` con `aria-busy` durante el revelado — sin él, un lector de pantalla anunciaría la respuesta entera decenas de veces | `static/js/multitab_shell.js` |
| 2026-08-25 | El autor de las respuestas pasa a llamarse **«ProdIA»**, no «Asistente» | `static/js/multitab_shell.js` |
| 2026-08-25 | Ajustes de legibilidad tras verlo en pantalla: el riel no se veía y la respuesta no heredaba el interlineado del globo; globos +25% y +2px de interlineado; la fuente baja 2px conservando el interlineado; el filete de color del clasificador sube de 3px a 6px (a 3px se leía pero no saltaba a la vista) | `static/css/colapsable.css` |

---

## Sesión del 25 de agosto (noche) — El riel de análisis pasa a un botón con popover (CN-WAFFLE)

**1 commit** (`9d21fea`). En la pestaña Consulta, el riel de 158px con las 2 tarjetas de
análisis (Desempeño del mes / Desempeño Filiales) pasa a un botón compacto con icono
waffle que abre un popover — clon del patrón del waffle de usuario (`MainChat/mainchat.js`)
que ya resolvía el recorte por `overflow` de la cadena de ancestros del panel. Los ~130px
recuperados van a los gráficos.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **`.cn-rail` → botón `.cn-anbtn` + popover `.cn-anpop`**, montado en `document.body` (el markup de Consulta se regenera con `innerHTML` al volver a la pestaña y destruiría un popover que viviera dentro). `position:fixed`, no `absolute`: la cadena de ancestros del panel tiene varios `overflow:hidden` | `static/js/multitab_shell.js`, `static/css/colapsable.css` |
| 2026-08-25 | Los 5 sitios que repintaban el riel (4 vía `el("cn-rail").innerHTML=…` + 1 mutando `.is-active` a mano) se centralizan en `__cnRailSync()` — evita que el estado activo se desincronice entre el botón y la rejilla | `static/js/multitab_shell.js` |
| 2026-08-25 | `unmount()` desmonta el popover explícitamente: como vive en `body`, el `innerHTML=""` del contenedor del shell no lo alcanza y quedaría flotando sobre la app al salir | `static/js/multitab_shell.js` |

---

## Sesión del 25 de agosto (noche) — Cuatro fallos de grano día y de hilo conversacional (QV2-HILO-DIA)

**1 commit** (`afc28a4`). Cuatro comportamientos reportados por el usuario en vivo:
un día puntual devolvía la cifra de otro mes sin avisar del cambio, una repregunta de día
negaba una capacidad que sí existe, un mes inexistente (`diciembre→13`), y el hilo se
perdía al cambiar de mes tras ver una cifra mensual («los periodos de tiempo no están
dentro de mi dominio»). Auditado en tres pasadas — la última **durante la propia
ejecución**: encontró una tercera rama preexistente (el «Drill N1 genérico» del
2026-08-02) que reproducía el mismo secuestro de `_continuacion` por una vía distinta a
las dos ya corregidas.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | Corrección de los cuatro fallos de grano día (fecha puntual, repregunta, mes inexistente) y del hilo conversacional al cambiar de mes | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/maquina_q.py`, `cuantificar/slots.py` |
| 2026-08-25 | Cobertura de test ampliada para los cuatro casos | `INGESTA/Rep_Prod/backend/tests/test_cuantificar.py`, `tests/test_cuantificar_dia.py` |

192 tests pasan (`test_cuantificar`, `test_cuantificar_dia`, `test_consulta_v2_clasificador`).
El único rojo es preexistente y ajeno a este cambio (`test_escalada_fallback_conserva_regex`,
desde un commit del 2026-08-24 — precedencia de patrones `analizar`/`cuantificar`).

---

## Sesión del 25 de agosto (noche) — Mapa de pozos sobre Colombia en Jerarquizar (QV2-MAPA)

**1 commit** (`e29377f`). El panel de las preguntas de estructura organizacional
(«¿qué es CASTILLA?») pasa de mostrar solo el árbol a mostrar **árbol a la izquierda +
mapa de pozos sobre Colombia a la derecha**, según maqueta aprobada por el usuario y
verificada con Chrome headless antes de implementar.

**Dos hallazgos sobre `robustez_v02` que cambiaron el diseño antes de escribir código:**
`ops.wells_attributes` tiene **grano de zona, no de pozo** (40.542 filas ÷ 13.504 UWI =
exactamente 3,0 — un pozo con 3 zonas productoras da 3 filas idénticas salvo la columna
`zone`), y trae la **latitud y la longitud invertidas** respecto a `ops.field_polygons`
(medido: 25.920 de 26.041 filas, cero en el orden esperado). Sin corregir ambas cosas, los
conteos salen inflados ×3 y los pozos aparecen en el océano Índico.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-25 | **`pozos_geo.py`** — único sitio donde se corrige la coordenada (`DISTINCT ON (uwi)` + inversión lat/lon + filtro del bounding box de Colombia) y se calculan los centroides de los 62 campos con 5+ pozos ubicables | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/pozos_geo.py` [NUEVO] |
| 2026-08-25 | **`geo_colombia.py`** — contorno simplificado del país (108 vértices), servido desde el backend para poder cambiarlo sin tocar el frontend | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/geo_colombia.py` [NUEVO] |
| 2026-08-25 | **`rob_fields_de()`** expone la resolución de jerarquía → campos ECP que ya construía `_cargar()`, para que el mapa use la misma jerarquía que el árbol y las dos vistas no puedan divergir | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/respuesta_jerarquizar.py` |
| 2026-08-25 | **Endpoint `GET /consulta2/pozos_geo`** (INGESTA) — puntos ya corregidos y deduplicados, contornos, centroides país y el contorno de Colombia | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/api.py` |
| 2026-08-25 | 🔑 **Proxy de Flask** — sin esto el `fetch` del navegador daba 404: Flask no tiene catch-all para `/api/consulta2/*`, cada ruta se declara una por una | `routes/api.py` |
| 2026-08-25 | Módulo de mapa en Canvas (no Plotly, por volumen de puntos): zoom/pan **por nodo** — varios paneles en la pila mantienen su propio encuadre. Abre centrado y acercado (320%) sobre el campo consultado; solo se rotula ese campo; el panel mide exactamente el alto del árbol | `static/js/multitab_shell.js`, `static/css/colapsable.css` |

⚠️ **Deuda anotada, no corregida en este cambio**: `LA CIRA` e `INFANTAS` caen en el
departamento equivocado (Orinoquía en vez de Magdalena Medio) — la BD trae esas
coordenadas así, y un mapa les da una autoridad visual que no tenían como scatter suelto.
Verificar contra la fuente antes de publicar el panel a usuarios. Tampoco se colorea el
pozo por estado operativo: 3.780 UWI aparecen activos en una zona e inactivos en otra, y
decidir qué estado gana es una regla de negocio pendiente de acordar, no de este cambio.

Verificado por HTTP contra los dos backends (INGESTA `:8088` + proxy Flask `:8020`):
CHICHIMENE 213/212 pozos con contorno de 104 vértices, CASTILLA 437/423 sin contorno, PPC
(gerencia) agrega 766/738 entre sus campos — cifras idénticas al pie del árbol existente.
Pendiente de validación en navegador (feature visual e interactiva).

---

## Sesión del 26 de agosto — pulido medido en vivo + rendimiento

**6 commits.** Todos disparados por capturas de pantalla del usuario probando la app real
(mapa de pozos, respuestas de grano día, "Focos de atención") — cada uno se diagnosticó
midiendo contra la app corriendo (Edge headless o el endpoint real), no se adivinó.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-26 | El mapa de pozos de Jerarquizar dejaba un **hueco muerto bajo el árbol**: el `<canvas>` con `height:100%` dentro de un contenedor de alto indefinido caía a su ratio intrínseco 2:1 y aportaba un alto fantasma que `align-items:stretch` usaba para estirar el árbol. Se saca el canvas del flujo (`position:absolute`); medido antes/después con Edge headless: 36px de hueco → 0px | `static/css/colapsable.css` |
| 2026-08-26 | El título del mapa ya no dice **"· sin contorno"** cuando el campo no tiene polígono — no se destaca lo que falta si nadie lo pidió (mismo criterio que el punto siguiente) | `static/js/multitab_shell.js` |
| 2026-08-26 | Toda respuesta de producción a grano día (N1D/N1DSEL) anunciaba, sin que se preguntara, que **"no hay presupuesto diario"** — pero esa respuesta nunca ofrece cumplimiento en primer lugar. Se retira el aviso | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/cuantificar/ejecutor.py`, `.../tests/test_cuantificar_dia.py` |
| 2026-08-26 | **"La producción del mes"** (sin nombrar cuál) perdía el hilo: tras resolver un día puntual de mayo, la siguiente pregunta genérica por "el mes" asumía el mes de HOY en vez de mayo. Se guarda el mes de la última respuesta sin ambigüedad (`periodo_ctx`) y se hereda si la frase no nombra su propio mes ni pide "este mes" explícito | `INGESTA/Rep_Prod/backend/app/features/consulta_v2/maquina_q.py`, `.../tests/test_cuantificar.py` |
| 2026-08-26 | Desplegable **"Preguntas de esta conversación"** junto al input del chat — clic rellena el input sin enviar. Desarrollado por otro agente en paralelo, integrado y commiteado en esta sesión | `static/js/multitab_shell.js`, `MainChat/templates/mainchat_layout.html`, `templates/main.html` |
| 2026-08-26 | Diferidas/Mantenimientos/EBITDA-NOPAT del panel "Focos de atención" pasan de carga perezosa (arrancaba el fetch recién al hacer clic en la pestaña) a **precarga en paralelo** apenas se pinta la tarjeta — el clic ya encuentra la caché tibia o a medio camino, nunca fría | `static/js/multitab_shell.js` |

Verificación: suite de pytest completa (534→580 passed a lo largo de la sesión, mismos 10
fallos preexistentes de siempre, 0 nuevos) + gate del clasificador dorado (92%, ≥90%) +
medición directa con Edge headless contra la app real para los dos cambios de CSS/layout.

---

## Sesión del 26 de agosto (2ª parte) — El periodo de la pregunta y los paneles que faltaban

**6 commits.** Dos hilos: paneles que ya existían pero a los que ninguna pregunta llegaba, y
un fallo de fondo — Analizar era **ciego al mes**.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-26 | **Panel de Diferidas al preguntar directo por causas.** El panel (pérdida por causa NV04 + comportamiento por tipo) existía solo como pestaña del acordeón de foco de `causal`: preguntar «¿cuáles son las causas de las diferidas de Akacias?» devolvía texto y nada más. Nuevo tipo `analiza_dif` que viaja con el SCOPE, no con los datos — el frontend reusa `__cnDiferidasInto` tal cual (misma caché, mismo render) y de paso obtiene la tendencia 2023/24/25, que `impacto_historico` ni calcula. Sin datos NO abre panel: un bloque para repetir «no tengo la base» es ruido | `consulta_v2/respuesta_analizar.py`, `static/js/multitab_shell.js`, `tests/test_analizar.py` |
| 2026-08-26 | **Warm-up de las cachés de diferidas al arrancar.** `causal` llama siempre a `split_planeado()` + `impacto_historico()`; sin entidad el filtro queda en `WHERE 1=1` = **dos scans completos** de `AVM_DATADIF` (1,14 M filas, BD de ~954 MB) dentro de la petición del usuario. Se pagan ahora en un hilo daemon al arrancar, con el mismo contrato del warm-up de gemma (best-effort, `CONSULTA_WARMUP`). Hilo APARTE del ping del LLM: ese tarda ~342 s en frío y encadenarlos dejaría la BD fría hasta entonces | `consulta_v2/warmup.py`, `backend/app/main.py` |
| 2026-08-26 | **El waterfall de variación mes a mes mide su lienzo.** Iba a 880×430 fijo con `preserveAspectRatio="meet"`: en una tarjeta de ~3:1 el factor limitante era el alto y el dibujo salía a ~695 px dentro de ~1045, con **175 px muertos a cada lado**. Con el viewBox medido contra la caja la escala queda 1:1 — barras de 44→67 px (+52%) y texto a tamaño nominal. Se evaluó y **descartó** subir el máximo del eje Y un 30%: las anclas ya ocupan el 97% del alto útil, así que hundiría las barras en vez de centrarlas | `static/js/multitab_shell.js` |
| 2026-08-26 | 🔑 **La burbuja de fallo dice cuánto tardó y con qué código.** El mensaje afirmaba SIEMPRE «el Motor v2 tardó más de lo previsto», también cuando el fallo era instantáneo — los tres casos (`!res.ok`, `d.error`, 200 sin `grupo`) entran por la misma puerta. Eso mandó un diagnóstico entero por el camino equivocado. Ahora el cliente cronometra y la burbuja muestra «cortó a los NN s · HTTP NNN». Se mide en el CLIENTE porque el log de Flask solo se escribe si el corte lo dio SU timeout de 90 s: si algo aguas arriba corta antes, ese log nunca aparece | `static/js/multitab_shell.js` |
| 2026-08-26 | 🔑 **El mes de la pregunta deja de ignorarse en silencio.** «Analiza el crudo para el mes de mayo» respondía AGOSTO y lo rotulaba «Agosto 2026» sin decir que había descartado el mes pedido — `periodo=None` fijo en las 3 llamadas al ejecutivo y en el panel. Estaba escrito a propósito y declarado como fase pendiente (RA-3); para quien pregunta era una respuesta equivocada dada con seguridad. Toda la maquinaria existía (el endpoint acepta `periodo` desde siempre, el detector vive en `cuantificar/slots`): nadie los había conectado. Si el periodo no se puede honrar, se dice ANTES de las cifras | `consulta_v2/respuesta_analizar.py`, `consulta_v2/cuantificar/slots.py`, `tests/test_analizar.py` |
| 2026-08-26 | **El waterfall de EBITDA respeta el mes.** Tras lo anterior el texto y el acordeón ya iban a mayo, pero esta pestaña seguía en agosto: su QS llevaba solo `nivel` y `entidad`, así que el motor caía a `_ultimo_mes_prodia()`. Y agosto **no tiene economía** (cargada hasta julio) → anunciaba «sin economía para este mes» sobre un mes que nadie pidió, cuando mayo sí la tiene. Se reusa `mttoPer`, el mismo ISO `YYYY-MM` que ya recibía Mantenimientos | `static/js/multitab_shell.js` |
| 2026-08-26 | De agentes en paralelo, integrados y publicados en esta sesión: plantillas de arranque en el desplegable de preguntas (8 ejemplos con «…» cuando el chat está vacío), badge «Act: \<fecha\>» en el header de Insights, pie anclado que agrupa Estado del sistema + usuario en MainChat, y constelación neuronal animada en el login | `static/js/multitab_shell.js`, `MainChat/*`, `templates/login.html` |

### Un bug de substring corregido al reusar el detector

`slots._periodo_texto` buscaba el mes por **substring**: con `m in t`, «mayo» es substring de
«mayor», así que *«la producción de MAYOR volumen»* devolvía `"mayo"`. Es el mismo fallo que
`_mes_nombrado` recibió el 25-ago y que aquí había quedado pendiente y documentado.

Conectarlo a Analizar tal cual habría **importado el bug** a un segundo consumidor. Se corrigió
primero (match por token, `\b`) y se expuso como `periodo_texto()` público para que Analizar lo
reuse en vez de copiarlo: dos gemelos fue exactamente lo que hizo que este mismo bug viviera en
dos sitios a la vez.

### Verificación

Detector de periodo y lógica del aviso: **17/17 casos** medidos en este equipo, incluidas las
cuatro trampas (`mayor volumen`, `día de mayor producción`, `setiembre` vs `Septiembre`, meta
ilegible). Las pruebas nuevas de `test_analizar.py` (9 en total: 4 del panel de diferidas, 5 del
periodo) NO se corrieron en dev — no hay pytest instalado y `resolver_unico` toca la BD; van al
servidor de pruebas, como el resto del archivo.

### Pendiente al cierre — el fallo «SIN RESPUESTA» sigue abierto

La primera pregunta tras cada reinicio sigue cayendo. El warm-up de diferidas era una hipótesis
razonada, **no medida**, y no bastó. La instrumentación del punto 4 existe precisamente para
cerrar el diagnóstico con datos en la próxima reproducción:

| Traza que muestre la burbuja | Qué significa |
|---|---|
| ~90 s · HTTP 502 | el corte lo dio el proxy Flask; el warm-up no alcanzó |
| ~60 s · HTTP 504 | hay un corte de nginx/gunicorn delante — el log de Flask nunca se escribe |
| pocos segundos | no es tiempo: el motor devolvió un error y hay que leerlo |

Los timestamps de las capturas del usuario (05:13→05:14, 04:31→04:32) apuntan más a ~60 s que a
los 90 s del proxy, que es lo que motivó instrumentar en vez de seguir suponiendo.

### Hallazgo no corregido

`PLATA` está en el léxico de economía del sub-router y se busca por **substring**, así que
**«plataforma» dispara EBITDA**: *«¿qué diferidas hubo en la plataforma norte?»* se va a
rentabilidad. Es vocabulario operativo común (plataforma, taladro, workover), no un caso raro.
Mismo patrón que los dos bugs de substring ya corregidos, en un tercer sitio.

---

## Sesión del 26 de agosto (3ª parte) — Atajos de panorama, "Nuevo chat", y rediseño del login

**11 commits.** Sesión disparada por interacción directa del usuario probando el chat de
Consulta en vivo (dos preguntas "claras" que declinaban y una tercera, más indirecta, que sí
respondía) y por un documento de diseño (`log_in.md`) para reemplazar el panel verde del
login. Diagnóstico previo a cada cambio: la clasificación de Cuantificar/Analizar se rastreó
contra `patrones_grupo.yaml` línea por línea antes de tocar código, y el layout del login se
auditó contra `acordeon.css`/`style.css` completos (no solo el archivo que se iba a tocar)
tras un primer intento que dejó el desplegable de preguntas invisible.

| Fecha | Cambio | Archivos afectados |
|---|---|---|
| 2026-08-26 | **Atajo "bloque 2" / "panorama general"**: preguntas genéricas en el chat repintan las 3 tarjetas P50 por el mismo camino que el botón "Volver al panorama" — sin pasar por el clasificador, instantáneo | `static/js/multitab_shell.js`, `MainChat/templates/mainchat_layout.html`, `templates/main.html` |
| 2026-08-26 | **Atajo "bloque 3" / "focos de atención"**: reactiva bajo demanda el bloque que `panorama_global_solo_p50` omite por defecto (puede invocar a Gemma) llamando directo a `__cnAnalisisEjecutivo(null)`, con aviso explícito de que puede tardar | `static/js/multitab_shell.js` |
| 2026-08-26 | 🔑 **"Nuevo chat" dejaba el bloque de arriba sin reiniciar.** `limpiarViewer()` solo vaciaba la pila de respuestas (`#cn-stack`); si la conversación anterior había pintado Focos de atención (p. ej. con "bloque 3"), esa vista sobrevivía al chat nuevo. Ahora también llama a `__cnVolverPanorama()` | `MainChat/static/js/historial.js` |
| 2026-08-26 | Desplegable de preguntas: **8 plantillas de arranque siempre visibles al final de la lista** (antes desaparecían en cuanto había historial real — "una fuente u otra"; ahora coexisten, historial real arriba, sugeridas siempre abajo) | `static/js/multitab_shell.js` |
| 2026-08-26 | 🔑 **El desplegable de preguntas se renderizaba fuera de la vista.** `acordeon.css:211-215` (`#mc-chat-body .chat-input-container { position: static }`) le gana por especificidad al `position:sticky` de `style.css` en el contexto de MainChat — sin ancestro posicionado, `bottom:100%` se calculaba contra otro elemento. Se restaura `position:relative` inline, que no reintroduce el problema que `static` evitaba (el auto-anclaje de `sticky` al scroll, algo que `relative` no hace) | `static/js/multitab_shell.js` |
| 2026-08-26 | Panel Historial de MainChat: **"Estado del sistema" + el bloque de usuario se agrupan en un solo pie anclado al fondo** (`margin-top:auto` movido del antiguo `.mc-hist__pie` a un nuevo `.mc-hist__pie-grupo` que envuelve a ambos) — antes "Estado" quedaba fijo justo debajo de la lista, con una franja vacía hasta el login. Contenido de las dos secciones centrado horizontalmente | `MainChat/static/js/historial.js`, `MainChat/static/css/historial.css` |
| 2026-08-26 | **Badge "Act: `<fecha>`"** en el header del panel Insights — fecha del reporte más reciente cargado en la BD (`MAX(fecha_reporte)` de `core.config_reporte`), cacheada en memoria (una sola petición aunque el header se reconstruya varias veces al colapsar/expandir) | `INGESTA/Rep_Prod/backend/app/features/reportes/api.py`, `routes/api.py`, `MainChat/static/js/acordeon.js`, `MainChat/static/css/acordeon.css` |
| 2026-08-26 | **Login: constelación neuronal animada** reemplaza el degradado verde del panel izquierdo — SVG inline + SMIL (señales viajando por las aristas, halos que respiran, puntos que laten, desfasados por índice), adaptado de `log_in.md` (escrito para React 19 + TS + Sass) al stack real de ProdIA (Jinja2 + CSS plano, sin build step). 12 nodos y 16 aristas iniciales, coordenadas y timings exactos del documento | `templates/login.html`, `static/css/login.css` |
| 2026-08-26 | Login: la constelación se agranda (`max-width` 400→560px) y se centra en las **dos** direcciones (`.brand-panel` pasa a `display:flex` en vez de `top:44px` fijo) tras revisión visual del usuario | `static/css/login.css` |
| 2026-08-26 | Login: **+1 nodo** (13 en total, 18 aristas) a petición del usuario — "10% más de nodos" sobre los 12 originales, ubicado en la esquina superior-izquierda (la zona más vacía del `viewBox`) y conectado a los nodos 0 y 1 | `templates/login.html` |
| 2026-08-26 | Ajuste cosmético menor: el ícono de historial del chat se corre 3px a la izquierda dentro del `input-group` | `static/js/multitab_shell.js` |

### Hallazgo diagnosticado, resuelto por otra vía en la misma sesión

Antes del bloque de arriba se diagnosticó por qué "Analiza el comportamiento de la
producción de crudo…" y "cómo ha sido la producción de crudo…" declinaban con "no
identifiqué una entidad" mientras "¿a qué se debe el gap de producción de crudo?" sí
respondía: el patrón anclado `PRODUCCION DE` enruta las dos primeras a **Cuantificar**, que
exige una entidad del catálogo (campo/activo/gerencia) sin fallback global; la tercera
colisiona además con `GAP\b`/`A QUE SE DEBE` de **Analizar**, que sí construye un análisis
GLOBAL ECP sin entidad (RA-2). El hallazgo no se implementó en este bloque — lo resolvió un
agente en paralelo el mismo 26-ago: `205dccc` (Cuantificar responde toda ECP sin entidad,
QV2-GLOBAL) y `7de92d3` ("Analiza el comportamiento…" enruta a Analizar, no a Cuantificar).

### Verificación

Los 3 cambios de CSS/layout (posicionamiento del desplegable, pie agrupado de Historial,
centrado de la constelación) se diagnosticaron leyendo la cadena completa de selectores en
`acordeon.css`/`historial.css`/`style.css` — no se pudo levantar un navegador automatizado en
este equipo (sin `chromium-cli` ni `node`, y el login exige sesión), así que la verificación
visual final quedó pendiente de confirmación del usuario en cada caso, con la causa raíz ya
identificada por lectura de código antes de proponer el fix.

---

## Estado actual — funcionalidades del clasificador y del chat (26-ago)

### Los cuatro detectores deterministas de la rama OUT

Cuando el Motor Q v2 clasifica `desconocido`, cuatro módulos puros (sin BD, sin LLM)
deciden el mensaje **antes** de escalar al LLM — el orden importa, cada uno cede al
siguiente si no aplica:

| # | Módulo | Pregunta que responde | Ejemplo |
|---|---|---|---|
| 1 | `capacidades.py` ⬅ nuevo | ¿pregunta por mí mismo? | «¿qué puedes hacer?», «hola» |
| 2 | `no_soportado.py` | ¿está construido? | «¿cuánto produjo en el primer trimestre?» |
| 3 | `incompleta.py` | ¿está completa la frase? | «sí muéstrame» |
| 4 | `respuesta_out.py` | (resto) redactado por el LLM, con frontera dura | «¿cuál es la capital de Francia?» |

### El chat de Consulta — hilo tipo timeline

Las burbujas asimétricas de antes del 25-ago se reemplazaron por un **hilo de una
columna**: riel vertical que une los turnos, avatar + nombre («ProdIA») + hora por turno,
y el grupo del clasificador como filete lateral de color (nunca como fondo, para no
confundirse con la burbuja del usuario). El indicador de grupo/vía sale de la vista del
usuario; sobrevive solo como `title` y color. `Test Clas` (el laboratorio) sigue
mostrando el badge completo — es la misma función de render con un segundo parámetro.

### El panel derecho de Consulta — análisis en waffle

El riel fijo de 158px con las tarjetas de análisis pasó a un botón con popover
(`.cn-anbtn` / `.cn-anpop`), liberando ese ancho para los gráficos. Sigue habiendo 2
análisis (Desempeño del mes / Desempeño Filiales); la rejilla del popover ya usa
`auto-fit` para crecer sin tocar layout si se añaden más.

### El panel de Jerarquizar — árbol + mapa de pozos

Las preguntas de estructura organizacional (`jerarq_arbol`) pintan ahora **dos columnas**:
el árbol de siempre a la izquierda, y a la derecha un mapa Canvas con los pozos de la
entidad sobre el contorno de Colombia — vista país (centrada en el campo consultado, con
zoom) y vista de detalle por pozo (con el contorno del campo, si existe). Se degrada con
gracia si `robustez_v02` no responde: el árbol se queda con todo el ancho, nunca un panel
roto. **(26-ago)** El panel mide de verdad "lo que el árbol", sin el hueco muerto que
dejaba el canvas antes de sacarlo del flujo; y el título ya no anuncia "sin contorno"
cuando el campo no tiene polígono — solo informa lo que sí hay.

### Cuantificar a grano día — memoria del mes de la conversación (26-ago)

Las respuestas de un día puntual (N1D) o del mejor/peor día (N1DSEL) ya no anuncian que
"no hay presupuesto diario" — esa respuesta nunca ofreció cumplimiento, así que el aviso
respondía algo que nadie preguntó. Y la memoria conversacional de Cuantificar (`_CTX`)
ahora recuerda además el **mes** de la última respuesta sin ambigüedad: si preguntas por
un día puntual de mayo y luego pides "la producción del mes" sin nombrar cuál, el sistema
responde sobre mayo, no sobre el mes de hoy — salvo que pidas explícitamente "este mes" o
la frase ya traiga su propio mes.

### El input del chat — historial de preguntas de la conversación (26-ago, ampliado 3ª parte)

Un botón junto al input (icono de reloj) despliega las preguntas ya hechas en la
conversación activa; clic en una la rellena en el input **sin enviarla** (evita reenvíos
accidentales de una pregunta vieja). Alcance limitado a la conversación activa a
propósito: el historial GLOBAL de conversaciones ya vive en el panel "Historial"
(`historial.js`) — mezclar ambos aquí duplicaría el concepto.

**(3ª parte)** El desplegable trae además **8 plantillas de arranque** con "…" donde va el
dato (producto/campo/mes/año), **siempre visibles al final de la lista** — el historial real
de la conversación va arriba (más reciente primero), las plantillas nunca se ocultan. Sirven
de punto de partida para quien no sabe qué preguntar; una de ellas ("Analiza el
comportamiento del producto …") no lleva campo y puede tropezar con el mismo declive de
Cuantificar-sin-entidad que resolvió `205dccc` — pendiente de confirmar en vivo.

### Atajos de panorama — "bloque 2" y "bloque 3" (26-ago, 3ª parte)

Dos frases genéricas en el chat, resueltas **antes** del clasificador (cero latencia,
cero LLM salvo el segundo caso):

| Frase | Efecto | Camino |
|---|---|---|
| "muéstrame bloque 2" / "panorama general" | Repinta las 3 tarjetas P50 | `__cnVolverPanorama()` — el mismo botón "Volver al panorama" |
| "muéstrame bloque 3" / "focos de atención" | Reactiva Focos de atención bajo demanda | `__cnAnalisisEjecutivo(null)` directo — **puede invocar a Gemma** (~180s, hasta ~342s en frío), con aviso explícito en la burbuja |

Bloque 3 existe porque `panorama_global_solo_p50` (24-ago) omite Focos de atención del
arranque automático **a propósito** — el atajo lo reactiva solo si el usuario lo pide,
sin pagar el costo en el 99% de las cargas que no lo necesitan.

### Panel Historial de MainChat — pie agrupado (26-ago, 3ª parte)

"Estado del sistema" y el disparador del menú de usuario viven ahora en un solo
`.mc-hist__pie-grupo` anclado al fondo del panel (`margin-top:auto`), en vez de "Estado"
fijo justo debajo de la lista de conversaciones con una franja vacía hasta el login. El
contenido de ambas secciones (título/línea/grid de Estado; avatar+nombre+chevron del
usuario) queda centrado horizontalmente.

### Badge "Act: fecha" en el header de Insights (26-ago, 3ª parte)

La cabecera del panel Insights muestra la fecha del reporte más reciente cargado en la
BD (`MAX(fecha_reporte)` de `core.config_reporte`), junto a un icono de base de datos.
Endpoint nuevo `GET /reportes/ultimo` (INGESTA) + proxy `GET /api/reportes/ultimo`
(Flask); `acordeon.js` lo pide una sola vez por sesión (cacheado en memoria) aunque el
header se reconstruya varias veces al colapsar/expandir el panel.

### Login — constelación neuronal animada (26-ago, 3ª parte)

El panel izquierdo del login pasa de un degradado verde sólido a un SVG inline con **13
nodos y 18 aristas** (coordenadas fijas, no generadas): señales que viajan por cada arista
(`stroke-dashoffset`), halos que respiran y puntos que laten, todo desfasado por índice
para que nada se vea sincronizado. Puramente decorativo (`aria-hidden`, `pointer-events:
none`); `prefers-reduced-motion` congela el SMIL. Adaptado de un documento de diseño
(`log_in.md`) escrito para React 19 + TypeScript + Sass — stack que ProdIA no tiene — al
Jinja2 + CSS plano real, sin dependencias nuevas ni build step. No toca `login.js` ni el
flujo de autenticación.

### El panel "Focos de atención" — precarga en paralelo (26-ago)

Las 3 secciones lazy de cada foco (Diferidas, Mantenimientos, EBITDA-NOPAT) antes
arrancaban su fetch recién al hacer clic en la pestaña — el usuario siempre veía
"Cargando…", sin importar cuánto llevara el panel abierto. Ahora se precargan en segundo
plano apenas se pinta la tarjeta, reusando la misma caché por ámbito que ya tenía el
patrón lazy: si el clic llega antes de que termine, se ve el mismo "Cargando…" de siempre
pero por menos tiempo; si ya llegó, se pinta al instante.

### Analizar — el periodo de la pregunta (26-ago, 2ª parte)

Hasta esta sesión Analizar era **ciego al mes**: pasaba `periodo=None` fijo y respondía siempre
el mes vigente, rotulándolo como tal. Ahora el mes nombrado en la pregunta llega hasta el final
de la cadena:

| Pieza | Comportamiento |
|---|---|
| Texto de la respuesta | El ejecutivo se consulta con el mes pedido; la cabecera dice ese mes |
| Panel `analiza_foco` | Recibe el mismo `periodo` — sin esto el texto diría mayo y el acordeón pintaría agosto |
| Pestaña EBITDA-NOPAT | `year`/`month` explícitos en el QS del waterfall |
| Pestaña Mantenimientos | Ya lo recibía desde el 13-ago (`data-per`) |
| Pestaña Diferidas | **No** depende del mes: su histórico es 2023-2025 completo, por diseño |

Si el mes no se puede honrar —`_parse_periodo` solo entiende mes-por-nombre y «mes pasado», así
que un trimestre o un año caen al mes vigente— sale un aviso **antes** de las cifras, no en un
pie de página. La comparación es por número de mes, no por cadena: «setiembre» contra
«Septiembre» no dispara un aviso falso, y si el formato del meta no se reconoce no se avisa nada
(inventar una advertencia es tan malo como callar una real).

### Los tres paneles de Analizar (26-ago)

| Sub-intención | Panel | Cuándo aparece |
|---|---|---|
| `causal` | `analiza_foco` — acordeón de focos con 4 pestañas | Siempre que hay datos |
| `diferidas` | `analiza_dif` ⬅ nuevo | Solo si el histórico trae datos |
| `referencia` | `p50_vp` | Solo en la rama de vicepresidencia, y solo si el texto ya dio una cifra |
| `proyeccion` / `economia` | — | Sin panel |

`analiza_dif` viaja con el **scope** (entidad, nivel, campos, producto), no con los datos: el
frontend fetchea `/api/diferidas/frecuencia` con su propia caché y reusa `__cnDiferidasInto` sin
un segundo camino de pintado que pudiera desincronizarse.

⚠️ `economia` sigue **sin panel** aunque el waterfall visual ya existe en el acordeón de foco —
es el mismo caso que tenía `diferidas` antes de esta sesión, y el patrón para conectarlo ya está
resuelto.

### Arranque del backend — dos warm-ups en paralelo (26-ago)

`@app.on_event("startup")` dispara ahora **dos** hilos daemon independientes, ambos best-effort
y gobernados por `CONSULTA_WARMUP`:

| Hilo | Qué absorbe | Coste en frío |
|---|---|---|
| `consulta-warmup` | Carga de gemma en Ollama (`keep_alive=-1`) | ~342 s medidos en el 139 |
| `consulta-warmup-dif` ⬅ nuevo | Los 2 scans completos de `AVM_DATADIF` que paga `causal` | No medido (BD ausente en dev) |

Van separados a propósito: encadenarlos dejaría la BD fría hasta que el LLM terminara de cargar.
En dev, sin la BD de diferidas, el segundo muere en milisegundos sin dejar nada cacheado —
`impacto_historico` no cachea el «no disponible», a propósito.

### Endpoints nuevos de `consulta_v2` (INGESTA `:8088`, proxyados por Flask `:8020`)

| Endpoint | Método | Propósito |
|---|---|---|
| `/consulta2/pozos_geo` | GET | Puntos de pozos + contornos + contexto país para el mapa de Jerarquizar |

Sin endpoints nuevos de `consulta_v2` el 26-ago: los dos paneles conectados en la 2ª parte
de la sesión (Diferidas y el waterfall con periodo) consumen rutas **que ya existían** en el
Flask del app padre (`/api/diferidas/frecuencia`, `/api/ebitda/unificado-waterfall`). El
patrón de esa sesión fue precisamente ese — conectar lo construido, no construir de nuevo.

**(3ª parte)** Sí hay un endpoint nuevo, fuera de `consulta_v2` — `GET /reportes/ultimo`
(INGESTA) + proxy `GET /api/reportes/ultimo` (Flask): fecha del reporte más reciente
cargado en la BD, para el badge "Act:" del header de Insights.

---

*Documento de estado — actualizado 2026-08-26 (3ª parte). Ver `Cambios_Julio.md` para el mes anterior.*

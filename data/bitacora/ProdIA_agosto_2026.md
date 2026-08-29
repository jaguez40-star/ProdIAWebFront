# Resumen — Actividades de Agosto 2026 (ProdIA 2.0)

> Resumen elaborado a partir de `Cambios_Agosto.md`.
> Rango: **2026-08-01 → 2026-08-27** · **229 commits** registrados hasta el 26-ago, más una sesión de infraestructura el 27-ago sin commits de producto.

## Panorama general

El mes tiene tres grandes bloques:

1. **2–13 ago (109 commits) — Consolidación del Motor Q v2.** Los cuatro grupos de intención del chat (Cuantificar, Jerarquizar, Analizar, OUT) pasan de esqueleto a responder con cifras reales, memoria conversacional y paneles gráficos apilados.
2. **20–24 ago (38 commits) — Capa de presentación.** Rediseño del login, MainChat pasa de cascarón a interfaz real (portada, panel Historial, panorama solo-P50), fix del scroll de Insights, y rediseño del panel Jerarquizar como árbol con conectores.
3. **25–27 ago — Cierre del mes, muy denso.** Cuantificar a grano día, resiliencia del chat ante timeouts, hallazgo de corrupción física en la BD local, diseño e implementación del panel «Comportamiento {Producto}», navegación de módulos, cuarto detector del clasificador (el asistente responde sobre sí mismo), hilo de chat tipo timeline, mapa de pozos en Jerarquizar, una ronda de pulido medido en vivo, mejoras de rendimiento, y finalmente la migración de puertos + primer despliegue a Azure DevOps (con su propio postmortem).

## Bloques por commits

| Bloque | Fechas | Commits | Eje principal |
|---|---|---:|---|
| Motor Q v2 | 2–4 ago | 60 | Los 4 grupos de intención + filtro de dominio + Test Clas |
| Paneles y gráficos | 11–12 ago | 15 | Pila acumulativa, dot plot, dona, identidad por producto |
| P50 y mantenimientos | 13 ago | 9 | P50 como referencia, Eventos_OW real, panel por vicepresidencia |
| Despliegue e ingesta | 20 ago | 2 | Ingesta por lote no interactiva para el servidor 139 |
| UI y entorno | 21 ago | 7 | Login rediseñado, MainChat, arranque en Consulta, `install.bat` |
| MainChat real + Jerarquizar | 24 ago | 31 | MainChat funcional, scroll de Insights corregido, árbol de Jerarquizar |
| Cuantificar a grano día | 25 ago | 6 | Vocabulario de arranque, grano día N1D/N1DSEL |
| Resiliencia e ingesta | 25 ago (pm) | 1 | Timeout del chat sin perder la pregunta; ingesta de agosto; corrupción BD local |
| Diseño de panel | 25 ago (noche) | 0 | Panel «Comportamiento {Producto}» especificado y maquetado |
| Panel de día + rendimiento | 25 ago (noche) | 4 | Implementación del panel; fix de caché duplicada del proxy |
| Navegación de módulos | 25 ago (cierre) | 1 | Consulta/Análisis al waffle, `tabExiste()` |
| Asistente responde sobre sí mismo | 25 ago (noche) | 3 | 4º detector del clasificador (`capacidades.py`) |
| Hilo tipo timeline | 25 ago (noche) | 6 | Burbujas → hilo de una columna |
| Menú de análisis en waffle | 25 ago (noche) | 1 | Riel de previews → botón con popover |
| 4 fallos de grano día e hilo | 25 ago (noche) | 1 | Fixes reportados en vivo por el usuario |
| Mapa de pozos en Jerarquizar | 25 ago (noche) | 1 | Mapa sobre Colombia, coordenadas corregidas |
| Pulido de UX medido en vivo | 26 ago | 4 | Fixes de layout y de contexto conversacional |
| Rendimiento de Focos de atención | 26 ago | 1 | Precarga en paralelo |
| Periodo de la pregunta + paneles | 26 ago (2ª) | 6 | Analizar deja de ser ciego al mes; panel de Diferidas |
| Atajos, login y pulido de UI | 26 ago (3ª) | 11 | Atajos de chat, login con constelación animada |
| Migración de puertos + Azure | 26 ago (4ª) | — | Puertos 5029/5030, separación en 2 repos, primer deploy al 139 |
| Lanzadores sin consola nueva | 27 ago | 0 | `iniciar_frontend.bat` / `iniciar_backend.bat` |

## Detalle por sesión

### Motor Q v2 — los cuatro grupos de intención (2–4 ago, 60 commits)
- **Cuantificar**: crudo/gas/blancos — mes, acumulado, serie mensual, variación, rankings y vs PPTO.
- **Jerarquizar**: campos, activos, gerencias, pozos, desde la jerarquía de ROBUSTEZ.
- **Analizar**: brechas, diferidas, mantenimientos, proyección de cierre, economía (EBITDA/NOPAT).
- **OUT**: filtro de dominio, rechazo honesto redactado por LLM.
- Piezas transversales: clasificador de grupo con pestaña **Test Clas**, memoria conversacional (follow-ups, drills), warm-up del LLM al arrancar, precarga del reporte global desde el login, RBAC de pestañas (solo Javier Guerrero ve todas).

### Paneles y gráficos (11–12 ago, 15 commits)
Pila acumulativa de resultados en el panel derecho de Consulta; dot plot + dona de participación para el ranking N5; identidad de color por producto; árbol jerárquico para Jerarquizar.

### P50, mantenimientos y diferidas (13 ago, 9 commits)
P50 como cifra (no causa), con panel por vicepresidencia. Hallazgo clave: la hoja del P50 está en promedio diario, no en la escala del fact — aplicar la conversión equivocada daba cifras mil veces menores sin error visible. Mantenimientos se conecta a `Eventos_OW.xlsx` real.

### Sesión del 21 de agosto — UI de acceso, MainChat y entorno (7 commits)
Rediseño completo del login (grid de 2 columnas, panel de marca con degradado, preservando el contrato de IDs de `login.js` sin tocarlo); animación decorativa de pasos LDAP (`login-steps.js`); MainChat nace como cascarón en `/mainchat`; `install.bat` nuevo para preparar el entorno desde cero (no existía en el repo pese a que `run.bat` lo mencionaba).

### Sesión del 24 de agosto — MainChat real, scroll de Insights y Jerarquizar rediseñado (31 commits)
El día más denso del mes. Tres hilos en paralelo:
- Afinamiento del Motor Q v2 (Capa 1): formas causales coloquiales, golden set 75→92 casos (95%→96%), botón «Correr golden» en Test Clas.
- **Scroll del panel Insights**: 5 iteraciones hasta encontrar la causa real (un listener de scroll en `document` capturaba el auto-scroll del chat) — resuelto midiendo la traza en la app real, no razonando sobre el archivo.
- **MainChat pasa de cascarón a interfaz real**: portada (mascota + saludo), menú de usuario reubicado al pie del panel Historial (2 intentos fallidos hasta medir `getComputedStyle`), panorama reducido a tarjetas P50 + saludo estático, revelado de respuesta palabra por palabra.
- **Panel Jerarquizar rediseñado**: árbol con conectores, verificado contra datos reales de `core.map_campo_robustez`.
- Se documenta la lección de "medir el DOM real antes de razonar sobre archivos CSS/JS" (`SETUP_LOCAL.md`, `Planes/leccion_frontend_medir_antes_2026-08-24.md`).

### Sesión del 25 de agosto — Cuantificar a grano día (6 commits)
Un análisis de 11 variaciones de pregunta reveló que solo 3 de 11 funcionaban (todo Cuantificar colgaba de la palabra literal "cuánto"). Se cierran las 8 formas restantes y se implementa el **grano día** (N1D fecha puntual + N1DSEL mejor/peor día), verificado contra la BD real: el dato diario termina el 2026-05-17, así que "ayer" no tiene dato pero "el 15 de mayo" sí. Corregido también un bug silencioso donde "¿cuánto produjo Castilla ayer?" devolvía la cifra de mayo completo sin avisar, y otro donde "Castilla este mes" resolvía el campo real "CASTILLA ESTE" en vez de aplicar el demostrativo.
En curso al cierre (sin commitear): panel «Comportamiento {Producto}» para preguntas de grano día, con suite verde y pendiente de validación humana.

### Sesión del 25 de agosto (tarde) — Resiliencia del Motor v2 e ingesta de agosto (1 commit)
- La pregunta ya no se pierde en un timeout del chat; se bloquean reenvíos concurrentes; el detalle técnico crudo de la excepción deja de mostrarse al usuario.
- Se decide explícitamente **no** bajar el timeout de 90s (el presupuesto interno de INGESTA ya lo iguala) ni añadir reintento con backoff.
- **Ingesta de agosto**: 19 reportes verificados (falta el día 09), 0 cifrados con IRM (a diferencia de julio). Prueba de ingesta real con rollback: 337.827 filas escritas correctamente.
- 🔑 **Hallazgo de infraestructura**: corrupción física en la BD local (`psycopg.errors.DataCorrupted`). `bronze.idx_landing_payload` reparado; `core.fact_tabla_hoja` (41 GB) sin reparar. Causa raíz: errores de disco y apagado inesperado el 23–24 de agosto — no es un problema del ETL. Los datos de agosto quedaron cargados en el servidor 139, no en la copia local (congelada en 2026-05-18).

### Sesión del 25 de agosto (noche) — Diseño del panel «Comportamiento {Producto}» (0 commits)
Sesión de diseño puro: maqueta HTML validada en navegador + plan de implementación, sin tocar código de producción. Variante autónoma del foco ECP con 2 gráficos (gauge PPTO + curva diaria) en vez de 3, sin pestañas ni cabecera de producto. El layout costó 8 iteraciones a ciegas y se resolvió en 1 midiendo con `getBoundingClientRect()` + Chrome headless.

### Sesión del 25 de agosto (noche, 2ª) — El panel de día se implementa (4 commits)
El panel se implementa por la ruta de grano día de `consulta_v2` (no por el `panel.tipo` genérico previsto). Hallazgo clave: la caché del proxy se partía en dos entradas por incluir el parámetro `pulir` en la clave, haciendo que el panel tardara minutos en renderizar — se excluye `pulir` de la clave de caché.

### Sesión del 25 de agosto (cierre) — Navegación de módulos (1 commit)
Se abre acceso a módulos que existían pero eran inalcanzables desde la UI: Consulta y Análisis al waffle (como pestañas in-situ, sin perder estado), guarda real `tabExiste()`, navegación entre las 3 vistas HTML vía un parcial nuevo (`nav_modulos.html`). Se retiran del waffle accesos a rutas inexistentes (Admin/Configuración/Ayuda).

### Sesión del 25 de agosto (noche) — El asistente responde sobre sí mismo (3 commits)
Nuevo detector determinista `capacidades.py`: preguntas como "¿cuál es tu finalidad?" o saludos caían en la rama OUT y el LLM respondía que el tema estaba fuera de contexto. Ahora responde con un inventario fijo de capacidades.

### Sesión del 25 de agosto (noche) — Hilo tipo timeline en el chat (6 commits, CN-HILO-D)
Las burbujas asimétricas se reemplazan por un hilo de una columna con riel vertical, avatar, nombre («ProdIA») y hora por turno. Solo capa de render — el NLP y los endpoints no cambian. Mejoras de accesibilidad (`role="log" aria-live="polite"`).

### Sesión del 25 de agosto (noche) — Riel de análisis a botón con popover (1 commit, CN-WAFFLE)
El riel de 158px con tarjetas de análisis en Consulta pasa a un botón compacto con popover, liberando espacio para los gráficos.

### Sesión del 25 de agosto (noche) — Cuatro fallos de grano día y de hilo conversacional (1 commit, QV2-HILO-DIA)
Corrige: un día puntual que devolvía la cifra de otro mes sin avisar, una repregunta que negaba una capacidad existente, un mes inexistente (diciembre→13), y la pérdida del hilo conversacional al cambiar de mes.

### Sesión del 25 de agosto (noche) — Mapa de pozos sobre Colombia en Jerarquizar (1 commit, QV2-MAPA)
El panel de estructura organizacional gana un mapa de pozos junto al árbol. Dos hallazgos que cambiaron el diseño antes de escribir código: `ops.wells_attributes` tiene grano de zona (no de pozo, inflaba conteos ×3) y traía la latitud/longitud invertidas respecto al contorno de los campos.

### Sesión del 26 de agosto — Pulido medido en vivo + rendimiento (6 commits)
Disparado por capturas del usuario probando la app real:
- El mapa de pozos dejaba un hueco muerto bajo el árbol (canvas con ratio intrínseco 2:1) — corregido sacándolo del flujo.
- Avisos que no aportan se retiran ("sin contorno", "sin presupuesto diario").
- "La producción del mes" hereda el mes de la conversación en vez de asumir hoy.
- Diferidas/Mantenimientos/EBITDA-NOPAT pasan de carga perezosa a precarga en paralelo.

### Sesión del 26 de agosto (2ª) — El periodo de la pregunta y paneles que faltaban (6 commits)
- Panel de Diferidas conectado a la pregunta directa por causas (antes solo vivía como pestaña del acordeón).
- Warm-up de las cachés de diferidas al arrancar.
- El waterfall de variación mes a mes ahora mide su propio lienzo (antes 175px muertos a cada lado).
- 🔑 La burbuja de fallo ahora dice cuánto tardó y con qué código HTTP, en vez de afirmar siempre "tardó más de lo previsto".
- 🔑 **Analizar deja de ser ciego al mes**: antes ignoraba el mes pedido y respondía siempre el mes vigente sin avisar.
- El waterfall de EBITDA pasa a respetar el mes de la pregunta.
- Corregido un bug de substring compartido: "mayo" era substring de "mayor" en el detector de periodo.
- Pendiente al cierre: el fallo "SIN RESPUESTA" en la primera pregunta tras cada reinicio sigue sin resolver — el warm-up de diferidas no bastó.

### Sesión del 26 de agosto (3ª) — Atajos de panorama, login y pulido de UI (11 commits)
- Atajos de chat "bloque 2"/"bloque 3" para repintar tarjetas P50 o reactivar Focos de atención sin pasar por el clasificador.
- Fix de "Nuevo chat" que dejaba el bloque de Insights sin reiniciar.
- Desplegable de preguntas con 8 plantillas de arranque siempre visibles.
- Fix de posicionamiento: `acordeon.css` pisaba el `position:sticky` con `static`.
- Pie agrupado (Estado del sistema + usuario) en el panel Historial.
- Badge "Act: `<fecha>`" en el header de Insights.
- **Login: rediseño completo del panel izquierdo** — de degradado verde a una constelación neuronal animada en SVG+SMIL (13 nodos, 18 aristas), adaptada de un documento de diseño React/Sass al stack real (Jinja2 + CSS plano).

### Sesión del 26 de agosto (4ª) — Migración de puertos y primer despliegue a Azure DevOps
Sesión de infraestructura: puertos reasignados (Flask 8020→5029, INGESTA 8088→5030); el monorepo se separa en 2 repos para Azure DevOps (`ProdIAWebFront` / `ProdIABack`), desplegados anidados en disco; scripts nuevos `exportar_azure.ps1` (export limpio vía `git archive`) y `verificar_deploy.ps1` (chequeo de integridad del deploy); primer despliegue verificado en el servidor 139, con hallazgos de contenido desincronizado en el checkout de Azure. Postmortem completo documentado, con pedido explícito de construir un pipeline de despliegue real.

### Sesión del 27 de agosto — Lanzadores separados sin consola nueva (0 commits de producto)
Continuación de la migración de puertos: se confirma el procedimiento de deploy fresco en el 139 (evitando una carpeta con ACL rota) y se añaden `iniciar_frontend.bat` / `iniciar_backend.bat`, que arrancan cada backend en la misma consola que los invoca (sin abrir ventana nueva), a pedido explícito tras ver el patrón de otro proyecto del servidor.

## Estado del proyecto al cierre del mes

- **Dos backends**: ProdIA (Flask, puerto 5029) con SQL Server/Azure Synapse + SQLite; INGESTA (FastAPI, puerto 5030, gestionado con `uv`) con PostgreSQL.
- **Código en 3 repos**: GitHub `ProdIA-2.0` (monorepo, fuente de verdad) → Azure DevOps `ProdIAWebFront` + `ProdIABack`.
- **Dos interfaces de chat en paralelo**: `/` (layout clásico) y `/mainchat` (interfaz real desde el 24-ago), ambas montan el mismo `multitab_shell.js`.
- **Motor Q v2**: golden set de 92 casos al 96% de accuracy (gate ≥90%); suite de 502+ tests pasando, con 10 fallos preexistentes y ajenos documentados.
- **Deuda conocida** (no bloqueante, documentada): `rank` de Focos de atención no ordena realmente por impacto; falta control de roles real más allá de la autenticación; `PLATA` en el léxico de economía dispara falsos positivos con "plataforma"; el fallo "SIN RESPUESTA" en la primera pregunta tras reinicio sigue sin causa raíz confirmada; corrupción física pendiente de reparar en `core.fact_tabla_hoja` (BD local).

---
*Resumen generado el 2026-08-28 a partir de `Cambios_Agosto.md` (documento fuente, actualizado al 2026-08-27).*

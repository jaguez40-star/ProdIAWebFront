# Plan `LAYOUT-LANZADORES` — Lanzadores del layout separado y docs restauradas

**Fecha:** 2026-08-29
**Repos afectados:** `ProdIAWebFront` (frontend) y `ProdIABack` (backend)
**Origen de la tarea:** verificación por hash de blob del espacio de trabajo `Repo ProdIA`
contra el monorepo `ProdIA-2.0`.

---

## 0. Contexto para el agente EXECUTOR

No tienes la conversación previa. Todo lo que necesitas está aquí.

### Rutas absolutas

| Alias | Ruta |
|---|---|
| `ORIG` | `C:\APLICACIONES\ProdIA\12112025_prodIA\ProdIA-2.0\ProdIA-2.0` |
| `DEST` | `C:\APLICACIONES\ProdIA\Repo ProdIA` |
| Repo front | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend` |
| Repo back | `C:\APLICACIONES\ProdIA\Repo ProdIA\backend` |

`ORIG` es el **monorepo histórico** (solo lectura: no escribas nada ahí).
`DEST` son **dos repos git hermanos e independientes**, cada uno con remoto propio en
GitHub `jaguez40-star`. No están anidados y no deben quedar anidados.

### Convenciones del proyecto

- Español en commits, comentarios y reportes.
- Los `.bat` del repo van en **CRLF**. `core.autocrlf=true`, no hay `.gitattributes`.
- Los `.env` **nunca** se tocan ni se versionan.
- Commits sin `--no-verify`. **No hacer push**: lo revisa el usuario.
- `CLAUDE.md` y `BITACORA.md` existen en **tres copias idénticas**: `DEST\`,
  `DEST\frontend\` y `DEST\backend\`. La de `DEST\` no está versionada; las otras dos sí.
  **Si editas una, las tres deben quedar iguales.**

### Qué hace cada proceso (para que entiendas el porqué)

Son **dos procesos**: Flask en `frontend\` (puerto **5029**) y FastAPI/INGESTA en
`backend\` (puerto **5030**). El navegador **nunca** habla con el 5030; Flask hace de
proxy interno vía `routes/api.py`. Por eso el 5030 no necesita estar expuesto a la red.

---

## 1. Hallazgos de la auditoría

### 🟢 Confirmación — el código está intacto

Comparación por hash de blob del índice, 536 archivos versionados del monorepo contra los
542 de los dos repos:

| | Idénticos | Difieren | Solo en `ORIG` | Solo en `DEST` |
|---|---|---|---|---|
| frontend | 254 | 3 | 4 | 7 |
| backend | 274 | 1 | 0 | 3 |

**Ningún archivo de código fuente difiere.** Ni un `.py`, `.html`, `.js`, `.css`, `.ts`,
`.sql` ni `.yaml`. Las cuatro diferencias son dos `.gitignore` (cambios deliberados,
posteriores) y dos `.md`. La separación del monorepo se hizo sin pérdida de código.

Chequeo de sintaxis: **121/121** `.py` del backend compilan; **100/102** en frontend. Los
dos que fallan (`_test_robustez.py`, f-string sin cerrar; `_update_panorama_titles.py`, no
es UTF-8) **son byte a byte idénticos al monorepo**: deuda preexistente, no daño de la
migración, y ninguno lo importa la app. **No los toques.**

### 🔴 Bloqueante 1 — faltan los lanzadores buenos

`iniciar_frontend.bat` e `iniciar_backend.bat` (creados el 27-ago: corren en la misma
consola y resuelven el intérprete base vía `pyvenv.cfg`, esquivando el trampolín
`venv\Scripts\python.exe` que **WDAC bloquea en el servidor 139**) están en `ORIG` pero
**no llegaron a ninguno de los dos repos**. `CLAUDE.md` §4 ya los documenta como si
existieran: hoy esa sección es falsa.

### 🔴 Bloqueante 2 — los `.bat` de `ORIG` están en LF

Verificado con `file`: ambos lanzadores son *«DOS batch file, ASCII text»* sin CRLF. Ambos
usan subrutinas (`:getbase`) y saltos (`goto :fin`) — justo donde un batch en LF falla de
forma errática. El resto de `.bat` del repo ya están en CRLF.
→ **Hay que escribirlos en CRLF, no copiarlos crudos.** Determina el paso 1 de la §3.

### 🔴 Bloqueante 3 — `Cambios_Agosto.md` es histórico y NO se adapta

`DEST\frontend\data\bitacora\Cambios_Agosto.md` retrocedió a una versión anterior al
26-ago (dice puertos **8020/8088** y `run.bat`). Hay que restaurarlo, **pero su propio pie
dice**: *«las fechadas de arriba, que son histórico y no se tocan»*.
→ Se copia **verbatim**. Adaptarle las rutas al layout separado falsearía el registro — que
es exactamente el defecto que se le acaba de encontrar. Solo `projecto.md`, que sí es
documento de estado actual, se adapta.

### 🔴 Bloqueante 4 — falta también `ProdIA_agosto_2026.md`

`ORIG\data\bitacora\ProdIA_agosto_2026.md` (15.8 KB, 28-ago; el resumen de agosto derivado
de `Cambios_Agosto.md`) **no existe** en `DEST\frontend\data\bitacora\`, que sí es carpeta
versionada. Restaurar un archivo de esa carpeta y dejar el otro ausente sería incoherente.
→ Entra, **verbatim**, con el mismo trato que `Cambios_Agosto.md`. Paso §3.4.

### 🟡 Relevante 1 — `start.bat` es resto de julio y engaña

`DEST\frontend\start.bat` (4 líneas) dice puerto **5001** y usa `.\venv\Scripts\python.exe`,
el trampolín bloqueado por WDAC. Verificado con `git grep`: **nadie lo referencia** salvo
menciones en `BITACORA.md` como decisión pendiente.

### 🟡 Relevante 2 — al aplicar esto, la bitácora queda mintiendo

Este cambio cierra el paso 2 de «Dónde retomamos» y **tres decisiones abiertas**
(`start.bat`, postmortem, `0.0.0.0` vs `127.0.0.1`). Si no se actualiza `BITACORA.md`, se
repite el mismo defecto que acabamos de corregir en `projecto.md`. Por eso el paso 4 no es
opcional. Lo mismo con el pie de `CLAUDE.md`, que aún dice del postmortem *«si se
sincroniza desde el monorepo»*.

### 🟢 Confirmación — el pipeline no se rompe

- `migrar_a_azure.ps1`: `$ExcluirDirs`/`$ExcluirArchivos` **no** excluyen `.bat` ni
  `.claude/skills/`. Los archivos nuevos viajarán a Azure sin cambios en el skill.
- `verificar_deploy.ps1`: solo comprueba `app.py` puerto 5029 y los estáticos de
  `login.html`. No referencia los lanzadores ni rutas anidadas → **no se ve afectado**.
- `install.bat`: sigue buscando `%~dp0INGESTA\Rep_Prod\backend`. Sus dos AVISOS ya están
  documentados como normales en `CLAUDE.md` §4. **No se toca.**
- **Ningún código lee `data/bitacora/`.** `git grep` sobre `*.py`, `*.js` y `*.html` no
  devuelve nada: restaurar esos `.md` es cambio documental puro, sin riesgo funcional.
- `Planes/` **sí está versionado** (9 archivos hoy). Este plan entrará en el commit de
  `frontend`, como manda `CLAUDE.md` §10.6.
- **Las 6 cadenas ancla de las sustituciones §3.7 y §3.8 existen y son únicas.** Verificado
  con `grep -cF`: una coincidencia cada una, en el archivo esperado.
- **Todas** las menciones a corregir en `projecto.md` (`INGESTA/Rep_Prod`, «3 repos») caen
  dentro de los dos bloques de la §3.6. No queda ninguna fuera.

### 🟡 Relevante 3 — dos riesgos latentes, FUERA de este plan

Anotados para que no se pierdan; **no los abordes aquí**:

1. `migrar_a_azure.ps1` compara `git ls-tree` del origen contra `git hash-object` del
   destino. Si la máquina de Pruebas no tiene `core.autocrlf=true`, abortará en **todos**
   los archivos de texto. El skill nunca se ha ejecutado: comprobarlo antes de estrenarlo.
2. El skill excluye `.env` exacto, mientras el `.gitignore` del backend ya usa `.env*`. Un
   `.env.local` se mirroreaba a Azure.

---

## 2. Estado actual

Ambos repos limpios (`git status` vacío) y sincronizados con `origin/main`.

```
DEST\frontend\        HEAD 0482bc2   ← sin iniciar_frontend.bat, con start.bat
DEST\backend\         HEAD b0c64da   ← sin iniciar_backend.bat, sin ningún .bat
```

`.bat` presentes hoy en `DEST\frontend\`: `abrir_puertos_ollama.bat`,
`desplegar_version.bat`, `iniciar_backends.bat`, `install.bat`, `run.bat`, `start.bat`.
Los tres últimos lanzadores (`iniciar_backends`, `run`, `desplegar_version`) asumen el
layout anidado y **no** pueden arrancar INGESTA aquí. Quedan fuera de alcance (§7).

No existe `venv\` ni `.venv\`: la app **nunca se ha instalado ni arrancado** en esta
máquina. Solo hay Python 3.13.15 (no 3.12). Esto condiciona la §6.

---

## 3. Especificación

### 3.1 AÑADIR — `DEST\frontend\iniciar_frontend.bat`

Contenido **idéntico** al de `ORIG`, escrito en **CRLF, sin BOM**:

```bat
@echo off
setlocal enableextensions
pushd "%~dp0"

echo Iniciando ProdIA Flask (frontend) en puerto 5029...

set "PATH=%USERPROFILE%\.local\bin;%PATH%"

rem --- Liberar el puerto si esta ocupado (evita WinError 10048) ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5029" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

if not exist "app.py" (
    echo ERROR: no se encontro app.py en %~dp0
    popd
    endlocal
    exit /b 1
)

call :getbase "%~dp0venv\pyvenv.cfg"
if defined BASEPY (
    set "PYTHONPATH=%~dp0venv\Lib\site-packages"
    "%BASEPY%" app.py
    goto :fin
)

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    python app.py
    goto :fin
)

echo ERROR: no se encontro el venv de Flask ^(venv\^).
popd
endlocal
exit /b 1

:fin
popd
endlocal
goto :eof

rem =====================================================================
rem  Subrutina: obtiene el interprete base de un pyvenv.cfg.
rem  %1 = ruta al pyvenv.cfg ; devuelve la ruta a python.exe en %BASEPY%
rem =====================================================================
:getbase
set "BASEPY="
set "_home="
if not exist "%~1" goto :eof
for /f "usebackq tokens=1,* delims== " %%a in ("%~1") do if /i "%%a"=="home" set "_home=%%b"
if defined _home if exist "%_home%\python.exe" set "BASEPY=%_home%\python.exe"
goto :eof
```

### 3.2 AÑADIR — `DEST\backend\iniciar_backend.bat`

Igual al de `ORIG` salvo **tres cambios**, ya aplicados abajo (`ING_DIR` al layout
separado, y las **dos** líneas de uvicorn de `0.0.0.0` a `127.0.0.1`). **CRLF, sin BOM.**

> Motivo del host: el navegador nunca habla con el 5030, solo Flask desde la misma
> máquina. `0.0.0.0` lo expondría a la red sin necesidad. Decisión cerrada.

```bat
@echo off
setlocal enableextensions
set "ING_DIR=%~dp0backend"
pushd "%ING_DIR%"

echo Iniciando INGESTA backend en puerto 5030...

set "PATH=%USERPROFILE%\.local\bin;%PATH%"

rem --- Liberar el puerto si esta ocupado (evita WinError 10048) ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5030" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

if not exist "app\main.py" (
    echo ERROR: no se encontro app\main.py en %ING_DIR%
    popd
    endlocal
    exit /b 1
)

call :getbase "%ING_DIR%\.venv\pyvenv.cfg"
if defined BASEPY (
    set "PYTHONPATH=%ING_DIR%\.venv\Lib\site-packages"
    "%BASEPY%" -m uvicorn app.main:app --host 127.0.0.1 --port 5030
    goto :fin
)

set "VIRTUAL_ENV="
uv run uvicorn app.main:app --host 127.0.0.1 --port 5030

:fin
popd
endlocal
goto :eof

rem =====================================================================
rem  Subrutina: obtiene el interprete base de un pyvenv.cfg.
rem  %1 = ruta al pyvenv.cfg ; devuelve la ruta a python.exe en %BASEPY%
rem =====================================================================
:getbase
set "BASEPY="
set "_home="
if not exist "%~1" goto :eof
for /f "usebackq tokens=1,* delims== " %%a in ("%~1") do if /i "%%a"=="home" set "_home=%%b"
if defined _home if exist "%_home%\python.exe" set "BASEPY=%_home%\python.exe"
goto :eof
```

**Cómo escribir un `.bat` en CRLF sin BOM** (mismo patrón que `CLAUDE.md` §5 usa para los
`.env`):

```powershell
$txt = (Get-Content -Raw 'RUTA_ORIGEN') -replace "`r`n","`n" -replace "`n","`r`n"
[System.IO.File]::WriteAllText('RUTA_DESTINO', $txt, (New-Object System.Text.UTF8Encoding($false)))
```

### 3.3 BORRAR — `DEST\frontend\start.bat`

```powershell
git -C 'C:\APLICACIONES\ProdIA\Repo ProdIA\frontend' rm start.bat
```

### 3.4 RESTAURAR VERBATIM — los dos `.md` de `data\bitacora\`

Copia byte a byte, **sin ninguna edición**:

```
ORIG\data\bitacora\Cambios_Agosto.md      →  DEST\frontend\data\bitacora\Cambios_Agosto.md
ORIG\data\bitacora\ProdIA_agosto_2026.md  →  DEST\frontend\data\bitacora\ProdIA_agosto_2026.md
```

El primero existe y está desfasado; el segundo **no existe** en el repo. Los dos son
histórico. Usa `Copy-Item` (copia binaria). No abras ninguno para editarlo.

### 3.5 AÑADIR VERBATIM — postmortem

```
ORIG\POSTMORTEM_migracion_puertos_azure_20260826.md  →  DEST\frontend\
```

`Copy-Item`, sin editar.

### 3.6 MODIFICAR — `DEST\frontend\projecto.md`

Primero `Copy-Item` desde `ORIG\projecto.md` (así recuperas la versión al día; la actual
está desfasada). El archivo tiene **BOM UTF-8 y CRLF**: consérvalos. Después aplica estas
dos sustituciones exactas.

**Sustitución A** — buscar:

```
- `INGESTA/Rep_Prod/`: segundo backend (FastAPI, puerto 5030) + su propio frontend React,
  para el Reporte Diario de Produccion (ingesta, tablas, Motor Q v2, EBITDA/Analizar).
  Flask lo consume via proxy interno en `routes/api.py` (`INGESTA_API_URL`); el navegador
  nunca le habla directo. Vive anidado dentro de este mismo checkout, pero es un **repo
  git independiente** (ver "Despliegue y control de versiones" mas abajo).
```

reemplazar por:

```
- El segundo backend (FastAPI, puerto 5030) + su propio frontend React, para el Reporte
  Diario de Produccion (ingesta, tablas, Motor Q v2, EBITDA/Analizar), vive en el **repo
  hermano `backend\`** (ProdIABack), no dentro de este checkout. Flask lo consume via
  proxy interno en `routes/api.py` (`INGESTA_API_URL`); el navegador nunca le habla
  directo. Ver "Despliegue y control de versiones" mas abajo.
```

**Sustitución B** — buscar desde `- Backend INGESTA:` hasta la línea
`` `POSTMORTEM_migracion_puertos_azure_20260826.md`. `` (ambas incluidas):

```
- Backend INGESTA: `INGESTA/Rep_Prod/backend/app/main.py` (FastAPI, puerto 5030).
- Script de arranque de los 2 backends: `iniciar_backends.bat` (libera puertos y lanza ambos).
- Script de instalacion: `install.bat` (crea `venv/`, instala `requirements-windows.txt`,
  hace `uv sync` en INGESTA). Requiere Python **3.12.x** exacto (`onnxruntime` aun no
  tiene wheels para 3.14; ver postmortem del 2026-08-26).
- Dependencias: `requirements-windows.txt` (Flask) + `INGESTA/Rep_Prod/backend/pyproject.toml` (uv).

## Despliegue y control de versiones (actualizado 2026-08-26)
El codigo vive en **3 repos**, no uno solo:
- **GitHub `ProdIA-2.0`** (este repo): monorepo fuente de verdad, con Flask en la raiz e
  `INGESTA/Rep_Prod/` como subcarpeta trackeada.
- **Azure DevOps `ProdIAWebFront`**: solo Flask (raiz de este repo, sin `INGESTA/Rep_Prod`).
- **Azure DevOps `ProdIABack`**: solo `INGESTA/Rep_Prod/` (pasa a ser la raiz del repo).

Los dos repos de Azure DevOps se despliegan **anidados en disco** (el back clonado dentro
del front, en `INGESTA\Rep_Prod`) para que `iniciar_backends.bat`/`install.bat` sigan
funcionando sin cambios. Rama activa: `dev` (no `main` — tiene politicas de rama que
bloquean push directo).

Scripts de apoyo para este flujo (raiz del repo, ambos comiteados):
- `exportar_azure.ps1`: exporta con `git archive` (solo lo versionado, nunca `.env`,
  `venv/`, `node_modules/`) hacia una carpeta limpia sin git, lista para subir a Azure.
- `verificar_deploy.ps1`: chequea que un checkout desplegado tenga la version actual
  (puerto correcto, rediseno del login, y **todos** los estaticos que `templates/login.html`
  referencia realmente presentes) — correr siempre antes de dar un despliegue por bueno.

Detalle completo de esta migracion (y por que hizo falta) en
`POSTMORTEM_migracion_puertos_azure_20260826.md`.
```

reemplazar por:

```
- Backend INGESTA: `backend\backend\app\main.py` en el repo hermano (FastAPI, puerto 5030).
- Arranque: `iniciar_frontend.bat` (Flask :5029) y `iniciar_backend.bat` (INGESTA :5030),
  cada uno en su repo. Corren en la misma consola que los invoca y resuelven el interprete
  base via `pyvenv.cfg`, evitando el trampolin `venv\Scripts\python.exe` que WDAC bloquea
  en el servidor 139.
- Script de instalacion: `install.bat` (crea `venv/`, instala `requirements-windows.txt`).
  Requiere Python **3.12.x** exacto (`onnxruntime==1.22.1` aun no tiene wheels para 3.14;
  ver postmortem del 2026-08-26). En el layout separado omite la parte de INGESTA y avisa:
  es normal. El backend se instala aparte con `uv sync`.
- Dependencias: `requirements-windows.txt` (Flask) + `backend\backend\pyproject.toml` (uv).

## Despliegue y control de versiones (actualizado 2026-08-29)
El codigo vive en **2 repos**, carpetas hermanas y no anidadas:
- **`frontend\`** — ProdIAWebFront: solo Flask (puerto 5029).
- **`backend\`** — ProdIABack: solo INGESTA (puerto 5030), FastAPI + su frontend React.

El **origen de trabajo es GitHub `jaguez40-star`** (`ProdIAWebFront` y `ProdIABack`), porque
la maquina local no tiene VPN y no alcanza Azure DevOps. El flujo es: editar en local →
push a GitHub → pull en el servidor de pruebas → verificar → publicar en Azure DevOps `dev`
(rama con politicas: no admite push directo) → servidor 139.

El monorepo `ProdIA-2.0` queda como **archivo historico**, no como fuente de verdad.

Scripts de apoyo (ambos comiteados en `frontend\`):
- `exportar_azure.ps1`: exporta con `git archive` (solo lo versionado, nunca `.env`,
  `venv/`, `node_modules/`) hacia una carpeta limpia sin git.
- `verificar_deploy.ps1`: chequea que un checkout desplegado tenga la version actual
  (puerto correcto, rediseno del login, y **todos** los estaticos que `templates/login.html`
  referencia realmente presentes) — correr siempre antes de dar un despliegue por bueno.
- `.claude\skills\migrar-a-azure\migrar_a_azure.ps1`: puente hacia el checkout de Azure,
  con verificacion de fidelidad hash por hash.

Detalle completo de la migracion de puertos (y por que hizo falta) en
`POSTMORTEM_migracion_puertos_azure_20260826.md`.
```

### 3.7 MODIFICAR — `CLAUDE.md` (las **tres** copias)

Última línea del archivo. Buscar:

```
`frontend\POSTMORTEM_migracion_puertos_azure_20260826.md` si se sincroniza desde el monorepo.*
```

reemplazar por:

```
`frontend\POSTMORTEM_migracion_puertos_azure_20260826.md`.*
```

### 3.8 MODIFICAR — `BITACORA.md` (las **tres** copias)

**Edición 1** — en «Pendientes al cierre del 29 de agosto», buscar:

```
- [ ] Crear los lanzadores adaptados al layout separado: `iniciar_backend.bat` necesita
      `ING_DIR=%~dp0backend`.
```

reemplazar por:

```
- [x] Crear los lanzadores adaptados al layout separado: `iniciar_backend.bat` con
      `ING_DIR=%~dp0backend` y `--host 127.0.0.1`.
```

**Edición 2** — buscar:

```
- [ ] Commitear los lanzadores adaptados, para que el próximo clon los traiga y no haya que
      ponerlos a mano como en la 139.
```

reemplazar por:

```
- [x] Commitear los lanzadores adaptados, para que el próximo clon los traiga y no haya que
      ponerlos a mano como en la 139.
```

**Edición 3** — buscar:

```
- [ ] Decidir si el postmortem y los 7 archivos sueltos de julio (`DIFERIDAS_MES.csv`,
      `image.png`, `start.bat`, `.claude/`, `.codex/`, `.vscode/`, `README.md`) entran o
      salen.
```

reemplazar por:

```
- [x] Postmortem: **entra** (vive ya en `frontend\`). `start.bat`: **sale** (resto de julio,
      puerto 5001 y trampolín bloqueado por WDAC; nadie lo referenciaba).
- [ ] Decidir sobre los sueltos que quedan: `DIFERIDAS_MES.csv`, `image.png`, `.codex/`,
      `.vscode/`, `README.md`.
```

**Edición 4** — en «Dónde retomamos», buscar:

```
**2. Crear los lanzadores adaptados al layout separado.** `iniciar_frontend.bat` sirve tal
cual; `iniciar_backend.bat` necesita `ING_DIR=%~dp0backend` en vez de la ruta anidada. Una
vez probados, commitearlos en su repo para que el próximo clon los traiga.
```

reemplazar por:

```
**2. ~~Crear los lanzadores adaptados al layout separado.~~ HECHO (29-ago, tarde).**
`iniciar_frontend.bat` entró tal cual en `frontend\`; `iniciar_backend.bat` entró en
`backend\` con `ING_DIR=%~dp0backend` y `--host 127.0.0.1`. Ambos commiteados. **Falta
probarlos**: aquí no hay venv ni Python 3.12, así que su validación es en Pruebas.
```

**Edición 5** — en «Decisiones abiertas, pequeñas», buscar:

```
- ¿Entran o salen los 7 archivos sueltos de julio (`DIFERIDAS_MES.csv`, `image.png`,
  `start.bat`, `README.md`, `.codex/`, `.vscode/`)?
- ¿Se trae el `POSTMORTEM_migracion_puertos_azure_20260826.md`? Hoy vive solo en el monorepo.
- Borrar los `.env` con credenciales que quedaron en la copia local de `Repo ProdIA`.
- Confirmar `--host 0.0.0.0` vs `127.0.0.1` en `iniciar_backend.bat`: decide si el 5030
  queda expuesto a la red.
```

reemplazar por:

```
- ✅ `start.bat` borrado y postmortem traído a `frontend\` (29-ago, tarde).
- ✅ Host del 5030 fijado en `127.0.0.1`: el navegador nunca le habla, solo Flask desde la
  misma máquina.
- ¿Entran o salen los sueltos que quedan (`DIFERIDAS_MES.csv`, `image.png`, `README.md`,
  `.codex/`, `.vscode/`)?
- Borrar los `.env` con credenciales que quedaron en la copia local de `Repo ProdIA`.
```

**Edición 6** — insertar una sección nueva **justo antes** de la línea
`## 👉 Dónde retomamos (2026-08-29, fin de sesión)`:

```
## Sesión del 29 de agosto (tarde) — Verificación contra el monorepo y layout de arranque

Se comparó el espacio de trabajo contra el monorepo `ProdIA-2.0` por **hash de blob**, que
es lo único que sirve cuando las historias de git son distintas.

**El código está intacto.** De 536 archivos versionados en el monorepo, **528 son idénticos**
y **ninguno de los que difieren es código fuente**. Las únicas diferencias eran los dos
`.gitignore` (endurecidos a propósito) y dos `.md`. La separación en dos repos no perdió
código.

**Lo que sí faltaba, y se arregló:**

- Los lanzadores del 27-ago (`iniciar_frontend.bat`, `iniciar_backend.bat`) no habían
  llegado a ningún repo, aunque `CLAUDE.md` §4 ya los documentaba. Entraron, cada uno en el
  suyo, y el del backend con `ING_DIR=%~dp0backend` y `--host 127.0.0.1`.
- Estaban en LF en el origen. Se escribieron en **CRLF**: ambos usan subrutinas y saltos,
  donde un batch en LF falla de forma errática.
- `projecto.md` y `data/bitacora/Cambios_Agosto.md` habían **retrocedido** a una versión
  anterior al 26-ago (decían puertos 8020/8088). Se restauraron. `projecto.md` además se
  adaptó al layout de dos repos; `Cambios_Agosto.md` se dejó **verbatim**, porque su propio
  pie dice que las entradas fechadas son histórico y no se tocan.
- `data/bitacora/ProdIA_agosto_2026.md` no estaba en el repo, aunque la carpeta sí se
  versiona. Entró verbatim, para no dejar la bitácora a medias.
- `start.bat` (julio: puerto 5001 y el trampolín que WDAC bloquea) se borró. Nadie lo
  referenciaba.
- El postmortem del 26-ago dejó de vivir solo en el monorepo.

**Lo que se verificó de paso, y no hizo falta tocar:** el skill `migrar-a-azure` no excluye
`.bat` ni `.claude/skills/`, así que lo nuevo viajará a Azure sin cambios;
`verificar_deploy.ps1` no referencia lanzadores ni rutas anidadas.

**Dos riesgos anotados para antes de estrenar el skill:** compara `git ls-tree` del origen
contra `git hash-object` del destino, así que si la máquina de Pruebas no tiene
`core.autocrlf=true` abortará en todos los archivos de texto; y excluye `.env` exacto
mientras el `.gitignore` del backend ya usa `.env*`.

**Deuda preexistente confirmada, no tocada:** `_test_robustez.py` (f-string sin cerrar) y
`_update_panorama_titles.py` (no es UTF-8) no compilan — pero son idénticos al monorepo y
la app no los importa.

---
```

---

## 4. Orden de ejecución

| # | Acción | Repo | Referencia |
|---|---|---|---|
| 1 | Escribir `iniciar_frontend.bat` en CRLF | frontend | §3.1 |
| 2 | Escribir `iniciar_backend.bat` en CRLF, con los 3 cambios | backend | §3.2 |
| 3 | `git rm start.bat` | frontend | §3.3 |
| 4 | `Copy-Item` de `Cambios_Agosto.md` **y** `ProdIA_agosto_2026.md`, verbatim | frontend | §3.4 |
| 5 | `Copy-Item` del postmortem, verbatim | frontend | §3.5 |
| 6 | `Copy-Item` de `projecto.md` + sustituciones A y B | frontend | §3.6 |
| 7 | Editar pie de `CLAUDE.md` en las 3 copias | ambos | §3.7 |
| 8 | Aplicar las 6 ediciones de `BITACORA.md` en las 3 copias | ambos | §3.8 |
| 9 | Correr toda la §6.1 | ambos | §6.1 |
| 10 | Commit en `backend`, luego en `frontend`. **Sin push** | ambos | §4.1 |

### 4.1 Mensajes de commit

`backend` (incluye `iniciar_backend.bat`, `CLAUDE.md`, `BITACORA.md`):

```
feat(deploy): iniciar_backend.bat adaptado al layout separado

ING_DIR=%~dp0backend en vez de la ruta anidada del monorepo, y el host del
5030 fijado en 127.0.0.1: el navegador nunca le habla, solo Flask desde la
misma maquina. Escrito en CRLF porque usa subrutinas y saltos, donde un
batch en LF falla de forma erratica.

Docs al dia con lo aplicado.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

`frontend` (incluye `iniciar_frontend.bat`, borrado de `start.bat`, `projecto.md`,
`Cambios_Agosto.md`, postmortem, `CLAUDE.md`, `BITACORA.md` y este plan):

```
feat(deploy): lanzador de Flask, limpieza de start.bat y docs restauradas

La verificacion por hash de blob contra el monorepo dio 528 archivos
identicos y cero diferencias en codigo fuente. Lo que faltaba era el
entorno de arranque, no el codigo:

- iniciar_frontend.bat: no habia llegado al repo aunque CLAUDE.md ya lo
  documentaba. Entra tal cual, en CRLF.
- start.bat: fuera. Resto de julio, puerto 5001 y el trampolin
  venv\Scripts\python.exe que WDAC bloquea en el 139. Nadie lo llamaba.
- projecto.md y data/bitacora/Cambios_Agosto.md habian retrocedido a antes
  del 26-ago (puertos 8020/8088). Restaurados. El primero adaptado al
  layout de dos repos; el segundo verbatim, porque es historico.
- data/bitacora/ProdIA_agosto_2026.md faltaba entero en la carpeta, que si
  esta versionada. Entra verbatim.
- POSTMORTEM del 26-ago: deja de vivir solo en el monorepo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

---

## 5. Reglas no negociables

1. **No tocar** `app.py`, `chatbot\`, `routes\`, `templates\`, `static\`, `features\`,
   `install.bat`, `iniciar_backends.bat`, `run.bat`, `desplegar_version.bat`,
   `verificar_deploy.ps1`, ni ningún `.py`.
2. **No escribir nada en `ORIG`.** Es solo lectura.
3. **No anidar los repos.** `frontend\` y `backend\` siguen siendo hermanos.
4. **No tocar ningún `.env`** ni añadir remotos de Azure DevOps.
5. **No hacer push.**
6. `Cambios_Agosto.md` y el postmortem se copian **verbatim**. Cero ediciones.
7. Las tres copias de `CLAUDE.md` y de `BITACORA.md` quedan **idénticas**.
8. Si un paso falla o una sustitución no encuentra su texto exacto: **DETENTE** y reporta.
   No improvises un equivalente.

---

## 6. Validación

### 6.1 Estática — la ejecuta el executor

| # | Comando | Resultado esperado |
|---|---|---|
| V1 | `Get-Content 'DEST\backend\iniciar_backend.bat' \| Select-String 'Rep_Prod\|0\.0\.0\.0'` | **Sin salida** |
| V2 | `Get-Content 'DEST\backend\iniciar_backend.bat' \| Select-String 'ING_DIR=%~dp0backend'` | 1 coincidencia |
| V3 | `Test-Path 'DEST\backend\backend\app\main.py'` | `True` (el `ING_DIR` resuelve) |
| V4 | `Compare-Object (Get-Content 'ORIG\iniciar_frontend.bat') (Get-Content 'DEST\frontend\iniciar_frontend.bat')` | **Sin salida** (idénticos línea a línea) |
| V5 | `(Get-Content -Raw 'DEST\frontend\iniciar_frontend.bat').Contains("`r`n")` y lo mismo para el del backend | `True` en ambos (CRLF) |
| V6 | `Get-FileHash` de `data\bitacora\Cambios_Agosto.md` en `ORIG` y en `DEST\frontend` | Hash **igual** |
| V7 | Ídem con `data\bitacora\ProdIA_agosto_2026.md` | Hash **igual** |
| V8 | Ídem con `POSTMORTEM_migracion_puertos_azure_20260826.md` | Hash **igual** |
| V9 | `Get-Content 'DEST\frontend\projecto.md' \| Select-String 'INGESTA/Rep_Prod\|8020\|8088\|3 repos'` | **Sin salida** |
| V10 | `Test-Path 'DEST\frontend\start.bat'` | `False` |
| V11 | `Compare-Object (Get-Content 'DEST\CLAUDE.md') (Get-Content 'DEST\frontend\CLAUDE.md')` y contra `DEST\backend\CLAUDE.md`; ídem `BITACORA.md` | **Sin salida** en los cuatro |
| V12 | `git -C 'DEST\frontend' status --short` | Solo los archivos de §3. Nada más |
| V13 | `git -C 'DEST\backend' status --short` | Solo `iniciar_backend.bat`, `CLAUDE.md`, `BITACORA.md` |
| V14 | `git -C 'DEST\frontend' grep -n 'start.bat'` | Aciertos **solo** en `BITACORA.md` y en `Planes\plan_LAYOUT-LANZADORES_20260829.md` |

> **V1 dice `Rep_Prod`, no `INGESTA`.** El lanzador contiene legítimamente la palabra
> INGESTA en su `echo` y en su mensaje de error. Lo que no debe quedar es la **ruta**
> anidada.
>
> **V11 compara por contenido, no por hash de archivo.** Las copias de `frontend\` y
> `backend\` están versionadas y `core.autocrlf=true` puede reescribirles el fin de línea
> en cualquier `checkout`; la de `DEST\` no. Un `Get-FileHash` daría falsos negativos.

### 6.2 Humana — la valida el usuario

🔴 **Regla R3 de `CLAUDE.md` §10.4: esto NO queda «verificado» aquí.**

En esta máquina **no hay `venv\`, ni `.venv\`, ni Python 3.12** (solo 3.13.15). Los
lanzadores **no se pueden ejecutar**, y por tanto su estado correcto al terminar es
**«implementado, PENDIENTE de validación humana»**.

Lo que falta, y ocurre en el **servidor de pruebas**, no aquí:

1. `install.bat` en `frontend\` y `uv sync` en `backend\backend\`.
2. `.\frontend\iniciar_frontend.bat` → `http://localhost:5029` carga, F12 sin errores.
3. `.\backend\iniciar_backend.bat` → `http://localhost:5030/health` responde.
4. `verificar_deploy.ps1` en verde.
5. Que el 5030 **no** conteste desde otra máquina de la red (confirma el `127.0.0.1`).

---

## 7. Fuera de alcance

Explícitamente **no** entra en este plan:

- Adaptar `iniciar_backends.bat`, `run.bat` y `desplegar_version.bat` al layout separado.
  Los tres siguen asumiendo `%~dp0INGESTA\Rep_Prod\` y no pueden arrancar INGESTA aquí. Son
  una trampa conocida (alguien los correrá, verá Flask arriba y el 5030 caído), pero
  tocarlos es otra tarea.
- Ampliar `verificar_deploy.ps1` para que cubra el backend, los lanzadores y el `ING_DIR`.
  Hoy solo mira `app.py:5029` y los estáticos del login.
- Los dos riesgos del skill `migrar-a-azure` (🟡 Relevante 3): `core.autocrlf` en Pruebas y
  la exclusión `.env` vs `.env*`.
- Arreglar `_test_robustez.py` y `_update_panorama_titles.py`. Deuda preexistente, idéntica
  al monorepo.
- Decidir sobre `DIFERIDAS_MES.csv`, `image.png`, `README.md`, `.codex/`, `.vscode/`.
- Borrar los `.env` locales con credenciales.
- Instalar, arrancar o probar la aplicación.
- Cualquier push.

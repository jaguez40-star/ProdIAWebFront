# Plan `AZURE-SIN-TRAZAS` — Que nada de GitHub `jaguez40-star` ni de Claude llegue a Azure DevOps

**ID tarea:** AZURE-SIN-TRAZAS · **Fecha:** 2026-08-30 · **Versión:** 2 (auditada + re-auditada)
**Repos afectados:** `ProdIAWebFront` (frontend) y `ProdIABack` (backend)

**Alcance:** el skill `migrar-a-azure` y la limpieza de menciones en el código y la
documentación de producto de los dos repos.

**Qué NO se toca:** ninguna lógica de la aplicación. Todas las ediciones de código de este
plan son **comentarios** o **cadenas de exclusión**; ninguna cambia el comportamiento en
ejecución. No se toca `app.py`, ni `routes/api.py` salvo un comentario en `routes/auth.py`,
ni plantillas, ni CSS, ni el Motor Q.

### Decisiones cerradas del usuario

1. **Nada relativo a la cuenta de GitHub `jaguez40-star` puede llegar a Azure DevOps.**
2. **Nada relativo a Claude puede llegar a Azure DevOps.**
3. El executor **no decide** qué se limpia y qué se excluye: está resuelto en la §3.

---

## 0. Contexto para el agente EXECUTOR

No tienes la conversación previa, ni el historial de git, ni memoria. Todo está aquí.

### Qué es esto

**ProdIA** son **dos procesos** en **dos repositorios hermanos** (no anidados):

| | `frontend\` | `backend\` |
|---|---|---|
| Repo | ProdIAWebFront | ProdIABack |
| Stack | Flask + SocketIO + Jinja2 | FastAPI (gestionado con `uv`) |
| Puerto | 5029 | 5030 |

El navegador **nunca** habla con el 5030: Flask hace de proxy interno.

### Rutas absolutas

| Alias | Ruta |
|---|---|
| Repo front | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend` |
| Repo back | `C:\APLICACIONES\ProdIA\Repo ProdIA\backend` |
| Skill a modificar | `C:\APLICACIONES\ProdIA\Repo ProdIA\frontend\.claude\skills\migrar-a-azure\migrar_a_azure.ps1` |

### El pipeline, para que entiendas el porqué

```
LOCAL (sin VPN)         PRUEBAS (con VPN)                        139
editar ──push──> GitHub ──pull──> C:\APLICACIONES\ProdIA\Repo ProdIA
                                        │  (aquí se prueba)
                                        │  skill migrar-a-azure
                                        ▼
                                  C:\APLICACIONES_AZURE\Repo ProdIA
                                        │  (aquí se publica)
                                        └──push──> Azure DevOps `dev` ──> producción
```

El skill copia archivos de una carpeta a otra y **verifica hash por hash** antes de
publicar. Esa verificación existe porque una copia sin verificar fue la causa del incidente
del 2026-08-26 (llegó a producción un `app.py` con el puerto 5007).

### Convenciones obligatorias

- **Español** en código, comentarios, commits y en tu reporte.
- **JavaScript ES5 clásico**: `var` + `function`. Sin arrow functions, sin template
  literals, sin `const`/`let`. (En este plan solo editas comentarios JS, pero la regla
  aplica igual.)
- **PowerShell 5.1**: sin `&&`, sin `||`, sin operador ternario. Los `.ps1` que edites
  deben quedar en **UTF-8 con BOM** — sin BOM, PowerShell 5.1 los lee como ANSI y destroza
  los acentos y los guiones largos.
- **No hacer push.** Ni a GitHub ni a Azure.
- Commits sin `--no-verify`.

---

## 1. Hallazgos de la auditoría

### 🔴 Bloqueante 1 — excluir archivos rompe la verificación hash

`migrar_a_azure.ps1:155-157` construye la lista de rutas a verificar con **todo** lo
versionado en el origen:

```powershell
$mapaSrc  = Get-MapaVersionado $src     # línea 155: TODO lo de git ls-tree
$rutas    = @($mapaSrc.Keys)            # línea 156
```

y en las líneas 217-220 exige que **cada una** de esas rutas exista en el destino con el
mismo hash:

```powershell
foreach ($ruta in $rutas) {
    if (-not $hashDst2.ContainsKey($ruta))        { $fallos.Add("FALTA    $ruta") }
    elseif ($hashDst2[$ruta] -ne $mapaSrc[$ruta]) { $fallos.Add("DIFIERE  $ruta") }
}
```

→ Si añades `Planes` o `CLAUDE.md` a las exclusiones **sin filtrar `$rutas`**, la
verificación reportará `FALTA Planes/...` para cada archivo excluido y **el skill abortará
siempre**. Nunca se podrá publicar.

**Consecuencia de diseño:** la exclusión tiene que aplicarse en **un solo sitio** —una
función `Test-Excluido`— y usarse a la vez para filtrar `$mapaSrc`, para copiar, y para
inspeccionar el destino. Es lo que hace la §3.1.

### 🔴 Bloqueante 2 — no se puede «limpiar al copiar»

La verificación compara el hash de blob del destino contra el del origen. Cualquier archivo
que se modificara durante la copia daría `DIFIERE` y abortaría.

→ **La limpieza de menciones tiene que hacerse en el repo de origen y commitearse allí.**
No hay una tercera vía. Por eso este plan tiene dos mitades: limpiar el origen (§3.3 y
§3.4) y excluir de la migración lo que no se puede limpiar (§3.1).

### 🔴 Bloqueante 3 — `robocopy /MIR` copia el árbol entero, no lo versionado

Línea 200: `$argsRobo = @($src, $dst, '/MIR', ...)`. Las exclusiones son solo `.git`,
`venv`, `.venv`, `.uv`, `node_modules`, `__pycache__`, `.pytest_cache`, `vector_db`,
`flask_session`, `logs`, `dist` y los archivos `.env`, `*.bak`, `*.pyc`.

`git status --porcelain --ignored` sobre el frontend devuelve, **fuera de esas
exclusiones**, todo esto — que hoy viajaría a Azure:

```
.claude/settings.local.json        ← preferencias locales de la herramienta IA
.codex/                            ← configuración de otra herramienta IA
DIFERIDAS_MES.csv
chatbot/.../production_reports - Copy.py
data/ROBUSTEZ.db                   ← 74 MB
data/ROBUSTEZ.zip
data/chat_history.db
image.png
resumen/res_dif_day - Copy.py
temp_chat.txt  temp_section.txt  temp_test_maps.py
```

El `.gitignore` protege el índice de git, **no a robocopy**. Es el mismo mecanismo por el
que Azure arrastra ~151 MB de basura desde julio.

→ **Decisión de diseño: la copia pasa a estar dirigida por la lista versionada filtrada**,
no por el árbol. Se copia exactamente lo que git tiene en HEAD menos lo excluido, y se
borra del destino todo lo demás (respetando las exclusiones, para no tocar su `.env` ni sus
entornos). Esto elimina de raíz toda la clase de problema, y además hace que la
verificación hash y la copia recorran **la misma lista**.

### 🔴 Bloqueante 4 — el propio skill escribe la procedencia en el historial de Azure

`migrar_a_azure.ps1:248-258`:

```powershell
# El SHA de GitHub va en el mensaje: sin esto no hay forma de saber que
# version esta realmente desplegada.
$lineas = @(
    "sync desde GitHub $shaOrigen",
    '',
    $msgOrigen,
    '',
    "Origen   : github.com/jaguez40-star (rama main), commit $shaOrigen",
    ...
```

Eso queda en el historial de Azure de forma permanente e irreversible.

Además `$msgOrigen` (línea 149) es el asunto del último commit del repo de GitHub: texto
que no controlamos y que podría mencionar cualquier cosa.

→ Mensaje neutro. **El SHA se conserva** —es lo único que permite saber qué versión está
desplegada, y siete caracteres hexadecimales no revelan procedencia— pero sin nombrar
GitHub, la cuenta, ni arrastrar `$msgOrigen`.

### 🟡 Relevante 1 — `github.com` genérico NO puede formar parte del chequeo

Hay 4 archivos con `github.com` que son **terceros y no se pueden tocar**:

```
frontend/static/vendor/leaflet/leaflet-heat.js   -> github.com/Leaflet/Leaflet.heat
frontend/static/js/vendor/jszip-3.10.1.min.js    -> github.com/Stuk/jszip
frontend/static/js/vendor/plotly-2.26.0.min.js   -> github.com/d3/d3-format
backend/frontend/package-lock.json               -> 25 URLs de npm
```

Verificado: en esos archivos **no aparece** `claude` ni `jaguez40`, solo `github.com` de
librerías de terceros.

→ **El chequeo busca `claude` y `jaguez40`, no `github.com`.** `jaguez40` es el marcador
preciso de la cuenta; `github.com` genérico es ruido inevitable y bloquearía el pipeline
para siempre.

### 🟡 Relevante 2 — `.gitignore` necesita la palabra para funcionar

`frontend/.gitignore:267-268`:

```
.claude/*
!.claude/skills/
```

Son **reglas funcionales**: si se quitan, `.claude/settings.local.json` empezaría a
versionarse en GitHub. Y no se pueden sustituir por otro texto, porque el nombre de la
carpeta es ese.

→ `.gitignore` entra en una **lista de excepciones explícita** del chequeo, y se le quitan
solo los **comentarios** que nombran `CLAUDE.md` (líneas 208, 263, 265). Las dos reglas se
quedan.

### 🟡 Relevante 3 — `migra.py` también necesita la cadena

`migra.py:54` incluye `".claude"` dentro de la lista de carpetas que el empaquetador
excluye del zip. Es funcional: si se quita, `migra.py` empezaría a empaquetar esa carpeta.

→ Igual que `.gitignore`: entra en las excepciones del chequeo, y se limpian sus dos
**comentarios** (líneas 15 y 156). La línea 54 se queda.

### 🟡 Relevante 4 — `data/bitacora/` es histórico y no se debe reescribir

`data/bitacora/Cambios_Julio.md` menciona la herramienta. Pero el pie de
`Cambios_Agosto.md` dice que las entradas fechadas *«son histórico y no se tocan»*, y el
2026-08-29 ya se restauró ese archivo **verbatim** por esa misma razón.

Verificado con `git grep` sobre `*.py`, `*.js` y `*.html`: **ningún código lee
`data/bitacora/`**.

→ Se **excluye de la migración** en vez de reescribirse. Se preserva el histórico intacto
en GitHub y no llega a Azure. Es la única opción que respeta las dos reglas a la vez.

### 🟢 Confirmación — ningún archivo de código depende de esto funcionalmente

De los 7 archivos de código con menciones, **todas son comentarios** salvo las dos cadenas
de exclusión ya citadas (`.gitignore:267-268`, `migra.py:54`):

```
routes/auth.py:127                    comentario
static/js/dailyPerformanceReport.js:8 comentario de cabecera @author
static/js/monthlyBalanceReport.js:9   comentario de cabecera @author
static/js/reportTabs.js:7             comentario de cabecera @author
static/js/multitab_shell.js:5945      comentario
static/js/multitab_shell.js:6040      comentario
MainChat/static/js/historial.js:357   comentario
```

→ Riesgo funcional de la limpieza: **cero**. Aun así, `multitab_shell.js` es archivo
compartido (`CLAUDE.md` §10.2), así que la §5 prohíbe tocar en él nada que no sean esas dos
líneas.

### 🟢 Confirmación — inventario cerrado

`git grep -i -e claude -e jaguez40` sobre lo versionado, **excluyendo** lo que la §3.1 va a
excluir de la migración y los archivos de terceros, devuelve exactamente **17 líneas en 13
archivos del frontend** y **4 líneas en 2 archivos del backend**. Están todas listadas, una
por una, en §3.3 y §3.4. No hay ninguna más.

### 🟢 Confirmación — precedente del patrón que se va a clonar

La función `Get-ArchivosReales` (`migrar_a_azure.ps1:81-95`) ya implementa exactamente la
lógica de exclusión que hace falta:

```powershell
$partes = $rel.Split('/')
$excl   = $false
foreach ($d in $ExcluirDirs)     { if ($partes -contains $d)  { $excl = $true; break } }
if (-not $excl) {
    foreach ($f in $ExcluirArchivos) { if ($_.Name -like $f) { $excl = $true; break } }
}
```

→ La §3.1 **extrae ese bloque a una función** `Test-Excluido` y lo reutiliza en los cuatro
sitios. No se inventa un mecanismo nuevo: se saca el que ya existe.

### 🟢 Confirmación — la copia dirigida por `git ls-tree` es segura aquí

Riesgo teórico: git **entrecomilla y escapa** las rutas con caracteres no ASCII
(`core.quotepath`), y una ruta escapada rompería el `Copy-Item` de la §3.1.d — que con
`robocopy /MIR` no pasaba, porque espejaba el árbol sin mirar nombres.

Medido en los dos repos:

```
rutas con caracteres no ASCII : 0
rutas entrecomilladas por git : 0
```

→ No hace falta `-c core.quotepath=false`. El riesgo no se materializa.

### 🟢 Confirmación — el chequeo no dará falsos positivos por binarios

De los 547 archivos versionados de los dos repos, los que contienen `claude` o `jaguez40`
son **29 en frontend y 47 en backend, todos de texto**. Ningún `.png`, `.db`, `.xlsx`,
`.zip` ni fuente coincide.

Aun así la §3.1.b salta los binarios por extensión: hoy no hay falsos positivos, pero un
`.db` que mañana los tuviera bloquearía el pipeline sin motivo real.

Volumen del chequeo: **26 MB** en ~550 archivos. Segundos.

### 🟢 Confirmación — excluir `Planes/`, `clmd/` y `data/bitacora/` no rompe nada

`git grep` sobre `*.py`, `*.js`, `*.html`, `*.ps1`, `*.bat` y `*.toml` en los dos repos, con
los patrones `Planes/`, `clmd` y `data/bitacora`: **sin resultados**. Ningún código las
lee, ningún script las referencia.

### 🟡 Relevante 5 — lo que ya esté en Azure no se borra solo

`Get-ArchivosReales` aplica las exclusiones también al **destino**. Un archivo excluido que
ya exista en Azure (por ejemplo `Planes/`, que está allí desde julio) no aparecerá en
`$sobran` y por tanto **no se borrará nunca**.

→ La §6.2 incluye una comprobación humana explícita sobre el checkout de Azure, y la §3.1
añade al informe una sección **«RESTOS A BORRAR A MANO EN EL DESTINO»** que los lista sin
tocarlos. Borrarlos requiere VPN y decisión del usuario: **fuera del alcance de este plan**
(§7).

---

## 2. Estado actual

Ambos repos limpios y sincronizados con `origin/main`.

```
frontend  HEAD 472d9d3   (sin subir a GitHub: 472d9d3)
backend   HEAD db3d9e0   (sin subir a GitHub: db3d9e0)
```

`migrar_a_azure.ps1` tiene **279 líneas** y **nunca se ha ejecutado**. El checkout de
destino `C:\APLICACIONES_AZURE\Repo ProdIA` **todavía no existe** en el servidor de
pruebas.

Exclusiones actuales del skill (líneas 57-59):

```powershell
$ExcluirDirs     = @('.git', 'venv', '.venv', '.uv', 'node_modules', '__pycache__',
                     '.pytest_cache', 'vector_db', 'flask_session', 'logs', 'dist')
$ExcluirArchivos = @('.env', '*.bak', '*.pyc')
```

---

## 3. Especificación

### 3.1 MODIFICAR — `frontend\.claude\skills\migrar-a-azure\migrar_a_azure.ps1`

> El archivo debe quedar en **UTF-8 con BOM**. Compruébalo al final (V1 de la §6.1).

#### 3.1.a — Exclusiones y función única

**Localiza** las líneas 55-59:

```powershell
# Carpetas y archivos que NUNCA se copian: son propios de cada maquina o
# regenerables. Copiar un .env pisaria las credenciales del destino.
$ExcluirDirs     = @('.git', 'venv', '.venv', '.uv', 'node_modules', '__pycache__',
                     '.pytest_cache', 'vector_db', 'flask_session', 'logs', 'dist')
$ExcluirArchivos = @('.env', '*.bak', '*.pyc')
```

**Sustituye por:**

```powershell
# Carpetas y archivos que NUNCA se copian: son propios de cada maquina o
# regenerables. Copiar un .env pisaria las credenciales del destino.
$ExcluirDirs     = @('.git', 'venv', '.venv', '.uv', 'node_modules', '__pycache__',
                     '.pytest_cache', 'vector_db', 'flask_session', 'logs', 'dist')
$ExcluirArchivos = @('.env', '*.bak', '*.pyc')

# Rutas relativas (carpetas o archivos) que no deben salir de este repositorio.
# Son documentacion interna del equipo y procedimientos de trabajo: no forman
# parte del producto que se despliega.
$ExcluirRutas = @(
    '.claude',
    '.codex',
    'Planes',
    'clmd',
    'data/bitacora',
    'CLAUDE.md',
    'BITACORA.md'
)

# Terminos que no deben aparecer en NINGUN archivo publicado.
# 'github.com' a secas queda fuera a proposito: aparece en librerias de terceros
# (leaflet, jszip, plotly, package-lock.json) y bloquearia el pipeline para
# siempre. El marcador preciso de la cuenta de origen es 'jaguez40'.
$TerminosProhibidos = @('claude', 'jaguez40')

# Archivos donde el termino es estructuralmente necesario y no se puede quitar:
#   .gitignore -> la regla '.claude/*' deja de ignorar la carpeta si se cambia
#   migra.py   -> la lista de exclusion del empaquetador nombra esa carpeta
$ExentosDelChequeo = @('.gitignore', 'migra.py')


# Unico sitio donde se decide si una ruta relativa se migra o no.
# Se usa para filtrar lo versionado, para copiar, para inspeccionar el destino
# y para el chequeo de trazas: si divergieran, la verificacion daria falsos
# fallos y el skill no podria publicar nunca.
function Test-Excluido([string] $RutaRelativa) {
    # OJO: PowerShell NO distingue mayusculas en los nombres de variable. Usar
    # $rel dentro de una funcion cuyo parametro es $Rel machaca el parametro.
    # Por eso aqui los nombres son distintos de verdad.
    $normalizada = $RutaRelativa.Replace('\', '/')
    $partes      = $normalizada.Split('/')
    $nombre      = $partes[-1]

    foreach ($d in $ExcluirDirs)     { if ($partes -contains $d) { return $true } }
    foreach ($f in $ExcluirArchivos) { if ($nombre -like $f)     { return $true } }
    foreach ($p in $ExcluirRutas) {
        if ($normalizada -eq $p -or $normalizada.StartsWith($p + '/')) { return $true }
    }
    return $false
}
```

#### 3.1.b — `Get-ArchivosReales` pasa a usar la función

**Localiza** las líneas 79-95 (la función entera):

```powershell
# Archivos realmente presentes en una carpeta, aplicando las mismas exclusiones
# que usara robocopy. Sirve para detectar los que sobran en el destino.
function Get-ArchivosReales([string] $Raiz) {
    if (-not (Test-Path $Raiz)) { return @() }
    $res = New-Object System.Collections.Generic.List[string]
    Get-ChildItem $Raiz -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $rel    = $_.FullName.Substring($Raiz.Length + 1).Replace('\', '/')
        $partes = $rel.Split('/')
        $excl   = $false
        foreach ($d in $ExcluirDirs)     { if ($partes -contains $d)  { $excl = $true; break } }
        if (-not $excl) {
            foreach ($f in $ExcluirArchivos) { if ($_.Name -like $f) { $excl = $true; break } }
        }
        if (-not $excl) { $res.Add($rel) }
    }
    return $res
}
```

**Sustituye por:**

```powershell
# Archivos realmente presentes en una carpeta, aplicando las mismas exclusiones
# que la copia. Sirve para detectar los que sobran en el destino.
function Get-ArchivosReales([string] $Raiz) {
    if (-not (Test-Path $Raiz)) { return @() }
    $res = New-Object System.Collections.Generic.List[string]
    Get-ChildItem $Raiz -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $rel = $_.FullName.Substring($Raiz.Length + 1).Replace('\', '/')
        if (-not (Test-Excluido $rel)) { $res.Add($rel) }
    }
    return $res
}

# Archivos presentes en el destino que estan EXCLUIDOS de la migracion. No se
# copian ni se borran: si ya estaban en Azure (por ejemplo Planes/ desde julio),
# hay que retirarlos a mano. Solo se informan.
function Get-RestosExcluidos([string] $Raiz) {
    if (-not (Test-Path $Raiz)) { return @() }
    $res = New-Object System.Collections.Generic.List[string]
    Get-ChildItem $Raiz -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $rel    = $_.FullName.Substring($Raiz.Length + 1).Replace('\', '/')
        $partes = $rel.Split('/')
        $nombre = $partes[-1]
        $tecnico = $false
        foreach ($d in $ExcluirDirs)     { if ($partes -contains $d) { $tecnico = $true; break } }
        if (-not $tecnico) {
            foreach ($f in $ExcluirArchivos) { if ($nombre -like $f) { $tecnico = $true; break } }
        }
        # Solo interesan los excluidos "por politica", no los tecnicos (.git, venv...)
        if (-not $tecnico -and (Test-Excluido $rel)) { $res.Add($rel) }
    }
    return $res
}

# Recorre los archivos publicados buscando trazas del origen. Es lo que de
# verdad garantiza el requisito: una lista de exclusiones se queda corta en
# cuanto alguien anade un archivo nuevo; esto mide el resultado.
function Find-Trazas([string] $Raiz, $Rutas) {
    $binarios  = @('.png','.jpg','.jpeg','.gif','.ico','.woff','.woff2','.ttf','.eot',
                   '.db','.zip','.xlsx','.xls','.pdf','.pyc','.dll','.exe')
    $hallazgos = New-Object System.Collections.Generic.List[string]
    foreach ($ruta in $Rutas) {
        $nombre = $ruta.Split('/')[-1]
        if ($ExentosDelChequeo -contains $nombre) { continue }
        if ($binarios -contains [System.IO.Path]::GetExtension($nombre).ToLower()) { continue }
        $full = Join-Path $Raiz $ruta
        if (-not (Test-Path -LiteralPath $full)) { continue }
        $texto = [System.IO.File]::ReadAllText($full)
        foreach ($t in $TerminosProhibidos) {
            if ($texto -match [regex]::Escape($t)) {
                $hallazgos.Add(("{0}  ->  '{1}'" -f $ruta, $t))
                break
            }
        }
    }
    return $hallazgos
}
```

#### 3.1.c — Filtrar lo versionado

**Localiza** las líneas 155-158:

```powershell
    $mapaSrc  = Get-MapaVersionado $src
    $rutas    = @($mapaSrc.Keys)
    $hashDst  = Get-HashesDe $dst $rutas
    $realDst  = Get-ArchivosReales $dst
```

**Sustituye por:**

```powershell
    # Se filtra lo versionado ANTES de nada: si no, la verificacion hash de mas
    # abajo pediria en el destino archivos que hemos decidido no copiar, y
    # abortaria siempre.
    $mapaCompleto = Get-MapaVersionado $src
    $mapaSrc = @{}
    foreach ($k in $mapaCompleto.Keys) {
        if (-not (Test-Excluido $k)) { $mapaSrc[$k] = $mapaCompleto[$k] }
    }
    $omitidos = $mapaCompleto.Count - $mapaSrc.Count
    if ($omitidos -gt 0) {
        Write-Host ("  No se migran {0} archivos versionados (documentacion interna)." -f $omitidos) -ForegroundColor DarkGray
    }

    $rutas    = @($mapaSrc.Keys)
    $hashDst  = Get-HashesDe $dst $rutas
    $realDst  = Get-ArchivosReales $dst
```

#### 3.1.d — Copia dirigida por la lista, en vez de espejo del árbol

**Localiza** las líneas 194-208:

```powershell
    # -----------------------------------------------------------------------
    #  Copiar
    # -----------------------------------------------------------------------
    Write-Host ''
    Write-Host '  Copiando...' -ForegroundColor Cyan

    $argsRobo = @($src, $dst, '/MIR', '/NFL', '/NDL', '/NP', '/NJH', '/NJS', '/R:2', '/W:2')
    $argsRobo += '/XD'; $argsRobo += $ExcluirDirs
    $argsRobo += '/XF'; $argsRobo += $ExcluirArchivos

    & robocopy @argsRobo | Out-Null
    $codigo = $LASTEXITCODE

    # robocopy devuelve 0-7 en exito. Solo 8 o mas es error real.
    if ($codigo -ge 8) { throw "robocopy fallo en '$r' con codigo $codigo." }
```

**Sustituye por:**

```powershell
    # -----------------------------------------------------------------------
    #  Copiar
    # -----------------------------------------------------------------------
    Write-Host ''
    Write-Host '  Copiando...' -ForegroundColor Cyan

    # La copia va dirigida por la lista de lo versionado y NO excluido, no por
    # un espejo del arbol. Con /MIR viajaban tambien los archivos ignorados por
    # git -- .codex\, temp_*, *.db, copias " - Copy" -- porque .gitignore no
    # tiene efecto sobre robocopy. Asi se publica exactamente lo que git tiene.
    foreach ($rel in $rutas) {
        $origenArch  = Join-Path $src $rel
        $destinoArch = Join-Path $dst $rel
        $carpeta     = Split-Path $destinoArch -Parent
        if (-not (Test-Path -LiteralPath $carpeta)) {
            New-Item -ItemType Directory -Path $carpeta -Force | Out-Null
        }
        Copy-Item -LiteralPath $origenArch -Destination $destinoArch -Force
    }

    # Borrar del destino lo que sobra, para que los borrados tambien viajen. Sin
    # esto, un archivo eliminado en origen sobrevive para siempre en Azure.
    # Get-ArchivosReales ya respeta las exclusiones, asi que ni el .env ni los
    # entornos del destino se tocan.
    foreach ($rel in (Get-ArchivosReales $dst)) {
        if (-not $mapaSrc.ContainsKey($rel)) {
            Remove-Item -LiteralPath (Join-Path $dst $rel) -Force -ErrorAction SilentlyContinue
        }
    }

    # Carpetas que hayan quedado vacias tras los borrados. Se aplica la MISMA
    # exclusion: sin esto, el barrido entraria en el venv\ y el node_modules\
    # del destino y les borraria carpetas vacias. De mas profunda a menos, para
    # que una carpeta que queda vacia al vaciarse su hija tambien caiga.
    Get-ChildItem $dst -Recurse -Directory -Force -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
            $relDir = $_.FullName.Substring($dst.Length + 1)
            if (-not (Test-Excluido $relDir) -and
                -not (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue)) {
                Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
            }
        }
```

#### 3.1.e — Chequeo de trazas, después de verificar hashes

**Localiza** la línea 229 y la 231:

```powershell
    Write-Host ("  OK: {0} archivos identicos al origen." -f $rutas.Count) -ForegroundColor Green

    if (-not $Push) {
```

**Sustituye por:**

```powershell
    Write-Host ("  OK: {0} archivos identicos al origen." -f $rutas.Count) -ForegroundColor Green

    # -----------------------------------------------------------------------
    #  Que no viaje ninguna traza del repositorio de origen ni de las
    #  herramientas de trabajo. Se mide sobre lo YA copiado, no sobre lo que
    #  se pretendia copiar.
    # -----------------------------------------------------------------------
    Write-Host '  Buscando trazas del origen...' -ForegroundColor Cyan
    $trazas = Find-Trazas $dst $rutas
    if ($trazas.Count -gt 0) {
        Write-Host ''
        Write-Host '  HAY TRAZAS DEL ORIGEN EN LO COPIADO. No se publica nada.' -ForegroundColor Red
        $trazas | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        if ($trazas.Count -gt 20) { Write-Host ("    ... y {0} mas" -f ($trazas.Count - 20)) -ForegroundColor Red }
        throw "Chequeo de trazas fallido en '$r': $($trazas.Count) archivo(s)."
    }
    Write-Host '  OK: sin trazas del origen.' -ForegroundColor Green

    # Restos de migraciones anteriores que ahora estan excluidos: no se tocan,
    # pero conviene saber que siguen ahi.
    $restos = Get-RestosExcluidos $dst
    if ($restos.Count -gt 0) {
        # Cuales de esos restos llevan ademas una traza dentro: son los urgentes.
        $restosConTraza = @(Find-Trazas $dst $restos | ForEach-Object { $_.Split(' ')[0] })
        Write-Host ''
        Write-Host ('  -- RESTOS A BORRAR A MANO EN EL DESTINO ({0}) --' -f $restos.Count) -ForegroundColor Magenta
        Write-Host '     (excluidos de la migracion, pero ya presentes en el destino)' -ForegroundColor DarkGray
        Write-Host ('     con traza dentro: {0}  -- estos son los urgentes' -f $restosConTraza.Count) -ForegroundColor Magenta
        $restos | Select-Object -First 25 | ForEach-Object {
            $marca = if ($restosConTraza -contains $_) { '!' } else { ' ' }
            Write-Host ("   {0} {1}" -f $marca, $_)
        }
        if ($restos.Count -gt 25) { Write-Host ("     ... y {0} mas" -f ($restos.Count - 25)) }
    }

    if (-not $Push) {
```

#### 3.1.f — Mensaje de commit neutro

**Localiza** las líneas 248-258:

```powershell
    # El SHA de GitHub va en el mensaje: sin esto no hay forma de saber que
    # version esta realmente desplegada.
    $lineas = @(
        "sync desde GitHub $shaOrigen",
        '',
        $msgOrigen,
        '',
        "Origen   : github.com/jaguez40-star (rama main), commit $shaOrigen",
        "Migrado  : $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
        "Verificado: $($rutas.Count) archivos, hash de blob identico al origen."
    )
```

**Sustituye por:**

```powershell
    # El SHA del repositorio de trabajo va en el mensaje: sin esto no hay forma
    # de saber que version esta realmente desplegada. Es un identificador opaco
    # de siete caracteres, no dice de donde viene. El asunto del commit de
    # origen NO se copia: es texto que este script no controla.
    $lineas = @(
        "sync $shaOrigen",
        '',
        "Version    : $shaOrigen",
        "Publicado  : $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
        "Verificado : $($rutas.Count) archivos, hash de blob identico al origen,",
        "             sin trazas del repositorio de trabajo."
    )
```

#### 3.1.g — Retirar la referencia del encabezado del script

**Localiza** las líneas 6-12:

```powershell
.DESCRIPTION
    Pensado para el servidor de pruebas, donde conviven dos carpetas separadas:

        C:\APLICACIONES\ProdIA\Repo ProdIA    -> clon de GitHub (aqui se prueba)
        C:\APLICACIONES_AZURE\Repo ProdIA     -> clon de Azure DevOps (aqui se publica)

    Cada una tiene su propio .git y su unico remoto; no se mezclan.
```

**Sustituye por:**

```powershell
.DESCRIPTION
    Pensado para el servidor de pruebas, donde conviven dos carpetas separadas:

        C:\APLICACIONES\ProdIA\Repo ProdIA    -> repositorio de trabajo (aqui se prueba)
        C:\APLICACIONES_AZURE\Repo ProdIA     -> clon de Azure DevOps (aqui se publica)

    Cada una tiene su propio .git y su unico remoto; no se mezclan.

    Solo se publica lo que git tiene versionado, menos la documentacion interna
    del equipo. Antes de publicar se verifica hash por hash y se comprueba que
    no viaje ninguna traza del repositorio de origen.
```

Quedan **dos** menciones sueltas más. Sustitúyelas por su texto exacto:

Buscar: `    Migra los cambios ya probados desde el checkout de GitHub hacia el checkout`
Sustituir: `    Migra los cambios ya probados desde el repositorio de trabajo hacia el checkout`

Buscar: `    # publique en Azure no correspondera a ningun commit de GitHub.`
Sustituir: `    # publique en Azure no correspondera a ningun commit.`

> Nota: `.claude\` queda excluido de la migración, así que este archivo **no viaja**. Se
> limpia igualmente por coherencia: el día que alguien lo abra, no debe leer una
> procedencia que ya no queremos nombrar.

### 3.2 MODIFICAR — `frontend\.claude\skills\migrar-a-azure\SKILL.md`

**Localiza** las líneas 13-16:

```
C:\APLICACIONES\ProdIA\Repo ProdIA        -> clon de GitHub    (aqui se prueba)
C:\APLICACIONES_AZURE\Repo ProdIA         -> clon de Azure     (aqui se publica)
```

**Sustituye por:**

```
C:\APLICACIONES\ProdIA\Repo ProdIA        -> repositorio de trabajo (aqui se prueba)
C:\APLICACIONES_AZURE\Repo ProdIA         -> clon de Azure          (aqui se publica)
```

**Localiza** el bloque de las líneas 30-37 y **sustituye** su contenido por:

```
REPO DE TRABAJO (con VPN)              AZURE                    139
editar ──push──> repo ──pull──> Repo ProdIA
                                  (probar)
                                     │  ESTE SKILL
                                     ▼
                               APLICACIONES_AZURE ──push──> Azure DevOps ──> prod
```

**Localiza** la línea 85 y **sustituye**:

```
4. **Excluye lo que nunca debe copiarse**: `.git`, `venv`, `.venv`,
```

por:

```
4. **Publica solo lo versionado y no excluido.** La copia va dirigida por
   `git ls-tree`, no por un espejo del arbol: asi no viajan los archivos que
   git ignora (`.codex/`, `temp_*`, `*.db`, copias ` - Copy`). Ademas excluye
   la documentacion interna del equipo (`.claude`, `Planes`, `clmd`,
   `data/bitacora`, `CLAUDE.md`, `BITACORA.md`) y, como siempre, `.git`,
   `venv`, `.venv`,
```

**Añade** al final del archivo, antes de la última línea:

```markdown
## El chequeo de trazas

Despues de verificar los hashes y **antes** de commitear, el script recorre todo
lo copiado buscando `claude` y `jaguez40`. Si aparece uno solo, aborta y no
publica nada.

`github.com` a secas **no** forma parte del chequeo, a proposito: aparece en
librerias de terceros (`leaflet-heat.js`, `jszip`, `plotly`, `package-lock.json`)
y bloquearia el pipeline para siempre.

Dos archivos estan exentos porque el termino les es estructural: `.gitignore`
(la regla que ignora la carpeta de herramientas) y `migra.py` (su lista de
exclusion). Cambiarles el texto los rompe.

Si el chequeo falla, la solucion **nunca** es anadir el archivo a los exentos:
es limpiar el texto en el repositorio de origen y volver a migrar.
```

### 3.3 MODIFICAR — limpieza de menciones en el repo **frontend**

Son 17 líneas en 13 archivos. **Cada sustitución es exacta.** Si alguna no aparece
literalmente, detente y reporta (§5.8).

| # | Archivo | Línea |
|---|---|---|
| a | `.gitignore` | 208, 263, 265 |
| b | `DISENO_CAPA_CONVERSACIONAL.md` | 8, 9, 210, 533 |
| c | `MainChat/static/js/historial.js` | 357 |
| d | `ProdIA_Jun.md` | 42, 50, 94, 95, 199 |
| e | `arq_log.md` | 108 |
| f | `changesProdIA_last.md` | 4 |
| g | `migra.py` | 15, 156 |
| h | `projecto.md` | 117, 130 |
| i | `routes/auth.py` | 127 |
| j | `static/js/dailyPerformanceReport.js` | 8 |
| k | `static/js/monthlyBalanceReport.js` | 9 |
| l | `static/js/multitab_shell.js` | 5945, 6040 |
| m | `static/js/reportTabs.js` | 7 |

---

**a) `.gitignore`** — tres comentarios. **Las reglas de las líneas 267-268 NO se tocan.**

Buscar:
```
# CLAUDE.md SI se versiona: es la guia de trabajo del proyecto.
```
Sustituir por:
```
# La guia de trabajo del proyecto SI se versiona.
```

Buscar:
```
# Excepcion: .claude/skills/ SI se versiona — son procedimientos del proyecto
# (p.ej. migrar-a-azure), no preferencias de una maquina.
# Nota: hay que ignorar ".claude/*" y no ".claude/", porque git no entra en un
# directorio ignorado y la negacion de mas abajo nunca se evaluaria.
```
Sustituir por:
```
# Excepcion: la subcarpeta skills/ SI se versiona — son procedimientos del
# proyecto (p.ej. migrar-a-azure), no preferencias de una maquina.
# Nota: hay que ignorar el patron con /* y no con /, porque git no entra en un
# directorio ignorado y la negacion de mas abajo nunca se evaluaria.
```

---

**b) `DISENO_CAPA_CONVERSACIONAL.md`** — cuatro referencias a la guía del proyecto.

Buscar: `> **Fecha de acuerdo:** 2026-07-08 · **Referenciado desde:** \`CLAUDE.md\` (§10) ·`
Sustituir: `> **Fecha de acuerdo:** 2026-07-08 · **Referenciado desde:** la guia del proyecto (§10) ·`

Buscar: `> **Fuente base:** \`Ambi.md\`, \`INGESTA/Rep_Prod/CLAUDE.md\``
Sustituir: `> **Fuente base:** \`Ambi.md\`, la guia del sub-proyecto de INGESTA`

Buscar: `con contraseña** (firma OLE2, openpyxl los rechaza; ver \`INGESTA/Rep_Prod/CLAUDE.md\` bitácora S14) → no`
Sustituir: `con contraseña** (firma OLE2, openpyxl los rechaza; ver la bitacora S14 del sub-proyecto) → no`

Buscar: `- \`INGESTA/Rep_Prod/CLAUDE.md\` — modelo de datos (star schema), DDL, flujo audit-first.`
Sustituir: `- Guia del sub-proyecto de INGESTA — modelo de datos (star schema), DDL, flujo audit-first.`

---

**c) `MainChat/static/js/historial.js:357`**

Buscar: `    // de Claude que pidió el usuario.`
Sustituir: `    // de referencia que pidió el usuario.`

---

**d) `ProdIA_Jun.md`** — cinco líneas.

Buscar: `- **Archivos afectados:** \`Doc_Desing/\` (muestras), \`CLAUDE.md\``
Sustituir: `- **Archivos afectados:** \`Doc_Desing/\` (muestras), la guia del proyecto`

Buscar: `- **Archivos afectados:** \`CLAUDE.md\` del sub-proyecto`
Sustituir: `- **Archivos afectados:** la guia del sub-proyecto`

Buscar: `#### S8 — Documentación del agente (CLAUDE.md)`
Sustituir: `#### S8 — Documentación del agente`

Buscar: `Se añadieron al \`CLAUDE.md\` del sub-proyecto: modos de operación por prefijo`
Sustituir: `Se añadieron a la guia del sub-proyecto: modos de operación por prefijo`

Buscar: `*Generado el 2026-06-29 — Fuente: análisis de sistema de archivos + \`INGESTA/Rep_Prod/CLAUDE.md §12\`*`
Sustituir: `*Generado el 2026-06-29 — Fuente: análisis de sistema de archivos + guia del sub-proyecto §12*`

---

**e) `arq_log.md:108`**

Buscar: `| Roles "Admin / Limitado" por campo asignado | Ajeno a este repositorio — descripción tomada de la memoria de otro proyecto guardada como referencia | \`clmd/CLAUDE_muestra.md:156\` |`
Sustituir: `| Roles "Admin / Limitado" por campo asignado | Ajeno a este repositorio — descripción tomada de la memoria de otro proyecto guardada como referencia | documentacion de referencia interna, linea 156 |`

---

**f) `changesProdIA_last.md:4`**

Buscar: `> ningún commit, y el 12 tampoco. La bitácora del \`CLAUDE.md\` sigue cerrada en 2026-08-04, así que`
Sustituir: `> ningún commit, y el 12 tampoco. La bitácora de la guia sigue cerrada en 2026-08-04, así que`

---

**g) `migra.py`** — dos comentarios. **La línea 54 (`".claude",`) NO se toca:** es la lista
de exclusión real del empaquetador.

Buscar: `caches, .claude) y datos PESADOS que viajan aparte:`
Sustituir: `caches, herramientas locales) y datos PESADOS que viajan aparte:`

Buscar: `        "- Entornos/caches/builds: venv, .venv, node_modules, dist, __pycache__, .git, .claude, etc.",`
Sustituir: `        "- Entornos/caches/builds: venv, .venv, node_modules, dist, __pycache__, .git, etc.",`

---

**h) `projecto.md`** — dos líneas.

Buscar:
```
El **origen de trabajo es GitHub `jaguez40-star`** (`ProdIAWebFront` y `ProdIABack`), porque
la maquina local no tiene VPN y no alcanza Azure DevOps. El flujo es: editar en local →
push a GitHub → pull en el servidor de pruebas → verificar → publicar en Azure DevOps `dev`
(rama con politicas: no admite push directo) → servidor 139.
```
Sustituir por:
```
El **origen de trabajo es un repositorio externo** (`ProdIAWebFront` y `ProdIABack`), porque
la maquina local no tiene VPN y no alcanza Azure DevOps. El flujo es: editar en local →
push al repositorio de trabajo → pull en el servidor de pruebas → verificar → publicar en
Azure DevOps `dev` (rama con politicas: no admite push directo) → servidor 139.
```

Buscar:
```
- `.claude\skills\migrar-a-azure\migrar_a_azure.ps1`: puente hacia el checkout de Azure,
  con verificacion de fidelidad hash por hash.
```
Sustituir por:
```
- Script `migrar_a_azure.ps1` (en la carpeta de procedimientos del equipo): puente hacia el
  checkout de Azure, con verificacion de fidelidad hash por hash.
```

---

**i) `routes/auth.py:127`**

Buscar: `        # Lección de Eficiencias (bug #11 en CLAUDE.md de Landing): si el shape difiere,`
Sustituir: `        # Lección de Eficiencias (bug #11 documentado en la guia de Landing): si el shape difiere,`

---

**j) `static/js/dailyPerformanceReport.js:8`**
**k) `static/js/monthlyBalanceReport.js:9`**
**m) `static/js/reportTabs.js:7`**

En los tres, buscar la línea:
```
 * @author Claude Code
```
y **borrarla entera** (la línea completa, no dejar un `*` suelto).

---

**l) `static/js/multitab_shell.js`** — dos comentarios. 🔴 **Archivo compartido: no toques
nada más en él.**

Buscar: `    // bienvenida de claude.ai). Se retiró el menú de tres categorías —Estructura /`
Sustituir: `    // bienvenida de una interfaz conversacional de referencia). Se retiró el menú de tres categorías —Estructura /`

Buscar: `  // [2026-08-24] Estado de INICIO (petición del usuario, referencia claude.ai): mientras la`
Sustituir: `  // [2026-08-24] Estado de INICIO (petición del usuario, referencia de una interfaz conversacional): mientras la`

### 3.4 MODIFICAR — limpieza de menciones en el repo **backend**

Son 4 líneas en 2 archivos.

**`analiza.md`** — tres líneas.

Buscar: `> **Audiencia:** Claude Code / el desarrollador que construya el responder de Analizar.`
Sustituir: `> **Audiencia:** el desarrollador que construya el responder de Analizar.`

Buscar: `> bloqueos de datos vienen de la sesión de análisis del 2026-07-30 (bitácora CLAUDE.md padre).`
Sustituir: `> bloqueos de datos vienen de la sesión de análisis del 2026-07-30 (bitácora de la guia padre).`

Buscar: `Bloqueos de datos: sesión de análisis del 2026-07-30 (bitácora CLAUDE.md padre). Hermano de \`cuant.md\`.*`
Sustituir: `Bloqueos de datos: sesión de análisis del 2026-07-30 (bitácora de la guia padre). Hermano de \`cuant.md\`.*`

**`cuant.md`** — una línea.

Buscar: `> **Audiencia:** Claude Code / el desarrollador que construya el responder de Cuantificar.`
Sustituir: `> **Audiencia:** el desarrollador que construya el responder de Cuantificar.`

---

## 4. Orden de ejecución

El orden importa: la función `Test-Excluido` (paso 1) tiene que existir antes que los
sitios que la llaman (pasos 2 y 3), o el script queda inválido a medias.

| # | Acción | Archivo | Ref |
|---|---|---|---|
| 1 | Exclusiones, términos, exentos y `Test-Excluido` | `migrar_a_azure.ps1` | §3.1.a |
| 2 | `Get-ArchivosReales` + `Get-RestosExcluidos` + `Find-Trazas` | `migrar_a_azure.ps1` | §3.1.b |
| 3 | Filtrar `$mapaSrc` | `migrar_a_azure.ps1` | §3.1.c |
| 4 | Copia dirigida por lista | `migrar_a_azure.ps1` | §3.1.d |
| 5 | Chequeo de trazas + informe de restos | `migrar_a_azure.ps1` | §3.1.e |
| 6 | Mensaje de commit neutro | `migrar_a_azure.ps1` | §3.1.f |
| 7 | Encabezado y `.SYNOPSIS` | `migrar_a_azure.ps1` | §3.1.g |
| 8 | Documentación del skill | `SKILL.md` | §3.2 |
| 9 | Limpieza de 17 líneas en 13 archivos | repo frontend | §3.3 |
| 10 | Limpieza de 4 líneas en 2 archivos | repo backend | §3.4 |
| 11 | Correr toda la §6.1 | — | §6.1 |
| 12 | Commit en `backend`, luego en `frontend`. **Sin push** | ambos | §4.1 |

### 4.1 Mensajes de commit

`backend` (`analiza.md`, `cuant.md`):

```
docs: retira menciones a la herramienta de trabajo en analiza y cuant

Ninguna era funcional: las cuatro estaban en lineas de "Audiencia" y en
referencias a la bitacora de la guia padre.

Parte del requisito de que lo publicado en Azure DevOps no lleve trazas
del repositorio de trabajo ni de las herramientas del equipo.
```

`frontend` (el skill, su documentación, los 13 archivos y este plan):

```
feat(deploy): el skill no publica trazas del repositorio de trabajo

La copia pasa a estar dirigida por `git ls-tree` en vez de robocopy /MIR.
Con el espejo viajaban a Azure los archivos que git ignora --.codex\,
temp_*, *.db, copias " - Copy"-- porque .gitignore no tiene efecto sobre
robocopy: es el mismo mecanismo por el que Azure arrastra 151 MB desde
julio. Ahora se publica exactamente lo versionado y no excluido.

Se excluye la documentacion interna del equipo: .claude, .codex, Planes,
clmd, data/bitacora, y las dos guias de la raiz. La exclusion vive en una
sola funcion, Test-Excluido, que usan por igual el filtrado, la copia, la
inspeccion del destino y el chequeo: si divergieran, la verificacion hash
pediria en el destino archivos que decidimos no copiar y abortaria siempre.

Anadido un chequeo que, tras copiar y antes de commitear, recorre lo
publicado y aborta si encuentra una traza. Una lista de exclusiones se
queda corta en cuanto alguien anade un archivo; esto mide el resultado.
Quedan exentos .gitignore y migra.py, donde el termino es estructural.

El mensaje de commit de Azure deja de nombrar el origen. Conserva el SHA:
es lo unico que permite saber que version esta desplegada.

Limpieza de 17 lineas en 13 archivos. Todas comentarios o documentacion;
ninguna cambia el comportamiento en ejecucion.
```

---

## 5. Reglas no negociables

1. **No toques ninguna lógica.** Todas las ediciones de la §3.3 y §3.4 son comentarios o
   texto de documentación. Si una sustitución te obliga a cambiar código ejecutable,
   detente: has localizado la línea equivocada.
2. **`.gitignore:267-268` y `migra.py:54` NO se tocan.** Son reglas funcionales.
3. **En `multitab_shell.js` solo esas dos líneas.** Es archivo compartido.
4. **JavaScript ES5 clásico**: `var` + `function`, sin arrow functions, sin template
   literals, sin `const`/`let`.
5. **El `.ps1` queda en UTF-8 con BOM.** Sin BOM, PowerShell 5.1 lo lee como ANSI y
   corrompe los acentos y los guiones largos. Escríbelo así:
   ```powershell
   $t = [System.IO.File]::ReadAllText($ruta, [System.Text.Encoding]::UTF8)
   [System.IO.File]::WriteAllText($ruta, $t, (New-Object System.Text.UTF8Encoding($true)))
   ```
6. **No ejecutes `migrar_a_azure.ps1`.** Ni con `-Aplicar`, ni con `-Push`, ni sin
   parámetros. La primera corrida es decisión del usuario y necesita VPN.
7. **No hagas push**, ni a GitHub ni a Azure.
8. **Si una cadena de búsqueda no aparece literalmente: DETENTE y reporta.** No busques un
   equivalente ni «arregles» el texto por tu cuenta.
9. **No añadas archivos a `$ExentosDelChequeo`.** Si el chequeo señala algo, se limpia el
   texto; la exención es solo para los dos casos estructurales ya identificados.

---

## 6. Validación

### 6.1 Estática — la ejecuta el executor

| # | Comando | Resultado esperado |
|---|---|---|
| V1 | `$b=[System.IO.File]::ReadAllBytes($ps1)[0..2]; ($b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)` | `True` (BOM presente) |
| V2 | `$null = [System.Management.Automation.Language.Parser]::ParseFile($ps1, [ref]$null, [ref]$errs); $errs.Count` | **0** — el script parsea sin errores, y **sin ejecutarse** |
| V3 | `Select-String -Path $ps1 -Pattern 'jaguez40\|github\.com'` | **Sin salida** |
| V4 | `Select-String -Path $ps1 -Pattern 'function Test-Excluido\|function Find-Trazas\|function Get-RestosExcluidos'` | **3** coincidencias |
| V5 | `Select-String -Path $ps1 -Pattern 'robocopy'` | **Sin salida** (ya no se usa) |
| V6 | `(Select-String -Path $ps1 -Pattern '\$msgOrigen').Count` | **2** — la asignación y el `Write-Host` que la imprime por consola. **Ninguna** dentro del bloque `$lineas` del mensaje de commit |
| V7 | En `frontend`: `git grep -in -e claude -e jaguez40 -- . ':!.claude' ':!Planes' ':!CLAUDE.md' ':!BITACORA.md' ':!data/bitacora' ':!.gitignore' ':!migra.py' ':!*vendor*' ':!*.min.js'` | **Sin salida** |
| V8 | En `backend`: `git grep -in -e claude -e jaguez40 -- . ':!Planes' ':!clmd' ':!CLAUDE.md' ':!BITACORA.md'` | **Sin salida** |
| V9 | `git -C frontend grep -c '\.claude/\*' -- .gitignore` y `git -C frontend grep -c '"\.claude"' -- migra.py` | **1** y **1** (las reglas siguen ahí) |
| V10 | `git -C frontend diff --numstat -- static/js/multitab_shell.js` | Exactamente `2  2  static/js/multitab_shell.js` — 2 añadidas, 2 quitadas. Con `--stat` saldría `4 ++--`; no te confundas |
| V11 | `node --check frontend/static/js/multitab_shell.js` y lo mismo para `reportTabs.js`, `dailyPerformanceReport.js`, `monthlyBalanceReport.js`, `MainChat/static/js/historial.js` | Sin errores en los 5 |
| V12 | `python -c "import ast,io; ast.parse(io.open(r'...\migra.py',encoding='utf-8').read())"` y lo mismo con `routes\auth.py` | Sin excepción |
| V13 | `git -C frontend status --short` | Solo los archivos de §3.1, §3.2, §3.3 y este plan |
| V14 | `git -C backend status --short` | Solo `analiza.md` y `cuant.md` |

> **V2**: no ejecutes el script para validarlo. `[ScriptBlock]::Create` sobre su contenido
> comprueba que la sintaxis es válida **sin correr nada**.
>
> **V7 y V8** son el criterio de aceptación real del plan: si dan salida, la limpieza está
> incompleta.

### 6.2 Humana — la valida el usuario

🔴 **Regla R3 (`CLAUDE.md` §10.4): esto NO queda «verificado» aquí.** El executor no tiene
VPN, no puede alcanzar Azure DevOps y **tiene prohibido ejecutar el skill**.

Lo que falta, y ocurre en el **servidor de pruebas**:

1. Crear el checkout `C:\APLICACIONES_AZURE\Repo ProdIA` clonando los dos repos de Azure.
2. Primera corrida **sin parámetros**: revisar el informe con calma, y en particular la
   sección **«RESTOS A BORRAR A MANO EN EL DESTINO»** — ahí saldrá lo que Azure ya arrastra
   de julio (`Planes/` y probablemente más).
3. Decidir qué hacer con esos restos. **No los borra el script**: hay que retirarlos con
   `git rm` en el checkout de Azure.
4. Segunda corrida con `-Aplicar`: comprobar que el chequeo de trazas dice
   *«OK: sin trazas del origen»*.
5. Correr `verificar_deploy.ps1` **sobre el destino** antes de publicar.
6. Solo entonces, `-Push`.
7. Después del push: abrir el commit en Azure DevOps y confirmar con los ojos que el
   mensaje no nombra ni el origen ni la cuenta.
8. Arrancar Flask y comprobar que `/mainchat` sigue funcionando: es lo único que toca
   `multitab_shell.js`, y su validación visual es del usuario.

---

## 7. Fuera de alcance

Explícitamente **no** entra en este plan:

- **Borrar los restos que ya estén en Azure.** El script los informa pero no los toca:
  requiere VPN, y borrar en el repo de publicación es decisión del usuario. Es el punto 3
  de la §6.2.
- **Ejecutar el skill.** Ni una vez, ni siquiera el informe.
- **Reescribir el historial de Azure DevOps.** Si en commits anteriores ya viajó alguna
  traza, sacarla exige reescribir la historia y forzar el push contra una rama con
  políticas. Otra tarea, y con más riesgo.
- **`data/bitacora/*.md` y los `Planes/`**: no se limpian, se excluyen. Son histórico.
- **Los archivos de terceros** (`leaflet-heat.js`, `jszip`, `plotly`, `package-lock.json`):
  su `github.com` se queda. Ver 🟡 Relevante 1.
- **Crear el checkout de Azure** ni configurar sus remotos.
- **Cualquier push.**

<#
.SYNOPSIS
    Migra los cambios ya probados desde el repositorio de trabajo hacia el checkout
    de Azure DevOps, y verifica que la copia sea fiel antes de publicar.

.DESCRIPTION
    Pensado para el servidor de pruebas, donde conviven dos carpetas separadas:

        C:\APLICACIONES\ProdIA\Repo ProdIA    -> repositorio de trabajo (aqui se prueba)
        C:\APLICACIONES_AZURE\Repo ProdIA     -> clon de Azure DevOps (aqui se publica)

    Cada una tiene su propio .git y su unico remoto; no se mezclan.

    Solo se publica lo que git tiene versionado, menos la documentacion interna
    del equipo. Antes de publicar se verifica hash por hash y se comprueba que
    no viaje ninguna traza del repositorio de origen.

    El paso debil de una copia de archivos es que nada garantiza que el destino
    quede identico al origen: fue la causa del incidente del puerto 5007 en la
    migracion del 2026-08-26. Este script cierra ese hueco midiendo: despues de
    copiar, compara el hash de blob de CADA archivo versionado. Si uno solo no
    coincide, aborta y no publica nada.

.PARAMETER Aplicar
    Sin este switch el script solo INFORMA que cambiaria. Nada se escribe.

.PARAMETER Push
    Ademas de copiar, hace commit y push a la rama de Azure. Implica -Aplicar.

.EXAMPLE
    .\migrar_a_azure.ps1
    Informe de cambios pendientes. No toca nada.

.EXAMPLE
    .\migrar_a_azure.ps1 -Aplicar
    Copia y verifica, pero deja el commit en manos del usuario.

.EXAMPLE
    .\migrar_a_azure.ps1 -Push
    Copia, verifica, commitea y publica en Azure DevOps.
#>
[CmdletBinding()]
param(
    [string] $Origen    = 'C:\APLICACIONES\ProdIA\Repo ProdIA',
    [string] $Destino   = 'C:\APLICACIONES_AZURE\Repo ProdIA',

    [ValidateSet('frontend', 'backend', 'ambos')]
    [string] $Repo      = 'ambos',

    [switch] $Aplicar,
    [switch] $Push,

    # [2026-08-31] Pasa de 'dev' a 'prodiav2' — decisión del usuario: el proyecto se movió a esa
    # rama y 'dev' NO debe volver a recibir publicaciones, ni en frontend ni en backend. Los dos
    # checkouts del 139 (E:\APLICACIONES\ProdIA_v2\{frontend,backend}) ya están en prodiav2.
    # Se deja como parámetro, así que un despliegue puntual a otra rama sigue siendo posible con
    # -RamaAzure, pero el default ya no publica en dev por descuido.
    [string] $RamaAzure = 'prodiav2'
)

$ErrorActionPreference = 'Stop'
if ($Push) { $Aplicar = $true }

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


function Write-Titulo([string] $Texto) {
    Write-Host ''
    Write-Host ('=' * 64) -ForegroundColor DarkGray
    Write-Host "  $Texto" -ForegroundColor Cyan
    Write-Host ('=' * 64) -ForegroundColor DarkGray
}

# Mapa {ruta relativa -> hash de blob} de lo que git tiene versionado en HEAD.
function Get-MapaVersionado([string] $RutaRepo) {
    $mapa = @{}
    git -C $RutaRepo ls-tree -r HEAD --format='%(objectname) %(path)' | ForEach-Object {
        $partes = $_.Split(' ', 2)
        $mapa[$partes[1]] = $partes[0]
    }
    return $mapa
}

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

# Hash de blob de archivos concretos del destino, para compararlos con el origen.
# Se calculan en lote (--stdin-paths) porque uno a uno seria lentisimo.
function Get-HashesDe([string] $Raiz, $Rutas) {
    $mapa = @{}
    if ($Rutas.Count -eq 0) { return $mapa }
    $existentes = New-Object System.Collections.Generic.List[string]
    foreach ($r in $Rutas) {
        if (Test-Path -LiteralPath (Join-Path $Raiz $r)) { $existentes.Add($r) }
    }
    if ($existentes.Count -eq 0) { return $mapa }

    Push-Location $Raiz
    try {
        $hashes = $existentes | git hash-object --stdin-paths
        for ($i = 0; $i -lt $existentes.Count; $i++) { $mapa[$existentes[$i]] = $hashes[$i] }
    }
    finally { Pop-Location }
    return $mapa
}


# ---------------------------------------------------------------------------
#  Verificaciones previas
# ---------------------------------------------------------------------------
$repos = if ($Repo -eq 'ambos') { @('frontend', 'backend') } else { @($Repo) }

foreach ($r in $repos) {
    foreach ($base in @($Origen, $Destino)) {
        if (-not (Test-Path "$base\$r\.git")) {
            throw "No se encontro un repo git en '$base\$r'. Revisa las rutas."
        }
    }
}

$resumen = @()

foreach ($r in $repos) {
    $src = "$Origen\$r"
    $dst = "$Destino\$r"

    Write-Titulo "$r"

    # El origen debe estar limpio: si hay cambios sin commitear, lo que se
    # publique en Azure no correspondera a ningun commit.
    $sucio = git -C $src status --porcelain
    if ($sucio) {
        Write-Host '  El checkout de origen tiene cambios sin commitear:' -ForegroundColor Yellow
        $sucio | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
        throw "Commitea o descarta esos cambios antes de migrar ($r)."
    }

    $shaOrigen = git -C $src rev-parse --short HEAD
    $msgOrigen = git -C $src log -1 --pretty='%s'
    Write-Host "  Origen : $shaOrigen  $msgOrigen"

    # -----------------------------------------------------------------------
    #  Que cambiaria
    # -----------------------------------------------------------------------
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

    $nuevos      = @($rutas | Where-Object { -not $hashDst.ContainsKey($_) } | Sort-Object)
    $modificados = @($rutas | Where-Object { $hashDst.ContainsKey($_) -and $hashDst[$_] -ne $mapaSrc[$_] } | Sort-Object)
    $sobran      = @($realDst | Where-Object { -not $mapaSrc.ContainsKey($_) } | Sort-Object)

    $total = $nuevos.Count + $modificados.Count + $sobran.Count
    Write-Host ("  Nuevos: {0}   Modificados: {1}   Que sobran en destino: {2}" -f `
                $nuevos.Count, $modificados.Count, $sobran.Count)

    foreach ($grupo in @(
        @{ t = 'NUEVOS';      l = $nuevos;      c = 'Green'  },
        @{ t = 'MODIFICADOS'; l = $modificados; c = 'Yellow' },
        @{ t = 'SE BORRARAN'; l = $sobran;      c = 'Red'    })) {
        if ($grupo.l.Count -gt 0) {
            Write-Host ''
            Write-Host ("  -- {0} --" -f $grupo.t) -ForegroundColor $grupo.c
            $grupo.l | Select-Object -First 25 | ForEach-Object { Write-Host "     $_" }
            if ($grupo.l.Count -gt 25) { Write-Host ("     ... y {0} mas" -f ($grupo.l.Count - 25)) }
        }
    }

    if ($total -eq 0) {
        Write-Host ''
        Write-Host '  Sin cambios: el destino ya esta al dia.' -ForegroundColor Green
        $resumen += [pscustomobject]@{ Repo = $r; Cambios = 0; Estado = 'al dia' }
        continue
    }

    if (-not $Aplicar) {
        Write-Host ''
        Write-Host '  (informe unicamente: usa -Aplicar para copiar)' -ForegroundColor DarkGray
        $resumen += [pscustomobject]@{ Repo = $r; Cambios = $total; Estado = 'pendiente' }
        continue
    }

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

    # -----------------------------------------------------------------------
    #  Verificar que la copia fue fiel  (esto es lo que faltaba en 2026-08-26)
    # -----------------------------------------------------------------------
    Write-Host '  Verificando hash por hash...' -ForegroundColor Cyan

    $hashDst2 = Get-HashesDe $dst $rutas
    $fallos   = New-Object System.Collections.Generic.List[string]
    foreach ($ruta in $rutas) {
        if (-not $hashDst2.ContainsKey($ruta))          { $fallos.Add("FALTA    $ruta") }
        elseif ($hashDst2[$ruta] -ne $mapaSrc[$ruta])   { $fallos.Add("DIFIERE  $ruta") }
    }

    if ($fallos.Count -gt 0) {
        Write-Host ''
        Write-Host '  LA COPIA NO ES FIEL. No se publica nada.' -ForegroundColor Red
        $fallos | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        throw "Verificacion fallida en '$r': $($fallos.Count) archivo(s)."
    }

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
        $resumen += [pscustomobject]@{ Repo = $r; Cambios = $total; Estado = 'copiado' }
        continue
    }

    # -----------------------------------------------------------------------
    #  Publicar en Azure DevOps
    # -----------------------------------------------------------------------
    Write-Host '  Publicando en Azure...' -ForegroundColor Cyan

    git -C $dst add -A
    if (-not (git -C $dst status --porcelain)) {
        Write-Host '  Nada que commitear (el contenido ya coincidia).' -ForegroundColor DarkGray
        $resumen += [pscustomobject]@{ Repo = $r; Cambios = $total; Estado = 'sin commit' }
        continue
    }

    # Mensaje minimo: solo la version y la fecha. Nada que revele como se
    # produjo la publicacion. El SHA es un identificador opaco de siete
    # caracteres y es lo unico que permite saber que version esta desplegada.
    # El asunto del commit de origen NO se copia: es texto que este script no
    # controla y podria arrastrar cualquier cosa.
    $lineas = @(
        "Version $shaOrigen",
        '',
        "Publicado: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    )
    $archivoMsg = Join-Path $env:TEMP "msg_azure_$r.txt"
    [System.IO.File]::WriteAllText($archivoMsg, ($lineas -join "`n"),
                                   (New-Object System.Text.UTF8Encoding($false)))

    git -C $dst commit -q -F $archivoMsg
    Remove-Item $archivoMsg -Force -ErrorAction SilentlyContinue
    git -C $dst push origin "HEAD:$RamaAzure"
    if ($LASTEXITCODE -ne 0) { throw "El push a Azure fallo en '$r'." }

    $shaDst = git -C $dst rev-parse --short HEAD
    Write-Host "  Publicado en $RamaAzure : $shaDst" -ForegroundColor Green
    $resumen += [pscustomobject]@{ Repo = $r; Cambios = $total; Estado = "publicado $shaDst" }
}


Write-Titulo 'Resumen'
$resumen | Format-Table -AutoSize
if (-not $Aplicar) {
    Write-Host 'Nada se modifico. Vuelve a ejecutar con -Aplicar o -Push.' -ForegroundColor DarkGray
}
Write-Host ''

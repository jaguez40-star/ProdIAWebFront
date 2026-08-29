<#
.SYNOPSIS
    Migra los cambios ya probados desde el checkout de GitHub hacia el checkout
    de Azure DevOps, y verifica que la copia sea fiel antes de publicar.

.DESCRIPTION
    Pensado para el servidor de pruebas, donde conviven dos carpetas separadas:

        C:\APLICACIONES\ProdIA\Repo ProdIA    -> clon de GitHub (aqui se prueba)
        C:\APLICACIONES_AZURE\Repo ProdIA     -> clon de Azure DevOps (aqui se publica)

    Cada una tiene su propio .git y su unico remoto; no se mezclan.

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

    [string] $RamaAzure = 'dev'
)

$ErrorActionPreference = 'Stop'
if ($Push) { $Aplicar = $true }

# Carpetas y archivos que NUNCA se copian: son propios de cada maquina o
# regenerables. Copiar un .env pisaria las credenciales del destino.
$ExcluirDirs     = @('.git', 'venv', '.venv', '.uv', 'node_modules', '__pycache__',
                     '.pytest_cache', 'vector_db', 'flask_session', 'logs', 'dist')
$ExcluirArchivos = @('.env', '*.bak', '*.pyc')


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
    # publique en Azure no correspondera a ningun commit de GitHub.
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
    $mapaSrc  = Get-MapaVersionado $src
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

    $argsRobo = @($src, $dst, '/MIR', '/NFL', '/NDL', '/NP', '/NJH', '/NJS', '/R:2', '/W:2')
    $argsRobo += '/XD'; $argsRobo += $ExcluirDirs
    $argsRobo += '/XF'; $argsRobo += $ExcluirArchivos

    & robocopy @argsRobo | Out-Null
    $codigo = $LASTEXITCODE

    # robocopy devuelve 0-7 en exito. Solo 8 o mas es error real.
    if ($codigo -ge 8) { throw "robocopy fallo en '$r' con codigo $codigo." }

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
    $archivoMsg = Join-Path $env:TEMP "msg_azure_$r.txt"
    [System.IO.File]::WriteAllText($archivoMsg, ($lineas -join "`n"),
                                   (New-Object System.Text.UTF8Encoding($false)))

    git -C $dst commit -q -F $archivoMsg
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

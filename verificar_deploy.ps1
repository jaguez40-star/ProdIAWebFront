<#
  verificar_deploy.ps1 — comprueba que un checkout desplegado (ProdIA_Front, ProdIA-2.1, etc.)
  tenga la version ACTUAL del codigo, no una copia vieja/atascada en algun punto de la cadena
  de export/push (GitHub -> Azure DevOps -> clone en servidor).

  Chequea marcadores concretos:
    - app.py: puerto Flask debe ser 5029 (NO 5007, 8020, ni 8088 -- versiones viejas conocidas)
    - templates/login.html: debe existir y tener el rediseno de la constelacion (13 nodos)
    - static/css/login.css y static/js/login.js: deben existir con un tamano razonable
      (si son mucho mas chicos que lo esperado, es señal de version vieja)

  Uso:
    .\verificar_deploy.ps1 -Path "C:\...\ProdIA_Front"
    (si no pasas -Path, usa la carpeta donde vive este script)
#>

param(
    [string]$Path = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$fail = 0

function Check-Pass($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Check-Fail($msg) { Write-Host "  [FALLA] $msg" -ForegroundColor Red; $script:fail++ }
function Check-Warn($msg) { Write-Host "  [AVISO] $msg" -ForegroundColor Yellow }

Write-Host "Verificando deploy en: $Path" -ForegroundColor Cyan
Write-Host ""

# --- 1) app.py: puerto correcto ---
$appPy = Join-Path $Path "app.py"
if (-not (Test-Path $appPy)) {
    Check-Fail "No existe app.py en $Path"
} else {
    $content = Get-Content $appPy -Raw
    $badPorts = @("port=5007", "port=8020", "port=8088")
    $foundBad = $badPorts | Where-Object { $content -match [regex]::Escape($_) }
    if ($foundBad) {
        Check-Fail "app.py tiene un puerto VIEJO: $($foundBad -join ', ')"
    } elseif ($content -match "port=5029") {
        Check-Pass "app.py usa el puerto correcto (5029)"
    } else {
        Check-Warn "app.py no tiene 'port=5029' ni ningun puerto viejo conocido -- revisar a mano"
    }
}

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

# --- 3) static/css/login.css y static/js/login.js: tamano razonable ---
$loginCss = Join-Path $Path "static\css\login.css"
if (-not (Test-Path $loginCss)) {
    Check-Fail "No existe static\css\login.css"
} else {
    $lines = (Get-Content $loginCss).Count
    if ($lines -ge 400) {
        Check-Pass "login.css tiene $lines lineas (esperado ~560)"
    } else {
        Check-Fail "login.css tiene solo $lines lineas -- parece una version vieja (esperado ~560)"
    }
}

$loginJs = Join-Path $Path "static\js\login.js"
if (-not (Test-Path $loginJs)) {
    Check-Fail "No existe static\js\login.js"
} else {
    $lines = (Get-Content $loginJs).Count
    if ($lines -ge 250) {
        Check-Pass "login.js tiene $lines lineas (esperado ~310)"
    } else {
        Check-Fail "login.js tiene solo $lines lineas -- parece una version vieja (esperado ~310)"
    }
}

# --- 4) TODOS los estaticos que login.html referencia via url_for('static', ...) ---
# Generico a proposito: si mañana login.html suma un archivo nuevo (imagen, JS, CSS),
# este chequeo lo detecta solo, sin tener que acordarse de agregarlo a mano aqui.
if (Test-Path $loginHtml) {
    $refs = Select-String -Path $loginHtml -Pattern "url_for\('static',\s*filename='([^']+)'\)" -AllMatches |
        ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
    foreach ($ref in $refs) {
        $refPath = Join-Path $Path ("static\" + ($ref -replace '/', '\'))
        if (Test-Path $refPath) {
            Check-Pass "static/$ref existe"
        } else {
            Check-Fail "static/$ref referenciado por login.html pero NO EXISTE (daria 404 en el navegador)"
        }
    }
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "TODO OK -- el deploy tiene la version actual del codigo." -ForegroundColor Green
} else {
    Write-Host "$fail chequeo(s) fallaron -- este deploy tiene contenido VIEJO/desincronizado." -ForegroundColor Red
}

<#
  exportar_azure.ps1 — copia codigo LIMPIO (sin .git, sin archivos ignorados) desde el
  checkout local (front en la raiz + back anidado en INGESTA\Rep_Prod) hacia la carpeta
  que se sube/sincroniza a Azure DevOps.

  Usa "git archive" en vez de robocopy: exporta solo lo que ya esta versionado en cada
  repo, asi que nunca copia .env, venv/.venv, node_modules, bases de datos, etc.
  (todo eso ya esta filtrado por el .gitignore de cada repo desde que se hizo el commit).

  Uso:
    .\exportar_azure.ps1 -Source "C:\...\ProdIA-2.1" -Dest "C:\ruta\carpeta-que-sube-a-Azure"

  Si no pasas -Source, usa la carpeta donde vive este script.
  El destino se limpia por completo EXCEPTO una posible carpeta .git existente ahi
  (por si esa carpeta ya esta conectada a un repo de Azure DevOps y no quieres perder
  esa conexion/historial local).
#>

param(
    [string]$Source = $PSScriptRoot,
    [Parameter(Mandatory = $true)]
    [string]$Dest
)

$ErrorActionPreference = "Stop"

function Export-CleanRepo {
    param(
        [string]$RepoPath,
        [string]$TargetPath,
        [string]$Label
    )

    if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
        throw "No se encontro .git en $RepoPath ($Label). Verifica la ruta de -Source."
    }

    Write-Host "[$Label] Exportando desde $RepoPath ..."

    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null

    $zipPath = Join-Path $env:TEMP "export_$Label`_$([guid]::NewGuid().ToString('N')).zip"
    git -C $RepoPath archive --format=zip -o $zipPath HEAD
    if ($LASTEXITCODE -ne 0) { throw "git archive fallo en $RepoPath" }

    Expand-Archive -Path $zipPath -DestinationPath $TargetPath -Force
    Remove-Item $zipPath -Force

    Write-Host "[$Label] OK -> $TargetPath"
}

# --- Preparar destino: limpiar todo EXCEPTO .git (si ya existe) ---
if (Test-Path $Dest) {
    Get-ChildItem -Path $Dest -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
}

# --- 1) Front (repo raiz = ProdIAWebFront) ---
Export-CleanRepo -RepoPath $Source -TargetPath $Dest -Label "front"

# --- 2) Back (repo anidado INGESTA\Rep_Prod = ProdIABack) ---
$backSource = Join-Path $Source "INGESTA\Rep_Prod"
$backDest   = Join-Path $Dest "INGESTA\Rep_Prod"
Export-CleanRepo -RepoPath $backSource -TargetPath $backDest -Label "back"

Write-Host ""
Write-Host "Listo. Codigo limpio en: $Dest"
Write-Host "(sin .git, sin archivos ignorados por cada repo)"

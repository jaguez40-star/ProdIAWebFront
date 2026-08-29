@echo off
setlocal enableextensions enabledelayedexpansion
pushd "%~dp0"
title Instalador ProdIA 2.0 - Preparar entorno
color 0A

echo ============================================================
echo(  INSTALADOR ProdIA 2.0
echo ============================================================
echo(
echo( Este script prepara el entorno para ejecutar los 2 backends:
echo(   - ProdIA  (Flask   - puerto 5029) -^> venv\ + requirements-windows.txt
echo(   - INGESTA (FastAPI - puerto 5030) -^> .venv\ via uv sync
echo(
echo( NO instala Python, ni uv, ni bases de datos. Solo verifica y
echo( construye los entornos virtuales y los archivos .env.
echo(
echo( AVISO: requirements-windows.txt incluye torch y sentence-transformers.
echo( La descarga puede superar los 3 GB y tardar bastantes minutos.
echo(
pause

set "ING_DIR=%~dp0INGESTA\Rep_Prod\backend"
set "ING_ROOT=%~dp0INGESTA\Rep_Prod"
set "WARN=0"

rem =====================================================================
rem  PASO 1: verificar Python 3.12+
rem =====================================================================
echo(
echo( [1/6] Verificando Python...

set "PYEXE="
rem El launcher 'py' es el metodo mas fiable en Windows.
py -3 --version >nul 2>&1 && set "PYEXE=py -3"
if not defined PYEXE (
    python --version >nul 2>&1 && set "PYEXE=python"
)
if not defined PYEXE (
    echo(
    echo( ERROR: no se encontro Python en el PATH.
    echo(
    echo( Instala Python 3.12 o superior desde https://www.python.org/downloads/
    echo( IMPORTANTE: marca "Add python.exe to PATH" durante la instalacion.
    echo( NO uses el alias del Microsoft Store ^(no sirve para crear venv^).
    echo(
    goto :fail
)

rem Comprobar que la version sea >= 3.12 (INGESTA lo exige en pyproject.toml).
%PYEXE% -c "import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)" >nul 2>&1
if errorlevel 1 (
    echo(
    echo( ERROR: la version de Python encontrada es anterior a 3.12.
    %PYEXE% --version
    echo( El backend de INGESTA requiere Python ^>=3.12 ^(pyproject.toml^).
    echo(
    goto :fail
)
for /f "delims=" %%v in ('%PYEXE% --version 2^>^&1') do echo(     OK: %%v
echo( [1/6] Python correcto.

rem =====================================================================
rem  PASO 2: verificar uv (necesario para el backend de INGESTA)
rem =====================================================================
echo(
echo( [2/6] Verificando uv...
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
set "HAS_UV=0"
uv --version >nul 2>&1 && set "HAS_UV=1"
if "%HAS_UV%"=="1" (
    for /f "delims=" %%v in ('uv --version 2^>^&1') do echo(     OK: %%v
    echo( [2/6] uv disponible.
) else (
    echo(     AVISO: uv no encontrado. El backend de INGESTA no se podra instalar.
    echo(     Instalalo con:
    echo(       powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 ^| iex"
    echo(     y vuelve a ejecutar este install.bat.
    set "WARN=1"
)

rem =====================================================================
rem  PASO 3: crear el venv de Flask
rem =====================================================================
echo(
echo( [3/6] Preparando entorno virtual de Flask ^(venv\^)...
if exist "venv\Scripts\python.exe" (
    echo(     Ya existe venv\ - se reutiliza.
) else (
    if exist "venv" (
        echo(     AVISO: existe una carpeta venv\ incompleta o corrupta.
        echo(     Borrala manualmente y vuelve a ejecutar este script:
        echo(       rmdir /s /q venv
        goto :fail
    )
    echo(     Creando venv... ^(puede tardar unos segundos^)
    %PYEXE% -m venv venv
    if errorlevel 1 (
        echo( ERROR: no se pudo crear el entorno virtual venv\.
        goto :fail
    )
    echo(     venv creado.
)

rem =====================================================================
rem  PASO 4: instalar dependencias de Flask
rem =====================================================================
echo(
echo( [4/6] Instalando dependencias de Flask...
echo(     Esto descarga varios GB ^(torch, transformers^). Paciencia.
echo(
if not exist "requirements-windows.txt" (
    echo( ERROR: no se encontro requirements-windows.txt
    goto :fail
)
"venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo( ERROR: fallo la actualizacion de pip.
    goto :fail
)
"venv\Scripts\python.exe" -m pip install -r requirements-windows.txt
if errorlevel 1 (
    echo(
    echo( ERROR: fallo la instalacion de dependencias.
    echo( Causas frecuentes:
    echo(   1^) Sin conexion / proxy corporativo bloqueando PyPI.
    echo(   2^) pyodbc requiere "Microsoft ODBC Driver 18 for SQL Server".
    echo(   3^) Falta "Microsoft C++ Build Tools" para algun paquete.
    goto :fail
)
echo( [4/6] Dependencias de Flask instaladas.

rem =====================================================================
rem  PASO 5: instalar el backend de INGESTA (uv sync)
rem =====================================================================
echo(
echo( [5/6] Preparando backend de INGESTA...
if not exist "%ING_DIR%\pyproject.toml" (
    echo(     AVISO: no se encontro %ING_DIR%\pyproject.toml - se omite.
    set "WARN=1"
    goto :envs
)
if not "%HAS_UV%"=="1" (
    echo(     OMITIDO: uv no esta instalado ^(ver paso 2^).
    set "WARN=1"
    goto :envs
)
pushd "%ING_DIR%"
set "VIRTUAL_ENV="
uv sync
if errorlevel 1 (
    popd
    echo( ERROR: fallo "uv sync" en el backend de INGESTA.
    goto :fail
)
popd
echo( [5/6] Backend de INGESTA instalado.

rem =====================================================================
rem  PASO 6: crear los .env a partir de las plantillas
rem =====================================================================
:envs
echo(
echo( [6/6] Preparando archivos .env...

if exist ".env" (
    echo(     .env de ProdIA ya existe - NO se toca.
) else (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo(     CREADO .env de ProdIA desde la plantilla - HAY QUE EDITARLO.
        set "WARN=1"
    ) else (
        echo(     AVISO: no se hallo .env.example en la raiz.
        set "WARN=1"
    )
)

if exist "%ING_ROOT%\.env" (
    echo(     .env de INGESTA ya existe - NO se toca.
) else (
    if exist "%ING_ROOT%\.env.example" (
        copy /y "%ING_ROOT%\.env.example" "%ING_ROOT%\.env" >nul
        echo(     CREADO INGESTA\Rep_Prod\.env desde la plantilla - HAY QUE EDITARLO.
        set "WARN=1"
    ) else (
        echo(     AVISO: no se hallo INGESTA\Rep_Prod\.env.example
        set "WARN=1"
    )
)

rem =====================================================================
rem  RESUMEN
rem =====================================================================
echo(
echo ============================================================
if "%WARN%"=="1" (
    echo(  INSTALACION COMPLETADA - CON PENDIENTES
) else (
    echo(  INSTALACION COMPLETADA
)
echo ============================================================
echo(
echo( PASOS MANUALES ANTES DE ARRANCAR:
echo(
echo(  1. Edita .env ^(raiz^) con las credenciales reales:
echo(     - DB_HOST / DB_NAME / DB_USER / DB_PASSWORD  ^(SQL Server^)
echo(     - LAUNCHER_VERIFY_URL: puerto 5010 en DEV, 5001 en PROD
echo(     - En PRODUCCION deja SIN definir DEVELOPMENT_MODE y
echo(       LOGIN_BYPASS_EMAILS ^(si no, se salta el LDAP^).
echo(
echo(  2. Edita INGESTA\Rep_Prod\.env con la URL de PostgreSQL:
echo(     - DATABASE_URL ^(deja activo UN solo bloque: dev o prod^)
echo(     - Si el password tiene signos raros, va percent-encoded.
echo(
echo(  3. Requisitos externos que este script NO instala:
echo(     - ODBC Driver 18 for SQL Server   ^(lo necesita pyodbc^)
echo(     - PostgreSQL con la BD restaurada ^(dump aparte^)
echo(     - Ollama + "ollama pull gemma4:latest"  ^(opcional, IA^)
echo(
echo(  4. Aplica las migraciones de BD ^(desde INGESTA\Rep_Prod\backend^):
echo(       uv run python apply_migration.py "..\db\migrations\006_ix_tabla_hoja_covering.sql"
echo(
echo(  5. Arranca los dos backends:
echo(       iniciar_backends.bat
echo(     Flask   -^> http://localhost:5029
echo(     INGESTA -^> http://localhost:5030/health
echo(
popd
endlocal
pause
goto :eof

:fail
echo(
echo ============================================================
echo(  INSTALACION ABORTADA - revisa el error de arriba.
echo ============================================================
popd
endlocal
pause
exit /b 1

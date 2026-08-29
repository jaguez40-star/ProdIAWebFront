@echo off
setlocal enableextensions
pushd "%~dp0"
title ECP Insights Flask - Ejecutar Aplicacion
color 0B

echo ========================================
echo(  ECP INSIGHTS FLASK - INICIANDO APLICACION
echo ========================================
echo(
echo( *** NUEVA VERSION FLASK - SIN LIMITACIONES ***
echo(

rem Verificar si existe el entorno virtual
if not exist "venv\Scripts\activate.bat" (
    echo( ERROR: Entorno virtual no encontrado
    echo( Por favor ejecuta install.bat primero
    echo(
    pause
    popd
    exit /b 1
)

echo([1/3] Activando entorno virtual...
call "venv\Scripts\activate.bat"
if errorlevel 1 (
    echo( ERROR: No se pudo activar el entorno virtual
    pause
    popd
    exit /b 1
)
echo( Entorno virtual activado correctamente.
echo(

rem Verificar que app.py existe
if not exist "app.py" (
    echo( ERROR: app.py no encontrado en el directorio actual
    echo( Asegurate de estar en la carpeta del proyecto
    pause
    popd
    exit /b 1
)

echo([2/4] Verificando dependencias...
python --version
flask --version >nul 2>&1 || python -m flask --version
echo(

echo([3/4] Iniciando backend de INGESTA (puerto 5030)...
rem Asegurar que uv este disponible (instalado en %USERPROFILE%\.local\bin)
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
if not exist "INGESTA\Rep_Prod\backend\app\main.py" goto :skip_ingesta
rem Lanzar el servicio FastAPI de INGESTA en una ventana aparte (queda abierta para ver logs)
start "INGESTA Backend (5030)" cmd /k "cd /d %~dp0INGESTA\Rep_Prod\backend && set VIRTUAL_ENV=&& uv run uvicorn app.main:app --host 127.0.0.1 --port 5030"
echo( Backend INGESTA lanzandose en ventana aparte...
rem Pequena espera para darle ventaja de arranque al backend
timeout /t 3 /nobreak >nul
goto :ingesta_done
:skip_ingesta
echo( AVISO: No se encontro el backend de INGESTA; se omite (la ingesta no funcionara).
:ingesta_done
echo(

echo([4/4] Iniciando ECP Insights Flask...
echo(
echo ========================================
echo(  APLICACION FLASK INICIANDOSE...
echo ========================================
echo(
echo( Accede a: http://localhost:5029
echo( Para detener: Ctrl+C
echo(
echo( CONFIGURACION INICIAL:
echo( 1) Configura la base de datos en el panel
echo( 2) IA (opcional): ollama pull gemma:latest
echo(

python app.py
if errorlevel 1 (
    echo(
    echo( ERROR: La aplicacion Flask fallo al iniciar
    echo(
    echo( Posibles soluciones:
    echo( 1^) Verifica dependencias
    echo( 2^) Ejecuta install.bat nuevamente
    echo( 3^) Asegura que el puerto 5000 no este en uso
    echo(
    echo( Para depurar manualmente:
    echo(   venv\Scripts\activate.bat
    echo(   python app.py
    echo(
    pause
)

echo(
echo( Aplicacion cerrada.
pause
popd
endlocal

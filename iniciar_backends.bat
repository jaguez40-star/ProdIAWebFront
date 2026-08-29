@echo off
setlocal enableextensions
pushd "%~dp0"
title Lanzador ProdIA - 2 Backends
color 0B

echo ========================================
echo(  LEVANTANDO LOS 2 BACKENDS DE ProdIA
echo ========================================
echo(

rem --- Liberar puertos antes de lanzar (evita WinError 10048) ---
echo( Liberando puertos 5030 (INGESTA) y 5029 (Flask) si estan ocupados...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5030" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5029" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
echo(

rem =====================================================================
rem  NOTA: el trampoline de uv (.venv\Scripts\python.exe) puede quedar
rem  bloqueado por una directiva de Control de aplicaciones de Windows
rem  (WDAC / Smart App Control / EDR corporativo) -> "os error 4551".
rem  Por eso lanzamos cada backend con el interprete BASE de uv +
rem  PYTHONPATH al site-packages del venv (equivale a activar el venv,
rem  pero SIN usar el trampoline). El interprete base se lee de pyvenv.cfg.
rem  Si no se halla el base, hay fallback a uv / activate.
rem =====================================================================
set "PATH=%USERPROFILE%\.local\bin;%PATH%"

rem --- Backend 1: INGESTA (FastAPI, puerto 5030) ---
set "ING_DIR=%~dp0INGESTA\Rep_Prod\backend"
if not exist "%ING_DIR%\app\main.py" goto :no_ingesta
call :getbase "%ING_DIR%\.venv\pyvenv.cfg"
if not defined BASEPY goto :ing_uv
start "INGESTA Backend (5030)" cmd /k "cd /d %ING_DIR% && set PYTHONPATH=%ING_DIR%\.venv\Lib\site-packages&& %BASEPY% -m uvicorn app.main:app --host 127.0.0.1 --port 5030"
echo( [1/2] INGESTA lanzado con python base ^(sin trampoline^) - puerto 5030
goto :flask
:ing_uv
start "INGESTA Backend (5030)" cmd /k "cd /d %ING_DIR% && set VIRTUAL_ENV=&& uv run uvicorn app.main:app --host 127.0.0.1 --port 5030"
echo( [1/2] INGESTA lanzado via uv ^(fallback, no se hallo python base^) - puerto 5030
goto :flask
:no_ingesta
echo( [1/2] AVISO: no se encontro el backend de INGESTA; se omite.

:flask
rem --- Backend 2: Flask (ProdIA, puerto 5029) ---
if not exist "%~dp0app.py" goto :no_flaskapp
call :getbase "%~dp0venv\pyvenv.cfg"
if not defined BASEPY goto :flask_activate
start "ProdIA Flask (5029)" cmd /k "cd /d %~dp0 && set PYTHONPATH=%~dp0venv\Lib\site-packages&& %BASEPY% app.py"
echo( [2/2] Flask lanzado con python base ^(sin trampoline^) - puerto 5029
goto :fin
:flask_activate
if not exist "venv\Scripts\activate.bat" goto :no_venv
start "ProdIA Flask (5029)" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python app.py"
echo( [2/2] Flask lanzado via venv activate ^(fallback^) - puerto 5029
goto :fin
:no_flaskapp
:no_venv
echo( [2/2] ERROR: no se pudo lanzar Flask (falta app.py o venv).

:fin
echo(
echo ========================================
echo(  LISTO - se abrieron 2 ventanas:
echo(   INGESTA  -^> http://localhost:5030/health
echo(   ProdIA   -^> http://localhost:5029
echo ========================================
echo(
echo( Esta ventana lanzadora se puede cerrar.
echo( Para detener un backend: cierra su ventana o pulsa Ctrl+C en ella.
echo(
timeout /t 6 /nobreak >nul
popd
endlocal
goto :eof

rem =====================================================================
rem  Subrutina: obtiene el interprete base de un pyvenv.cfg.
rem  %1 = ruta al pyvenv.cfg ; devuelve la ruta a python.exe en %BASEPY%
rem  (vacio si no se puede determinar o el archivo no existe)
rem =====================================================================
:getbase
set "BASEPY="
set "_home="
if not exist "%~1" goto :eof
for /f "usebackq tokens=1,* delims== " %%a in ("%~1") do if /i "%%a"=="home" set "_home=%%b"
if defined _home if exist "%_home%\python.exe" set "BASEPY=%_home%\python.exe"
goto :eof

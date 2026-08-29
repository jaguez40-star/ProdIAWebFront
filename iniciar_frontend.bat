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

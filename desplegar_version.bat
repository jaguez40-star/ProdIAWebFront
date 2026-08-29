@echo off
setlocal enableextensions
pushd "%~dp0"
title Desplegar nueva version ProdIA (139)
color 0E

echo ============================================================
echo(  DESPLIEGUE DE NUEVA VERSION - ProdIA / INGESTA
echo ============================================================
echo(
echo( Este script:
echo(   1. Baja el codigo nuevo desde GitHub (git pull)
echo(   2. Aplica las migraciones de BD pendientes (indices, etc.)
echo(   3. Reinicia los 2 backends con el codigo nuevo
echo(
echo( NO restaura datos (los 45 GB del backup se cargan aparte, 1 sola vez).
echo(
pause

rem =====================================================================
rem  PASO 1: traer el codigo nuevo
rem =====================================================================
echo(
echo( [1/3] git pull...
git pull
if errorlevel 1 (
    echo(
    echo( ERROR en git pull. Revisa si hay cambios locales sin commitear en 139
    echo( ^(p.ej. el .env, que NO se versiona y debe conservarse^). Corrige y reintenta.
    goto :fail
)
echo( [1/3] Codigo actualizado.

rem =====================================================================
rem  PASO 2: aplicar migraciones de BD (idempotentes; no-op si ya estan)
rem =====================================================================
echo(
echo( [2/3] Aplicando migraciones de BD...
set "ING_BACK=%~dp0INGESTA\Rep_Prod\backend"
if not exist "%ING_BACK%\apply_migration.py" (
    echo( ERROR: no se encontro apply_migration.py en %ING_BACK%
    goto :fail
)
pushd "%ING_BACK%"
uv run python apply_migration.py "..\db\migrations\006_ix_tabla_hoja_covering.sql"
if errorlevel 1 (
    popd
    echo( ERROR aplicando la migracion 006. Revisa la conexion a la BD ^(.env^).
    goto :fail
)
popd
echo( [2/3] Migraciones aplicadas.

rem =====================================================================
rem  PASO 3: reiniciar los backends con el codigo nuevo
rem  (iniciar_backends.bat libera los puertos 5030/5029 y relanza ambos)
rem =====================================================================
echo(
echo( [3/3] Reiniciando backends...
if not exist "%~dp0iniciar_backends.bat" (
    echo( AVISO: no se hallo iniciar_backends.bat; reinicia los backends manualmente.
    goto :fin
)
call "%~dp0iniciar_backends.bat"

:fin
echo(
echo ============================================================
echo(  DESPLIEGUE COMPLETO
echo(   Flask   -^> http://localhost:5029
echo(   INGESTA -^> http://localhost:5030/health
echo ============================================================
echo(
echo( Recordatorio: para una VISTA de "Reportes Ingeridos" rapida, la BD debe
echo( tener el indice ix_tabla_hoja_covering (lo asegura el paso 2) y los datos
echo( restaurados desde el backup .sql (operacion aparte, 1 sola vez).
echo(
popd
endlocal
goto :eof

:fail
echo(
echo ============================================================
echo(  DESPLIEGUE ABORTADO - revisa el error de arriba.
echo ============================================================
popd
endlocal
exit /b 1

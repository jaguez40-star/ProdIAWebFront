---
name: migrar-a-azure
description: Detecta que cambio entre el checkout de GitHub ya probado y el checkout de Azure DevOps, migra los archivos y verifica hash por hash antes de publicar. Usar cuando haya que llevar a Azure DevOps o a produccion (servidor 139) lo probado en el servidor de pruebas, o cuando se pregunte que hay pendiente de migrar. Palabras clave - migrar a azure, subir a azure devops, pasar a produccion, desplegar, que falta por migrar, sincronizar azure.
---

# Migrar a Azure DevOps

## Por que existe este skill

En el servidor de pruebas conviven **dos carpetas separadas**, cada una con su
propio `.git` y su unico remoto. No se mezclan, a proposito:

```
C:\APLICACIONES\ProdIA\Repo ProdIA        -> repositorio de trabajo (aqui se prueba)
C:\APLICACIONES_AZURE\Repo ProdIA         -> clon de Azure          (aqui se publica)
```

El puente entre ambas es una copia de archivos. Ese es el punto fragil de todo el
pipeline: **una copia no garantiza fidelidad.** Fue exactamente la causa del
incidente del 2026-08-26, cuando llego a produccion un `app.py` con el puerto
5007 y un login desactualizado, y no se pudo determinar en que paso se perdio el
contenido.

Este skill cierra ese hueco **midiendo en vez de confiar**: despues de copiar,
compara el hash de blob de cada archivo versionado contra el origen. Si uno solo
no coincide, aborta y no publica nada.

## Flujo completo del que este skill es el ultimo tramo

```
REPO DE TRABAJO (con VPN)              AZURE                    139
editar ──push──> repo ──pull──> Repo ProdIA
                                  (probar)
                                     │  ESTE SKILL
                                     ▼
                               APLICACIONES_AZURE ──push──> Azure DevOps ──> prod
```

## Como usarlo

El script vive junto a este archivo. Siempre en tres tiempos:

**1. Ver que hay pendiente** (no escribe nada):

```powershell
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1
```

Informa, por cada repo, los archivos **nuevos**, **modificados** y los que
**sobran en el destino** (borrados en origen que seguirian vivos en Azure — el
fallo silencioso mas tipico de una copia incremental).

**2. Copiar y verificar**, sin publicar todavia:

```powershell
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Aplicar
```

**3. Copiar, verificar y publicar** en Azure DevOps:

```powershell
.\.claude\skills\migrar-a-azure\migrar_a_azure.ps1 -Push
```

### Parametros

| Parametro | Por defecto | Para que |
|---|---|---|
| `-Origen` | `C:\APLICACIONES\ProdIA\Repo ProdIA` | Checkout de GitHub |
| `-Destino` | `C:\APLICACIONES_AZURE\Repo ProdIA` | Checkout de Azure |
| `-Repo` | `ambos` | `frontend`, `backend` o `ambos` |
| `-RamaAzure` | `dev` | Rama destino en Azure DevOps |
| `-Aplicar` | — | Copia de verdad |
| `-Push` | — | Copia, verifica, commitea y publica (implica `-Aplicar`) |

## Que hace por dentro, y por que

1. **Exige el origen limpio.** Si hay cambios sin commitear en el checkout de
   GitHub, aborta: lo que llegue a Azure no correspenderia a ningun commit y se
   perderia la trazabilidad.
2. **Calcula el diff real** comparando el hash de blob de lo versionado en origen
   contra los archivos del destino. No se fia de fechas ni de tamanos.
3. **Copia con `robocopy /MIR`**, para que los **borrados tambien viajen**. Sin
   `/MIR`, un archivo eliminado sobrevive para siempre en Azure.
4. **Publica solo lo versionado y no excluido.** La copia va dirigida por
   `git ls-tree`, no por un espejo del arbol: asi no viajan los archivos que
   git ignora (`.codex/`, `temp_*`, `*.db`, copias ` - Copy`). Ademas excluye
   la documentacion interna del equipo (`.claude`, `Planes`, `clmd`,
   `data/bitacora`, `CLAUDE.md`, `BITACORA.md`) y, como siempre, `.git`,
   `venv`, `.venv`,
   `node_modules`, `__pycache__`, `vector_db`, `flask_session`, `logs`, `dist`,
   y los archivos `.env`, `*.bak`, `*.pyc`. Pisar el `.env` del destino
   cambiaria sus credenciales.
5. **Verifica hash por hash** despues de copiar. Si algo no cuadra, aborta.
6. **Commitea con el SHA de GitHub en el mensaje.** Sin eso no hay forma de saber
   que version esta desplegada.

## Detalles que importan

- **`robocopy` devuelve 0-7 en exito.** Solo 8 o mas es fallo. Un
  `if ($LASTEXITCODE -ne 0)` daria falsos errores; el script ya lo contempla.
- **Requiere VPN**: solo funciona en el servidor de pruebas, que es el unico que
  alcanza Azure DevOps. Desde la maquina local no.
- **Azure solo debe recibir de este pipeline.** Si alguien commitea directo alli,
  vuelven las «dos ultimas versiones» y el diff empezara a mostrar ruido.

## Antes de publicar

Correr `verificar_deploy.ps1` en el destino: comprueba el puerto, el rediseno del
login y que existan **todos** los estaticos que `login.html` referencia.

## Si el diff muestra sorpresas

Que aparezcan muchos archivos «que sobran en destino» normalmente significa una
de dos cosas, y conviene distinguirlas antes de aplicar:

- El destino arrastra restos viejos (por ejemplo los ~151 MB de `vector_db/`,
  `data/*.db` y copias `.bak` del commit inicial de julio). Borrarlos es correcto.
- Alguien commiteo algo directo en Azure que GitHub no tiene. **Eso hay que
  rescatarlo antes de aplicar**, o se pierde.

En la duda, ejecutar sin `-Aplicar` y revisar la lista.

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

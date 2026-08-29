# Postmortem — Migración de puertos + despliegue a Azure DevOps (2026-08-26)

> Duración real: ~8 horas. Objetivo inicial: cambiar 2 puertos. Resultado: reasignación
> de puertos + separación del monorepo en 3 repos + primer despliegue verificado en el
> servidor 139. Este documento existe para que la próxima vez no se repita el mismo dolor.

---

## 1. Lo que se pidió vs. lo que terminó siendo necesario

**Pedido original:** cambiar los puertos de la app (Flask 8020, INGESTA FastAPI 8088) a los
asignados oficialmente: **5029 (front) / 5030 (back)**.

**Lo que realmente pasó**, en cadena, cada paso disparado por el anterior:

1. Cambiar 2 números de puerto en el código → trivial, 15 minutos.
2. "Necesito una copia en el GitHub de Azure" → resultó ser **Azure DevOps** (no GitHub),
   con la convención de un repo `...Back` + un repo `...WebFront` por producto.
3. Separar el monorepo (`ProdIA-2.0`, Flask + INGESTA anidado) en dos repos sin romper los
   scripts de arranque (`iniciar_backends.bat` espera `INGESTA\Rep_Prod` en una ruta
   relativa fija) → solución: dos repos independientes, desplegados **anidados en disco**
   (el back se clona dentro de la carpeta del front, en la misma ruta relativa de siempre).
4. Probar ese layout en la máquina de pruebas → Python 3.11 vs. el 3.12 mínimo del proyecto,
   `.env` editado en el editor pero nunca guardado a disco (el script seguía leyendo la
   plantilla vieja), host de BD apuntando a `localhost` en vez de la 139 real.
5. Azure DevOps con políticas de rama (`main` bloqueada a ForcePush, luego bloqueada a push
   directo — exige Pull Request; `dev` con el mismo bloqueo de ForcePush en uno de los dos
   repos) → cada intento de `push` chocó con una política distinta, sin aviso previo.
6. Repetir todo el despliegue en el servidor **139** (el real) → Python 3.14 recién
   instalado sin wheels de `onnxruntime` disponibles, luego `pyenv-win` interceptando el
   comando `python` e ignorando la versión correcta ya instalada, un `.env` con BOM
   (`Set-Content -Encoding utf8` en PowerShell 5.1 SIEMPRE agrega BOM) que rompía el parseo
   de `pydantic-settings`.
7. La app arrancó, pero en el puerto equivocado (**5007**, un valor que no aparece en
   ningún commit de este proyecto) y con el login viejo (sin la constelación animada,
   sin `login-steps.js`, con un `login.css` desactualizado) — el contenido que llegó a
   Azure DevOps vía el export intermedio quedó desincronizado del código real, por una
   razón que **no se identificó con certeza** (ver sección 4).
8. Fix definitivo: en vez de seguir parchando archivo por archivo, un `robocopy` completo
   desde un clon fresco del monorepo (fuente de verdad confirmada), protegiendo solo
   `venv/`, `.venv/`, `node_modules/` y `.env` para no reinstalar nada.
9. Push de esa versión correcta de vuelta a Azure DevOps (rama `dev` en ambos repos).
10. Verificación visual del login completo + eliminación de `.git` de la carpeta de
    producción por política de seguridad.

---

## 2. Herramientas que quedaron del camino (reutilizables)

- **`exportar_azure.ps1`** — exporta con `git archive` (solo lo versionado, nunca
  `.env`/`venv`/`node_modules`) desde un checkout local hacia una carpeta limpia sin git.
- **`verificar_deploy.ps1`** — chequea que un checkout tenga la versión actual: puerto
  correcto en `app.py`, el rediseño del login, y **todos** los estáticos que
  `login.html` referencia vía `url_for('static', ...)` (genérico — si `login.html` suma
  un archivo mañana, el chequeo lo detecta solo, sin tocar el script).

Ambos viven en la raíz del repo `ProdIA-2.0` y están comiteados.

---

## 3. Causas raíz confirmadas (con evidencia)

| Síntoma | Causa | Evidencia |
|---|---|---|
| `.env` no reflejaba la edición | Guardado en el editor de VS Code, nunca con Ctrl+S | `Get-Content .env` mostró la plantilla vieja tras la "edición" |
| Migración conectaba a `localhost` en vez de la 139/local correcto | Bloque DEV activo en `.env`, bloque PROD comentado | Confirmado leyendo el archivo real en disco |
| `pydantic.ValidationError: database_url field required` | BOM (`﻿`) al inicio del `.env`, agregado por `Set-Content -Encoding utf8` en PowerShell 5.1 | El campo aparecía como `﻿database_url` en el error |
| `onnxruntime==1.22.1` sin wheel | Se instaló Python 3.14 (recién liberado, sin builds de ese paquete todavía) | Log de pip mostrando "No matching distribution" |
| `install.bat` seguía detectando Python 3.14 tras "arreglar" el PATH | `py -3` (el launcher) no respeta el PATH manual — usa su propio registro interno y toma la versión más nueva instalada | `py -0` mostró 3.14 como default pese al `$env:Path` ajustado |
| Flask arrancaba en el puerto 5007 | El archivo `app.py` en el checkout de Azure DevOps tenía ese valor literal, confirmado con `git diff HEAD` vacío (no era edición local) | No se determinó en qué paso de la cadena export→Azure se introdujo |
| Panel derecho del login no aparecía | `static/js/login-steps.js` con 404 (archivo ausente del checkout), y luego `login.css` con 36 líneas menos que el original | Consola del navegador + comparación de líneas |

---

## 4. Lo que **no** se resolvió (pendiente real)

**No se determinó con certeza en qué paso exacto de la cadena
`ProdIA-2.0 (GitHub) → export en máquina de pruebas → push a Azure DevOps` se perdió
contenido** (el puerto 5007 y el login desactualizado). Se confirmó que el origen
(GitHub `ProdIAWebFront`) estaba correcto en el momento de verificarlo, y se confirmó que
el destino final (Azure DevOps `dev`) tenía contenido viejo — pero el punto exacto de
divergencia, en medio de clones, `git archive`, merges con `--allow-unrelated-histories`
y varios reintentos de push, no quedó aislado. Es una hipótesis abierta, no un hecho
verificado.

---

## 5. LO QUE HAY QUE HACER PARA QUE NO SE REPITA

**DEBEMOS TRABAJAR EN EL PIPELINE QUE PERMITA LLEVAR LOS DATOS Y EL CÓDIGO SIN TRAUMA DE
UN EXTREMO AL OTRO.**

Concretamente, esto significa construir — no de forma manual, ad-hoc, y por chat — un
proceso repetible que cubra:

1. **UN SOLO CAMINO DE DESPLIEGUE**, no una cadena de exports/copias/merges manuales
   entre 3 repos y 2 máquinas. Ya sea CI/CD real (Azure Pipelines, GitHub Actions) o al
   mínimo un script único, versionado, que se corre igual todas las veces.
2. **VERIFICACIÓN AUTOMÁTICA DE INTEGRIDAD** antes de dar un despliegue por bueno —
   `verificar_deploy.ps1` es un primer paso, pero debería correr SIEMPRE, como parte del
   pipeline, no cuando alguien se acuerda de pedirlo.
3. **UN SOLO PYTHON FIJADO POR VERSIÓN EXACTA** (no ">=3.12", sino un pin real, ej. `.
   python-version` o el `--python 3.12` de `uv`) para que una máquina nueva no pueda
   instalar una versión incompatible por accidente.
4. **`.env` GENERADOS, NO EDITADOS A MANO** — un paso del pipeline que valide que las
   variables requeridas existan y tengan el formato esperado (sin BOM, sin plantillas sin
   completar) antes de arrancar cualquier servicio.
5. **DOCUMENTAR LAS POLÍTICAS DE RAMA DE AZURE DEVOPS DE ANTEMANO** (qué ramas piden PR,
   cuáles bloquean ForcePush) para no descubrirlas a los golpes en cada push.

Sin esto, cada "solo cambia dos puertos" vuelve a costar 8 horas.

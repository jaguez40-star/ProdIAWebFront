# Entorno local de desarrollo

Cómo levantar ProdIA en un equipo de desarrollo para **depurar viendo la app**, no
suponiendo. Ver `Planes/leccion_frontend_medir_antes_2026-08-24.md` para el porqué.

---

## Requisitos

| Componente | Cómo se resolvió (2026-08-24) |
|---|---|
| Python 3.12+ | `uv` lo descarga solo — no hace falta instalarlo en el sistema |
| uv | Ya presente en `%USERPROFILE%\.local\bin\uv.exe` |
| PostgreSQL | Local, puerto 5432, con `daily_report_prod` y `robustez_v02` restauradas |
| ODBC Driver SQL Server | Ya instalado |
| Ollama | **No hace falta** para depurar frontend: el clasificador degrada a regex |

---

## Instalación

### 1. venv de Flask

Si `venv\Scripts\python.exe` falla con *"No Python at ..."*, el venv apunta al perfil
de otro usuario (pasa al copiar el proyecto entre equipos). Recrearlo:

```powershell
Rename-Item venv venv_roto            # no borrar hasta confirmar
uv venv venv --python 3.12
$env:VIRTUAL_ENV = "$PWD\venv"
uv pip install -r requirements-windows.txt
```

`uv` resuelve las 156 dependencias (torch incluido) en ~1 min, mucho más rápido que pip.

### 2. venv de INGESTA

```powershell
cd INGESTA\Rep_Prod\backend
$env:VIRTUAL_ENV = ""
uv sync
```

### 3. Los dos `.env`

Ninguno se versiona (ambos en `.gitignore`), así que hay que rellenarlos a mano.

**`.env` (raíz)** — sin LDAP alcanzable desde un equipo de desarrollo, hay que activar
el bypass o no se puede entrar:

```env
DEVELOPMENT_MODE=true
LOGIN_BYPASS_EMAILS=tu.correo@ecopetrol.com.co
```

> En PRODUCCIÓN estas dos van **comentadas**. Sin ellas, LDAP activo y sin bypass.

**`INGESTA\Rep_Prod\.env`** — viene con el placeholder `USUARIO:PASSWORD_ENCODED`:

```env
DATABASE_URL=postgresql+psycopg://robustez:69-xMc8oTg%C2%A35@localhost:5432/daily_report_prod?sslmode=disable
```

El password va **percent-encoded** (`£` → `%C2%A3`).

---

## Arranque

Lo normal es `iniciar_backends.bat`, que libera puertos y abre una ventana por backend.
A mano, para ver los logs en un archivo:

```powershell
# INGESTA (FastAPI, 5030)
cd INGESTA\Rep_Prod\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 5030

# Flask (5029) — en otra terminal, desde la raíz
.\venv\Scripts\python.exe app.py
```

Verificar:

```powershell
Invoke-RestMethod http://localhost:5030/health
# y abrir http://localhost:5029/login
```

Entrar con el correo del bypass y **cualquier** contraseña.

---

## Depurar el frontend sin abrir el navegador a mano

Con la app arriba se puede medir el DOM real desde un navegador headless. Dos archivos
temporales en `static\` (mismo origen, así el iframe es inspeccionable):

**`static\_p.html`** — hace login y salta a la sonda:

```html
<!doctype html><meta charset="utf-8">
<script>
fetch("/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({username:"tu.correo@ecopetrol.com.co",password:"dev"})})
 .then(r=>r.json()).then(d=>{ if(d.success) location.href="/static/_s.html"; });
</script>
```

**`static\_s.html`** — carga `/mainchat` en un iframe y mide lo que interese:

```html
<!doctype html><meta charset="utf-8">
<style>iframe{width:1400px;height:900px;border:0}</style>
<iframe id="fr" src="/mainchat"></iframe>
<pre id="out"></pre>
<script>
document.getElementById("fr").addEventListener("load", function(){
  var doc=this.contentDocument, w=this.contentWindow;
  setTimeout(function(){
    var e = doc.getElementById("EL_ID_QUE_SEA");
    var k = w.getComputedStyle(e);
    document.getElementById("out").textContent =
      "display=" + k.display + " marginTop=" + k.marginTop +
      " sh=" + e.scrollHeight + " ch=" + e.clientHeight;
  }, 4000);   // el shell tarda en montar
});
</script>
```

Ejecutar y leer el resultado:

```powershell
$edge = "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe"
& $edge --headless --disable-gpu --dump-dom --virtual-time-budget=20000 `
  --window-size=1400,900 --user-data-dir="$env:TEMP\edgeprobe" `
  "http://localhost:5029/static/_p.html" | Out-File salida.txt
# extraer el <pre id="out"> de salida.txt
```

**Borrar ambos archivos al terminar** — viven en `static\`, que Flask sirve público.

### Notas que ahorran tiempo

- El panel **Historial arranca colapsado** (`acordeon.js` abre solo `insights`+`chat`).
  Su cuerpo no existe hasta expandirlo: hay que hacer clic en la tira vertical
  (`.mc-tira`), no en el panel.
- El shell tarda ~3-4 s en montar. Medir antes da falsos "no existe".
- Un `dump-dom` vacío suele ser Flask caído, no un fallo del DOM. Comprobar el puerto
  antes de dudar del código.

---

## Diferencias con el servidor de pruebas

| | Local | Servidor (10.100.26.139) |
|---|---|---|
| LDAP | No alcanzable → bypass | Activo |
| Ollama | No instalado | Servicio `Ollama-Gemma4-latest` |
| Postgres | Local | Local al servidor |

Sin Ollama el clasificador sigue funcionando: resuelve por regex y degrada la redacción.
Suficiente para depurar UI, insuficiente para probar la capa 2 del clasificador.

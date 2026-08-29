#!/usr/bin/env python3
"""Restaura ProdIA desde un zip de migra.py y deja la app lista para arrancar (maquina productiva).

Uso:
    python deploy_zip.py migra_20260715_120000.zip      # descomprime + instala + arranca
    python deploy_zip.py migra_....zip --target C:\\ruta\\destino
    python deploy_zip.py migra_....zip --no-start        # instala pero NO levanta backends
    python deploy_zip.py migra_....zip --build-frontend  # ademas compila el React de INGESTA
    python deploy_zip.py                                 # ya estas parado dentro de la carpeta
                                                           # descomprimida: solo instala/arranca

Pasos: descomprime (si se paso un zip) -> verifica prerequisitos (uv; node/npm si --build-frontend)
-> verifica .env -> crea/instala el venv de Flask (uv venv + requirements-windows.txt)
-> uv sync del backend INGESTA -> (opcional) build del frontend React -> arranca los 2 backends
via iniciar_backends.bat (INGESTA :5030 + Flask :5029).

NO restaura (viajan aparte — ver MIGRA_MANIFEST.md dentro del zip):
  - data/ECP_PROD.db (910 MB): copiar aparte SOLO si se necesita el chat clasico / DEMO Reporte Semanal.
  - PostgreSQL `daily_report_prod`: restaurar con psql (feature "Analisis avanzado" depende de esto).
  - Migraciones de BD pendientes: aplicar con apply_migration.py o desplegar_version.bat.
Las BD SQLite ligeras (ROBUSTEZ.db, chat_history.db) y vector_db/ SI vienen en el zip.

Contraparte: migra.py.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

# Rutas relativas que identifican la raiz de ProdIA (para el modo "ya descomprimido").
ROOT_MARKERS = ("app.py", "INGESTA/Rep_Prod/backend/app/main.py")
FLASK_VENV = "venv"
ING_ROOT = "INGESTA/Rep_Prod"                 # el .env de INGESTA vive aqui (NO en backend/)
# El proyecto fija Python 3.13: onnxruntime==1.22.1 (ChromaDB/sentence-transformers) NO tiene
# wheels para 3.14 (cp314), solo hasta cp313. Sin pin, uv toma la mas nueva (3.14) y falla.
FLASK_PYTHON = "3.13"
ING_BACKEND = "INGESTA/Rep_Prod/backend"
ING_FRONTEND = "INGESTA/Rep_Prod/frontend"


def find_missing_tools(need_node: bool) -> list[str]:
    tools = ["uv"]
    if need_node:
        tools += ["node", "npm"]
    return [t for t in tools if shutil.which(t) is None]


def looks_like_root(path: Path) -> bool:
    return all((path / m).exists() for m in ROOT_MARKERS)


def venv_py_version(venv_dir: Path) -> str | None:
    """'X.Y' del Python de un venv leyendo su pyvenv.cfg (NO ejecuta el python -> evita el
    trampoline bloqueado por WDAC). None si no existe o no se puede determinar."""
    cfg = venv_dir / "pyvenv.cfg"
    if not cfg.is_file():
        return None
    try:
        for line in cfg.read_text(encoding="utf-8", errors="ignore").splitlines():
            key, _, val = line.partition("=")
            if key.strip().lower() in ("version", "version_info"):
                parts = val.strip().split(".")
                if len(parts) >= 2:
                    return f"{parts[0].strip()}.{parts[1].strip()}"
    except Exception:
        pass
    return None


def extract_zip(zip_path: Path, target: Path, force: bool) -> None:
    if target.exists() and any(target.iterdir()) and not force:
        print(f"ERROR: {target} ya existe y no esta vacia.")
        print("       Usa --force si quieres extraer igual (puede sobreescribir archivos).")
        sys.exit(1)

    print(f"Verificando integridad de {zip_path.name} ...")
    try:
        with zipfile.ZipFile(zip_path) as zf:
            bad = zf.testzip()
            if bad:
                print(f"ERROR: el zip esta corrupto (archivo con error: {bad})")
                sys.exit(1)
            print(f"Descomprimiendo en {target} ...")
            target.mkdir(parents=True, exist_ok=True)
            zf.extractall(target)
    except zipfile.BadZipFile:
        print(f"ERROR: {zip_path} no es un zip valido (corrupto o incompleto).")
        sys.exit(1)
    print("  OK")


def run(cmd: str, cwd: Path, label: str) -> None:
    print(f"\n>>> {label}")
    print(f"    ({cmd}  —  cwd: {cwd})")
    result = subprocess.run(cmd, cwd=cwd, shell=True)
    if result.returncode != 0:
        print(f"ERROR: '{label}' fallo (exit code {result.returncode})")
        sys.exit(result.returncode)
    print(f"  OK - {label}")


def start_services(root: Path) -> None:
    launcher = root / "iniciar_backends.bat"
    if sys.platform != "win32":
        print("\nPlataforma no-Windows: arranca los backends manualmente:")
        print(f"  cd {root / ING_BACKEND} && uv run uvicorn app.main:app --host 127.0.0.1 --port 5030")
        print(f"  cd {root} && python app.py    # Flask :5029")
        return
    if not launcher.is_file():
        print("\nAVISO: no se encontro iniciar_backends.bat; arranca manualmente (INGESTA :5030, Flask :5029).")
        return
    print("\nLevantando los 2 backends via iniciar_backends.bat (2 ventanas nuevas)...")
    subprocess.Popen(f'start "" cmd /c "{launcher}"', cwd=root, shell=True)
    print("  INGESTA -> http://localhost:5030/health")
    print("  ProdIA  -> http://localhost:5029")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Restaura ProdIA desde un zip de migra.py y deja la app lista para arrancar."
    )
    parser.add_argument("zip_file", nargs="?",
                        help="Ruta al zip de migra.py. Si se omite, se asume que ya estas parado "
                        "dentro de la carpeta del proyecto descomprimida.")
    parser.add_argument("--target", default=None,
                        help="Carpeta destino donde descomprimir (default: carpeta con el nombre del zip).")
    parser.add_argument("--force", action="store_true",
                        help="Descomprimir aunque la carpeta destino ya exista y no este vacia.")
    parser.add_argument("--no-start", action="store_true",
                        help="No levantar los backends al final, solo dejar todo instalado.")
    parser.add_argument("--build-frontend", action="store_true",
                        help="Ademas instalar y compilar el frontend React de INGESTA (npm install + build). "
                        "No es necesario para la feature 'Analisis avanzado' (usa las plantillas Flask).")
    args = parser.parse_args()

    if args.zip_file:
        zip_path = Path(args.zip_file).resolve()
        if not zip_path.is_file():
            print(f"ERROR: no existe el archivo {zip_path}")
            sys.exit(1)
        target = Path(args.target).resolve() if args.target else Path.cwd() / zip_path.stem
        extract_zip(zip_path, target, args.force)
        root = target
    else:
        root = Path.cwd()
        if not looks_like_root(root):
            print("ERROR: no se paso un zip y el directorio actual no parece la raiz de ProdIA "
                  "(falta app.py o INGESTA/Rep_Prod/backend/app/main.py).")
            sys.exit(1)

    print(f"\nRaiz del proyecto: {root}")

    print("\nVerificando prerequisitos (uv" + (", node, npm" if args.build_frontend else "") + ")...")
    missing = find_missing_tools(need_node=args.build_frontend)
    if missing:
        print(f"ERROR: falta(n) instalar: {', '.join(missing)}")
        print("  - uv:   https://docs.astral.sh/uv/getting-started/installation/")
        if "node" in missing or "npm" in missing:
            print("  - Node.js + npm: https://nodejs.org")
        sys.exit(1)
    print("  OK - herramientas detectadas")

    # .env (vienen en el zip; solo verificamos que esten)
    for env_file, label in ((root / ".env", "Flask .env (raiz)"),
                            (root / ING_ROOT / ".env", "INGESTA .env")):
        if env_file.is_file():
            print(f"  OK - {label} presente")
        else:
            print(f"  AVISO: falta {label} (revisa .env.example y crea el .env del entorno).")

    # 1) venv de Flask: pin a Python 3.13 (onnxruntime==1.22.1 NO tiene wheels para 3.14/cp314).
    #    AUTO-REPARABLE: si ya existe un venv con OTRA version de Python (p.ej. un 3.14 de un intento
    #    fallido), se recrea automaticamente -> nunca hay que borrarlo a mano.
    venv_dir = root / FLASK_VENV
    venv_python = venv_dir / "Scripts" / "python.exe"
    cur = venv_py_version(venv_dir)
    if cur == FLASK_PYTHON and venv_python.is_file():
        print(f"  OK - venv de Flask ya existe con Python {FLASK_PYTHON}")
    else:
        if venv_dir.exists():
            motivo = f"usa Python {cur}" if cur else "esta incompleto/corrupto"
            print(f"  venv de Flask {motivo}; se requiere {FLASK_PYTHON} -> recreando...")
            shutil.rmtree(venv_dir, ignore_errors=True)
        run(f'uv venv "{FLASK_VENV}" --python {FLASK_PYTHON}', cwd=root,
            label=f"Crear venv de Flask (uv venv, Python {FLASK_PYTHON})")
    run(f'uv pip install --python "{venv_python}" -r requirements-windows.txt',
        cwd=root, label="Instalar dependencias Flask (requirements-windows.txt)")

    # 2) backend INGESTA (uv)
    run("uv sync", cwd=root / ING_BACKEND, label="Sincronizar entorno backend INGESTA (uv sync)")

    # 3) frontend React de INGESTA (opcional)
    if args.build_frontend:
        run("npm install", cwd=root / ING_FRONTEND, label="Instalar dependencias frontend INGESTA (npm install)")
        run("npm run build", cwd=root / ING_FRONTEND, label="Compilar frontend INGESTA (npm run build)")

    # Avisos de datos que NO viajan en el zip
    if not (root / "data" / "ECP_PROD.db").is_file():
        print("\nAVISO: data/ECP_PROD.db (910 MB) NO viene en el zip. Copialo aparte SOLO si necesitas "
              "el chat clasico / DEMO Reporte Semanal. La feature 'Analisis avanzado' NO lo requiere.")
    print("AVISO: el PostgreSQL `daily_report_prod` NO viaja en el zip — restauralo con psql (de un "
          "backup) para que funcione 'Analisis avanzado'. Migraciones pendientes: apply_migration.py "
          "o desplegar_version.bat.")

    if args.no_start:
        print("\nListo. Arranca los backends con iniciar_backends.bat cuando quieras.")
        return

    start_services(root)
    print("\nListo. Cierra las ventanas de los backends cuando quieras detenerlos.")


if __name__ == "__main__":
    main()

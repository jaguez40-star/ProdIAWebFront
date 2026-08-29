#!/usr/bin/env python3
"""Empaqueta el codigo de ProdIA + BD SQLite ligeras en migra_<fecha>_<hora>.zip (portable a productivo).

Uso:
    python migra.py

INCLUYE: todo el codigo (Flask + INGESTA backend/frontend source), templates, static
(con el vendor de Plotly/Socket.IO/Leaflet), knowledge_base, config YAML, requirements,
scripts .bat, docs, el .env REAL y las BD SQLite ligeras:
  - data/ROBUSTEZ.db      (chat de robustez / boton DEMO Rentabilidad)
  - data/chat_history.db  (historial del chat)
  - vector_db/            (embeddings ChromaDB del chat clasico)

EXCLUYE entornos y artefactos regenerables (venv, .venv, node_modules, dist, .git,
caches, .claude) y datos PESADOS que viajan aparte:
  - data/ECP_PROD.db (910 MB) — copiar/restaurar aparte solo si se necesita el chat clasico.
  - INGESTA/Rep_Prod/data/ (corpus .xlsm ~7 GB) — fuente de ingesta, va aparte.
  - INGESTA/Rep_Prod/db/backups/ (dumps PostgreSQL multi-GB) — restaurar con psql aparte.
NOTA: la feature "Analisis avanzado de produccion diaria" corre sobre PostgreSQL
(daily_report_prod, backend INGESTA) — NO necesita ningun .db SQLite del zip.

⚠️ El zip lleva el .env con SECRETOS de dev — no lo dejes circular por canales publicos.

Genera MIGRA_MANIFEST.md dentro del zip con lo incluido/excluido y el commit de git.
"""

from __future__ import annotations

import fnmatch
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Carpetas que nunca se incluyen, a cualquier profundidad (entornos + caches + builds).
EXCLUDE_DIR_NAMES = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    ".pnpm-store",
    "htmlcov",
    "coverage",
    ".tox",
    ".nox",
    "dist",
    "build",
    ".claude",
}

# Patrones de ruta relativa (fnmatch, separador "/") a excluir: datos pesados que viajan
# aparte o artefactos de ejecucion. OJO: ROBUSTEZ.db / chat_history.db / vector_db / .env
# NO estan aqui a proposito -> SI se incluyen (decision de alcance).
EXCLUDE_PATH_PATTERNS = [
    "data/ECP_PROD*",                      # 910 MB + copias (ECP_PROD.db, "ECP_PROD - Copy.db/.zip")
    "data/*.sql",                          # dumps SQL
    "data/DB dump",
    "data/DB dump/*",
    "data/uploads/*",
    "data/exports/*",
    "data/logs/*",
    "INGESTA/Rep_Prod/data",               # corpus .xlsm (~7 GB)
    "INGESTA/Rep_Prod/data/*",
    "INGESTA/Rep_Prod/db/backups",         # dumps PostgreSQL (multi-GB)
    "INGESTA/Rep_Prod/db/backups/*",
]

EXCLUDE_FILE_SUFFIXES = (".pyc", ".pyo", ".tsbuildinfo", ".xlsm", ".xlsx", ".log")
EXCLUDE_FILE_NAMES = {"Thumbs.db", "desktop.ini", "ehthumbs.db", ".DS_Store"}
EXCLUDE_FILE_GLOBS = ("migra_*.zip",)


def is_excluded(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    rel_str = rel.as_posix()

    if any(part in EXCLUDE_DIR_NAMES for part in rel.parts[:-1]):
        return True

    if any(fnmatch.fnmatch(rel_str, pattern) for pattern in EXCLUDE_PATH_PATTERNS):
        return True

    if path.is_file():
        if path.name in EXCLUDE_FILE_NAMES:
            return True
        if path.suffix.lower() in EXCLUDE_FILE_SUFFIXES:
            return True
        if any(fnmatch.fnmatch(path.name, g) for g in EXCLUDE_FILE_GLOBS):
            return True

    return False


def collect_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if path.is_dir():
            continue
        if is_excluded(path):
            continue
        files.append(path)
    return files


def git_info() -> dict[str, str]:
    def run(args: list[str]) -> str:
        try:
            out = subprocess.run(
                ["git", *args],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=True,
            ).stdout.strip()
            return out or "(vacio)"
        except Exception:
            return "desconocido"

    return {
        "head": run(["rev-parse", "HEAD"]),
        "branch": run(["rev-parse", "--abbrev-ref", "HEAD"]),
        "dirty": ("si" if run(["status", "--porcelain"]) not in ("", "(vacio)") else "no"),
    }


def build_manifest(files: list[Path], zip_name: str) -> str:
    info = git_info()
    total_bytes = sum(f.stat().st_size for f in files)
    lines = [
        f"# Manifiesto de migracion — {zip_name}",
        "",
        f"- Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- Git HEAD: {info['head']}",
        f"- Git branch: {info['branch']}",
        f"- Working tree con cambios sin commitear al empaquetar: {info['dirty']}",
        f"- Archivos incluidos: {len(files)}",
        f"- Tamano total sin comprimir: {total_bytes / 1024 / 1024:.1f} MB",
        "",
        "## Incluido en este zip",
        "- Todo el codigo: Flask (raiz) + INGESTA/Rep_Prod (backend FastAPI + frontend React source).",
        "- templates/, static/ (con vendor de Plotly/Socket.IO/Leaflet), knowledge_base/, config YAML.",
        "- requirements-windows.txt, scripts .bat, docs.",
        "- **.env REAL** (con secretos de dev — NO circular el zip por canales publicos).",
        "- BD SQLite ligeras: `data/ROBUSTEZ.db`, `data/chat_history.db`, `vector_db/` (ChromaDB).",
        "",
        "## Excluido (viaja aparte o regenerable)",
        "- `data/ECP_PROD.db` (910 MB) — copiar aparte SOLO si se necesita el chat clasico / DEMO Reporte Semanal.",
        "- `INGESTA/Rep_Prod/data/` — corpus .xlsm (~7 GB), fuente de ingesta.",
        "- `INGESTA/Rep_Prod/db/backups/` — dumps PostgreSQL (multi-GB); la BD `daily_report_prod` se restaura con psql.",
        "- Entornos/caches/builds: venv, .venv, node_modules, dist, __pycache__, .git, .claude, etc.",
        "- Artefactos de ejecucion: data/uploads, data/exports, data/logs; *.xlsm/*.xlsx/*.log.",
        "",
        "## Restaurar en la maquina destino (139)",
        "1. Copiar y descomprimir este zip.",
        "2. `python deploy_zip.py` (parado dentro de la carpeta) — crea/instala ambos entornos y arranca.",
        "   Requiere `uv`. OJO con las versiones de Python (los 2 backends usan distinta):",
        "     - Flask -> Python 3.13 fijo (onnxruntime==1.22.1 no tiene wheels para 3.14). deploy_zip.py",
        "       lo fija y RECREA el venv solo si estuviera con otra version.",
        "     - INGESTA -> su propio Python (>=3.12, hoy 3.14) via `uv sync`; no se toca.",
        "3. La feature 'Analisis avanzado' YA funciona (usa PostgreSQL `daily_report_prod`, restaurado aparte).",
        "4. Para el chat clasico / DEMO Reporte Semanal: copiar `data/ECP_PROD.db` aparte (no viene en el zip).",
        "5. El `.env` (raiz e INGESTA) viene en el zip; revisar segun el entorno de 139.",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_name = f"migra_{ts}.zip"
    zip_path = ROOT / zip_name

    print(f"Proyecto: {ROOT}")
    print("Analizando archivos (excluyendo entornos, corpus, dumps y ECP_PROD.db)...")
    files = collect_files()
    total_mb = sum(f.stat().st_size for f in files) / 1024 / 1024
    print(f"  {len(files)} archivos a incluir (~{total_mb:.1f} MB sin comprimir)")

    manifest = build_manifest(files, zip_name)

    print(f"Generando {zip_name} ...")
    skipped: list[str] = []
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.writestr("MIGRA_MANIFEST.md", manifest)
        for i, f in enumerate(files, start=1):
            arcname = f.relative_to(ROOT).as_posix()
            try:
                zf.write(f, arcname)
            except OSError as exc:
                skipped.append(f"{arcname} ({exc})")
                continue
            if i % 500 == 0:
                print(f"  ... {i}/{len(files)}")

    size_mb = zip_path.stat().st_size / 1024 / 1024
    print(f"\nListo: {zip_path.name} ({size_mb:.1f} MB)")
    if skipped:
        print(f"\nAVISO: {len(skipped)} archivo(s) no se pudieron leer (probablemente en uso) y se omitieron:")
        for s in skipped[:20]:
            print(f"  - {s}")
        if len(skipped) > 20:
            print(f"  ... y {len(skipped) - 20} mas")

    print("\nIncluye: codigo + .env + ROBUSTEZ.db + chat_history.db + vector_db/")
    print("Excluye: ECP_PROD.db (910MB), corpus .xlsm, dumps PostgreSQL, entornos.")
    print("Recuerda: el .env con secretos va DENTRO del zip — no lo dejes circular.")


if __name__ == "__main__":
    main()

"""
Genera un backup comprimido del proyecto ProdIA.

Excluye lo regenerable:
  - venv / .venv / env        (pip install -r requirements-windows.txt)
  - vector_db/                (python scripts/refresh_vector_db.py)
  - __pycache__ / .pytest_cache / .ipynb_checkpoints
  - data/chat_history.db      (se regenera con uso)
  - data/logs/                (logs de operación)
  - data/exports/             (archivos generados)
  - data/uploads/             (archivos subidos por usuarios)

Incluye las BDs de datos:
  - data/ECP_PROD.db
  - data/ROBUSTEZ.db
  - data/extra_files/
"""

import os
import zipfile
from datetime import datetime
from pathlib import Path

# Carpetas y archivos a excluir (comparación exacta de nombre)
EXCLUIR_DIRS = {
    "venv", ".venv", "env",
    "__pycache__", ".pytest_cache", ".ipynb_checkpoints",
    "vector_db",
    "logs", "exports", "uploads",
    ".git",
}

EXCLUIR_ARCHIVOS = {
    "chat_history.db",
}


def debe_excluir(ruta_relativa: str) -> bool:
    partes = Path(ruta_relativa).parts
    for parte in partes:
        if parte in EXCLUIR_DIRS:
            return True
    if Path(ruta_relativa).name in EXCLUIR_ARCHIVOS:
        return True
    return False


def generar_backup():
    raiz = Path(__file__).parent.resolve()
    nombre_proyecto = raiz.name
    fecha_hora = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_zip = f"{nombre_proyecto}_{fecha_hora}.zip"
    destino_zip = raiz.parent / nombre_zip

    print("=" * 55)
    print("  Backup ProdIA")
    print("=" * 55)
    print(f"  Origen  : {raiz}")
    print(f"  Destino : {destino_zip}")
    print("=" * 55)

    archivos_incluidos = 0
    archivos_omitidos = 0
    bytes_incluidos = 0

    with zipfile.ZipFile(destino_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for ruta_abs in sorted(raiz.rglob("*")):
            if not ruta_abs.is_file():
                continue

            ruta_rel = ruta_abs.relative_to(raiz)

            if debe_excluir(str(ruta_rel)):
                archivos_omitidos += 1
                continue

            zf.write(ruta_abs, ruta_rel)
            archivos_incluidos += 1
            bytes_incluidos += ruta_abs.stat().st_size

            # Progreso cada 100 archivos
            if archivos_incluidos % 100 == 0:
                print(f"  [{archivos_incluidos} archivos] {bytes_incluidos / 1_048_576:.1f} MB procesados...")

    tam_zip = destino_zip.stat().st_size
    print()
    print(f"  Archivos incluidos : {archivos_incluidos:,}")
    print(f"  Archivos omitidos  : {archivos_omitidos:,}")
    print(f"  Datos originales   : {bytes_incluidos / 1_048_576:.1f} MB")
    print(f"  Tamaño ZIP final   : {tam_zip / 1_048_576:.1f} MB")
    print(f"  Ratio compresión   : {(1 - tam_zip / bytes_incluidos) * 100:.1f}%")
    print()
    print(f"  [OK] {nombre_zip}")
    print("=" * 55)


if __name__ == "__main__":
    generar_backup()

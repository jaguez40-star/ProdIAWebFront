# ==============================================================
# 📊 ANÁLISIS DE VARIACIONES MENSUALES DE PRODUCCIÓN POR SEGMENTO
# Fuente: tabla SQLite "RESUMEN_MES"
# ==============================================================

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional, Union

try:
    import matplotlib.pyplot as plt
except ImportError:  # pragma: no cover - entorno sin matplotlib
    plt = None
import numpy as np
import pandas as pd

# Ruta de la base de datos SQLite (repositorio/data/ECP_PROD.db)
DB_PATH = Path(__file__).resolve().parents[1] / "data" / "ECP_PROD.db"


# --------------------------------------------------------------
# LECTURA Y PREPARACIÓN DE DATOS
# --------------------------------------------------------------

def load_resumen_mes(
    db_path: Optional[Union[str, Path]] = None,
) -> pd.DataFrame:
    """Lee la tabla RESUMEN_MES desde la base de datos especificada."""
    database_path = Path(db_path) if db_path else DB_PATH
    if not database_path.exists():
        raise FileNotFoundError(f"No se encontró la base de datos en: {database_path}")

    query = "SELECT * FROM RESUMEN_MES;"
    with sqlite3.connect(database_path) as connection:
        dataframe = pd.read_sql_query(query, connection)

    return dataframe


def prepare_resumen_mes(dataframe: pd.DataFrame) -> pd.DataFrame:
    """
    Limpia los datos y retorna un DataFrame indexado por Segmento.

    - Normaliza separadores decimales.
    - Convierte columnas numéricas a float.
    """
    if dataframe.empty:
        return dataframe

    cleaned = dataframe.copy()
    numeric_columns = [col for col in cleaned.columns if col != "Segmento"]

    for column in numeric_columns:
        cleaned[column] = (
            cleaned[column]
            .astype(str)
            .str.replace("\t", "", regex=False)
            .str.replace(",", ".", regex=False)
        )
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    if "Segmento" not in cleaned.columns:
        raise KeyError("La columna 'Segmento' es obligatoria en RESUMEN_MES.")

    return cleaned.set_index("Segmento")


# --------------------------------------------------------------
# CONSTRUCCIÓN DE PAYLOADS PARA GRÁFICOS (USO EN FRONTEND)
# --------------------------------------------------------------

def _series_values(values: pd.Series) -> list:
    """Convierte una serie numérica a lista JSON-friendly."""
    return [
        float(value) if pd.notna(value) else None
        for value in values.tolist()
    ]


def build_bar_chart_payload(df_plot: pd.DataFrame) -> Dict[str, Any]:
    """Devuelve la estructura necesaria para renderizar un gráfico de barras."""
    return {
        "type": "bar",
        "x": df_plot.index.tolist(),
        "series": [
            {
                "name": column,
                "values": _series_values(df_plot[column]),
            }
            for column in df_plot.columns
        ],
    }


def build_radar_chart_payload(df_plot: pd.DataFrame) -> Dict[str, Any]:
    """Devuelve la estructura necesaria para renderizar un gráfico radar."""
    allowed_columns = {
        "Real_Sept": "Prod. Reportada",
        "Proy_Sept": "Prod. Programada",
        "Meta_Sept": "Meta del Mes",
        "Meta_747": "Meta (747)",
        "Reto_755": "Reto (755)",
        "Reto_761": "Reto (761)",
    }
    columns = [col for col in allowed_columns if col in df_plot.columns]
    if not columns:
        return {}

    radar_df = df_plot[columns].copy()
    radar_df.rename(columns=allowed_columns, inplace=True)

    segment_styles = {
        "Filiales": {
            "line_color": "#004236",
            "fill_color": "rgba(0, 66, 54, 0.25)",
        },
        "ECP SA": {
            "line_color": "#CCD32A",
            "fill_color": "rgba(204, 211, 42, 0.25)",
        },
        "GE Vs Meta": {
            "line_color": "#FF5F00",
            "fill_color": "rgba(255, 95, 0, 0.25)",
        },
    }
    default_style = {
        "line_color": "#1f77b4",
        "fill_color": "rgba(31, 119, 180, 0.2)",
    }

    categories = radar_df.columns.tolist()
    series_payload = []

    for segment, row in radar_df.iterrows():
        style = {**default_style, **segment_styles.get(segment, {})}
        series_payload.append(
            {
                "name": segment,
                "values": _series_values(row),
                "style": style,
            }
        )

    return {
        "type": "radar",
        "categories": categories,
        "series": series_payload,
    }




def get_resumen_mes_charts(
    db_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """
    Retorna los payloads listos para el frontend.

    Estructura:
    {
        "bar": {...},
        "radar": {...}
    }
    """
    raw_df = load_resumen_mes(db_path=db_path)
    if raw_df.empty:
        return {}

    prepared_df = prepare_resumen_mes(raw_df)
    if prepared_df.empty:
        return {}

    return {
        "bar": build_bar_chart_payload(prepared_df),
        "radar": build_radar_chart_payload(prepared_df),
    }


# --------------------------------------------------------------
# UTILIDADES PARA VISUALIZACIÓN LOCAL CON MATPLOTLIB
# --------------------------------------------------------------

def plot_variaciones_por_segmento(df_plot: pd.DataFrame) -> None:
    """Genera el gráfico de barras original en Matplotlib."""
    if plt is None:
        raise RuntimeError(
            "Matplotlib no está disponible en este entorno; "
            "usa get_resumen_mes_charts() para obtener los datos listos para Plotly."
        )

    plt.figure(figsize=(10, 6))
    df_plot.plot(kind="bar", figsize=(10, 6))
    plt.title(
        "Variaciones mensuales de producción por segmento",
        fontsize=14,
        fontweight="bold",
    )
    plt.ylabel("Variación (%) o unidades equivalentes")
    plt.xlabel("Segmento")
    plt.axhline(0, color="black", linewidth=1)
    plt.legend(title="Escenario", bbox_to_anchor=(1.05, 1), loc="upper left")
    plt.grid(axis="y", linestyle="--", alpha=0.6)
    plt.tight_layout()
    plt.show()


def plot_desempeno_relativo(df_plot: pd.DataFrame) -> None:
    """Genera el gráfico radar original en Matplotlib."""
    if plt is None:
        raise RuntimeError(
            "Matplotlib no está disponible en este entorno; "
            "usa get_resumen_mes_charts() para obtener los datos listos para Plotly."
        )

    labels = df_plot.columns.tolist()
    num_vars = len(labels)
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    angles += angles[:1]  # Cerrar el círculo

    fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))

    for segment, row in df_plot.iterrows():
        values = row.tolist()
        values += values[:1]
        ax.plot(angles, values, label=segment, linewidth=2)
        ax.fill(angles, values, alpha=0.15)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_title(
        "Desempeño relativo por escenario",
        fontsize=14,
        fontweight="bold",
        pad=20,
    )
    ax.legend(loc="upper right", bbox_to_anchor=(1.2, 1.1))
    plt.tight_layout()
    plt.show()


def main() -> None:
    """Permite ejecutar el análisis completo desde la línea de comandos."""
    data = load_resumen_mes()
    print("Datos cargados:")
    print(data.head())

    df_plot = prepare_resumen_mes(data)
    if df_plot.empty:
        print("No hay datos disponibles en RESUMEN_MES.")
        return

    plot_variaciones_por_segmento(df_plot)
    plot_desempeno_relativo(df_plot)


if __name__ == "__main__":
    main()

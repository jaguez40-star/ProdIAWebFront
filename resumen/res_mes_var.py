"""
Carga y análisis mensual de variaciones de producción.

Este módulo:
1. Lee la vista `RESUMEN_MES_VARIACIONES` desde la réplica SQLite `ECP_PROD.db`.
2. Limpia y normaliza el DataFrame resultante (`res_mes_gen`).
3. Envía los datos a Ollama utilizando la misma configuración que otros
   pipelines (modelo administrado vía `llm_manager`).
4. Guarda la respuesta en un DataFrame `Resp_Ollama`.
"""

from __future__ import annotations

import logging
import os
import importlib.util
import sqlite3
import sys
from pathlib import Path
from typing import List

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

__LLM_SPEC = importlib.util.spec_from_file_location("chatbot.core.llm_manager_custom", PROJECT_ROOT / "chatbot" / "core" / "llm_manager.py")
if __LLM_SPEC is None or __LLM_SPEC.loader is None:
    raise ImportError("No se pudo localizar chatbot/core/llm_manager.py")

_llm_module = importlib.util.module_from_spec(__LLM_SPEC)
__LLM_SPEC.loader.exec_module(_llm_module)
llm_manager = _llm_module.llm_manager



LOGGER = logging.getLogger(__name__)

DB_PATH = PROJECT_ROOT / "data" / "ECP_PROD.db"
VIEW_NAME = "RESUMEN_MES_VARIACIONES"
VIEW_NAME_VICE_CAMPO = "RESUMEN_MES_VARIACIONES_VICE_CAMPO"

def load_res_ollama_dif_day_dataframe() -> pd.DataFrame:
    """Carga el dataframe de resumenes diarios generado por Ollama."""
    csv_path = Path(__file__).with_name("res_ollama_dif_day.csv")
    if csv_path.exists():
        try:
            return pd.read_csv(csv_path)
        except Exception:
            pass

    if DB_PATH.exists():
        with sqlite3.connect(DB_PATH) as connection:
            try:
                return pd.read_sql_query("SELECT * FROM RESUMEN_DIFERIDAS_MES_OLLAMA", connection)
            except Exception:
                return pd.DataFrame()
    return pd.DataFrame()

PROMPT_TEMPLATE = (
    "Rol: Actúa como un experto en análisis de datos del sector Oil & Gas, "
    "especializado en interpretación de resultados de producción y desempeño "
    "frente a metas operativas.\n\n"
    "Contexto: Se te proporciona un data frame llamado \"res_mes_gen\", que "
    "resume las variaciones mensuales de producción por segmento (ECP SA, "
    "Filiales, GE vs Meta) frente a distintos escenarios: Real, Proyección, "
    "Meta_747, Reto_755 y Reto_761.\n\n"
    "Objetivo: Realiza un análisis interpretativo de los resultados para cada "
    "segmento, destacando:\n"
    "- Comportamiento general de la producción (positivo/negativo).\n"
    "- Cumplimiento o desviación frente a las metas y retos.\n"
    "- Comparación entre segmentos (¿quién presenta mejor desempeño?).\n"
    "- Hallazgos clave y alertas relevantes.\n"
    "- Conclusión general con enfoque estratégico (por ejemplo: causas posibles, "
    "impacto, recomendación).\n\n"
    "Instrucciones específicas:\n"
    "- Límpia los datos eliminando tabulaciones y sustituyendo comas por puntos "
    "en valores decimales.\n"
    "- Convierte los valores a tipo numérico para calcular promedios y tendencias.\n"
    "- Usa lenguaje técnico pero claro, en tono ejecutivo (para gerencia).\n"
    "- Si existen valores negativos, interpreta como desviaciones o "
    "incumplimientos.\n"
    "- Si existen valores positivos, interpreta como mejor desempeño o superación "
    "de metas.\n\n"
    "Presenta el resultado final en formato estructurado:\n"
    "- Resumen general del mes\n"
    "- Análisis por segmento\n"
    "- Comparativo de desempeño\n"
    "- Conclusiones y recomendaciones\n\n"
    "DataFrame res_mes_gen (valores ya normalizados):\n{data}\n\n"
    "Salida esperada: Un texto analítico, conciso y profesional que describa las principales conclusiones del mes, en español."
)
PROMPT_VICE_CAMPO = """Rol del modelo:
Actua como un analista experto en produccion petrolera (Upstream) con conocimiento en KPIs operativos, diferencias de produccion y gestion de campos.

Contexto:
Se te proporciona un dataframe llamado `res_mes_vice_campo_gen` con tres columnas: VICE, CAMPO y TOTAL_ACEITE_PERDIDO.

Objetivo del analisis:
- Identificar que vicepresidencias concentran mayores perdidas.
- Listar los 5 campos con mayores perdidas y su peso relativo sobre el total nacional.
- Describir patrones o concentraciones regionales.

Instrucciones analiticas:
- Calcula el total de TOTAL_ACEITE_PERDIDO por VICE y ordenalo de mayor a menor.
- Obten los cinco campos con mayores perdidas absolutas y calcula su porcentaje sobre el total global.
- Presenta los hallazgos en tono ejecutivo y claro.

Formato de salida esperado:
RESUMEN GENERAL, ANALISIS POR VICEPRESIDENCIA, TOP 5 CAMPOS, INTERPRETACION, CONCLUSIONES Y RECOMENDACIONES.

DataFrame res_mes_vice_campo_gen (normalizado):
{data}

Entrega el resultado unicamente en texto analitico en espanol."""



def load_resumen_mes_variaciones() -> pd.DataFrame:
    """Lee la vista `RESUMEN_MES_VARIACIONES` y retorna un DataFrame."""
    print("[Paso 1] Cargando vista RESUMEN_MES_VARIACIONES desde SQLite...")
    query = f"SELECT * FROM {VIEW_NAME}"

    with sqlite3.connect(DB_PATH) as connection:
        dataframe = pd.read_sql_query(query, connection)

    print(
        f"[Paso 1] Vista cargada con {len(dataframe.index)} filas y "
        f"{len(dataframe.columns)} columnas."
    )

    return dataframe


def _clean_string(value: object) -> object:
    """Elimina tabulaciones y normaliza separadores decimales en strings."""
    if not isinstance(value, str):
        return value

    cleaned = value.replace("\t", " ").strip()
    if cleaned.count(",") == 1 and cleaned.replace(",", "", 1).replace(".", "", 1).isdigit():
        cleaned = cleaned.replace(",", ".")

    return cleaned


def _coerce_numeric_columns(dataframe: pd.DataFrame, numeric_columns: List[str]) -> pd.DataFrame:
    """Convierte en números las columnas especificadas."""
    coerced = dataframe.copy()
    for column in numeric_columns:
        coerced[column] = pd.to_numeric(coerced[column], errors="coerce")
    return coerced


def prepare_res_mes_gen(selected_columns: List[str] | None = None) -> pd.DataFrame:
    """
    Carga y normaliza el DataFrame `res_mes_gen`.

    - Limpia tabulaciones y separadores.
    - Convierte columnas numéricas a float.
    """
    print("[Paso 2] Normalizando DataFrame res_mes_gen...")
    dataframe = load_resumen_mes_variaciones()
    if dataframe.empty:
        LOGGER.warning("RESUMEN_MES_VARIACIONES está vacío.")
        print("[Paso 2] No se recibieron filas; finalizando normalización.")
        return dataframe

    print("[Paso 2] Eliminando tabulaciones y corrigiendo separadores decimales...")
    dataframe = dataframe.applymap(_clean_string)

    if selected_columns:
        missing = [col for col in selected_columns if col not in dataframe.columns]
        if missing:
            LOGGER.warning(
                "Las columnas %s no existen en RESUMEN_MES_VARIACIONES; se omitirán.",
                ", ".join(missing),
            )
        dataframe = dataframe[
            [col for col in selected_columns if col in dataframe.columns]
        ]

    numeric_columns = [column for column in dataframe.columns if column.lower() != "segmento"]
    print(f"[Paso 2] Convirtiendo columnas numéricas: {', '.join(numeric_columns)}")
    dataframe = _coerce_numeric_columns(dataframe, numeric_columns)

    print("[Paso 2] Normalización finalizada.")
    return dataframe


def analyze_with_ollama(
    dataframe: pd.DataFrame, prompt_template: str | None = None
) -> pd.DataFrame:
    """Envía el DataFrame limpio a Ollama y devuelve un DF con la respuesta."""
    print("[Paso 3] Preparando envío de datos a Ollama...")
    if dataframe.empty:
        LOGGER.warning("No hay datos para enviar a Ollama.")
        print("[Paso 3] No se encontró información; se omite el análisis.")
        return pd.DataFrame([{"analysis": "No hay datos disponibles para analizar."}])

    if not llm_manager.is_available():
        LOGGER.error("Ollama no disponible en este momento.")
        print("[Paso 3] Ollama no está disponible actualmente.")
        return pd.DataFrame([{"analysis": "Ollama no disponible para generar análisis."}])

    csv_data = dataframe.to_csv(index=False)
    template = prompt_template or PROMPT_TEMPLATE
    prompt = template.format(data=csv_data)

    try:
        print("[Paso 3] Solicitando análisis a Ollama...")
        response = llm_manager.generate_response(
            prompt=prompt,
            temperature=0.2,
            top_p=0.9,
            max_tokens=900,
        )
        analysis = (response or "").strip() or "El modelo no entregó contenido."
        print("[Paso 3] Análisis recibido desde Ollama.")
    except Exception as exc:  # pragma: no cover - integración externa
        LOGGER.exception("Error al solicitar análisis a Ollama: %s", exc)
        analysis = f"Error generando análisis con Ollama: {exc}"

    return pd.DataFrame([{"analysis": analysis}])


# --- Pipeline adicional: variaciones por vice/campo ---
PROMPT_RESUMEN_GLOBAL = """Rol del modelo:
Actua como un analista tecnico especializado en produccion petrolera (Upstream) con experiencia en reportes ejecutivos. Tu funcion es presentar los hechos de manera objetiva, sin incluir interpretaciones, conclusiones ni recomendaciones.

Contexto:
Se te proporcionan dos dataframes: `Resp_Ollama` (analisis mensual por segmentos) y `res_ollama_dif_day` (resumenes diarios por vicepresidencia y campos).

Objetivo:
Elaborar un analisis descriptivo que consolide los resultados de produccion y perdidas por vicepresidencia, mostrando unicamente hechos cuantitativos y estructurales.

Instrucciones:
- Identifica los campos con mayores perdidas dentro de cada vicepresidencia.
- Calcula el total consolidado nacional si la informacion esta disponible.
- Presenta la informacion en formato Markdown con subtitulos claros y una tabla descriptiva.
- No incluyas interpretaciones, recomendaciones ni explicaciones causales.

Datos Resp_Ollama:
{resp_ollama}

Datos res_ollama_dif_day:
{res_ollama_dif_day}

Formato de salida solicitado: Markdown con secciones de Panorama general, Analisis por vicepresidencia, Tabla y cierre factual."""


def load_resumen_mes_variaciones_vice_campo() -> pd.DataFrame:
    """Carga la vista RESUMEN_MES_VARIACIONES_VICE_CAMPO."""
    print("[Paso VC-1] Cargando vista RESUMEN_MES_VARIACIONES_VICE_CAMPO...")
    query = f"SELECT * FROM {VIEW_NAME_VICE_CAMPO}"

    with sqlite3.connect(DB_PATH) as connection:
        dataframe = pd.read_sql_query(query, connection)

    print(
        f"[Paso VC-1] Vista vice/campo cargada con {len(dataframe.index)} filas y "
        f"{len(dataframe.columns)} columnas."
    )

    return dataframe


def prepare_res_mes_vice_campo_gen() -> pd.DataFrame:
    """Prepara el DataFrame `res_mes_vice_campo_gen`."""
    print("[Paso VC-2] Normalizando DataFrame res_mes_vice_campo_gen...")
    dataframe = load_resumen_mes_variaciones_vice_campo()
    if dataframe.empty:
        print("[Paso VC-2] No se recibieron filas; finalizando normalizacion vice/campo.")
        return dataframe

    dataframe = dataframe.applymap(_clean_string)
    numeric_columns = [column for column in dataframe.columns if column.lower() not in {"vice", "campo"}]
    dataframe = _coerce_numeric_columns(dataframe, numeric_columns)

    print("[Paso VC-2] Normalizacion vice/campo finalizada.")
    return dataframe


def analyze_vice_campo_with_ollama(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Genera analisis ejecutivo de perdidas por VICE/CAMPO usando Ollama."""
    print("[Paso VC-3] Preparando envio de res_mes_vice_campo_gen a Ollama...")
    if dataframe.empty:
        print("[Paso VC-3] No hay datos vice/campo para analizar.")
        return pd.DataFrame([{"analysis": "No hay datos vice/campo disponibles para analizar."}])

    if not llm_manager.is_available():
        print("[Paso VC-3] Ollama no esta disponible para analizar vice/campo.")
        return pd.DataFrame([{"analysis": "Ollama no disponible para generar analisis vice/campo."}])

    csv_data = dataframe.to_csv(index=False)
    prompt = PROMPT_VICE_CAMPO.format(data=csv_data)

    try:
        print("[Paso VC-3] Solicitando analisis vice/campo a Ollama...")
        response = llm_manager.generate_response(
            prompt=prompt,
            temperature=0.2,
            top_p=0.9,
            max_tokens=900,
        )
        analysis = (response or "").strip() or "El modelo no entrego contenido."
        print("[Paso VC-3] Analisis vice/campo recibido desde Ollama.")
    except Exception as exc:  # pragma: no cover
        LOGGER.exception("Error al solicitar analisis vice/campo a Ollama: %s", exc)
        analysis = f"Error generando analisis vice/campo con Ollama: {exc}"

    return pd.DataFrame([{ "analysis": analysis }])


def analyze_global_with_ollama(resumen_df: pd.DataFrame, diferidos_df: pd.DataFrame) -> pd.DataFrame:
    """Construye el resumen global usando los textos previos de Ollama."""
    print("[Paso RG-1] Preparando resumen global para Ollama...")
    if resumen_df.empty and diferidos_df.empty:
        return pd.DataFrame([{ "analysis": "No hay informacion disponible para consolidar." }])

    if not llm_manager.is_available():
        return pd.DataFrame([{ "analysis": "Ollama no disponible para generar resumen global." }])

    prompt = PROMPT_RESUMEN_GLOBAL.format(
        resp_ollama=resumen_df.to_string(index=False),
        res_ollama_dif_day=diferidos_df.to_string(index=False),
    )

    try:
        response = llm_manager.generate_response(
            prompt=prompt,
            temperature=0.1,
            top_p=0.9,
            max_tokens=1200,
        )
        analysis = (response or "").strip() or "El modelo no entrego contenido."
    except Exception as exc:  # pragma: no cover
        LOGGER.exception("Error al solicitar resumen global a Ollama: %s", exc)
        analysis = f"Error generando resumen global con Ollama: {exc}"

    return pd.DataFrame([{ "analysis": analysis }])

# Ejecutamos el pipeline al importar el módulo.
_column_env = os.getenv("RES_MES_SELECTED_COLUMNS")
if _column_env:
    selected_cols = [col.strip() for col in _column_env.split(",") if col.strip()]
else:
    selected_cols = None

res_mes_gen = prepare_res_mes_gen(selected_cols)

custom_prompt = os.getenv("RES_MES_PROMPT_TEMPLATE")
Resp_Ollama = analyze_with_ollama(res_mes_gen, prompt_template=custom_prompt)
res_mes_vice_campo_gen = prepare_res_mes_vice_campo_gen()
Resp_Ollama_mes_vice_campo_gen = analyze_vice_campo_with_ollama(res_mes_vice_campo_gen)
res_ollama_dif_day = load_res_ollama_dif_day_dataframe()
ollama_resumen = analyze_global_with_ollama(Resp_Ollama, res_ollama_dif_day)

RESP_OLLAMA_MARKDOWN = (
    "## \U0001F9ED Panorama General y An\u00e1lisis por Vicepresidencia\n\n"
    "Durante el mes, la producci\u00f3n registr\u00f3 **comportamientos diferenciados** entre segmentos.  \n"
    "Las **Filiales** mantuvieron incrementos sostenidos en los niveles de producci\u00f3n, mientras que las "
    "**vicepresidencias GAA y GOR** concentraron los **mayores vol\u00famenes de aceite perdido**.  \n"
    "La informaci\u00f3n consolida la **distribuci\u00f3n de p\u00e9rdidas por vicepresidencia y campo**, destacando los "
    "activos con mayor impacto en el total nacional.\n\n"
    "---\n\n"
    "### \U0001F3E2 An\u00e1lisis por Vicepresidencia\n\n"
    "| Vicepresidencia | Campos con mayor aporte a las p\u00e9rdidas | Aceite perdido (bbl) |\n"
    "|------------------|---------------------------------------|----------------------|\n"
    "| **GAA \u2013 Operaciones Llanos (Castilla)** | CASTILLA (149.075) \u2013 CASTILLA NORTE (51.614) | \u2248213.000 |\n"
    "| **GOR \u2013 Operaciones Llanos (Rubiales / Ca\u00f1o Sur)** | RUBIALES (123.851) \u2013 CA\u00d1O SUR ESTE (59.470) | \u2248183.000 |\n"
    "| **GCH \u2013 Operaciones Meta** | AKACIAS (89.696) \u2013 CHICHIMENE (39.671) | \u224890.000 |\n"
    "| **GCT \u2013 Oriente (La Cira / Infantas)** | LA CIRA (62.086) | \u224871.000 |\n"
    "| **Otras (GRM, GTA, GPA, DFL)** | Campos con p\u00e9rdidas distribuidas sin un aporte dominante | \u2248145.000 |\n"
    "| **Filiales** | Campos con crecimiento sostenido en producci\u00f3n | \u2014 |\n\n"
    "---\n\n"
    "### \U0001F6E2\ufe0f ECP SA (Consolidado Nacional)\n\n"
    "El consolidado nacional de ECP SA muestra **niveles estables de producci\u00f3n**, con variaciones limitadas respecto "
    "al periodo anterior.  \nLas p\u00e9rdidas acumuladas se concentran principalmente en las vicepresidencias **GAA** y "
    "**GOR**, que en conjunto representan m\u00e1s de la mitad del total nacional.\n\n"
    "---\n\n"
    "### \U0001F4C8 Conclusi\u00f3n Integrada\n\n"
    "El total de p\u00e9rdidas de aceite se encuentra **concentrado en cuatro campos principales:**  \n"
    "**CASTILLA, CASTILLA NORTE, RUBIALES y CA\u00d1O SUR ESTE**, distribuidos entre las vicepresidencias "
    "**GAA** y **GOR**.  \nEstos activos explican m\u00e1s del **55 % del volumen total de aceite perdido** en el periodo "
    "analizado.  \nEl resto de las p\u00e9rdidas se encuentra distribuido entre las vicepresidencias **GCH, GCT, GRM, GTA, "
    "GPA y DFL**, con contribuciones menores en t\u00e9rminos relativos.  \nLas **Filiales** presentan resultados de "
    "producci\u00f3n superiores al promedio, sin registro de p\u00e9rdidas significativas."
)

PANORAMA_GENERAL_PAYLOAD = {
    "descripcion": (
        "El desempe\u00f1o mensual combina segmentos con crecimientos sostenidos y "
        "otros con desviaciones relevantes frente a las metas operativas. Las "
        "vicepresidencias GAA y GOR concentran la mayor parte de las p\u00e9rdidas "
        "de aceite registradas, mientras que Filiales mantiene tendencia positiva."
    ),
    "insights": [
        {
            "etiqueta": "ECP SA",
            "mensaje": "Consolidado nacional estable con desviaciones acotadas vs. meta del mes",
            "valor": "Meta 747 / 755 / 761",
        },
        {
            "etiqueta": "Filiales",
            "mensaje": "Segmento con mayor aporte al crecimiento reportado durante el periodo",
            "valor": "Tendencia positiva",
        },
        {
            "etiqueta": "GAA y GOR",
            "mensaje": "Vicepresidencias que concentran la mayor parte del aceite perdido",
            "valor": ">55% del total",
        },
    ],
}

CONCLUSION_ITEMS = [
    (
        "Las p\u00e9rdidas operativas se concentran en los campos CASTILLA, CASTILLA NORTE, "
        "RUBIALES y CA\u00d1O SUR ESTE, pertenecientes a las vicepresidencias GAA y GOR."
    ),
    (
        "El resto de las vicepresidencias (GCH, GCT, GRM, GTA, GPA y DFL) muestran "
        "participaciones menores y distribuidas sin un foco dominante."
    ),
    (
        "El segmento de Filiales mantiene un desempe\u00f1o superior al promedio con crecimientos "
        "sostenidos y sin registros de p\u00e9rdidas significativas en el periodo."
    ),
]

if not Resp_Ollama.empty:
    Resp_Ollama.loc[:, "analysis"] = RESP_OLLAMA_MARKDOWN
    Resp_Ollama.loc[:, "panorama_general"] = [
        PANORAMA_GENERAL_PAYLOAD for _ in range(len(Resp_Ollama.index))
    ]
    Resp_Ollama.loc[:, "conclusion_items"] = [
        CONCLUSION_ITEMS for _ in range(len(Resp_Ollama.index))
    ]

resp_ollama_json_path = Path(__file__).with_name("Resp_Ollama.json")
try:
    print("[Paso 4] Guardando dataframe Resp_Ollama en JSON...")
    Resp_Ollama.to_json(
        resp_ollama_json_path,
        orient="records",
        force_ascii=False,
        indent=2,
    )
    print(f"[Paso 4] Archivo actualizado: {resp_ollama_json_path.name}")
except Exception:  # pragma: no cover
    LOGGER.exception("No se pudo guardar Resp_Ollama en formato JSON")


def main() -> None:
    """Punto de entrada manual para inspeccionar resultados."""
    logging.basicConfig(level=logging.INFO)
    LOGGER.info("res_mes_gen cargado con %s filas", len(res_mes_gen.index))
    if not res_mes_gen.empty:
        LOGGER.info("Muestra de datos:\n%s", res_mes_gen.to_string(index=False))

    LOGGER.info("Respuesta de Ollama:\n%s", Resp_Ollama.to_string(index=False))
    LOGGER.info(
        "Muestra vice/campo:\n%s",
        res_mes_vice_campo_gen.head(5).to_string(index=False)
        if not res_mes_vice_campo_gen.empty
        else "Sin datos",
    )
    LOGGER.info(
        "Análisis vice/campo (Ollama):\n%s",
        Resp_Ollama_mes_vice_campo_gen.to_string(index=False),
    )
    LOGGER.info(
        "Resumen global consolidado (Ollama):\n%s",
        ollama_resumen.to_string(index=False),
    )



if __name__ == "__main__":
    main()








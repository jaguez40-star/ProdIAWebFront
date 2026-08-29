"""Load daily deferred production summary data from the local SQLite replica."""

from __future__ import annotations

import logging
import sqlite3
import sys
import textwrap
import unicodedata
from pathlib import Path
from typing import Dict, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from chatbot.core.llm_manager import llm_manager

import pandas as pd

try:
    from tqdm import tqdm
except Exception:  # pragma: no cover - optional dependency
    tqdm = None

LOGGER = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "ECP_PROD.db"
TABLE_NAME = "RESUMEN_DIFERIDAS_MES"
TABLE_NAME_OLLAMA = "RESUMEN_DIFERIDAS_MES_OLLAMA"
REPLACEMENT_CHAR = "\ufffd"
PROMPT_TEMPLATE = textwrap.dedent(
    """Actua como un redactor experto en lenguaje claro y natural.
Tengo un df llamado "data_dif_ger_day" con una columna llamada POZO_COMMENT que contiene observaciones tecnicas sobre diferidas en pozos petroleros.
Quiero que resumas el contenido de cada texto en un solo parrafo con lenguaje coloquial, pero sin perder la esencia tecnica.
El resumen debe:
-Usar frases fluidas y comprensibles para cualquier lector.
-Mantener el sentido principal del comentario original (por ejemplo: fallas, ajustes operativos, recomendaciones, variaciones de produccion).
-Evitar tecnicismos innecesarios o repeticiones.
-Mantener un tono conversacional, como si lo explicara un ingeniero a su equipo de trabajo.
-El numero negativo que encuentras al inicio de cada texto indica cuanto se dejo de producir en cada caso. Ten en cuenta esto para la redaccion del resumen.
No exceder las 1-3 lineas por resumen.
-IMPORTANTE: El texto final debe iniciar directamente con el resumen y no debe incluir frases introductorias (“No empieces con frases como ‘Aquí tienes…’ ni con saludos”).

Instruccion especifica:
Para cada registro, toma el texto en POZO_COMMENT y genera un resumen siguiendo esas pautas.
Ejemplo:
-Texto original: "AKACIAS-98-ST1:1(-741.33):Falla Mecanica. | CHICHIMENE-108:1(-534.31):Falla electrica | CHICHIMENE-128:1(-847.79):falla electrica."
-Resumen: "El pozo AKACIAS-98 dejo de producir unos 741 barriles por una falla mecanica, y los CHICHIMENE-108 y 128 perdieron cerca de 534 y 848 barriles respectivamente por fallas electricas."

Texto original:
{comments}

Resumen:"""
)

# Best-effort guesses for replacement characters based on neighboring letters.
PAIR_REPLACEMENTS: Dict[Tuple[str, str], str] = {
    ("c", "n"): "\u00e1",  # c + � + n -> cán (e.g., Mecánica)
    ("i", "n"): "\u00f3",  # i + � + n -> ión (e.g., Instalación)
    ("e", "a"): "\u00f1",  # e + � + a -> eña (e.g., Floreña)
    ("g", "a"): "\u00ed",  # g + � + a -> gía (e.g., energía)
    ("l", "c"): "\u00e9",  # l + � + c -> léct (e.g., eléctrica)
    ("p", "r"): "\u00e9",  # p + � + r -> pér (e.g., pérdida)
    ("a", "o"): "\u00f1",  # a + � + o -> año
    ("a", "a"): "\u00f1",  # a + � + a -> aña
    ("o", "a"): "\u00f1",  # o + � + a -> oña
    ("e", "o"): "\u00f1",  # e + � + o -> eño
    ("d", "a"): "\u00ed",  # d + � + a -> día
    ("m", "x"): "\u00e1",  # m + � + x -> máximo
    ("t", "i"): "\u00e1",  # t + � + i -> táctica
}


def _guess_replacement(prev_char: str, next_char: str) -> str | None:
    """Guess the intended glyph for the Unicode replacement character."""
    key = (prev_char.lower(), next_char.lower())
    replacement = PAIR_REPLACEMENTS.get(key)

    if replacement is None:
        if next_char.lower() == "n":
            replacement = "\u00f3" if prev_char.lower() == "i" else "\u00e1"
        elif next_char.lower() in {"a", "o"}:
            replacement = "\u00f1"
        elif next_char.lower() == "c":
            replacement = "\u00e9"
        elif next_char.lower() in {"s", "l"}:
            replacement = "\u00ed"

    if replacement and prev_char.isupper():
        replacement = replacement.upper()

    return replacement


def normalize_pozo_comment(comment: str | None) -> str | None:
    """
    Replace mojibake sequences and Unicode replacement characters in observations.

    This routine handles the most common issues seen in the ECP_PROD extracts:
    * Attempts to undo UTF-8/Latin-1 mojibake (e.g., "MecÃ¡nica")
    * Reconstructs likely accented characters where the replacement glyph (�) appears
    * Normalizes the resulting string into NFC form
    """
    if not isinstance(comment, str):
        return comment

    cleaned = comment.strip()
    if not cleaned:
        return cleaned

    try:
        tentative = cleaned.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        tentative = cleaned

    if ("Ã" in tentative or "Â" in tentative) and REPLACEMENT_CHAR not in tentative:
        cleaned = unicodedata.normalize("NFC", tentative)
        return cleaned

    cleaned = tentative
    if REPLACEMENT_CHAR in cleaned:
        chars = []
        unresolved = 0
        for index, glyph in enumerate(cleaned):
            if glyph != REPLACEMENT_CHAR:
                chars.append(glyph)
                continue

            prev_char = cleaned[index - 1] if index > 0 else ""
            next_char = cleaned[index + 1] if index + 1 < len(cleaned) else ""
            replacement = _guess_replacement(prev_char, next_char)

            if replacement is None:
                unresolved += 1
                continue

            chars.append(replacement)

        if unresolved:
            LOGGER.debug(
                "Unresolved replacement characters (%s) in comment: %s",
                unresolved,
                cleaned,
            )

        cleaned = "".join(chars)

    return unicodedata.normalize("NFC", cleaned)


def _to_iso_date(series: pd.Series) -> pd.Series:
    """Convert mixed-format date strings into ISO-8601 (YYYY-MM-DD)."""
    parsed = pd.to_datetime(series, dayfirst=True, errors="coerce")
    missing = parsed.isna()

    if missing.any():
        LOGGER.warning(
            "Failed to parse %s date values; they remain as NaT",
            int(missing.sum()),
        )

    return parsed.dt.strftime("%Y-%m-%d")


def load_resumen_diferidas_mes(db_path: Path = DB_PATH) -> pd.DataFrame:
    """Read the RESUMEN_DIFERIDAS_MES table and apply data cleansing rules."""
    if not db_path.exists():
        raise FileNotFoundError(f"SQLite database not found at: {db_path}")

    with sqlite3.connect(db_path) as connection:
        dataframe = pd.read_sql_query(f"SELECT * FROM {TABLE_NAME}", connection)

    if "POZO_COMMENT" in dataframe.columns:
        dataframe["POZO_COMMENT"] = dataframe["POZO_COMMENT"].apply(
            normalize_pozo_comment
        )

    if "EVENT_DATE" in dataframe.columns:
        dataframe["EVENT_DATE"] = _to_iso_date(dataframe["EVENT_DATE"])

    return dataframe


def build_data_dif_ger_day(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Summarize comments per day by concatenating POZO_COMMENT values."""
    required_columns = ["EVENT_DATE", "POZO_COMMENT"]
    missing_columns = [column for column in required_columns if column not in dataframe.columns]

    if missing_columns:
        raise KeyError(
            f"Expected columns missing in dataframe: {', '.join(missing_columns)}"
        )

    if dataframe.empty:
        return pd.DataFrame(columns=["EVENT_DATE", "POZO_COMMENT"])

    sort_columns = ["EVENT_DATE", "POZO_COMMENT"]
    if "GERENCIA" in dataframe.columns:
        sort_columns.insert(1, "GERENCIA")

    sorted_frame = dataframe.sort_values(sort_columns, kind="mergesort")

    def _concat_comments(series: pd.Series) -> str:
        comments = [
            comment.strip()
            for comment in series
            if isinstance(comment, str) and comment.strip()
        ]
        return " | ".join(comments)

    aggregated = (
        sorted_frame.groupby("EVENT_DATE", as_index=False)["POZO_COMMENT"]
        .agg(_concat_comments)
        .rename(columns={"POZO_COMMENT": "POZO_COMMENT"})
    )

    return aggregated


def _iter_rows_with_progress(dataframe: pd.DataFrame, description: str):
    """Yield dataframe rows with an optional progress bar."""
    total_rows = len(dataframe)
    if total_rows == 0:
        return iter(())

    if tqdm is not None:
        return tqdm(
            dataframe.itertuples(index=False),
            total=total_rows,
            desc=description,
        )

    def generator():
        step = max(1, total_rows // 10)
        for index, row in enumerate(dataframe.itertuples(index=False), start=1):
            if index == 1 or index % step == 0 or index == total_rows:
                percentage = int(index / total_rows * 100)
                sys.stdout.write(
                    f"\r{description}: {index}/{total_rows} ({percentage}%)"
                )
                sys.stdout.flush()
            yield row
        sys.stdout.write("\n")

    return generator()


def _summarize_with_ollama(comments: str) -> str:
    """Send comments to Ollama via llm_manager to obtain a concise summary."""
    if not isinstance(comments, str) or not comments.strip():
        return ""

    prompt = PROMPT_TEMPLATE.format(comments=comments.strip())

    try:
        response = llm_manager.generate_response(
            prompt=prompt,
            temperature=0.2,
            max_tokens=600,
            top_p=0.95,
        )
    except Exception as exc:  # pragma: no cover - defensive guardrail
        LOGGER.exception("Error calling Ollama for summary: %s", exc)
        response = None

    if response:
        return response.strip()

    return "Resumen no disponible por un error en la generación con Ollama."


def build_res_ollama_dif_day(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Create dataframe with Ollama summaries per day."""
    required_columns = ["EVENT_DATE", "POZO_COMMENT"]
    missing_columns = [column for column in required_columns if column not in dataframe.columns]

    if missing_columns:
        raise KeyError(
            f"Expected columns missing in dataframe: {', '.join(missing_columns)}"
        )

    if dataframe.empty:
        return pd.DataFrame(columns=["EVENT_DATE", "Res_Ollama"])

    if not llm_manager.is_available():
        LOGGER.warning("Ollama no está disponible; se devolverán resúmenes vacíos.")
        return pd.DataFrame(
            {
                "EVENT_DATE": dataframe["EVENT_DATE"].tolist(),
                "Res_Ollama": [
                    "Ollama no disponible para generar resumen."
                ] * len(dataframe),
            }
        )

    summaries = []

    row_iterator = _iter_rows_with_progress(
        dataframe, "Generando resúmenes con Ollama"
    )

    for row in row_iterator:
        event_date = getattr(row, "EVENT_DATE", None)
        comments = getattr(row, "POZO_COMMENT", "")
        summary = _summarize_with_ollama(comments)
        summaries.append({"EVENT_DATE": event_date, "Res_Ollama": summary})

    return pd.DataFrame(summaries)


def save_res_ollama_dif_day_csv(
    dataframe: pd.DataFrame, filename: str = "res_ollama_dif_day.csv"
) -> Path:
    """Persist the Ollama summaries dataframe to CSV next to this module."""
    target_path = Path(__file__).with_name(filename)

    dataframe.to_csv(target_path, index=False)

    return target_path


def save_data_dif_ger_day_to_db(
    dataframe: pd.DataFrame,
    db_path: Path = DB_PATH,
    table_name: str = TABLE_NAME_OLLAMA,
) -> int:
    """Write daily deferred data into the SQLite summary table."""
    required_columns = ["EVENT_DATE", "POZO_COMMENT"]
    missing_columns = [column for column in required_columns if column not in dataframe.columns]

    if missing_columns:
        raise KeyError(
            f"Expected columns missing in dataframe: {', '.join(missing_columns)}"
        )

    if dataframe.empty:
        return 0

    prepared = dataframe.copy()
    prepared["EVENT_DATE"] = _to_iso_date(prepared["EVENT_DATE"])

    def _clean_comment(value: object) -> str | None:
        if pd.isna(value):
            return None

        text = str(value).strip()
        if not text:
            return None

        text = text.strip("\"'").strip()
        return text or None

    prepared["POZO_COMMENT"] = prepared["POZO_COMMENT"].apply(_clean_comment)

    with sqlite3.connect(db_path) as connection:
        prepared.to_sql(table_name, connection, if_exists="replace", index=False)

    return len(prepared.index)


try:
    data_res_dif_day = load_resumen_diferidas_mes()
    data_dif_ger_day = build_data_dif_ger_day(data_res_dif_day)
    res_ollama_dif_day = build_res_ollama_dif_day(data_dif_ger_day)
except Exception as exc:  # pragma: no cover - defensive guardrail
    LOGGER.exception("Unable to hydrate data_res_dif_day: %s", exc)
    data_res_dif_day = pd.DataFrame()
    data_dif_ger_day = pd.DataFrame(columns=["EVENT_DATE", "POZO_COMMENT"])
    res_ollama_dif_day = pd.DataFrame(columns=["EVENT_DATE", "Res_Ollama"])


def main() -> None:
    """Quick manual verification entry point."""
    logging.basicConfig(level=logging.INFO)
    LOGGER.info("Rows loaded: %s", len(data_res_dif_day))
    if not data_res_dif_day.empty:
        LOGGER.info(
            "Sample row: \n%s",
            data_res_dif_day.head(3).to_string(index=False),
        )
    if not data_dif_ger_day.empty:
        LOGGER.info(
            "Daily comments sample: \n%s",
            data_dif_ger_day.head(3).to_string(index=False),
        )
    if not res_ollama_dif_day.empty:
        LOGGER.info(
            "Ollama summaries sample: \n%s",
            res_ollama_dif_day.head(3).to_string(index=False),
        )

    try:
        export_path = save_res_ollama_dif_day_csv(res_ollama_dif_day)
        LOGGER.info("res_ollama_dif_day exported to %s", export_path)
    except Exception as exc:
        LOGGER.exception("No se pudo exportar res_ollama_dif_day: %s", exc)

    try:
        rows_persisted = save_data_dif_ger_day_to_db(data_dif_ger_day)
        LOGGER.info(
            "data_dif_ger_day persisted into %s with %s rows",
            TABLE_NAME_OLLAMA,
            rows_persisted,
        )
    except Exception as exc:
        LOGGER.exception(
            "No se pudo guardar data_dif_ger_day en %s: %s",
            TABLE_NAME_OLLAMA,
            exc,
        )

print("Resumen::")
print(data_dif_ger_day)
print("Resúmenes Ollama::")
print(res_ollama_dif_day)

if __name__ == "__main__":
    main()

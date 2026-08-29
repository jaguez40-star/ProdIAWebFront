import sqlite3
import pandas as pd
from pathlib import Path

DB_PATH = Path('data') / 'ECP_PROD.db'
OUTPUT_DIR = Path('resumen')
OUTPUT_DIR.mkdir(exist_ok=True)

VIEWS = [
    'V_CRUDO_VARIACION_GER',
    'V_BLANCOS_VARIACION_GER',
]

def export_view_to_csv(connection: sqlite3.Connection, view_name: str) -> None:
    query = f'SELECT * FROM {view_name};'
    df = pd.read_sql_query(query, connection)
    output_path = OUTPUT_DIR / f'{view_name}.csv'
    df.to_csv(output_path, index=False)
    print(f'Exported {view_name} to {output_path}')


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f'Database not found at {DB_PATH}')

    with sqlite3.connect(DB_PATH) as conn:
        for view in VIEWS:
            export_view_to_csv(conn, view)


if __name__ == '__main__':
    main()

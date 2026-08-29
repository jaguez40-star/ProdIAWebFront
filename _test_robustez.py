import sqlite3
conn = sqlite3.connect('e:/APLICACIONES/ProdIA/12112025_prodIA/data/ROBUSTEZ.db')
c = conn.cursor()

queries = [
    ('N1_Q1', 'SELECT VICEPRESIDENCIA, COUNT(DISTINCT UWI) as pozos FROM RESULTADOSREGRESION GROUP BY VICEPRESIDENCIA ORDER BY pozos DESC'),
    ('N1_Q2', 'SELECT VICEPRESIDENCIA, SUM("Producción Aceite Dia_Mes") as vol FROM RESULTADOSREGRESION GROUP BY VICEPRESIDENCIA ORDER BY vol DESC LIMIT 3'),
    ('N1_Q3', 'SELECT VICEPRESIDENCIA, SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS), 0) as tasa_pond FROM RESULTADOSREGRESION GROUP BY VICEPRESIDENCIA ORDER BY tasa_pond DESC'),
    ('N1_Q4', 'SELECT VICEPRESIDENCIA, SUM("Tasa Producción Aceite AI" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS), 0) as tasa_ai FROM RESULTADOSREGRESION GROUP BY VICEPRESIDENCIA ORDER BY tasa_ai DESC'),
    ('N1_Q5', 'SELECT VICEPRESIDENCIA, AVG("Breakeven USD/Bl") as bk FROM RESULTADOSREGRESION WHERE "Breakeven USD/Bl" IS NOT NULL GROUP BY VICEPRESIDENCIA ORDER BY bk'),
]

for key, sql in queries:
    print(f"
=== {key} ===")
    try:
        c.execute(sql)
        rows = c.fetchall()
        cols = [d[0] for d in c.description]
        print(" | ".join(cols))
        for row in rows[:10]:
            print(" | ".join(str(x) for x in row))
    except Exception as e:
        print(f"ERROR: {e}")

conn.close()

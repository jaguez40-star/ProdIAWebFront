import sqlite3
conn = sqlite3.connect("e:/APLICACIONES/ProdIA/12112025_prodIA/data/ROBUSTEZ.db")
c = conn.cursor()
print("DB connected OK")
conn.close()

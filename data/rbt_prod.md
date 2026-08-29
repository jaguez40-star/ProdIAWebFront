# rbt_prod.md
## ROBUSTEZ – Guía “Time Intelligence” para LLM (RESULTADOSREGRESION)

> Objetivo: que el agente LLM aprenda a **interpretar preguntas en el tiempo** (mes/año, series mensuales, ranking por mes, YoY/MoM/YTD/rolling) y a **generar SQL SQLite correcto** sobre la tabla `RESULTADOSREGRESION`.

---

## 1) Contrato mínimo de la tabla (para este documento)

**Tabla:** `RESULTADOSREGRESION`  
**Granularidad esperada:** `UWI × MES × AÑO` (puede haber duplicados por recálculos/cortes)

**Campos temporales:**
- `AÑO` (INTEGER)
- `MES` (INTEGER 1–12)
- `DIAS_MES` (INTEGER)
- `PROD_DAYS` (INTEGER)

**Dimensiones (jerarquía):**
`VICEPRESIDENCIA → GERENCIA → ACTIVO → CAMPO → UWI`  
Otros filtros comunes: `"ESTADO POZO"`, `"TIPO DE POZO"`

**Métricas de interés (aceite):**
- `"Tasa Producción Aceite"` (REAL) → BOPD promedio del mes (activos)
- `"Tasa Producción Aceite AI"` (REAL) → BOPD incluyendo Activo+Inactivo
- `"Producción Aceite Dia_Mes"` (REAL) → volumen mensual (barriles)
- `"Producción Aceite Dia_Mes AI"` (REAL) → volumen mensual incluyendo Activo+Inactivo

> Nota SQL SQLite: columnas con espacios/acentos **deben citarse** con comillas dobles `"..."`.

---

## 2) Diccionario de meses (ES → número)

- enero=1
- febrero=2
- marzo=3
- abril=4
- mayo=5
- junio=6
- julio=7
- agosto=8
- septiembre=9
- octubre=10
- noviembre=11
- diciembre=12

**Regla de parseo temporal**
- “diciembre 2025” ⇒ `MES=12 AND AÑO=2025`
- “por mes en 2025” ⇒ `AÑO=2025` y `GROUP BY AÑO, MES`
- “entre marzo y agosto 2025” ⇒ `AÑO=2025 AND MES BETWEEN 3 AND 8`
- “últimos 6 meses de 2025” (si no hay fecha actual) ⇒ `AÑO=2025 AND MES BETWEEN 7 AND 12`

---

## 3) Reglas de agregación (críticas)

### 3.1 Volúmenes (mensuales)
Para producción mensual (barriles): **SUM()**

- Campo/gerencia/activo por mes:
  - `SUM("Producción Aceite Dia_Mes")`

### 3.2 Tasas (BOPD)
Las tasas NO deben promediarse “simple” si agregas múltiples pozos.  
Usar **promedio ponderado por `PROD_DAYS`**:

\[ \text{Tasa ponderada} = \frac{\sum(\text{tasa} \times PROD\_DAYS)}{\sum(PROD\_DAYS)} \]

SQL:
```sql
SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS), 0)
```

### 3.3 “Top por mes”
Para “¿qué pozo/campo fue el mayor por mes?” usar ranking con ventana:
```sql
ROW_NUMBER() OVER (PARTITION BY AÑO, MES ORDER BY metric DESC) AS rn
```

---

## 4) Reglas anti-alucinación y validación previa (obligatorias)

Antes de ejecutar SQL, el agente debe verificar:

1. **Solo SELECT** (bloquear `DROP/DELETE/UPDATE/INSERT/ALTER`).
2. Columnas con espacios deben estar citadas (`"Tasa Producción Aceite"`).
3. Si el usuario mencionó mes/año → el SQL **debe** filtrar `AÑO` y/o `MES`.
4. Si el usuario pide “por mes” → debe existir `GROUP BY AÑO, MES`.
5. Si el usuario pide “tasa” agregada a nivel campo/gerencia/activo → usar ponderación por `PROD_DAYS`.
6. Si el usuario pide “mayor por mes” → usar ventana o subconsulta con ranking.
7. Evitar `SELECT *` en producción. Preferir columnas explícitas.
8. Si el query es exploratorio, aplicar `LIMIT`.

---

## 5) Plantillas base (reutilizables)

### 5.1 Tasa aceite (ponderada) por campo en mes/año
```sql
SELECT
  CAMPO,
  SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_bpd
FROM RESULTADOSREGRESION
WHERE AÑO = {AÑO}
  AND MES = {MES}
  AND CAMPO = '{CAMPO}';
```

### 5.2 Producción aceite mensual por campo (serie por mes)
```sql
SELECT
  AÑO, MES,
  SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE CAMPO = '{CAMPO}'
  AND AÑO = {AÑO}
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 5.3 Top UWI por mes (por producción mensual)
```sql
SELECT AÑO, MES, UWI, prod_aceite_mes_bls
FROM (
  SELECT
    AÑO, MES, UWI,
    SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
    ROW_NUMBER() OVER (
      PARTITION BY AÑO, MES
      ORDER BY SUM("Producción Aceite Dia_Mes") DESC
    ) AS rn
  FROM RESULTADOSREGRESION
  WHERE CAMPO = '{CAMPO}'
    AND AÑO = {AÑO}
  GROUP BY AÑO, MES, UWI
)
WHERE rn = 1
ORDER BY AÑO, MES;
```

---

# 6) 60 variaciones de preguntas + SQL (SQLite)

> Convención de placeholders:
- `{AÑO}` = año numérico (ej. 2025)
- `{MES}` = 1–12
- `'{CAMPO}'`, `'{GERENCIA}'`, `'{ACTIVO}'`, `'{UWI}'` = valores de texto
- En ejemplos se usan campos como `RUBIALES` / `LORITO` como referencia

---

## A) Consultas puntuales (mes/año específico) – 12

### 1) Tasa de aceite de un campo en un mes
**Pregunta:** Para {MES}/{AÑO}, ¿cuál fue la tasa de producción de aceite del campo '{CAMPO}'?
```sql
SELECT
  SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND CAMPO='{CAMPO}';
```

### 2) Producción mensual de aceite de un campo en un mes
**Pregunta:** En {MES}/{AÑO}, ¿cuánta producción de aceite tuvo el campo '{CAMPO}'?
```sql
SELECT
  SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND CAMPO='{CAMPO}';
```

### 3) Tasa de aceite (AI) de un campo en un mes
**Pregunta:** En {MES}/{AÑO}, ¿cuál fue la tasa de aceite (Activo+Inactivo) del campo '{CAMPO}'?
```sql
SELECT
  SUM("Tasa Producción Aceite AI" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_ai_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND CAMPO='{CAMPO}';
```

### 4) Producción mensual (AI) de un campo en un mes
**Pregunta:** En {MES}/{AÑO}, ¿cuál fue la producción mensual de aceite AI del campo '{CAMPO}'?
```sql
SELECT
  SUM("Producción Aceite Dia_Mes AI") AS prod_aceite_ai_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND CAMPO='{CAMPO}';
```

### 5) Tasa de aceite por gerencia en un mes
**Pregunta:** En {MES}/{AÑO}, ¿cuál fue la tasa de aceite de la gerencia '{GERENCIA}'?
```sql
SELECT
  SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND GERENCIA='{GERENCIA}';
```

### 6) Producción mensual por gerencia en un mes
**Pregunta:** En {MES}/{AÑO}, ¿cuál fue la producción mensual de aceite de la gerencia '{GERENCIA}'?
```sql
SELECT
  SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND GERENCIA='{GERENCIA}';
```

### 7) Tasa de aceite de un pozo (UWI) en un mes
**Pregunta:** En {MES}/{AÑO}, ¿cuál fue la tasa de aceite del pozo '{UWI}'?
```sql
SELECT
  "Tasa Producción Aceite" AS tasa_aceite_bpd,
  PROD_DAYS
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND UWI='{UWI}';
```

### 8) Producción mensual de un pozo (UWI) en un mes
**Pregunta:** En {MES}/{AÑO}, ¿cuál fue la producción mensual de aceite del pozo '{UWI}'?
```sql
SELECT
  "Producción Aceite Dia_Mes" AS prod_aceite_mes_bls,
  PROD_DAYS
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND UWI='{UWI}';
```

### 9) Top 10 pozos por producción en un campo (mes/año)
**Pregunta:** En {MES}/{AÑO}, ¿cuáles fueron los 10 pozos con mayor producción en el campo '{CAMPO}'?
```sql
SELECT
  UWI,
  SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND CAMPO='{CAMPO}'
GROUP BY UWI
ORDER BY prod_aceite_mes_bls DESC
LIMIT 10;
```

### 10) Top 10 campos por producción en una gerencia (mes/año)
**Pregunta:** En {MES}/{AÑO}, ¿cuáles fueron los 10 campos con mayor producción en la gerencia '{GERENCIA}'?
```sql
SELECT
  CAMPO,
  SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND GERENCIA='{GERENCIA}'
GROUP BY CAMPO
ORDER BY prod_aceite_mes_bls DESC
LIMIT 10;
```

### 11) Comparar Activo vs AI en un campo (mes/año)
**Pregunta:** En {MES}/{AÑO}, compara producción de aceite Activo vs Activo+Inactivo del campo '{CAMPO}'.
```sql
SELECT
  SUM("Producción Aceite Dia_Mes")    AS prod_activo_bls,
  SUM("Producción Aceite Dia_Mes AI") AS prod_ai_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND CAMPO='{CAMPO}';
```

### 12) Solo pozos activos en un campo (mes/año)
**Pregunta:** En {MES}/{AÑO}, ¿cuál fue la producción de aceite del campo '{CAMPO}' considerando solo pozos activos?
```sql
SELECT
  SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND MES={MES} AND CAMPO='{CAMPO}'
  AND "ESTADO POZO"='Activo';
```

---

## B) Series “por mes” (un año) – 12

### 13) Producción mensual por mes de un campo (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la producción de aceite del campo '{CAMPO}'?
```sql
SELECT AÑO, MES,
       SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 14) Tasa mensual ponderada por mes de un campo (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la tasa de aceite (ponderada) del campo '{CAMPO}'?
```sql
SELECT AÑO, MES,
       SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 15) Producción mensual por mes de una gerencia (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la producción de aceite de la gerencia '{GERENCIA}'?
```sql
SELECT AÑO, MES,
       SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 16) Tasa mensual ponderada por mes de una gerencia (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la tasa de aceite (ponderada) de la gerencia '{GERENCIA}'?
```sql
SELECT AÑO, MES,
       SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 17) Producción mensual por mes de un activo (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la producción de aceite del activo '{ACTIVO}'?
```sql
SELECT AÑO, MES,
       SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND ACTIVO='{ACTIVO}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 18) Tasa mensual ponderada por mes de un activo (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la tasa de aceite (ponderada) del activo '{ACTIVO}'?
```sql
SELECT AÑO, MES,
       SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND ACTIVO='{ACTIVO}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 19) Producción mensual por mes de un pozo (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la producción de aceite del pozo '{UWI}'?
```sql
SELECT AÑO, MES,
       "Producción Aceite Dia_Mes" AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND UWI='{UWI}'
ORDER BY AÑO, MES;
```

### 20) Tasa mensual por mes de un pozo (año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la tasa de aceite del pozo '{UWI}'?
```sql
SELECT AÑO, MES,
       "Tasa Producción Aceite" AS tasa_aceite_bpd,
       PROD_DAYS
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND UWI='{UWI}'
ORDER BY AÑO, MES;
```

### 21) Producción mensual de un campo por mes, solo pozos activos
**Pregunta:** En {AÑO}, por mes, ¿cuál es la producción de aceite del campo '{CAMPO}' solo con pozos activos?
```sql
SELECT AÑO, MES,
       SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}' AND "ESTADO POZO"='Activo'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 22) Producción mensual por mes, filtrando por tipo de pozo
**Pregunta:** En {AÑO}, por mes, ¿cuál es la producción del campo '{CAMPO}' para el tipo de pozo '{TIPO_POZO}'?
```sql
SELECT AÑO, MES,
       SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}' AND "TIPO DE POZO"='{TIPO_POZO}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 23) Conteo de pozos con producción > 0 por mes en un campo
**Pregunta:** En {AÑO}, por mes, ¿cuántos pozos con producción > 0 tuvo el campo '{CAMPO}'?
```sql
SELECT AÑO, MES,
       COUNT(DISTINCT UWI) AS pozos_con_prod
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}' AND "Producción Aceite Dia_Mes" > 0
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 24) Top 5 campos por producción cada mes en una gerencia (año)
**Pregunta:** En {AÑO}, por mes, ¿cuáles son los top 5 campos por producción en la gerencia '{GERENCIA}'?
```sql
SELECT AÑO, MES, CAMPO, prod_aceite_mes_bls
FROM (
  SELECT AÑO, MES, CAMPO,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY SUM("Producción Aceite Dia_Mes") DESC
         ) AS rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
  GROUP BY AÑO, MES, CAMPO
)
WHERE rn <= 5
ORDER BY AÑO, MES, rn;
```

---

## C) “Mayor por mes” / rankings mensuales – 12

### 25) Pozo con mayor producción por mes en un campo (año)
**Pregunta:** En {AÑO}, ¿qué pozo tuvo mayor producción cada mes en el campo '{CAMPO}'?
```sql
SELECT AÑO, MES, UWI, prod_aceite_mes_bls
FROM (
  SELECT AÑO, MES, UWI,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY SUM("Producción Aceite Dia_Mes") DESC
         ) rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES, UWI
)
WHERE rn=1
ORDER BY AÑO, MES;
```

### 26) Campo con mayor producción por mes en una gerencia (año)
**Pregunta:** En {AÑO}, ¿qué campo lideró la producción cada mes en la gerencia '{GERENCIA}'?
```sql
SELECT AÑO, MES, CAMPO, prod_aceite_mes_bls
FROM (
  SELECT AÑO, MES, CAMPO,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY SUM("Producción Aceite Dia_Mes") DESC
         ) rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
  GROUP BY AÑO, MES, CAMPO
)
WHERE rn=1
ORDER BY AÑO, MES;
```

### 27) Activo con mayor producción por mes en una vicepresidencia (año)
**Pregunta:** En {AÑO}, ¿qué activo fue el mayor productor cada mes en la vicepresidencia '{VICEPRESIDENCIA}'?
```sql
SELECT AÑO, MES, ACTIVO, prod_aceite_mes_bls
FROM (
  SELECT AÑO, MES, ACTIVO,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY SUM("Producción Aceite Dia_Mes") DESC
         ) rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND VICEPRESIDENCIA='{VICEPRESIDENCIA}'
  GROUP BY AÑO, MES, ACTIVO
)
WHERE rn=1
ORDER BY AÑO, MES;
```

### 28) Top 3 pozos por producción por mes en un activo (año)
**Pregunta:** En {AÑO}, ¿cuáles son los top 3 pozos por producción cada mes en el activo '{ACTIVO}'?
```sql
SELECT AÑO, MES, UWI, prod_aceite_mes_bls
FROM (
  SELECT AÑO, MES, UWI,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY SUM("Producción Aceite Dia_Mes") DESC
         ) rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND ACTIVO='{ACTIVO}'
  GROUP BY AÑO, MES, UWI
)
WHERE rn<=3
ORDER BY AÑO, MES, rn;
```

### 29) Ranking mensual de campos (año) en una gerencia
**Pregunta:** En {AÑO}, por mes, arma el ranking de campos (top 10) en la gerencia '{GERENCIA}'.
```sql
SELECT AÑO, MES, CAMPO, prod_aceite_mes_bls, rn
FROM (
  SELECT AÑO, MES, CAMPO,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY SUM("Producción Aceite Dia_Mes") DESC
         ) rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
  GROUP BY AÑO, MES, CAMPO
)
WHERE rn<=10
ORDER BY AÑO, MES, rn;
```

### 30) Top pozo por tasa (ponderada) por mes en un campo (año)
**Pregunta:** En {AÑO}, por mes, ¿qué pozo tuvo la mayor tasa de aceite (ponderada) en el campo '{CAMPO}'?
```sql
SELECT AÑO, MES, UWI, tasa_aceite_bpd
FROM (
  SELECT AÑO, MES, UWI,
         SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_aceite_bpd,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY (SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0)) DESC
         ) rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES, UWI
)
WHERE rn=1
ORDER BY AÑO, MES;
```

### 31) Top 5 pozos por mes, solo pozos activos (campo/año)
**Pregunta:** En {AÑO}, por mes, ¿cuáles son los 5 pozos con mayor producción (solo activos) en el campo '{CAMPO}'?
```sql
SELECT AÑO, MES, UWI, prod_aceite_mes_bls
FROM (
  SELECT AÑO, MES, UWI,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls,
         ROW_NUMBER() OVER (
           PARTITION BY AÑO, MES
           ORDER BY SUM("Producción Aceite Dia_Mes") DESC
         ) rn
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}' AND "ESTADO POZO"='Activo'
  GROUP BY AÑO, MES, UWI
)
WHERE rn<=5
ORDER BY AÑO, MES, rn;
```

### 32) Campo más consistente (menor variación) por mes (año)
**Pregunta:** En {AÑO}, ¿qué campo muestra la menor variación mensual de producción dentro de la gerencia '{GERENCIA}'?
```sql
WITH serie AS (
  SELECT CAMPO, MES,
         SUM("Producción Aceite Dia_Mes") AS prod
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
  GROUP BY CAMPO, MES
),
stats AS (
  SELECT CAMPO,
         AVG(prod) AS avg_prod,
         AVG(prod*prod) - AVG(prod)*AVG(prod) AS var_prod
  FROM serie
  GROUP BY CAMPO
)
SELECT CAMPO, avg_prod, var_prod
FROM stats
ORDER BY var_prod ASC
LIMIT 1;
```

### 33) Mes pico (máximo) de producción de un campo (año)
**Pregunta:** En {AÑO}, ¿en qué mes el campo '{CAMPO}' tuvo su producción máxima?
```sql
SELECT MES, prod_aceite_mes_bls
FROM (
  SELECT MES,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY MES
)
ORDER BY prod_aceite_mes_bls DESC
LIMIT 1;
```

### 34) Mes mínimo de producción de un campo (año)
**Pregunta:** En {AÑO}, ¿en qué mes el campo '{CAMPO}' tuvo su producción mínima?
```sql
SELECT MES, prod_aceite_mes_bls
FROM (
  SELECT MES,
         SUM("Producción Aceite Dia_Mes") AS prod_aceite_mes_bls
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY MES
)
ORDER BY prod_aceite_mes_bls ASC
LIMIT 1;
```

### 35) Top 10 campos por producción acumulada anual (gerencia/año)
**Pregunta:** En {AÑO}, ¿cuáles son los 10 campos con mayor producción acumulada en la gerencia '{GERENCIA}'?
```sql
SELECT CAMPO,
       SUM("Producción Aceite Dia_Mes") AS prod_anual_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
GROUP BY CAMPO
ORDER BY prod_anual_bls DESC
LIMIT 10;
```

### 36) Top 10 pozos por producción anual en un campo (año)
**Pregunta:** En {AÑO}, ¿cuáles son los 10 pozos con mayor producción acumulada en el campo '{CAMPO}'?
```sql
SELECT UWI,
       SUM("Producción Aceite Dia_Mes") AS prod_anual_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
GROUP BY UWI
ORDER BY prod_anual_bls DESC
LIMIT 10;
```

---

## D) Comparativos MoM / YoY / YTD / Rolling – 24

### 37) MoM: variación mes a mes de producción (campo/año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la variación MoM de producción del campo '{CAMPO}'?
```sql
WITH serie AS (
  SELECT AÑO, MES,
         SUM("Producción Aceite Dia_Mes") AS prod
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES
)
SELECT
  AÑO, MES, prod,
  prod - LAG(prod) OVER (ORDER BY AÑO, MES) AS delta_mom,
  CASE
    WHEN LAG(prod) OVER (ORDER BY AÑO, MES) IS NULL THEN NULL
    ELSE (prod * 1.0 / LAG(prod) OVER (ORDER BY AÑO, MES) - 1.0)
  END AS pct_mom
FROM serie
ORDER BY AÑO, MES;
```

### 38) MoM: variación mes a mes de tasa (ponderada) (campo/año)
**Pregunta:** En {AÑO}, por mes, ¿cuál es la variación MoM de tasa (ponderada) del campo '{CAMPO}'?
```sql
WITH serie AS (
  SELECT AÑO, MES,
         SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES
)
SELECT
  AÑO, MES, tasa,
  tasa - LAG(tasa) OVER (ORDER BY AÑO, MES) AS delta_mom,
  CASE
    WHEN LAG(tasa) OVER (ORDER BY AÑO, MES) IS NULL THEN NULL
    ELSE (tasa * 1.0 / LAG(tasa) OVER (ORDER BY AÑO, MES) - 1.0)
  END AS pct_mom
FROM serie
ORDER BY AÑO, MES;
```

### 39) YoY: comparar producción de un mes entre dos años (campo, mismo mes)
**Pregunta:** Para el mes {MES}, compara producción del campo '{CAMPO}' entre {AÑO} y {AÑO}-1.
```sql
SELECT
  AÑO,
  SUM("Producción Aceite Dia_Mes") AS prod_mes_bls
FROM RESULTADOSREGRESION
WHERE CAMPO='{CAMPO}'
  AND MES={MES}
  AND AÑO IN ({AÑO}, {AÑO}-1)
GROUP BY AÑO
ORDER BY AÑO;
```

### 40) YoY: variación % de producción de un mes vs año anterior (campo)
**Pregunta:** Para el mes {MES}, ¿cuál es el % YoY de producción del campo '{CAMPO}' en {AÑO} vs {AÑO}-1?
```sql
WITH y AS (
  SELECT AÑO, SUM("Producción Aceite Dia_Mes") AS prod
  FROM RESULTADOSREGRESION
  WHERE CAMPO='{CAMPO}' AND MES={MES} AND AÑO IN ({AÑO}, {AÑO}-1)
  GROUP BY AÑO
)
SELECT
  (SELECT prod FROM y WHERE AÑO={AÑO}) AS prod_actual,
  (SELECT prod FROM y WHERE AÑO={AÑO}-1) AS prod_prev,
  CASE
    WHEN (SELECT prod FROM y WHERE AÑO={AÑO}-1) IS NULL OR (SELECT prod FROM y WHERE AÑO={AÑO}-1)=0 THEN NULL
    ELSE ((SELECT prod FROM y WHERE AÑO={AÑO}) * 1.0 / (SELECT prod FROM y WHERE AÑO={AÑO}-1) - 1.0)
  END AS pct_yoy;
```

### 41) YoY: serie mensual comparando dos años (campo)
**Pregunta:** Serie mensual YoY del campo '{CAMPO}' comparando {AÑO} vs {AÑO}-1.
```sql
SELECT
  AÑO, MES,
  SUM("Producción Aceite Dia_Mes") AS prod_mes_bls
FROM RESULTADOSREGRESION
WHERE CAMPO='{CAMPO}'
  AND AÑO IN ({AÑO}, {AÑO}-1)
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 42) YoY: serie mensual con delta y % (campo)
**Pregunta:** Serie mensual con delta y % YoY para el campo '{CAMPO}' en {AÑO} vs {AÑO}-1.
```sql
WITH s AS (
  SELECT AÑO, MES, SUM("Producción Aceite Dia_Mes") AS prod
  FROM RESULTADOSREGRESION
  WHERE CAMPO='{CAMPO}' AND AÑO IN ({AÑO}, {AÑO}-1)
  GROUP BY AÑO, MES
),
p AS (
  SELECT
    MES,
    MAX(CASE WHEN AÑO={AÑO} THEN prod END) AS prod_actual,
    MAX(CASE WHEN AÑO={AÑO}-1 THEN prod END) AS prod_prev
  FROM s
  GROUP BY MES
)
SELECT
  MES, prod_actual, prod_prev,
  (prod_actual - prod_prev) AS delta_yoy,
  CASE WHEN prod_prev IS NULL OR prod_prev=0 THEN NULL ELSE (prod_actual*1.0/prod_prev - 1.0) END AS pct_yoy
FROM p
ORDER BY MES;
```

### 43) YTD: acumulado a la fecha (hasta mes {MES}) para un campo
**Pregunta:** En {AÑO}, ¿cuál es el acumulado (YTD) de producción del campo '{CAMPO}' hasta el mes {MES}?
```sql
SELECT
  SUM("Producción Aceite Dia_Mes") AS prod_ytd_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}' AND MES BETWEEN 1 AND {MES};
```

### 44) YTD: acumulado mensual (running sum) por mes para un campo
**Pregunta:** En {AÑO}, por mes, muéstrame el acumulado YTD de producción del campo '{CAMPO}'.
```sql
WITH serie AS (
  SELECT AÑO, MES, SUM("Producción Aceite Dia_Mes") AS prod
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES
)
SELECT
  AÑO, MES, prod,
  SUM(prod) OVER (ORDER BY AÑO, MES) AS prod_ytd
FROM serie
ORDER BY AÑO, MES;
```

### 45) Rolling 3M: promedio móvil 3 meses de producción (campo)
**Pregunta:** En {AÑO}, por mes, calcula el promedio móvil 3M de producción del campo '{CAMPO}'.
```sql
WITH serie AS (
  SELECT AÑO, MES, SUM("Producción Aceite Dia_Mes") AS prod
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES
)
SELECT
  AÑO, MES, prod,
  AVG(prod) OVER (ORDER BY AÑO, MES ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS rolling_3m_avg
FROM serie
ORDER BY AÑO, MES;
```

### 46) Rolling 6M: suma móvil 6 meses de producción (campo)
**Pregunta:** En {AÑO}, por mes, calcula la suma móvil 6M de producción del campo '{CAMPO}'.
```sql
WITH serie AS (
  SELECT AÑO, MES, SUM("Producción Aceite Dia_Mes") AS prod
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES
)
SELECT
  AÑO, MES, prod,
  SUM(prod) OVER (ORDER BY AÑO, MES ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) AS rolling_6m_sum
FROM serie
ORDER BY AÑO, MES;
```

### 47) Comparar dos campos por mes (año) – producción
**Pregunta:** En {AÑO}, por mes, compara producción entre los campos '{CAMPO1}' y '{CAMPO2}'.
```sql
SELECT
  AÑO, MES, CAMPO,
  SUM("Producción Aceite Dia_Mes") AS prod_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO IN ('{CAMPO1}', '{CAMPO2}')
GROUP BY AÑO, MES, CAMPO
ORDER BY AÑO, MES, CAMPO;
```

### 48) Comparar dos campos por mes (año) – tasa ponderada
**Pregunta:** En {AÑO}, por mes, compara tasa ponderada entre '{CAMPO1}' y '{CAMPO2}'.
```sql
SELECT
  AÑO, MES, CAMPO,
  SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO IN ('{CAMPO1}', '{CAMPO2}')
GROUP BY AÑO, MES, CAMPO
ORDER BY AÑO, MES, CAMPO;
```

### 49) “Últimos N meses” dentro de un año (campo) – producción
**Pregunta:** En {AÑO}, muéstrame la producción del campo '{CAMPO}' en los últimos {N} meses del año.
```sql
SELECT AÑO, MES,
       SUM("Producción Aceite Dia_Mes") AS prod_mes_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
  AND MES BETWEEN (12 - {N} + 1) AND 12
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 50) Rango de meses (campo) – producción total
**Pregunta:** Entre los meses {MES1} y {MES2} de {AÑO}, ¿cuál fue la producción total del campo '{CAMPO}'?
```sql
SELECT
  SUM("Producción Aceite Dia_Mes") AS prod_total_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}' AND MES BETWEEN {MES1} AND {MES2};
```

### 51) Rango de meses (gerencia) – tasa ponderada promedio del rango
**Pregunta:** Entre {MES1}-{MES2} de {AÑO}, ¿cuál fue la tasa ponderada promedio de la gerencia '{GERENCIA}'?
```sql
SELECT
  SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}' AND MES BETWEEN {MES1} AND {MES2};
```

### 52) Pozo con mayor producción anual dentro de un campo (año)
**Pregunta:** En {AÑO}, ¿qué pozo fue el mayor productor del campo '{CAMPO}' en el año completo?
```sql
SELECT UWI,
       SUM("Producción Aceite Dia_Mes") AS prod_anual_bls
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
GROUP BY UWI
ORDER BY prod_anual_bls DESC
LIMIT 1;
```

### 53) Pozo con mayor tasa promedio anual (ponderada) dentro de un campo
**Pregunta:** En {AÑO}, ¿qué pozo tuvo la mayor tasa promedio anual (ponderada) en el campo '{CAMPO}'?
```sql
SELECT UWI,
       SUM("Tasa Producción Aceite" * PROD_DAYS) / NULLIF(SUM(PROD_DAYS),0) AS tasa_prom_anual_bpd
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
GROUP BY UWI
ORDER BY tasa_prom_anual_bpd DESC
LIMIT 1;
```

### 54) Participación mensual de un campo dentro de su gerencia
**Pregunta:** En {AÑO}, por mes, ¿qué porcentaje de la producción de la gerencia '{GERENCIA}' aporta el campo '{CAMPO}'?
```sql
WITH g AS (
  SELECT AÑO, MES, SUM("Producción Aceite Dia_Mes") AS prod_g
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}'
  GROUP BY AÑO, MES
),
c AS (
  SELECT AÑO, MES, SUM("Producción Aceite Dia_Mes") AS prod_c
  FROM RESULTADOSREGRESION
  WHERE AÑO={AÑO} AND GERENCIA='{GERENCIA}' AND CAMPO='{CAMPO}'
  GROUP BY AÑO, MES
)
SELECT
  g.AÑO, g.MES, c.prod_c, g.prod_g,
  CASE WHEN g.prod_g=0 THEN NULL ELSE (c.prod_c*1.0/g.prod_g) END AS pct_participacion
FROM g
LEFT JOIN c ON c.AÑO=g.AÑO AND c.MES=g.MES
ORDER BY g.AÑO, g.MES;
```

### 55) Conteo mensual de pozos activos vs inactivos en un campo
**Pregunta:** En {AÑO}, por mes, ¿cuántos pozos activos e inactivos hay en el campo '{CAMPO}'?
```sql
SELECT AÑO, MES, "ESTADO POZO",
       COUNT(DISTINCT UWI) AS pozos
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
GROUP BY AÑO, MES, "ESTADO POZO"
ORDER BY AÑO, MES, "ESTADO POZO";
```

### 56) Días de producción promedio por mes en un campo
**Pregunta:** En {AÑO}, por mes, ¿cuál es el promedio de PROD_DAYS en el campo '{CAMPO}'?
```sql
SELECT AÑO, MES,
       AVG(PROD_DAYS) AS avg_prod_days
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND CAMPO='{CAMPO}'
GROUP BY AÑO, MES
ORDER BY AÑO, MES;
```

### 57) Validación: PROD_DAYS > DIAS_MES (anomalías) en un año
**Pregunta:** En {AÑO}, ¿hay registros donde PROD_DAYS sea mayor que DIAS_MES?
```sql
SELECT AÑO, MES, UWI, CAMPO, PROD_DAYS, DIAS_MES
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND PROD_DAYS > DIAS_MES
ORDER BY AÑO, MES
LIMIT 200;
```

### 58) Validación: pozos activos con PROD_DAYS=0 (anomalías) en un año
**Pregunta:** En {AÑO}, ¿hay pozos activos con PROD_DAYS = 0?
```sql
SELECT AÑO, MES, UWI, CAMPO, "ESTADO POZO", PROD_DAYS
FROM RESULTADOSREGRESION
WHERE AÑO={AÑO} AND "ESTADO POZO"='Activo' AND PROD_DAYS=0
ORDER BY AÑO, MES
LIMIT 200;
```

### 59) Duplicados por UWI-MES-AÑO (data quality)
**Pregunta:** ¿Qué combinaciones UWI-MES-AÑO están duplicadas?
```sql
SELECT UWI, AÑO, MES, COUNT(*) AS cnt
FROM RESULTADOSREGRESION
GROUP BY UWI, AÑO, MES
HAVING cnt > 1
ORDER BY cnt DESC
LIMIT 500;
```

### 60) Resolver duplicados: seleccionar registro “vigente” por EBITDA (ejemplo)
**Pregunta:** Si hay duplicados por UWI-MES-AÑO, ¿cómo me quedo con 1 registro por combinación?
```sql
SELECT *
FROM (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY UWI, AÑO, MES
      ORDER BY "EBITDA (Activo) KUSD" DESC
    ) AS rn
  FROM RESULTADOSREGRESION
)
WHERE rn=1;
```

---

## 7) Recomendación operativa para el agente (pipeline)

1. **Extraer entidades**: CAMPO/UWI/GERENCIA/ACTIVO, mes, año, tipo de métrica, “por mes / top / YoY / MoM / YTD / rolling”.  
2. **Elegir plantilla** de este documento.  
3. **Aplicar reglas de agregación** (volumen SUM / tasa ponderada).  
4. **Validar** (sección 4).  
5. Ejecutar y responder:  
   - Siempre indicar filtros usados (CAMPO, AÑO, MES)  
   - Indicar si es Activo o AI  
   - Indicar si es tasa ponderada o volumen acumulado  

---

**Fin.**

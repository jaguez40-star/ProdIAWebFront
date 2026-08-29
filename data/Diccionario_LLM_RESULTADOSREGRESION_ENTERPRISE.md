# SYSTEM DATA CONTRACT -- ENTERPRISE VERSION

## Tabla: RESULTADOSREGRESION

Base de datos: ROBUSTEZ.db Modo: Agente Autónomo Controlado
(Enterprise-Grade)

------------------------------------------------------------------------

# 1. PROPÓSITO

Este documento define el marco completo para que un LLM:

-   Genere SQL correctamente.
-   Valide estructura antes de ejecutar consultas.
-   Evite errores jerárquicos.
-   Minimice alucinaciones.
-   Sea apto para producción corporativa.

------------------------------------------------------------------------

# 2. PLANTILLAS SQL AUTOMÁTICAS (POR TIPO DE PREGUNTA)

## 2.1 Conteo por Jerarquía

``` sql
SELECT GERENCIA,
       COUNT(DISTINCT UWI) AS TOTAL_POZOS
FROM RESULTADOSREGRESION
WHERE AÑO = {AÑO}
GROUP BY GERENCIA;
```

## 2.2 Validación de duplicados

``` sql
SELECT UWI, MES, AÑO, COUNT(*) AS CNT
FROM RESULTADOSREGRESION
GROUP BY UWI, MES, AÑO
HAVING CNT > 1;
```

## 2.3 Distribución por estado

``` sql
SELECT GERENCIA,
       "ESTADO POZO",
       COUNT(*) AS TOTAL
FROM RESULTADOSREGRESION
WHERE AÑO = {AÑO}
GROUP BY GERENCIA, "ESTADO POZO";
```

## 2.4 Promedio ponderado correcto

``` sql
SELECT CAMPO,
       SUM("Tasa Producción Aceite" * PROD_DAYS) / SUM(PROD_DAYS) AS TASA_PONDERADA
FROM RESULTADOSREGRESION
WHERE AÑO = {AÑO}
GROUP BY CAMPO;
```

------------------------------------------------------------------------

# 3. TESTS UNITARIOS -- EXPECTED SQL PATTERN

El agente debe cumplir patrones mínimos.

## 3.1 Test -- Agregación correcta

Esperado: - Debe incluir GROUP BY si usa SUM(). - No debe mezclar
niveles jerárquicos sin agrupar.

## 3.2 Test -- Columnas con espacios

Esperado: - Las columnas con espacios deben ir entre comillas dobles.

Incorrecto: SELECT Tasa Producción Aceite

Correcto: SELECT "Tasa Producción Aceite"

## 3.3 Test -- Filtro temporal

Si pregunta menciona año: Debe incluir WHERE AÑO = X

## 3.4 Test -- Anti-SQL peligroso

Bloquear: - DROP - DELETE - UPDATE - INSERT

Solo permitir SELECT.

------------------------------------------------------------------------

# 4. PROMPT BASE PARA FINE-TUNING

System Prompt sugerido:

Eres un agente analítico experto en producción petrolera. Trabajas
exclusivamente sobre la tabla RESULTADOSREGRESION. No inventes columnas.
No asumas datos externos. Respeta jerarquía organizacional. Genera
únicamente SQL SELECT válido en SQLite. Valida que columnas con espacios
estén citadas. Si una columna no existe, responde con advertencia.

------------------------------------------------------------------------

# 5. REGLAS DE VALIDACIÓN PRE-EJECUCIÓN

Antes de ejecutar SQL, el sistema debe verificar:

1.  Solo contiene SELECT.
2.  No contiene subconsultas no controladas.
3.  No contiene funciones no soportadas por SQLite.
4.  Incluye filtro temporal si la pregunta lo requiere.
5.  Incluye GROUP BY si usa SUM().
6.  No mezcla columnas agregadas y no agregadas sin agrupar.
7.  Respeta jerarquía organizacional.
8.  No supera límite de filas (ej. LIMIT 1000).
9.  No ejecuta FULL TABLE SCAN sin filtro cuando la tabla es grande.
10. No accede a tablas externas.

------------------------------------------------------------------------

# 6. CONTROL DE COSTO COMPUTACIONAL

Reglas recomendadas:

-   Siempre usar LIMIT cuando sea exploratorio.
-   Siempre usar índice AÑO cuando se consulte histórico.
-   Evitar SELECT \* en producción.
-   Evitar ORDER BY sin índice.

------------------------------------------------------------------------

# 7. MODO SEGURO DE EJECUCIÓN

Flujo recomendado:

Pregunta → Interpretación → Generación SQL → Validación automática →
Ejecución → Respuesta estructurada.

------------------------------------------------------------------------

# 8. NIVEL DE MADUREZ DEL AGENTE

Este documento habilita:

Nivel 1 -- Generador SQL básico Nivel 2 -- Analista jerárquico Nivel 3
-- Analista financiero Nivel 4 -- Agente autónomo controlado
(Enterprise)


# 13. DATASET DE ENTRENAMIENTO -- JERARQUÍA / LLAVES DE NEGOCIO

Esta sección contiene preguntas optimizadas para entrenar al agente LLM
en comprensión estructural antes de análisis económicos.

------------------------------------------------------------------------

## 🔹 A. 10 Preguntas -- Nivel GERENCIA

1.  ¿Cuántos ACTIVOS existen por cada GERENCIA?
2.  ¿Cuántos CAMPOS distintos tiene cada GERENCIA?
3.  ¿Cuántos UWI únicos existen por GERENCIA en el año 2025?
4.  ¿Qué GERENCIA tiene mayor número de pozos activos (ESTADO POZO =
    'Activo')?
5.  ¿Cuál es el promedio de PROD_DAYS por GERENCIA en 2024?
6.  ¿Qué GERENCIAS operan en más de una VICEPRESIDENCIA?
7.  ¿Existen GERENCIAS sin registros en el año 2023?
8.  ¿Cuál es la distribución de TIPO DE POZO por GERENCIA?
9.  ¿Qué GERENCIA tiene mayor cantidad de registros históricos
    acumulados?
10. ¿Existen UWI que cambien de GERENCIA entre años consecutivos?

------------------------------------------------------------------------

## 🔹 B. 10 Preguntas -- Nivel CAMPO

1.  ¿Cuántos UWI únicos existen por CAMPO?
2.  ¿Qué CAMPO pertenece a más de un ACTIVO?
3.  ¿Cuál es el total de PROD_DAYS acumulado por CAMPO en 2025?
4.  ¿Qué CAMPOS tienen registros en todos los años disponibles?
5.  ¿Cuál es la distribución de ESTADO POZO por CAMPO?
6.  ¿Qué CAMPO tiene mayor cantidad de pozos tipo productor?
7.  ¿Existen CAMPOS asociados a más de una GERENCIA?
8.  ¿Qué CAMPOS no tienen actividad en el MES 12 de 2024?
9.  ¿Cuál es el promedio de DIAS_MES por CAMPO?
10. ¿Existen UWI duplicados dentro del mismo CAMPO en un mismo año?

------------------------------------------------------------------------

## 🔹 C. 10 Preguntas -- Validación de Consistencia Jerárquica

1.  ¿Existen UWI asociados a más de un CAMPO en el mismo AÑO?
2.  ¿Existen CAMPO asociados a más de un ACTIVO?
3.  ¿Existen ACTIVOS asociados a más de una GERENCIA?
4.  ¿Existen GERENCIAS asociadas a más de una VICEPRESIDENCIA?
5.  ¿Existen UWI sin VICEPRESIDENCIA asignada?
6.  ¿Existen registros con MES fuera del rango 1--12?
7.  ¿Existen registros con AÑO nulo?
8.  ¿Existen PROD_DAYS mayores a DIAS_MES?
9.  ¿Existen pozos activos con PROD_DAYS = 0?
10. ¿Existen combinaciones UWI-MES-AÑO repetidas?

------------------------------------------------------------------------

Estas preguntas deben utilizarse para validar que el agente: - Comprende
la jerarquía correctamente. - Genera SQL consistente. - Detecta
anomalías estructurales. - No mezcla niveles jerárquicos
incorrectamente.

------------------------------------------------------------------------

FIN DEL DOCUMENTO -- ENTERPRISE VERSION

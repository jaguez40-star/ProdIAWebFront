-- 003_bopd_periodo_real.sql
-- ECP_DIFERIDAS · Punto 2: BOPD = ACEITE_PERDIDO / dias del periodo REAL (no fijo por año)
--
-- PROBLEMA
--   DIM_DIFERIDAS.BOPD cambiaba de SIGNIFICADO segun el año:
--     2023 -> ACEITE_PERDIDO / 365.0     (divide por el AÑO)
--     2024 -> ACEITE_PERDIDO / 366.0     (divide por el AÑO)
--     2025 -> ACEITE_PERDIDO / dias del MES (31/28/31/30/31/30/31), NULL en ago-dic
--   Sumar BOPD de 2023/24 da el promedio diario anual (correcto), pero sumar 2025 da la SUMA
--   de 7 promedios MENSUALES -> 177.552 BOPD cuando el real es 25.444: 7,0x inflado.
--   Por eso las vistas lo esquivaban con SUM(ACEITE_PERDIDO)/dias. Cualquiera que consulte
--   DIM_DIFERIDAS directamente y sume BOPD obtiene 7x de mas.
--   Ademas: NULL para meses 8-12 de 2025 y para cualquier año != 2023/24/25 -> la BD caduca.
--
-- SOLUCION
--   Un solo criterio para TODOS los años: dividir por los dias realmente cubiertos por ese año,
--   tomados de DIM_CORTE (creada en la migracion 001). Asi SUM(BOPD) de cualquier año = su
--   promedio diario, sin constantes y sin caducidad.
--
-- EFECTO ESPERADO
--   2025: SUM(BOPD) 177.552 -> 25.444  (queda IGUAL a lo que ya calculan las vistas) [FIX]
--   2023: /365 -> /364 (la data llega al 30-dic, no al 31) -> +0,27% [CORRECCION menor pero real]
--   2024: /366 -> /366 -> SIN CAMBIO
--
-- DE PASO (2 arreglos provados como neutros, verificados abajo):
--   * CAUSE_NIVEL3: se agrega COALESCE. Antes 'NULL NOT IN (...)' evalua a NULL (no TRUE), asi
--     que los 88 registros con NULL NO se normalizaban a 'No planeada' como pretendia la regla.
--   * "Operacionales" entre comillas DOBLES (identificador en SQL) -> comillas simples (literal).
--     Hoy funciona por el fallback de SQLite, pero se rompe si algun dia existe esa columna.
--
-- IDEMPOTENTE (DROP VIEW IF EXISTS + CREATE VIEW). Rollback: 003_rollback.sql

BEGIN;

DROP VIEW IF EXISTS DIM_DIFERIDAS;
CREATE VIEW DIM_DIFERIDAS AS
WITH datos AS (
  SELECT *,
         CAST(SUBSTR(EVENT_DATE, 1, 4) AS INTEGER) AS anio,
         CAST(SUBSTR(EVENT_DATE, 6, 2) AS INTEGER) AS mes
  FROM AVM_DATADIF
)
SELECT
  d.id_row, d.VICE, d.GERENCIA, d.AREA, d.CAMPO, d.EVENT_DATE, d.COMPLETION,
  d.INI_DATE, d.END_DATE, d.CAUSE_NIVEL2,
  CASE WHEN COALESCE(d.CAUSE_NIVEL3, '') NOT IN ('No planeada', 'Planeada')
       THEN 'No planeada' ELSE d.CAUSE_NIVEL3 END AS CAUSE_NIVEL3,
  d.CAUSE_NIVEL4, d.CAUSE_NIVEL5, d.CAUSE, d.COMENTARIO,
  d.ACEITE_PERDIDO, d.AGUA_PERDIDO, d.GAS_PERDIDO,
  -- BOPD = pérdida / días REALMENTE cubiertos por ese año (DIM_CORTE). Un solo criterio para
  -- todos los años: SUM(BOPD) de un año = promedio diario de ese año, siempre. Sin constantes,
  -- sin NULL por mes no contemplado, y se actualiza solo al cargar nueva data.
  (d.ACEITE_PERDIDO / k.dias) AS BOPD,
  h.VICE_HOM,
  CASE WHEN v."CAUSAS VPU - AGRUPADAS" IS NULL THEN 'Operacionales'
       ELSE v."CAUSAS VPU - AGRUPADAS" END AS CAUSAS_VPU_AGRUPADAS
FROM datos d
JOIN      DATA_HOM  h ON d.CAMPO = h.CAMPO
LEFT JOIN DATA_VPU  v ON d.CAUSE_NIVEL4 = v.CAUSE_NIVEL4
LEFT JOIN DIM_CORTE k ON k.anio = d.anio;

COMMIT;

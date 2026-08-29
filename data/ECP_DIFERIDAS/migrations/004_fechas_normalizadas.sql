-- 004_fechas_normalizadas.sql
-- ECP_DIFERIDAS · Punto 3: normalizar EVENT_DATE y parsear INI/END_DATE a ISO
--
-- PROBLEMA
--   EVENT_DATE convive en DOS formatos partidos por año:
--       2023      -> '2023-12-21 00:00:00' (19 ch)   389.937 filas
--       2024/2025 -> '2025-01-18'          (10 ch)   752.662 filas
--   Las vistas se salvan porque usan SUBSTR(...,1,4)/(...,6,2), pero ACUM_DIF_2025 y
--   ACUM_DIF_N3 filtran con BETWEEN '2025-01-01' AND '2025-12-31' sobre el texto crudo:
--   si a 2025 le llegan a poner hora, '2025-12-31 08:00' > '2025-12-31' y se PIERDE ese dia.
--
--   INI_DATE / END_DATE son peores: mezclan DOS formatos y ninguno ordena como fecha.
--       ESPAÑOL  718.096 filas  'd/mm/yyyy h:mm:ss<U+202F>a.<U+202F>m.'  (reloj de 12 h)
--       ISO      424.503 filas  'YYYY-MM-DD HH:MM:SS'
--   Por eso MIN/MAX de esas columnas devolvian '1/01/2024...' y '9/12/2024...' (orden
--   alfabetico, no cronologico) -> hoy son INUTILIZABLES para rango o para duracion.
--
-- SOLUCION (aditiva: NO se toca ni un dato, las columnas crudas se conservan)
--   DIM_DIFERIDAS expone 4 columnas nuevas:
--     EVENT_DIA  fecha del evento normalizada a 'YYYY-MM-DD' (sirve para BETWEEN)
--     INI_TS     inicio  en ISO 'YYYY-MM-DD HH:MM:SS'
--     END_TS     fin     en ISO
--     DUR_HORAS  duracion del evento en horas (habilita el analisis de duracion)
--   El parser 12h->24h se valido fila a fila contra datetime.strptime de Python:
--   60.000/60.000 coincidencias, incluidos los bordes 12 a.m.->00 y 12 p.m.->12.
--
--   Ademas ACUM_DIF_2025 y ACUM_DIF_N3 pasan a filtrar por EVENT_DIA (mismo resultado hoy,
--   pero deja de ser fragil ante el formato).
--
-- IDEMPOTENTE. Rollback: 004_rollback.sql

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
  (d.ACEITE_PERDIDO / k.dias) AS BOPD,
  h.VICE_HOM,
  CASE WHEN v."CAUSAS VPU - AGRUPADAS" IS NULL THEN 'Operacionales'
       ELSE v."CAUSAS VPU - AGRUPADAS" END AS CAUSAS_VPU_AGRUPADAS,
  -- ---- FECHAS NORMALIZADAS (004) -- las crudas se conservan arriba, sin tocar ----
  SUBSTR(d.EVENT_DATE, 1, 10) AS EVENT_DIA,
  CASE WHEN d.INI_DATE IS NULL THEN NULL WHEN d.INI_DATE GLOB '[0-9][0-9][0-9][0-9]-*' THEN substr(d.INI_DATE,1,19) ELSE printf('%s-%s-%02d %02d:%s',substr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),instr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),'/')+1),substr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),1,instr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),'/')-1),CAST(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),1,instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')-1) AS INTEGER),CASE WHEN (d.INI_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)<12 THEN CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)+12 WHEN NOT (d.INI_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)=12 THEN 0 ELSE CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER) END,substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')+1)) END AS INI_TS,
  CASE WHEN d.END_DATE IS NULL THEN NULL WHEN d.END_DATE GLOB '[0-9][0-9][0-9][0-9]-*' THEN substr(d.END_DATE,1,19) ELSE printf('%s-%s-%02d %02d:%s',substr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),instr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),'/')+1),substr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),1,instr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),'/')-1),CAST(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),1,instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')-1) AS INTEGER),CASE WHEN (d.END_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)<12 THEN CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)+12 WHEN NOT (d.END_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)=12 THEN 0 ELSE CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER) END,substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')+1)) END AS END_TS,
  ROUND((julianday(CASE WHEN d.END_DATE IS NULL THEN NULL WHEN d.END_DATE GLOB '[0-9][0-9][0-9][0-9]-*' THEN substr(d.END_DATE,1,19) ELSE printf('%s-%s-%02d %02d:%s',substr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),instr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),'/')+1),substr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),1,instr(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')+1),'/')-1),CAST(substr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),1,instr(substr(d.END_DATE,1,instr(d.END_DATE,' ')-1),'/')-1) AS INTEGER),CASE WHEN (d.END_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)<12 THEN CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)+12 WHEN NOT (d.END_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)=12 THEN 0 ELSE CAST(substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER) END,substr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),instr(substr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),1,instr(substr(d.END_DATE,instr(d.END_DATE,' ')+1),char(8239))-1),':')+1)) END) - julianday(CASE WHEN d.INI_DATE IS NULL THEN NULL WHEN d.INI_DATE GLOB '[0-9][0-9][0-9][0-9]-*' THEN substr(d.INI_DATE,1,19) ELSE printf('%s-%s-%02d %02d:%s',substr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),instr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),'/')+1),substr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),1,instr(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')+1),'/')-1),CAST(substr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),1,instr(substr(d.INI_DATE,1,instr(d.INI_DATE,' ')-1),'/')-1) AS INTEGER),CASE WHEN (d.INI_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)<12 THEN CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)+12 WHEN NOT (d.INI_DATE LIKE '%p.%m.') AND CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER)=12 THEN 0 ELSE CAST(substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),1,instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')-1) AS INTEGER) END,substr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),instr(substr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),1,instr(substr(d.INI_DATE,instr(d.INI_DATE,' ')+1),char(8239))-1),':')+1)) END)) * 24.0, 2) AS DUR_HORAS
FROM datos d
JOIN      DATA_HOM  h ON d.CAMPO = h.CAMPO
LEFT JOIN DATA_VPU  v ON d.CAUSE_NIVEL4 = v.CAUSE_NIVEL4
LEFT JOIN DIM_CORTE k ON k.anio = d.anio;

-- ACUM_DIF_2025: BETWEEN sobre EVENT_DIA (x1) en vez del texto crudo
DROP VIEW IF EXISTS ACUM_DIF_2025;
CREATE VIEW ACUM_DIF_2025 AS WITH resumen AS (
  SELECT  
    CAST(SUBSTR(x.EVENT_DATE, 6, 2) AS INTEGER) AS MES,
    x.CAUSAS_VPU_AGRUPADAS,
    SUM(x.ACEITE_PERDIDO) AS DIF_BOPD
  FROM 
    DIM_DIFERIDAS x
  WHERE 
    x.EVENT_DIA BETWEEN '2025-01-01' AND '2025-12-31'
  GROUP BY 
    MES, 
    x.CAUSAS_VPU_AGRUPADAS
)
SELECT 
  CAST(MES AS INTEGER) AS idex,
  '2025' AS AÑO,
  CASE MES
    WHEN 1 THEN 'ENERO-2025'
    WHEN 2 THEN 'FEBRERO-2025'
    WHEN 3 THEN 'MARZO-2025'
    WHEN 4 THEN 'ABRIL-2025'
    WHEN 5 THEN 'MAYO-2025'
    WHEN 6 THEN 'JUNIO-2025'
    WHEN 7 THEN 'JULIO-2025'
    ELSE NULL
  END AS MES,
  CAUSAS_VPU_AGRUPADAS,
  -- Nueva columna con la lógica condicional
  CASE MES
    WHEN 1 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSAS_VPU_AGRUPADAS ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 31.0, 2))
    WHEN 2 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSAS_VPU_AGRUPADAS ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 59.0, 2))
    WHEN 3 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSAS_VPU_AGRUPADAS ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 90.0, 2))
    WHEN 4 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSAS_VPU_AGRUPADAS ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 120.0, 2))
    WHEN 5 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSAS_VPU_AGRUPADAS ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 151.0, 2))
    WHEN 6 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSAS_VPU_AGRUPADAS ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 181.0, 2))
    WHEN 7 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSAS_VPU_AGRUPADAS ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 212.0, 2))
    ELSE NULL
  END AS DIF_BOPD
FROM resumen
ORDER BY 
idex,  
CAUSAS_VPU_AGRUPADAS;

-- ACUM_DIF_N3: BETWEEN sobre EVENT_DIA (x1) en vez del texto crudo
DROP VIEW IF EXISTS ACUM_DIF_N3;
CREATE VIEW ACUM_DIF_N3 AS WITH resumen AS (
  SELECT  
    CAST(SUBSTR(x.EVENT_DATE, 6, 2) AS INTEGER) AS MES,
    x.CAUSE_NIVEL3,
    SUM(x.ACEITE_PERDIDO) AS DIF_BOPD
  FROM 
    DIM_DIFERIDAS x
  WHERE 
    x.EVENT_DIA BETWEEN '2025-01-01' AND '2025-12-31'
  GROUP BY 
    MES, 
    x.CAUSE_NIVEL3
)
SELECT 
  CAST(MES AS INTEGER) AS idex,
  '2025' AS AÑO,
  CASE MES
    WHEN 1 THEN 'ENERO-2025'
    WHEN 2 THEN 'FEBRERO-2025'
    WHEN 3 THEN 'MARZO-2025'
    WHEN 4 THEN 'ABRIL-2025'
    WHEN 5 THEN 'MAYO-2025'
    WHEN 6 THEN 'JUNIO-2025'
    WHEN 7 THEN 'JULIO-2025'
    ELSE NULL
  END AS MES,
  CAUSE_NIVEL3,
  -- Nueva columna con la lógica condicional
  CASE MES
    WHEN 1 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSE_NIVEL3 ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 31.0, 2))
    WHEN 2 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSE_NIVEL3 ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 59.0, 2))
    WHEN 3 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSE_NIVEL3 ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 90.0, 2))
    WHEN 4 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSE_NIVEL3 ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 120.0, 2))
    WHEN 5 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSE_NIVEL3 ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 151.0, 2))
    WHEN 6 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSE_NIVEL3 ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 181.0, 2))
    WHEN 7 THEN (ROUND(SUM(DIF_BOPD) OVER (PARTITION BY CAUSE_NIVEL3 ORDER BY MES ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 212.0, 2))
    ELSE NULL
  END AS DIF_BOPD
FROM resumen
ORDER BY 
idex,  
CAUSE_NIVEL3;

COMMIT;

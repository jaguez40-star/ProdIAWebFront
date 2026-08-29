-- 003_rollback.sql -- restaura DIM_DIFERIDAS tal como estaba antes de 003.

BEGIN;

DROP VIEW IF EXISTS DIM_DIFERIDAS;
CREATE VIEW DIM_DIFERIDAS AS WITH datos AS (
    SELECT *,
           CAST(SUBSTR(EVENT_DATE, 1, 4) AS INTEGER) AS anio,
           CAST(SUBSTR(EVENT_DATE, 6, 2) AS INTEGER) AS mes
    FROM AVM_DATADIF
)
SELECT 
    d.id_row,
    d.VICE,
    d.GERENCIA,
    d.AREA,
    d.CAMPO,
    d.EVENT_DATE,
    d.COMPLETION,
    d.INI_DATE,
    d.END_DATE,
    d.CAUSE_NIVEL2,
    CASE
        WHEN d.CAUSE_NIVEL3 NOT IN ('No planeada', 'Planeada') THEN 'No planeada'
        ELSE
        d.CAUSE_NIVEL3
    END AS CAUSE_NIVEL3,
    d.CAUSE_NIVEL4,
    d.CAUSE_NIVEL5,
    d.CAUSE,
    d.COMENTARIO,
    d.ACEITE_PERDIDO,
    d.AGUA_PERDIDO,
    d.GAS_PERDIDO,
    CASE
        WHEN anio = 2023 THEN (ACEITE_PERDIDO / 365.0)
        WHEN anio = 2024 THEN (ACEITE_PERDIDO / 366.0)
        WHEN anio = 2025 THEN
            CASE mes
                WHEN 1 THEN ACEITE_PERDIDO / 31.0
                WHEN 2 THEN ACEITE_PERDIDO / 28.0
                WHEN 3 THEN ACEITE_PERDIDO / 31.0
                WHEN 4 THEN ACEITE_PERDIDO / 30.0
                WHEN 5 THEN ACEITE_PERDIDO / 31.0
                WHEN 6 THEN ACEITE_PERDIDO / 30.0
                WHEN 7 THEN ACEITE_PERDIDO / 31.0
                ELSE NULL
            END
        ELSE NULL
    END AS BOPD,
    h.VICE_HOM,
    CASE
        WHEN v."CAUSAS VPU - AGRUPADAS" IS NULL THEN "Operacionales"
        ELSE
        v."CAUSAS VPU - AGRUPADAS"
    END AS CAUSAS_VPU_AGRUPADAS
FROM datos d
JOIN DATA_HOM h ON d.CAMPO = h.CAMPO
LEFT JOIN DATA_VPU v ON d.CAUSE_NIVEL4 = v.CAUSE_NIVEL4;

COMMIT;

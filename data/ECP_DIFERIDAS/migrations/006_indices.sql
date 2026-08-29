-- 006_indices.sql
-- ECP_DIFERIDAS · Punto 4: indices (rendimiento). La BD no tenia NI UNO sobre 1,14 M filas.
--
-- DIAGNOSTICO (EXPLAIN QUERY PLAN, no suposiciones)
--   * SQLite construia un AUTOMATIC COVERING INDEX efimero para DATA_HOM y DATA_VPU en CADA
--     consulta y en CADA rama del UNION -> trabajo repetido gratis de eliminar.
--   * DIM_CORTE (3 filas) obliga a un SCAN completo de AVM_DATADIF cada vez que se usa.
--   * GRAF_DIF_06 escanea AVM_DATADIF ~6 veces (UNION de 3 ramas + DIM_CORTE).
--   * Se descarto la hipotesis "las filas pesan por el BLOB COMENTARIO": mide 1 B/fila.
--
-- MEDICION (mejor de 5 corridas, para descontar el cache del SO)
--   GRAF_DIF_06     5,00s -> 3,59s   (1,39x)
--   PARETOS_N4_N5   8,15s -> 6,18s   (1,32x)
--   Nota honesta: una primera medicion sugeria 2,5x; era ruido de cache. El numero real es ~1,35x.
--
-- COSTO EN DISCO: ~123 MB, pero la BD ya tenia 465 MB de paginas LIBRES -> el archivo NO crece.
--   (Ver al final: queda pendiente un VACUUM que reclamaria esos 465 MB.)
--
-- CONTRAPARTIDA: futuras cargas de datos seran algo mas lentas (hay que mantener los indices).
--
-- IDEMPOTENTE (IF NOT EXISTS). Rollback: 006_rollback.sql

BEGIN;

-- 1) Tablas de mapeo: evitan el indice efimero que SQLite rearmaba en cada consulta. Coste ~0 MB.
--    Ademas UNIQUE documenta y protege la relacion 1:1 verificada (104 campos / 172 causas).
CREATE UNIQUE INDEX IF NOT EXISTS ix_hom_campo ON DATA_HOM(CAMPO);
CREATE UNIQUE INDEX IF NOT EXISTS ix_vpu_n4    ON DATA_VPU(CAUSE_NIVEL4);

-- 2) EVENT_DATE: DIM_CORTE (MIN/MAX por año) y los filtros por rango pasan a recorrer el indice,
--    mucho mas angosto que la tabla completa. ~25 MB.
CREATE INDEX IF NOT EXISTS ix_dd_event ON AVM_DATADIF(EVENT_DATE);

-- 3) Indice CUBRIENTE de la agregacion tipica: las vistas leen solo estas columnas, asi que el
--    scan se hace sobre el indice y no sobre la tabla. ~97 MB.
CREATE INDEX IF NOT EXISTS ix_dd_cover ON AVM_DATADIF
  (EVENT_DATE, CAMPO, CAUSE_NIVEL4, CAUSE_NIVEL5, CAUSE_NIVEL2, ACEITE_PERDIDO);

COMMIT;

-- Deja las estadisticas al planificador (barato y ayuda a elegir bien el indice).
ANALYZE;

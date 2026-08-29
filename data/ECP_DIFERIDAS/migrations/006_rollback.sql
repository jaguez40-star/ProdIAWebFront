-- 006_rollback.sql -- elimina los indices creados por 006.
BEGIN;
DROP INDEX IF EXISTS ix_hom_campo;
DROP INDEX IF EXISTS ix_vpu_n4;
DROP INDEX IF EXISTS ix_dd_event;
DROP INDEX IF EXISTS ix_dd_cover;
COMMIT;

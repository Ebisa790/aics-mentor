BEGIN;

-- Running upgrade eb01_exam_blueprint -> eb02_blueprint_details

ALTER TABLE exam_blueprint_items ADD COLUMN general_objective TEXT;

ALTER TABLE exam_blueprint_items ADD COLUMN learning_outcomes JSON;

UPDATE alembic_version SET version_num='eb02_blueprint_details' WHERE alembic_version.version_num = 'eb01_exam_blueprint';

COMMIT;


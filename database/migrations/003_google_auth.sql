USE carwash_queue;

ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL;

SET @google_id_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'google_id'
);

SET @add_google_id_sql := IF(
  @google_id_exists = 0,
  'ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL AFTER password_hash',
  'SELECT 1'
);

PREPARE add_google_id FROM @add_google_id_sql;
EXECUTE add_google_id;
DEALLOCATE PREPARE add_google_id;

SET @google_id_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'uq_users_google_id'
);

SET @add_google_id_index_sql := IF(
  @google_id_index_exists = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_users_google_id (google_id)',
  'SELECT 1'
);

PREPARE add_google_id_index FROM @add_google_id_index_sql;
EXECUTE add_google_id_index;
DEALLOCATE PREPARE add_google_id_index;

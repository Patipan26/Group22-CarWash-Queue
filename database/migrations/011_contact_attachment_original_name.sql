SET @attachment_original_name_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'contacts'
    AND column_name = 'attachment_original_name'
);

SET @attachment_original_name_migration = IF(
  @attachment_original_name_column_exists = 0,
  'ALTER TABLE contacts ADD COLUMN attachment_original_name VARCHAR(255) NULL AFTER attachment_path',
  'SELECT 1'
);

PREPARE attachment_original_name_statement FROM @attachment_original_name_migration;
EXECUTE attachment_original_name_statement;
DEALLOCATE PREPARE attachment_original_name_statement;

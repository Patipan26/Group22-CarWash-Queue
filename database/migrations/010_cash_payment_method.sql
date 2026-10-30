SET @payment_method_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bookings'
    AND column_name = 'payment_method'
);

SET @payment_method_migration = IF(
  @payment_method_column_exists = 0,
  "ALTER TABLE bookings ADD COLUMN payment_method ENUM('promptpay', 'cash') NOT NULL DEFAULT 'promptpay' AFTER payment_status",
  'SELECT 1'
);

PREPARE payment_method_statement FROM @payment_method_migration;
EXECUTE payment_method_statement;
DEALLOCATE PREPARE payment_method_statement;

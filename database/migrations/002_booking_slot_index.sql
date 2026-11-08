USE carwash_queue;

SET @slot_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'bookings'
    AND index_name = 'idx_bookings_slot_status'
);

SET @create_slot_index_sql := IF(
  @slot_index_exists = 0,
  'CREATE INDEX idx_bookings_slot_status ON bookings (booking_date, booking_time, status)',
  'SELECT 1'
);

PREPARE create_slot_index FROM @create_slot_index_sql;
EXECUTE create_slot_index;
DEALLOCATE PREPARE create_slot_index;

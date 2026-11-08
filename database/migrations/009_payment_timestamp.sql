USE carwash_queue;

ALTER TABLE bookings
  ADD COLUMN paid_at TIMESTAMP NULL DEFAULT NULL AFTER payment_status;

-- Existing verified payments use updated_at as the best available historical timestamp.
UPDATE bookings
SET paid_at = updated_at
WHERE payment_status = 'verified' AND paid_at IS NULL;

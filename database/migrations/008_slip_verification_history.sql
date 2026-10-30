USE carwash_queue;

ALTER TABLE bookings
  ADD COLUMN slip2go_reference_id VARCHAR(120) NULL AFTER transaction_ref;

CREATE TABLE slip_verifications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'slip2go',
  reference_id VARCHAR(120) NULL,
  transaction_ref VARCHAR(120) NULL,
  result_code VARCHAR(30) NULL,
  result_message VARCHAR(500) NULL,
  status ENUM('verified', 'rejected', 'error') NOT NULL,
  amount DECIMAL(10, 2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_slip_verifications_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_slip_verifications_booking_date (booking_id, created_at)
);

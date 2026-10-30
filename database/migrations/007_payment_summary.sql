USE carwash_queue;

ALTER TABLE bookings
  ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER total_price,
  ADD COLUMN vat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER discount_amount,
  ADD COLUMN amount_due DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER vat_amount,
  ADD COLUMN promo_code VARCHAR(30) NULL AFTER amount_due;

UPDATE bookings SET amount_due = total_price WHERE amount_due = 0;

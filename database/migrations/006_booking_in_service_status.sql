USE carwash_queue;

ALTER TABLE bookings
  MODIFY status ENUM('pending', 'confirmed', 'in_service', 'completed', 'cancelled') NOT NULL DEFAULT 'pending';

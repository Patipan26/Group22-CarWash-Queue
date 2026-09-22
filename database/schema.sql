SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS carwash_queue
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE carwash_queue;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(255) NULL,
  name VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  UNIQUE KEY uq_users_google_id (google_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 60,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addons (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  booking_code VARCHAR(30) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  booking_date DATE NOT NULL,
  booking_time VARCHAR(30) NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  car_model VARCHAR(120) NOT NULL,
  car_plate VARCHAR(60) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_status ENUM('unpaid', 'pending_review', 'verified', 'rejected') NOT NULL DEFAULT 'unpaid',
  slip_path VARCHAR(500) NULL,
  transaction_ref VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_bookings_user_date (user_id, booking_date),
  INDEX idx_bookings_status (status, booking_date),
  INDEX idx_bookings_slot_status (booking_date, booking_time, status)
);

CREATE TABLE IF NOT EXISTS booking_addons (
  booking_id BIGINT UNSIGNED NOT NULL,
  addon_id BIGINT UNSIGNED NOT NULL,
  price_at_booking DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (booking_id, addon_id),
  CONSTRAINT fk_booking_addons_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_addons_addon FOREIGN KEY (addon_id) REFERENCES addons(id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  sender_name VARCHAR(120) NOT NULL,
  sender_contact VARCHAR(255) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  attachment_path VARCHAR(500) NULL,
  status ENUM('unread', 'read', 'archived') NOT NULL DEFAULT 'unread',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_contacts_status (status, created_at)
);

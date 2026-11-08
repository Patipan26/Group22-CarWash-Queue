SET NAMES utf8mb4;

USE carwash_queue;

INSERT INTO services (name, description, price, duration_minutes)
VALUES
  ('Standard Wash', 'ล้างรถ ฉีดซุ้มล้อ เช็ดแห้ง', 250, 45),
  ('Premium Wash', 'ล้างห้องเครื่องและเคลือบแว็กซ์พรีเมียม', 450, 90),
  ('Full Detailing', 'ขัดสีลบรอย ลงแว็กซ์ ฟอกเบาะและพรม', 1200, 120)
ON DUPLICATE KEY UPDATE
  description = VALUES(description), price = VALUES(price), duration_minutes = VALUES(duration_minutes);

INSERT INTO addons (name, description, price)
VALUES
  ('เคลือบแก้วเซรามิก', 'ปกป้องสีรถให้เงางามและทนทาน', 2500),
  ('ขัดโคมไฟหน้า', 'ฟื้นฟูโคมไฟหน้าให้กลับมาใส', 400),
  ('อบโอโซนฆ่าเชื้อ', 'ขจัดแบคทีเรีย เชื้อรา และกลิ่นอับ', 300),
  ('ล้างห้องเครื่อง', 'ทำความสะอาดคราบน้ำมันและฝุ่นสะสม', 350)
ON DUPLICATE KEY UPDATE
  description = VALUES(description), price = VALUES(price);

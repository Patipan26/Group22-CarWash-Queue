const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      `SELECT id, email, name, phone, loyalty_points AS loyaltyPoints
       FROM users WHERE id = ?`, [req.user.id]
    );
    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS bookingCount,
              SUM(status = 'completed') AS completedCount,
              COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(NULLIF(amount_due, 0), total_price) ELSE 0 END), 0) AS totalSpent
       FROM bookings WHERE user_id = ?`, [req.user.id]
    );
    const [cars] = await pool.query(
      `SELECT carModel, carPlate, MAX(lastUsedAt) AS lastUsedAt
       FROM (
         SELECT car_model AS carModel, car_plate AS carPlate, MAX(booking_date) AS lastUsedAt
         FROM bookings WHERE user_id = ? GROUP BY car_model, car_plate
         UNION ALL
         SELECT car_model AS carModel, car_plate AS carPlate, NULL AS lastUsedAt
         FROM customer_cars WHERE user_id = ?
       ) AS all_cars
       GROUP BY carModel, carPlate ORDER BY lastUsedAt DESC, carModel ASC`, [req.user.id, req.user.id]
    );
    const [recentBookings] = await pool.query(
      `SELECT b.id, b.booking_code AS bookingCode, b.booking_date AS bookingDate,
              b.booking_time AS bookingTime, b.car_model AS carModel,
              COALESCE(NULLIF(b.amount_due, 0), b.total_price) AS totalPrice,
              b.status, s.name AS service
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 4`, [req.user.id]
    );
    res.json({ user, stats: {
      bookingCount: Number(stats.bookingCount || 0),
      completedCount: Number(stats.completedCount || 0),
      totalSpent: Number(stats.totalSpent || 0)
    }, cars, recentBookings });
  } catch (error) { next(error); }
});

router.patch('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (!name || name.length > 120) return res.status(400).json({ message: 'กรุณากรอกชื่อไม่เกิน 120 ตัวอักษร' });
    if (phone.length > 30) return res.status(400).json({ message: 'เบอร์โทรศัพท์ยาวเกินไป' });
    await pool.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, req.user.id]);
    res.json({ user: { id: req.user.id, name, phone: phone || null } });
  } catch (error) { next(error); }
});

router.post('/password', async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 6) return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    const [[user]] = await pool.query('SELECT password_hash AS passwordHash FROM users WHERE id = ?', [req.user.id]);
    if (user.passwordHash && !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    res.json({ message: 'เปลี่ยนรหัสผ่านแล้ว' });
  } catch (error) { next(error); }
});

router.post('/cars', async (req, res, next) => {
  try {
    const carModel = String(req.body.carModel || '').trim();
    const carPlate = String(req.body.carPlate || '').trim().toUpperCase();
    if (!carModel || !carPlate || carModel.length > 120 || carPlate.length > 60) {
      return res.status(400).json({ message: 'กรุณากรอกรุ่นรถและทะเบียนรถให้ถูกต้อง' });
    }
    const [result] = await pool.query(
      'INSERT INTO customer_cars (user_id, car_model, car_plate) VALUES (?, ?, ?)',
      [req.user.id, carModel, carPlate]
    );
    res.status(201).json({ car: { id: result.insertId, carModel, carPlate } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'ทะเบียนรถนี้อยู่ในรายการแล้ว' });
    next(error);
  }
});

router.delete('/cars/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM customer_cars WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'ลบรถออกจากรายการแล้ว' });
  } catch (error) { next(error); }
});

module.exports = router;

const express = require('express');
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendPrivateUpload } = require('../middleware/privateUpload');

const router = express.Router();
router.use(authenticate, requireAdmin);

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

router.get('/revenue', async (req, res, next) => {
  try {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
      return res.status(400).json({ message: 'กรุณาระบุช่วงวันที่ให้ถูกต้อง' });
    }
    const dateExpr = 'DATE(DATE_ADD(b.paid_at, INTERVAL 7 HOUR))';
    const period = `${dateExpr} BETWEEN ? AND ?`;
    const [[summary]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN COALESCE(NULLIF(b.amount_due, 0), b.total_price) ELSE 0 END), 0) AS totalRevenue,
         COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN b.total_price - b.discount_amount ELSE 0 END), 0) AS beforeVat,
         COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN b.vat_amount ELSE 0 END), 0) AS vatTotal,
         COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN 1 ELSE 0 END), 0) AS paidCount,
         COALESCE(SUM(CASE WHEN b.status = 'cancelled' THEN COALESCE(NULLIF(b.amount_due, 0), b.total_price) ELSE 0 END), 0) AS cancelledPaidAmount,
         COALESCE(SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledPaidCount
       FROM bookings b WHERE b.payment_status = 'verified' AND b.paid_at IS NOT NULL AND ${period}`,
      [from, to]
    );
    const [daily] = await pool.query(
      `SELECT ${dateExpr} AS date,
              COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN COALESCE(NULLIF(b.amount_due, 0), b.total_price) ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN 1 ELSE 0 END), 0) AS paidCount,
              COALESCE(SUM(CASE WHEN b.status = 'cancelled' THEN COALESCE(NULLIF(b.amount_due, 0), b.total_price) ELSE 0 END), 0) AS cancelledPaidAmount
       FROM bookings b WHERE b.payment_status = 'verified' AND b.paid_at IS NOT NULL AND ${period}
       GROUP BY ${dateExpr} ORDER BY date DESC`,
      [from, to]
    );
    const [services] = await pool.query(
      `SELECT s.name AS service,
              COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN COALESCE(NULLIF(b.amount_due, 0), b.total_price) ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN 1 ELSE 0 END), 0) AS paidCount
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.payment_status = 'verified' AND b.paid_at IS NOT NULL AND ${period}
       GROUP BY s.id, s.name ORDER BY revenue DESC, s.name`,
      [from, to]
    );
    const [payments] = await pool.query(
      `SELECT b.booking_code AS bookingCode, b.customer_name AS customerName,
              ${dateExpr} AS paidDate, b.paid_at AS paidAt, s.name AS service,
              COALESCE(NULLIF(b.amount_due, 0), b.total_price) AS amount,
              b.total_price AS subtotal, b.discount_amount AS discountAmount,
              b.vat_amount AS vatAmount, b.status AS bookingStatus
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.payment_status = 'verified' AND b.paid_at IS NOT NULL AND ${period}
       ORDER BY b.paid_at DESC, b.id DESC LIMIT 200`,
      [from, to]
    );
    res.json({ from, to, summary, daily, services, payments });
  } catch (error) { next(error); }
});

function validateCatalogItem(body, type) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const price = Number(body.price);
  const durationMinutes = type === 'service' ? Number(body.durationMinutes) : undefined;
  if (!name || name.length > 120) return { error: 'กรุณาระบุชื่อไม่เกิน 120 ตัวอักษร' };
  if (description.length > 500) return { error: 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร' };
  if (!Number.isFinite(price) || price < 0 || price > 99999999.99) return { error: 'กรุณาระบุราคาให้ถูกต้อง' };
  if (type === 'service' && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)) {
    return { error: 'ระยะเวลาต้องอยู่ระหว่าง 1 ถึง 1,440 นาที' };
  }
  if (typeof body.active !== 'boolean') return { error: 'สถานะเปิดให้จองไม่ถูกต้อง' };
  return { value: { name, description, price, durationMinutes, active: body.active } };
}

function handleDuplicateCatalogName(error, res) {
  if (error.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ message: 'มีบริการชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น' });
    return true;
  }
  return false;
}

router.get('/catalog', async (_req, res, next) => {
  try {
    const [services] = await pool.query(
      'SELECT id, name, description, price, duration_minutes AS durationMinutes, active FROM services ORDER BY id'
    );
    const [addons] = await pool.query(
      'SELECT id, name, description, price, active FROM addons ORDER BY id'
    );
    res.json({ services, addons });
  } catch (error) { next(error); }
});

router.post('/services', async (req, res, next) => {
  const validated = validateCatalogItem(req.body, 'service');
  if (validated.error) return res.status(400).json({ message: validated.error });
  try {
    const item = validated.value;
    const [result] = await pool.query(
      'INSERT INTO services (name, description, price, duration_minutes, active) VALUES (?, ?, ?, ?, ?)',
      [item.name, item.description, item.price, item.durationMinutes, item.active]
    );
    res.status(201).json({ id: result.insertId, message: 'เพิ่มบริการแล้ว' });
  } catch (error) {
    if (!handleDuplicateCatalogName(error, res)) next(error);
  }
});

router.patch('/services/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'รหัสบริการไม่ถูกต้อง' });
  const validated = validateCatalogItem(req.body, 'service');
  if (validated.error) return res.status(400).json({ message: validated.error });
  try {
    const item = validated.value;
    const [result] = await pool.query(
      'UPDATE services SET name = ?, description = ?, price = ?, duration_minutes = ?, active = ? WHERE id = ?',
      [item.name, item.description, item.price, item.durationMinutes, item.active, id]
    );
    if (!result.affectedRows) {
      const [existing] = await pool.query('SELECT id FROM services WHERE id = ? LIMIT 1', [id]);
      if (!existing.length) return res.status(404).json({ message: 'ไม่พบบริการนี้' });
    }
    res.json({ message: 'บันทึกบริการแล้ว' });
  } catch (error) {
    if (!handleDuplicateCatalogName(error, res)) next(error);
  }
});

router.post('/addons', async (req, res, next) => {
  const validated = validateCatalogItem(req.body, 'addon');
  if (validated.error) return res.status(400).json({ message: validated.error });
  try {
    const item = validated.value;
    const [result] = await pool.query(
      'INSERT INTO addons (name, description, price, active) VALUES (?, ?, ?, ?)',
      [item.name, item.description, item.price, item.active]
    );
    res.status(201).json({ id: result.insertId, message: 'เพิ่มบริการเสริมแล้ว' });
  } catch (error) {
    if (!handleDuplicateCatalogName(error, res)) next(error);
  }
});

router.patch('/addons/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'รหัสบริการเสริมไม่ถูกต้อง' });
  const validated = validateCatalogItem(req.body, 'addon');
  if (validated.error) return res.status(400).json({ message: validated.error });
  try {
    const item = validated.value;
    const [result] = await pool.query(
      'UPDATE addons SET name = ?, description = ?, price = ?, active = ? WHERE id = ?',
      [item.name, item.description, item.price, item.active, id]
    );
    if (!result.affectedRows) {
      const [existing] = await pool.query('SELECT id FROM addons WHERE id = ? LIMIT 1', [id]);
      if (!existing.length) return res.status(404).json({ message: 'ไม่พบบริการเสริมนี้' });
    }
    res.json({ message: 'บันทึกบริการเสริมแล้ว' });
  } catch (error) {
    if (!handleDuplicateCatalogName(error, res)) next(error);
  }
});

router.get('/bookings', async (_req, res, next) => {
  try {
    const [bookings] = await pool.query(
      `SELECT b.id, b.booking_code AS bookingCode, b.booking_date AS bookingDate, b.booking_time AS bookingTime,
              b.customer_name AS customerName, b.customer_phone AS customerPhone, b.car_model AS carModel,
              b.car_plate AS carPlate, COALESCE(NULLIF(b.amount_due, 0), b.total_price) AS totalPrice,
              b.total_price AS subtotal, b.discount_amount AS discountAmount, b.vat_amount AS vatAmount,
              b.status, b.payment_status AS paymentStatus,
              b.payment_method AS paymentMethod,
              b.slip_path AS slipPath, b.transaction_ref AS transactionRef,
              b.slip2go_reference_id AS slip2goReferenceId,
              (SELECT COUNT(*) FROM slip_verifications sv WHERE sv.booking_id = b.id) AS slipVerificationCount,
              u.email, s.name AS service
       FROM bookings b JOIN users u ON u.id = b.user_id JOIN services s ON s.id = b.service_id
       ORDER BY b.booking_date DESC, b.booking_time DESC, b.created_at DESC`
    );
    for (const booking of bookings) {
      const [addons] = await pool.query(
        `SELECT a.name, ba.price_at_booking AS price FROM booking_addons ba
         JOIN addons a ON a.id = ba.addon_id WHERE ba.booking_id = ?`,
        [booking.id]
      );
      booking.addons = addons;
    }
    res.json({ bookings });
  } catch (error) { next(error); }
});

router.get('/bookings/:id/slip', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT slip_path AS slipPath FROM bookings WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length || !rows[0].slipPath) return res.status(404).json({ message: 'ไม่พบสลิปของรายการนี้' });
    return sendPrivateUpload(res, rows[0].slipPath);
  } catch (error) { next(error); }
});

router.get('/bookings/:id/slip-verifications', async (req, res, next) => {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
      return res.status(400).json({ message: 'รหัสการจองไม่ถูกต้อง' });
    }
    const [verifications] = await pool.query(
      `SELECT id, provider, reference_id AS referenceId, transaction_ref AS transactionRef,
              result_code AS resultCode, result_message AS resultMessage, status, amount,
              created_at AS createdAt
       FROM slip_verifications WHERE booking_id = ? ORDER BY created_at DESC, id DESC`,
      [bookingId]
    );
    res.json({ verifications });
  } catch (error) { next(error); }
});

router.get('/customers', async (_req, res, next) => {
  try {
    const [customers] = await pool.query(
      `SELECT u.id,
              COALESCE(NULLIF(u.name, ''), (SELECT b_name.customer_name FROM bookings b_name
                WHERE b_name.user_id = u.id ORDER BY b_name.created_at DESC LIMIT 1)) AS name,
              u.email,
              COALESCE(NULLIF(u.phone, ''), (SELECT b_phone.customer_phone FROM bookings b_phone
                WHERE b_phone.user_id = u.id ORDER BY b_phone.created_at DESC LIMIT 1)) AS phone,
              u.loyalty_points AS loyaltyPoints,
              u.created_at AS createdAt, COUNT(b.id) AS bookingCount,
              COALESCE(SUM(b.status = 'completed'), 0) AS completedCount,
              COALESCE(SUM(CASE WHEN b.status = 'completed'
                THEN COALESCE(NULLIF(b.amount_due, 0), b.total_price) ELSE 0 END), 0) AS totalSpent
       FROM users u LEFT JOIN bookings b ON b.user_id = u.id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ customers });
  } catch (error) { next(error); }
});

router.get('/customers/:id', async (req, res, next) => {
  try {
    const customerId = Number(req.params.id);
    if (!Number.isSafeInteger(customerId) || customerId < 1) return res.status(400).json({ message: 'รหัสลูกค้าไม่ถูกต้อง' });
    const [customers] = await pool.query(
      `SELECT u.id,
              COALESCE(NULLIF(u.name, ''), (SELECT b_name.customer_name FROM bookings b_name
                WHERE b_name.user_id = u.id ORDER BY b_name.created_at DESC LIMIT 1)) AS name,
              u.email,
              COALESCE(NULLIF(u.phone, ''), (SELECT b_phone.customer_phone FROM bookings b_phone
                WHERE b_phone.user_id = u.id ORDER BY b_phone.created_at DESC LIMIT 1)) AS phone,
              u.loyalty_points AS loyaltyPoints, u.created_at AS createdAt
       FROM users u WHERE u.id = ? AND u.role = 'customer' LIMIT 1`,
      [customerId]
    );
    if (!customers.length) return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
    const [bookings] = await pool.query(
      `SELECT b.id, b.booking_code AS bookingCode, b.booking_date AS bookingDate,
              b.booking_time AS bookingTime, b.car_model AS carModel, b.car_plate AS carPlate,
              COALESCE(NULLIF(b.amount_due, 0), b.total_price) AS totalPrice,
              b.points_awarded AS pointsAwarded, b.status, b.payment_status AS paymentStatus,
              s.name AS service
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC, b.booking_time DESC, b.created_at DESC`,
      [customerId]
    );
    res.json({ customer: customers[0], bookings });
  } catch (error) { next(error); }
});

router.patch('/bookings/:id/payment', async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  try {
    const paymentStatus = req.body.paymentStatus;
    if (!['verified', 'rejected'].includes(paymentStatus)) {
      return res.status(400).json({ message: 'สถานะการชำระเงินไม่ถูกต้อง' });
    }
    const bookingId = Number(req.params.id);
    if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
      return res.status(400).json({ message: 'รหัสการจองไม่ถูกต้อง' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      `SELECT id, user_id AS userId, status AS bookingStatus, total_price AS subtotal,
              payment_status AS paymentStatus,
              payment_method AS paymentMethod, discount_amount AS discountAmount,
              slip_path AS slipPath
       FROM bookings WHERE id = ? FOR UPDATE`,
      [bookingId]
    );
    if (!rows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'ไม่พบรายการจอง' });
    }
    const booking = rows[0];
    const isCashPayment = booking.paymentMethod === 'cash';
    if (booking.paymentStatus !== 'pending_review' || (isCashPayment ? Boolean(booking.slipPath) : !booking.slipPath)) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'รายการนี้ไม่มีการชำระเงินที่รอยืนยันแล้ว' });
    }
    if (paymentStatus === 'rejected' && isCashPayment) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ message: 'รายการเงินสดใช้การปฏิเสธสลิปไม่ได้' });
    }
    if (paymentStatus === 'verified' && booking.bookingStatus === 'cancelled') {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'รายการจองถูกยกเลิกแล้ว จึงอนุมัติการชำระเงินไม่ได้' });
    }

    if (paymentStatus === 'verified') {
      const discount = isCashPayment ? Number(booking.discountAmount || 0) : 0;
      const vat = Math.round((Number(booking.subtotal) - discount) * 0.07 * 100) / 100;
      const amountDue = Math.round((Number(booking.subtotal) - discount + vat) * 100) / 100;
      if (isCashPayment) {
        await connection.query(
          `UPDATE bookings SET payment_status = 'verified', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                               vat_amount = ?, amount_due = ?
           WHERE id = ?`,
          [vat, amountDue, booking.id]
        );
      } else {
        await connection.query(
          `UPDATE bookings SET payment_status = 'verified', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), discount_amount = 0,
                               vat_amount = ?, amount_due = ?, promo_code = NULL
           WHERE id = ?`,
          [vat, amountDue, booking.id]
        );
      }
    } else {
      await connection.query('UPDATE bookings SET payment_status = ? WHERE id = ?', [paymentStatus, booking.id]);
    }

    const title = paymentStatus === 'verified'
      ? (isCashPayment ? 'ยืนยันรับเงินสดแล้ว' : 'ยืนยันการชำระเงินแล้ว')
      : 'สลิปไม่ผ่านการตรวจสอบ';
    const message = paymentStatus === 'verified'
      ? (isCashPayment ? 'เจ้าหน้าที่ยืนยันว่าได้รับชำระเงินสดของคุณแล้ว' : 'เจ้าหน้าที่ตรวจสอบและยืนยันการชำระเงินของคุณแล้ว')
      : 'สลิปการชำระเงินไม่ผ่าน กรุณาเปิดรายการจองและส่งสลิปใหม่';
    await connection.query(
      `INSERT INTO notifications (user_id, booking_id, title, message, type)
       VALUES (?, ?, ?, ?, 'booking_status')`,
      [booking.userId, booking.id, title, message]
    );
    await connection.commit();
    transactionStarted = false;
    res.json({ message: paymentStatus === 'verified' ? 'อนุมัติการชำระเงินแล้ว' : 'ปฏิเสธสลิปแล้ว' });
  } catch (error) {
    if (transactionStarted && connection) await connection.rollback().catch(() => undefined);
    next(error);
  } finally {
    if (connection) connection.release();
  }
});

router.patch('/bookings/:id/status', async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  try {
    const allowed = ['pending', 'confirmed', 'in_service', 'completed', 'cancelled'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      `SELECT id, user_id, status, payment_status AS paymentStatus,
              total_price, points_awarded AS pointsAwarded
       FROM bookings WHERE id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'ไม่พบรายการจอง' });
    }
    const booking = rows[0];
    if (['confirmed', 'in_service', 'completed'].includes(req.body.status) && booking.paymentStatus !== 'verified') {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'กรุณายืนยันการชำระเงินก่อนเปลี่ยนสถานะงาน' });
    }
    let awardedPoints = 0;
    if (req.body.status === 'completed' && booking.status !== 'completed' && Number(booking.pointsAwarded) === 0) {
      awardedPoints = Math.floor(Number(booking.total_price) / 25);
      if (awardedPoints > 0) {
        await connection.query('UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?', [awardedPoints, booking.user_id]);
      }
      await connection.query('UPDATE bookings SET status = ?, points_awarded = ? WHERE id = ?', [req.body.status, awardedPoints, booking.id]);
    } else {
      await connection.query('UPDATE bookings SET status = ? WHERE id = ?', [req.body.status, booking.id]);
    }
    const statusMessages = {
      pending: 'รอยืนยันการจอง',
      confirmed: 'รับรถเข้าคิวแล้ว',
      in_service: 'กำลังให้บริการ',
      completed: 'พร้อมรับรถแล้ว',
      cancelled: 'ยกเลิกการจอง'
    };
    if (booking.status !== req.body.status) {
      await connection.query(
        `INSERT INTO notifications (user_id, booking_id, title, message, type)
         VALUES (?, ?, ?, ?, 'booking_status')`,
        [booking.user_id, booking.id, statusMessages[req.body.status], `สถานะการจองของคุณเปลี่ยนเป็น “${statusMessages[req.body.status]}”`]
      );
    }
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'อัปเดตสถานะแล้ว', awardedPoints });
  } catch (error) {
    if (transactionStarted && connection) await connection.rollback().catch(() => undefined);
    next(error);
  } finally {
    if (connection) connection.release();
  }
});

router.get('/contacts', async (_req, res, next) => {
  try {
    const [contacts] = await pool.query(
      `SELECT id, sender_name AS senderName, sender_contact AS senderContact, subject, message,
              attachment_path AS attachmentPath, status, created_at AS createdAt
       FROM contacts ORDER BY created_at DESC`
    );
    res.json({ contacts });
  } catch (error) { next(error); }
});

router.get('/contacts/:id/attachment', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT attachment_path AS attachmentPath FROM contacts WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length || !rows[0].attachmentPath) return res.status(404).json({ message: 'ไม่พบไฟล์แนบ' });
    return sendPrivateUpload(res, rows[0].attachmentPath);
  } catch (error) { next(error); }
});

router.patch('/contacts/:id/status', async (req, res, next) => {
  try {
    const allowed = ['unread', 'read', 'archived'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
    await pool.query('UPDATE contacts SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ message: 'อัปเดตข้อความแล้ว' });
  } catch (error) { next(error); }
});

router.delete('/contacts/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM contacts WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบข้อความแล้ว' });
  } catch (error) { next(error); }
});

module.exports = router;

const express = require('express');
const fs = require('fs/promises');
const pool = require('../db');
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');
const { sendPrivateUpload } = require('../middleware/privateUpload');

const router = express.Router();

const TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00'
];

function getSlotCapacity() {
  const configured = Number.parseInt(process.env.BOOKING_SLOT_CAPACITY || '1', 10);
  return Number.isInteger(configured) && configured > 0 ? configured : 1;
}

function makeBookingCode() {
  return `CW${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}

function parseAddonIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Number.isInteger);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function getBangkokToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isSunday(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function removeUploadedFile(file) {
  return file?.path ? fs.unlink(file.path).catch(() => undefined) : Promise.resolve();
}

async function verifySlipWithSlip2Go(file, amountDue) {
  const secret = process.env.SLIP2GO_SECRET;
  const accountType = process.env.SLIP2GO_RECEIVER_ACCOUNT_TYPE || '02001';
  const receiverAccount = String(process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER || process.env.PROMPTPAY_NUMBER || '').replace(/\D/g, '');
  if (!secret || !receiverAccount) {
    const error = new Error('ระบบตรวจสอบสลิปยังตั้งค่าไม่ครบ กรุณาติดต่อร้านค้า');
    error.status = 503;
    throw error;
  }

  const payload = {
    checkDuplicate: true,
    checkReceiver: [{ accountType, accountNumber: receiverAccount }],
    checkAmount: { type: 'eq', amount: amountDue.toFixed(2) }
  };
  const body = new FormData();
  body.append('file', new Blob([await fs.readFile(file.path)], { type: file.mimetype }), file.originalname);
  body.append('payload', JSON.stringify(payload));

  let response;
  try {
    response = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      body,
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    const error = new Error('ติดต่อระบบตรวจสอบสลิปไม่ได้ กรุณาลองใหม่อีกครั้ง');
    error.status = 503;
    throw error;
  }

  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error('ระบบตรวจสอบสลิปตอบกลับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    error.status = 503;
    throw error;
  }

  if (!response.ok || !['200000', '200200'].includes(String(result.code))) {
    const code = String(result.code);
    const codes = {
      '400001': 'ไม่พบ QR Code ในรูป กรุณาแนบรูปสลิปที่ชัดเจน',
      '400002': 'ไฟล์สลิปไม่ถูกต้อง กรุณาเลือกไฟล์รูปภาพใหม่',
      '200401': 'บัญชีผู้รับในสลิปไม่ตรงกับบัญชีร้าน',
      '200402': 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
      '200403': 'วันที่โอนในสลิปไม่ตรงกับเงื่อนไข',
      '200404': 'ไม่พบรายการโอนจาก QR Code ในสลิป',
      '200500': 'สลิปนี้ไม่ถูกต้องหรืออาจเป็นสลิปปลอม',
      '200501': 'สลิปนี้ถูกใช้ไปแล้ว กรุณาแนบสลิปการโอนรายการใหม่'
    };
    const rejectedCodes = new Set(Object.keys(codes));
    const error = new Error(codes[code] || (rejectedCodes.has(code)
      ? 'ตรวจสอบสลิปไม่ผ่าน กรุณาแนบสลิปที่ถูกต้อง'
      : 'ระบบตรวจสอบสลิปขัดข้อง กรุณาลองใหม่อีกครั้ง'));
    error.status = rejectedCodes.has(code) ? 422 : 503;
    error.rejectedSlip = rejectedCodes.has(code);
    error.providerResult = result;
    throw error;
  }

  const paidAmount = Number(result.data?.amount);
  if (!Number.isFinite(paidAmount) || Math.round(paidAmount * 100) !== Math.round(amountDue * 100) || !result.data?.transRef) {
    const error = new Error('ยอดเงินหรือข้อมูลอ้างอิงในสลิปไม่ถูกต้อง กรุณาตรวจสอบแล้วแนบใหม่');
    error.status = 422;
    error.rejectedSlip = true;
    error.providerResult = result;
    throw error;
  }
  return result;
}

async function saveSlipVerification(bookingId, { result, error }) {
  const data = result?.data || error?.providerResult?.data || {};
  const providerResult = result || error?.providerResult || {};
  const status = !error ? 'verified' : error.rejectedSlip ? 'rejected' : 'error';
  const amount = Number(data.amount);
  await pool.query(
    `INSERT INTO slip_verifications
       (booking_id, provider, reference_id, transaction_ref, result_code, result_message, status, amount)
     VALUES (?, 'slip2go', ?, ?, ?, ?, ?, ?)`,
    [
      bookingId,
      data.referenceId || null,
      data.transRef || null,
      providerResult.code || null,
      String(providerResult.message || error?.message || '').slice(0, 500) || null,
      status,
      Number.isFinite(amount) ? amount : null
    ]
  );
}

function validateBookingDateAndTime(bookingDate, bookingTime) {
  if (!isValidDate(bookingDate)) return 'รูปแบบวันที่ไม่ถูกต้อง';
  if (isSunday(bookingDate)) return 'ร้านปิดทุกวันอาทิตย์ กรุณาเลือกวันจันทร์–เสาร์';
  if (bookingDate < getBangkokToday()) return 'ไม่สามารถจองวันที่ผ่านมาแล้วได้';
  if (!TIME_SLOTS.includes(bookingTime)) return 'ช่วงเวลาที่เลือกไม่ถูกต้อง';
  return null;
}

function isBookingStartInFuture(bookingDate, bookingTime) {
  const dateText = bookingDate instanceof Date ? bookingDate.toISOString().slice(0, 10) : String(bookingDate).slice(0, 10);
  const startTime = String(bookingTime).split(' - ')[0];
  const start = new Date(`${dateText}T${startTime}:00+07:00`);
  return Number.isFinite(start.getTime()) && start.getTime() > Date.now();
}

async function getAvailability(date) {
  const capacity = getSlotCapacity();
  const [rows] = await pool.query(
    `SELECT booking_time AS bookingTime, COUNT(*) AS bookedCount
     FROM bookings
     WHERE booking_date = ? AND status <> 'cancelled'
     GROUP BY booking_time`,
    [date]
  );
  const counts = new Map(rows.map((row) => [row.bookingTime, Number(row.bookedCount)]));
  return {
    date,
    capacity,
    slots: TIME_SLOTS.map((time) => {
      const bookedCount = counts.get(time) || 0;
      return {
        time,
        bookedCount,
        remaining: Math.max(capacity - bookedCount, 0),
        available: bookedCount < capacity
      };
    })
  };
}

router.get('/availability', async (req, res, next) => {
  try {
    const date = String(req.query.date || '');
    if (!isValidDate(date)) return res.status(400).json({ message: 'รูปแบบวันที่ไม่ถูกต้อง' });
    if (isSunday(date)) return res.status(400).json({ message: 'ร้านปิดทุกวันอาทิตย์ กรุณาเลือกวันจันทร์–เสาร์' });
    if (date < getBangkokToday()) return res.status(400).json({ message: 'ไม่สามารถตรวจสอบคิวของวันที่ผ่านมาแล้วได้' });
    res.json(await getAvailability(date));
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, upload.single('slip'), async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  let lockAcquired = false;
  let slotLockName;

  try {
    const {
      serviceId,
      bookingDate,
      bookingTime,
      customerName,
      customerPhone,
      carModel,
      carPlate
    } = req.body;

    if (!serviceId || !bookingDate || !bookingTime || !customerName || !customerPhone || !carModel || !carPlate) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลการจองให้ครบถ้วน' });
    }

    const normalizedDate = String(bookingDate).trim();
    const normalizedTime = String(bookingTime).trim();
    const dateTimeError = validateBookingDateAndTime(normalizedDate, normalizedTime);
    if (dateTimeError) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: dateTimeError });
    }

    const serviceIdNumber = Number(serviceId);
    if (!Number.isInteger(serviceIdNumber) || serviceIdNumber <= 0) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: 'บริการที่เลือกไม่ถูกต้อง' });
    }

    const addonIds = [...new Set(parseAddonIds(req.body.addonIds))];
    connection = await pool.getConnection();

    // ล็อกช่วงเวลาชั่วคราว เพื่อไม่ให้คำขอสองรายการตรวจที่ว่างสุดท้ายพร้อมกัน
    slotLockName = `carwash-slot:${normalizedDate}:${normalizedTime}`;
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', [slotLockName]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) {
      await removeUploadedFile(req.file);
      return res.status(409).json({ message: 'มีผู้ใช้อื่นกำลังจองช่วงเวลานี้ กรุณาลองใหม่อีกครั้ง' });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const capacity = getSlotCapacity();
    const [slotRows] = await connection.query(
      `SELECT COUNT(*) AS bookedCount
       FROM bookings
       WHERE booking_date = ? AND booking_time = ? AND status <> 'cancelled'`,
      [normalizedDate, normalizedTime]
    );
    const bookedCount = Number(slotRows[0]?.bookedCount || 0);
    if (bookedCount >= capacity) {
      await connection.rollback();
      transactionStarted = false;
      await removeUploadedFile(req.file);
      return res.status(409).json({
        message: `ช่วงเวลา ${normalizedTime} เต็มแล้ว กรุณาเลือกช่วงเวลาอื่น`,
        code: 'SLOT_FULL',
        capacity,
        bookedCount
      });
    }

    const [serviceRows] = await connection.query(
      'SELECT id, price FROM services WHERE id = ? AND active = TRUE',
      [serviceIdNumber]
    );
    if (!serviceRows.length) {
      await connection.rollback();
      transactionStarted = false;
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: 'ไม่พบบริการที่เลือก' });
    }

    let totalPrice = Number(serviceRows[0].price);
    let addonRows = [];
    if (addonIds.length) {
      const [rows] = await connection.query(
        `SELECT id, price FROM addons
         WHERE active = TRUE AND id IN (${addonIds.map(() => '?').join(',')})`,
        addonIds
      );
      if (rows.length !== addonIds.length) {
        await connection.rollback();
        transactionStarted = false;
        await removeUploadedFile(req.file);
        return res.status(400).json({ message: 'มีบริการเสริมที่เลือกไม่ถูกต้อง' });
      }
      addonRows = rows;
      totalPrice += rows.reduce((sum, row) => sum + Number(row.price), 0);
    }

    const bookingCode = makeBookingCode();
    const slipPath = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await connection.query(
      `INSERT INTO bookings
        (booking_code, user_id, service_id, booking_date, booking_time, customer_name, customer_phone,
         car_model, car_plate, total_price, status, payment_status, slip_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        bookingCode,
        req.user.id,
        serviceIdNumber,
        normalizedDate,
        normalizedTime,
        String(customerName).trim(),
        String(customerPhone).trim(),
        String(carModel).trim(),
        String(carPlate).trim(),
        totalPrice,
        slipPath ? 'pending_review' : 'unpaid',
        slipPath
      ]
    );

    for (const addon of addonRows) {
      await connection.query(
        'INSERT INTO booking_addons (booking_id, addon_id, price_at_booking) VALUES (?, ?, ?)',
        [result.insertId, addon.id, addon.price]
      );
    }

    await connection.query(
      `INSERT INTO notifications (user_id, booking_id, title, message, type)
       VALUES (?, ?, ?, ?, 'booking_created')`,
      [req.user.id, result.insertId, 'ได้รับคำขอจองแล้ว', `ระบบได้รับคำขอจอง ${bookingCode} แล้ว รอการตรวจสอบและยืนยัน`]
    );

    await connection.commit();
    transactionStarted = false;
    res.status(201).json({
      bookingCode,
      totalPrice,
      paymentStatus: slipPath ? 'pending_review' : 'unpaid',
      bookingDate: normalizedDate,
      bookingTime: normalizedTime
    });
  } catch (error) {
    if (transactionStarted && connection) await connection.rollback().catch(() => undefined);
    await removeUploadedFile(req.file);
    next(error);
  } finally {
    if (lockAcquired && connection) await connection.query('SELECT RELEASE_LOCK(?)', [slotLockName]).catch(() => undefined);
    if (connection) connection.release();
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [[account]] = await pool.query(
      'SELECT loyalty_points AS loyaltyPoints FROM users WHERE id = ?',
      [req.user.id]
    );
    const [bookings] = await pool.query(
      `SELECT b.id, b.booking_code AS bookingCode, b.booking_date AS bookingDate, b.booking_time AS bookingTime,
              b.customer_name AS customerName, b.customer_phone AS customerPhone, b.car_model AS carModel,
              b.car_plate AS carPlate,
              COALESCE(NULLIF(b.amount_due, 0), b.total_price) AS totalPrice,
              b.total_price AS subtotal, b.discount_amount AS discountAmount, b.vat_amount AS vatAmount,
              b.status, b.payment_status AS paymentStatus,
              b.payment_method AS paymentMethod,
              b.slip_path AS slipPath, s.name AS service
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.user_id = ? ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    for (const booking of bookings) {
      const [addons] = await pool.query(
        `SELECT a.id, a.name, ba.price_at_booking AS price
         FROM booking_addons ba JOIN addons a ON a.id = ba.addon_id WHERE ba.booking_id = ?`,
        [booking.id]
      );
      booking.addons = addons;
    }
    res.json({ bookings, loyaltyPoints: Number(account?.loyaltyPoints || 0) });
  } catch (error) {
    next(error);
  }
});

router.get('/:code/slip', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT slip_path AS slipPath FROM bookings WHERE booking_code = ? AND user_id = ? LIMIT 1',
      [req.params.code, req.user.id]
    );
    if (!rows.length || !rows[0].slipPath) return res.status(404).json({ message: 'ไม่พบสลิปของรายการนี้' });
    return sendPrivateUpload(res, rows[0].slipPath);
  } catch (error) {
    next(error);
  }
});

router.patch('/:code/cancel', authenticate, async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      `SELECT id, user_id AS userId, status, payment_status AS paymentStatus,
              booking_date AS bookingDate, booking_time AS bookingTime
       FROM bookings WHERE booking_code = ? AND user_id = ? FOR UPDATE`,
      [req.params.code, req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'ไม่พบรายการจอง' });
    }
    const booking = rows[0];
    if (!['pending', 'confirmed'].includes(booking.status) || !isBookingStartInFuture(booking.bookingDate, booking.bookingTime)) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'รายการนี้ยกเลิกเองไม่ได้แล้ว กรุณาติดต่อร้านค้า' });
    }
    await connection.query('UPDATE bookings SET status = \'cancelled\' WHERE id = ?', [booking.id]);
    await connection.query(
      `INSERT INTO notifications (user_id, booking_id, title, message, type)
       VALUES (?, ?, 'ยกเลิกการจองแล้ว', 'ยกเลิกการจองของคุณเรียบร้อยแล้ว', 'booking_status')`,
      [booking.userId, booking.id]
    );
    if (booking.paymentStatus === 'verified') {
      const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await connection.query(
          `INSERT INTO notifications (user_id, booking_id, title, message, type)
           VALUES (?, ?, 'มีรายการชำระเงินถูกยกเลิก', 'ลูกค้ายกเลิกรายการที่ชำระแล้ว กรุณาติดต่อเรื่องคืนเงินหรือตรวจสอบรายการ', 'booking_status')`,
          [admin.id, booking.id]
        );
      }
    }
    await connection.commit();
    transactionStarted = false;
    res.json({ message: booking.paymentStatus === 'verified'
      ? 'ยกเลิกรายการแล้ว กรุณาติดต่อร้านค้าเพื่อดำเนินการเรื่องเงินที่ชำระไว้'
      : 'ยกเลิกรายการจองแล้ว' });
  } catch (error) {
    if (transactionStarted && connection) await connection.rollback().catch(() => undefined);
    next(error);
  } finally {
    if (connection) connection.release();
  }
});

router.patch('/:code/reschedule', authenticate, async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  let lockAcquired = false;
  let slotLockName;
  try {
    const bookingDate = String(req.body.bookingDate || '').trim();
    const bookingTime = String(req.body.bookingTime || '').trim();
    const dateTimeError = validateBookingDateAndTime(bookingDate, bookingTime);
    if (dateTimeError) return res.status(400).json({ message: dateTimeError });
    if (!isBookingStartInFuture(bookingDate, bookingTime)) {
      return res.status(400).json({ message: 'กรุณาเลือกวันและเวลาที่จะมาถึง' });
    }

    connection = await pool.getConnection();
    slotLockName = `carwash-slot:${bookingDate}:${bookingTime}`;
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', [slotLockName]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) return res.status(409).json({ message: 'กำลังมีคนจองช่วงเวลานี้ กรุณาลองอีกครั้ง' });

    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(
      `SELECT id, user_id AS userId, status, booking_date AS bookingDate, booking_time AS bookingTime
       FROM bookings WHERE booking_code = ? AND user_id = ? FOR UPDATE`,
      [req.params.code, req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'ไม่พบรายการจอง' });
    }
    const booking = rows[0];
    if (!['pending', 'confirmed'].includes(booking.status) || !isBookingStartInFuture(booking.bookingDate, booking.bookingTime)) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'รายการนี้เลื่อนคิวเองไม่ได้แล้ว กรุณาติดต่อร้านค้า' });
    }
    const currentDate = booking.bookingDate instanceof Date ? booking.bookingDate.toISOString().slice(0, 10) : String(booking.bookingDate).slice(0, 10);
    if (currentDate === bookingDate && booking.bookingTime === bookingTime) {
      await connection.commit();
      transactionStarted = false;
      return res.json({ message: 'รายการจองยังอยู่ในวันและเวลาเดิม' });
    }
    const [slotRows] = await connection.query(
      `SELECT COUNT(*) AS bookedCount FROM bookings
       WHERE booking_date = ? AND booking_time = ? AND status <> 'cancelled'`,
      [bookingDate, bookingTime]
    );
    if (Number(slotRows[0]?.bookedCount || 0) >= getSlotCapacity()) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'ช่วงเวลานี้เต็มแล้ว กรุณาเลือกเวลาอื่น' });
    }
    await connection.query('UPDATE bookings SET booking_date = ?, booking_time = ? WHERE id = ?', [bookingDate, bookingTime, booking.id]);
    await connection.query(
      `INSERT INTO notifications (user_id, booking_id, title, message, type)
       VALUES (?, ?, 'เปลี่ยนวันเวลาจองแล้ว', ?, 'booking_status')`,
      [booking.userId, booking.id, `เปลี่ยนวันเวลาจองเป็น ${bookingDate} เวลา ${bookingTime} แล้ว`]
    );
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'เลื่อนวันและเวลาจองแล้ว' });
  } catch (error) {
    if (transactionStarted && connection) await connection.rollback().catch(() => undefined);
    next(error);
  } finally {
    if (lockAcquired && connection) await connection.query('SELECT RELEASE_LOCK(?)', [slotLockName]).catch(() => undefined);
    if (connection) connection.release();
  }
});

router.post('/:code/payment', authenticate, upload.single('slip'), async (req, res, next) => {
  try {
    const paymentMethod = req.body.paymentMethod === 'cash' ? 'cash' : 'promptpay';
    const promoCode = String(req.body.promoCode || '').trim().toUpperCase();
    if (promoCode && promoCode !== 'PROMO10') {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: 'โค้ดส่วนลดไม่ถูกต้อง' });
    }
    const [rows] = await pool.query(
      `SELECT id, total_price AS subtotal, payment_status AS paymentStatus, status
       FROM bookings WHERE booking_code = ? AND user_id = ?`,
      [req.params.code, req.user.id]
    );
    if (!rows.length) {
      await removeUploadedFile(req.file);
      return res.status(404).json({ message: 'ไม่พบรายการจอง' });
    }
    if (rows[0].paymentStatus === 'verified') {
      await removeUploadedFile(req.file);
      return res.status(409).json({ message: 'รายการนี้ชำระเงินเรียบร้อยแล้ว' });
    }
    if (rows[0].status === 'cancelled') {
      await removeUploadedFile(req.file);
      return res.status(409).json({ message: 'รายการจองถูกยกเลิกแล้ว จึงแจ้งชำระเงินไม่ได้' });
    }
    if (rows[0].paymentStatus === 'pending_review') {
      await removeUploadedFile(req.file);
      return res.status(409).json({ message: 'รายการนี้กำลังรอแอดมินยืนยันการชำระเงินอยู่แล้ว' });
    }

    const subtotal = Number(rows[0].subtotal);
    const discount = promoCode === 'PROMO10' ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const vat = Math.round((subtotal - discount) * 0.07 * 100) / 100;
    const amountDue = Math.round((subtotal - discount + vat) * 100) / 100;

    if (paymentMethod === 'cash') {
      await removeUploadedFile(req.file);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [updateResult] = await connection.query(
          `UPDATE bookings SET discount_amount = ?, vat_amount = ?, amount_due = ?, promo_code = ?,
                               payment_method = 'cash', payment_status = 'pending_review', slip_path = NULL,
                               transaction_ref = NULL, slip2go_reference_id = NULL
           WHERE id = ? AND user_id = ? AND payment_status IN ('unpaid', 'rejected') AND status <> 'cancelled'`,
          [discount, vat, amountDue, promoCode || null, rows[0].id, req.user.id]
        );
        if (!updateResult.affectedRows) {
          await connection.rollback();
          return res.status(409).json({ message: 'รายการจองเปลี่ยนสถานะแล้ว กรุณาโหลดหน้าใหม่' });
        }

        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
          await connection.query(
            `INSERT INTO notifications (user_id, booking_id, title, message, type)
             VALUES (?, ?, 'มีรายการแจ้งชำระเงินสด', ?, 'booking_status')`,
            [admin.id, rows[0].id, `ลูกค้าแจ้งชำระเงินสด ${amountDue.toFixed(2)} บาท กรุณาตรวจรับเงินและยืนยันรายการ`]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
      return res.json({
        paymentMethod: 'cash', paymentStatus: 'pending_review', subtotal, discount, vat, amountDue,
        message: 'แจ้งชำระเงินสดแล้ว กรุณารอเจ้าหน้าที่ตรวจรับเงินและยืนยันรายการ'
      });
    }

    if (!req.file) return res.status(400).json({ message: 'กรุณาแนบสลิปการโอนเงิน' });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
      await removeUploadedFile(req.file);
      return res.status(422).json({ message: 'กรุณาแนบรูปสลิปที่มี QR Code (JPG, PNG หรือ WEBP)' });
    }

    let verification;
    let verificationError;
    try {
      verification = await verifySlipWithSlip2Go(req.file, amountDue);
    } catch (error) {
      verificationError = error;
    }
    await saveSlipVerification(rows[0].id, { result: verification, error: verificationError });
    if (verificationError) {
      const error = verificationError;
      await removeUploadedFile(req.file);
      if (error.rejectedSlip) {
        await pool.query(
          `UPDATE bookings SET discount_amount = ?, vat_amount = ?, amount_due = ?, promo_code = ?,
                               payment_status = 'rejected', slip_path = NULL
           WHERE id = ? AND user_id = ?`,
          [discount, vat, amountDue, promoCode || null, rows[0].id, req.user.id]
        );
      }
      return res.status(error.status || 503).json({ message: error.message });
    }

    const slipPath = `/uploads/${req.file.filename}`;
    const [updateResult] = await pool.query(
      `UPDATE bookings SET discount_amount = ?, vat_amount = ?, amount_due = ?, promo_code = ?,
                           payment_method = 'promptpay',
                           payment_status = 'verified', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                           slip_path = ?, transaction_ref = ?, slip2go_reference_id = ?
       WHERE id = ? AND user_id = ? AND status <> 'cancelled'`,
      [discount, vat, amountDue, promoCode || null, slipPath, verification.data.transRef,
        verification.data.referenceId || null, rows[0].id, req.user.id]
    );
    if (!updateResult.affectedRows) {
      await removeUploadedFile(req.file);
      const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await pool.query(
          `INSERT INTO notifications (user_id, booking_id, title, message, type)
           VALUES (?, ?, 'ตรวจพบการโอนหลังยกเลิกคิว', 'มีการยืนยันสลิปได้หลังรายการถูกยกเลิก กรุณาติดต่อผู้ใช้เพื่อจัดการเงิน', 'booking_status')`,
          [admin.id, rows[0].id]
        );
      }
      return res.status(409).json({ message: 'รายการจองถูกยกเลิกระหว่างตรวจสลิป กรุณาติดต่อร้านค้าเพื่อดำเนินการเรื่องเงินที่โอนแล้ว' });
    }
    res.json({
      paymentStatus: 'verified', subtotal, discount, vat, amountDue,
      slipReference: verification.data.transRef,
      message: 'ตรวจสอบสลิปและยืนยันการชำระเงินเรียบร้อยแล้ว'
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    next(error);
  }
});

router.get('/:code', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.booking_code AS bookingCode, b.booking_date AS bookingDate,
              b.booking_time AS bookingTime, b.customer_name AS customerName,
              b.customer_phone AS customerPhone, b.car_model AS carModel, b.car_plate AS carPlate,
              b.total_price AS subtotal, b.discount_amount AS discountAmount,
              b.vat_amount AS vatAmount, COALESCE(NULLIF(b.amount_due, 0), b.total_price) AS amountDue,
              b.promo_code AS promoCode, b.status, b.payment_status AS paymentStatus,
              b.payment_method AS paymentMethod, b.slip_path AS slipPath,
              s.name AS service
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.booking_code = ? AND b.user_id = ?`,
      [req.params.code, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'ไม่พบรายการจอง' });
    const [addons] = await pool.query(
      `SELECT a.id, a.name, ba.price_at_booking AS price
       FROM booking_addons ba JOIN addons a ON a.id = ba.addon_id WHERE ba.booking_id = ?`,
      [rows[0].id]
    );
    const promptPayNumber = String(process.env.PROMPTPAY_NUMBER || '').replace(/\D/g, '');
    res.json({ booking: { ...rows[0], addons }, promptPayNumber });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

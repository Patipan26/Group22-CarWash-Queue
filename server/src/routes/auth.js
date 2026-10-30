const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db');
const { getToken } = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'development-secret',
    { expiresIn: '7d' }
  );
}

function getSessionCookieName(req) {
  const sessionId = req.headers['x-session-id'];
  return sessionId && /^[a-zA-Z0-9-]{1,80}$/.test(sessionId) ? `token_${sessionId}` : 'token';
}

function setAuthCookie(res, user, req) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(getSessionCookieName(req), issueToken(user), {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || password.length < 6) {
      return res.status(400).json({ message: 'กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'อีเมลนี้มีบัญชีแล้ว' });

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)',
      [email, passwordHash, req.body.name || null, req.body.phone || null]
    );
    const user = { id: result.insertId, email, role: 'customer' };
    setAuthCookie(res, user, req);
    res.status(201).json({ user });
  } catch (error) { next(error); }
});

router.post('/google', async (req, res, next) => {
  try {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    const credential = String(req.body.credential || '').trim();
    if (!clientId) return res.status(503).json({ message: 'ยังไม่ได้ตั้งค่า Google Login ที่เซิร์ฟเวอร์' });
    if (!credential) return res.status(400).json({ message: 'ไม่พบข้อมูลจาก Google' });

    let payload;
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'ยืนยันตัวตนกับ Google ไม่สำเร็จ' });
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ message: 'บัญชี Google นี้ยังยืนยันอีเมลไม่สำเร็จ' });
    }

    const email = String(payload.email).trim().toLowerCase();
    const name = String(payload.name || payload.email.split('@')[0]).trim().slice(0, 120);
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, google_id, name, phone, role FROM users WHERE google_id = ? OR email = ? LIMIT 1',
      [payload.sub, email]
    );

    let user = rows[0];
    if (user) {
      if (user.google_id && user.google_id !== payload.sub) {
        return res.status(409).json({ message: 'อีเมลนี้เชื่อมกับบัญชี Google อื่นแล้ว' });
      }
      await pool.query(
        'UPDATE users SET google_id = ?, name = COALESCE(name, ?) WHERE id = ?',
        [payload.sub, name, user.id]
      );
      user = { ...user, google_id: payload.sub, name: user.name || name };
    } else {
      const [result] = await pool.query(
        'INSERT INTO users (email, password_hash, google_id, name, phone) VALUES (?, NULL, ?, ?, NULL)',
        [email, payload.sub, name]
      );
      user = { id: result.insertId, email, google_id: payload.sub, name, phone: null, role: 'customer' };
    }

    const sessionUser = { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
    setAuthCookie(res, sessionUser, req);
    res.json({ user: sessionUser });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.query('SELECT id, email, password_hash, name, phone, role FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const sessionUser = { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
    setAuthCookie(res, sessionUser, req);
    res.json({ user: sessionUser });
  } catch (error) { next(error); }
});

router.post('/logout', (req, res) => {
  res.clearCookie(getSessionCookieName(req));
  res.json({ message: 'ออกจากระบบแล้ว' });
});

router.get('/me', (req, res) => {
  const token = getToken(req);
  if (!token) return res.json({ user: null });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

module.exports = router;

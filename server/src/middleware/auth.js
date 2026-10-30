const jwt = require('jsonwebtoken');

function getToken(req) {
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) return null;
    return req.cookies?.[`token_${sessionId}`] || null;
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.token || null;
}

function authenticate(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อน' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    next();
  } catch {
    return res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

function optionalAuthenticate(req, _res, next) {
  const token = getToken(req);
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET || 'development-secret'); } catch { /* anonymous */ }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' });
  next();
}

module.exports = { authenticate, optionalAuthenticate, requireAdmin, getToken };

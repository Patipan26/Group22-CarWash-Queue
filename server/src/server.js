require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const bookingRoutes = require('./routes/bookings');
const contactRoutes = require('./routes/contacts');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');
const notificationRoutes = require('./routes/notifications');

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'carwash-queue-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'ไฟล์มีขนาดเกิน 5 MB' });
  res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
});

app.listen(port, () => console.log(`CarWash Queue API listening on http://localhost:${port}`));

const express = require('express');
const pool = require('../db');
const upload = require('../middleware/upload');
const { optionalAuthenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', optionalAuthenticate, upload.single('attachment'), async (req, res, next) => {
  try {
    const { senderName, senderContact, subject, message } = req.body;
    if (!senderName || !senderContact || !subject || !message) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
    const attachmentOriginalName = req.file
      ? String(req.file.originalname || 'ไฟล์แนบ').replace(/\\/g, '/').split('/').pop().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255)
      : null;
    await pool.query(
      `INSERT INTO contacts (user_id, sender_name, sender_contact, subject, message, attachment_path, attachment_original_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user?.id || null, senderName, senderContact, subject, message, attachmentPath, attachmentOriginalName]
    );
    res.status(201).json({ message: 'ส่งข้อความเรียบร้อยแล้ว' });
  } catch (error) { next(error); }
});

module.exports = router;

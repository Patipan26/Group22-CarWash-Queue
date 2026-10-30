const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const [services] = await pool.query(
      'SELECT id, name, description, price, duration_minutes AS durationMinutes FROM services WHERE active = TRUE ORDER BY id'
    );
    const [addons] = await pool.query(
      'SELECT id, name, description, price FROM addons WHERE active = TRUE ORDER BY id'
    );
    res.json({ services, addons });
  } catch (error) { next(error); }
});

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

module.exports = router;

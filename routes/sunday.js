// routes/sunday.js — Sunday basket collections
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const auth    = require('../middleware/auth');

router.use(auth);

// ── GET /api/sunday ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sunday_collections ORDER BY service_date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get sunday collections error:', err);
    res.status(500).json({ error: 'Failed to fetch Sunday collections.' });
  }
});

// ── GET /api/sunday/last ─────────────────────────────────
// Returns the most recent Sunday entry
router.get('/last', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sunday_collections ORDER BY service_date DESC LIMIT 1'
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Get last sunday error:', err);
    res.status(500).json({ error: 'Failed to fetch last Sunday collection.' });
  }
});

// ── GET /api/sunday/totals ───────────────────────────────
router.get('/totals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(SUM(offering_amount), 0) AS total_offering,
        COALESCE(SUM(tithing_amount),  0) AS total_tithing
      FROM sunday_collections
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get sunday totals error:', err);
    res.status(500).json({ error: 'Failed to fetch Sunday totals.' });
  }
});

// ── POST /api/sunday ─────────────────────────────────────
// Body: { serviceDate, offering, tithing, notes }
router.post('/', async (req, res) => {
  const { serviceDate, offering, tithing, notes } = req.body;

  if (!serviceDate) {
    return res.status(400).json({ error: 'Service date is required.' });
  }
  if (!offering && !tithing) {
    return res.status(400).json({ error: 'Enter at least one of: offering or tithing amount.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO sunday_collections (service_date, offering_amount, tithing_amount, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [serviceDate, Number(offering) || 0, Number(tithing) || 0, notes?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create sunday collection error:', err);
    res.status(500).json({ error: 'Failed to save Sunday collection.' });
  }
});

module.exports = router;

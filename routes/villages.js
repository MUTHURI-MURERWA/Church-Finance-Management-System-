// routes/villages.js — Villages list
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const auth    = require('../middleware/auth');

router.use(auth);

// ── GET /api/villages ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, COUNT(m.id)::int AS member_count
      FROM villages v
      LEFT JOIN members m ON m.village_id = v.id
      WHERE v.church_id = $1
      GROUP BY v.id
      ORDER BY v.name ASC
    `, [req.user.church_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get villages error:', err);
    res.status(500).json({ error: 'Failed to fetch villages.' });
  }
});

// ── POST /api/villages ───────────────────────────────────
router.post('/', async (req, res) => {
  const { name } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Village name is required.' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO villages (name, church_id) VALUES ($1, $2) RETURNING *',
      [name.trim(), req.user.church_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Village already exists.' });
    }
    console.error('Create village error:', err);
    res.status(500).json({ error: 'Failed to create village.' });
  }
});

module.exports = router;

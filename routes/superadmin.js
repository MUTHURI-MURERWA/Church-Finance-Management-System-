// routes/superadmin.js — Superadmin church management
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const superAdminMiddleware = require('../middleware/superadmin');

// All routes here require superadmin
router.use(superAdminMiddleware);

// ── GET /api/superadmin/churches ─────────────────────────────
router.get('/churches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
             (SELECT COUNT(m.id) FROM members m WHERE m.church_id = c.id)::int as member_count,
             (SELECT COUNT(t.id) FROM transactions t WHERE t.church_id = c.id)::int as transaction_count
      FROM churches c
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get churches error:', err);
    res.status(500).json({ error: 'Failed to fetch churches.' });
  }
});

// ── POST /api/superadmin/churches ────────────────────────────
// Body: { code, name }
router.post('/churches', async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Church code and name are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create the church
    const insertRes = await client.query(
      'INSERT INTO churches (code, name) VALUES ($1, $2) RETURNING *',
      [code.trim().toUpperCase(), name.trim()]
    );
    const newChurch = insertRes.rows[0];

    // Create the default finance_secretary user for this church
    const defaultPassword = 'admin' + Math.floor(100 + Math.random() * 900); // e.g. admin452
    const hash = await bcrypt.hash(defaultPassword, 10);
    
    await client.query(`
      INSERT INTO users (username, password_hash, role, is_default_password, church_id)
      VALUES ('finance_secretary', $1, 'admin', TRUE, $2)
    `, [hash, newChurch.id]);

    await client.query('COMMIT');
    res.status(201).json({ 
      church: newChurch, 
      defaultPassword 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: 'A church with this code already exists.' });
    }
    console.error('Create church error:', err);
    res.status(500).json({ error: 'Failed to create church.' });
  } finally {
    client.release();
  }
});

// ── POST /api/superadmin/churches/:id/reset-password ─────────
router.post('/churches/:id/reset-password', async (req, res) => {
  try {
    const defaultPassword = 'admin' + Math.floor(100 + Math.random() * 900);
    const hash = await bcrypt.hash(defaultPassword, 10);

    const updateRes = await pool.query(`
      UPDATE users SET password_hash = $1, is_default_password = TRUE
      WHERE church_id = $2 AND role = 'admin' AND username = 'finance_secretary'
      RETURNING id
    `, [hash, req.params.id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'No admin user found for this church.' });
    }

    res.json({ message: 'Password reset.', defaultPassword });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

module.exports = router;

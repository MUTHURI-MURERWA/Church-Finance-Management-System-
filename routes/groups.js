// routes/groups.js — Church groups CRUD
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const auth    = require('../middleware/auth');

router.use(auth);

// ── GET /api/groups ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        g.id,
        g.name,
        g.description,
        g.created_at,
        COUNT(mg.member_id)::int AS member_count
      FROM groups g
      LEFT JOIN member_groups mg ON mg.group_id = g.id
      WHERE g.church_id = $1
      GROUP BY g.id
      ORDER BY g.name ASC
    `, [req.user.church_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ error: 'Failed to fetch groups.' });
  }
});

// ── GET /api/groups/:id/members ──────────────────────────
router.get('/:id/members', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.member_id,
        m.full_name,
        m.phone,
        m.join_date,
        v.name AS village
      FROM member_groups mg
      JOIN members m ON m.id = mg.member_id
      LEFT JOIN villages v ON v.id = m.village_id
      WHERE mg.group_id = $1 AND m.church_id = $2
      ORDER BY m.member_id ASC
    `, [req.params.id, req.user.church_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get group members error:', err);
    res.status(500).json({ error: 'Failed to fetch group members.' });
  }
});

// ── POST /api/groups ─────────────────────────────────────
// Body: { name, description }
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO groups (name, description, church_id) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description?.trim() || null, req.user.church_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'A group with this name already exists.' });
    }
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group.' });
  }
});

module.exports = router;

// routes/projects.js — Church projects
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const auth    = require('../middleware/auth');

router.use(auth);

// ── GET /api/projects ────────────────────────────────────
// Returns all projects with total collected amount
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        COALESCE(SUM(t.amount), 0) AS collected
      FROM projects p
      LEFT JOIN transactions t
        ON t.project_id = p.id AND t.transaction_type = 'Project Contribution'
      WHERE p.church_id = $1
      GROUP BY p.id
      ORDER BY p.start_date DESC
    `, [req.user.church_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// ── POST /api/projects ───────────────────────────────────
// Body: { name, targetAmount, description }
router.post('/', async (req, res) => {
  const { name, targetAmount, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO projects (name, target_amount, description, start_date, church_id)
       VALUES ($1, $2, $3, CURRENT_DATE, $4) RETURNING *`,
      [name.trim(), Number(targetAmount) || 0, description?.trim() || null, req.user.church_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

module.exports = router;

// routes/members.js — Member CRUD with status management
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// ── GET /api/members ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // Auto-update dormant status before returning (6 months rule)
    await pool.query(`
      UPDATE members
      SET status = 'dormant'
      WHERE status = 'active'
        AND (
          last_contribution_date IS NULL
          OR last_contribution_date < NOW() - INTERVAL '6 months'
        )
        AND manually_set_status = FALSE
    `);

    const result = await pool.query(`
      SELECT
        m.id,
        m.member_id,
        m.full_name,
        m.phone,
        m.join_date,
        m.status,
        m.last_contribution_date,
        m.manually_set_status,
        v.name AS village,
        COALESCE(
          json_agg(g.name ORDER BY g.name) FILTER (WHERE g.name IS NOT NULL),
          '[]'
        ) AS groups
      FROM members m
      LEFT JOIN villages v ON v.id = m.village_id
      LEFT JOIN member_groups mg ON mg.member_id = m.id
      LEFT JOIN groups g ON g.id = mg.group_id
      GROUP BY m.id, v.name
      ORDER BY m.member_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
});

// ── GET /api/members/:memberId ────────────────────────────
router.get('/:memberId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id, m.member_id, m.full_name, m.phone, m.join_date,
        m.status, m.last_contribution_date, m.manually_set_status,
        v.name AS village,
        COALESCE(
          json_agg(g.name ORDER BY g.name) FILTER (WHERE g.name IS NOT NULL),
          '[]'
        ) AS groups
      FROM members m
      LEFT JOIN villages v ON v.id = m.village_id
      LEFT JOIN member_groups mg ON mg.member_id = m.id
      LEFT JOIN groups g ON g.id = mg.group_id
      WHERE m.member_id = $1
      GROUP BY m.id, v.name
    `, [req.params.memberId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get member error:', err);
    res.status(500).json({ error: 'Failed to fetch member.' });
  }
});

// ── POST /api/members ────────────────────────────────────
router.post('/', async (req, res) => {
  const { fullName, phone, village, groups } = req.body;
  if (!fullName?.trim()) return res.status(400).json({ error: 'Full name is required.' });
  if (!village?.trim()) return res.status(400).json({ error: 'Village is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-generate member_id
    const countRes = await client.query('SELECT COUNT(*) FROM members');
    const memberId = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');

    // Resolve or create village
    let villageRes = await client.query(
      'SELECT id FROM villages WHERE LOWER(name) = LOWER($1)', [village.trim()]
    );
    let villageId;
    if (villageRes.rows.length === 0) {
      const ins = await client.query(
        'INSERT INTO villages (name) VALUES ($1) RETURNING id', [village.trim()]
      );
      villageId = ins.rows[0].id;
    } else {
      villageId = villageRes.rows[0].id;
    }

    // Insert member with active status
    const memberRes = await client.query(`
      INSERT INTO members (member_id, full_name, phone, village_id, join_date, status, manually_set_status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, 'active', FALSE) RETURNING *
    `, [memberId, fullName.trim(), phone?.trim() || null, villageId]);
    const newMember = memberRes.rows[0];

    // Assign groups
    if (groups?.length > 0) {
      for (const groupName of groups) {
        const grpRes = await client.query(
          'SELECT id FROM groups WHERE LOWER(name) = LOWER($1)', [groupName]
        );
        if (grpRes.rows.length > 0) {
          await client.query(
            'INSERT INTO member_groups (member_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newMember.id, grpRes.rows[0].id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...newMember, village, groups: groups || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create member error:', err);
    res.status(500).json({ error: 'Failed to create member.' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/members/:memberId/status ──────────────────
// Finance secretary manually sets active/inactive/dormant
// Body: { status: 'active' | 'inactive' | 'dormant' }
router.patch('/:memberId/status', async (req, res) => {
  const { status } = req.body;
  const VALID = ['active', 'dormant', 'inactive'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: 'Status must be active, dormant or inactive.' });
  }
  try {
    const result = await pool.query(`
      UPDATE members
      SET status = $1, manually_set_status = TRUE, updated_at = NOW()
      WHERE member_id = $2
      RETURNING *
    `, [status, req.params.memberId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }
    res.json({ message: `Member status updated to ${status}.`, member: result.rows[0] });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update member status.' });
  }
});

// ── GET /api/members/:memberId/transactions ───────────────
router.get('/:memberId/transactions', async (req, res) => {
  try {
    const memberRes = await pool.query(
      'SELECT id FROM members WHERE member_id = $1', [req.params.memberId]
    );
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }
    const result = await pool.query(`
      SELECT t.*, p.name AS project_name
      FROM transactions t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.member_id = $1
      ORDER BY t.transaction_date DESC, t.created_at DESC
    `, [memberRes.rows[0].id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get member transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

module.exports = router;

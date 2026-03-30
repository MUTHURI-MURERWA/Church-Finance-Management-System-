// routes/analytics.js — Village & Group contribution analytics
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/villages', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        v.id,
        v.name AS village,
        COUNT(DISTINCT m.id)::int AS member_count,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type != 'Expense'), 0) AS total_contributions,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Offering'), 0) AS offering,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Tithing'), 0)  AS tithing,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Development Fund'), 0) AS dev_fund,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Welfare/Harambee'), 0) AS welfare,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Project Contribution'), 0) AS projects
      FROM villages v
      LEFT JOIN members m ON m.village_id = v.id
      LEFT JOIN transactions t ON t.member_id = m.id
      GROUP BY v.id, v.name
      ORDER BY total_contributions DESC
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('Village analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch village analytics.' });
    }
});

router.get('/villages/:id/members', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        m.member_id,
        m.full_name,
        m.phone,
        m.status,
        m.last_contribution_date,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type != 'Expense'), 0) AS total_contributions,
        COUNT(t.id)::int AS transaction_count
      FROM members m
      LEFT JOIN transactions t ON t.member_id = m.id
      WHERE m.village_id = $1
      GROUP BY m.id
      ORDER BY total_contributions DESC
    `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Village members analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch village members.' });
    }
});

router.get('/groups', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        g.id,
        g.name AS group_name,
        COUNT(DISTINCT mg.member_id)::int AS member_count,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type != 'Expense'), 0) AS total_contributions,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Offering'), 0) AS offering,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Tithing'), 0)  AS tithing,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Development Fund'), 0) AS dev_fund,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Welfare/Harambee'), 0) AS welfare,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Project Contribution'), 0) AS projects
      FROM groups g
      LEFT JOIN member_groups mg ON mg.group_id = g.id
      LEFT JOIN transactions t ON t.member_id = mg.member_id
      GROUP BY g.id, g.name
      ORDER BY total_contributions DESC
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('Group analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch group analytics.' });
    }
});

router.get('/groups/:id/members', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        m.member_id,
        m.full_name,
        m.phone,
        m.status,
        v.name AS village,
        COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type != 'Expense'), 0) AS total_contributions,
        COUNT(t.id)::int AS transaction_count
      FROM member_groups mg
      JOIN members m ON m.id = mg.member_id
      LEFT JOIN villages v ON v.id = m.village_id
      LEFT JOIN transactions t ON t.member_id = m.id
      WHERE mg.group_id = $1
      GROUP BY m.id, v.name
      ORDER BY total_contributions DESC
    `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Group members analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch group member analytics.' });
    }
});

router.get('/dashboard', async (req, res) => {
    try {
        const [overview, villages, groups, lastSunday, sundayTotals, memberStatus] = await Promise.all([
            pool.query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Offering'), 0)             AS offering,
          COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Tithing'), 0)              AS tithing,
          COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Development Fund'), 0)     AS dev_fund,
          COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Welfare/Harambee'), 0)     AS welfare,
          COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Project Contribution'), 0) AS projects,
          COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Expense'), 0)              AS expenses
        FROM transactions
      `),
            pool.query(`
        SELECT v.id, v.name AS village,
          COUNT(DISTINCT m.id)::int AS member_count,
          COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type != 'Expense'), 0) AS total_contributions
        FROM villages v
        LEFT JOIN members m ON m.village_id = v.id
        LEFT JOIN transactions t ON t.member_id = m.id
        GROUP BY v.id, v.name
        ORDER BY total_contributions DESC
      `),
            pool.query(`
        SELECT g.id, g.name AS group_name,
          COUNT(DISTINCT mg.member_id)::int AS member_count,
          COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type != 'Expense'), 0) AS total_contributions
        FROM groups g
        LEFT JOIN member_groups mg ON mg.group_id = g.id
        LEFT JOIN transactions t ON t.member_id = mg.member_id
        GROUP BY g.id, g.name
        ORDER BY total_contributions DESC
      `),
            pool.query(`SELECT * FROM sunday_collections ORDER BY service_date DESC LIMIT 1`),
            pool.query(`
        SELECT
          COALESCE(SUM(offering_amount), 0) AS total_offering,
          COALESCE(SUM(tithing_amount),  0) AS total_tithing
        FROM sunday_collections
      `),
            pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int  AS active,
          COUNT(*) FILTER (WHERE status = 'dormant')::int AS dormant
        FROM members
      `)
        ]);

        res.json({
            overview: overview.rows[0],
            villages: villages.rows,
            groups: groups.rows,
            lastSunday: lastSunday.rows[0] || null,
            sundayTotals: sundayTotals.rows[0],
            memberStatus: memberStatus.rows[0],
        });
    } catch (err) {
        console.error('Dashboard analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});

module.exports = router;
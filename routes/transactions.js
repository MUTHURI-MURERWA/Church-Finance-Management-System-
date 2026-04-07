const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const typeObj = req.query.type;
    let query = `
      SELECT t.*, m.full_name AS member_name, m.member_id as member_code, v.name AS village,
      COALESCE((SELECT string_agg(g.name, ', ') FROM member_groups mg JOIN groups g ON g.id = mg.group_id WHERE mg.member_id = m.id), '') AS groups
      FROM transactions t
      LEFT JOIN members m ON m.id = t.member_id
      LEFT JOIN villages v ON v.id = m.village_id
      WHERE t.church_id = $1
    `;
    let params = [req.user.church_id];
    let paramIndex = 2;
    if (typeObj) {
      query += ` AND t.transaction_type = $${paramIndex}`;
      params.push(typeObj);
      paramIndex++;
    }
    query += ` ORDER BY t.transaction_date DESC, t.id DESC`;
    if (req.query.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(req.query.limit);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Transactions get error', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/summary/monthly
router.get('/summary/monthly', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(transaction_date, 'Mon YYYY') AS month,
        COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'Expense'), 0) AS income,
        COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Expense'), 0) AS expense
      FROM transactions
      WHERE church_id = $1
      GROUP BY TO_CHAR(transaction_date, 'Mon YYYY'), DATE_TRUNC('month', transaction_date)
      ORDER BY DATE_TRUNC('month', transaction_date) DESC
      LIMIT 12
    `, [req.user.church_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Monthly summary error', err);
    res.status(500).json({ error: 'Failed to fetch monthly summary' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  const { memberId, type, amount, date, description, projectId, category } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Generate receipt number per church
    const rRes = await client.query("SELECT COALESCE(MAX(receipt_no), 0) + 1 AS next_id FROM transactions WHERE church_id = $1", [req.user.church_id]);
    const receiptNo = parseInt(rRes.rows[0].next_id, 10);

    let dbMemberId = null;
    let memberName = null;

    if (type !== 'Expense') {
      if (!memberId) throw new Error('Member ID is required for contributions');
      const mRes = await client.query('SELECT id, full_name, status, manually_set_status FROM members WHERE member_id = $1 AND church_id = $2', [memberId, req.user.church_id]);
      if (mRes.rows.length === 0) throw new Error('Member not found');
      
      const member = mRes.rows[0];
      dbMemberId = member.id;
      memberName = member.full_name;

      // Update last_contribution_date
      await client.query('UPDATE members SET last_contribution_date = $1 WHERE id = $2 AND church_id = $3', [date || new Date(), dbMemberId, req.user.church_id]);

      // If dormant and not manually set, make active
      if (member.status === 'dormant' && !member.manually_set_status) {
        await client.query("UPDATE members SET status = 'active' WHERE id = $1 AND church_id = $2", [dbMemberId, req.user.church_id]);
      }
      
      // If project contribution, update project collected
      if (type === 'Project Contribution' && projectId) {
        await client.query('UPDATE projects SET collected = COALESCE(collected, 0) + $1 WHERE id = $2 AND church_id = $3', [amount, projectId, req.user.church_id]);
      }
    }

    const insQuery = `
      INSERT INTO transactions (receipt_no, member_id, transaction_type, amount, transaction_date, description, project_id, category, church_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `;
    const insVars = [
      receiptNo, 
      dbMemberId, 
      type, 
      amount, 
      date || new Date(), 
      description || null, 
      projectId || null,
      category || null,
      req.user.church_id
    ];
    
    const txnRes = await client.query(insQuery, insVars);
    const txn = txnRes.rows[0];

    await client.query('COMMIT');
    
    res.status(201).json({ ...txn, member_name: memberName, member_code: memberId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create transaction error:', err);
    res.status(500).json({ error: err.message || 'Failed to create transaction' });
  } finally {
    client.release();
  }
});

module.exports = router;

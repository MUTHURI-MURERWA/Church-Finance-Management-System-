// routes/auth.js — Login & password management
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const auth    = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────────────
// Body: { churchCode, password }
router.post('/login', async (req, res) => {
  const { churchCode, password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  try {
    let user;
    let churchId = null;

    if (churchCode === 'ADMIN') {
      // Super Admin Login
      const result = await pool.query("SELECT * FROM users WHERE role = 'superadmin' LIMIT 1");
      if (result.rows.length === 0) return res.status(401).json({ error: 'Admin account not found.' });
      user = result.rows[0];
    } else {
      // Church Login
      if (!churchCode) return res.status(400).json({ error: 'Church Code is required.' });
      const churchRes = await pool.query('SELECT * FROM churches WHERE code = $1', [churchCode]);
      if (churchRes.rows.length === 0) return res.status(401).json({ error: 'Invalid Church Code.' });
      
      churchId = churchRes.rows[0].id;
      const result = await pool.query('SELECT * FROM users WHERE church_id = $1 LIMIT 1', [churchId]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'No user account found for this church.' });
      user = result.rows[0];
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, church_id: user.church_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      isDefaultPassword: user.is_default_password,
      username: user.username,
      role: user.role,
      churchCode: churchCode
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ── POST /api/auth/change-password ───────────────────────
router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user   = result.rows[0];

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, is_default_password = FALSE, updated_at = NOW() WHERE id = $2',
      [newHash, user.id]
    );

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error while changing password.' });
  }
});

module.exports = router;

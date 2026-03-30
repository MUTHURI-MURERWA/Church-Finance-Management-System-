// routes/auth.js — Login & password management
/*import express framework , create a router to define authentication routes
import bcrypt for  password hashing and comparison, jsonwebtoken to create
authentication tokens, postgreSQL connection to pool and authentication middleware
to protect routes */
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const auth    = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────────────
// Body: { password } used for logging into the system
router.post('/login', async (req, res) => {
  const { password } = req.body;// extract password from request body
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  try {// fetch the first user from the database
    const result = await pool.query('SELECT * FROM users LIMIT 1');
    if (result.rows.length === 0) { // if no user exists in the databse
      return res.status(500).json({ error: 'No user account found. Please seed the database.' });
    }

    // get user record and compare entered password with stored hashed password
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Incorrect password.' });// if no match
    }

    // Sign JWT — expires in 8 hours (a full working day)
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // send token and user info back to frontend
    res.json({
      token,
      isDefaultPassword: user.is_default_password,
      username: user.username,
    });
  } catch (err) {
    // log server error
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ── POST /api/auth/change-password ───────────────────────
// Body: { currentPassword, newPassword }
// Requires: Bearer token
router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {// validate both passwords are provided
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

    // hash new password
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

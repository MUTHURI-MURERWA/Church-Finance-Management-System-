require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/sunday', require('./routes/sunday'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/villages', require('./routes/villages'));
app.use('/api/analytics', require('./routes/analytics'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── TEMPORARY SETUP ROUTE — DELETE AFTER FIRST USE ──
app.get('/setup', async (req, res) => {
  const pool = require('./db');
  const bcrypt = require('bcrypt');
  try {
    await pool.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
      ALTER TABLE members ADD COLUMN IF NOT EXISTS last_contribution_date DATE;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS manually_set_status BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, password_hash, is_default_password)
      VALUES ('finance_secretary', $1, TRUE)
      ON CONFLICT DO NOTHING
    `, [hash]);
    const groups = ['Youths Group', 'Women Fellowship', 'Men Fellowship', 'Sunday School', 'Praise and Worship Team'];
    for (const g of groups) {
      await pool.query(`INSERT INTO groups (name) VALUES ($1) ON CONFLICT DO NOTHING`, [g]);
    }
    const villages = ['Kiambu Village', 'Thika Village', 'Ruiru Village', 'Limuru Village', 'Gatundu Village'];
    for (const v of villages) {
      await pool.query(`INSERT INTO villages (name) VALUES ($1) ON CONFLICT DO NOTHING`, [v]);
    }
    res.send(`
      <html><body style="font-family:Arial;padding:40px;background:#0d1b2a;color:#e8dcc8;">
      <h1 style="color:#d4af37;">⛪ CFMS Setup Complete!</h1>
      <p>✅ Migration done</p>
      <p>✅ User created — password: <b>admin123</b></p>
      <p>✅ Default groups created</p>
      <p>✅ Sample villages created</p>
      <br/>
      <p style="color:#f87171;"><b>⚠️ Important: Delete the /setup route from server.js now!</b></p>
      <a href="/" style="color:#d4af37;">→ Go to CFMS</a>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('Setup Error: ' + err.message);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⛪  CFMS Server running on http://localhost:${PORT}\n`);
});
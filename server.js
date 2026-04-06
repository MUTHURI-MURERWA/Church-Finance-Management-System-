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

    // STEP 1 — Create all tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL DEFAULT 'finance_secretary',
        password_hash VARCHAR(255) NOT NULL,
        is_default_password BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS villages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        member_id VARCHAR(10) NOT NULL UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(20),
        village_id INTEGER REFERENCES villages(id),
        join_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        last_contribution_date DATE,
        manually_set_status BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS member_groups (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(member_id, group_id)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        target_amount NUMERIC(12,2) DEFAULT 0,
        start_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sunday_collections (
        id SERIAL PRIMARY KEY,
        service_date DATE NOT NULL,
        offering_amount NUMERIC(12,2) DEFAULT 0,
        tithing_amount NUMERIC(12,2) DEFAULT 0,
        notes TEXT,
        recorded_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        receipt_no INTEGER NOT NULL UNIQUE,
        member_id INTEGER REFERENCES members(id),
        transaction_type VARCHAR(50) NOT NULL,
        category VARCHAR(100),
        amount NUMERIC(12,2) NOT NULL,
        project_id INTEGER REFERENCES projects(id),
        description TEXT,
        transaction_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // STEP 2 — Seed user
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, password_hash, is_default_password)
      VALUES ('finance_secretary', $1, TRUE)
      ON CONFLICT DO NOTHING
    `, [hash]);

    // STEP 3 — Seed groups
    const groups = [
      'Youths Group',
      'Women Fellowship',
      'Men Fellowship',
      'Sunday School',
      'Praise and Worship Team'
    ];
    for (const g of groups) {
      await pool.query(
        `INSERT INTO groups (name) VALUES ($1) ON CONFLICT DO NOTHING`, [g]
      );
    }

    // STEP 4 — Seed villages
    const villages = [
      'Kiambu Village',
      'Thika Village',
      'Ruiru Village',
      'Limuru Village',
      'Gatundu Village'
    ];
    for (const v of villages) {
      await pool.query(
        `INSERT INTO villages (name) VALUES ($1) ON CONFLICT DO NOTHING`, [v]
      );
    }

    res.send(`
      <html><body style="font-family:Arial;padding:40px;background:#0d1b2a;color:#e8dcc8;">
      <h1 style="color:#d4af37;">⛪ CFMS Setup Complete!</h1>
      <p>✅ All tables created</p>
      <p>✅ User created — password: <b>admin123</b></p>
      <p>✅ Default groups created</p>
      <p>✅ Sample villages created</p>
      <br/>
      <p style="color:#f87171;"><b>⚠️ Important: Delete the /setup route from server.js now!</b></p>
      <a href="/" style="color:#d4af37;font-size:18px;">→ Go to CFMS Login</a>
      </body></html>
    `);

  } catch (err) {
    res.status(500).send('<pre>Setup Error: ' + err.message + '</pre>');
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
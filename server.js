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
app.use('/api/superadmin', require('./routes/superadmin'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── TEMPORARY SETUP ROUTE — DELETE AFTER FIRST USE ──
app.get('/setup', async (req, res) => {
  const pool = require('./db');
  const bcrypt = require('bcrypt');
  try {

    // STEP 1 — Drop all old tables and recreate cleanly
    await pool.query(`
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS sunday_collections CASCADE;
      DROP TABLE IF EXISTS member_groups CASCADE;
      DROP TABLE IF EXISTS members CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS groups CASCADE;
      DROP TABLE IF EXISTS villages CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS churches CASCADE;
    `);

    // STEP 2 — Create churches table
    await pool.query(`
      CREATE TABLE churches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(20) NOT NULL UNIQUE,
        location VARCHAR(150),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // STEP 3 — Create users table
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'secretary',
        church_id INTEGER REFERENCES churches(id),
        is_default_password BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // STEP 4 — Create villages
    await pool.query(`
      CREATE TABLE villages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        church_id INTEGER REFERENCES churches(id),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, church_id)
      );
    `);

    // STEP 5 — Create groups
    await pool.query(`
      CREATE TABLE groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        church_id INTEGER REFERENCES churches(id),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, church_id)
      );
    `);

    // STEP 6 — Create members
    await pool.query(`
      CREATE TABLE members (
        id SERIAL PRIMARY KEY,
        member_id VARCHAR(10) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(20),
        village_id INTEGER REFERENCES villages(id),
        church_id INTEGER REFERENCES churches(id),
        join_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        last_contribution_date DATE,
        manually_set_status BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(member_id, church_id)
      );
    `);

    // STEP 7 — Create member_groups
    await pool.query(`
      CREATE TABLE member_groups (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        group_id  INTEGER REFERENCES groups(id)  ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(member_id, group_id)
      );
    `);

    // STEP 8 — Create projects
    await pool.query(`
      CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        target_amount NUMERIC(12,2) DEFAULT 0,
        church_id INTEGER REFERENCES churches(id),
        start_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // STEP 9 — Create sunday_collections
    await pool.query(`
      CREATE TABLE sunday_collections (
        id SERIAL PRIMARY KEY,
        service_date DATE NOT NULL,
        offering_amount NUMERIC(12,2) DEFAULT 0,
        tithing_amount  NUMERIC(12,2) DEFAULT 0,
        notes TEXT,
        church_id INTEGER REFERENCES churches(id),
        recorded_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // STEP 10 — Create transactions
    await pool.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        receipt_no INTEGER NOT NULL,
        member_id INTEGER REFERENCES members(id),
        transaction_type VARCHAR(50) NOT NULL,
        category VARCHAR(100),
        amount NUMERIC(12,2) NOT NULL,
        project_id INTEGER REFERENCES projects(id),
        description TEXT,
        church_id INTEGER REFERENCES churches(id),
        transaction_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(receipt_no, church_id)
      );
    `);

    // STEP 11 — Create super admin
    const adminHash = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, password_hash, role, church_id, is_default_password)
      VALUES ('superadmin', $1, 'superadmin', NULL, TRUE)
    `, [adminHash]);

    // STEP 12 — Create sample church
    const churchRes = await pool.query(`
      INSERT INTO churches (name, code, location)
      VALUES ('My Church', 'CHURCH001', 'Nairobi')
      RETURNING id
    `);
    const churchId = churchRes.rows[0].id;

    // STEP 13 — Create finance secretary for sample church
    const secHash = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, password_hash, role, church_id, is_default_password)
      VALUES ('finance_secretary', $1, 'secretary', $2, TRUE)
    `, [secHash, churchId]);

    // STEP 14 — Seed default groups
    const groups = [
      'Youths Group', 'Women Fellowship', 'Men Fellowship',
      'Sunday School', 'Praise and Worship Team'
    ];
    for (const g of groups) {
      await pool.query(
        `INSERT INTO groups (name, church_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [g, churchId]
      );
    }

    // STEP 15 — Seed sample villages
    const villages = [
      'Kiambu Village', 'Thika Village', 'Ruiru Village',
      'Limuru Village', 'Gatundu Village'
    ];
    for (const v of villages) {
      await pool.query(
        `INSERT INTO villages (name, church_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [v, churchId]
      );
    }

    res.send(`
      <html><body style="font-family:Arial;padding:40px;background:#0d1b2a;color:#e8dcc8;">
      <h1 style="color:#d4af37;">⛪ CFMS Multi-Tenant Setup Complete!</h1>
      <p>✅ All tables created</p>
      <p>✅ Super Admin created</p>
      <p>✅ Sample church created</p>
      <p>✅ Finance Secretary created</p>
      <p>✅ Default groups created</p>
      <p>✅ Sample villages created</p>
      <br/>
      <div style="background:#1a3a5c;padding:20px;border-radius:10px;margin-bottom:20px;">
        <h2 style="color:#d4af37;">Login Details</h2>
        <p>🔑 <b>Super Admin:</b><br/>
        Church Code: <b style="color:#d4af37;">ADMIN</b><br/>
        Password: <b>admin123</b></p>
        <br/>
        <p>⛪ <b>Sample Church (Finance Secretary):</b><br/>
        Church Code: <b style="color:#d4af37;">CHURCH001</b><br/>
        Password: <b>admin123</b></p>
      </div>
      <p style="color:#f87171;"><b>⚠️ Delete the /setup route from server.js after this!</b></p>
      <a href="/" style="color:#d4af37;font-size:18px;">→ Go to CFMS Login</a>
      </body></html>
    `);

  } catch (err) {
    res.status(500).send('<pre style="color:red;">Setup Error: ' + err.message + '</pre>');
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
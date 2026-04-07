const pool = require('./db');

async function migrate() {
  try {
    console.log('⏳ Starting Multi-Tenancy Migration...');

    // 1. Create churches table
    console.log('  - Creating churches table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS churches (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Insert default church
    console.log('  - Inserting default church...');
    const res = await pool.query(`
      INSERT INTO churches (code, name) 
      VALUES ('DEFAULT', 'Default Church')
      ON CONFLICT (code) DO NOTHING
      RETURNING id;
    `);
    
    let defaultChurchId = 1; // Fallback
    const checkChurch = await pool.query(`SELECT id FROM churches WHERE code = 'DEFAULT'`);
    if (checkChurch.rows.length > 0) {
      defaultChurchId = checkChurch.rows[0].id;
    }

    // 3. Add church_id to users and update
    console.log('  - Adding church_id and role to users...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS church_id INTEGER REFERENCES churches(id) ON DELETE CASCADE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';
      UPDATE users SET church_id = ${defaultChurchId} WHERE church_id IS NULL;
    `);

    // Create a Super Admin account if not exists
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('superadmin123', 10);
    await pool.query(`
      INSERT INTO users (username, password_hash, role, is_default_password)
      VALUES ('superadmin', $1, 'superadmin', TRUE)
      ON CONFLICT DO NOTHING
    `, [hash]); // Note: username is unique? No, username wasn't unique in setup, but let's make sure. 
    // Actually username by itself is checked in login.

    // 4. Add church_id to other tables
    const tables = [
      'villages', 'groups', 'members', 'projects', 'sunday_collections', 'transactions'
    ];

    for (const table of tables) {
      console.log(`  - Migrating table: ${table}...`);
      await pool.query(`
        ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS church_id INTEGER REFERENCES churches(id) ON DELETE CASCADE;
        UPDATE ${table} SET church_id = ${defaultChurchId} WHERE church_id IS NULL;
      `);
      // Warning: Not making church_id NOT NULL yet to avoid issues if some are still null, but the above updates them all.
      await pool.query(`
        ALTER TABLE ${table} ALTER COLUMN church_id SET NOT NULL;
      `);
    }

    // 5. Update users to NOT NULL church_id EXCEPT superadmin (superadmin doesn't need a church_id, or they can have NULL)
    // Actually, let's leave users.church_id nullable to allow superadmins.

    console.log('✅ Migration COMPLETED successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration FAILED:', err.message);
    process.exit(1);
  }
}

migrate();

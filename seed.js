// seed.js — Insert the database with initial data
// It runs once node seed.js
//This script inserts records in the database.

//load environment variables from .env file
require('dotenv').config();

//import the database connection pool and bcrypt for password hashing
const pool   = require('./db');
const bcrypt = require('bcrypt');

//This is the main function that performs the seeding operations.
async function seed() {
  console.log(' Seeding CFMS database...\n');
  const client = await pool.connect();

  try {
    // start a database transaction to ensure all operations succeed or fail together
    await client.query('BEGIN');

    // ── 1.Create Finance Secretary user ────────────────────────
    const defaultPwd  = 'admin123'; // default password
    const passwordHash = await bcrypt.hash(defaultPwd, 10);

    // query to insert a new user with the default password 
    await client.query(`
      INSERT INTO users (username, password_hash, is_default_password)
      VALUES ('finance_secretary', $1, TRUE)
      ON CONFLICT DO NOTHING
    `, [passwordHash]);
    console.log('✅  User created  (password: admin123)');

    // ── 2. Default church groups ─────────────────────────
    // Array containing the church groups
    const defaultGroups = [
      { name: 'Youths Group',          description: 'Church youth fellowship' },
      { name: 'Women Fellowship',       description: 'Women church fellowship' },
      { name: 'Men Fellowship',         description: 'Men church fellowship' },
      { name: 'Sunday School',          description: 'Sunday school ministry' },
      { name: 'Praise and Worship Team',description: 'Music and worship ministry' },
    ];
       // loop each group and insert it
    for (const g of defaultGroups) {
      await client.query(
        'INSERT INTO groups (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [g.name, g.description]
      );
    }
    console.log('✅  Default groups created');

    // ── 3. Sample villages ───────────────
    const sampleVillages = [
      'Nkando Village',
      'Ngweti Village',
      'kia ngombe Village',
      'Gikumbo Village',
      'Kongoaceke Village',
    ];
    
    //insert each village into the database
    for (const v of sampleVillages) {
      await client.query(
        'INSERT INTO villages (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [v]
      );
    }
    console.log('✅  Sample villages created');

    await client.query('COMMIT');
    console.log('\n Database seeded successfully!');
    console.log('   Login with password: admin123');
    console.log('   You will be prompted to change it on first login.\n');

  } catch (err) {
    // if any error occurs undo all the changes
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}
//execute the function.
seed();

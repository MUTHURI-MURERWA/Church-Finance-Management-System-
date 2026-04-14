require('dotenv').config();
const pool = require('./db');

async function test() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects'");
  console.log(res.rows);
  pool.end();
}
test();

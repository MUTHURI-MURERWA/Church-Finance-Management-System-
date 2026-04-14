require('dotenv').config();
const pool = require('./db');

async function check() {
  const res = await pool.query("SELECT constraint_name, constraint_type, table_name FROM information_schema.table_constraints WHERE table_name = 'member_groups'");
  console.log(res.rows);
  
  const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'member_groups'");
  console.log(res2.rows);
  
  pool.end();
}
check();

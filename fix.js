const pool = require('./db');
(async () => {
try {
  await pool.query("UPDATE users SET church_id = 1, role = 'admin' WHERE username != 'superadmin'");
  await pool.query("UPDATE users SET role = 'superadmin' WHERE username = 'superadmin'");
  console.log('Fixed users');
} catch(e) { console.error(e) }
finally { process.exit(0); }
})();

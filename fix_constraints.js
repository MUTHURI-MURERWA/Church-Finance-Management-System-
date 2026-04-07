const pool = require('./db');

(async () => {
try {
  console.log('Fixing unique constraints for multi-tenant...');
  
  // For villages
  await pool.query('ALTER TABLE villages DROP CONSTRAINT IF EXISTS villages_name_key');
  await pool.query('ALTER TABLE villages ADD CONSTRAINT villages_name_church_id_key UNIQUE (name, church_id)');
  
  // For groups
  await pool.query('ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_key');
  await pool.query('ALTER TABLE groups ADD CONSTRAINT groups_name_church_id_key UNIQUE (name, church_id)');

  // For members ID (member_id was unique string per church)
  await pool.query('ALTER TABLE members DROP CONSTRAINT IF EXISTS members_member_id_key');
  await pool.query('ALTER TABLE members ADD CONSTRAINT members_member_id_church_id_key UNIQUE (member_id, church_id)');

  // For users username (we added it without unique, but let's make username unique per church_id if church_id is not null)
  await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key');
  // Partial index or just per church
  // Not strictly needed in DB if code handles it, but good to have
  
  // transactions receipt_no
  await pool.query('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_receipt_no_key');
  await pool.query('ALTER TABLE transactions ADD CONSTRAINT transactions_receipt_no_church_id_key UNIQUE (receipt_no, church_id)');

  console.log('Fixed constraints!');
} catch(e) {
  console.error(e)
} finally {
  process.exit(0);
}
})();

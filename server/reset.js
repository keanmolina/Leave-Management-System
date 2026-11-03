const db = require('./config/db');
const bcrypt = require('bcryptjs');

async function reset() {
  const hash = await bcrypt.hash('password123', 10);
  await db.query('UPDATE users SET password_hash = ?', [hash]);
  console.log('Successfully reset all user passwords to: password123');
  process.exit();
}

reset();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const hash = await bcrypt.hash('admin123', 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2',
      [hash, 'admin']
    );
    console.log('✓ Admin password updated:', hash);
    console.log('Login with: admin / admin123');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    pool.end();
  }
})();

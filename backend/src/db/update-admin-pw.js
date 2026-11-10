// ─────────────────────────────────────────────────────────────
//  update-admin-pw.js — Restablece la contraseña de un usuario
//
//  Uso (dentro del contenedor):
//    NEW_PASSWORD='...' node src/db/update-admin-pw.js [username]
//
//  Antes reseteaba siempre a 'admin123' e imprimía el hash.
//  Ahora exige la contraseña nueva por variable de entorno y
//  cierra las sesiones abiertas del usuario.
// ─────────────────────────────────────────────────────────────

'use strict';

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const username = (process.argv[2] || 'admin').toLowerCase().trim();
const password = process.env.NEW_PASSWORD || '';

if (password.length < 8 || password === 'admin123') {
  console.error('Define NEW_PASSWORD con al menos 8 caracteres (y distinta de admin123).');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id',
      [hash, username]
    );
    if (!rows[0]) {
      console.error(`Usuario no encontrado: ${username}`);
      process.exitCode = 1;
      return;
    }
    await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [rows[0].id]);
    console.log(`✓ Contraseña actualizada para ${username}. Sesiones anteriores cerradas.`);
  } catch (e) {
    console.error('Error:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

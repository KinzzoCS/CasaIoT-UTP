// ─────────────────────────────────────────────────────────────
//  db/create-admin.js — Crea el primer usuario admin
//
//  Uso:
//   node src/db/create-admin.js (lee env vars)
//   ADMIN_USERNAME=admin ADMIN_PASSWORD=... node src/db/create-admin.js
// ─────────────────────────────────────────────────────────────

'use strict';

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ ERROR: DATABASE_URL no está configurada');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function createAdmin(username, password) {
  const client = await pool.connect();
  try {
    // Verificar si ya existe
    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase().trim()]
    );

    if (existing.length > 0) {
      console.log(`⚠ Usuario '${username}' ya existe`);
      return existing[0].id;
    }

    // Hash la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Insertar admin
    const { rows } = await client.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ($1, $2, 'admin', TRUE)
      RETURNING id, username, role, created_at
    `, [username.toLowerCase().trim(), passwordHash]);

    console.log(`✓ Usuario admin creado exitosamente:`);
    console.log(`  ID: ${rows[0].id}`);
    console.log(`  Username: ${rows[0].username}`);
    console.log(`  Role: ${rows[0].role}`);
    console.log(`  Created: ${rows[0].created_at}`);

    return rows[0].id;
  } catch (err) {
    console.error('✗ Error creando admin:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('✗ ERROR: ADMIN_PASSWORD env var no está configurada');
    console.error('Uso: ADMIN_PASSWORD=tu_contraseña node src/db/create-admin.js');
    process.exit(1);
  }

  try {
    await createAdmin(username, password);
    console.log('\n✓ Admin listo para usar en CasaIoT');
  } catch (err) {
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

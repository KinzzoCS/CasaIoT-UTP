// ─────────────────────────────────────────────────────────────
//  migrate.js — Runner de migraciones SQL
//
//  Sistema simple de migraciones sin dependencias externas.
//  Lee archivos .sql de migrations/ en orden numérico y los
//  aplica una sola vez, registrando cuáles ya se ejecutaron.
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
} catch (e) {
  // Ignorar si no está instalado, Docker inyecta las variables
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    // Crear tabla de control de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id        SERIAL PRIMARY KEY,
        filename  VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Leer archivos de migración ordenados
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      // Verificar si ya fue aplicada
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE filename = $1',
        [file]
      );

      if (rows.length > 0) {
        console.log(`[SKIP] ${file} (ya aplicada)`);
        continue;
      }

      // Aplicar migración dentro de una transacción
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[APPLY] ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[OK] ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[ERROR] ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log('\nMigraciones completadas.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Error crítico en migraciones:', err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────
//  database.js — Conexión PostgreSQL con pool
//
//  Usamos el cliente `pg` directamente en lugar de un ORM.
//  Razón: menos abstracción = más control, SQL legible,
//  sin magia oculta, migraciones explícitas.
//  Pool de conexiones reutilizables para eficiencia.
// ─────────────────────────────────────────────────────────────

'use strict';

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

// Pool global — una sola instancia compartida por todo el proceso
const pool = new Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax,
  // Timeout para obtener conexión del pool
  connectionTimeoutMillis: 10000,
  // Timeout para queries idle (liberar conexiones inactivas)
  idleTimeoutMillis: 30000,
  // SSL requerido si la URL lo especifica
  ssl: config.db.url.includes('sslmode=require')
    ? { rejectUnauthorized: true }
    : false,
});

// Loguear errores del pool (conexiones perdidas, etc.)
pool.on('error', (err) => {
  logger.error('Error inesperado en pool de PostgreSQL', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('Nueva conexión establecida con PostgreSQL');
});

/**
 * Ejecuta una query SQL con parámetros.
 * Siempre usar parámetros ($1, $2...) para prevenir SQL injection.
 *
 * @param {string} text - Query SQL
 * @param {Array} params - Parámetros de la query
 * @returns {Promise<pg.QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query ejecutada', { query: text.substring(0, 80), duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Error en query PostgreSQL', { query: text.substring(0, 80), error: err.message });
    throw err;
  }
}

/**
 * Obtiene una conexión del pool para transacciones.
 * Siempre usar dentro de try/finally para liberar la conexión.
 *
 * Ejemplo:
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     await client.query('INSERT ...');
 *     await client.query('COMMIT');
 *   } catch (e) {
 *     await client.query('ROLLBACK');
 *   } finally {
 *     client.release();
 *   }
 */
async function getClient() {
  return pool.connect();
}

/**
 * Verifica la conexión a la base de datos.
 * Usado en el health check del servidor.
 */
async function healthCheck() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

module.exports = { query, getClient, healthCheck, pool };

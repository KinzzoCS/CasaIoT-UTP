// ─────────────────────────────────────────────────────────────
//  api/setup.js — Endpoint de setup inicial (sin auth)
//
//  POST /api/setup/create-admin — Crea el primer usuario admin
//  GET  /api/setup/status       — Estado del setup (público)
//  Solo disponible si no hay usuarios en la BD
// ─────────────────────────────────────────────────────────────

'use strict';

const bcrypt = require('bcrypt');
const { query } = require('../db/database');
const logger = require('../utils/logger');
const config = require('../config');
const { createRouter } = require('../utils/asyncRouter');
const { authLimiter } = require('../middleware/rateLimiter');
const { isValidUsername, isStrongPassword } = require('../utils/validation');

const router = createRouter();

// POST /api/setup/create-admin — Crear primer usuario admin
router.post('/create-admin', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: 'Username inválido: 3-50 caracteres, solo alfanuméricos, guiones y guiones bajos',
    });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Contraseña débil: mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial',
    });
  }

  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

  // INSERT condicional atómico: evita que dos peticiones simultáneas
  // creen dos administradores (antes era SELECT COUNT + INSERT).
  const { rows } = await query(`
    INSERT INTO users (username, password_hash, role, is_active)
    SELECT $1, $2, 'admin', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM users)
    RETURNING id, username, role, created_at
  `, [username.toLowerCase().trim(), passwordHash]);

  if (!rows[0]) {
    return res.status(409).json({ error: 'Usuario admin ya existe. Setup completado.' });
  }

  logger.info('Setup completado: Admin creado', { userId: rows[0].id, username: rows[0].username });

  res.status(201).json({
    message: 'Usuario admin creado. Puedes iniciar sesión ahora.',
    user: rows[0],
  });
});

// GET /api/setup/status — Ver si setup está completado y si hay registro público
router.get('/status', async (req, res) => {
  const { rows } = await query('SELECT EXISTS (SELECT 1 FROM users) AS completed');
  res.json({
    setupCompleted: rows[0].completed,
    registrationEnabled: config.security.allowRegistration,
  });
});

module.exports = router;

// ─────────────────────────────────────────────────────────────
//  api/setup.js — Endpoint de setup inicial (sin auth)
//
//  POST /api/setup/create-admin — Crea el primer usuario admin
//  Solo disponible si no hay usuarios en la BD
// ─────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../db/database');
const logger = require('../utils/logger');
const { isValidUsername, isStrongPassword } = require('../utils/validation');
const config = require('../config');

const router = express.Router();

// POST /api/setup/create-admin — Crear primer usuario admin
router.post('/create-admin', async (req, res) => {
  try {
    // Verificar si ya hay usuarios (setup ya completado)
    const { rows: users } = await query('SELECT COUNT(*) as total FROM users');
    if (parseInt(users[0].total, 10) > 0) {
      return res.status(409).json({ error: 'Usuario admin ya existe. Setup completado.' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username y password son requeridos' });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: 'Username inválido: 3-50 caracteres, solo alpanuméricos, guiones y guiones bajos',
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Contraseña débil: mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial',
      });
    }

    // Crear admin
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    const { rows } = await query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ($1, $2, 'admin', TRUE)
      RETURNING id, username, role, created_at
    `, [username.toLowerCase().trim(), passwordHash]);

    logger.info('Setup completado: Admin creado', { userId: rows[0].id, username: rows[0].username });

    res.status(201).json({
      message: 'Usuario admin creado. Puedes iniciar sesión ahora.',
      user: rows[0],
    });
  } catch (err) {
    logger.error('Error en setup', { error: err.message });
    res.status(500).json({ error: 'Error al crear admin' });
  }
});

// GET /api/setup/status — Ver si setup está completado
router.get('/status', async (req, res) => {
  try {
    const { rows } = await query('SELECT COUNT(*) as total FROM users');
    const completed = parseInt(rows[0].total, 10) > 0;
    res.json({ setupCompleted: completed, userCount: parseInt(rows[0].total, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar setup' });
  }
});

module.exports = router;

// ─────────────────────────────────────────────────────────────
//  api/auth.js — Endpoints de autenticación
//
//  POST /api/auth/login      → Devuelve JWT + refresh token
//  POST /api/auth/refresh    → Renueva JWT usando refresh token
//  POST /api/auth/logout     → Revoca refresh token
//  GET  /api/auth/me         → Info del usuario actual
// ─────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db/database');
const config = require('../config');
const logger = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── POST /api/auth/register ───────────────────────────────────
// Crea un usuario. Si es el primer usuario del sistema, se asigna rol 'admin'.
router.post('/register', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son requeridos' });
  }

  const usernameClean = username.toLowerCase().trim();
  if (usernameClean.length < 3) {
    return res.status(400).json({ error: 'El username debe tener al menos 3 caracteres' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    // Verificar si ya existe el usuario
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE username = $1',
      [usernameClean]
    );
    if (existing[0]) {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }

    // El primer usuario del sistema se convierte en admin automáticamente
    const { rows: count } = await query('SELECT COUNT(*) as total FROM users');
    const role = parseInt(count[0].total, 10) === 0 ? 'admin' : 'user';

    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, created_at`,
      [usernameClean, passwordHash, role]
    );

    logger.info('Usuario registrado', { userId: rows[0].id, username: usernameClean, role });

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: rows[0],
    });
  } catch (err) {
    logger.error('Error en registro', { error: err.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son requeridos' });
  }

  try {
    // Buscar usuario activo
    const { rows } = await query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1 AND is_active = TRUE',
      [username.toLowerCase().trim()]
    );

    const user = rows[0];

    // Comparar contraseña — siempre comparamos (previene timing attacks)
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, '$2b$12$invalidhashtopreventtiming');

    if (!user || !passwordMatch) {
      logger.warn('Intento de login fallido', { username, ip: req.ip });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Actualizar last_login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generar access token (15 min)
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    // Generar refresh token (7 días, guardado hasheado en DB)
    const refreshTokenRaw = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshTokenHash, refreshExpiry]
    );

    logger.info('Login exitoso', { userId: user.id, username: user.username });

    res.json({
      accessToken,
      refreshToken: refreshTokenRaw,
      expiresIn: 15 * 60, // segundos
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    logger.error('Error en login', { error: err.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken es requerido' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Buscar refresh token válido y no revocado
    const { rows } = await query(`
      SELECT rt.id, rt.user_id, u.username, u.role
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1
        AND rt.revoked = FALSE
        AND rt.expires_at > NOW()
        AND u.is_active = TRUE
    `, [tokenHash]);

    if (!rows[0]) {
      return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }

    const { user_id: userId, username, role } = rows[0];

    // Emitir nuevo access token
    const accessToken = jwt.sign(
      { userId, username, role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    res.json({ accessToken, expiresIn: 15 * 60 });
  } catch (err) {
    logger.error('Error en refresh', { error: err.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1',
      [tokenHash]
    );
  }

  logger.info('Logout', { userId: req.user.userId });
  res.json({ message: 'Sesión cerrada exitosamente' });
});

// ── PATCH /api/auth/password ──────────────────────────────────
router.patch('/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword y newPassword son requeridos' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const { rows } = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    const newHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.userId]);

    logger.info('Contraseña actualizada', { userId: req.user.userId });
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    logger.error('Error actualizando contraseña', { error: err.message });
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  const { rows } = await query(
    'SELECT id, username, role, email, last_login, created_at FROM users WHERE id = $1',
    [req.user.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

module.exports = router;

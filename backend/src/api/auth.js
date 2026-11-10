// ─────────────────────────────────────────────────────────────
//  api/auth.js — Endpoints de autenticación
//
//  POST  /api/auth/register  → Crea usuario (solo si ALLOW_REGISTRATION=true)
//  POST  /api/auth/login     → Devuelve JWT + refresh token
//  POST  /api/auth/refresh   → Rota el refresh token y emite nuevo JWT
//  POST  /api/auth/logout    → Revoca refresh token
//  PATCH /api/auth/password  → Cambia contraseña y revoca otras sesiones
//  GET   /api/auth/me        → Info del usuario actual
// ─────────────────────────────────────────────────────────────

'use strict';

const bcrypt = require('bcrypt');
const { query } = require('../db/database');
const config = require('../config');
const logger = require('../utils/logger');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { isValidUsername, isAcceptablePassword, isString } = require('../utils/validation');
const { hashToken, issueSession, revokeAllSessions } = require('../services/sessions');

const router = createRouter();

// Hash real calculado una vez: comparar contra un hash malformado
// devolvía al instante y revelaba si el usuario existía (timing attack).
const DUMMY_HASH = bcrypt.hashSync('casaiot-dummy-password', config.security.bcryptRounds);

const PASSWORD_RULE = 'La contraseña debe tener entre 8 y 128 caracteres';

// ── POST /api/auth/register ───────────────────────────────────
// Registro público deshabilitado por defecto: con los roles relajados,
// cualquier persona en la red podía crearse una cuenta y controlar la casa.
router.post('/register', authLimiter, async (req, res) => {
  if (!config.security.allowRegistration) {
    return res.status(403).json({ error: 'El registro público está deshabilitado. Pide a un administrador que cree tu cuenta.' });
  }

  const { username, password } = req.body;
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Username inválido: 3-50 caracteres, solo letras, números, guiones y guiones bajos' });
  }
  if (!isAcceptablePassword(password)) {
    return res.status(400).json({ error: PASSWORD_RULE });
  }

  const usernameClean = username.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

  try {
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'user')
       RETURNING id, username, role, created_at`,
      [usernameClean, passwordHash]
    );
    logger.info('Usuario registrado', { userId: rows[0].id, username: usernameClean });
    res.status(201).json({ message: 'Usuario creado exitosamente', user: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    throw err;
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!isString(username) || !isString(password) || !username || !password) {
    return res.status(400).json({ error: 'username y password son requeridos' });
  }

  const usernameClean = username.toLowerCase().trim().slice(0, 50);
  const { rows } = await query(
    'SELECT id, username, password_hash, role FROM users WHERE username = $1 AND is_active = TRUE',
    [usernameClean]
  );
  const user = rows[0];

  // Comparar siempre contra un hash real (tiempo constante exista o no el usuario)
  const passwordMatch = await bcrypt.compare(password.slice(0, 128), user ? user.password_hash : DUMMY_HASH);

  if (!user || !passwordMatch) {
    logger.warn('Intento de login fallido', { username: usernameClean, ip: req.ip });
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
  const session = await issueSession(user);

  logger.info('Login exitoso', { userId: user.id, username: user.username });
  res.json({
    ...session,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// ── POST /api/auth/refresh ────────────────────────────────────
// Rotación: el refresh token usado se revoca y se entrega uno nuevo.
// El UPDATE ... RETURNING es atómico: dos usos simultáneos del mismo
// token no pueden ganar ambos.
router.post('/refresh', authLimiter, async (req, res) => {
  const { refreshToken } = req.body;
  if (!isString(refreshToken) || refreshToken.length === 0 || refreshToken.length > 256) {
    return res.status(400).json({ error: 'refreshToken es requerido' });
  }

  const { rows } = await query(`
    UPDATE refresh_tokens rt
    SET revoked = TRUE
    FROM users u
    WHERE rt.token_hash = $1
      AND rt.revoked = FALSE
      AND rt.expires_at > NOW()
      AND u.id = rt.user_id
      AND u.is_active = TRUE
    RETURNING u.id, u.username, u.role
  `, [hashToken(refreshToken)]);

  if (!rows[0]) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }

  const session = await issueSession(rows[0]);
  res.json(session);
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  if (isString(refreshToken) && refreshToken.length <= 256) {
    await query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1 AND user_id = $2',
      [hashToken(refreshToken), req.user.userId]
    );
  }

  logger.info('Logout', { userId: req.user.userId });
  res.json({ message: 'Sesión cerrada exitosamente' });
});

// ── PATCH /api/auth/password ──────────────────────────────────
// Revoca todas las sesiones (incluidas las de otros dispositivos) y
// devuelve una sesión nueva para el dispositivo actual.
router.patch('/password', authMiddleware, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!isString(currentPassword) || !currentPassword) {
    return res.status(400).json({ error: 'currentPassword es requerido' });
  }
  if (!isAcceptablePassword(newPassword)) {
    return res.status(400).json({ error: PASSWORD_RULE });
  }

  const { rows } = await query(
    'SELECT id, username, role, password_hash FROM users WHERE id = $1 AND is_active = TRUE',
    [req.user.userId]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const match = await bcrypt.compare(currentPassword.slice(0, 128), user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }

  const newHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
  await revokeAllSessions(user.id);
  const session = await issueSession(user);

  logger.info('Contraseña actualizada', { userId: user.id });
  res.json({ message: 'Contraseña actualizada exitosamente', ...session });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  const { rows } = await query(
    'SELECT id, username, role, email, last_login, created_at FROM users WHERE id = $1 AND is_active = TRUE',
    [req.user.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

module.exports = router;

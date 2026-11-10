// ─────────────────────────────────────────────────────────────
//  api/admin.js — Gestión de usuarios (solo admin)
//
//  GET    /api/admin/users
//  POST   /api/admin/users
//  PATCH  /api/admin/users/:id   (role, is_active, username)
//  DELETE /api/admin/users/:id
// ─────────────────────────────────────────────────────────────

'use strict';

const bcrypt = require('bcrypt');
const { query } = require('../db/database');
const logger = require('../utils/logger');
const config = require('../config');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { isValidUsername, isAcceptablePassword, toPositiveInt } = require('../utils/validation');
const { revokeAllSessions } = require('../services/sessions');

const router = createRouter();

router.use(authMiddleware);
router.use(requireAdmin);

const ROLES = ['admin', 'user', 'readonly'];

router.param('id', (req, res, next, id) => {
  const n = toPositiveInt(id);
  if (!n) return res.status(400).json({ error: 'ID inválido' });
  if (n === req.user.userId) {
    return res.status(400).json({ error: 'No puedes modificar ni eliminar tu propia cuenta desde aquí' });
  }
  req.targetUserId = n;
  next();
});

router.get('/users', async (req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.username, u.role, u.is_active, u.last_login, u.created_at,
      (SELECT COUNT(*) FROM refresh_tokens rt
        WHERE rt.user_id = u.id AND rt.revoked = FALSE AND rt.expires_at > NOW()) AS active_sessions,
      (SELECT COUNT(*) FROM api_tokens t WHERE t.user_id = u.id) AS api_tokens
    FROM users u
    ORDER BY u.created_at DESC
  `);
  res.json(rows);
});

router.post('/users', async (req, res) => {
  const { username, password, role } = req.body;

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Username inválido: 3-50 caracteres, solo letras, números, guiones y guiones bajos' });
  }
  if (!isAcceptablePassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres' });
  }
  const userRole = ROLES.includes(role) ? role : 'user';
  const usernameClean = username.toLowerCase().trim();

  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
  try {
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, is_active, created_at`,
      [usernameClean, passwordHash, userRole]
    );

    logger.info('Usuario creado por admin', {
      userId: rows[0].id,
      username: usernameClean,
      createdBy: req.user.userId,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    throw err;
  }
});

router.patch('/users/:id', async (req, res) => {
  const { role, is_active, username } = req.body;
  const setClauses = [];
  const values = [];

  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: `role debe ser uno de: ${ROLES.join(', ')}` });
    values.push(role);
    setClauses.push(`role = $${values.length}`);
  }
  if (is_active !== undefined) {
    if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active debe ser booleano' });
    values.push(is_active);
    setClauses.push(`is_active = $${values.length}`);
  }
  if (username !== undefined) {
    if (!isValidUsername(username)) return res.status(400).json({ error: 'Username inválido' });
    values.push(username.toLowerCase().trim());
    setClauses.push(`username = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  values.push(req.targetUserId);

  let rows;
  try {
    ({ rows } = await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length}
       RETURNING id, username, role, is_active, last_login, created_at`,
      values
    ));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    throw err;
  }

  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Cambiar rol o desactivar: cerrar sesiones para que el cambio aplique ya
  // (el access token vigente expira en ≤15 min y no se puede renovar).
  if (role !== undefined || is_active === false) {
    await revokeAllSessions(req.targetUserId);
  }

  logger.info('Usuario actualizado por admin', {
    targetUserId: req.targetUserId,
    fields: Object.keys(req.body).filter(k => ['role', 'is_active', 'username'].includes(k)),
    updatedBy: req.user.userId,
  });

  res.json(rows[0]);
});

router.delete('/users/:id', async (req, res) => {
  const { rows } = await query(
    'DELETE FROM users WHERE id = $1 RETURNING id, username, role',
    [req.targetUserId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

  logger.info('Usuario eliminado por admin', {
    deletedUser: rows[0].username,
    deletedById: req.user.userId,
  });

  res.json({ message: `Usuario ${rows[0].username} eliminado` });
});

module.exports = router;

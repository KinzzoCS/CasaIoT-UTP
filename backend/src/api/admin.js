'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../db/database');
const logger = require('../utils/logger');
const config = require('../config');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/users', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.username, u.role, u.is_active, u.last_login, u.created_at,
        (SELECT COUNT(*) FROM refresh_tokens rt WHERE rt.user_id = u.id AND rt.revoked = FALSE) AS active_sessions,
        (SELECT COUNT(*) FROM api_tokens t WHERE t.user_id = u.id) AS api_tokens
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    logger.error('Error listando usuarios', { error: err.message });
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/users', async (req, res) => {
  const { username, password, role } = req.body;

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

  const userRole = (role === 'admin') ? 'admin' : 'user';

  try {
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE username = $1',
      [usernameClean]
    );
    if (existing[0]) {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }

    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
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
    logger.error('Error creando usuario', { error: err.message });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.patch('/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido' });

  if (userId === req.user.userId) {
    return res.status(400).json({ error: 'No puedes modificarte a ti mismo desde aquí' });
  }

  const allowed = ['role', 'is_active', 'username'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  try {
    const setClauses = [];
    const values = [];
    let idx = 1;

    if (updates.role !== undefined) {
      setClauses.push(`role = $${idx++}`);
      values.push(updates.role === 'admin' ? 'admin' : 'user');
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${idx++}`);
      values.push(updates.is_active);
    }
    if (updates.username !== undefined) {
      setClauses.push(`username = $${idx++}`);
      values.push(updates.username.toLowerCase().trim());
    }

    values.push(userId);

    const { rows } = await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, username, role, is_active, last_login, created_at`,
      values
    );

    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    logger.info('Usuario actualizado por admin', {
      targetUserId: userId,
      updates,
      updatedBy: req.user.userId,
    });

    res.json(rows[0]);
  } catch (err) {
    logger.error('Error actualizando usuario', { error: err.message });
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido' });

  if (userId === req.user.userId) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }

  try {
    const { rows } = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username, role',
      [userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    logger.info('Usuario eliminado por admin', {
      deletedUser: rows[0].username,
      deletedById: req.user.userId,
    });

    res.json({ message: `Usuario ${rows[0].username} eliminado` });
  } catch (err) {
    logger.error('Error eliminando usuario', { error: err.message });
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;

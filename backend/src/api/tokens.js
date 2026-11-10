'use strict';

const express = require('express');
const crypto = require('crypto');
const { query } = require('../db/database');
const logger = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, name, last_used, expires_at, created_at
      FROM api_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    logger.error('Error listando tokens', { error: err.message });
    res.status(500).json({ error: 'Error al obtener tokens' });
  }
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre del token es requerido' });
  }

  try {
    const rawToken = `casaiot_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { rows } = await query(`
      INSERT INTO api_tokens (user_id, token_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, name, created_at
    `, [req.user.userId, tokenHash, name.trim()]);

    logger.info('Token API creado', {
      tokenId: rows[0].id,
      userId: req.user.userId,
    });

    res.status(201).json({
      ...rows[0],
      token: rawToken,
    });
  } catch (err) {
    logger.error('Error creando token', { error: err.message });
    res.status(500).json({ error: 'Error al crear token' });
  }
});

router.delete('/:id', async (req, res) => {
  const tokenId = parseInt(req.params.id, 10);
  if (isNaN(tokenId)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await query(
      'DELETE FROM api_tokens WHERE id = $1 AND user_id = $2 RETURNING id',
      [tokenId, req.user.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Token no encontrado' });

    logger.info('Token API revocado', { tokenId, userId: req.user.userId });
    res.json({ message: 'Token revocado' });
  } catch (err) {
    logger.error('Error eliminando token', { error: err.message });
    res.status(500).json({ error: 'Error al revocar token' });
  }
});

module.exports = router;

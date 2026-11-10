'use strict';

const express = require('express');
const { query } = require('../db/database');
const logger = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

const ALLOWED_KEYS = ['wifi_ssid', 'wifi_password', 'mqtt_broker_ip', 'timezone', 'location'];

// GET /api/config — devuelve solo las claves de red
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT key, value FROM system_config WHERE key = ANY($1)',
      [ALLOWED_KEYS]
    );
    const result = {};
    rows.forEach(r => { result[r.key] = r.value; });
    res.json(result);
  } catch (err) {
    logger.error('Error leyendo config', { error: err.message });
    res.status(500).json({ error: 'Error al leer configuración' });
  }
});

// PATCH /api/config — actualiza claves de red
router.patch('/', async (req, res) => {
  const updates = req.body;
  const keys = Object.keys(updates);

  const invalid = keys.filter(k => !ALLOWED_KEYS.includes(k));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Claves inválidas: ${invalid.join(', ')}` });
  }

  try {
    for (const key of keys) {
      await query(
        `INSERT INTO system_config (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
        [key, JSON.stringify(updates[key])]
      );
    }
    logger.info('Config actualizada', { keys, userId: req.user.userId });

    const { rows } = await query(
      'SELECT key, value FROM system_config WHERE key = ANY($1)',
      [ALLOWED_KEYS]
    );
    const result = {};
    rows.forEach(r => { result[r.key] = r.value; });
    res.json(result);
  } catch (err) {
    logger.error('Error actualizando config', { error: err.message });
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

module.exports = router;

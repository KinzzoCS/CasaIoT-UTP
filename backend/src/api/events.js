// ─────────────────────────────────────────────────────────────
//  api/events.js — Historial de eventos del sistema
//
//  GET /api/events              → Lista paginada de eventos
//  GET /api/events/recent       → Últimos N eventos (para dashboard)
// ─────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/events ───────────────────────────────────────────
router.get('/', async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit    = Math.min(100, parseInt(req.query.limit || '50', 10));
  const offset   = (page - 1) * limit;
  const deviceId = req.query.deviceId;
  const type     = req.query.type;

  try {
    const conditions = ['1=1'];
    const params = [];

    if (deviceId) {
      params.push(deviceId);
      conditions.push(`e.device_id = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`e.event_type = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const { rows } = await query(`
      SELECT
        e.id, e.event_type, e.payload, e.created_at,
        d.name AS device_name, d.type AS device_type, d.location
      FROM events e
      LEFT JOIN devices d ON d.id = e.device_id
      WHERE ${where}
      ORDER BY e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// ── GET /api/events/recent ────────────────────────────────────
router.get('/recent', async (req, res) => {
  const limit = Math.min(20, parseInt(req.query.limit || '10', 10));

  try {
    const { rows } = await query(`
      SELECT
        e.id, e.event_type, e.payload, e.created_at,
        d.name AS device_name, d.location
      FROM events e
      LEFT JOIN devices d ON d.id = e.device_id
      ORDER BY e.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener eventos recientes' });
  }
});

module.exports = router;

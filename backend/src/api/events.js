// ─────────────────────────────────────────────────────────────
//  api/events.js — Historial de eventos del sistema
//
//  GET /api/events              → Lista paginada de eventos
//  GET /api/events/recent       → Últimos N eventos (para dashboard)
// ─────────────────────────────────────────────────────────────

'use strict';

const { query } = require('../db/database');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware } = require('../middleware/auth');
const { isValidUUID, clampInt } = require('../utils/validation');

const router = createRouter();
router.use(authMiddleware);

// ── GET /api/events ───────────────────────────────────────────
router.get('/', async (req, res) => {
  const page   = clampInt(req.query.page, 1, 100000, 1);
  const limit  = clampInt(req.query.limit, 1, 100, 50);
  const offset = (page - 1) * limit;
  const { deviceId, type } = req.query;

  const conditions = ['1=1'];
  const params = [];

  if (deviceId !== undefined) {
    if (!isValidUUID(deviceId)) return res.status(400).json({ error: 'deviceId inválido' });
    params.push(deviceId);
    conditions.push(`e.device_id = $${params.length}`);
  }
  if (type !== undefined) {
    if (typeof type !== 'string' || type.length > 50) return res.status(400).json({ error: 'type inválido' });
    params.push(type);
    conditions.push(`e.event_type = $${params.length}`);
  }

  params.push(limit, offset);

  const { rows } = await query(`
    SELECT
      e.id, e.event_type, e.payload, e.created_at,
      d.name AS device_name, d.type AS device_type, d.location
    FROM events e
    LEFT JOIN devices d ON d.id = e.device_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  res.json({ data: rows, page, limit });
});

// ── GET /api/events/recent ────────────────────────────────────
router.get('/recent', async (req, res) => {
  const limit = clampInt(req.query.limit, 1, 50, 10);

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
});

module.exports = router;

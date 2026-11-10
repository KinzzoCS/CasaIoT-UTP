// ─────────────────────────────────────────────────────────────
//  api/schedules.js — Automatizaciones (cron)
//
//  NOTA: el CRUD guarda las automatizaciones, pero todavía NO existe
//  un ejecutor que las dispare (ver MEMORY.md → deuda técnica).
// ─────────────────────────────────────────────────────────────

'use strict';

const cron = require('node-cron');
const { query } = require('../db/database');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware, requireWriter } = require('../middleware/auth');
const { isValidUUID, isOptionalString, isPlainObject, toPositiveInt } = require('../utils/validation');

const router = createRouter();
router.use(authMiddleware);

router.param('id', (req, res, next, id) => {
  const n = toPositiveInt(id);
  if (!n) return res.status(400).json({ error: 'ID inválido' });
  req.scheduleId = n;
  next();
});

// GET /api/schedules
router.get('/', async (req, res) => {
  const { rows } = await query(`
    SELECT s.*, d.name as device_name
    FROM schedules s
    JOIN devices d ON s.device_id = d.id
    ORDER BY s.created_at DESC
  `);
  res.json(rows);
});

// POST /api/schedules
router.post('/', requireWriter, async (req, res) => {
  const { device_id, name, cron_expression, action } = req.body;

  if (!isValidUUID(device_id)) return res.status(400).json({ error: 'device_id inválido' });
  if (!isOptionalString(name, 100)) return res.status(400).json({ error: 'name demasiado largo' });
  if (typeof cron_expression !== 'string' || cron_expression.length > 100 || !cron.validate(cron_expression)) {
    return res.status(400).json({ error: 'cron_expression inválida' });
  }
  if (!isPlainObject(action) || typeof action.action !== 'string') {
    return res.status(400).json({ error: 'action debe ser un objeto con { action, params? }' });
  }

  try {
    const { rows } = await query(`
      INSERT INTO schedules (device_id, name, cron_expression, action, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
    `, [device_id, name || null, cron_expression, JSON.stringify(action)]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'El dispositivo indicado no existe' });
    throw err;
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', requireWriter, async (req, res) => {
  const { rowCount } = await query('DELETE FROM schedules WHERE id = $1', [req.scheduleId]);
  if (rowCount === 0) return res.status(404).json({ error: 'Horario no encontrado' });
  res.status(204).send();
});

// PATCH /api/schedules/:id/toggle
router.patch('/:id/toggle', requireWriter, async (req, res) => {
  const { rows } = await query(
    'UPDATE schedules SET is_active = NOT is_active WHERE id = $1 RETURNING *',
    [req.scheduleId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Horario no encontrado' });
  res.json(rows[0]);
});

module.exports = router;

// ─────────────────────────────────────────────────────────────
//  api/reminders.js — Recordatorios (pagos, despensa, salud, ...)
//
//  GET    /api/reminders             → pendientes
//  POST   /api/reminders             → crear
//  PATCH  /api/reminders/:id/dismiss → marcar como hecho
//  DELETE /api/reminders/:id         → eliminar
//  GET    /api/reminders/learning    → patrones de los últimos meses
//
//  El esquema de las columnas extra vive en la migración 003.
// ─────────────────────────────────────────────────────────────

'use strict';

const { query } = require('../db/database');
const logger = require('../utils/logger');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware, requireWriter } = require('../middleware/auth');
const {
  isNonEmptyString, isOptionalString, isValidUUID, isValidDate, isPlainObject, toPositiveInt,
} = require('../utils/validation');

const router = createRouter();
router.use(authMiddleware);

router.param('id', (req, res, next, id) => {
  const n = toPositiveInt(id);
  if (!n) return res.status(400).json({ error: 'ID inválido' });
  req.reminderId = n;
  next();
});

// Deben coincidir con REPEAT_OPTIONS / CATEGORIES de CalendarPage.jsx
const REPEAT_TYPES = [
  'none', 'daily', 'weekly', 'every2weeks', 'monthly',
  'every2months', 'every3months', 'every4months', 'every6months', 'yearly',
];
const CATEGORY_RE = /^[a-záéíóúñü_]{1,50}$/;
const MAX_DETAILS_BYTES = 8 * 1024;

router.get('/', async (req, res) => {
  const { rows } = await query(`
    SELECT r.*, d.name as device_name
    FROM reminders r
    LEFT JOIN devices d ON r.device_id = d.id
    WHERE r.is_dismissed = FALSE
    ORDER BY r.due_date ASC
  `);
  res.json(rows);
});

router.post('/', requireWriter, async (req, res) => {
  const { title, description, category, amount, repeat_type, repeat_interval, device_id, due_date, details } = req.body;

  if (!isNonEmptyString(title, 200)) return res.status(400).json({ error: 'title es requerido (máx. 200 caracteres)' });
  if (!isValidDate(due_date)) return res.status(400).json({ error: 'due_date debe ser una fecha válida' });
  if (!isOptionalString(description, 2000)) return res.status(400).json({ error: 'description demasiado larga' });
  if (category !== undefined && !CATEGORY_RE.test(String(category))) {
    return res.status(400).json({ error: 'category inválida' });
  }
  if (amount !== undefined && amount !== null && amount !== '' && !(Number.isFinite(Number(amount)) && Math.abs(Number(amount)) < 1e10)) {
    return res.status(400).json({ error: 'amount debe ser numérico' });
  }
  if (repeat_type !== undefined && !REPEAT_TYPES.includes(repeat_type)) {
    return res.status(400).json({ error: `repeat_type debe ser uno de: ${REPEAT_TYPES.join(', ')}` });
  }
  const interval = repeat_interval === undefined || repeat_interval === null ? 1 : toPositiveInt(repeat_interval);
  if (!interval || interval > 365) return res.status(400).json({ error: 'repeat_interval inválido' });
  if (device_id && !isValidUUID(device_id)) return res.status(400).json({ error: 'device_id inválido' });
  if (details !== undefined && !isPlainObject(details)) return res.status(400).json({ error: 'details debe ser un objeto' });

  const detailsJson = JSON.stringify(details || {});
  if (Buffer.byteLength(detailsJson) > MAX_DETAILS_BYTES) {
    return res.status(400).json({ error: 'details demasiado grande' });
  }

  try {
    const { rows } = await query(`
      INSERT INTO reminders (title, description, reminder_type, category, amount, repeat_type, repeat_interval, device_id, due_date, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      title.trim(),
      description || '',
      category || 'general',
      category || 'general',
      amount === '' || amount === undefined || amount === null ? null : Number(amount),
      repeat_type || 'none',
      interval,
      device_id || null,
      due_date,
      detailsJson,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'El dispositivo indicado no existe' });
    throw err;
  }
});

router.patch('/:id/dismiss', requireWriter, async (req, res) => {
  const { rows } = await query(`
    UPDATE reminders SET is_dismissed = TRUE, completed_at = NOW() WHERE id = $1 RETURNING *
  `, [req.reminderId]);
  if (!rows[0]) return res.status(404).json({ error: 'Recordatorio no encontrado' });
  res.json(rows[0]);
});

router.delete('/:id', requireWriter, async (req, res) => {
  const { rowCount } = await query('DELETE FROM reminders WHERE id = $1', [req.reminderId]);
  if (rowCount === 0) return res.status(404).json({ error: 'Recordatorio no encontrado' });
  res.json({ ok: true });
});

router.get('/learning', async (req, res) => {
  try {
    const [patterns, totals, categoryAvg, upcoming] = await Promise.all([
      query(`
        WITH grouped AS (
          SELECT
            LOWER(TRIM(REGEXP_REPLACE(title, '[^a-záéíóúñ0-9 ]', '', 'g'))) AS norm_title,
            COUNT(*) AS count,
            MOD(EXTRACT(DAY FROM due_date)::int, 28) AS day_of_month,
            ARRAY_AGG(DISTINCT category) AS categories,
            AVG(amount) AS avg_amount,
            SUM(amount) AS total_amount
          FROM reminders
          WHERE is_dismissed = TRUE AND created_at >= NOW() - INTERVAL '1 year'
          GROUP BY norm_title, MOD(EXTRACT(DAY FROM due_date)::int, 28)
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC LIMIT 10
        ) SELECT * FROM grouped
      `),
      query(`
        SELECT category, COUNT(*) AS count, SUM(amount) AS total, AVG(amount) AS avg
        FROM reminders WHERE is_dismissed = TRUE AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY category ORDER BY total DESC NULLS LAST
      `),
      query(`
        SELECT
          details->>'subtype' AS subtype,
          COUNT(*) AS count,
          AVG(amount) AS avg_amount
        FROM reminders
        WHERE is_dismissed = TRUE AND created_at >= NOW() - INTERVAL '1 year'
          AND details->>'subtype' IS NOT NULL
        GROUP BY details->>'subtype'
        ORDER BY COUNT(*) DESC LIMIT 10
      `),
      query(`
        SELECT id, title, due_date, category, amount, details
        FROM reminders WHERE is_dismissed = FALSE AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY due_date
      `),
    ]);

    res.json({
      patterns: patterns.rows,
      categoryTotals: totals.rows,
      subtypeAverages: categoryAvg.rows,
      upcomingWeek: upcoming.rows,
    });
  } catch (err) {
    logger.error('Error en learning', { error: err.message });
    res.json({ patterns: [], categoryTotals: [], subtypeAverages: [], upcomingWeek: [] });
  }
});

module.exports = router;

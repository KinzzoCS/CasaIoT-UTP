'use strict';

const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.*, d.name as device_name 
      FROM reminders r 
      LEFT JOIN devices d ON r.device_id = d.id 
      WHERE r.is_dismissed = FALSE 
      ORDER BY r.due_date ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar recordatorios' });
  }
});

router.post('/', async (req, res) => {
  const { title, description, category, amount, repeat_type, repeat_interval, device_id, due_date, details } = req.body;
  if (!title || !due_date) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    await query(`
      ALTER TABLE reminders 
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS repeat_type VARCHAR(20) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS repeat_interval INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'
    `);

    const { rows } = await query(`
      INSERT INTO reminders (title, description, reminder_type, category, amount, repeat_type, repeat_interval, device_id, due_date, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      title, description || '',
      category || 'general',
      category || 'general',
      amount || null,
      repeat_type || 'none',
      repeat_interval || 1,
      device_id || null,
      due_date,
      JSON.stringify(details || {}),
    ]);
    res.json(rows[0]);
  } catch (err) {
    logger.error('Error creando recordatorio', { error: err.message });
    res.status(500).json({ error: 'Error creando recordatorio' });
  }
});

router.patch('/:id/dismiss', async (req, res) => {
  try {
    await query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL`);
    const { rows } = await query(`
      UPDATE reminders SET is_dismissed = TRUE, completed_at = NOW() WHERE id = $1 RETURNING *
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando recordatorio' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM reminders WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando recordatorio' });
  }
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

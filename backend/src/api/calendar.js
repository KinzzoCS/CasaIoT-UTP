'use strict';

const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const { createRouter } = require('../utils/asyncRouter');
const { clampInt } = require('../utils/validation');

const router = createRouter();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const now   = new Date();
  const year  = clampInt(req.query.year, 2000, 2100, now.getFullYear());
  const month = clampInt(req.query.month, 1, 12, now.getMonth() + 1);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  try {
    const [reminders, events, devicesOnline] = await Promise.all([
      query(`
        SELECT id, title AS name, due_date::date AS date,
          reminder_type AS type, category, amount, repeat_type,
          'reminder' AS source, NULL AS device_name
        FROM reminders
        WHERE is_dismissed = FALSE
          AND due_date >= $1::date
          AND due_date < $2::date
        ORDER BY due_date
      `, [startDate, endDate]),

      query(`
        SELECT e.id, d.name AS device_name, e.event_type AS type,
          e.created_at::date AS date, 'event' AS source
        FROM events e
        LEFT JOIN devices d ON d.id = e.device_id
        WHERE e.created_at >= $1::date
          AND e.created_at < $2::date
        ORDER BY e.created_at DESC
      `, [startDate, endDate]),

      query(`SELECT COUNT(*)::int AS online FROM devices WHERE is_online = TRUE`),
    ]);

    res.json({
      year, month,
      daysInMonth: new Date(year, month, 0).getDate(),
      startDay: new Date(startDate).getDay(),
      reminders: reminders.rows,
      events: events.rows,
      onlineDevices: devicesOnline.rows[0]?.online || 0,
    });
  } catch (err) {
    logger.error('Error obteniendo calendario', { error: err.message });
    res.status(500).json({ error: 'Error al obtener calendario' });
  }
});

module.exports = router;

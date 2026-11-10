'use strict';

const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

// GET /api/schedules
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT s.*, d.name as device_name 
      FROM schedules s
      JOIN devices d ON s.device_id = d.id
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar horarios' });
  }
});

// POST /api/schedules
router.post('/', async (req, res) => {
  const { device_id, name, cron_expression, action } = req.body;
  if (!device_id || !cron_expression || !action) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos' });
  }

  try {
    const { rows } = await query(`
      INSERT INTO schedules (device_id, name, cron_expression, action, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
    `, [device_id, name, cron_expression, JSON.stringify(action)]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear horario' });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM schedules WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar horario' });
  }
});

// PATCH /api/schedules/:id/toggle
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { rows } = await query(`
      UPDATE schedules SET is_active = NOT is_active WHERE id = $1 RETURNING *
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar horario' });
  }
});

module.exports = router;

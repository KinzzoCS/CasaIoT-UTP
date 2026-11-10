// ─────────────────────────────────────────────────────────────
//  api/devices.js — CRUD de dispositivos IoT
//
//  GET    /api/devices           → Listar todos
//  POST   /api/devices           → Registrar nuevo
//  GET    /api/devices/:id       → Detalle de uno
//  PATCH  /api/devices/:id       → Actualizar
//  DELETE /api/devices/:id       → Eliminar
//  POST   /api/devices/:id/command → Enviar comando MQTT
// ─────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/database');
const mqttClient = require('../mqtt/client');
const config = require('../config');
const logger = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

// ── GET /api/devices ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        id, name, type, location, mqtt_client_id,
        mqtt_topic_base, is_online, last_state,
        last_seen, firmware_version, created_at
      FROM devices
      ORDER BY location, name
    `);
    res.json(rows);
  } catch (err) {
    logger.error('Error listando dispositivos', { error: err.message });
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});

// ── GET /api/devices/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM devices WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dispositivo' });
  }
});

// ── POST /api/devices ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, type, location, mqttClientId } = req.body;

  if (!name || !type || !mqttClientId) {
    return res.status(400).json({ error: 'name, type y mqttClientId son requeridos' });
  }

  const validTypes = ['light', 'multi_sala', 'multi_sala_servo'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type debe ser uno de: ${validTypes.join(', ')}` });
  }

  const id = uuidv4();
  const topicBase = `${config.mqtt.baseTopic}/dispositivo/${mqttClientId}`;

  try {
    const { rows } = await query(`
      INSERT INTO devices (id, name, type, location, mqtt_client_id, mqtt_topic_base)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, name, type, location, mqttClientId, topicBase]);

    logger.info('Dispositivo registrado', { id, name, type, userId: req.user.userId });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Ya existe un dispositivo con ese mqtt_client_id' });
    }
    logger.error('Error registrando dispositivo', { error: err.message });
    res.status(500).json({ error: 'Error al registrar dispositivo' });
  }
});

// ── PATCH /api/devices/:id ────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { name, location } = req.body;

  try {
    const { rows } = await query(`
      UPDATE devices
      SET
        name     = COALESCE($1, name),
        location = COALESCE($2, location)
      WHERE id = $3
      RETURNING *
    `, [name, location, req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar dispositivo' });
  }
});

// ── DELETE /api/devices/:id (eliminación real) ─────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM devices WHERE id = $1',
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    logger.info('Dispositivo eliminado', { id: req.params.id, userId: req.user.userId });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar dispositivo' });
  }
});

// ── POST /api/devices/:id/command ─────────────────────────────
router.post('/:id/command', async (req, res) => {
  const { action, params = {} } = req.body;
  logger.info('[DEBUG] POST /api/devices/:id/command', { body: req.body, ip: req.ip });

  if (!action) {
    return res.status(400).json({ error: 'action es requerido' });
  }

  const validActions = {
    light: ['encender', 'apagar', 'toggle'],
    multi_sala: ['encender', 'apagar', 'toggle', 'todas_on', 'todas_off'],
    multi_sala_servo: ['encender', 'apagar', 'toggle', 'todas_on', 'todas_off', 'abrir_cochera', 'cerrar_cochera', 'toggle_cochera'],
  };

  try {
    // Obtener el dispositivo para validar el action
    const { rows } = await query(
      'SELECT id, type, mqtt_client_id, mqtt_topic_base, is_online FROM devices WHERE id = $1',
      [req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    const device = rows[0];
    logger.info('[DEBUG] Dispositivo encontrado', { id: device.id, type: device.type, mqttClientId: device.mqtt_client_id });

    const allowed = validActions[device.type] || [];
    if (allowed.length > 0 && !allowed.includes(action)) {
      logger.warn('[DEBUG] Acción no válida', { type: device.type, action, allowed });
      return res.status(400).json({
        error: `Acción no válida para ${device.type}. Permitidas: ${allowed.join(', ')}`,
      });
    }

    // Publicar comando en MQTT
    const topic = `${device.mqtt_topic_base}/comando`;
    const payload = {
      accion: action,
      ...params,
      params,
      ts: Date.now(),
      source: 'api',
      userId: req.user.userId,
    };

    logger.info('[DEBUG] Publicando en MQTT', { topic, payload, mqttConnected: mqttClient.isConnected ? mqttClient.isConnected() : 'unknown' });
    const published = mqttClient.publish(topic, payload);
    logger.info('[DEBUG] Resultado publish', { published });

    // Registrar el evento de comando
    await query(`
      INSERT INTO events (device_id, event_type, payload, source_ip)
      VALUES ($1, 'command', $2, $3)
    `, [device.id, JSON.stringify(payload), req.ip]);

    logger.info('Comando enviado', { deviceId: device.id, action, userId: req.user.userId });
    res.json({ message: 'Comando enviado', topic, payload });
  } catch (err) {
    logger.error('[DEBUG] Error enviando comando', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Error al enviar comando' });
  }
});

module.exports = router;

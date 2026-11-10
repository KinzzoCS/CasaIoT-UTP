// ─────────────────────────────────────────────────────────────
//  api/devices.js — CRUD de dispositivos IoT
//
//  GET    /api/devices             → Listar todos
//  POST   /api/devices             → Registrar nuevo
//  GET    /api/devices/:id         → Detalle de uno
//  PATCH  /api/devices/:id         → Actualizar
//  DELETE /api/devices/:id         → Eliminar
//  POST   /api/devices/:id/command → Enviar comando MQTT
// ─────────────────────────────────────────────────────────────

'use strict';

const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/database');
const config = require('../config');
const logger = require('../utils/logger');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware, requireWriter } = require('../middleware/auth');
const {
  isValidUUID, isNonEmptyString, isOptionalString, isValidMqttClientId,
} = require('../utils/validation');
const { sendDeviceCommand, CommandError, VALID_ACTIONS } = require('../services/deviceCommands');

const router = createRouter();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

// Validar :id una sola vez (antes un id no-UUID provocaba un 500 de PostgreSQL)
router.param('id', (req, res, next, id) => {
  if (!isValidUUID(id)) return res.status(400).json({ error: 'ID de dispositivo inválido' });
  next();
});

const PUBLIC_COLUMNS = `
  id, name, type, location, mqtt_client_id,
  mqtt_topic_base, is_online, last_state,
  last_seen, firmware_version, created_at
`;

// ── GET /api/devices ──────────────────────────────────────────
router.get('/', async (req, res) => {
  const { rows } = await query(`
    SELECT ${PUBLIC_COLUMNS}
    FROM devices
    WHERE deleted_at IS NULL
    ORDER BY location, name
  `);
  res.json(rows);
});

// ── GET /api/devices/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM devices WHERE id = $1 AND deleted_at IS NULL`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Dispositivo no encontrado' });
  res.json(rows[0]);
});

// ── POST /api/devices ─────────────────────────────────────────
router.post('/', requireWriter, async (req, res) => {
  const { name, type, location, mqttClientId } = req.body;

  if (!isNonEmptyString(name, 100)) {
    return res.status(400).json({ error: 'name es requerido (máx. 100 caracteres)' });
  }
  if (!Object.prototype.hasOwnProperty.call(VALID_ACTIONS, type)) {
    return res.status(400).json({ error: `type debe ser uno de: ${Object.keys(VALID_ACTIONS).join(', ')}` });
  }
  if (!isOptionalString(location, 100)) {
    return res.status(400).json({ error: 'location debe ser texto (máx. 100 caracteres)' });
  }
  // Sin '/', '+', '#': el id forma parte del tópico MQTT
  if (!isValidMqttClientId(mqttClientId)) {
    return res.status(400).json({ error: 'mqttClientId inválido: 1-64 caracteres, solo letras, números, guiones y guiones bajos' });
  }

  const id = uuidv4();
  const topicBase = `${config.mqtt.baseTopic}/dispositivo/${mqttClientId}`;

  try {
    const { rows } = await query(`
      INSERT INTO devices (id, name, type, location, mqtt_client_id, mqtt_topic_base)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${PUBLIC_COLUMNS}
    `, [id, name.trim(), type, location?.trim() || null, mqttClientId, topicBase]);

    logger.info('Dispositivo registrado', { id, name: rows[0].name, type, userId: req.user.userId });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Ya existe un dispositivo con ese mqtt_client_id' });
    }
    throw err;
  }
});

// ── PATCH /api/devices/:id ────────────────────────────────────
router.patch('/:id', requireWriter, async (req, res) => {
  const { name, location } = req.body;

  if (name !== undefined && !isNonEmptyString(name, 100)) {
    return res.status(400).json({ error: 'name debe ser texto no vacío (máx. 100 caracteres)' });
  }
  if (!isOptionalString(location, 100)) {
    return res.status(400).json({ error: 'location debe ser texto (máx. 100 caracteres)' });
  }

  const { rows } = await query(`
    UPDATE devices
    SET
      name     = COALESCE($1, name),
      location = COALESCE($2, location)
    WHERE id = $3 AND deleted_at IS NULL
    RETURNING ${PUBLIC_COLUMNS}
  `, [name?.trim() ?? null, location?.trim() ?? null, req.params.id]);

  if (!rows[0]) return res.status(404).json({ error: 'Dispositivo no encontrado' });
  res.json(rows[0]);
});

// ── DELETE /api/devices/:id (eliminación real) ─────────────────
router.delete('/:id', requireWriter, async (req, res) => {
  const { rowCount } = await query('DELETE FROM devices WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Dispositivo no encontrado' });
  logger.info('Dispositivo eliminado', { id: req.params.id, userId: req.user.userId });
  res.status(204).send();
});

// ── POST /api/devices/:id/command ─────────────────────────────
router.post('/:id/command', requireWriter, async (req, res) => {
  const { action, params } = req.body;

  try {
    const { topic, payload, published } = await sendDeviceCommand({
      deviceId: req.params.id,
      action,
      params,
      userId: req.user.userId,
      sourceIp: req.ip,
      source: 'api',
    });

    if (!published) {
      return res.status(503).json({ error: 'Broker MQTT no disponible: el comando no se envió', topic });
    }
    res.json({ message: 'Comando enviado', topic, payload });
  } catch (err) {
    if (err instanceof CommandError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

module.exports = router;

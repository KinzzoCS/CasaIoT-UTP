// ─────────────────────────────────────────────────────────────
//  services/deviceCommands.js — Envío de comandos a dispositivos
//
//  Punto ÚNICO para publicar comandos MQTT, usado por la API REST
//  y por el WebSocket gateway. Antes el gateway publicaba en
//  `casa/dispositivo/${deviceId}/comando` sin comprobar que el
//  dispositivo existiera, sin validar la acción y sin auditar.
// ─────────────────────────────────────────────────────────────

'use strict';

const { query } = require('../db/database');
const mqttClient = require('../mqtt/client');
const logger = require('../utils/logger');
const { isValidUUID, isPlainObject } = require('../utils/validation');

// Acciones permitidas por tipo de dispositivo
const VALID_ACTIONS = {
  light: ['encender', 'apagar', 'toggle'],
  multi_sala: ['encender', 'apagar', 'toggle', 'todas_on', 'todas_off'],
  multi_sala_servo: ['encender', 'apagar', 'toggle', 'todas_on', 'todas_off', 'abrir_cochera', 'cerrar_cochera', 'toggle_cochera'],
};

const MAX_PARAMS = 10;
const PARAM_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
// Claves que el backend fija y que el cliente no puede sobrescribir
const RESERVED_KEYS = new Set(['accion', 'params', 'ts', 'source', 'userId']);

class CommandError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Normaliza los parámetros: objeto plano, máx. 10 claves simples y
 * valores primitivos cortos. Descarta claves reservadas (p. ej. 'accion',
 * que antes permitía saltarse la validación de la acción).
 */
function sanitizeParams(params) {
  if (params === undefined || params === null) return {};
  if (!isPlainObject(params)) throw new CommandError(400, 'params debe ser un objeto');

  const entries = Object.entries(params);
  if (entries.length > MAX_PARAMS) throw new CommandError(400, `params admite como máximo ${MAX_PARAMS} claves`);

  const clean = {};
  for (const [key, value] of entries) {
    if (!PARAM_KEY_RE.test(key) || RESERVED_KEYS.has(key)) {
      throw new CommandError(400, `Parámetro no permitido: ${key.slice(0, 32)}`);
    }
    const ok = typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))
      || (typeof value === 'string' && value.length <= 64);
    if (!ok) throw new CommandError(400, `Valor inválido para el parámetro ${key}`);
    clean[key] = value;
  }
  return clean;
}

/**
 * Valida y publica un comando.
 * @returns {Promise<{topic:string, payload:object, published:boolean}>}
 * @throws {CommandError} con status HTTP para errores de validación
 */
async function sendDeviceCommand({ deviceId, action, params, userId, sourceIp = null, source }) {
  if (!isValidUUID(deviceId)) throw new CommandError(400, 'deviceId inválido');
  if (typeof action !== 'string' || !action) throw new CommandError(400, 'action es requerido');

  const safeParams = sanitizeParams(params);

  const { rows } = await query(
    'SELECT id, type, mqtt_topic_base FROM devices WHERE id = $1 AND deleted_at IS NULL',
    [deviceId]
  );
  const device = rows[0];
  if (!device) throw new CommandError(404, 'Dispositivo no encontrado');

  const allowed = VALID_ACTIONS[device.type];
  if (!allowed) throw new CommandError(400, `El tipo ${device.type} no acepta comandos`);
  if (!allowed.includes(action)) {
    throw new CommandError(400, `Acción no válida para ${device.type}. Permitidas: ${allowed.join(', ')}`);
  }

  const topic = `${device.mqtt_topic_base}/comando`;
  // Los params se replican en la raíz porque el firmware lee doc["sala"]
  // y como respaldo doc["params"]["sala"]. 'accion' va al final: no se pisa.
  const payload = {
    ...safeParams,
    params: safeParams,
    accion: action,
    ts: Date.now(),
    source,
    userId,
  };

  const published = mqttClient.publish(topic, payload);

  await query(
    `INSERT INTO events (device_id, event_type, payload, source_ip)
     VALUES ($1, 'command', $2, $3)`,
    [device.id, JSON.stringify({ ...payload, published }), sourceIp]
  );

  logger.info('Comando enviado', { deviceId: device.id, action, source, userId, published });
  return { topic, payload, published };
}

module.exports = { sendDeviceCommand, CommandError, VALID_ACTIONS };

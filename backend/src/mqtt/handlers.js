// ─────────────────────────────────────────────────────────────
//  mqtt/handlers.js — Lógica de negocio por tipo de mensaje
//
//  Cada handler procesa un tipo de mensaje MQTT:
//  - Actualiza el estado en PostgreSQL
//  - Registra eventos en el historial
//  - Dispara alertas si es necesario
// ─────────────────────────────────────────────────────────────

'use strict';

const { query } = require('../db/database');
const logger = require('../utils/logger');
const config = require('../config');

const BASE = config.mqtt.baseTopic;

// Patrón de topics — extraer ID del dispositivo
// Ej: "casa/dispositivo/abc-123/estado" → deviceId = "abc-123"
const TOPIC_PATTERNS = {
  deviceState:    new RegExp(`^${BASE}/dispositivo/([^/]+)/estado$`),
  deviceSensor:   new RegExp(`^${BASE}/dispositivo/([^/]+)/sensor$`),
  deviceTelemetry:new RegExp(`^${BASE}/dispositivo/([^/]+)/telemetria$`),
};

/**
 * Handler principal — router de mensajes por patrón de topic
 */
async function routeMessage(topic, payload) {
  let match;

  // Estado del dispositivo (on/off, porcentaje, etc.)
  match = topic.match(TOPIC_PATTERNS.deviceState);
  if (match) {
    await handleDeviceState(match[1], payload, topic);
    return;
  }

  // Sensor (PIR, LDR, temperatura)
  match = topic.match(TOPIC_PATTERNS.deviceSensor);
  if (match) {
    await handleSensorData(match[1], payload, topic);
    return;
  }

  // Telemetría (RSSI, heap, uptime)
  match = topic.match(TOPIC_PATTERNS.deviceTelemetry);
  if (match) {
    await handleTelemetry(match[1], payload, topic);
    return;
  }
}

/**
 * Procesa cambios de estado de un dispositivo.
 * Actualiza devices.last_state y devices.is_online,
 * y registra un evento en events.
 */
async function handleDeviceState(deviceId, payload, topic) {
  try {
    // Actualizar estado del dispositivo
    await query(`
      UPDATE devices
      SET
        is_online  = TRUE,
        last_state = $1,
        last_seen  = NOW()
      WHERE mqtt_client_id = $2
    `, [JSON.stringify(payload), deviceId]);

    // Registrar evento en historial
    await query(`
      INSERT INTO events (device_id, event_type, payload)
      SELECT id, 'state_change', $1
      FROM devices WHERE mqtt_client_id = $2
    `, [JSON.stringify(payload), deviceId]);

    logger.debug('Estado de dispositivo actualizado', { deviceId });
  } catch (err) {
    logger.error('Error procesando estado de dispositivo', {
      deviceId, error: err.message,
    });
  }
}

/**
 * Procesa datos de sensores (PIR, LDR, etc.)
 * Puede disparar alertas según el tipo de sensor.
 */
async function handleSensorData(deviceId, payload, topic) {
  try {
    // Actualizar last_seen del dispositivo
    await query(`
      UPDATE devices SET last_seen = NOW(), is_online = TRUE
      WHERE mqtt_client_id = $1
    `, [deviceId]);

    // Registrar evento del sensor
    await query(`
      INSERT INTO events (device_id, event_type, payload)
      SELECT id, 'sensor_data', $1
      FROM devices WHERE mqtt_client_id = $2
    `, [JSON.stringify(payload), deviceId]);

    // Alerta por sensor PIR (movimiento detectado)
    if (payload.tipo === 'pir' && payload.valor === 1) {
      await query(`
        INSERT INTO events (device_id, event_type, payload)
        SELECT id, 'alert', $1
        FROM devices WHERE mqtt_client_id = $2
      `, [JSON.stringify({
        nivel: 'info',
        mensaje: 'Movimiento detectado',
        sensor: payload,
      }), deviceId]);
    }

    logger.debug('Datos de sensor registrados', { deviceId, tipo: payload.tipo });
  } catch (err) {
    logger.error('Error procesando sensor', { deviceId, error: err.message });
  }
}

/**
 * Procesa telemetría (RSSI, heap libre, uptime).
 * No registra en DB por defecto (volumen alto), solo actualiza last_seen.
 * En el futuro se puede agregar InfluxDB para series temporales.
 */
async function handleTelemetry(deviceId, payload, topic) {
  try {
    await query(`
      UPDATE devices SET last_seen = NOW(), is_online = TRUE,
        firmware_version = COALESCE($1, firmware_version)
      WHERE mqtt_client_id = $2
    `, [payload.firmware || null, deviceId]);

    // Alerta si la señal WiFi es muy débil
    if (payload.rssi && payload.rssi < -85) {
      logger.warn('Señal WiFi débil en dispositivo', { deviceId, rssi: payload.rssi });
    }
  } catch (err) {
    logger.error('Error procesando telemetría', { deviceId, error: err.message });
  }
}

/**
 * Registra un dispositivo como offline si lleva N segundos sin reportar.
 * Llamado periódicamente por el scheduler.
 */
async function markStaleDevicesOffline(thresholdSeconds = 120) {
  const cutoff = new Date(Date.now() - thresholdSeconds * 1000);
  const result = await query(`
    UPDATE devices
    SET is_online = FALSE
    WHERE is_online = TRUE
      AND (last_seen IS NULL OR last_seen < $1)
    RETURNING id, mqtt_client_id
  `, [cutoff]);

  if (result.rowCount > 0) {
    logger.info('Dispositivos marcados offline por inactividad', {
      count: result.rowCount,
      devices: result.rows.map(r => r.mqtt_client_id),
    });
  }
}

module.exports = { routeMessage, markStaleDevicesOffline };

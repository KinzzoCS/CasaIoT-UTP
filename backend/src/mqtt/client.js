// ─────────────────────────────────────────────────────────────
//  mqtt/client.js — Cliente MQTT del backend
//
//  El backend actúa como cliente MQTT privilegiado:
//  - Se suscribe a todos los topics (casa/#)
//  - Publica comandos a dispositivos
//  - Despacha eventos al WebSocket gateway
//
//  Usa mTLS (certificado de cliente) para autenticarse
//  ante Mosquitto, igual que los ESP32.
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const mqtt = require('mqtt');
const config = require('../config');
const logger = require('../utils/logger');

let client = null;
let wsGateway = null;  // Referencia inyectada para emitir eventos

/**
 * Inicializa el cliente MQTT y suscribe a todos los topics.
 * @param {Object} gateway - Instancia del WebSocket gateway
 */
function init(gateway) {
  wsGateway = gateway;

  const isMqtts = config.mqtt.brokerUrl.startsWith('mqtts://');
  const mqttOptions = {
    clientId: config.mqtt.clientId,
    username: config.mqtt.username,
    password: config.mqtt.password,
    // mTLS: certificado del backend como cliente (solo para mqtts://)
    ...(isMqtts ? {
      key:  fs.readFileSync(config.mqtt.keyPath),
      cert: fs.readFileSync(config.mqtt.certPath),
      ca:   fs.readFileSync(config.mqtt.caPath),
      rejectUnauthorized: true,
    } : {
      // Plain MQTT en desarrollo — no usar TLS
      rejectUnauthorized: false,
    }),
    // Limpiar sesión al reconectar (no acumular suscripciones duplicadas)
    clean: true,
    // Reconexión automática con backoff
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    // Will message: avisa a los suscriptores si el backend se desconecta abruptamente
    will: {
      topic: `${config.mqtt.baseTopic}/sistema/backend-status`,
      payload: JSON.stringify({ status: 'offline', ts: Date.now() }),
      qos: 1,
      retain: true,
    },
  };

  logger.info('Conectando al broker MQTT...', { url: config.mqtt.brokerUrl });
  client = mqtt.connect(config.mqtt.brokerUrl, mqttOptions);

  client.on('connect', onConnect);
  client.on('message', onMessage);
  client.on('error', onError);
  client.on('reconnect', () => logger.warn('Reconectando al broker MQTT...'));
  client.on('offline', () => logger.warn('Cliente MQTT desconectado'));
  client.on('close', () => logger.warn('Conexión MQTT cerrada'));

  return client;
}

function onConnect() {
  logger.info('Conectado al broker MQTT');

  // Suscribirse a todos los topics de dispositivos
  client.subscribe(`${config.mqtt.baseTopic}/#`, { qos: 1 }, (err) => {
    if (err) {
      logger.error('Error al suscribirse', { error: err.message });
      return;
    }
    logger.info(`Suscrito a: ${config.mqtt.baseTopic}/#`);
  });

  // Publicar estado online del backend
  publish(`${config.mqtt.baseTopic}/sistema/backend-status`, {
    status: 'online',
    ts: Date.now(),
  }, { retain: true });
}

/**
 * Handler central de mensajes MQTT entrantes.
 * Parsea el topic y despacha al handler correspondiente.
 */
function onMessage(topic, message) {
  let payload;
  try {
    payload = JSON.parse(message.toString());
  } catch {
    logger.warn('Mensaje MQTT no es JSON válido', { topic, message: message.toString() });
    return;
  }

  logger.debug('Mensaje MQTT recibido', { topic });

  // Despachar a los handlers registrados
  messageHandlers.forEach(handler => {
    try {
      handler(topic, payload);
    } catch (err) {
      logger.error('Error en handler MQTT', { topic, error: err.message });
    }
  });

  // Emitir al WebSocket gateway para notificar al frontend
  if (wsGateway) {
    wsGateway.broadcast({
      type: 'mqtt_message',
      topic,
      payload,
      ts: Date.now(),
    });
  }
}

function onError(err) {
  logger.error('Error en cliente MQTT', { error: err.message });
}

/**
 * Publica un mensaje en un topic MQTT.
 * @param {string} topic
 * @param {Object|string} payload
 * @param {Object} options - opciones mqtt (qos, retain)
 */
function publish(topic, payload, options = {}) {
  if (!client || !client.connected) {
    logger.warn('Intento de publicar con cliente MQTT desconectado', { topic });
    return false;
  }

  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const mqttOptions = { qos: 1, ...options };

  client.publish(topic, message, mqttOptions, (err) => {
    if (err) {
      logger.error('Error al publicar en MQTT', { topic, error: err.message });
    } else {
      logger.debug('Publicado en MQTT', { topic });
    }
  });

  return true;
}

// Registro de handlers de mensajes (patrón observer)
const messageHandlers = [];

function addHandler(handler) {
  messageHandlers.push(handler);
}

function isConnected() {
  return client && client.connected;
}

module.exports = { init, publish, addHandler, isConnected };

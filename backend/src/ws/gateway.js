// ─────────────────────────────────────────────────────────────
//  ws/gateway.js — WebSocket Gateway
//
//  Actúa como puente entre MQTT y el frontend:
//  - Acepta conexiones WS del frontend
//  - Valida JWT en el handshake
//  - Broadcast de eventos MQTT a clientes conectados
//  - Recibe comandos del frontend y los publica en MQTT
//
//  Decisión: NO exponemos MQTT directamente al browser.
//  El gateway nos permite autenticar, filtrar y auditar
//  cada evento antes de que llegue al cliente.
// ─────────────────────────────────────────────────────────────

'use strict';

const { WebSocketServer } = require('ws');
const config = require('../config');
const logger = require('../utils/logger');
const mqttClient = require('../mqtt/client');
const { verifyAccessToken } = require('../middleware/auth');
const { sendDeviceCommand, CommandError } = require('../services/deviceCommands');

// Tamaño máximo de un mensaje entrante (el default de `ws` es 100 MB)
const MAX_PAYLOAD_BYTES = 16 * 1024;
// Código de cierre propio: el frontend renueva el token y reconecta
const CLOSE_TOKEN_EXPIRED = 4001;

// Mapa de clientes conectados: clientId → WebSocket
const clients = new Map();

/**
 * Inicializa el WebSocket server adjunto al servidor HTTP.
 * @param {http.Server} server - Servidor HTTP de Express
 */
function init(server) {
  const wss = new WebSocketServer({
    server,
    // Path dedicado para WS (permite coexistir con API REST en el mismo puerto)
    path: '/ws',
    maxPayload: MAX_PAYLOAD_BYTES,
    // Verificar autenticación antes de aceptar la conexión
    verifyClient: verifyJWT,
  });

  wss.on('connection', onConnection);
  wss.on('error', (err) => logger.error('WebSocket server error', { error: err.message }));

  logger.info('WebSocket gateway iniciado en /ws');
  return wss;
}

/**
 * Verificación de JWT durante el handshake WebSocket.
 * Si el token es inválido, rechazamos la conexión con 401.
 *
 * El frontend debe enviar el token en:
 *   Opción A: Header 'Authorization: Bearer <token>'  (si lo soporta el cliente WS)
 *   Opción B: Query param '?token=<jwt>'              (más compatible con browsers)
 */
function verifyJWT(info, callback) {
  // Origen: además del JWT, aceptar solo orígenes de la lista CORS
  const origin = info.origin || info.req.headers.origin;
  if (origin && !config.security.allowedOrigins.includes(origin)) {
    logger.warn('Conexión WS rechazada: origen no permitido', { origin });
    return callback(false, 403, 'Forbidden');
  }

  const url = new URL(info.req.url, 'http://localhost');
  const token = url.searchParams.get('token') ||
    (info.req.headers.authorization || '').replace('Bearer ', '');

  if (!token) {
    logger.warn('Conexión WS rechazada: sin token', { ip: info.req.socket.remoteAddress });
    return callback(false, 401, 'Unauthorized');
  }

  try {
    const decoded = verifyAccessToken(token);
    // Adjuntar datos del usuario al request para usarlos en onConnection
    info.req.user = decoded;
    callback(true);
  } catch (err) {
    logger.warn('Conexión WS rechazada: token inválido', {
      ip: info.req.socket.remoteAddress,
      error: err.message,
    });
    callback(false, 401, 'Unauthorized');
  }
}

/**
 * Handler para nueva conexión WebSocket autenticada.
 */
function onConnection(ws, req) {
  const user = req.user;
  const clientId = `${user.userId}-${Date.now()}`;

  clients.set(clientId, { ws, user });
  logger.info('Cliente WS conectado', { clientId, userId: user.userId, username: user.username });

  // Mensaje de bienvenida con estado actual del sistema
  send(ws, {
    type: 'connected',
    data: {
      clientId,
      message: 'Conexión establecida con CasaIoT',
      mqttConnected: mqttClient.isConnected(),
    },
  });

  // Cerrar la conexión cuando expire el JWT: antes una sesión revocada o
  // un usuario desactivado seguía recibiendo eventos y enviando comandos.
  const msUntilExpiry = user.exp ? user.exp * 1000 - Date.now() : 0;
  const expiryTimer = setTimeout(() => {
    ws.close(CLOSE_TOKEN_EXPIRED, 'Token expirado');
  }, Math.max(msUntilExpiry, 0));

  const ip = req.socket.remoteAddress;
  ws.on('message', (data) => onMessage(ws, user, data, ip));
  ws.on('close', () => {
    clearTimeout(expiryTimer);
    clients.delete(clientId);
    logger.info('Cliente WS desconectado', { clientId });
  });
  ws.on('error', (err) => {
    logger.error('Error en cliente WS', { clientId, error: err.message });
    clients.delete(clientId);
  });

  // Ping/pong para detectar conexiones muertas
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
}

/**
 * Procesa mensajes entrantes desde el frontend.
 * El frontend puede enviar comandos que se publican en MQTT.
 */
function onMessage(ws, user, data, ip) {
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    send(ws, { type: 'error', error: 'Formato JSON inválido' });
    return;
  }
  if (!message || typeof message !== 'object') {
    send(ws, { type: 'error', error: 'Mensaje inválido' });
    return;
  }

  logger.debug('Mensaje WS recibido', { type: message.type, userId: user.userId });

  switch (message.type) {
    case 'command':
      handleCommand(ws, user, message, ip);
      break;
    case 'ping':
      send(ws, { type: 'pong', ts: Date.now() });
      break;
    default:
      send(ws, { type: 'error', error: 'Tipo de mensaje desconocido' });
  }
}

/**
 * Procesa un comando del frontend con las mismas reglas que la API REST
 * (dispositivo existente, acción válida, params saneados, rol con escritura).
 * Ejemplo: { type: 'command', deviceId: '<uuid>', action: 'encender' }
 */
async function handleCommand(ws, user, message, ip) {
  const { deviceId, action, params } = message;

  if (user.role === 'readonly') {
    send(ws, { type: 'error', error: 'Permisos insuficientes' });
    return;
  }

  try {
    const { published } = await sendDeviceCommand({
      deviceId, action, params, userId: user.userId, sourceIp: ip, source: 'websocket',
    });
    send(ws, { type: 'command_ack', deviceId, action, published, ts: Date.now() });
  } catch (err) {
    if (!(err instanceof CommandError)) {
      logger.error('Error enviando comando por WS', { error: err.message, userId: user.userId });
    }
    send(ws, {
      type: 'error',
      error: err instanceof CommandError ? err.message : 'Error al enviar comando',
    });
  }
}

/**
 * Envía un mensaje a un cliente WS específico.
 */
function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Broadcast a todos los clientes WS conectados.
 * Usado por el cliente MQTT para propagar eventos al frontend.
 */
function broadcast(data) {
  const message = JSON.stringify(data);
  let sent = 0;
  clients.forEach(({ ws }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
      sent++;
    }
  });
  if (sent > 0) {
    logger.debug('Broadcast WS', { clientes: sent, tipo: data.type });
  }
}

/**
 * Ping periódico para detectar y limpiar conexiones muertas.
 * Ejecutar desde el index.js con setInterval.
 */
function heartbeat() {
  clients.forEach((client, clientId) => {
    if (!client.ws.isAlive) {
      logger.warn('Cliente WS sin respuesta, cerrando', { clientId });
      client.ws.terminate();
      clients.delete(clientId);
      return;
    }
    client.ws.isAlive = false;
    client.ws.ping();
  });
}

function getConnectedCount() {
  return clients.size;
}

module.exports = { init, broadcast, heartbeat, getConnectedCount };

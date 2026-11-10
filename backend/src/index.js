// ─────────────────────────────────────────────────────────────
//  index.js — Entry point del backend CasaIoT
//
//  Orden de arranque (importante):
//  1. Cargar configuración y validar variables de entorno
//  2. Inicializar pool de base de datos
//  3. Crear servidor HTTP con Express
//  4. Inicializar WebSocket gateway
//  5. Inicializar cliente MQTT
//  6. Registrar rutas de la API
//  7. Arrancar el servidor
// ─────────────────────────────────────────────────────────────

'use strict';

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cron = require('node-cron');
const bcrypt = require('bcrypt');

const config = require('./config');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const { healthCheck, query } = require('./db/database');
const wsGateway = require('./ws/gateway');
const mqttClient = require('./mqtt/client');
const { routeMessage, markStaleDevicesOffline } = require('./mqtt/handlers');
const { apiLimiter } = require('./middleware/rateLimiter');

// ── Rutas de la API ──────────────────────────────────────────
const setupRoutes     = require('./api/setup');
const authRoutes      = require('./api/auth');
const devicesRoutes   = require('./api/devices');
const eventsRoutes    = require('./api/events');
const firmwareRoutes  = require('./api/firmware');
const configRoutes    = require('./api/config');
const remindersRoutes = require('./api/reminders');
const schedulesRoutes = require('./api/schedules');
const adminRoutes     = require('./api/admin');
const tokensRoutes    = require('./api/tokens');
const calendarRoutes  = require('./api/calendar');

const app = express();
const server = http.createServer(app);

// ── Seguridad HTTP ────────────────────────────────────────────
// helmet añade cabeceras de seguridad HTTP (CSP, HSTS, etc.)
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Necesario para que el frontend pueda cargar assets
}));

// CORS — solo orígenes permitidos
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && config.security.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '3600');
  }
  // Manejar OPTIONS preflight requests
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Parseo de JSON — limitar tamaño para prevenir DoS
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Rate limiting general (pero NO para setup)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/setup')) return next();
  apiLimiter(req, res, next);
});

// ── Health Check ──────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const dbOk = await healthCheck();
    const mqttOk = mqttClient.isConnected();
    const wsClients = wsGateway.getConnectedCount();

    const status = dbOk && mqttOk ? 'healthy' : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'ok' : 'error',
        mqtt: mqttOk ? 'ok' : 'disconnected',
        websocket: { status: 'ok', clients: wsClients },
      },
    });
  } catch (err) {
    logger.error('Health check falló', { error: err.message });
    res.status(503).json({ status: 'error' });
  }
});

// ── Metrics Prometheus ────────────────────────────────────────
// Solo desde localhost o con `Authorization: Bearer <METRICS_TOKEN>`.
function canReadMetrics(req) {
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  const expected = config.security.metricsToken;
  const given = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.get('/metrics', (req, res) => {
  if (!canReadMetrics(req)) return res.status(404).json({ error: 'Endpoint no encontrado' });
  res.setHeader('Content-Type', 'text/plain');
  res.send(metrics.getMetricsText());
});

// ── Rutas de la API ───────────────────────────────────────────
app.use('/api/setup',       setupRoutes);  // Sin autenticación
app.use('/api/auth',        authRoutes);
app.use('/api/devices',    devicesRoutes);
app.use('/api/events',     eventsRoutes);
app.use('/api/firmware',   firmwareRoutes);
app.use('/api/config',     configRoutes);
app.use('/api/reminders',  remindersRoutes);
app.use('/api/schedules',  schedulesRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/tokens',     tokensRoutes);
app.use('/api/calendar',   calendarRoutes);

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler global
// Respeta los errores 4xx de body-parser (JSON malformado, cuerpo > 10kb)
// y nunca devuelve detalles internos al cliente.
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) {
    logger.error('Error no manejado', { error: err.message, stack: err.stack, path: req.path });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  const messages = {
    400: 'Petición malformada',
    413: 'El cuerpo de la petición es demasiado grande',
  };
  res.status(status).json({ error: messages[status] || 'Petición inválida' });
});

/**
 * Avisa en los logs si algún admin conserva la contraseña sembrada por la
 * migración 002 (admin/admin123). No bloquea el arranque.
 */
async function warnIfDefaultAdminPassword() {
  try {
    const { rows } = await query(
      `SELECT username, password_hash FROM users WHERE role = 'admin' AND is_active = TRUE`
    );
    for (const u of rows) {
      if (await bcrypt.compare('admin123', u.password_hash)) {
        logger.warn('SEGURIDAD: el admin usa la contraseña por defecto. Cámbiala en Ajustes → Seguridad.', {
          username: u.username,
        });
      }
    }
  } catch (err) {
    logger.debug('No se pudo comprobar la contraseña por defecto', { error: err.message });
  }
}

// ── Inicialización ────────────────────────────────────────────
async function start() {
  logger.info('Iniciando CasaIoT Backend...', {
    nodeEnv: config.server.nodeEnv,
    port: config.server.port,
  });

  // 1. Verificar conexión a la base de datos
  try {
    await healthCheck();
    logger.info('Conexión a PostgreSQL establecida');
  } catch (err) {
    logger.error('No se puede conectar a PostgreSQL', { error: err.message });
    process.exit(1);
  }

  // 2. Inicializar WebSocket gateway
  wsGateway.init(server);

  // 3. Inicializar cliente MQTT (con referencia al gateway para broadcast)
  mqttClient.init(wsGateway);

  // 4. Registrar handler de mensajes MQTT
  mqttClient.addHandler(routeMessage);

  warnIfDefaultAdminPassword();

  // 5. Job periódico: marcar dispositivos inactivos como offline
  // Revisa cada 15 s; umbral configurable (DEVICE_OFFLINE_SECONDS, def. 150 s)
  cron.schedule('*/15 * * * * *', async () => {
    try {
      await markStaleDevicesOffline(config.devices.offlineThresholdSeconds);
    } catch (err) {
      logger.error('Error en job de dispositivos offline', { error: err.message });
    }
  });

  // 6. Heartbeat WebSocket cada 30 segundos
  setInterval(() => wsGateway.heartbeat(), 30000);

  // 7. Arrancar el servidor HTTP
  server.listen(config.server.port, () => {
    logger.info(`Backend corriendo en puerto ${config.server.port}`);
    logger.info(`Health check: http://localhost:${config.server.port}/health`);
    logger.info(`WebSocket: ws://localhost:${config.server.port}/ws`);
    logger.info(`Setup: POST http://localhost:${config.server.port}/api/setup/create-admin`);
  });
}

// ── Graceful shutdown ─────────────────────────────────────────
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

function shutdown() {
  logger.info('Apagando servidor...');
  server.close(() => {
    logger.info('Servidor HTTP cerrado');
    process.exit(0);
  });
  // Forzar cierre si tarda más de 10 segundos
  setTimeout(() => process.exit(1), 10000);
}

// Manejar excepciones no capturadas (last resort)
process.on('uncaughtException', (err) => {
  logger.error('Excepción no capturada', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Las rutas ya reenvían sus errores a Express (utils/asyncRouter.js).
// Si aun así se escapa una promesa, se registra sin tumbar el servidor:
// antes cualquier request que provocara un rechazo apagaba el backend.
process.on('unhandledRejection', (reason) => {
  logger.error('Promise rechazado sin manejar', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

start();

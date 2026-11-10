// ─────────────────────────────────────────────────────────────
//  config.js — Configuración centralizada del backend
//
//  Todas las variables de entorno se validan aquí.
//  Si falta una variable crítica, el proceso falla en el arranque
//  con un mensaje claro. Fail-fast es preferible a errores
//  crípticos en producción.
// ─────────────────────────────────────────────────────────────

'use strict';

const crypto = require('crypto');

function optionalEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

function intEnv(name, defaultValue) {
  const n = parseInt(process.env[name], 10);
  return Number.isNaN(n) ? defaultValue : n;
}

const nodeEnv = optionalEnv('NODE_ENV', 'development');
const isProd = nodeEnv === 'production';

/**
 * Secreto obligatorio en producción. Antes había valores por defecto
 * conocidos ('dev-jwt-secret-...'): cualquiera podía firmar JWT válidos
 * si la variable faltaba. Ahora:
 *  - producción: sin secreto (o con placeholder CHANGE_ME) → no arranca
 *  - desarrollo: se genera uno aleatorio por proceso (las sesiones se
 *    invalidan al reiniciar, lo cual es aceptable en dev)
 */
function secretEnv(name) {
  const value = process.env[name];
  const isPlaceholder = !value || value.startsWith('CHANGE_ME') || value.startsWith('dev-');
  if (!isPlaceholder) {
    if (value.length < 32) {
      console.warn(`[CONFIG WARN] ${name} es corto (<32 caracteres). Genera uno con crypto.randomBytes(64).`);
    }
    return value;
  }
  if (isProd) {
    console.error(`[CONFIG ERROR] ${name} no está configurado o usa un valor de ejemplo. Abortando.`);
    process.exit(1);
  }
  console.warn(`[CONFIG WARN] ${name} no configurado: usando un secreto aleatorio temporal (solo desarrollo).`);
  return crypto.randomBytes(48).toString('hex');
}

const jwtSecret = secretEnv('JWT_SECRET');
const jwtRefreshSecret = secretEnv('JWT_REFRESH_SECRET');
if (jwtSecret === jwtRefreshSecret) {
  console.warn('[CONFIG WARN] JWT_SECRET y JWT_REFRESH_SECRET son iguales; usa valores distintos.');
}

const config = {
  // ── Servidor ───────────────────────────────────────────────
  server: {
    port: intEnv('PORT', 3001),
    nodeEnv,
    isDev: nodeEnv === 'development',
    isProd,
    logLevel: optionalEnv('LOG_LEVEL', isProd ? 'info' : 'debug'),
  },

  // ── Base de datos ──────────────────────────────────────────
  db: {
    url: optionalEnv('DATABASE_URL', 'postgresql://casaiot:CHANGE_ME_STRONG_PASSWORD@localhost:5432/casaiot'),
    // Pool de conexiones: mínimo para no desperdiciar recursos
    poolMin: intEnv('DB_POOL_MIN', 2),
    poolMax: intEnv('DB_POOL_MAX', 10),
  },

  // ── JWT ───────────────────────────────────────────────────
  jwt: {
    secret: jwtSecret,
    refreshSecret: jwtRefreshSecret,
    algorithm: 'HS256',
    accessExpiresIn: '15m',
    accessExpiresSeconds: 15 * 60,
    refreshExpiresMs: 7 * 24 * 60 * 60 * 1000,
  },

  // ── MQTT ──────────────────────────────────────────────────
  mqtt: {
    brokerUrl: optionalEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883'),
    username: optionalEnv('MQTT_USERNAME', 'backend'),
    password: optionalEnv('MQTT_PASSWORD', ''),
    // Rutas a certificados (montados como volumen en Docker)
    caPath: optionalEnv('MQTT_CA_PATH', ''),
    certPath: optionalEnv('MQTT_CERT_PATH', ''),
    keyPath: optionalEnv('MQTT_KEY_PATH', ''),
    // Topics base
    baseTopic: 'casa',
    clientId: `casaiot-backend-${Date.now()}`,
  },

  // ── Dispositivos ──────────────────────────────────────────
  devices: {
    // El firmware envía telemetría cada 60 s. Con el umbral anterior (15 s)
    // los dispositivos aparecían offline 45 de cada 60 segundos.
    offlineThresholdSeconds: intEnv('DEVICE_OFFLINE_SECONDS', 150),
  },

  // ── Seguridad ─────────────────────────────────────────────
  security: {
    // Orígenes CORS permitidos (separados por coma en env)
    allowedOrigins: optionalEnv('ALLOWED_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
    // bcrypt rounds — 12 es el balance seguridad/performance recomendado
    bcryptRounds: 12,
    // Registro público (/api/auth/register). Cerrado por defecto: los
    // usuarios nuevos los crea un admin desde Ajustes → Seguridad.
    allowRegistration: optionalEnv('ALLOW_REGISTRATION', 'false') === 'true',
    // Token opcional para que Prometheus lea /metrics desde fuera de localhost
    metricsToken: optionalEnv('METRICS_TOKEN', ''),
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      // Peticiones generales por IP en la ventana
      max: intEnv('RATE_LIMIT_MAX', 2000),
      // Intentos FALLIDOS de login por IP+usuario en la ventana
      authMax: intEnv('AUTH_RATE_LIMIT_MAX', 10),
    },
  },
};

module.exports = config;

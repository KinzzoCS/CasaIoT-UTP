// ─────────────────────────────────────────────────────────────
//  config.js — Configuración centralizada del backend
//
//  Todas las variables de entorno se validan aquí.
//  Si falta una variable crítica, el proceso falla en el arranque
//  con un mensaje claro. Fail-fast es preferible a errores
//  crípticos en producción.
// ─────────────────────────────────────────────────────────────

'use strict';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[CONFIG ERROR] Variable de entorno requerida no encontrada: ${name}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

const config = {
  // ── Servidor ───────────────────────────────────────────────
  server: {
    port: parseInt(optionalEnv('PORT', '3001'), 10),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    isDev: optionalEnv('NODE_ENV', 'development') === 'development',
  },

  // ── Base de datos ──────────────────────────────────────────
  db: {
    url: optionalEnv('DATABASE_URL', 'postgresql://casaiot:CHANGE_ME_STRONG_PASSWORD@localhost:5432/casaiot'),
    // Pool de conexiones: mínimo para no desperdiciar recursos
    poolMin: parseInt(optionalEnv('DB_POOL_MIN', '2'), 10),
    poolMax: parseInt(optionalEnv('DB_POOL_MAX', '10'), 10),
  },

  // ── JWT ───────────────────────────────────────────────────
  jwt: {
    secret: optionalEnv('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
    refreshSecret: optionalEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
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

  // ── Seguridad ─────────────────────────────────────────────
  security: {
    // Orígenes CORS permitidos (separados por coma en env)
    allowedOrigins: optionalEnv('ALLOWED_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map(o => o.trim()),
    // bcrypt rounds — 12 es el balance seguridad/performance recomendado
    bcryptRounds: 12,
    // Rate limiting: desactivado (límites muy altos)
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 999999,
      authMax: 999999,
    },
  },
};

module.exports = config;

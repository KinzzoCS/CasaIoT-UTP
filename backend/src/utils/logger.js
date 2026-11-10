// ─────────────────────────────────────────────────────────────
//  logger.js — Logger estructurado minimalista
//
//  Usamos JSON estructurado en producción para facilitar
//  parseo por herramientas como Loki, Datadog o grep simple.
//  En desarrollo, formato legible con colores.
//
//  Nivel mínimo configurable con LOG_LEVEL (error|warn|info|debug).
//  Por defecto: 'info' en producción, 'debug' en desarrollo.
// ─────────────────────────────────────────────────────────────

'use strict';

const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = {
  error: '\x1b[31m',  // Rojo
  warn:  '\x1b[33m',  // Amarillo
  info:  '\x1b[36m',  // Cyan
  debug: '\x1b[90m',  // Gris
  reset: '\x1b[0m',
};

const minLevel = LEVELS[config.server.logLevel] ?? LEVELS.info;

function formatDev(level, message, meta) {
  const color = COLORS[level] || '';
  const reset = COLORS.reset;
  const ts = new Date().toTimeString().slice(0, 8);
  const metaStr = meta && Object.keys(meta).length > 0
    ? ` ${JSON.stringify(meta)}`
    : '';
  return `${color}[${ts}] [${level.toUpperCase()}]${reset} ${message}${metaStr}`;
}

function formatProd(level, message, meta) {
  // meta primero: no puede sobrescribir ts/level/msg
  return JSON.stringify({
    ...meta,
    ts: new Date().toISOString(),
    level,
    msg: message,
  });
}

function log(level, message, meta = {}) {
  if (LEVELS[level] > minLevel) return;

  const output = config.server.isDev
    ? formatDev(level, message, meta)
    : formatProd(level, message, meta);

  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

module.exports = logger;

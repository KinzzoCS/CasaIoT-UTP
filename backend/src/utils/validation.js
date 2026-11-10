// ─────────────────────────────────────────────────────────────
//  utils/validation.js — Validadores reutilizables
//
//  Funciones para validar y sanitizar entrada de usuarios.
//  Todas aceptan `unknown`: nunca asumen que el valor es string
//  (un body JSON puede traer números, objetos o arrays).
// ─────────────────────────────────────────────────────────────

'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,50}$/;
// IDs MQTT: sin '/', '+', '#' ni espacios → evita inyección de tópicos
const MQTT_CLIENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
// Hostname o IPv4 sencillos (broker MQTT)
const HOST_RE = /^[A-Za-z0-9.-]{1,100}$/;

function isString(v) {
  return typeof v === 'string';
}

/** String no vacío (tras trim) de longitud máxima `max`. */
function isNonEmptyString(v, max = 255) {
  return isString(v) && v.trim().length > 0 && v.length <= max;
}

/** String opcional: undefined/null o string de longitud máxima `max`. */
function isOptionalString(v, max = 255) {
  return v === undefined || v === null || (isString(v) && v.length <= max);
}

function isValidUUID(v) {
  return isString(v) && UUID_RE.test(v);
}

function isValidEmail(v) {
  return isString(v) && v.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** 3-50 caracteres: alfanuméricos, guiones y guiones bajos. */
function isValidUsername(v) {
  return isString(v) && USERNAME_RE.test(v.trim());
}

/** Política mínima para cuentas de usuario: 8-128 caracteres. */
function isAcceptablePassword(v) {
  return isString(v) && v.length >= 8 && v.length <= 128;
}

/** Política fuerte (setup del primer admin). */
function isStrongPassword(v) {
  if (!isAcceptablePassword(v)) return false;
  return /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
}

function isValidMqttClientId(v) {
  return isString(v) && MQTT_CLIENT_ID_RE.test(v);
}

function isValidHost(v) {
  return isString(v) && HOST_RE.test(v);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Entero positivo (para ids SERIAL). Devuelve el número o null. */
function toPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

/** Entero acotado con valor por defecto si no es válido. */
function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function isIntInRange(val, min, max) {
  const num = parseInt(val, 10);
  return !Number.isNaN(num) && num >= min && num <= max;
}

/** Fecha parseable (ISO o YYYY-MM-DD). */
function isValidDate(v) {
  return isString(v) && v.length <= 40 && !Number.isNaN(Date.parse(v));
}

/**
 * Sanitiza una cadena removiendo caracteres de marcado.
 * Nota: NO es suficiente para insertar en código C, usar escapeCString.
 */
function sanitizeString(str) {
  return String(str)
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 1000);
}

/**
 * Escapa un valor para insertarlo dentro de un literal de string de C/C++ ("...").
 * Evita que un SSID o contraseña con comillas, barras o saltos de línea
 * inyecte código en el firmware generado.
 */
function escapeCString(v) {
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\?/g, '\\?') // evita trigraphs
    // eslint-disable-next-line no-control-regex -- buscamos justamente caracteres de control
    .replace(/[\x00-\x1f\x7f]/g, ch => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}""`);
}

module.exports = {
  isString,
  isNonEmptyString,
  isOptionalString,
  isValidUUID,
  isValidEmail,
  isValidUsername,
  isAcceptablePassword,
  isStrongPassword,
  isValidMqttClientId,
  isValidHost,
  isPlainObject,
  toPositiveInt,
  clampInt,
  isIntInRange,
  isValidDate,
  sanitizeString,
  escapeCString,
};

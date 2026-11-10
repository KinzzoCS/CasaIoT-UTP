// ─────────────────────────────────────────────────────────────
//  utils/validation.js — Validadores reutilizables
//
//  Funciones para validar y sanitizar entrada de usuarios.
//  Previene inyección de código y datos malformados.
// ─────────────────────────────────────────────────────────────

'use strict';

/**
 * Valida que un string sea un UUID válido (v4)
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Valida que un string sea un email válido (básico)
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida que un string sea un nombre de usuario válido
 * - 3-50 caracteres
 * - Solo alfanuméricos, guiones, guiones bajos
 */
function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return usernameRegex.test(username);
}

/**
 * Valida que una contraseña sea fuerte
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula, una minúscula, un número y un carácter especial
 */
function isStrongPassword(password) {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  return true;
}

/**
 * Sanitiza una cadena removiendo caracteres peligrosos
 */
function sanitizeString(str) {
  return String(str)
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 1000); // Limitar longitud
}

/**
 * Valida que un valor sea un entero en rango
 */
function isIntInRange(val, min, max) {
  const num = parseInt(val, 10);
  return !Number.isNaN(num) && num >= min && num <= max;
}

/**
 * Valida una expresión cron válida (básico)
 * Formato: '0 22 * * *' (5 campos)
 */
function isValidCronExpression(cron) {
  const parts = cron.trim().split(/\s+/);
  return parts.length === 5 && parts.every(p => /^[\d*,/-]+$/.test(p));
}

module.exports = {
  isValidUUID,
  isValidEmail,
  isValidUsername,
  isStrongPassword,
  sanitizeString,
  isIntInRange,
  isValidCronExpression,
};

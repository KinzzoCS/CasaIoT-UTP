// ─────────────────────────────────────────────────────────────
//  middleware/rateLimiter.js — Rate limiting por endpoint
//
//  Previene ataques de fuerza bruta y DoS.
//  Límites diferenciados: más estricto en auth, más permisivo en API.
// ─────────────────────────────────────────────────────────────

'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limit para endpoints de autenticación (login, register)
// Máximo 10 intentos por 15 minutos por IP
const authLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.authMax,
  message: {
    error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    retryAfter: config.security.rateLimit.windowMs / 1000,
  },
  standardHeaders: true,  // Incluye cabeceras RateLimit-* en la respuesta
  legacyHeaders: false,
  // Usar IP real incluso detrás de proxy
  keyGenerator: (req) => req.ip,
});

// Rate limit general para la API
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  message: {
    error: 'Límite de requests excedido. Intenta de nuevo pronto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };

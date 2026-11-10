// ─────────────────────────────────────────────────────────────
//  middleware/rateLimiter.js — Rate limiting por endpoint
//
//  Previene ataques de fuerza bruta y DoS.
//  Límites configurables por entorno (ver config.security.rateLimit).
// ─────────────────────────────────────────────────────────────

'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const { windowMs, max, authMax } = config.security.rateLimit;

// Login/registro: cuenta solo intentos FALLIDOS, por IP + usuario.
// Detrás de Docker todas las peticiones pueden llegar con la IP del
// gateway; incluir el username evita bloquear a toda la casa porque
// alguien se equivocó de contraseña.
const authLimiter = rateLimit({
  windowMs,
  max: authMax,
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    retryAfter: windowMs / 1000,
  },
  standardHeaders: true,  // Incluye cabeceras RateLimit-* en la respuesta
  legacyHeaders: false,
  keyGenerator: (req) => {
    const username = typeof req.body?.username === 'string'
      ? req.body.username.toLowerCase().trim().slice(0, 50)
      : '';
    return `${req.ip}|${username}`;
  },
});

// Rate limit general para la API
const apiLimiter = rateLimit({
  windowMs,
  max,
  message: {
    error: 'Límite de requests excedido. Intenta de nuevo pronto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };

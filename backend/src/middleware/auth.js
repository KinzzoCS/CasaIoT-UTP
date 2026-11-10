// ─────────────────────────────────────────────────────────────
//  middleware/auth.js — Middleware de autenticación JWT
//
//  Verifica el JWT en el header Authorization.
//  Adjunta el usuario decodificado a req.user.
// ─────────────────────────────────────────────────────────────

'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware JWT — requiere token válido en Authorization header.
 * Uso: router.get('/protected', authMiddleware, handler)
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = authHeader.slice(7); // Remover "Bearer "

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    logger.warn('Token JWT inválido', { error: err.message, ip: req.ip });
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware de rol — requiere rol específico.
 * Usar después de authMiddleware.
 * Uso: router.post('/admin', authMiddleware, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn('Acceso denegado por rol', {
        userId: req.user.userId,
        role: req.user.role,
        required: roles,
      });
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };

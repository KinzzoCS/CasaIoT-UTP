// ─────────────────────────────────────────────────────────────
//  services/sessions.js — Emisión y revocación de sesiones
//
//  Access token: JWT de 15 min (stateless).
//  Refresh token: aleatorio de 64 bytes, se guarda solo su SHA-256.
//  Se ROTA en cada /refresh (el anterior queda revocado) y se revocan
//  todos al cambiar contraseña, desactivar o cambiar rol de un usuario.
// ─────────────────────────────────────────────────────────────

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../db/database');
const config = require('../config');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken({ id, username, role }) {
  return jwt.sign(
    { userId: id, username, role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn, algorithm: config.jwt.algorithm }
  );
}

/**
 * Crea un par access + refresh para el usuario y persiste el refresh hasheado.
 * @param {{id:number, username:string, role:string}} user
 * @param {Function} [db] - función query (permite usar un client de transacción)
 */
async function issueSession(user, db = query) {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresMs);

  await db(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, hashToken(refreshToken), expiresAt]
  );

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    expiresIn: config.jwt.accessExpiresSeconds,
  };
}

/** Revoca todas las sesiones (refresh tokens) activas de un usuario. */
async function revokeAllSessions(userId, db = query) {
  await db(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
    [userId]
  );
}

module.exports = { hashToken, signAccessToken, issueSession, revokeAllSessions };

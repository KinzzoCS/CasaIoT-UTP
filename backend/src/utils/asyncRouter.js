// ─────────────────────────────────────────────────────────────
//  utils/asyncRouter.js — Router de Express seguro para async
//
//  Express 4 no captura promesas rechazadas en handlers async:
//  un `throw` dentro de un handler async terminaba en
//  `unhandledRejection` y tumbaba el proceso (DoS con un solo
//  request malformado). Este router envuelve cada handler para
//  reenviar cualquier error a `next(err)` → error handler global.
// ─────────────────────────────────────────────────────────────

'use strict';

const express = require('express');

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

function wrap(handler) {
  // Rutas (strings/regex) y error handlers (4 args) se dejan intactos
  if (typeof handler !== 'function' || handler.length === 4) return handler;

  return function asyncSafeHandler(req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Crea un express.Router cuyos handlers async no pueden tumbar el proceso.
 */
function createRouter(options) {
  const router = express.Router(options);
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map(a => (Array.isArray(a) ? a.map(wrap) : wrap(a))));
  }
  return router;
}

module.exports = { createRouter };

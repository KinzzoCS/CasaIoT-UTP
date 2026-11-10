// ─────────────────────────────────────────────────────────────
//  api/config.js — Configuración del sistema (red, región)
//
//  GET   /api/config  → cualquier usuario autenticado. La contraseña
//                       WiFi NUNCA se devuelve: solo `wifi_password_set`.
//  PATCH /api/config  → solo admin. Un wifi_password vacío conserva el
//                       valor guardado.
// ─────────────────────────────────────────────────────────────

'use strict';

const { query } = require('../db/database');
const logger = require('../utils/logger');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { isPlainObject, isString, isValidHost } = require('../utils/validation');

const router = createRouter();
router.use(authMiddleware);

// Validador por clave: devuelve true si el valor es aceptable
const VALIDATORS = {
  wifi_ssid:      v => isString(v) && v.length <= 32,
  wifi_password:  v => isString(v) && v.length <= 64,
  mqtt_broker_ip: v => v === '' || isValidHost(v),
  timezone:       v => isString(v) && /^[A-Za-z0-9_/+-]{1,64}$/.test(v),
  location:       v => isPlainObject(v)
    && Number.isFinite(v.lat) && Math.abs(v.lat) <= 90
    && Number.isFinite(v.lng) && Math.abs(v.lng) <= 180
    && (v.name === undefined || (isString(v.name) && v.name.length <= 100))
    && (v.source === undefined || (isString(v.source) && v.source.length <= 20))
    && Object.keys(v).every(k => ['lat', 'lng', 'name', 'source'].includes(k)),
};
const ALLOWED_KEYS = Object.keys(VALIDATORS);

async function readPublicConfig() {
  const { rows } = await query(
    'SELECT key, value FROM system_config WHERE key = ANY($1)',
    [ALLOWED_KEYS]
  );
  const result = {};
  for (const { key, value } of rows) {
    if (key === 'wifi_password') continue;
    result[key] = value;
  }
  const pw = rows.find(r => r.key === 'wifi_password');
  result.wifi_password_set = Boolean(pw && typeof pw.value === 'string' && pw.value.length > 0);
  return result;
}

// GET /api/config
router.get('/', async (req, res) => {
  res.json(await readPublicConfig());
});

// PATCH /api/config
router.patch('/', requireAdmin, async (req, res) => {
  const updates = req.body;
  if (!isPlainObject(updates)) {
    return res.status(400).json({ error: 'El cuerpo debe ser un objeto' });
  }

  const keys = Object.keys(updates);
  const invalidKeys = keys.filter(k => !ALLOWED_KEYS.includes(k));
  if (invalidKeys.length > 0) {
    return res.status(400).json({ error: `Claves inválidas: ${invalidKeys.join(', ').slice(0, 200)}` });
  }
  const invalidValues = keys.filter(k => !VALIDATORS[k](updates[k]));
  if (invalidValues.length > 0) {
    return res.status(400).json({ error: `Valores inválidos para: ${invalidValues.join(', ')}` });
  }

  // Contraseña vacía = "no cambiar" (el frontend ya no la recibe)
  const toSave = keys.filter(k => !(k === 'wifi_password' && updates[k] === ''));

  for (const key of toSave) {
    await query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(updates[key])]
    );
  }
  logger.info('Config actualizada', { keys: toSave, userId: req.user.userId });

  res.json(await readPublicConfig());
});

module.exports = router;

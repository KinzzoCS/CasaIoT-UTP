// ─────────────────────────────────────────────────────────────
//  api/firmware.js — Generador de firmware ESP32
//
//  POST /api/firmware/generate  (solo admin)
//    body: { type, deviceId, ssid?, broker?, password? }
//
//  Cambios de seguridad:
//  - Antes era GET y la contraseña WiFi viajaba en la URL (quedaba en
//    logs, historial y proxies). Ahora va en el body o, si se omite,
//    se toma de la configuración guardada en el servidor.
//  - Los valores se escapan como literal de C: un SSID con comillas
//    ya no puede inyectar código en el .ino generado.
//  - Solo admin: el archivo resultante contiene la clave WiFi.
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');
const { query } = require('../db/database');
const logger = require('../utils/logger');
const config = require('../config');
const { createRouter } = require('../utils/asyncRouter');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const {
  isValidMqttClientId, isValidHost, isNonEmptyString, isOptionalString, escapeCString,
} = require('../utils/validation');

const router = createRouter();
router.use(authMiddleware, requireAdmin);

// Tipo de dispositivo → plantilla en firmware/templates
const TEMPLATES = {
  light: 'light_switch',
  multi_sala: 'multi_sala',
  multi_sala_servo: 'multi_sala_servo',
};

// En Docker el firmware se monta en /app/firmware; en local está en la raíz del repo.
const FIRMWARE_DIR = [
  process.env.FIRMWARE_DIR,
  path.join(__dirname, '../../firmware'),
  path.join(__dirname, '../../../firmware'),
].find(dir => dir && fs.existsSync(path.join(dir, 'base', 'base.ino')));

async function getStoredNetworkConfig() {
  const { rows } = await query(
    `SELECT key, value FROM system_config WHERE key IN ('wifi_ssid', 'wifi_password', 'mqtt_broker_ip')`
  );
  return Object.fromEntries(rows.map(r => [r.key, typeof r.value === 'string' ? r.value : '']));
}

router.post('/generate', async (req, res) => {
  const { type, deviceId } = req.body;

  if (!Object.prototype.hasOwnProperty.call(TEMPLATES, type)) {
    return res.status(400).json({ error: `type inválido. Permitidos: ${Object.keys(TEMPLATES).join(', ')}` });
  }
  if (!isValidMqttClientId(deviceId)) {
    return res.status(400).json({ error: 'deviceId inválido' });
  }
  if (!isOptionalString(req.body.ssid, 32) || !isOptionalString(req.body.password, 64) || !isOptionalString(req.body.broker, 100)) {
    return res.status(400).json({ error: 'ssid (máx. 32), broker (máx. 100) o password (máx. 64) inválidos' });
  }

  const stored = await getStoredNetworkConfig();
  const ssid = req.body.ssid || stored.wifi_ssid;
  const broker = req.body.broker || stored.mqtt_broker_ip;
  const password = req.body.password || stored.wifi_password || '';

  if (!isNonEmptyString(ssid, 32) || !isValidHost(broker)) {
    return res.status(400).json({ error: 'Configura el SSID y la IP del broker en Ajustes → Red antes de generar firmware' });
  }

  if (!FIRMWARE_DIR) {
    logger.error('Directorio de firmware no encontrado (define FIRMWARE_DIR)');
    return res.status(500).json({ error: 'Plantillas de firmware no disponibles en el servidor' });
  }

  const [baseCode, templateCode] = await Promise.all([
    fs.promises.readFile(path.join(FIRMWARE_DIR, 'base', 'base.ino'), 'utf8'),
    fs.promises.readFile(path.join(FIRMWARE_DIR, 'templates', `${TEMPLATES[type]}.ino`), 'utf8'),
  ]);

  // Certificado CA (opcional) para la conexión TLS del ESP32
  let caCert = '';
  if (config.mqtt.caPath) {
    caCert = await fs.promises.readFile(config.mqtt.caPath, 'utf8')
      .then(c => c.trim())
      .catch(err => {
        logger.warn('No se pudo leer el certificado CA', { error: err.message });
        return '';
      });
  }

  const code = baseCode
    .replace(/"REPLACE_WIFI_SSID"/g, `"${escapeCString(ssid)}"`)
    .replace(/"REPLACE_BROKER_IP"/g, `"${escapeCString(broker)}"`)
    .replace(/"REPLACE_WIFI_PASSWORD"/g, `"${escapeCString(password)}"`)
    .replace(/"REPLACE_DEVICE_ID"/g, `"${escapeCString(deviceId)}"`)
    // El PEM solo contiene base64, guiones y saltos de línea: seguro en raw string
    .replace('REPLACE_CA_CERT', /^[A-Za-z0-9+/=\s-]*$/.test(caCert) && caCert ? `R"EOF(${caCert})EOF"` : '""');

  const finalCode = `${code}\n\n// --- LOGICA ESPECIFICA (${type}) ---\n${templateCode}\n`;

  res.setHeader('Content-Disposition', `attachment; filename="casaiot_${type}_${deviceId}.ino"`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(finalCode);

  logger.info('Firmware generado', { type, deviceId, userId: req.user.userId });
});

module.exports = router;

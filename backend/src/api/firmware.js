'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
const { authMiddleware } = require('../middleware/auth');
const { sanitizeString } = require('../utils/validation');

const router = express.Router();

// ENDPOINT PROTEGIDO: requiere autenticación (sin restricciones de rol)
router.get('/generate', authMiddleware, (req, res) => {
  const { type, deviceId, ssid, broker, password = '' } = req.query;

  // Debug: log parámetros recibidos (ocultando password)
  const debugParams = { type, deviceId: deviceId?.slice(0, 20), ssid, broker: broker?.slice(0, 30), hasPassword: !!password };
  logger.debug('GET /api/firmware/generate - parámetros', debugParams);

  // Validaciones estrictas
  if (!type || !deviceId || !ssid || !broker) {
    logger.warn('Faltan parámetros requeridos', debugParams);
    return res.status(400).json({ error: 'Parámetros requeridos faltando: type, deviceId, ssid, broker' });
  }

  // Validar tipo de firmware
  const validTypes = ['light', 'multi_sala', 'multi_sala_servo'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type inválido. Permitidos: ${validTypes.join(', ')}` });
  }

  // Mapear tipo a nombre de archivo
  const typeMap = {
    'light': 'light_switch',
    'multi_sala': 'multi_sala',
    'multi_sala_servo': 'multi_sala_servo',
  };

  // Sanitizar entrada (previene path traversal)
  const safeDeviceId = sanitizeString(deviceId).slice(0, 100);
  const safeSsid = sanitizeString(ssid).slice(0, 32);
  const safeBroker = sanitizeString(broker).slice(0, 100);
  const safePassword = sanitizeString(password).slice(0, 64);

  const baseFile = path.join(__dirname, '../../firmware/base/base.ino');
  const templateFile = path.join(__dirname, `../../firmware/templates/${typeMap[type]}.ino`);

  // Debug: resolver rutas absolutas para verificar
  logger.debug('Rutas de plantillas resueltas', {
    __dirname,
    baseFile,
    templateFile,
    cwd: process.cwd(),
    existsBase: fs.existsSync(baseFile),
    existsTemplate: fs.existsSync(templateFile),
  });

  try {
    if (!fs.existsSync(baseFile) || !fs.existsSync(templateFile)) {
      const missing = [];
      if (!fs.existsSync(baseFile)) missing.push('base');
      if (!fs.existsSync(templateFile)) missing.push('template');
      logger.error('Archivo(s) de plantilla no encontrado(s)', {
        missing,
        baseFile,
        templateFile,
        dirname: __dirname,
        cwd: process.cwd(),
      });
      return res.status(404).json({
        error: 'Plantilla de firmware no encontrada',
        detail: `Falta(n): ${missing.join(', ')}`,
      });
    }

    let baseCode = fs.readFileSync(baseFile, 'utf8');
    const templateCode = fs.readFileSync(templateFile, 'utf8');

    // Debug: verificar placeholders antes del reemplazo
    const placeholders = ['REPLACE_WIFI_SSID', 'REPLACE_BROKER_IP', 'REPLACE_WIFI_PASSWORD', 'REPLACE_DEVICE_ID', 'REPLACE_CA_CERT'];
    const found = {};
    placeholders.forEach(p => { found[p] = baseCode.includes(p); });
    logger.debug('Placeholders en base.ino', found);

    // Leer certificado CA para inyectar en el firmware
    let caCertContent = '';
    try {
      const caPath = config.mqtt.caPath;
      if (caPath && fs.existsSync(caPath)) {
        caCertContent = fs.readFileSync(caPath, 'utf8').trim();
        logger.debug('Certificado CA leído', { path: caPath, size: caCertContent.length });
      }
    } catch (caErr) {
      logger.warn('No se pudo leer el certificado CA', { error: caErr.message });
    }

    // Reemplazar variables inyectadas (con valores sanitizados)
    baseCode = baseCode.replace(/"REPLACE_WIFI_SSID"/g, `"${safeSsid}"`);
    baseCode = baseCode.replace(/"REPLACE_BROKER_IP"/g, `"${safeBroker}"`);
    baseCode = baseCode.replace(/"REPLACE_WIFI_PASSWORD"/g, `"${safePassword}"`);
    baseCode = baseCode.replace(/"REPLACE_DEVICE_ID"/g, `"${safeDeviceId}"`);
    baseCode = baseCode.replace('REPLACE_CA_CERT', caCertContent
      ? `R"EOF(${caCertContent})EOF"`
      : '""');

    const finalCode = `
${baseCode}

// --- LOGICA ESPECIFICA (${type}) ---
${templateCode}
`;

    res.setHeader('Content-disposition', `attachment; filename=casaiot_${type}_${safeDeviceId}.ino`);
    res.setHeader('Content-type', 'text/plain');
    res.send(finalCode);

    const size = Buffer.byteLength(finalCode, 'utf8');
    logger.info('Firmware generado correctamente', { type, deviceId: safeDeviceId, sizeBytes: size, userId: req.user.userId });
  } catch (err) {
    logger.error('Error generando firmware', { error: err.message, stack: err.stack, type, deviceId });
    res.status(500).json({ error: 'Error al generar firmware', detail: err.message });
  }
});

module.exports = router;

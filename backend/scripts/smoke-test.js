// ─────────────────────────────────────────────────────────────
//  scripts/smoke-test.js — Prueba de humo de seguridad del backend
//
//  Arranca el servidor real con PostgreSQL y MQTT simulados en
//  memoria y comprueba validaciones, roles y que ningún request
//  pueda tumbar el proceso. No necesita Docker.
//  Uso: npm run test:smoke
// ─────────────────────────────────────────────────────────────
'use strict';
const path = require('path');
const BACKEND = path.join(__dirname, '..');
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3999';
process.env.JWT_SECRET = 'x'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'y'.repeat(40);

const r = (p) => require.resolve(path.join(BACKEND, p));
const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const published = [];
let throwOnDevices = false;

const fakeDb = {
  query: async (sql, params = []) => {
    if (/SELECT 1 AS ok/.test(sql)) return { rows: [{ ok: 1 }], rowCount: 1 };
    if (throwOnDevices && /FROM devices/.test(sql)) throw new Error('db caída simulada');
    if (/FROM system_config/.test(sql)) {
      return { rows: [
        { key: 'wifi_ssid', value: 'Mi"Red' },
        { key: 'wifi_password', value: 'secreta' },
        { key: 'mqtt_broker_ip', value: '192.168.1.10' },
      ] };
    }
    if (/SELECT id, type, mqtt_topic_base FROM devices/.test(sql)) {
      return params[0] === DEVICE_ID
        ? { rows: [{ id: DEVICE_ID, type: 'multi_sala_servo', mqtt_topic_base: 'casa/dispositivo/esp1' }] }
        : { rows: [] };
    }
    if (/FROM devices/.test(sql)) return { rows: [], rowCount: 0 };
    if (/FROM users WHERE role = 'admin'/.test(sql)) return { rows: [] };
    if (/EXISTS \(SELECT 1 FROM users\) AS completed/.test(sql)) return { rows: [{ completed: true }] };
    return { rows: [], rowCount: 0 };
  },
  healthCheck: async () => true,
  getClient: async () => { throw new Error('no'); },
  pool: {},
};
require.cache[r('src/db/database.js')] = { id: 'db', filename: 'db', loaded: true, exports: fakeDb };
require.cache[r('src/mqtt/client.js')] = {
  id: 'mqtt', filename: 'mqtt', loaded: true,
  exports: { init() {}, addHandler() {}, isConnected: () => true, publish: (t, p) => { published.push({ t, p }); return true; } },
};

require(path.join(BACKEND, 'src/index.js'));
const jwt = require(path.join(BACKEND, 'node_modules/jsonwebtoken'));
const tok = (role) => jwt.sign({ userId: 1, username: 'u', role }, process.env.JWT_SECRET, { expiresIn: '5m' });

const BASE = 'http://localhost:3999';
async function call(method, url, { body, token, raw } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

let fails = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${cond ? '' : ' ' + extra}`);
  if (!cond) fails++;
}

(async () => {
  await new Promise(res => setTimeout(res, 300));
  const admin = tok('admin'), user = tok('user'), ro = tok('readonly');

  let x = await call('POST', '/api/auth/register', { body: { username: 1, password: 2 } });
  check('register cerrado por defecto → 403', x.status === 403, x.status);

  x = await call('POST', '/api/auth/login', { body: { username: { $ne: 1 }, password: 'a' } });
  check('login con tipos inválidos → 400', x.status === 400, x.status);

  x = await call('POST', '/api/auth/login', { raw: '{malformado' });
  check('JSON malformado → 400 (antes 500)', x.status === 400, x.status);

  x = await call('GET', '/api/devices/no-es-uuid', { token: user });
  check('id de dispositivo inválido → 400', x.status === 400, x.status);

  x = await call('POST', '/api/devices', { token: user, body: { name: 'x', type: 'light', mqttClientId: 'esp/#' } });
  check('mqttClientId con comodines MQTT → 400', x.status === 400, x.status);

  x = await call('POST', '/api/devices', { token: ro, body: { name: 'x', type: 'light', mqttClientId: 'esp1' } });
  check('rol readonly no puede crear → 403', x.status === 403, x.status);

  x = await call('POST', `/api/devices/${DEVICE_ID}/command`, { token: user, body: { action: 'encender', params: { accion: 'abrir_cochera' } } });
  check('params.accion ya no salta la validación → 400', x.status === 400, x.status);

  x = await call('POST', `/api/devices/${DEVICE_ID}/command`, { token: user, body: { action: 'encender', params: { sala: 'cocina' } } });
  const last = published[published.length - 1];
  check('comando válido publica con accion correcta', x.status === 200 && last?.p.accion === 'encender' && last?.p.sala === 'cocina', x.status + ' ' + x.text);

  x = await call('PATCH', '/api/config', { token: user, body: { mqtt_broker_ip: '6.6.6.6' } });
  check('usuario normal no cambia config de red → 403', x.status === 403, x.status);

  x = await call('PATCH', '/api/config', { token: admin, body: { mqtt_broker_ip: 'a b;c' } });
  check('valor de config inválido → 400', x.status === 400, x.status);

  x = await call('GET', '/api/config', { token: user });
  check('GET config no expone la clave WiFi', x.status === 200 && !x.text.includes('secreta') && x.text.includes('"wifi_password_set":true'), x.text);

  x = await call('POST', '/api/firmware/generate', { token: user, body: { type: 'light', deviceId: 'esp1' } });
  check('firmware solo admin → 403', x.status === 403, x.status);

  x = await call('POST', '/api/firmware/generate', { token: admin, body: { type: 'light', deviceId: 'esp1' } });
  check('firmware escapa comillas del SSID', x.status === 200 && x.text.includes('"Mi\\"Red"'), x.status + ' ' + x.text.slice(0, 200));

  x = await call('GET', '/api/firmware/generate?type=light', { token: admin });
  check('GET de firmware (clave en URL) eliminado → 404', x.status === 404, x.status);

  throwOnDevices = true;
  x = await call('GET', '/api/devices', { token: user });
  check('error de BD → 500 controlado', x.status === 500, x.status);
  throwOnDevices = false;

  x = await call('GET', '/health');
  check('el servidor sigue vivo tras los errores', x.status === 200, x.status);

  x = await call('GET', '/api/events?limit=abc', { token: user });
  check('limit no numérico ya no rompe la consulta', x.status === 200, x.status);

  x = await call('GET', '/api/setup/status');
  check('setup/status expone registrationEnabled', x.text.includes('registrationEnabled'), x.text);

  console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLOS`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

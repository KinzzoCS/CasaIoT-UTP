// ─────────────────────────────────────────────────────────────
//  lib/api.js — Cliente HTTP para la API del backend
//
//  Centraliza todas las llamadas HTTP:
//  - Adjunta JWT automáticamente
//  - Renueva el token de forma transparente (con rotación del refresh)
//  - Errores consistentes
//  - Tokens persistidos en localStorage (lecturas cacheadas en memoria)
// ─────────────────────────────────────────────────────────────

'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

// Storage keys
const ACCESS_TOKEN_KEY  = 'casaiot_access_token';
const REFRESH_TOKEN_KEY = 'casaiot_refresh_token';

// Evento global para avisar a la app de que la sesión terminó
// (lo escucha AuthContext; antes se redirigía a /login, ruta que no existe).
export const SESSION_EXPIRED_EVENT = 'casaiot:session-expired';

// ── Token management ─────────────────────────────────────────
// Caché en memoria: localStorage es síncrono y lento (js-cache-storage).
const tokenCache = new Map();

function readStorage(key) {
  if (typeof window === 'undefined') return null;
  if (!tokenCache.has(key)) {
    let value = null;
    try { value = localStorage.getItem(key); } catch { /* modo privado */ }
    tokenCache.set(key, value);
  }
  return tokenCache.get(key);
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  tokenCache.set(key, value);
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* modo privado */ }
}

// Mantener la caché coherente si otra pestaña cambia los tokens
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === ACCESS_TOKEN_KEY || e.key === REFRESH_TOKEN_KEY) tokenCache.delete(e.key);
  });
}

export function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) writeStorage(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) writeStorage(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken() {
  return readStorage(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return readStorage(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  writeStorage(ACCESS_TOKEN_KEY, null);
  writeStorage(REFRESH_TOKEN_KEY, null);
}

export function isAuthenticated() {
  return !!getAccessToken();
}

function endSession() {
  clearTokens();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

// ── Refresh token silencioso ──────────────────────────────────
let refreshPromise = null; // Evita múltiples refreshes simultáneos

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No hay refresh token');

    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      endSession();
      throw new Error('Sesión expirada');
    }

    // El backend rota el refresh token: hay que guardar ambos
    const data = await res.json();
    saveTokens(data);
    return data.accessToken;
  })().finally(() => { refreshPromise = null; });

  return refreshPromise;
}

async function parseError(res) {
  const errData = await res.json().catch(() => ({}));
  return new Error(errData.error || `HTTP ${res.status}`);
}

// ── Fetch base con autenticación y retry ──────────────────────
async function authFetch(path, options = {}, retry = true) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Access token expirado → renovar una vez y reintentar
  if (res.status === 401 && retry) {
    const errData = await res.clone().json().catch(() => ({}));
    if (errData.code === 'TOKEN_EXPIRED') {
      await refreshAccessToken();
      return authFetch(path, options, false);
    }
    if (token) endSession(); // token inválido/firmado con otro secreto
  }

  if (!res.ok) throw await parseError(res);
  return res;
}

async function apiFetch(path, options) {
  const res = await authFetch(path, options);
  if (res.status === 204) return null;
  return res.json();
}

async function publicFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

// ── Endpoints de la API ───────────────────────────────────────
export const api = {
  // Auth (sin token)
  login: (username, password) => publicFetch('/api/auth/login', json('POST', { username, password })),
  register: (username, password) => publicFetch('/api/auth/register', json('POST', { username, password })),
  setupStatus: () => publicFetch('/api/setup/status'),

  logout: (refreshToken) => apiFetch('/api/auth/logout', json('POST', { refreshToken })),
  me: () => apiFetch('/api/auth/me'),

  // Cambiar contraseña revoca todas las sesiones y devuelve una nueva
  changePassword: async (currentPassword, newPassword) => {
    const data = await apiFetch('/api/auth/password', json('PATCH', { currentPassword, newPassword }));
    saveTokens(data);
    return data;
  },

  // Dispositivos
  getDevices: () => apiFetch('/api/devices'),
  getDevice: (id) => apiFetch(`/api/devices/${encodeURIComponent(id)}`),
  createDevice: (data) => apiFetch('/api/devices', json('POST', data)),
  updateDevice: (id, data) => apiFetch(`/api/devices/${encodeURIComponent(id)}`, json('PATCH', data)),
  deleteDevice: (id) => apiFetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  sendCommand: (id, action, params = {}) =>
    apiFetch(`/api/devices/${encodeURIComponent(id)}/command`, json('POST', { action, params })),

  // Firmware (solo admin). La clave WiFi la pone el servidor: nunca viaja en la URL.
  downloadFirmware: async ({ type, deviceId, ssid, broker }) => {
    const res = await authFetch('/api/firmware/generate', json('POST', { type, deviceId, ssid, broker }));
    return res.blob();
  },

  // Eventos
  getEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/events${qs ? '?' + qs : ''}`);
  },
  getRecentEvents: (limit = 10) => apiFetch(`/api/events/recent?limit=${limit}`),

  // Configuración (la contraseña WiFi nunca se devuelve: `wifi_password_set`)
  getConfig: () => apiFetch('/api/config'),
  updateConfig: (data) => apiFetch('/api/config', json('PATCH', data)),

  // Admin — usuarios
  getUsers: () => apiFetch('/api/admin/users'),
  createUser: (data) => apiFetch('/api/admin/users', json('POST', data)),
  updateUser: (id, data) => apiFetch(`/api/admin/users/${id}`, json('PATCH', data)),
  deleteUser: (id) => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),

  // API tokens personales
  getTokens: () => apiFetch('/api/tokens'),
  createToken: (name) => apiFetch('/api/tokens', json('POST', { name })),
  deleteToken: (id) => apiFetch(`/api/tokens/${id}`, { method: 'DELETE' }),

  // Calendario y recordatorios
  getCalendar: (month, year) => apiFetch(`/api/calendar?month=${month}&year=${year}`),
  getReminders: () => apiFetch('/api/reminders'),
  createReminder: (data) => apiFetch('/api/reminders', json('POST', data)),
  dismissReminder: (id) => apiFetch(`/api/reminders/${id}/dismiss`, { method: 'PATCH' }),
  deleteReminder: (id) => apiFetch(`/api/reminders/${id}`, { method: 'DELETE' }),
  getLearning: () => apiFetch('/api/reminders/learning'),

  // Health
  health: () => fetch(`${API_URL}/health`).then(r => r.json()),
};

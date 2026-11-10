// ─────────────────────────────────────────────────────────────
//  lib/api.js — Cliente HTTP para la API del backend
//
//  Centraliza todas las llamadas HTTP:
//  - Adjunta JWT automáticamente
//  - Maneja refresh de token transparentemente
//  - Errores consistentes
//  - PERSISTENCIA: Tokens guardados en localStorage
// ─────────────────────────────────────────────────────────────

'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Storage keys
const ACCESS_TOKEN_KEY  = 'casaiot_access_token';
const REFRESH_TOKEN_KEY = 'casaiot_refresh_token';

// ── Token management (con persistencia en localStorage) ───────
export function saveTokens({ accessToken, refreshToken }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getAccessToken();
}

// ── Refresh token silencioso ──────────────────────────────────
let refreshPromise = null; // Evita múltiples refreshes simultáneos

async function refreshAccessToken() {
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
      clearTokens();
      throw new Error('Refresh token inválido');
    }

    const data = await res.json();
    saveTokens({ accessToken: data.accessToken });
    return data.accessToken;
  })();

  refreshPromise.finally(() => { refreshPromise = null; });
  return refreshPromise;
}

// ── Fetch base con autenticación y retry ──────────────────────
async function apiFetch(path, options = {}, retry = true) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Si el access token expiró, intenta renovarlo silenciosamente
  if (res.status === 401 && retry) {
    const errData = await res.json().catch(() => ({}));
    if (errData.code === 'TOKEN_EXPIRED') {
      try {
        await refreshAccessToken();
        return apiFetch(path, options, false); // Un solo retry
      } catch {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Sesión expirada');
      }
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Endpoints de la API ───────────────────────────────────────
export const api = {
  // Auth — LOGIN sin token (no usa apiFetch)
  login: async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  logout: (refreshToken) =>
    apiFetch('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => apiFetch('/api/auth/me'),

  // Dispositivos
  getDevices: () => apiFetch('/api/devices'),
  getDevice: (id) => apiFetch(`/api/devices/${id}`),
  createDevice: (data) =>
    apiFetch('/api/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id, data) =>
    apiFetch(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDevice: (id) =>
    apiFetch(`/api/devices/${id}`, { method: 'DELETE' }),
  sendCommand: (id, action, params = {}) =>
    apiFetch(`/api/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ action, params }),
    }),

  // Eventos
  getEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/events${qs ? '?' + qs : ''}`);
  },
  getRecentEvents: (limit = 10) =>
    apiFetch(`/api/events/recent?limit=${limit}`),

  // Configuración de red (WiFi, broker)
  getConfig: () => apiFetch('/api/config'),
  updateConfig: (data) =>
    apiFetch('/api/config', { method: 'PATCH', body: JSON.stringify(data) }),

  // Auth — cambio de contraseña
  changePassword: (currentPassword, newPassword) =>
    apiFetch('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Admin — usuarios (solo admin)
  getUsers: () => apiFetch('/api/admin/users'),
  createUser: (data) =>
    apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) =>
    apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id) =>
    apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),

  // API tokens personales
  getTokens: () => apiFetch('/api/tokens'),
  createToken: (name) =>
    apiFetch('/api/tokens', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteToken: (id) =>
    apiFetch(`/api/tokens/${id}`, { method: 'DELETE' }),

  // Calendario y recordatorios
  getCalendar: (month, year) => apiFetch(`/api/calendar?month=${month}&year=${year}`),
  getReminders: () => apiFetch('/api/reminders'),
  createReminder: (data) =>
    apiFetch('/api/reminders', { method: 'POST', body: JSON.stringify(data) }),
  dismissReminder: (id) =>
    apiFetch(`/api/reminders/${id}/dismiss`, { method: 'PATCH' }),
  deleteReminder: (id) =>
    apiFetch(`/api/reminders/${id}`, { method: 'DELETE' }),
  getLearning: () => apiFetch('/api/reminders/learning'),

  // Health
  health: () => fetch(`${API_URL}/health`).then(r => r.json()),
};

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

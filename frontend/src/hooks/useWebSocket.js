'use client';

// ─────────────────────────────────────────────────────────────
//  hooks/useWebSocket.js — Conexión WebSocket compartida
//
//  Una sola conexión para toda la app (singleton de módulo):
//  - Autenticación con JWT (query param)
//  - Reconexión con backoff exponencial + jitter
//  - Si el servidor cierra por token expirado (4001) o rechaza el
//    handshake, se renueva el token antes de reconectar
//  - Listeners por tipo de mensaje (useWebSocketEvent)
//
//  Buenas prácticas aplicadas:
//  - useWebSocketStatus solo re-renderiza cuando cambia el estado de
//    conexión, no con cada mensaje (rerender-defer-reads).
//  - useSyncExternalStore para suscribirse al store externo.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { WS_URL, getAccessToken, refreshAccessToken } from '../lib/api';

const MAX_RECONNECT_DELAY = 30000;  // 30 segundos máximo
const BASE_RECONNECT_DELAY = 1000;  // 1 segundo inicial
const CLOSE_TOKEN_EXPIRED = 4001;   // ver backend/src/ws/gateway.js

let wsInstance = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let manuallyClosed = false;
let connectionState = 'disconnected'; // 'connecting' | 'connected' | 'disconnected'

const messageListeners = new Set();
const stateListeners = new Set();

function setState(state) {
  if (state === connectionState) return;
  connectionState = state;
  stateListeners.forEach(fn => fn());
}

function scheduleReconnect({ refreshFirst }) {
  const delay = Math.min(BASE_RECONNECT_DELAY * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY)
    + Math.random() * 1000;
  reconnectAttempts++;
  reconnectTimeout = setTimeout(async () => {
    reconnectTimeout = null;
    if (refreshFirst) {
      try {
        await refreshAccessToken();
      } catch {
        // Sin tokens = la sesión terminó (AuthContext muestra el login).
        // Con tokens = fallo de red: seguir reintentando con backoff.
        if (getAccessToken()) scheduleReconnect({ refreshFirst: false });
        return;
      }
    }
    connect();
  }, refreshFirst ? 0 : delay);
}

function connect() {
  const token = getAccessToken();
  if (!token) {
    setState('disconnected');
    return;
  }
  if (wsInstance && (wsInstance.readyState === WebSocket.CONNECTING || wsInstance.readyState === WebSocket.OPEN)) return;

  manuallyClosed = false;
  setState('connecting');

  const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);
  let opened = false;
  wsInstance = ws;

  ws.onopen = () => {
    opened = true;
    reconnectAttempts = 0;
    setState('connected');
  };

  ws.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    messageListeners.forEach(fn => fn(data));
  };

  ws.onclose = (event) => {
    if (wsInstance === ws) wsInstance = null;
    setState('disconnected');
    if (manuallyClosed || event.code === 1000) return;

    // 4001 = token expirado. Un cierre sin haber abierto suele ser un 401
    // del handshake: probar a renovar el token una vez antes del backoff.
    const refreshFirst = event.code === CLOSE_TOKEN_EXPIRED || (!opened && reconnectAttempts === 0);
    scheduleReconnect({ refreshFirst });
  };
}

/** Cierra la conexión (logout). No reintenta. */
export function disconnectWebSocket() {
  manuallyClosed = true;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = 0;
  if (wsInstance) {
    wsInstance.close(1000, 'Logout');
    wsInstance = null;
  }
  setState('disconnected');
}

export function sendMessage(message) {
  if (wsInstance?.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function subscribeState(callback) {
  stateListeners.add(callback);
  return () => stateListeners.delete(callback);
}
const getState = () => connectionState;
const getServerState = () => 'disconnected';

// ── Hooks ─────────────────────────────────────────────────────

/** Estado de la conexión. Abre la conexión si aún no existe. */
export function useWebSocketStatus() {
  const state = useSyncExternalStore(subscribeState, getState, getServerState);

  useEffect(() => {
    if (!wsInstance && !reconnectTimeout) connect();
  }, []);

  return { connected: state === 'connected', state };
}

/**
 * Escucha mensajes de un tipo concreto. El callback se guarda en un ref,
 * así que puede cambiar en cada render sin re-suscribirse.
 */
export function useWebSocketEvent(eventType, callback) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler = (data) => {
      if (data.type === eventType) callbackRef.current(data);
    };
    messageListeners.add(handler);
    return () => messageListeners.delete(handler);
  }, [eventType]);
}

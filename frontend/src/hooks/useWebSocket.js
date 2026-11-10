'use client';

// ─────────────────────────────────────────────────────────────
//  hooks/useWebSocket.js — Hook de conexión WebSocket
//
//  Maneja el ciclo de vida completo de la conexión WS:
//  - Conectar con JWT
//  - Reconexión automática con backoff exponencial
//  - Despacho de eventos a listeners registrados
//  - Ping/pong para mantener conexión viva
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_URL, getAccessToken } from '../lib/api';

const MAX_RECONNECT_DELAY = 30000;  // 30 segundos máximo
const BASE_RECONNECT_DELAY = 1000;  // 1 segundo inicial

// Singleton para el WebSocket (compartido entre componentes)
let wsInstance = null;
let listeners = new Set();
let reconnectTimeout = null;
let reconnectAttempts = 0;
let connectionState = 'disconnected'; // 'connecting', 'connected', 'disconnected'
let stateListeners = new Set();

function notifyStateChange(state) {
  connectionState = state;
  stateListeners.forEach(fn => fn(state));
}

function connect() {
  const token = getAccessToken();
  if (!token) {
    notifyStateChange('disconnected');
    return;
  }

  if (wsInstance && wsInstance.readyState === WebSocket.CONNECTING) return;

  notifyStateChange('connecting');

  // Pasar token como query param (compatible con todos los browsers)
  wsInstance = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);

  wsInstance.onopen = () => {
    reconnectAttempts = 0;
    notifyStateChange('connected');
  };

  wsInstance.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      listeners.forEach(fn => fn(data));
    } catch {
      // Mensaje no JSON, ignorar
    }
  };

  wsInstance.onclose = (event) => {
    notifyStateChange('disconnected');
    wsInstance = null;

    // No reconectar si fue cierre limpio (ej: logout)
    if (event.code === 1000) return;

    // Backoff exponencial con jitter
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    ) + Math.random() * 1000;

    reconnectAttempts++;
    reconnectTimeout = setTimeout(connect, delay);
  };

  wsInstance.onerror = () => {
    // onclose se disparará después, no hacer nada extra aquí
  };
}

function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (wsInstance) {
    wsInstance.close(1000, 'Logout');
    wsInstance = null;
  }
  notifyStateChange('disconnected');
}

function sendMessage(message) {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function sendBinary(data) {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.send(data);
    return true;
  }
  return false;
}

// ── Hook React ────────────────────────────────────────────────
export function useWebSocket() {
  const [connected, setConnected] = useState(connectionState === 'connected');
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    // Suscribirse a cambios de estado de conexión
    const stateHandler = (state) => setConnected(state === 'connected');
    stateListeners.add(stateHandler);

    // Suscribirse a mensajes
    const messageHandler = (data) => setLastMessage(data);
    listeners.add(messageHandler);

    // Iniciar conexión si no existe
    if (!wsInstance || wsInstance.readyState === WebSocket.CLOSED) {
      connect();
    }

    return () => {
      stateListeners.delete(stateHandler);
      listeners.delete(messageHandler);
    };
  }, []);

  return { connected, lastMessage, sendMessage, sendBinary, connect, disconnect };
}

// ── Hook con filtro de tipo de mensaje ────────────────────────
export function useWebSocketEvent(eventType, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (data) => {
      if (data.type === eventType) {
        callbackRef.current(data);
      }
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, [eventType]);
}

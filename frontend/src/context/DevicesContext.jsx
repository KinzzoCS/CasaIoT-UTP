'use client';

// ─────────────────────────────────────────────────────────────
//  context/DevicesContext.jsx — Estado de dispositivos compartido
//
//  Antes cada componente que llamaba a useDevices() (Navigation,
//  Dashboard, Dispositivos, Calendario...) hacía su propio GET
//  /api/devices y mantenía su propia copia: peticiones duplicadas y
//  estados desincronizados (un comando desde la barra de voz no se
//  reflejaba en la página). Ahora hay una sola fuente de verdad,
//  una sola petición y una sola suscripción WebSocket
//  (client-swr-dedup / client-event-listeners).
// ─────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useWebSocketEvent } from '../hooks/useWebSocket';

const DevicesContext = createContext(null);

// Regex a nivel de módulo (js-hoist-regexp)
const STATE_TOPIC_RE = /dispositivo\/([^/]+)\/estado$/;

function optimisticState(action, params) {
  if (params.state) return params.state;
  if (action === 'encender') return 'on';
  if (action === 'apagar') return 'off';
  return null;
}

export function DevicesProvider({ children }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await api.getDevices());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Estado en tiempo real: "casa/dispositivo/{clientId}/estado"
  useWebSocketEvent('mqtt_message', (data) => {
    const match = data.topic?.match(STATE_TOPIC_RE);
    if (!match) return;
    const clientId = match[1];
    const lastSeen = new Date().toISOString();

    setDevices(prev => prev.map(d => (
      d.mqtt_client_id === clientId
        ? { ...d, is_online: true, last_state: data.payload, last_seen: lastSeen }
        : d
    )));
  });

  const sendCommand = useCallback(async (deviceId, action, params = {}) => {
    try {
      const result = await api.sendCommand(deviceId, action, params);
      const newState = optimisticState(action, params);
      setDevices(prev => prev.map(d => (
        d.id === deviceId
          ? { ...d, last_state: { ...d.last_state, state: newState, estado: newState, action, params } }
          : d
      )));
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({ devices, loading, error, refetch, loadDevices: refetch, sendCommand }),
    [devices, loading, error, refetch, sendCommand]
  );

  return <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>;
}

export function useDevicesContext() {
  const ctx = useContext(DevicesContext);
  if (!ctx) throw new Error('useDevices debe usarse dentro de DevicesProvider');
  return ctx;
}

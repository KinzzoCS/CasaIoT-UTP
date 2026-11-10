'use client';

// ─────────────────────────────────────────────────────────────
//  hooks/useDevices.js — Hook para gestión de dispositivos
//
//  Centraliza la lógica de:
//  - Obtener lista de dispositivos
//  - Enviar comandos
//  - Actualizar estado en tiempo real vía WebSocket
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useWebSocketEvent } from './useWebSocket';

export function useDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const devicesRef = useRef(devices);

  // Actualizar referencia cuando devices cambia
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // Cargar dispositivos inicialmente
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Alias para refetch (compatibilidad)
  const refetch = useCallback(() => {
    return loadDevices();
  }, [loadDevices]);

  // Escuchar actualizaciones de estado vía WebSocket
  useWebSocketEvent('mqtt_message', useCallback((data) => {
    // Extraer deviceId del topic: "casa/dispositivo/{id}/estado"
    const match = data.topic?.match(/dispositivo\/([^/]+)\/estado/);
    if (!match) return;

    const deviceId = match[1];
    const mqttPayload = data.payload;

    // Buscar el dispositivo y actualizar su estado
    setDevices(prevDevices =>
      prevDevices.map(d =>
        d.mqtt_client_id === deviceId
          ? {
              ...d,
              is_online: true,
              last_state: mqttPayload,
              last_seen: new Date().toISOString(),
            }
          : d
      )
    );
  }, []));

  // Enviar comando a un dispositivo
  const sendCommand = useCallback(async (deviceId, action, params = {}) => {
    console.log('[DEBUG] sendCommand hook', { deviceId, action, params });
    try {
      const result = await api.sendCommand(deviceId, action, params);
      console.log('[DEBUG] sendCommand API response', result);
      // Actualizar optimistamente en el UI
      const newState = params.state || (action === 'encender' ? 'on' : action === 'apagar' ? 'off' : null);
      setDevices(prev =>
        prev.map(d =>
          d.id === deviceId
            ? { ...d, last_state: { ...d.last_state, state: newState, estado: newState, action, params } }
            : d
        )
      );
      return result;
    } catch (err) {
      console.error('[DEBUG] sendCommand hook error', err.message);
      setError(err.message);
      throw err;
    }
  }, []);

  // Obtener un dispositivo específico
  const getDevice = useCallback((id) => {
    return devicesRef.current.find(d => d.id === id);
  }, []);

  // Obtener dispositivos por ubicación
  const getDevicesByLocation = useCallback((location) => {
    return devicesRef.current.filter(d => d.location === location);
  }, []);

  return {
    devices,
    loading,
    error,
    loadDevices,
    refetch,
    sendCommand,
    getDevice,
    getDevicesByLocation,
  };
}

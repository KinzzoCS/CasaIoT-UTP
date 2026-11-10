'use client';

// ─────────────────────────────────────────────────────────────
//  hooks/useDevices.js — Acceso a los dispositivos
//
//  Fachada sobre DevicesContext: estado compartido por toda la app,
//  una sola petición y una sola suscripción WebSocket.
//  Devuelve { devices, loading, error, refetch, loadDevices, sendCommand }.
// ─────────────────────────────────────────────────────────────

export { useDevicesContext as useDevices } from '../context/DevicesContext';

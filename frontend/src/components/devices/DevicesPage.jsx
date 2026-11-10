'use client';

// ─────────────────────────────────────────────────────────────
//  DevicesPage.jsx — Gestión de Dispositivos ESP32
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useDevices } from '../../hooks/useDevices';
import { api } from '../../lib/api';
import FirmwareInstructionsModal from './FirmwareInstructionsModal';
import { 
  Power, AlertCircle, Wifi, WifiOff, 
  Lightbulb, Trash2, Plus, Check, X, Loader, Home, Download
} from 'lucide-react';

const S = {
  section: { marginBottom: 'var(--space-8)' },
  sectionTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 'var(--space-4)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 'var(--space-4)',
  },
  deviceCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--space-5)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    transition: 'all var(--transition-fast)',
  },
  deviceHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-4)',
  },
  deviceName: {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-2)',
  },
  deviceType: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
  },
  controls: {
    display: 'flex',
    gap: 'var(--space-2)',
    marginTop: 'var(--space-4)',
    paddingTop: 'var(--space-4)',
    borderTop: '1px solid var(--border-subtle)',
  },
  button: (variant = 'primary') => ({
    flex: 1,
    padding: 'var(--space-3)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    ...(variant === 'primary' && {
      background: 'var(--accent)',
      color: 'white',
    }),
    ...(variant === 'secondary' && {
      background: 'var(--bg-primary)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-subtle)',
    }),
    ...(variant === 'danger' && {
      background: 'rgba(239, 68, 68, 0.1)',
      color: 'var(--color-danger)',
    }),
  }),
};

async function downloadFirmware(mqttClientId, type, ssid, broker, wifiPassword = '') {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const token = typeof window !== 'undefined' ? localStorage.getItem('casaiot_access_token') : null;
  if (!token) { alert('Error: No hay sesión activa'); return; }

  try {
    const url = `${baseUrl}/api/firmware/generate?type=${type}&deviceId=${mqttClientId}&ssid=${encodeURIComponent(ssid)}&broker=${encodeURIComponent(broker)}&password=${encodeURIComponent(wifiPassword)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error desconocido al descargar firmware' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `casaiot_${type}_${mqttClientId}.ino`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err) {
    alert(`Error al descargar firmware: ${err.message}`);
  }
}

function getDeviceIcon(type) {
  const icons = {
    'light': Lightbulb,
    'multi_sala': Home,
    'multi_sala_servo': Home,
  };
  return icons[type] || Lightbulb;
}

function getDeviceLabel(type) {
  const labels = {
    'light': 'LED',
    'multi_sala': 'Multi-sala',
    'multi_sala_servo': 'Multi-sala + Cochera',
  };
  return labels[type] || type;
}

function isLED(type) {
  return type === 'light' || type === 'led';
}

function isMultiSala(type) {
  return type === 'multi_sala';
}

function isMultiSalaServo(type) {
  return type === 'multi_sala_servo';
}

function DeviceCard({ device, onToggle, onMultiSalaToggle, onServoToggle, onDelete, onReDownload }) {
  const Icon = getDeviceIcon(device.type);
  const isOnline = device.is_online;
  
  const lastState = device.last_state || {};
  const isOn = lastState === 'on' || lastState === '1' ||
    (typeof lastState === 'object' && (lastState?.state === 'on' || lastState?.estado === 'on'));

  const salas = lastState?.salas || {};
  const cocheraAbierta = lastState?.cochera === true || salas?.cochera === true;

  const ROOMS = isMultiSalaServo(device.type)
    ? [
        { key: 'sala', label: 'Sala' },
        { key: 'cocina', label: 'Cocina' },
        { key: 'cuarto', label: 'Cuarto' },
      ]
    : [
        { key: 'cocina', label: 'Cocina' },
        { key: 'cuarto', label: 'Cuarto' },
        { key: 'cochera', label: 'Cochera' },
      ];

  return (
    <div style={S.deviceCard} className="hover-scale">
      <div style={S.deviceHeader}>
        <div>
          <div style={S.deviceName}>{device.name}</div>
          <div style={S.deviceType}>{getDeviceLabel(device.type)}</div>
        </div>
        <div style={{
          ...S.statusBadge,
          background: isOnline ? 'var(--color-success-bg)' : 'rgba(107, 114, 128, 0.1)',
          color: isOnline ? 'var(--color-success)' : 'var(--text-muted)',
        }}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isOnline ? 'En línea' : 'Offline'}
        </div>
      </div>

      {/* Estado actual — LED simple */}
      {isLED(device.type) && (
        <div style={{
          padding: 'var(--space-3)',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
        }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Estado actual
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: isOn ? 'var(--color-success)' : 'var(--text-muted)',
            }} />
            <span style={{ fontWeight: '600', color: isOn ? 'var(--color-success)' : 'var(--text-muted)' }}>
              {isOn ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      )}

      {/* Controles — LED simple */}
      {isLED(device.type) && (
        <div style={S.controls}>
          <button
            style={S.button('primary')}
            onClick={() => onToggle(device.id, 'on')}
            disabled={!isOnline}
          >
            <Power size={16} />
            Encender
          </button>
          <button
            style={S.button('secondary')}
            onClick={() => onToggle(device.id, 'off')}
            disabled={!isOnline}
          >
            <Power size={16} />
            Apagar
          </button>
        </div>
      )}

      {/* Controles — Multi-sala */}
      {(isMultiSala(device.type) || isMultiSalaServo(device.type)) && (
        <div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}>
            {ROOMS.map(room => {
              const roomOn = salas[room.key] === true;
              return (
                <div
                  key={room.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: roomOn ? 'var(--color-blue-50)' : 'var(--bg-primary)',
                  }}
                >
                  <span style={{
                    fontWeight: '600',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                  }}>
                    {room.label}
                  </span>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      width: 44,
                      height: 24,
                      cursor: isOnline ? 'pointer' : 'not-allowed',
                      opacity: isOnline ? 1 : 0.5,
                      flexShrink: 0,
                      zIndex: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={roomOn}
                      onChange={() => isOnline && onMultiSalaToggle(device.id, room.key, !roomOn)}
                      disabled={!isOnline}
                      style={{ display: 'none' }}
                    />
                    <span style={{
                      width: 44,
                      height: 24,
                      borderRadius: 24,
                      background: roomOn ? 'var(--color-success)' : '#ccc',
                      position: 'relative',
                      transition: 'background 0.3s',
                      pointerEvents: 'none',
                    }}>
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        left: roomOn ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'white',
                        transition: 'all 0.3s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        pointerEvents: 'none',
                      }} />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              style={{
                ...S.button('primary'),
                fontSize: 'var(--text-xs)',
              }}
              onClick={() => onMultiSalaToggle(device.id, 'todas', true)}
              disabled={!isOnline}
            >
              Todas Encendido
            </button>
            <button
              style={{
                ...S.button('secondary'),
                fontSize: 'var(--text-xs)',
              }}
              onClick={() => onMultiSalaToggle(device.id, 'todas', false)}
              disabled={!isOnline}
            >
              Todas Apagado
            </button>
          </div>
        </div>
      )}

      {/* Controles — Servo Cochera */}
      {isMultiSalaServo(device.type) && (
        <div style={{
          marginTop: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
          }}>
            <span style={{
              fontWeight: '600',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
            }}>
              Cochera
            </span>
            <span style={{
              fontSize: 'var(--text-xs)',
              fontWeight: '600',
              color: cocheraAbierta ? 'var(--color-success)' : 'var(--text-muted)',
            }}>
              {cocheraAbierta ? 'ABIERTA (0°)' : 'CERRADA (90°)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              style={{ ...S.button('primary'), fontSize: 'var(--text-xs)' }}
              onClick={() => onServoToggle(device.id, true)}
              disabled={!isOnline}
            >
              Abrir Cochera
            </button>
            <button
              style={{ ...S.button('secondary'), fontSize: 'var(--text-xs)' }}
              onClick={() => onServoToggle(device.id, false)}
              disabled={!isOnline}
            >
              Cerrar Cochera
            </button>
          </div>
        </div>
      )}

      {/* Re-descargar firmware */}
      <button
        style={{
          ...S.button('secondary'),
          marginTop: 'var(--space-3)',
        }}
        onClick={() => onReDownload(device)}
      >
        <Download size={16} />
        Re-descargar firmware
      </button>

      {/* Botón eliminar */}
      <button
        style={{
          ...S.button('danger'),
          marginTop: 'var(--space-3)',
        }}
        onClick={() => onDelete(device.id)}
      >
        <Trash2 size={16} />
        Eliminar
      </button>
    </div>
  );
}

function NewDeviceForm({ onAdd, onDeviceCreated }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'light',
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const [currentDevice, setCurrentDevice] = useState(null);

  async function handleSubmit() {
    if (!form.name) {
      alert('Completa el nombre del dispositivo');
      return;
    }

    setLoading(true);
    try {
      // Generar ID automático para dispositivo + timestamp
      const timestamp = Date.now().toString().slice(-6);
      const prefix = form.type === 'multi_sala' ? 'esp32_sala' : form.type === 'multi_sala_servo' ? 'esp32_servo' : 'esp32_luz';
      const mqttClientId = `${prefix}_${timestamp}`;

      // Crear dispositivo usando el cliente API (maneja auth automáticamente)
      const device = await api.createDevice({
        name: form.name,
        type: form.type,
        location: form.name.toLowerCase(),
        mqttClientId: mqttClientId,
      });

      // Obtener config de red desde la API
      let netConfig = { wifi_ssid: '', wifi_password: '', mqtt_broker_ip: '' };
      try {
        netConfig = await api.getConfig();
      } catch {
        netConfig = {
          wifi_ssid: process.env.NEXT_PUBLIC_WIFI_SSID || 'TuSSID',
          mqtt_broker_ip: process.env.NEXT_PUBLIC_MQTT_BROKER || '192.168.1.100',
        };
      }

      // Guardar datos para mostrar en modal
      setCurrentDevice({
        name: device.name,
        type: device.type,
        mqttClientId: device.mqtt_client_id,
        ssid: netConfig.wifi_ssid || process.env.NEXT_PUBLIC_WIFI_SSID || 'TuSSID',
        broker: netConfig.mqtt_broker_ip || process.env.NEXT_PUBLIC_MQTT_BROKER || '192.168.1.100',
      });

      // Descargar firmware automáticamente con config de red actual
      downloadFirmware(
        device.mqtt_client_id,
        device.type,
        netConfig.wifi_ssid || process.env.NEXT_PUBLIC_WIFI_SSID || 'TuSSID',
        netConfig.mqtt_broker_ip || process.env.NEXT_PUBLIC_MQTT_BROKER || '192.168.1.100',
        netConfig.wifi_password || ''
      );

      // Mostrar modal con instrucciones
      setShowInstructions(true);

      // Resetear formulario
      setForm({ name: '', type: form.type });
      setShow(false);

      // Notificar al padre
      if (onDeviceCreated) onDeviceCreated(device);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!show) {
    return (
      <>
        <button
          style={{
            width: '100%',
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-lg)',
            border: '2px dashed var(--border-subtle)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-base)',
            fontWeight: '600',
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => setShow(true)}
        >
          <Plus size={20} />
          Agregar Dispositivo
        </button>
        {currentDevice && (
          <FirmwareInstructionsModal
            isOpen={showInstructions}
            deviceName={currentDevice.name}
            deviceType={currentDevice.type}
            deviceMqttClientId={currentDevice.mqttClientId}
            deviceSsid={currentDevice.ssid}
            deviceBroker={currentDevice.broker}
            onClose={() => setShowInstructions(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="card animate-slide-up" style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
          Nuevo Dispositivo ESP32
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              Nombre del dispositivo
            </label>
            <input
              className="input"
              placeholder="ej: Luz Sala"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              Tipo de dispositivo
            </label>
            <select
              className="input"
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="light">💡 LED simple</option>
              <option value="multi_sala">🏠 Multi-sala (3 ambientes)</option>
              <option value="multi_sala_servo">🚪 Multi-sala + Cochera (Servo)</option>
            </select>
          </div>

          <div style={{
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-warning)',
          }}>
            <strong>📥 Descarga automática:</strong> El firmware se descargará con la config de red guardada en <strong>Configuración → Seguridad → Red</strong>. Luego verás las instrucciones de instalación.
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              style={{
                ...S.button('primary'),
                flex: 1,
                opacity: loading ? 0.6 : 1,
                pointerEvents: loading ? 'none' : 'auto',
              }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
              {loading ? 'Creando...' : 'Crear y Descargar'}
            </button>
            <button
              style={{ ...S.button('secondary'), flex: 1 }}
              onClick={() => setShow(false)}
              disabled={loading}
            >
              <X size={16} />
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {currentDevice && (
        <FirmwareInstructionsModal
          isOpen={showInstructions}
          deviceName={currentDevice.name}
          deviceType={currentDevice.type}
          deviceMqttClientId={currentDevice.mqttClientId}
          deviceSsid={currentDevice.ssid}
          deviceBroker={currentDevice.broker}
          onClose={() => setShowInstructions(false)}
        />
      )}
    </>
  );
}

export default function DevicesPage() {
  const { devices, loading, error, sendCommand, refetch } = useDevices();

  async function handleReDownload(device) {
    try {
      const netConfig = await api.getConfig();
      downloadFirmware(
        device.mqtt_client_id,
        device.type,
        netConfig.wifi_ssid || process.env.NEXT_PUBLIC_WIFI_SSID || 'TuSSID',
        netConfig.mqtt_broker_ip || process.env.NEXT_PUBLIC_MQTT_BROKER || '192.168.1.100',
        netConfig.wifi_password || ''
      );
    } catch {
      alert('No se pudo obtener la configuración de red. Configúrala en Ajustes primero.');
    }
  }

  async function handleToggle(deviceId, state) {
    const action = state === 'on' ? 'encender' : 'apagar';
    await sendCommand(deviceId, action, { state });
  }

  async function handleMultiSalaToggle(deviceId, sala, encender) {
    console.log('[DEBUG] handleMultiSalaToggle', { deviceId, sala, encender });
    try {
      if (sala === 'todas') {
        const action = encender ? 'todas_on' : 'todas_off';
        console.log('[DEBUG] sendCommand (todas)', { action });
        await sendCommand(deviceId, action);
      } else {
        const action = encender ? 'encender' : 'apagar';
        console.log('[DEBUG] sendCommand (sala)', { action, sala });
        await sendCommand(deviceId, action, { sala });
      }
      console.log('[DEBUG] sendCommand OK');
    } catch (err) {
      console.error('[DEBUG] Error en comando multi-sala:', err);
    }
  }

  async function handleServoToggle(deviceId, abrir) {
    const action = abrir ? 'abrir_cochera' : 'cerrar_cochera';
    await sendCommand(deviceId, action);
  }

  async function handleDelete(deviceId) {
    if (!confirm('¿Eliminar este dispositivo?')) return;
    
    try {
      await api.deleteDevice(deviceId);
      refetch();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }

  function handleDeviceCreated(device) {
    refetch();
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--space-5)' }} className="card">
        <AlertCircle size={32} style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }} />
        <p style={{ color: 'var(--color-danger)', fontWeight: '500' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <NewDeviceForm onDeviceCreated={handleDeviceCreated} />

      <section style={S.section}>
        <p style={S.sectionTitle}>
          Dispositivos ESP32 ({devices.length})
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid var(--color-gray-200)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto',
            }} />
          </div>
        ) : devices.length === 0 ? (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}>
            <Lightbulb size={40} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}>
              No hay dispositivos registrados
            </p>
          </div>
        ) : (
          <div style={S.grid}>
            {devices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onToggle={handleToggle}
                onMultiSalaToggle={handleMultiSalaToggle}
                onServoToggle={handleServoToggle}
                onDelete={handleDelete}
                onReDownload={handleReDownload}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

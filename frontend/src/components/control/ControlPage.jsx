'use client';

// ─────────────────────────────────────────────────────────────
//  ControlPage.jsx — Control de dispositivos
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useDevices } from '../../hooks/useDevices';
import { Lightbulb, Power, Radio } from 'lucide-react';

const S = {
  sectionTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 'var(--space-4)',
    marginTop: 'var(--space-8)',
  },
  deviceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-4)',
  },
  deviceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition-normal)',
  },
};

const DEVICE_CONFIG = {
  light: { icon: Lightbulb, label: 'Luz', color: 'var(--color-warning)' },
};

function LightCard({ device, onCommand }) {
  const [loading, setLoading] = useState(false);
  const isOn = device.last_state?.encendido === true;
  const cfg  = DEVICE_CONFIG.light;
  const Icon = cfg.icon;

  async function toggle() {
    if (!device.is_online) return;
    setLoading(true);
    await onCommand(device.id, isOn ? 'apagar' : 'encender');
    setLoading(false);
  }

  return (
    <div className="card animate-slide-up hover-scale" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={S.deviceHeader}>
        <div style={S.deviceInfo}>
          <div style={{
            ...S.deviceIcon,
            background: isOn ? 'var(--color-warning-bg)' : 'var(--bg-primary)',
            color: isOn ? 'var(--color-warning)' : 'var(--text-muted)',
          }}>
            <Icon size={24} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
              {device.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {device.location} · {device.is_online ? 'En línea' : 'Desconectado'}
            </div>
          </div>
        </div>

        {/* Toggle switch */}
        <label className="switch" style={{ opacity: device.is_online ? 1 : 0.5 }}>
          <input
            type="checkbox"
            checked={isOn}
            onChange={toggle}
            disabled={!device.is_online || loading}
          />
          <div className="switch-track" />
          <div className="switch-thumb" />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div className={`status-dot status-dot--${device.is_online ? (isOn ? 'online' : 'offline') : 'offline'}`} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: '500' }}>
          {!device.is_online ? 'Sin conexión' : isOn ? 'Encendido' : 'Apagado'}
        </span>
      </div>
    </div>
  );
}

export default function ControlPage() {
  const { devices, loading, sendCommand } = useDevices();

  const lights = devices.filter(d => d.type === 'light');

  if (loading) {
    return (
      <div>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ height: 100, marginBottom: 'var(--space-4)', opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  if (lights.length === 0) {
    return (
      <div style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <Radio size={48} color="var(--text-muted)" style={{ marginBottom: 'var(--space-4)' }} />
        <p style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
          Sin luces registradas
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Agrega una luz desde Ajustes
        </p>
      </div>
    );
  }

  return (
    <div>
      <section>
        <p style={S.sectionTitle}>Luces</p>
        {lights.map(d => <LightCard key={d.id} device={d} onCommand={sendCommand} />)}
      </section>
    </div>
  );
}

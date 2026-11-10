'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Globe, MapPin, Clock, Wifi, User, Shield, FileText,
  Save, Check, Copy, Trash2, X, Plus, ChevronRight, AlertTriangle,
  Users, Terminal, ToggleLeft, ToggleRight, ExternalLink, Key
} from 'lucide-react';
import { api } from '../../lib/api';

const S = {
  tabBar: {
    display: 'flex',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-6)',
    overflowX: 'auto',
    paddingBottom: 'var(--space-2)',
    scrollbarWidth: 'none',
  },
  tab: (active) => ({
    padding: '8px 16px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-sm)',
    fontWeight: active ? '600' : '500',
    color: active ? 'var(--color-red)' : 'var(--text-secondary)',
    background: active ? 'var(--color-red-bg)' : 'var(--bg-card)',
    border: `1px solid ${active ? 'var(--color-red)' : 'var(--border-subtle)'}`,
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    whiteSpace: 'nowrap',
  }),
  sectionTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 'var(--space-4)',
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    padding: 'var(--space-5)',
    marginBottom: 'var(--space-4)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    marginTop: '6px',
    boxSizing: 'border-box',
  },
  label: {
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    color: 'var(--text-primary)',
    display: 'block',
    marginBottom: '4px',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    marginTop: '6px',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  btn: (color = 'var(--accent)') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: 'var(--radius-md)',
    background: color,
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    transition: 'all var(--transition-fast)',
  }),
  btnSmall: (color = 'var(--accent)') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    background: color,
    color: 'white',
    border: 'none',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    transition: 'all var(--transition-fast)',
  }),
  btnOutline: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    transition: 'all var(--transition-fast)',
  },
  modal: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 'var(--space-5)',
  },
  modalOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    position: 'relative',
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
};

const TIMEZONES = [
  'America/Mexico_City', 'America/Monterrey', 'America/Tijuana',
  'America/Cancun', 'America/Hermosillo', 'America/Chihuahua',
  'America/Merida', 'America/Guadalajara',
  'America/Argentina/Buenos_Aires', 'America/Santiago',
  'America/Bogota', 'America/Lima', 'America/Sao_Paulo',
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage',
  'Europe/Madrid', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
  'UTC', 'GMT',
];

const CITIES = [
  { name: '—— Chihuahua ——', lat: '', lng: '', disabled: true },
  { name: 'Chihuahua', lat: 28.6353, lng: -106.0889, tz: 'America/Chihuahua' },
  { name: 'Parral (Hidalgo del Parral)', lat: 26.9318, lng: -105.6667, tz: 'America/Chihuahua' },
  { name: 'Santa Bárbara', lat: 26.8036, lng: -105.8206, tz: 'America/Chihuahua' },
  { name: 'Jiménez', lat: 27.1308, lng: -104.9194, tz: 'America/Chihuahua' },
  { name: 'Ciudad Juárez', lat: 31.6904, lng: -106.4245, tz: 'America/Chihuahua' },
  { name: 'Cuauhtémoc', lat: 28.4089, lng: -106.8631, tz: 'America/Chihuahua' },
  { name: 'Delicias', lat: 28.1901, lng: -105.4701, tz: 'America/Chihuahua' },
  { name: 'Nuevo Casas Grandes', lat: 30.4178, lng: -107.9113, tz: 'America/Chihuahua' },
  { name: 'Camargo', lat: 27.6869, lng: -105.1694, tz: 'America/Chihuahua' },
  { name: 'Ojinaga', lat: 29.5644, lng: -104.4126, tz: 'America/Chihuahua' },
  { name: 'Aldama', lat: 28.8397, lng: -105.8844, tz: 'America/Chihuahua' },
  { name: 'Meoqui', lat: 28.2734, lng: -105.4820, tz: 'America/Chihuahua' },
  { name: 'Saucillo', lat: 28.0325, lng: -105.2928, tz: 'America/Chihuahua' },
  { name: 'Guachochi', lat: 26.8190, lng: -107.0730, tz: 'America/Chihuahua' },
  { name: 'Madera', lat: 29.2017, lng: -108.1486, tz: 'America/Chihuahua' },
  { name: 'Creel (Bocoyna)', lat: 27.7500, lng: -107.6333, tz: 'America/Chihuahua' },
  { name: '—— Otros estados ——', lat: '', lng: '', disabled: true },
  { name: 'Ciudad de México', lat: 19.4326, lng: -99.1332, tz: 'America/Mexico_City' },
  { name: 'Monterrey, NL', lat: 25.6866, lng: -100.3161, tz: 'America/Monterrey' },
  { name: 'Guadalajara, Jal', lat: 20.6597, lng: -103.3496, tz: 'America/Mexico_City' },
  { name: 'Cancún, QR', lat: 21.1619, lng: -86.8515, tz: 'America/Cancun' },
  { name: 'Hermosillo, Son', lat: 29.0722, lng: -110.9559, tz: 'America/Hermosillo' },
  { name: 'Tijuana, BC', lat: 32.5149, lng: -117.0382, tz: 'America/Tijuana' },
  { name: 'Mérida, Yuc', lat: 20.9674, lng: -89.5926, tz: 'America/Merida' },
  { name: '—— Personalizada ——', lat: '', lng: '', disabled: true },
  { name: '✏️ Escribir manualmente', lat: '', lng: '', custom: true },
];

function RegionalTab() {
  const [form, setForm] = useState({ timezone: 'America/Mexico_City', location: '', lat: '', lng: '', selectedCity: '' });
  const [customMode, setCustomMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getConfig(),
      fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => ({})),
    ]).then(([cfg, geo]) => {
      const loc = cfg.location;
      const locObj = typeof loc === 'string' ? (() => { try { return JSON.parse(loc); } catch { return {}; } })() : (loc || {});
      const name = locObj.name || geo.city || '';
      const lat = locObj.lat || geo.latitude || '';
      const lng = locObj.lng || geo.longitude || '';
      const match = CITIES.find(c => c.name === name);
      setForm({
        timezone: cfg.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
        location: name,
        lat: String(lat),
        lng: String(lng),
        selectedCity: match ? name : '',
      });
      setCustomMode(!match);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function handleCitySelect(name) {
    const city = CITIES.find(c => c.name === name);
    if (!city || city.disabled) return;
    if (city.custom) { setCustomMode(true); return; }
    setCustomMode(false);
    setForm(p => ({
      ...p,
      location: city.name,
      lat: String(city.lat),
      lng: String(city.lng),
      selectedCity: city.name,
      timezone: city.tz || p.timezone,
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateConfig({
        timezone: form.timezone,
        location: { name: form.location, lat: parseFloat(form.lat) || 0, lng: parseFloat(form.lng) || 0, source: 'manual' },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();
  const tzTime = form.timezone
    ? now.toLocaleString('es-MX', { timeZone: form.timezone, hour: '2-digit', minute: '2-digit', hour12: true })
    : '--';

  if (loading) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>Cargando...</div>;

  return (
    <div className="animate-fade">
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-red-bg)', color: 'var(--color-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={20} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: '600', color: 'var(--text-primary)' }}>Configuración regional</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={S.label}>Ciudad</label>
            <select style={S.select} value={customMode ? '__custom__' : form.selectedCity}
              onChange={e => handleCitySelect(e.target.value)}>
              <option value="" disabled>Selecciona una ciudad</option>
              {CITIES.map((c, i) =>
                c.disabled ? (
                  <option key={i} disabled style={{ fontWeight: '600', background: 'var(--color-gray-100)' }}>{c.name}</option>
                ) : (
                  <option key={c.name} value={c.name}>{c.name}</option>
                )
              )}
            </select>
          </div>

          {customMode && (
            <div>
              <label style={S.label}>Nombre de ubicación</label>
              <input style={S.input} placeholder="ej: Mi Casa"
                value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={S.label}>Latitud</label>
              <input style={S.input} placeholder="28.6353" type="number" step="any"
                value={form.lat} onChange={e => setForm(p => ({ ...p, lat: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Longitud</label>
              <input style={S.input} placeholder="-106.0889" type="number" step="any"
                value={form.lng} onChange={e => setForm(p => ({ ...p, lng: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={S.label}>Zona horaria</label>
            <select style={S.select} value={form.timezone}
              onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} /> Hora actual: <strong>{tzTime}</strong>
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{
          ...S.btn(saved ? 'var(--color-success)' : 'var(--accent)'),
          marginTop: 'var(--space-4)',
          opacity: saving ? 0.6 : 1,
        }}>
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar configuración regional'}
        </button>
      </div>
    </div>
  );
}

function NetworkTab() {
  const [form, setForm] = useState({ wifi_ssid: '', wifi_password: '', mqtt_broker_ip: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getConfig().then(data => {
      setForm({
        wifi_ssid: data.wifi_ssid || '',
        wifi_password: data.wifi_password || '',
        mqtt_broker_ip: data.mqtt_broker_ip || '',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>Cargando...</div>;

  return (
    <div className="animate-fade">
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-red-bg)', color: 'var(--color-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wifi size={20} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: '600' }}>Red WiFi</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Se inyectan al descargar firmware</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label style={S.label}>SSID</label>
            <input style={S.input} placeholder="ej: IZZI-C500" value={form.wifi_ssid}
              onChange={e => setForm(p => ({ ...p, wifi_ssid: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Contraseña WiFi</label>
            <input style={S.input} type="password" placeholder="Contraseña" value={form.wifi_password}
              onChange={e => setForm(p => ({ ...p, wifi_password: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>IP del servidor (Broker MQTT)</label>
            <input style={S.input} placeholder="ej: 192.168.0.6" value={form.mqtt_broker_ip}
              onChange={e => setForm(p => ({ ...p, mqtt_broker_ip: e.target.value }))} />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          ...S.btn(saved ? 'var(--color-success)' : 'var(--accent)'),
          marginTop: 'var(--space-4)',
          opacity: saving ? 0.6 : 1,
        }}>
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar configuración de red'}
        </button>
      </div>
    </div>
  );
}

function UsersPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

  const load = () => {
    setLoading(true);
    api.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createUser(newUser);
      setShowModal(false);
      setNewUser({ username: '', password: '', role: 'user' });
      load();
    } catch (err) { alert(`Error: ${err.message}`); }
  }

  async function handleToggleActive(id, current) {
    try { await api.updateUser(id, { is_active: !current }); load(); }
    catch (err) { alert(`Error: ${err.message}`); }
  }

  async function handleDelete(id, username) {
    if (!confirm(`¿Eliminar a "${username}"? No se puede deshacer.`)) return;
    try { await api.deleteUser(id); load(); }
    catch (err) { alert(`Error: ${err.message}`); }
  }

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
        <Shield size={32} style={{ marginBottom: 'var(--space-3)', opacity: 0.5 }} />
        <div>Solo el administrador puede gestionar usuarios</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={S.sectionTitle}>Usuarios del sistema ({users.length})</div>
        <button style={S.btnSmall('var(--accent)')} onClick={() => setShowModal(true)}>
          <Plus size={14} /> Agregar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>Sin usuarios</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {users.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              opacity: u.is_active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: u.is_active ? 'var(--accent)' : 'var(--color-gray-200)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 'var(--text-xs)', fontWeight: '700',
                }}>
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600' }}>
                    {u.username}
                    {u.id === user.id && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: '6px' }}>(tú)</span>}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {u.role === 'admin' ? 'Administrador' : 'Usuario'} &middot; {u.active_sessions || 0} sesión(es)
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {u.id !== user.id && (
                  <>
                    <button style={S.btnOutline} onClick={() => handleToggleActive(u.id, u.is_active)} title={u.is_active ? 'Desactivar' : 'Activar'}>
                      {u.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button style={{ ...S.btnOutline, color: 'var(--color-danger)' }} onClick={() => handleDelete(u.id, u.username)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={S.modal}>
          <div style={S.modalOverlay} onClick={() => setShowModal(false)} />
          <div style={S.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: '600' }}>Nuevo usuario</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={S.label}>Usuario</label>
                <input style={S.input} placeholder="ej: juan" required minLength={3}
                  value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Contraseña</label>
                <input style={S.input} type="password" required minLength={6}
                  value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Rol</label>
                <select style={S.select} value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button type="submit" style={{ ...S.btn('var(--accent)'), marginTop: 'var(--space-2)' }}>
                Crear usuario
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TokensPanel() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    api.getTokens().then(setTokens).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    try {
      const result = await api.createToken(newTokenName.trim());
      setCreatedToken(result);
      setNewTokenName('');
      load();
    } catch (err) { alert(`Error: ${err.message}`); }
  }

  function handleCopy() {
    if (!createdToken) return;
    navigator.clipboard.writeText(createdToken.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(id) {
    if (!confirm('¿Revocar este token? Las integraciones que lo usen dejarán de funcionar.')) return;
    try { await api.deleteToken(id); load(); }
    catch (err) { alert(`Error: ${err.message}`); }
  }

  return (
    <div>
      <div style={S.sectionTitle}>Tokens de API</div>
      <div style={{ ...S.card, marginBottom: 'var(--space-3)' }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input style={{ ...S.input, marginTop: 0, flex: 1 }} placeholder="Nombre del token (ej: esp32-cocina)"
            value={newTokenName} onChange={e => setNewTokenName(e.target.value)} />
          <button type="submit" style={S.btnSmall('var(--accent)')}>
            <Plus size={14} /> Generar
          </button>
        </form>
      </div>

      {createdToken && (
        <div style={{ ...S.card, border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--color-warning)' }}>
              Token generado — cópialo ahora, no se mostrará de nuevo
            </span>
          </div>
          <div style={{
            background: 'var(--bg-primary)', padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)', fontFamily: 'monospace',
            fontSize: 'var(--text-xs)', wordBreak: 'break-all',
            marginBottom: 'var(--space-3)',
          }}>
            {createdToken.token}
          </div>
          <button onClick={handleCopy} style={S.btnSmall('var(--accent)')}>
            <Copy size={14} /> {copied ? 'Copiado' : 'Copiar token'}
          </button>
          <button onClick={() => setCreatedToken(null)} style={{ ...S.btnOutline, marginLeft: 'var(--space-2)' }}>
            <X size={14} /> Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : tokens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>
          No tienes tokens de API
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {tokens.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600' }}>{t.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Creado {new Date(t.created_at).toLocaleDateString('es-MX')}
                  {t.last_used && ` · Último uso: ${new Date(t.last_used).toLocaleDateString('es-MX')}`}
                </div>
              </div>
              <button style={{ ...S.btnOutline, color: 'var(--color-danger)' }} onClick={() => handleRevoke(t.id)}>
                <Trash2 size={14} /> Revocar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangePasswordPanel() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);

    if (form.newPassword.length < 6) {
      setResult({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setResult({ type: 'error', message: 'Las contraseñas no coinciden' });
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(form.currentPassword, form.newPassword);
      setResult({ type: 'success', message: 'Contraseña actualizada' });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ ...S.card, marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Key size={20} />
        </div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: '600' }}>Cambiar contraseña</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div>
          <label style={S.label}>Contraseña actual</label>
          <input style={S.input} type="password" required
            value={form.currentPassword}
            onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))} />
        </div>
        <div>
          <label style={S.label}>Nueva contraseña</label>
          <input style={S.input} type="password" required minLength={6}
            value={form.newPassword}
            onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))} />
        </div>
        <div>
          <label style={S.label}>Confirmar nueva contraseña</label>
          <input style={S.input} type="password" required
            value={form.confirmPassword}
            onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} />
        </div>

        {result && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            background: result.type === 'success' ? 'rgba(30,200,100,0.1)' : 'rgba(228,30,63,0.08)',
            color: result.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            {result.message}
          </div>
        )}

        <button type="submit" disabled={saving} style={{
          ...S.btn('var(--accent)'),
          opacity: saving ? 0.6 : 1,
        }}>
          <Save size={16} /> {saving ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="animate-fade">
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={S.sectionTitle}>Contraseña</div>
        <ChangePasswordPanel />
      </section>
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={S.sectionTitle}>Usuarios</div>
        <UsersPanel />
      </section>
      <section>
        <div style={S.sectionTitle}>API Tokens</div>
        <TokensPanel />
      </section>
    </div>
  );
}

function LegalTab() {
  return (
    <div className="animate-fade">
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-gray-100)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: '600' }}>Avisos legales</div>
          </div>
        </div>

        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.7 }}>
          <h3 style={{ margin: '16px 0 8px', fontSize: 'var(--text-base)' }}>1. Exención de responsabilidad</h3>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            CasaIoT es un sistema de automatización del hogar diseñado para uso personal y educativo. 
            El software se proporciona "tal cual", sin garantía de ningún tipo, expresa o implícita, 
            incluyendo pero no limitándose a las garantías de funcionamiento ininterrumpido, 
            seguridad absoluta o ausencia de errores.
          </p>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            El usuario asume toda la responsabilidad por el uso del sistema, incluyendo:
            daños a dispositivos conectados, cortocircuitos, sobrecargas eléctricas, 
            pérdida de conectividad, accesos no autorizados, y cualquier otro incidente 
            derivado de la operación del sistema.
          </p>

          <h3 style={{ margin: '16px 0 8px', fontSize: 'var(--text-base)' }}>2. Privacidad</h3>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            CasaIoT opera completamente en tu infraestructura local. No se envía información 
            a servidores externos. Los datos de configuración, credenciales WiFi, contraseñas 
            y tokens de API se almacenan en tu base de datos PostgreSQL local.
          </p>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Es tu responsabilidad mantener seguros los siguientes elementos:
          </p>
          <ul style={{ marginBottom: '12px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
            <li>Las credenciales de acceso al panel web</li>
            <li>Los tokens de API generados para integraciones</li>
            <li>Las contraseñas de la red WiFi configurada en los dispositivos</li>
            <li>Los certificados TLS del broker MQTT</li>
          </ul>

          <h3 style={{ margin: '16px 0 8px', fontSize: 'var(--text-base)' }}>3. Seguridad</h3>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Recomendaciones de seguridad mínimas:
          </p>
          <ul style={{ marginBottom: '12px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
            <li>Cambia la contraseña por defecto del administrador inmediatamente</li>
            <li>Usa contraseñas fuertes para todos los usuarios</li>
            <li>Mantén el sistema actualizado con las últimas versiones</li>
            <li>No expongas el panel web directamente a internet sin un reverse proxy con HTTPS</li>
            <li>Realiza respaldos periódicos de la base de datos</li>
          </ul>

          <h3 style={{ margin: '16px 0 8px', fontSize: 'var(--text-base)' }}>4. Licencia</h3>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            MIT License - Copyright (c) 2024
          </p>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Se concede permiso, de forma gratuita, a cualquier persona que obtenga una copia 
            de este software y los archivos de documentación asociados, para tratar el Software 
            sin restricción, incluyendo sin limitación los derechos de usar, copiar, modificar, 
            fusionar, publicar, distribuir, sublicenciar y/o vender copias del Software.
          </p>

          <h3 style={{ margin: '16px 0 8px', fontSize: 'var(--text-base)' }}>5. Dispositivos IoT</h3>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Los dispositivos ESP32 y similares conectados al sistema operan en tu red local. 
            Es tu responsabilidad asegurar que:
          </p>
          <ul style={{ marginBottom: '12px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
            <li>Los dispositivos están actualizados con el firmware más reciente</li>
            <li>Las conexiones MQTT utilizan TLS cuando sea posible</li>
            <li>Los dispositivos no son accesibles desde internet a menos que uses una VPN</li>
            <li>Los pines GPIO se manejan con cuidado para evitar daños eléctricos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'regional',  label: 'Regional' },
  { id: 'network',   label: 'Red' },
  { id: 'security',  label: 'Seguridad' },
  { id: 'legal',     label: 'Legal' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('regional');

  const content = {
    regional:  <RegionalTab />,
    network:   <NetworkTab />,
    security:  <SecurityTab />,
    legal:     <LegalTab />,
  };

  return (
    <div>
      <div style={S.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={S.tab(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {content[activeTab]}
    </div>
  );
}

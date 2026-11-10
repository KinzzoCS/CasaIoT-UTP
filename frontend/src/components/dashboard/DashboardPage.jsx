'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useDevices } from '../../hooks/useDevices';
import { api } from '../../lib/api';
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog,
  Droplets, Wind, ChevronRight, ChevronDown, Sparkles,
  Zap, ArrowUpRight, AlertTriangle, Radio, Circle, Lightbulb,
  Moon, Sunrise, Sunset, RefreshCw, CalendarDays, ShoppingCart,
  DollarSign, TrendingUp, Gift, Power, Wifi, WifiOff, Home,
} from 'lucide-react';

const S = {
  section: { marginBottom: 'var(--space-6)' },
  sectionTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 'var(--space-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    padding: 'var(--space-5)',
  },
  eventIcon: {
    width: 36, height: 36,
    borderRadius: 'var(--radius-full)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
};

function getWeatherIcon(code, size = 24) {
  if (code <= 1) return { icon: Sun, color: '#f59e0b' };
  if (code <= 3) return { icon: Cloud, color: '#94a3b8' };
  if (code <= 48) return { icon: CloudFog, color: '#cbd5e1' };
  if (code <= 57) return { icon: Droplets, color: '#3b82f6' };
  if (code <= 67) return { icon: CloudRain, color: '#6366f1' };
  if (code <= 77) return { icon: CloudSnow, color: '#93c5fd' };
  if (code <= 82) return { icon: CloudRain, color: '#4f46e5' };
  if (code <= 86) return { icon: CloudSnow, color: '#7dd3fc' };
  return { icon: CloudLightning, color: '#7c3aed' };
}

function weatherDescription(code) {
  if (code === 0) return 'Despejado';
  if (code === 1) return 'Mayormente despejado';
  if (code <= 3) return 'Nublado';
  if (code <= 48) return 'Niebla';
  if (code <= 57) return 'Llovizna';
  if (code <= 67) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  if (code <= 82) return 'Chubascos';
  if (code <= 86) return 'Nieve';
  return 'Tormenta';
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 6) return 'madrugada';
  if (h < 12) return 'mañana';
  if (h < 14) return 'mediodía';
  if (h < 19) return 'tarde';
  return 'noche';
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const RECOMMENDATIONS = [
  { icon: Sun, text: 'Aprovecha la luz natural, abre las cortinas', time: ['mañana', 'mediodía'] },
  { icon: Sun, text: 'Es buen momento para ventilar la casa', time: ['mañana'] },
  { icon: Droplets, text: 'Revisa que las plantas tengan agua', time: ['mañana', 'tarde'] },
  { icon: Moon, text: 'Revisa que puertas y ventanas estén cerradas', time: ['noche', 'madrugada'] },
  { icon: Moon, text: 'Baja la intensidad de las luces para descansar', time: ['noche'] },
  { icon: Lightbulb, text: 'Apaga luces de habitaciones vacías', time: ['mañana', 'tarde', 'noche'] },
  { icon: Zap, text: 'Desconecta dispositivos que no uses', time: ['noche', 'madrugada'] },
  { icon: Sunrise, text: 'Empieza el día con energía, abre las cortinas', time: ['mañana'] },
  { icon: Sunset, text: 'Se acerca la noche, prepara la iluminación', time: ['tarde'] },
  { icon: Cloud, text: 'Clima fresco, ideal para salir a caminar', time: ['mañana', 'tarde'] },
  { icon: Sparkles, text: 'Hoy es un buen día para organizar tu hogar', time: ['mañana', 'mediodía', 'tarde'] },
  { icon: Sparkles, text: 'Recuerda respaldar la configuración del sistema', time: ['tarde', 'noche'] },
];

function WeatherCard() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWeather = useCallback(async () => {
    try {
      const cfg = await api.getConfig();
      const locRaw = cfg.location;
      if (!locRaw) { setLoading(false); return; }
      const loc = typeof locRaw === 'string' ? (() => { try { return JSON.parse(locRaw); } catch { return {}; } })() : locRaw;
      if (!loc.lat || !loc.lng) { setLoading(false); return; }
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`
      );
      const data = await res.json();
      setWeather(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  if (loading) return null;

  return (
    <div style={S.card}>
      {!weather ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Configura tu ubicación en Ajustes &gt; Regional para ver el clima
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {(() => { const w = getWeatherIcon(weather.current.weather_code); const Icon = w.icon;
                return <div style={{ color: w.color }}><Icon size={40} strokeWidth={1.5} /></div>;
              })()}
              <div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', lineHeight: 1 }}>
                  {Math.round(weather.current.temperature_2m)}°
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Sensación {Math.round(weather.current.apparent_temperature)}°
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <div>{weatherDescription(weather.current.weather_code)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                <Droplets size={12} /> {weather.current.relative_humidity_2m}% <Wind size={12} /> {Math.round(weather.current.wind_speed_10m)} km/h
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            {weather.daily.time.slice(0, 3).map((day, i) => {
              const isToday = i === 0;
              const w = getWeatherIcon(weather.daily.weather_code[i]);
              const Icon = w.icon;
              const dayName = isToday ? 'Hoy' : new Date(day).toLocaleDateString('es-MX', { weekday: 'short' });
              return (
                <div key={day} style={{
                  flex: 1, textAlign: 'center', padding: 'var(--space-2)',
                  background: i === 0 ? 'var(--color-red-bg)' : 'transparent',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>{dayName}</div>
                  <Icon size={18} style={{ color: w.color }} />
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600', marginTop: '2px' }}>
                    {Math.round(weather.daily.temperature_2m_max[i])}° / {Math.round(weather.daily.temperature_2m_min[i])}°
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function RecommendationsCard() {
  const [index, setIndex] = useState(0);
  const tod = getTimeOfDay();
  const tips = RECOMMENDATIONS.filter(r => r.time.includes(tod));

  if (tips.length === 0) return null;

  const tip = tips[index % tips.length];
  const Icon = tip.icon;

  return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: 'pointer' }}
      onClick={() => setIndex(i => i + 1)}>
      <div style={{ color: 'var(--color-warning)', flexShrink: 0 }}>
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <div style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {tip.text}
      </div>
      <RefreshCw size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  );
}

function EventTypeIcon({ type }) {
  const config = {
    state_change: { bg: 'var(--color-red-bg)',   color: 'var(--color-red)', icon: Zap },
    command:      { bg: 'var(--color-success-bg)', color: 'var(--color-success)',  icon: ArrowUpRight },
    alert:        { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)',  icon: AlertTriangle },
    sensor_data:  { bg: 'rgba(139,92,246,0.1)',    color: '#8b5cf6',               icon: Radio },
    default:      { bg: 'var(--color-gray-100)',   color: 'var(--color-gray-500)', icon: Circle },
  };
  const cfg = config[type] || config.default;
  const Icon = cfg.icon;
  return (
    <div style={{ ...S.eventIcon, background: cfg.bg, color: cfg.color }}>
      <Icon size={18} strokeWidth={2.5} />
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Nunca';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)  return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatPayload(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { return payload; }
  }
  if (payload.accion) return `Comando: ${payload.accion}`;
  if (payload.estado === 'on' || payload.estado === 'off') return `Estado: ${payload.estado === 'on' ? 'Encendido' : 'Apagado'}`;
  if (payload.state === 'on' || payload.state === 'off') return `Estado: ${payload.state === 'on' ? 'Encendido' : 'Apagado'}`;
  if (payload.mensaje) return payload.mensaje;
  if (payload.nivel) return `[${payload.nivel}] ${payload.mensaje || ''}`;
  if (payload.tipo) return `${payload.tipo}: ${payload.valor ?? ''}`;
  return JSON.stringify(payload).slice(0, 60);
}

function EventsSection() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.getRecentEvents(showAll ? 50 : 5).then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false));
  }, [showAll]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <p style={S.sectionTitle}>Actividad reciente</p>
        <button onClick={() => setShowAll(v => !v)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: '600',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          {showAll ? 'Mostrar menos' : 'Ver detalle completo'}
          {showAll ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Cargando...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Sin actividad reciente
          </div>
        ) : (
          events.map((event, i) => (
            <div key={event.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
              padding: 'var(--space-3) 0',
              borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            }}>
              <EventTypeIcon type={event.event_type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1px' }}>
                  {event.device_name || 'Sistema'}
                  {event.location ? <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}> &middot; {event.location}</span> : ''}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {formatPayload(event.payload)}
                </div>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0, fontWeight: '500' }}>
                {timeAgo(event.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function QuickAccessSection() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getLearning().then(setData).catch(() => {});
  }, []);

  const weekTotal = data?.categoryTotals?.reduce((s, c) => s + (parseFloat(c.total) || 0), 0) || 0;

  return (
    <div>
      <p style={S.sectionTitle}>
        <CalendarDays size={14} /> Próximos 7 días &middot; Presupuesto semanal
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div style={S.card}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
            Vencimientos próximos
          </div>
          {!data ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: 'var(--space-2)' }}>Cargando...</div>
          ) : data.upcomingWeek?.length === 0 ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: 'var(--space-2)' }}>
              <CalendarDays size={20} style={{ opacity: 0.3, marginBottom: 4 }} />
              <div>Sin vencimientos esta semana</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {data.upcomingWeek?.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)',
                  background: r.category === 'finanzas' ? '#fce4ec' : r.category === 'salud' ? '#e8f5e9' : '#f5f5f5',
                  fontSize: 'var(--text-xs)',
                }}>
                  <span style={{ fontWeight: '500' }}>{r.title}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {r.amount && <span style={{ fontWeight: '600', marginRight: 6 }}>${Number(r.amount).toFixed(0)}</span>}
                    {new Date(r.due_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
            Gastos del período
          </div>
          {!data ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Cargando...</div>
          ) : data.categoryTotals?.filter(c => c.total).length === 0 ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <DollarSign size={20} style={{ opacity: 0.3, marginBottom: 4 }} />
              <div>Sin gastos registrados</div>
            </div>
          ) : (
            <>
              {data.categoryTotals?.filter(c => c.total).slice(0, 4).map((c, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)',
                }}>
                  <span>{c.category}</span>
                  <span style={{ fontWeight: '600' }}>${Number(c.total).toFixed(0)}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0',
                fontSize: 'var(--text-xs)', fontWeight: '700', marginTop: 'var(--space-1)',
              }}>
                <span>Total</span>
                <span>${weekTotal.toFixed(0)}</span>
              </div>
            </>
          )}
          {data?.subtypeAverages?.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>
                Promedios por servicio
              </div>
              {data.subtypeAverages.slice(0, 3).map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', padding: '2px 0' }}>
                  <span>{s.subtype}</span>
                  <span>${Number(s.avg_amount).toFixed(0)}/mes</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { connected } = useWebSocket();
  const { devices, loading: devicesLoading, sendCommand } = useDevices();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.health().then(setHealth).catch(() => setHealth({ status: 'error' }));
    const interval = setInterval(() => {
      api.health().then(setHealth).catch(() => setHealth({ status: 'error' }));
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const onlineDevices = devices.filter(d => d.is_online).length;
  const totalDevices = devices.length;
  const mqttOk = health?.services?.mqtt === 'ok';
  const [clock, setClock] = useState('');

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: '700', marginBottom: '4px' }}>
              {getGreeting()}, {user?.username || 'usuario'}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              &nbsp;&middot;&nbsp;
              {connected ? (mqttOk ? 'Sistema operativo' : 'Broker desconectado') : 'Sin conexión'}
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-4xl)', fontWeight: '300', letterSpacing: '0.02em', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {clock}
          </div>
        </div>
      </div>

      <section style={S.section}>
        <WeatherCard />
      </section>

      <section style={S.section}>
        <RecommendationsCard />
      </section>

      <section style={S.section}>
        <QuickAccessSection />
      </section>

      <section style={S.section}>
        <EventsSection />
      </section>

      <section style={S.section}>
        <p style={S.sectionTitle}>Dispositivos</p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}>
          <div className="card hover-scale" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>En línea</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', color: 'var(--color-success)' }}>
              {devicesLoading ? '...' : onlineDevices}
            </div>
          </div>
          <div className="card hover-scale" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Totales</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: '700' }}>
              {devicesLoading ? '...' : totalDevices}
            </div>
          </div>
        </div>

        {!devicesLoading && devices.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)',
          }}>
            {devices.map(device => {
              const isOnline = device.is_online;
              const lastState = device.last_state || {};
              const salas = lastState?.salas || {};

              async function handleToggle(state) {
                try {
                  const action = state === 'on' ? 'encender' : 'apagar';
                  await sendCommand(device.id, action, { state });
                } catch (err) {
                  console.error('Error al enviar comando:', err);
                }
              }

              async function handleSalaToggle(sala, encender) {
                try {
                  if (sala === 'todas') {
                    await sendCommand(device.id, encender ? 'todas_on' : 'todas_off');
                  } else {
                    await sendCommand(device.id, encender ? 'encender' : 'apagar', { sala });
                  }
                } catch (err) {
                  console.error('Error al enviar comando sala:', err);
                }
              }

              async function handleServoToggle(abrir) {
                try {
                  await sendCommand(device.id, abrir ? 'abrir_cochera' : 'cerrar_cochera');
                } catch (err) {
                  console.error('Error al enviar comando cochera:', err);
                }
              }

              const isServoType = device.type === 'multi_sala_servo';
              const ROOMS = isServoType
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

              const isMultiSala = device.type === 'multi_sala' || isServoType;
              const isLight = device.type === 'light' || device.type === 'led';
              const cocheraAbierta = lastState?.cochera === true || salas?.cochera === true;

              return (
                <div key={device.id} style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  padding: 'var(--space-4)',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 'var(--space-3)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {isMultiSala ? <Home size={18} style={{ color: 'var(--accent)' }} /> : <Lightbulb size={18} style={{ color: 'var(--accent)' }} />}
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600' }}>{device.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {isServoType ? 'Multi-sala + Cochera' : isMultiSala ? 'Multi-sala' : 'LED'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: 'var(--text-xs)', fontWeight: '600',
                      color: isOnline ? 'var(--color-success)' : 'var(--text-muted)',
                    }}>
                      {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {isOnline ? 'En línea' : 'Offline'}
                    </div>
                  </div>

                  {isLight && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        style={{
                          flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                          background: 'var(--accent)', color: 'white', border: 'none',
                          fontWeight: '600', fontSize: 'var(--text-xs)', cursor: 'pointer',
                          opacity: isOnline ? 1 : 0.5,
                        }}
                        disabled={!isOnline}
                        onClick={() => handleToggle('on')}
                      >
                        <Power size={14} style={{ marginRight: 4, display: 'inline' }} />
                        Encender
                      </button>
                      <button
                        style={{
                          flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)', fontWeight: '600',
                          fontSize: 'var(--text-xs)', cursor: 'pointer',
                          opacity: isOnline ? 1 : 0.5,
                        }}
                        disabled={!isOnline}
                        onClick={() => handleToggle('off')}
                      >
                        <Power size={14} style={{ marginRight: 4, display: 'inline' }} />
                        Apagar
                      </button>
                    </div>
                  )}

                  {isMultiSala && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {ROOMS.map(room => {
                        const roomOn = salas[room.key] === true;
                        return (
                          <div
                            key={room.key}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: 'var(--space-1) var(--space-3)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                              background: roomOn ? 'var(--color-blue-50)' : 'var(--bg-primary)',
                            }}
                          >
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-primary)' }}>
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
                                onChange={() => isOnline && handleSalaToggle(room.key, !roomOn)}
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
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                        <button
                          style={{
                            flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                            background: 'var(--accent)', color: 'white', border: 'none',
                            fontWeight: '600', fontSize: 'var(--text-xs)', cursor: 'pointer',
                            opacity: isOnline ? 1 : 0.5,
                          }}
                          disabled={!isOnline}
                          onClick={() => handleSalaToggle('todas', true)}
                        >
                          Todas Encendido
                        </button>
                        <button
                          style={{
                            flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)', fontWeight: '600',
                            fontSize: 'var(--text-xs)', cursor: 'pointer',
                            opacity: isOnline ? 1 : 0.5,
                          }}
                          disabled={!isOnline}
                          onClick={() => handleSalaToggle('todas', false)}
                        >
                          Todas Apagado
                        </button>
                      </div>
                    </div>
                  )}

                  {isServoType && (
                    <div style={{
                      marginTop: 'var(--space-3)',
                      padding: 'var(--space-2)',
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 'var(--space-1)',
                      }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-primary)' }}>
                          Cochera
                        </span>
                        <span style={{
                          fontSize: 'var(--text-xs)', fontWeight: '600',
                          color: cocheraAbierta ? 'var(--color-success)' : 'var(--text-muted)',
                        }}>
                          {cocheraAbierta ? 'ABIERTA (0°)' : 'CERRADA (90°)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          style={{
                            flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                            background: 'var(--accent)', color: 'white', border: 'none',
                            fontWeight: '600', fontSize: 'var(--text-xs)', cursor: 'pointer',
                            opacity: isOnline ? 1 : 0.5,
                          }}
                          disabled={!isOnline}
                          onClick={() => handleServoToggle(true)}
                        >
                          Abrir
                        </button>
                        <button
                          style={{
                            flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)', fontWeight: '600',
                            fontSize: 'var(--text-xs)', cursor: 'pointer',
                            opacity: isOnline ? 1 : 0.5,
                          }}
                          disabled={!isOnline}
                          onClick={() => handleServoToggle(false)}
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

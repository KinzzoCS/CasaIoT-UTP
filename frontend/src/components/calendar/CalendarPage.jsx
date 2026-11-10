'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useDevices } from '../../hooks/useDevices';
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Circle,
  Lightbulb, DollarSign, Zap, AlertTriangle, Gift, ShoppingCart,
  Calendar as CalIcon, Inbox, Trash2,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'general',     label: 'General',        icon: Circle },
  { value: 'finanzas',    label: 'Finanzas',       icon: DollarSign },
  { value: 'despensa',    label: 'Despensa',       icon: ShoppingCart },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: Zap },
  { value: 'salud',       label: 'Salud',          icon: AlertTriangle },
  { value: 'cumpleaños',  label: 'Cumpleaños',     icon: Gift },
];

const FINANZAS_SUBTYPES = [
  { value: 'luz',      label: 'Luz' },
  { value: 'agua',     label: 'Agua' },
  { value: 'internet', label: 'Internet' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'renta',    label: 'Renta' },
  { value: 'seguro',   label: 'Seguro' },
  { value: 'otro',     label: 'Otro' },
];

const UNITS = ['pieza', 'kg', 'litro', 'paquete', 'caja', 'botella'];

const REPEAT_OPTIONS = [
  { value: 'none',     label: 'No repetir' },
  { value: 'weekly',   label: 'Cada semana' },
  { value: 'every2weeks', label: 'Cada 2 semanas' },
  { value: 'monthly',  label: 'Cada mes' },
  { value: 'every2months', label: 'Cada 2 meses' },
  { value: 'every3months', label: 'Cada 3 meses' },
  { value: 'every4months', label: 'Cada 4 meses' },
  { value: 'every6months', label: 'Cada 6 meses' },
  { value: 'yearly',   label: 'Cada año' },
];

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function categoryColor(cat) {
  const map = {
    finanzas:     { bg: '#fce4ec', text: '#c62828' },
    mantenimiento:{ bg: '#fff3e0', text: '#e65100' },
    salud:        { bg: '#e8f5e9', text: '#2e7d32' },
    cumpleaños:   { bg: '#f3e5f5', text: '#7b1fa2' },
    despensa:     { bg: '#e1f5fe', text: '#01579b' },
    general:      { bg: '#f5f5f5', text: '#666' },
  };
  return map[cat] || map.general;
}

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' },
  monthNav: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' },
  monthTitle: { fontSize: 'var(--text-xl)', fontWeight: '700', minWidth: 180, textAlign: 'center' },
  navBtn: { width: 36, height: 36, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', cursor: 'pointer', background: 'white' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  dayHeader: { padding: 'var(--space-2) var(--space-1)', textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-primary)' },
  dayCell: (isToday, isOther) => ({ minHeight: 80, padding: 'var(--space-1)', background: isToday ? '#fce4ec' : 'white', cursor: 'pointer', position: 'relative', opacity: isOther ? 0.3 : 1 }),
  dayNum: { fontSize: 'var(--text-sm)', fontWeight: '600', marginBottom: '2px' },
  sidebar: { background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', minWidth: 300, maxHeight: 520, overflowY: 'auto' },
  card: { background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-2)' },
  modal: { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' },
  modalContent: { position: 'relative', background: 'white', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflow: 'auto' },
};

export default function CalendarPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', category:'general', amount:'', repeat_type:'none', repeat_interval:1, due_date:'', details:{} });
  const [learning, setLearning] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getCalendar(month, year).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => { api.getLearning().then(setLearning).catch(() => {}); }, []);

  const daysInMonth = data?.daysInMonth || new Date(year, month, 0).getDate();
  const startDay = data?.startDay ?? new Date(year, month - 1, 1).getDay();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const eventsByDay = {};
  if (data) {
    [...(data.reminders || []), ...(data.events || [])].forEach(item => {
      const day = new Date(item.date).getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(item);
    });
  }

  function prevM() { setMonth(p => { const m = p === 1 ? 12 : p - 1; if (p === 1) setYear(y => y - 1); return m; }); setSelectedDay(null); }
  function nextM() { setMonth(p => { const m = p === 12 ? 1 : p + 1; if (p === 12) setYear(y => y + 1); return m; }); setSelectedDay(null); }

  async function createReminder(e) {
    e.preventDefault();
    try {
      const payload = {
        title: form.title, description: form.description, category: form.category,
        amount: form.amount ? parseFloat(form.amount) : null,
        repeat_type: form.repeat_type,
        repeat_interval: form.repeat_type !== 'none' ? (parseInt(form.repeat_interval, 10) || 1) : null,
        due_date: form.due_date,
        details: form.details || {},
      };
      await api.createReminder(payload);
      setShowModal(false);
      setForm({ title:'', description:'', category:'general', amount:'', repeat_type:'none', repeat_interval:1, due_date:'', details:{} });
      api.getCalendar(month, year).then(setData).catch(() => {});
      api.getLearning().then(setLearning).catch(() => {});
    } catch (err) { alert(`Error: ${err.message}`); }
  }

  async function dismissReminder(id) {
    try { await api.dismissReminder(id); api.getCalendar(month, year).then(setData).catch(() => {}); api.getLearning().then(setLearning).catch(() => {}); }
    catch (err) { alert(`Error: ${err.message}`); }
  }

  function openFormForDay(day) {
    setForm(f => ({ ...f, due_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }));
    setShowModal(true);
  }

  const dayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];
  const totalEvents = data ? (data.reminders?.length || 0) + (data.events?.length || 0) : 0;

  return (
    <div className="animate-fade">
      <div style={s.header}>
        <div style={s.monthNav}>
          <button style={s.navBtn} onClick={prevM}><ChevronLeft size={18} /></button>
          <div style={s.monthTitle}>{MONTHS[month - 1]} {year}</div>
          <button style={s.navBtn} onClick={nextM}><ChevronRight size={18} /></button>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => openFormForDay(selectedDay || 1)}>
          <Plus size={14} /> Recordatorio
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.grid}>
            {DAYS.map(d => <div key={d} style={s.dayHeader}>{d}</div>)}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`e${i}`} style={s.dayCell(false, true)}>
                <div style={s.dayNum}>{prevMonthDays - startDay + i + 1}</div>
              </div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = today.getDate() === day && today.getMonth() + 1 === month && today.getFullYear() === year;
              const items = eventsByDay[day] || [];
              return (
                <div key={day} style={s.dayCell(isToday, false)} onClick={() => setSelectedDay(day)}>
                  <div style={{ ...s.dayNum, color: isToday ? 'var(--color-red)' : 'var(--text-primary)' }}>{day}</div>
                  {items.slice(0, 2).map((ev, j) => {
                    const cat = ev.category || 'general';
                    const cc = categoryColor(cat);
                    return (
                      <div key={j} style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500', background: cc.bg, color: cc.text }}>
                        {ev.name || ev.device_name || ev.type}
                      </div>
                    );
                  })}
                  {items.length > 2 && <div style={{ fontSize: '8px', color: 'var(--text-muted)', paddingLeft: '2px' }}>+{items.length - 2}</div>}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <span>{data?.onlineDevices ?? '--'} en línea</span>
            <span>{totalEvents} eventos</span>
          </div>
        </div>

        {loading ? (
          <div style={s.sidebar}><div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando...</div></div>
        ) : selectedDay ? (
          <DaySidebar day={selectedDay} month={month} year={year} events={dayEvents} onDismiss={dismissReminder} onNew={() => openFormForDay(selectedDay)} onClose={() => setSelectedDay(null)} />
        ) : (
          <LearningSidebar data={learning} onSuggestionClick={t => { setForm(f => ({ ...f, title: t, due_date: `${year}-${String(month).padStart(2, '0')}-01` })); setShowModal(true); }} />
        )}
      </div>

      {showModal && <ReminderForm form={form} setForm={setForm} onSave={createReminder} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function DaySidebar({ day, month, year, events, onDismiss, onNew, onClose }) {
  return (
    <div style={s.sidebar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: '700' }}>{day} de {MONTHS[month - 1]}</div>
        <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
          <CalIcon size={32} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
          <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Sin eventos</div>
          <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>Asigna un recordatorio</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {events.map((ev, i) => (
            <EventCard key={i} ev={ev} onDismiss={ev.source === 'reminder' ? () => onDismiss(ev.id) : null} />
          ))}
        </div>
      )}
      <button className="btn btn--secondary btn--full btn--sm" style={{ marginTop: 'var(--space-4)' }} onClick={onNew}>
        <Plus size={14} /> Agregar recordatorio
      </button>
    </div>
  );
}

function EventCard({ ev, onDismiss }) {
  const cat = ev.category || 'general';
  const cc = categoryColor(cat);
  const det = ev.details || {};

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: cc.bg }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600' }}>{ev.device_name || ev.name || ev.type}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
          {ev.source === 'reminder' ? (
            <>
              {cat}
              {det.subtype && ` · ${det.subtype}`}
              {ev.amount != null ? ` · $${Number(ev.amount).toFixed(2)}` : null}
              {ev.repeat_type && ev.repeat_type !== 'none' && ` · ↻ ${ev.repeat_type}`}
              {det.person && ` · ${det.person}`}
            </>
          ) : (
            ev.type?.replace(/_/g, ' ')
          )}
        </div>
        {det.items && det.items.length > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
            {det.items.map((it, j) => (
              <div key={j}>{it.name} {it.qty}{it.unit && ` ${it.unit}`}{it.price && ` · $${Number(it.price).toFixed(0)}`}</div>
            ))}
          </div>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ ...s.navBtn, width: 28, height: 28, flexShrink: 0 }}><Check size={14} /></button>
      )}
    </div>
  );
}

function LearningSidebar({ data, onSuggestionClick }) {
  const hasContent = data && (data.patterns?.length || data.categoryTotals?.length || data.upcomingWeek?.length || data.subtypeAverages?.length);

  return (
    <div style={s.sidebar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {hasContent ? <Lightbulb size={18} style={{ color: '#e65100' }} /> : <Inbox size={18} style={{ color: 'var(--text-muted)' }} />}
        <span style={{ fontSize: 'var(--text-base)', fontWeight: '700' }}>{hasContent ? 'Recomendaciones' : 'Resumen'}</span>
      </div>

      {!data && <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando...</div>}

      {data && !hasContent && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
          <Inbox size={36} style={{ margin: '0 auto var(--space-3)', opacity: 0.2 }} />
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: '500', marginBottom: 'var(--space-2)' }}>Empieza a crear recordatorios</div>
          <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
            El sistema aprenderá de tus patrones de gastos, cumpleaños, despensa y más para darte recomendaciones inteligentes.
          </div>
        </div>
      )}

      {data?.subtypeAverages?.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Promedios por servicio</div>
          {data.subtypeAverages.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)' }}>
              <span>{s.subtype}</span>
              <span style={{ fontWeight: '600' }}>${Number(s.avg_amount).toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}

      {data?.patterns?.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Recurrentes</div>
          {data.patterns.map((p, i) => (
            <div key={i} style={s.card}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600' }}>{p.norm_title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{p.count} veces · día {p.day_of_month}{p.avg_amount ? ` · $${Number(p.avg_amount).toFixed(0)}` : ''}</div>
              <button className="btn btn--ghost btn--xs" style={{ marginTop: 6 }} onClick={() => onSuggestionClick(p.norm_title)}>
                <Plus size={12} /> Reprogramar
              </button>
            </div>
          ))}
        </div>
      )}

      {data?.categoryTotals?.filter(c => c.total).length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Gastos por categoría</div>
          {data.categoryTotals.filter(c => c.total).map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)' }}>
              <span>{c.category}</span>
              <span style={{ fontWeight: '600' }}>${Number(c.total).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {data?.upcomingWeek?.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Próximos 7 días</div>
          {data.upcomingWeek.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)' }}>
              <span>{r.title}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{new Date(r.due_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReminderForm({ form, setForm, onSave, onClose }) {
  const { devices } = useDevices();
  const cat = form.category;
  const det = form.details || {};
  const setDet = (updater) => setForm(p => ({ ...p, details: typeof updater === 'function' ? updater(p.details || {}) : { ...(p.details || {}), ...updater } }));

  function addItem() { setDet(d => ({ ...d, items: [...(d.items || []), { name:'', qty:1, unit:'pieza', price:'' }] })); }
  function updItem(i, field, val) { setDet(d => { const items = [...(d.items || [])]; items[i] = { ...items[i], [field]: val }; return { ...d, items }; }); }
  function delItem(i) { setDet(d => { const items = (d.items || []).filter((_, idx) => idx !== i); return { ...d, items }; }); }

  const totalItems = det.items?.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (it.qty || 1), 0) || 0;

  return (
    <div style={s.modal}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={s.modalContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: '600' }}>Nuevo registro</span>
          <button onClick={onClose} style={{ cursor: 'pointer', color: 'var(--text-muted)', background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* 1. Tipo */}
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tipo de evento</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
              {CATEGORIES.map(c => {
                const active = form.category === c.value;
                const Icon = c.icon;
                return (
                  <button key={c.value} type="button" onClick={() => setForm(p => ({ ...p, category: c.value, details: {} }))}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)', border: active ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                      background: active ? 'var(--color-red-bg)' : 'white', cursor: 'pointer', transition: 'all .15s',
                    }}>
                    <Icon size={18} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '10px', fontWeight: active ? '600' : '500', color: active ? 'var(--accent)' : '#333' }}>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Título */}
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Título</label>
            <input className="input" required placeholder={cat === 'finanzas' ? 'Pago de luz' : cat === 'cumpleaños' ? 'Cumpleaños de...' : cat === 'despensa' ? 'Despensa semanal' : '¿Qué necesitas recordar?'}
              value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>

          {/* 3. Descripción */}
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descripción</label>
            <input className="input" placeholder="Detalles adicionales (opcional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          {/* 4. Campos dinámicos según tipo */}
          {cat === 'finanzas' && (
            <FinanzasFields det={det} setDet={setDet} form={form} setForm={setForm} />
          )}
          {cat === 'despensa' && (
            <DespensaFields det={det} setDet={setDet} addItem={addItem} updItem={updItem} delItem={delItem} totalItems={totalItems} form={form} setForm={setForm} />
          )}
          {cat === 'cumpleaños' && (
            <CumpleañosFields det={det} setDet={setDet} form={form} setForm={setForm} />
          )}
          {cat === 'mantenimiento' && (
            <MantenimientoFields det={det} setDet={setDet} devices={devices} form={form} setForm={setForm} />
          )}
          {cat === 'salud' && (
            <SaludFields det={det} setDet={setDet} form={form} setForm={setForm} />
          )}
          {cat === 'general' && (
            <GeneralFields form={form} setForm={setForm} />
          )}

          {/* Fecha y Repetición */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fecha</label>
              <input className="input" type="date" required value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Repetir</label>
              <select className="input" value={form.repeat_type} onChange={e => setForm(p => ({ ...p, repeat_type: e.target.value }))}>
                {REPEAT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--full">Guardar</button>
        </form>
      </div>
    </div>
  );
}

function FinanzasFields({ det, setDet, form, setForm }) {
  return (
    <>
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tipo de pago</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {FINANZAS_SUBTYPES.map(s => (
            <button key={s.value} type="button" onClick={() => setDet(d => ({ ...d, subtype: s.value }))}
              style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: det.subtype === s.value ? '2px solid var(--accent)' : '1px solid var(--border-subtle)', background: det.subtype === s.value ? '#fce4ec' : 'white', cursor: 'pointer', fontSize: '11px', fontWeight: det.subtype === s.value ? '600' : '500', color: det.subtype === s.value ? 'var(--accent)' : '#333' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monto $</label>
          <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Proveedor</label>
          <input className="input" placeholder="CFE, J+W, etc" value={det.provider || ''} onChange={e => setDet(d => ({ ...d, provider: e.target.value }))} />
        </div>
      </div>
    </>
  );
}

function DespensaFields({ det, setDet, addItem, updItem, delItem, totalItems, form, setForm }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Costo total $</label>
          <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tienda</label>
          <input className="input" placeholder="Walmart, Soriana, etc" value={det.store || ''} onChange={e => setDet(d => ({ ...d, store: e.target.value }))} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Artículos</span>
          <button type="button" className="btn btn--ghost btn--xs" onClick={addItem}><Plus size={12} /> Agregar</button>
        </div>
        {(!det.items || det.items.length === 0) && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: 'var(--space-2)', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            Agrega artículos a la lista
          </div>
        )}
        {det.items?.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <input className="input" style={{ flex: 2, fontSize: '12px', padding: '4px 6px' }} placeholder="Artículo" value={item.name} onChange={e => updItem(i, 'name', e.target.value)} />
            <input className="input" style={{ width: 50, fontSize: '12px', padding: '4px 6px' }} type="number" min="1" value={item.qty} onChange={e => updItem(i, 'qty', parseInt(e.target.value) || 1)} />
            <select className="input" style={{ width: 70, fontSize: '11px', padding: '4px 4px' }} value={item.unit} onChange={e => updItem(i, 'unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input className="input" style={{ width: 65, fontSize: '12px', padding: '4px 6px' }} type="number" step="0.5" min="0" placeholder="$" value={item.price} onChange={e => updItem(i, 'price', e.target.value)} />
            <button type="button" onClick={() => delItem(i)} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)', padding: 2 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {det.items?.length > 0 && (
          <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: '600', marginTop: 4 }}>
            Subtotal: ${totalItems.toFixed(2)}
          </div>
        )}
      </div>
    </>
  );
}

function CumpleañosFields({ det, setDet }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Persona</label>
        <input className="input" placeholder="Nombre" value={det.person || ''} onChange={e => setDet(d => ({ ...d, person: e.target.value }))} />
      </div>
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Edad</label>
        <input className="input" type="number" min="0" placeholder="25" value={det.age || ''} onChange={e => setDet(d => ({ ...d, age: e.target.value }))} />
      </div>
    </div>
  );
}

function MantenimientoFields({ det, setDet, devices }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dispositivo</label>
        <select className="input" value={det.device_id || ''} onChange={e => setDet(d => ({ ...d, device_id: e.target.value }))}>
          <option value="">— Ninguno —</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.location})</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Costo estimado $</label>
        <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={det.estimated_cost || ''} onChange={e => setDet(d => ({ ...d, estimated_cost: e.target.value }))} />
      </div>
    </div>
  );
}

function SaludFields({ det, setDet }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doctor / Cita</label>
        <input className="input" placeholder="Dr. García" value={det.doctor || ''} onChange={e => setDet(d => ({ ...d, doctor: e.target.value }))} />
      </div>
      <div>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Costo $</label>
        <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={det.cost || ''} onChange={e => setDet(d => ({ ...d, cost: e.target.value }))} />
      </div>
    </div>
  );
}

function GeneralFields({ form, setForm }) {
  return (
    <div>
      <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', display: 'block', marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monto $</label>
      <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
    </div>
  );
}

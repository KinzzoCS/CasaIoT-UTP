'use client';

// ─────────────────────────────────────────────────────────────
//  Navigation.jsx — Navegación unificada (Responsive)
//  Desktop: Sidebar izquierdo
//  Mobile: Header + BottomNav
//  Incluye: Perfil de usuario + Logout
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Home, CalendarDays, Mic, Settings, Zap, Cpu, LogOut, User } from 'lucide-react';
import { useWebSocketStatus } from '../../hooks/useWebSocket';
import { useAuth } from '../../context/AuthContext';
import { useDevices } from '../../hooks/useDevices';
import { usePushToTalk } from '../../hooks/usePushToTalk';

const tabItems = [
  { id: 'home',       label: 'Inicio',       icon: Home },
  { id: 'devices',    label: 'Dispositivos', icon: Cpu },
  { id: 'calendar',   label: 'Calendario',  icon: CalendarDays },
  { id: 'ptt',        label: 'Push To Talk', icon: Mic },
  { id: 'settings',   label: 'Ajustes',      icon: Settings },
];

export default function Navigation({ activeTab, onTabChange, pageTitle }) {
  const { connected } = useWebSocketStatus();
  const { user, logout } = useAuth();
  const { devices, sendCommand } = useDevices();
  const { isListening, transcript, results, isSupported, startListening, stopListening, clearResults } = usePushToTalk(devices, sendCommand);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (results && results.length > 0) {
      const timer = setTimeout(clearResults, 5000);
      return () => clearTimeout(timer);
    }
  }, [results, clearResults]);

  const handleLogout = async () => {
    await logout();
    setShowProfile(false);
  };

  return (
    <>
      {/* ── Mobile Header ───────────────────────────────────── */}
      <header className="mobile-header" style={{
        position: 'fixed',
        top: 0,
        width: '100%',
        height: 'var(--header-height)',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-5)',
        zIndex: 99,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '8px', background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
          }}>
            <Zap size={16} />
          </div>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
            {pageTitle}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div className={`status-dot status-dot--${connected ? 'online' : 'offline'}`} />
        </div>
      </header>

      {/* ── Mobile Bottom Nav ───────────────────────────────── */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed',
        bottom: 0,
        width: '100%',
        height: 'var(--bottom-nav-height)',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-subtle)',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 var(--space-2)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 100,
      }}>
        {tabItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 16px',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? '600' : '500' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="desktop-sidebar">
        <div style={{ padding: 'var(--space-6) var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '8px', background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
          }}>
            <Zap size={18} />
          </div>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
            CasaIoT
          </span>
        </div>

        <nav style={{ flex: 1, padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {tabItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--color-red-bg)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span style={{ fontSize: 'var(--text-base)', fontWeight: isActive ? '600' : '500' }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* PTT Button — centro del sidebar */}
        {isSupported && (
          <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
            <button
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onMouseLeave={stopListening}
              onTouchStart={(e) => { e.preventDefault(); startListening(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isListening ? 'var(--color-red-bg)' : 'transparent',
                border: isListening ? '2px solid var(--color-red)' : '2px solid var(--border-subtle)',
                color: isListening ? 'var(--color-red)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                fontSize: 'var(--text-sm)',
                fontWeight: '600',
              }}
            >
              <Mic size={18} />
              {isListening ? 'ESCUCHANDO' : 'Push To Talk'}
            </button>
            {isListening && transcript && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)', textAlign: 'center', lineHeight: 1.4 }}>
                {transcript}
              </div>
            )}
          </div>
        )}

        {/* Perfil y Estado */}
        <div style={{ padding: 'var(--space-6) var(--space-5)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Estado conexión */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div className={`status-dot status-dot--${connected ? 'online' : 'offline'}`} />
            <span style={{ fontSize: 'var(--text-sm)', color: connected ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: '500' }}>
              {connected ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>

          {/* Botón Perfil */}
          {user && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProfile(!showProfile)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontWeight: '500',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                  <User size={14} />
                </div>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.username}
                  </div>
                </div>
              </button>

              {/* Menú Perfil */}
              {showProfile && (
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + var(--space-2))',
                  width: '100%',
                  backgroundColor: 'white',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                }}>
                  <div style={{ padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: 'var(--space-2)' }}>
                      Sesión
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--color-danger)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        fontWeight: '500',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <LogOut size={16} />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

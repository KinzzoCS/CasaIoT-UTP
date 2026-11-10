'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Zap, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState('login');
  // El registro público está cerrado por defecto en el backend (ALLOW_REGISTRATION)
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  useEffect(() => {
    api.setupStatus()
      .then(s => setRegistrationEnabled(Boolean(s.registrationEnabled)))
      .catch(() => setRegistrationEnabled(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Completa todos los campos');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
        setMode('login');
        setPassword('');
        setError('Usuario creado. Ahora inicia sesión.');
        return;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', padding: 'var(--space-6)',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--accent)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-5)',
            boxShadow: '0 8px 24px rgba(0,100,224,0.25)',
          }}>
            <Zap size={28} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            CasaIoT
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {mode === 'login' ? 'Inicia sesión para controlar tu hogar' : 'Crea tu cuenta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Usuario
            </label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', padding: 4,
                }}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              background: error.includes('creado') ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: error.includes('creado') ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={busy}
            style={{ padding: '14px var(--space-4)', fontSize: 'var(--text-base)' }}
          >
            {busy ? (
              <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
            ) : mode === 'login' ? (
              <><LogIn size={18} /> Iniciar Sesión</>
            ) : (
              <><UserPlus size={18} /> Crear Cuenta</>
            )}
          </button>
        </form>

        {registrationEnabled ? (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', fontWeight: 500 }}
            >
              {mode === 'login' ? '¿Primera vez? Crea una cuenta' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        ) : (
          <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            ¿No tienes cuenta? Pide a un administrador que te la cree.
          </p>
        )}
      </div>
    </div>
  );
}

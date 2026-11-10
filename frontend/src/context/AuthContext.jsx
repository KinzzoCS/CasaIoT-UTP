'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, saveTokens, clearTokens, getAccessToken, getRefreshToken, isAuthenticated } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => {
          const refresh = getRefreshToken();
          if (!refresh) {
            clearTokens();
            setUser(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refresh = getRefreshToken();
      if (refresh) await api.logout(refresh);
    } catch {
      // ignore logout errors
    }
    clearTokens();
    setUser(null);
  }, []);

  const register = useCallback(async (username, password) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar');
    return data;
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', background: 'var(--bg-primary)',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid var(--color-gray-200)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

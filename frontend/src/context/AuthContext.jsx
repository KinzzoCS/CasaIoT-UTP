'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, saveTokens, clearTokens, getAccessToken, getRefreshToken, SESSION_EXPIRED_EVENT } from '../lib/api';
import { disconnectWebSocket } from '../hooks/useWebSocket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restaurar sesión al cargar
  useEffect(() => {
    if (!getAccessToken() && !getRefreshToken()) {
      setLoading(false);
      return;
    }
    api.me()
      .then(setUser)
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // El cliente HTTP avisa cuando el refresh falla o el token es inválido
  useEffect(() => {
    const onExpired = () => {
      disconnectWebSocket();
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    saveTokens(data);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refresh = getRefreshToken();
      if (refresh) await api.logout(refresh);
    } catch {
      // ignorar errores de logout: la sesión local se borra igual
    }
    disconnectWebSocket();
    clearTokens();
    setUser(null);
  }, []);

  const register = useCallback((username, password) => api.register(username, password), []);

  // Valor estable: los consumidores solo re-renderizan si cambia el usuario
  const value = useMemo(
    () => ({ user, login, logout, register, isAuthenticated: !!user }),
    [user, login, logout, register]
  );

  if (loading) {
    return (
      <div className="auth-loading" role="status" aria-label="Cargando">
        <div className="auth-loading__spinner" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

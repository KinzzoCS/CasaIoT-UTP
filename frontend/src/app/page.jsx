'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '../context/AuthContext';
import { DevicesProvider } from '../context/DevicesContext';
import Navigation from '../components/layout/Navigation';
import DashboardPage from '../components/dashboard/DashboardPage';
import LoginPage from '../components/auth/LoginPage';

// Pestañas secundarias bajo demanda: el bundle inicial solo lleva el
// dashboard (bundle-dynamic-imports). Calendario, Dispositivos y Ajustes
// suman ~2 200 líneas de JSX que antes se descargaban siempre.
function TabLoading() {
  return <div className="tab-loading" role="status">Cargando…</div>;
}
const lazyTab = (loader) => dynamic(loader, { ssr: false, loading: TabLoading });

const TABS = {
  home:     { title: 'Inicio',       Component: DashboardPage },
  devices:  { title: 'Dispositivos', Component: lazyTab(() => import('../components/devices/DevicesPage')) },
  calendar: { title: 'Calendario',   Component: lazyTab(() => import('../components/calendar/CalendarPage')) },
  ptt:      { title: 'Push To Talk', Component: lazyTab(() => import('../components/ptt/PushToTalkPage')) },
  settings: { title: 'Ajustes',      Component: lazyTab(() => import('../components/settings/SettingsPage')) },
};

const TAB_STORAGE_KEY = 'casaiot_tab';

function readSavedTab() {
  if (typeof window === 'undefined') return 'home';
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return saved && saved in TABS ? saved : 'home';
  } catch {
    return 'home';
  }
}

export default function App() {
  const { user } = useAuth();
  // Inicialización perezosa: localStorage se lee una sola vez (rerender-lazy-state-init)
  const [activeTab, setActiveTab] = useState(readSavedTab);

  const handleTabChange = (tab) => {
    if (!(tab in TABS)) return;
    setActiveTab(tab);
    try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch { /* modo privado */ }
  };

  if (!user) {
    return <LoginPage />;
  }

  const { title, Component } = TABS[activeTab];

  return (
    <DevicesProvider>
      <div className="app-container">
        <Navigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          pageTitle={title}
        />
        <main className="main-content animate-fade" key={activeTab}>
          <Component />
        </main>
      </div>
    </DevicesProvider>
  );
}

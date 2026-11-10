'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/layout/Navigation';
import DashboardPage from '../components/dashboard/DashboardPage';
import DevicesPage from '../components/devices/DevicesPage';
import CalendarPage from '../components/calendar/CalendarPage';
import PushToTalkPage from '../components/ptt/PushToTalkPage';
import SettingsPage from '../components/settings/SettingsPage';
import LoginPage from '../components/auth/LoginPage';

export default function App() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('casaiot_tab') || 'home';
    return 'home';
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('casaiot_tab', tab);
  };

  if (!user) {
    return <LoginPage />;
  }

  const pages = {
    home:       <DashboardPage />,
    devices:    <DevicesPage />,
    calendar:    <CalendarPage />,
    ptt:        <PushToTalkPage />,
    settings:   <SettingsPage />,
  };

  const pageTitles = {
    home:       'Inicio',
    devices:    'Dispositivos',
    calendar:    'Calendario',
    ptt:        'Push To Talk',
    settings:   'Ajustes',
  };

  return (
    <div className="app-container">
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pageTitle={pageTitles[activeTab]}
      />
      <main className="main-content animate-fade" key={activeTab}>
        {pages[activeTab]}
      </main>
    </div>
  );
}

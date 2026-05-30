import { useState, useCallback } from 'react';
import './index.css';
import { EncryptPanel } from './components/EncryptPanel';
import { DecryptPanel } from './components/DecryptPanel';
import { KeyGenerator } from './components/KeyGenerator';
import { Settings } from './components/Settings';
import { Notification, NotificationData } from './components/Notification';
import { useI18n } from './i18n';

type Tab = 'encrypt' | 'decrypt' | 'keygen' | 'settings';

export default function App() {
  const { t } = useI18n();

  const NAV = [
    { id: 'encrypt', label: t.nav_encrypt, icon: '🔒' },
    { id: 'decrypt', label: t.nav_decrypt, icon: '🔓' },
    { id: 'keygen', label: t.nav_keygen, icon: '🗝️' },
    { id: 'settings', label: t.nav_settings, icon: '⚙️' },
  ] as const;

  const [tab, setTab] = useState<Tab>('encrypt');
  const [notif, setNotif] = useState<NotificationData | null>(null);

  const notify = useCallback((n: NotificationData) => {
    setNotif(n);
    setTimeout(() => setNotif(null), 4000);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-nx-bg overflow-hidden">
      {/* ── Header ── */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-5 py-3 border-b border-nx-border shrink-0">
        <div className="flex items-center gap-2.5 justify-start">
          <div className="w-8 h-8 rounded-lg bg-nx-cyan flex items-center justify-center text-nx-bg font-bold text-sm shrink-0">
            NX
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-bold text-nx-text leading-none">NexusCrypt</h1>
            <p className="text-[10px] text-nx-muted font-mono mt-0.5 truncate">{t.subtitle}</p>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex items-center gap-1 bg-nx-surface rounded-xl p-1">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setTab(n.id as Tab)}
              className={`tab-item ${tab === n.id ? 'active' : ''}`}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Balance the grid */}
        <div className="flex justify-end"></div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto animate-fade-in">
          {tab === 'encrypt' && <EncryptPanel notify={notify} />}
          {tab === 'decrypt' && <DecryptPanel notify={notify} />}
          {tab === 'keygen' && <KeyGenerator notify={notify} />}
          {tab === 'settings' && <Settings />}
        </div>
      </main>

      {/* ── Status bar ── */}
      <footer className="flex items-center justify-between px-5 py-1.5 border-t border-nx-border text-[10px] text-nx-muted font-mono shrink-0">
        <span>v1.0.0 · Tauri v2 + Rust</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-nx-green animate-pulse" />
          {t.status_secure}
        </span>
      </footer>

      {/* ── Notification toast ── */}
      {notif && <Notification data={notif} />}
    </div>
  );
}

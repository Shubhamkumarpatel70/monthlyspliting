import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInstallPWA } from '../hooks/useInstallPWA';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isInstallable, install } = useInstallPWA();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleInstallApp = () => {
    install();
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-darkBg flex flex-col">
      <header className="sticky top-0 z-40 bg-darkBg/95 backdrop-blur border-b border-white/5 safe-area-inset-top">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 flex items-center justify-between min-h-[52px] sm:h-14">
          <Link to="/dashboard" className="flex items-center gap-2 text-textPrimary font-semibold">
            <span className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </span>
            Monthly Split
          </Link>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-white/5 hover:border-primary/30 transition"
            >
              <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
              <span className="text-textPrimary text-sm hidden sm:inline max-w-[120px] truncate">{user?.name}</span>
              <svg className={`w-4 h-4 text-textSecondary transition ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 py-1 rounded-xl bg-surface border border-white/10 shadow-xl z-20">
                  <div className="px-4 py-2 border-b border-white/5 text-textSecondary text-xs truncate">{user?.email}</div>
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-primary/10 flex items-center gap-2"
                      onClick={() => setMenuOpen(false)}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      Admin Panel
                    </Link>
                  )}
                  {isInstallable && (
                    <button
                      onClick={handleInstallApp}
                      className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-primary/10 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      Install as app
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 flex items-center gap-2"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}

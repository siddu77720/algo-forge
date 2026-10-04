import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Ambient orbs */}
      <div className="orb1" />
      <div className="orb2" />
      <div className="orb3" />
      {/* Scanline effect */}
      <div className="scanline" />

      {/* Header */}
      <header className="glass border-b border-animate sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">A</div>
              <div className="absolute inset-0 rounded-lg border border-cyan-400/50 animate-pulse" />
            </div>
            <span className="font-black text-xl tracking-widest neon-blue hidden sm:block">ALGO<span className="text-white">FORGE</span></span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <Link to="/" className="btn-cyber px-4 py-2 rounded-lg text-sm">Dashboard</Link>
            <Link to="/history" className="btn-cyber px-4 py-2 rounded-lg text-sm">📋 History</Link>
            {user?.role === 'ADMIN' && (
              <Link to="/admin" className="btn-cyber px-4 py-2 rounded-lg text-sm">Admin</Link>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Live indicator */}
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_#00ff88]" />
              <span className="text-green-400 text-xs font-bold tracking-widest">LIVE</span>
            </div>
            {/* Clock */}
            <div className="mono text-sm text-cyan-400/80 hidden sm:block">{time.toLocaleTimeString()}</div>
            {/* User & logout */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:block">{user?.username}</span>
              <button
                onClick={handleLogout}
                className="btn-cyber px-3 py-1.5 rounded-lg text-xs"
              >
                Logout
              </button>
            </div>
            {/* Mobile menu */}
            <button
              className="md:hidden btn-cyber p-2 rounded-lg"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-cyan-400/10 px-4 py-3 flex flex-col gap-2">
            <Link to="/" onClick={() => setMenuOpen(false)} className="btn-cyber px-4 py-2 rounded-lg text-sm text-center">Dashboard</Link>
            <Link to="/history" onClick={() => setMenuOpen(false)} className="btn-cyber px-4 py-2 rounded-lg text-sm text-center">📋 History</Link>
            {user?.role === 'ADMIN' && (
              <Link to="/admin" onClick={() => setMenuOpen(false)} className="btn-cyber px-4 py-2 rounded-lg text-sm text-center">Admin</Link>
            )}
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="glass border-t border-cyan-400/10 py-4 text-center text-xs text-cyan-400/40 tracking-widest uppercase">
        AlgoForge &mdash; Advanced Trading Intelligence &mdash; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

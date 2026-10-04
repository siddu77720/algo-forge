import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col text-slate-100" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <div className="orb1" />
      <div className="orb2" />
      <div className="orb3" />
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

          {/* Right side */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Live indicator */}
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_#00ff88]" />
              <span className="text-green-400 text-xs font-bold tracking-widest">LIVE</span>
            </div>
            {/* Clock */}
            <div className="mono text-sm text-cyan-400/80 hidden sm:block">{time.toLocaleTimeString()}</div>
            {/* Login CTA */}
            <Link
              to="/login"
              className="btn-cyber px-4 py-2 rounded-lg text-xs"
            >
              ⚡ Login
            </Link>
          </div>
        </div>
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

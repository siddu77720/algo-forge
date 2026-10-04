import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
      } else {
        login(data.token, data.user);
        navigate('/');
      }
    } catch {
      setError('Network error — check server connection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background orbs */}
      <div className="orb1" />
      <div className="orb2" />
      <div className="orb3" />
      <div className="scanline" />

      {/* Centered card */}
      <div className="glass glow-blue rounded-2xl p-8 sm:p-10 w-full max-w-md mx-4 fade-in-up border border-animate">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 mb-4 shadow-[0_0_30px_rgba(0,212,255,0.4)]">
            <span className="text-white font-black text-3xl">A</span>
          </div>
          <h1 className="text-3xl font-black tracking-widest neon-blue">ALGO<span className="text-white">FORGE</span></h1>
          <p className="text-slate-400 text-sm mt-2 tracking-wider">Advanced Trading Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3 rounded-lg text-center text-sm font-medium">
              ⚠ {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-cyan-400/70 mb-2 uppercase tracking-widest">Username or Email</label>
            <input
              type="text"
              className="input-cyber w-full rounded-lg px-4 py-3 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-cyan-400/70 mb-2 uppercase tracking-widest">Password</label>
            <input
              type="password"
              className="input-cyber w-full rounded-lg px-4 py-3 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-black text-sm tracking-widest uppercase transition-all duration-300 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0066ff, #00d4ff)',
              boxShadow: '0 0 25px rgba(0, 212, 255, 0.4)',
              color: '#fff'
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Authenticating...
              </span>
            ) : (
              '⚡ Access Dashboard'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6 tracking-wider">
          Secured & Encrypted Connection
        </p>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { socket } from '../lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SignalRecord {
  id: string;
  pair: string;
  signal: 'CALL' | 'PUT';
  timestamp: number;
  baseHigh: number;
  baseLow: number;
  baseConfirmations: number;
  breakoutDirection: 'UP' | 'DOWN';
  breakoutHigh: number;
  breakoutLow: number;
  breakoutConfirmations: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPairScore(s: any): number {
  if (!s) return -1;
  if (s.status === 'SIGNAL_READY') return 100;
  if (s.status === 'WAITING_FOR_BREAKOUT_CONFIRMATION') return 70 + (s.breakoutConfirmations || 0) * 10;
  if (s.status === 'BASE_CONFIRMED') return 40 + Math.min((s.baseConfirmations || 0) * 5, 20);
  if (s.status === 'WAITING_FOR_BASE_CONFIRMATION') return 10 + (s.baseConfirmations || 0) * 10;
  return 0;
}

function formatDT(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

// ─── Score label ──────────────────────────────────────────────────────────────
function scoreLabel(score: number) {
  if (score >= 100) return { text: 'SIGNAL READY', color: 'text-green-400', bar: 'bg-green-400' };
  if (score >= 70)  return { text: 'BREAKOUT FORMING', color: 'text-yellow-400', bar: 'bg-yellow-400' };
  if (score >= 40)  return { text: 'BASE CONFIRMED', color: 'text-cyan-400', bar: 'bg-cyan-400' };
  return { text: 'BUILDING BASE', color: 'text-slate-400', bar: 'bg-slate-600' };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Landing() {
  const [states, setStates]               = useState<Record<string, any>>({});
  const [pairs, setPairs]                 = useState<string[]>([]);
  const [signals, setSignals]             = useState<SignalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [recommended, setRecommended]     = useState<{ pair: string; state: any } | null>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  // ── Fetch history (30 days) ──────────────────────────────────────────────
  useEffect(() => {
    const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const to   = Date.now();
    fetch(`http://localhost:5000/api/history?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => setSignals(d.signals || []))
      .catch(() => setSignals([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  // ── Fetch pairs list ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('http://localhost:5000/api/pairs')
      .then(r => r.json())
      .then(d => setPairs(d.pairs || []));
  }, []);

  // ── Socket — live strategy updates ──────────────────────────────────────
  useEffect(() => {
    socket.connect();

    socket.on('strategy_update', ({ pair, state }: { pair: string; state: any }) => {
      setStates(prev => ({ ...prev, [pair]: state }));
    });

    socket.on('new_signal', (record: SignalRecord) => {
      setSignals(prev => {
        if (prev.some(s => s.id === record.id)) return prev;
        return [record, ...prev];
      });
    });

    return () => {
      socket.off('strategy_update');
      socket.off('new_signal');
    };
  }, []);

  // ── Compute recommended pair (highest score ≥ 40) ───────────────────────
  useEffect(() => {
    let best: { pair: string; state: any; score: number } | null = null;
    Object.entries(states).forEach(([p, s]) => {
      const score = getPairScore(s);
      if (score >= 40 && (!best || score > best.score)) {
        best = { pair: p, state: s, score };
      }
    });
    if (best) setRecommended({ pair: (best as any).pair, state: (best as any).state });
  }, [states]);

  // ── Active setups (score > 0, sorted) ───────────────────────────────────
  const activeSetups = Object.entries(states)
    .map(([pair, state]) => ({ pair, state, score: getPairScore(state) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const callCount = signals.filter(s => s.signal === 'CALL').length;
  const putCount  = signals.filter(s => s.signal === 'PUT').length;

  const recScore = recommended ? getPairScore(recommended.state) : 0;
  const recLabel = scoreLabel(recScore);
  const recIsSignal = recommended?.state?.status === 'SIGNAL_READY';

  return (
    <div className="flex flex-col gap-8 pb-10 fade-in-up">

      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      <div className="text-center py-6">
        <div className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest mb-2">Real-Time OTC Signal Engine</div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">
          <span className="neon-blue">ALGO</span>FORGE
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Live market setup detection across all OTC pairs — see which pair is nearest to a trade signal right now.
        </p>
        <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
          <Link to="/login" className="btn-cyber px-6 py-2.5 rounded-xl text-sm">⚡ Access Full Dashboard</Link>
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-4 py-2.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_#00ff88]" />
            <span className="text-green-400 text-xs font-bold tracking-widest">LIVE · {pairs.length} PAIRS MONITORED</span>
          </div>
        </div>
      </div>

      {/* ── Recommended Pair ─────────────────────────────────────────────── */}
      {recommended ? (
        <div className={`glass rounded-2xl border transition-all duration-500 overflow-hidden ${
          recIsSignal
            ? recommended.state.signal === 'CALL'
              ? 'border-green-400/60 glow-green'
              : 'border-red-400/60 glow-red'
            : 'border-cyan-400/40 glow-blue'
        }`}>
          <div className="px-5 py-3 border-b border-cyan-400/10 flex items-center gap-2">
            <span className="text-lg animate-bounce">🔥</span>
            <span className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest">Recommended Pair — Nearest to Signal</span>
          </div>
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Left: pair info */}
            <div className="flex flex-col gap-2">
              <div className="text-3xl sm:text-4xl font-black text-white">{recommended.pair}</div>
              <div className={`text-sm font-bold tracking-widest uppercase ${recLabel.color}`}>
                {recLabel.text}
              </div>
              {/* Mini checklist */}
              <div className="flex flex-col gap-1 mt-2">
                {[
                  { label: 'Base Formed',         done: !!recommended.state.baseHigh },
                  { label: `Base Confirmed (${recommended.state.baseConfirmations || 0}/2+)`, done: (recommended.state.baseConfirmations || 0) >= 2 },
                  { label: `Breakout ${recommended.state.breakoutDirection || '—'}`, done: !!recommended.state.breakoutDirection },
                  { label: 'Breakout Confirmed',  done: (recommended.state.breakoutConfirmations || 0) >= 1 || recIsSignal },
                ].map(step => (
                  <div key={step.label} className={`flex items-center gap-2 text-xs font-semibold ${step.done ? 'text-green-400' : 'text-slate-500'}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${step.done ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-600'}`}>
                      {step.done ? '✓' : '·'}
                    </span>
                    {step.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: score + signal */}
            <div className="flex flex-col items-center gap-4 min-w-[140px]">
              {recIsSignal ? (
                <div className={`signal-pulse text-center ${recommended.state.signal === 'CALL' ? 'neon-green' : 'neon-red'}`}>
                  <div className="text-5xl font-black">
                    {recommended.state.signal === 'CALL' ? '▲' : '▼'}
                  </div>
                  <div className="text-2xl font-black tracking-widest mt-1">
                    {recommended.state.signal === 'CALL' ? 'BUY' : 'SELL'}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-5xl font-black mono text-white">{recScore}%</div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Setup Progress</div>
                </div>
              )}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`progress-bar h-2 rounded-full transition-all duration-700`}
                  style={{ width: `${Math.min(recScore, 100)}%` }}
                />
              </div>
              <Link to="/login" className="btn-cyber px-5 py-2 rounded-lg text-xs w-full text-center">
                Trade This →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass glow-blue rounded-2xl p-8 text-center border border-cyan-400/10">
          <div className="text-4xl mb-3 animate-pulse">📡</div>
          <div className="text-slate-400 font-bold">Scanning all pairs for setups...</div>
          <div className="text-slate-600 text-sm mt-1">Connecting to live market data</div>
        </div>
      )}

      {/* ── Active Setups Grid ───────────────────────────────────────────── */}
      {activeSetups.length > 0 && (
        <div>
          <div className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            {activeSetups.length} Active Setups Forming
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSetups.slice(0, 9).map(({ pair, state, score }) => {
              const lbl = scoreLabel(score);
              const isReady = state.status === 'SIGNAL_READY';
              return (
                <div
                  key={pair}
                  className={`glass rounded-xl p-4 border transition-all duration-300 ${
                    isReady
                      ? state.signal === 'CALL'
                        ? 'border-green-400/40 glow-green'
                        : 'border-red-400/40 glow-red'
                      : 'border-cyan-400/15 hover:border-cyan-400/35'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-black text-white text-base">{pair}</span>
                    {isReady ? (
                      <span className={`text-xs font-black px-2 py-0.5 rounded ${
                        state.signal === 'CALL' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {state.signal === 'CALL' ? '▲ BUY' : '▼ SELL'}
                      </span>
                    ) : (
                      <span className={`text-xs font-bold mono ${lbl.color}`}>{score}%</span>
                    )}
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${lbl.color} mb-2`}>{lbl.text}</div>
                  <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                    <div className="progress-bar h-1 rounded-full transition-all duration-700" style={{ width: `${Math.min(score, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Signal History (Trust Section) ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest mb-0.5">Signal History — Last 30 Days</div>
            <div className="text-slate-300 text-sm">Every setup that fully formed and fired a real signal</div>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-lg font-black text-green-400">{callCount}</div>
              <div className="text-[10px] text-green-400/60 font-bold uppercase">BUY</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-lg font-black text-red-400">{putCount}</div>
              <div className="text-[10px] text-red-400/60 font-bold uppercase">SELL</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="text-lg font-black text-cyan-400">{signals.length}</div>
              <div className="text-[10px] text-cyan-400/60 font-bold uppercase">Total</div>
            </div>
          </div>
        </div>

        <div className="glass glow-blue rounded-2xl border border-cyan-400/10 overflow-hidden">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <div className="text-slate-500 text-sm">Loading signal history...</div>
              </div>
            </div>
          ) : signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="text-4xl">📋</div>
              <div className="text-slate-400 font-bold text-sm">No signals recorded yet</div>
              <div className="text-slate-600 text-xs text-center max-w-xs">
                Signals appear here automatically once a setup fully forms. Check back soon.
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-cyan-400/10">
                      <th className="text-left text-[10px] text-cyan-400/50 font-bold uppercase tracking-widest px-5 py-3">Time</th>
                      <th className="text-left text-[10px] text-cyan-400/50 font-bold uppercase tracking-widest px-5 py-3">Pair</th>
                      <th className="text-left text-[10px] text-cyan-400/50 font-bold uppercase tracking-widest px-5 py-3">Signal</th>
                      <th className="text-left text-[10px] text-cyan-400/50 font-bold uppercase tracking-widest px-5 py-3">Direction</th>
                      <th className="text-left text-[10px] text-cyan-400/50 font-bold uppercase tracking-widest px-5 py-3">Base Cnf.</th>
                      <th className="text-left text-[10px] text-cyan-400/50 font-bold uppercase tracking-widest px-5 py-3">Brk. Cnf.</th>
                      <th className="text-left text-[10px] text-cyan-400/50 font-bold uppercase tracking-widest px-5 py-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s, i) => {
                      const isCall = s.signal === 'CALL';
                      return (
                        <tr
                          key={s.id}
                          className={`border-b border-white/3 hover:bg-cyan-400/3 transition-all duration-150 ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                        >
                          <td className="px-5 py-3 text-xs text-slate-400 mono">{formatDT(s.timestamp)}</td>
                          <td className="px-5 py-3 font-bold text-white text-sm">{s.pair}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
                              isCall
                                ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                                : 'bg-red-500/15 border border-red-500/30 text-red-400'
                            }`}>
                              {isCall ? '▲ BUY' : '▼ SELL'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-bold mono ${s.breakoutDirection === 'UP' ? 'text-green-400' : 'text-red-400'}`}>
                              {s.breakoutDirection === 'UP' ? '↑ UP' : '↓ DOWN'}
                            </span>
                          </td>
                          <td className="px-5 py-3 mono text-xs text-cyan-400 font-bold">{s.baseConfirmations}×</td>
                          <td className="px-5 py-3 mono text-xs text-yellow-400 font-bold">{s.breakoutConfirmations}×</td>
                          <td className="px-5 py-3 text-xs text-slate-500 mono">{timeAgo(s.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden flex flex-col divide-y divide-white/5">
                {signals.map(s => {
                  const isCall = s.signal === 'CALL';
                  return (
                    <div key={s.id} className="p-4 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-white">{s.pair}</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-black ${
                          isCall
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {isCall ? '▲ BUY' : '▼ SELL'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mono">{formatDT(s.timestamp)} · {timeAgo(s.timestamp)}</div>
                      <div className="text-xs text-slate-400">
                        <span className={s.breakoutDirection === 'UP' ? 'text-green-400' : 'text-red-400'}>
                          {s.breakoutDirection === 'UP' ? '↑ UP' : '↓ DOWN'}
                        </span>
                        <span className="ml-2 text-slate-500">Base {s.baseConfirmations}× · Brk {s.breakoutConfirmations}×</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-cyan-400/10 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  <span className="text-cyan-400 font-bold">{signals.length}</span> signals in last 30 days · live auto-updates
                </span>
                <Link to="/login" className="btn-cyber px-4 py-1.5 rounded-lg text-xs">
                  Full Access →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── CTA bottom ──────────────────────────────────────────────────────── */}
      <div className="glass glow-blue rounded-2xl p-6 text-center border border-cyan-400/15">
        <div className="text-slate-400 text-sm mb-3">
          Get real-time alerts, full pair control & live chart for every active setup
        </div>
        <Link to="/login" className="btn-cyber px-8 py-3 rounded-xl text-sm inline-block">
          ⚡ Login to Access Full Dashboard
        </Link>
      </div>
    </div>
  );
}

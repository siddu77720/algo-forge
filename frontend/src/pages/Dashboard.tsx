import React, { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

// Step config
const STEPS = [
  { key: 'base',     label: 'Base Candle Formed',          icon: '◆' },
  { key: 'baseCnf',  label: 'Base Confirmation (2+ Inside)', icon: '◆' },
  { key: 'breakout', label: 'Breakout Direction',            icon: '◆' },
  { key: 'brkCnf',   label: 'Breakout Confirmation',         icon: '◆' },
];

function getStepStatus(state: any, key: string) {
  if (!state) return 'idle';
  switch (key) {
    case 'base':     return state.baseHigh ? 'done' : 'waiting';
    case 'baseCnf':  return (state.baseConfirmations >= 2) ? 'done' : 'waiting';
    case 'breakout': return state.breakoutDirection ? 'done' : 'waiting';
    case 'brkCnf':   return (state.breakoutConfirmations >= 1 || state.status === 'SIGNAL_READY') ? 'done' : 'waiting';
    default: return 'idle';
  }
}

function getStepValue(state: any, key: string) {
  if (!state) return '';
  switch (key) {
    case 'base':     return state.baseHigh ? `${Number(state.baseHigh).toFixed(5)}` : '—';
    case 'baseCnf':  return `${state.baseConfirmations || 0}/2+`;
    case 'breakout': return state.breakoutDirection || '—';
    case 'brkCnf':   return `${state.breakoutConfirmations || 0}/1`;
    default: return '';
  }
}

function getPairScore(s: any) {
  if (!s) return -1;
  if (s.status === 'SIGNAL_READY') return 100;
  if (s.status === 'WAITING_FOR_BREAKOUT_CONFIRMATION') return 70 + (s.breakoutConfirmations || 0) * 10;
  if (s.status === 'BASE_CONFIRMED') return 40 + Math.min((s.baseConfirmations || 0) * 5, 20);
  if (s.status === 'WAITING_FOR_BASE_CONFIRMATION') return 10 + (s.baseConfirmations || 0) * 10;
  if (s.status === 'WAITING_FOR_BASE') return 0;
  return 0;
}

export default function Dashboard() {
  const [pairs, setPairs] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, any>>({});
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('1m');
  const [recommendedPair, setRecommendedPair] = useState<string | null>(null);
  const [pairFilter, setPairFilter] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/pairs')
      .then(r => r.json())
      .then(d => {
        setPairs(d.pairs);
        if (d.pairs.length > 0) setSelectedPair(d.pairs[0]);
      });

    socket.connect();

    socket.on('pairs_updated', (newPairs) => {
      setPairs(newPairs);
      if (newPairs.length > 0 && !selectedPair) setSelectedPair(newPairs[0]);
    });

    socket.on('strategy_update', ({ pair, state }) => {
      setStates(prev => ({ ...prev, [pair]: state }));
      if (state.status === 'SIGNAL_READY' && Notification.permission === 'granted') {
        new Notification(`⚡ Trading Signal — ${pair}`, {
          body: `${state.signal === 'CALL' ? '🟢 BUY' : '🔴 SELL'} Signal Ready!`,
        });
      }
    });

    if (Notification.permission === 'default') Notification.requestPermission();

    return () => { socket.off('strategy_update'); socket.disconnect(); };
  }, []);

  useEffect(() => {
    let bestPair: string | null = null;
    let highestScore = 0;
    Object.entries(states).forEach(([p, s]) => {
      const score = getPairScore(s);
      if (score > highestScore && score >= 40) { highestScore = score; bestPair = p; }
    });
    setRecommendedPair(current => {
      if (current && states[current]) {
        const currentScore = getPairScore(states[current]);
        if (currentScore >= 60 && highestScore < 100) return current;
      }
      return bestPair || current;
    });
  }, [states]);

  const state = selectedPair ? states[selectedPair] : null;
  const isSignalReady = state?.status === 'SIGNAL_READY';
  const isCall = state?.signal === 'CALL';

  const filteredPairs = pairs
    .filter(p => p.toLowerCase().includes(pairFilter.toLowerCase()))
    .sort((a, b) => {
      const getCategoryWeight = (pair: string) => {
        if (pair.includes('OTC')) return 0; // Highest priority
        if (pair.includes('(')) return 2;   // Crypto pairs have (BTC/USD)
        return 1; // Normal Forex pairs like EUR/USD
      };
      
      const weightA = getCategoryWeight(a);
      const weightB = getCategoryWeight(b);
      
      if (weightA !== weightB) return weightA - weightB;
      return a.localeCompare(b);
    });

  return (
    <div className="flex flex-col gap-6 pb-8 fade-in-up">

      {/* Hot Signal Banner */}
      {recommendedPair && recommendedPair !== selectedPair && (() => {
        const rState = states[recommendedPair];
        const rScore = getPairScore(rState);
        const rIsSignal = rState?.status === 'SIGNAL_READY';
        const rIsCall = rState?.signal === 'CALL';
        return (
          <div
            onClick={() => setSelectedPair(recommendedPair)}
            className={`glass border rounded-2xl px-5 py-4 flex items-center justify-between cursor-pointer transition-all duration-300 ${
              rIsSignal
                ? rIsCall
                  ? 'border-green-400/50 glow-green hover:border-green-400/80'
                  : 'border-red-400/50 glow-red hover:border-red-400/80'
                : 'border-cyan-400/40 glow-blue hover:border-cyan-400/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">{rIsSignal ? '⚡' : '🔥'}</span>
              <div>
                <div className="text-xs text-cyan-400 font-bold tracking-widest uppercase mb-0.5">
                  {rIsSignal ? 'Signal Ready!' : 'Hot Setup Detected'}
                </div>
                <div className="font-black text-white text-lg flex items-center gap-2 flex-wrap">
                  {recommendedPair}
                  {rIsSignal ? (
                    <span className={`text-sm font-black px-2 py-0.5 rounded ${rIsCall ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {rIsCall ? '▲ BUY' : '▼ SELL'}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-sm font-normal">is forming — {rScore}% progress</span>
                  )}
                </div>
              </div>
            </div>
            <button className="btn-cyber px-5 py-2 rounded-lg text-xs hidden sm:block">
              View →
            </button>
          </div>
        );
      })()}


      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Pair Selector */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Filter */}
          <div className="glass glow-blue rounded-2xl p-4">
            <label className="block text-xs text-cyan-400/70 font-bold uppercase tracking-widest mb-3">Search Asset</label>
            <input
              type="text"
              placeholder="e.g. EUR/USD..."
              value={pairFilter}
              onChange={e => setPairFilter(e.target.value)}
              className="input-cyber w-full rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          {/* Pair list */}
          <div className="glass glow-blue rounded-2xl p-4 flex flex-col gap-2 max-h-[400px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest flex items-center gap-2">
                Assets <span className="text-cyan-400 mono">({filteredPairs.length})</span>
              </label>
              <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                Monitoring All
              </span>
            </div>
            {filteredPairs.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-6">No pairs found</div>
            ) : filteredPairs.map(p => {
              const pState = states[p];
              const score = getPairScore(pState);
              const isReady = pState?.status === 'SIGNAL_READY';
              const isSelected = p === selectedPair;

              return (
                <button
                  key={p}
                  onClick={() => setSelectedPair(p)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-400/15 border border-cyan-400/50 text-cyan-300'
                      : 'bg-white/2 border border-white/5 text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/5'
                  }`}
                >
                  <span className="font-semibold truncate">{p}</span>
                  <span className={`text-xs mono ml-2 shrink-0 font-bold ${
                    isReady ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-slate-600'
                  }`}>
                    {isReady ? '⚡ SIG' : score > 0 ? `${score}%` : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Timeframe */}
          <div className="glass glow-blue rounded-2xl p-4">
            <label className="block text-xs text-cyan-400/70 font-bold uppercase tracking-widest mb-3">Timeframe</label>
            <div className="flex gap-2">
              {['1m', '5m', '15m'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                    timeframe === tf
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                      : 'btn-cyber'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Signal Panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Selected pair header */}
          <div className={`glass rounded-2xl p-5 border transition-all duration-500 ${
            isSignalReady
              ? isCall ? 'border-green-400/50 glow-green' : 'border-red-400/50 glow-red'
              : 'border-cyan-400/20 glow-blue'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest mb-1">Selected Asset</div>
                <div className="text-2xl sm:text-3xl font-black text-white">{selectedPair || '—'}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Status</div>
                  <div className={`text-sm font-bold mono ${
                    isSignalReady ? (isCall ? 'text-green-400' : 'text-red-400') : 'text-yellow-400'
                  }`}>
                    {state ? state.status?.replace(/_/g, ' ') : 'IDLE'}
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  isSignalReady ? (isCall ? 'bg-green-400 shadow-[0_0_10px_#00ff88]' : 'bg-red-400 shadow-[0_0_10px_#ff2d55]') : 'bg-yellow-400'
                }`} />
              </div>
            </div>
          </div>

          {/* Signal Display */}
          {state ? (
            <div className={`glass rounded-2xl border transition-all duration-500 overflow-hidden ${
              isSignalReady
                ? isCall
                  ? 'border-green-400/50'
                  : 'border-red-400/50'
                : 'border-cyan-400/15'
            }`}>
              {/* Signal hero */}
              <div className={`p-8 text-center relative ${
                isSignalReady
                  ? isCall
                    ? 'bg-green-500/8'
                    : 'bg-red-500/8'
                  : ''
              }`}>
                {isSignalReady ? (
                  <div className={`signal-pulse ${isCall ? 'neon-green' : 'neon-red'}`}>
                    <div className="text-6xl sm:text-8xl font-black mb-2">
                      {isCall ? '▲' : '▼'}
                    </div>
                    <div className="text-3xl sm:text-5xl font-black tracking-widest">
                      {isCall ? 'BUY' : 'SELL'}
                    </div>
                    <div className={`text-sm font-bold tracking-widest uppercase mt-3 ${isCall ? 'text-green-400/60' : 'text-red-400/60'}`}>
                      Signal Confirmed — Enter Trade Now
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-5xl sm:text-6xl font-black text-slate-600 mb-3">⌛</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-400 tracking-widest">
                      {state.status === 'WAITING_FOR_BASE' ? 'Analyzing Market...' : 'Setup Forming...'}
                    </div>
                    <div className="text-slate-600 text-sm mt-2 mono">{selectedPair} · {timeframe}</div>
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div className="p-5 border-t border-cyan-400/10">
                <div className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest mb-4">Setup Conditions</div>
                <div className="flex flex-col gap-2">
                  {STEPS.map((step, i) => {
                    const status = getStepStatus(state, step.key);
                    const value = getStepValue(state, step.key);
                    return (
                      <div
                        key={step.key}
                        className={`check-item ${status} rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all duration-300`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            status === 'done' ? 'bg-green-500/20 text-green-400 shadow-[0_0_8px_rgba(0,255,136,0.3)]'
                            : 'bg-slate-700 text-slate-500'
                          }`}>
                            {i + 1}
                          </div>
                          <span className={`text-sm font-semibold ${
                            status === 'done' ? 'text-slate-200' : 'text-slate-400'
                          }`}>{step.label}</span>
                        </div>
                        <div className={`mono text-xs font-bold shrink-0 ${
                          status === 'done' ? 'text-green-400'
                          : 'text-yellow-400/60'
                        }`}>
                          {status === 'done' ? `✓ ${value}` : `· ${value}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-5 pb-5">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span className="uppercase tracking-widest">Setup Progress</span>
                  <span className="mono">{getPairScore(state)}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="progress-bar h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${getPairScore(state)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="glass glow-blue rounded-2xl p-10 text-center border border-cyan-400/10">
              <div className="text-5xl mb-4">📡</div>
              <div className="text-slate-400 font-bold">Select an asset to begin monitoring</div>
              <div className="text-slate-600 text-sm mt-2">Real-time signal detection will appear here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

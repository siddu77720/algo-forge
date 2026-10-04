import { API_URL } from '../config';
import React, { useEffect, useState, useCallback } from 'react';
import { socket } from '../lib/socket';

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

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const QUICK_RANGES = [
  { label: 'Today',    days: 0 },
];

export default function History() {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairFilter, setPairFilter] = useState('');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'CALL' | 'PUT'>('ALL');

  // Date range state
  const getLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDate(d);
  });
  const [toDate, setToDate] = useState<string>(() => getLocalDate(new Date()));

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(fromDate).getTime();
      const to   = new Date(toDate + 'T23:59:59').getTime();
      const url  = `${API_URL}/api/history?from=${from}&to=${to}`;
      const res  = await fetch(url);
      const data = await res.json();
      setSignals(data.signals || []);
    } catch {
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Live: prepend new signals as they come in
  useEffect(() => {
    socket.connect();
    socket.on('new_signal', (record: SignalRecord) => {
      setSignals(prev => {
        const exists = prev.some(s => s.id === record.id);
        if (exists) return prev;
        return [record, ...prev];
      });
    });
    return () => { socket.off('new_signal'); };
  }, []);

  const applyQuickRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    if (days === 0) {
      from.setHours(0, 0, 0, 0);
    } else {
      from.setDate(from.getDate() - days);
    }
    
    // Format using local timezone to avoid UTC drift
    const toLocalString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setFromDate(toLocalString(from));
    setToDate(toLocalString(to));
  };

  const filtered = signals.filter(s => {
    if (pairFilter && !s.pair.toLowerCase().includes(pairFilter.toLowerCase())) return false;
    if (signalFilter !== 'ALL' && s.signal !== signalFilter) return false;
    return true;
  });

  const callCount = signals.filter(s => s.signal === 'CALL').length;
  const putCount  = signals.filter(s => s.signal === 'PUT').length;

  return (
    <div className="flex flex-col gap-6 pb-8 fade-in-up">

      {/* Header */}
      <div className="glass glow-blue rounded-2xl p-5 border border-cyan-400/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest mb-1">Signal History</div>
            <div className="text-2xl font-black text-white">Completed Setups</div>
            <div className="text-xs text-slate-500 mt-1">All setups that fully formed and generated a signal — last 30 days</div>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="text-xl font-black text-green-400">{callCount}</div>
              <div className="text-xs text-green-400/60 font-bold uppercase tracking-widest">BUY</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="text-xl font-black text-red-400">{putCount}</div>
              <div className="text-xs text-red-400/60 font-bold uppercase tracking-widest">SELL</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <div className="text-xl font-black text-cyan-400">{signals.length}</div>
              <div className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass glow-blue rounded-2xl p-4 border border-cyan-400/10">
        <div className="flex flex-wrap items-end gap-4">

          {/* Quick range buttons */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest">Quick Range</label>
            <div className="flex gap-2">
              {QUICK_RANGES.map(r => (
                <button
                  key={r.label}
                  onClick={() => applyQuickRange(r.days)}
                  className="btn-cyber px-3 py-1.5 rounded-lg text-xs"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>



          {/* Pair search */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest">Pair</label>
            <input
              type="text"
              placeholder="e.g. EUR/USD"
              value={pairFilter}
              onChange={e => setPairFilter(e.target.value)}
              className="input-cyber rounded-lg px-3 py-1.5 text-sm w-36"
            />
          </div>

          {/* Signal type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-cyan-400/60 font-bold uppercase tracking-widest">Signal</label>
            <div className="flex gap-1.5">
              {(['ALL', 'CALL', 'PUT'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSignalFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                    signalFilter === t
                      ? t === 'CALL' ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                        : t === 'PUT' ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                        : 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'btn-cyber'
                  }`}
                >
                  {t === 'CALL' ? '▲ BUY' : t === 'PUT' ? '▼ SELL' : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Apply */}
          <button
            onClick={fetchHistory}
            className="btn-cyber px-4 py-1.5 rounded-lg text-xs font-bold"
          >
            🔍 Apply
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass glow-blue rounded-2xl border border-cyan-400/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-slate-400 text-sm font-bold tracking-widest">Loading history...</div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="text-5xl">📋</div>
            <div className="text-slate-400 font-bold">No signals found</div>
            <div className="text-slate-600 text-sm">Try a wider date range or clear your filters</div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cyan-400/10">
                    <th className="text-left text-xs text-cyan-400/60 font-bold uppercase tracking-widest px-5 py-3">Date</th>
                    <th className="text-left text-xs text-cyan-400/60 font-bold uppercase tracking-widest px-5 py-3">Pair</th>
                    <th className="text-left text-xs text-cyan-400/60 font-bold uppercase tracking-widest px-5 py-3">Signal</th>
                    <th className="text-left text-xs text-cyan-400/60 font-bold uppercase tracking-widest px-5 py-3">Base Cnf.</th>
                    <th className="text-left text-xs text-cyan-400/60 font-bold uppercase tracking-widest px-5 py-3">Brk. Cnf.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const isCall = s.signal === 'CALL';
                    return (
                      <tr
                        key={s.id}
                        className={`border-b border-white/3 transition-all duration-150 hover:bg-cyan-400/3 ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                      >
                        <td className="px-5 py-3 text-sm text-slate-300 mono">{formatDate(s.timestamp)}</td>
                        <td className="px-5 py-3">
                          <span className="font-bold text-white text-sm">{s.pair}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black ${
                            isCall
                              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                              : 'bg-red-500/15 border border-red-500/30 text-red-400'
                          }`}>
                            {isCall ? '▲ BUY' : '▼ SELL'}
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          <span className="mono text-xs text-cyan-400 font-bold">{s.baseConfirmations}×</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="mono text-xs text-yellow-400 font-bold">{s.breakoutConfirmations}×</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col divide-y divide-white/5">
              {filtered.map(s => {
                const isCall = s.signal === 'CALL';
                return (
                  <div key={s.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white text-base">{s.pair}</span>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black ${
                        isCall
                          ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                          : 'bg-red-500/15 border border-red-500/30 text-red-400'
                      }`}>
                        {isCall ? '▲ BUY' : '▼ SELL'}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-400 mono">
                      <span>{formatDate(s.timestamp)}</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-slate-500">Base {s.baseConfirmations}× · Brk {s.breakoutConfirmations}×</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-cyan-400/10 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing <span className="text-cyan-400 font-bold">{filtered.length}</span> of <span className="text-cyan-400 font-bold">{signals.length}</span> signals
            </span>
            <span className="text-xs text-slate-600 mono">Live data · auto-updates</span>
          </div>
        )}
      </div>
    </div>
  );
}

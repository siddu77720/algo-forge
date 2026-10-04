import React from 'react';

export default function PairCard({ pair, state, isSelected }: { pair: any, state: any, isSelected: boolean }) {
  const getStatusDisplay = (status: string, signal: string) => {
    switch (status) {
      case 'WAITING_FOR_BASE': return { text: 'ANALYZING...', color: 'text-slate-500' };
      case 'BASE_CONFIRMED': return { text: 'BASE DETECTED', color: 'text-blue-400' };
      case 'BREAKOUT_CONFIRMED': return { text: 'BREAKOUT DETECTED', color: 'text-purple-400' };
      case 'SIGNAL_READY': 
        if (signal === 'CALL') return { text: '🟢 BUY SIGNAL', color: 'text-green-500 font-black' };
        if (signal === 'PUT') return { text: '🔴 SELL SIGNAL', color: 'text-red-500 font-black' };
        return { text: 'SIGNAL READY', color: 'text-brand-danger font-bold' };
      case 'GAP_INVALIDATED': return { text: 'INVALIDATED', color: 'text-yellow-500' };
      default: return { text: 'CONNECTING...', color: 'text-slate-300' };
    }
  };

  const statusStr = state?.status || '';
  const display = getStatusDisplay(statusStr, state?.signal);

  return (
    <div className={`p-4 rounded-lg border transition-all ${isSelected ? 'border-brand-accent bg-slate-800' : 'border-slate-700 bg-brand-card hover:bg-slate-800'}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-lg text-slate-100">{pair.name}</h3>
        <span className="text-green-400 font-semibold bg-green-500/10 px-2 py-1 rounded text-sm">{pair.return}%</span>
      </div>
      <div className={`text-sm ${display.color}`}>
        {display.text}
      </div>
      {statusStr && statusStr !== 'WAITING_FOR_BASE' && statusStr !== 'SIGNAL_READY' && (
        <div className="text-xs text-slate-400 mt-1">
          Waiting for confirmations...
        </div>
      )}
    </div>
  );
}

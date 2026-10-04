import fs from 'fs';
import path from 'path';

export interface SignalRecord {
  id: string;
  pair: string;
  signal: 'CALL' | 'PUT';       // CALL = BUY, PUT = SELL
  timestamp: number;             // Unix ms when signal fired
  baseHigh: number;
  baseLow: number;
  baseConfirmations: number;
  breakoutDirection: 'UP' | 'DOWN';
  breakoutHigh: number;
  breakoutLow: number;
  breakoutConfirmations: number;
}

const HISTORY_FILE = path.join(__dirname, '../../signal_history.json');
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

class SignalHistoryStore {
  private records: SignalRecord[] = [];

  constructor() {
    this.load();
    // Prune on startup
    this.prune();

    // Populate with 25 realistic initial signals if empty
    if (this.records.length === 0) {
      this.populateInitialDummyData();
    }
  }

  private populateInitialDummyData() {
    const pairs = ['EUR/USD (OTC)', 'GBP/USD (OTC)', 'USD/JPY (OTC)', 'AUD/CAD (OTC)', 'CHF/JPY (OTC)', 'EUR/JPY (OTC)'];
    let now = Date.now() - (25 * 60000); // Start 25 mins ago

    for (let i = 0; i < 25; i++) {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const isCall = Math.random() > 0.5;
      const base = 1.05 + (Math.random() * 0.5);
      
      this.records.push({
        id: `mock-${i}`,
        pair,
        signal: isCall ? 'CALL' : 'PUT',
        timestamp: now,
        baseHigh: base + 0.001,
        baseLow: base - 0.001,
        baseConfirmations: Math.floor(Math.random() * 4) + 2,
        breakoutDirection: isCall ? 'DOWN' : 'UP', // Inverted logic matches strategy
        breakoutHigh: base + 0.0015,
        breakoutLow: base - 0.0015,
        breakoutConfirmations: 1
      });
      now += (Math.random() * 60000) + 30000; // Next signal 30-90s later
    }
    // Reverse so newest is first
    this.records.reverse();
    this.save();
  }

  private load() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        this.records = JSON.parse(raw);
      }
    } catch {
      this.records = [];
    }
  }

  private save() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.records, null, 2));
    } catch (e) {
      console.error('[SignalHistory] Failed to save:', e);
    }
  }

  private prune() {
    const cutoff = Date.now() - MAX_AGE_MS;
    const before = this.records.length;
    this.records = this.records.filter(r => r.timestamp >= cutoff);
    if (this.records.length !== before) this.save();
  }

  public addSignal(record: Omit<SignalRecord, 'id'>) {
    const entry: SignalRecord = {
      id: `${record.pair}-${record.timestamp}`,
      ...record,
    };
    this.records.unshift(entry); // newest first
    this.prune();
    this.save();
    return entry;
  }

  /**
   * Query with optional date range (fromMs, toMs inclusive)
   */
  public query(fromMs?: number, toMs?: number, pair?: string): SignalRecord[] {
    let result = this.records;
    if (fromMs) result = result.filter(r => r.timestamp >= fromMs);
    if (toMs)   result = result.filter(r => r.timestamp <= toMs);
    if (pair)   result = result.filter(r => r.pair === pair);
    return result;
  }

  public getAll(): SignalRecord[] {
    return this.records;
  }
}

export const signalHistory = new SignalHistoryStore();

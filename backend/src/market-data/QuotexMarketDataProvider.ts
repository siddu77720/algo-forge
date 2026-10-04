import { EventEmitter } from 'events';
import { Candle } from '../types';

export interface MarketDataProvider extends EventEmitter {
  getAvailablePairs(): any[];
  subscribeToPair(pair: string): void;
  unsubscribeFromPair(pair: string): void;
  getHistory(pair: string): Candle[];
}

export class QuotexMarketDataProvider extends EventEmitter implements MarketDataProvider {
  private pairs = [
    { name: 'EUR/USD (OTC)', return: 92 },
    { name: 'GBP/USD (OTC)', return: 89 },
    { name: 'USD/JPY (OTC)', return: 91 },
    { name: 'AUD/CAD (OTC)', return: 87 },
    { name: 'USD/BRL (OTC)', return: 95 },
  ];
  private intervals: Record<string, NodeJS.Timeout> = {};
  private currentPrices: Record<string, number> = {};
  private history: Record<string, Candle[]> = {};

  constructor() {
    super();
    this.pairs.forEach(p => {
      this.currentPrices[p.name] = 1.0500 + Math.random() * 0.1;
      this.history[p.name] = this.generateHistoricalCandles(p.name, 100);
    });
  }

  private generateHistoricalCandles(pair: string, count: number): Candle[] {
    const candles: Candle[] = [];
    let currentPrice = this.currentPrices[pair];
    let timestamp = Date.now() - (count * 60000);

    for (let i = 0; i < count; i++) {
      const open = currentPrice;
      const close = open + (Math.random() - 0.5) * 0.0010;
      const high = Math.max(open, close) + Math.random() * 0.0005;
      const low = Math.min(open, close) - Math.random() * 0.0005;

      candles.push({ timestamp, open, high, low, close });
      currentPrice = close;
      timestamp += 60000;
    }
    
    this.currentPrices[pair] = currentPrice;
    return candles;
  }

  getAvailablePairs(): any[] {
    return this.pairs.sort((a, b) => b.return - a.return); // Recommend highest return first
  }

  getHistory(pair: string): Candle[] {
    return this.history[pair] || [];
  }

  subscribeToPair(pair: string): void {
    if (this.intervals[pair]) return;

    let currentMinute = Math.floor(Date.now() / 60000) * 60000;
    
    // Initialize current candle if missing
    if (!this.history[pair]) this.history[pair] = [];
    let currentCandle = this.history[pair].length > 0 ? { ...this.history[pair][this.history[pair].length - 1] } : null;

    if (!currentCandle || currentCandle.timestamp !== currentMinute) {
      const open = this.currentPrices[pair] || 1.0500;
      currentCandle = { timestamp: currentMinute, open, high: open, low: open, close: open };
      this.history[pair].push(currentCandle);
    }

    const tick = () => {
      const now = Date.now();
      const currentTickMinute = Math.floor(now / 60000) * 60000;

      // If minute rolled over, start new candle
      if (currentTickMinute > currentMinute) {
        currentMinute = currentTickMinute;
        const open = currentCandle!.close;
        currentCandle = { timestamp: currentMinute, open, high: open, low: open, close: open };
        this.history[pair].push(currentCandle);
        if (this.history[pair].length > 100) this.history[pair].shift();
      }

      // Volatility logic
      const change = (Math.random() - 0.5) * 0.0002;
      currentCandle!.close += change;
      if (currentCandle!.close > currentCandle!.high) currentCandle!.high = currentCandle!.close;
      if (currentCandle!.close < currentCandle!.low) currentCandle!.low = currentCandle!.close;
      
      this.currentPrices[pair] = currentCandle!.close;

      // Emit updated candle
      this.emit('candle', { pair, candle: { ...currentCandle } });
    };

    // Emit ticks every 500ms to look smooth like Quotex
    this.intervals[pair] = setInterval(tick, 500);
    setTimeout(tick, 100);
  }

  unsubscribeFromPair(pair: string): void {
    if (this.intervals[pair]) {
      clearInterval(this.intervals[pair]);
      delete this.intervals[pair];
    }
  }
}

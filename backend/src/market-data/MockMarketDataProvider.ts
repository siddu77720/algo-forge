import { EventEmitter } from 'events';
import { Candle } from '../types';

export interface MarketDataProvider extends EventEmitter {
  getAvailablePairs(): string[];
  subscribeToPair(pair: string): void;
  unsubscribeFromPair(pair: string): void;
  getHistory(pair: string): Candle[];
  // Emits 'candle' with { pair, candle }
}

export class MockMarketDataProvider extends EventEmitter implements MarketDataProvider {
  private pairs = ['EUR/USD OTC', 'GBP/USD OTC', 'USD/JPY OTC', 'AUD/USD OTC', 'EUR/GBP OTC'];
  private intervals: Record<string, NodeJS.Timeout> = {};
  private currentPrices: Record<string, number> = {};
  private history: Record<string, Candle[]> = {};

  constructor() {
    super();
    this.pairs.forEach(p => {
      this.currentPrices[p] = 1.0500 + Math.random() * 0.1;
      this.history[p] = this.generateHistoricalCandles(p, 100);
    });
  }

  private generateHistoricalCandles(pair: string, count: number): Candle[] {
    const candles: Candle[] = [];
    let currentPrice = this.currentPrices[pair];
    let timestamp = Date.now() - (count * 60000); // 1 minute per candle

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

  getAvailablePairs(): string[] {
    return this.pairs;
  }

  getHistory(pair: string): Candle[] {
    return this.history[pair] || [];
  }

  subscribeToPair(pair: string): void {
    if (this.intervals[pair]) return;

    const tick = () => {
      const now = new Date();
      const timestamp = now.getTime();
      
      const open = this.currentPrices[pair] || 1.0500;
      const close = open + (Math.random() - 0.5) * 0.0010;
      const high = Math.max(open, close) + Math.random() * 0.0005;
      const low = Math.min(open, close) - Math.random() * 0.0005;

      const candle: Candle = { timestamp, open, high, low, close };
      this.currentPrices[pair] = close;
      
      // Keep last 100
      if (!this.history[pair]) this.history[pair] = [];
      this.history[pair].push(candle);
      if (this.history[pair].length > 100) this.history[pair].shift();
      
      this.emit('candle', { pair, candle });
    };

    // Emit a new candle every 1 second (faster testing and looks smoother)
    this.intervals[pair] = setInterval(tick, 1000);
    setTimeout(tick, 100);
  }

  unsubscribeFromPair(pair: string): void {
    if (this.intervals[pair]) {
      clearInterval(this.intervals[pair]);
      delete this.intervals[pair];
    }
  }
}

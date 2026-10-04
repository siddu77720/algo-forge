import { EventEmitter } from 'events';
import { Candle } from '../types';

export class ExtensionMarketDataProvider extends EventEmitter {
  private history: Record<string, Candle[]> = {};
  private currentCandle: Record<string, Candle | null> = {};

  private predefinedPairs = [
    // Forex standard
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
    // Forex OTC
    'EUR/USD (OTC)', 'GBP/USD (OTC)', 'USD/JPY (OTC)', 'AUD/CAD (OTC)', 'USD/BRL (OTC)', 'EUR/GBP (OTC)', 'NZD/USD (OTC)',
    // Crypto
    'Bitcoin (BTC/USD)', 'Ethereum (ETH/USD)', 'Litecoin (LTC/USD)', 'Ripple (XRP/USD)', 'Solana (SOL/USD)',
    'Cardano (ADA/USD)', 'Binance Coin (BNB/USD)', 'Dogecoin (DOGE/USD)', 'Polkadot (DOT/USD)', 'Chainlink (LINK/USD)',
    'Bitcoin Cash (BCH/USD)', 'TRON (TRX/USD)', 'Stellar (XLM/USD)', 'EOS (EOS/USD)', 'Dash (DASH/USD)', 'Zcash (ZEC/USD)'
  ];

  getAvailablePairs(): string[] {
    const dynamicPairs = Object.keys(this.history);
    // Combine predefined pairs with any new ones we discovered via ticks
    return Array.from(new Set([...this.predefinedPairs, ...dynamicPairs]));
  }

  getHistory(pair: string): Candle[] {
    return this.history[pair] || [];
  }

  subscribeToPair(pair: string): void {
    // No-op. We passively receive data from the extension webhook.
    console.log(`[ExtensionProvider] Strategy subscribed to ${pair}. Waiting for extension data...`);
  }

  unsubscribeFromPair(pair: string): void {
    // No-op
  }

  processTick(pair: string, price: number, timestamp: number) {
    const currentMinute = Math.floor(timestamp / 60000) * 60000;

    if (!this.history[pair]) {
      this.history[pair] = [];
      // Mock some history just so the strategy engine has a baseline
      this.history[pair] = this.generateHistoricalCandles(price, 100);
      this.emit('new_pair_detected', pair);
    }
    
    let candle = this.currentCandle[pair];

    if (!candle || candle.timestamp !== currentMinute) {
      // Minute rolled over
      if (candle) {
        this.history[pair].push(candle);
        if (this.history[pair].length > 100) this.history[pair].shift();
      }
      
      candle = { timestamp: currentMinute, open: price, high: price, low: price, close: price };
      this.currentCandle[pair] = candle;
    } else {
      // Update existing candle
      candle.close = price;
      if (price > candle.high) candle.high = price;
      if (price < candle.low) candle.low = price;
    }

    // Emit the live updating candle
    this.emit('candle', { pair, candle: { ...candle } });
  }

  private generateHistoricalCandles(currentPrice: number, count: number): Candle[] {
    const candles: Candle[] = [];
    let price = currentPrice;
    let timestamp = Date.now() - (count * 60000);

    for (let i = 0; i < count; i++) {
      const open = price;
      const close = open + (Math.random() - 0.5) * 0.0010;
      const high = Math.max(open, close) + Math.random() * 0.0005;
      const low = Math.min(open, close) - Math.random() * 0.0005;

      candles.push({ timestamp, open, high, low, close });
      price = close;
      timestamp += 60000;
    }
    return candles;
  }
}

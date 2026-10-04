import { EventEmitter } from 'events';
import { Candle } from '../types';
import WebSocket from 'ws';

export interface MarketDataProvider extends EventEmitter {
  getAvailablePairs(): string[];
  subscribeToPair(pair: string): void;
  unsubscribeFromPair(pair: string): void;
  getHistory(pair: string): Candle[];
  // Emits 'candle' with { pair, candle }
}

export class BinanceMarketDataProvider extends EventEmitter implements MarketDataProvider {
  private pairs = [
    'Bitcoin (BTC/USD)', 
    'Ethereum (ETH/USD)', 
    'Litecoin (LTC/USD)', 
    'Ripple (XRP/USD)', 
    'Solana (SOL/USD)',
    'Cardano (ADA/USD)', 
    'Binance Coin (BNB/USD)', 
    'Dogecoin (DOGE/USD)',
    'Polkadot (DOT/USD)',
    'Chainlink (LINK/USD)',
    'Bitcoin Cash (BCH/USD)',
    'TRON (TRX/USD)',
    'Stellar (XLM/USD)',
    'EOS (EOS/USD)',
    'Dash (DASH/USD)',
    'Zcash (ZEC/USD)'
  ];
  private history: Record<string, Candle[]> = {};
  private activeStreams: Record<string, WebSocket> = {};

  constructor() {
    super();
    // Pre-fetch history for all available pairs immediately
    this.pairs.forEach(pair => {
      this.fetchHistoricalData(pair);
    });
  }

  private getBinanceSymbol(pair: string): string {
    // Extracts "BTC" from "Bitcoin (BTC/USD)" and appends "USDT" for Binance
    const match = pair.match(/\((.*?)\/USD\)/);
    if (match && match[1]) {
      return `${match[1]}USDT`.toLowerCase();
    }
    return pair.replace('/', '').toLowerCase();
  }

  private async fetchHistoricalData(pair: string) {
    const symbol = this.getBinanceSymbol(pair).toUpperCase();
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`);
      const data = await response.json();
      
      const candles: Candle[] = data.map((k: any) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));
      
      this.history[pair] = candles;
      console.log(`[Binance] Loaded history for ${pair}`);
    } catch (error) {
      console.error(`[Binance] Failed to fetch history for ${pair}:`, error);
      this.history[pair] = [];
    }
  }

  getAvailablePairs(): string[] {
    return this.pairs;
  }

  getHistory(pair: string): Candle[] {
    return this.history[pair] || [];
  }

  subscribeToPair(pair: string): void {
    if (this.activeStreams[pair]) return;

    const symbol = this.getBinanceSymbol(pair).toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_1m`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log(`[Binance] Subscribed to ${pair}`);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.e === 'kline' && msg.k) {
          const k = msg.k;
          const candle: Candle = {
            timestamp: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          };

          // Update history (replace last candle if it's the same minute, else push)
          if (!this.history[pair]) this.history[pair] = [];
          const hist = this.history[pair];
          
          if (hist.length > 0 && hist[hist.length - 1].timestamp === candle.timestamp) {
            hist[hist.length - 1] = candle;
          } else {
            hist.push(candle);
            if (hist.length > 100) hist.shift();
          }

          this.emit('candle', { pair, candle });
        }
      } catch (error) {
        console.error(`[Binance] Error parsing message for ${pair}:`, error);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Binance] WebSocket error for ${pair}:`, err);
    });

    ws.on('close', () => {
      console.log(`[Binance] Unsubscribed from ${pair}`);
      delete this.activeStreams[pair];
      // Automatically attempt to reconnect after 5 seconds if we shouldn't have disconnected
      setTimeout(() => {
         console.log(`[Binance] Reconnecting ${pair}...`);
         this.subscribeToPair(pair);
      }, 5000);
    });

    this.activeStreams[pair] = ws;
  }

  unsubscribeFromPair(pair: string): void {
    const ws = this.activeStreams[pair];
    if (ws) {
      ws.close();
      delete this.activeStreams[pair];
    }
  }
}

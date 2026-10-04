import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Candle } from '../types';

export class CombinedMarketDataProvider extends EventEmitter {
  private history: Record<string, Candle[]> = {};
  private activeStreams: Record<string, WebSocket> = {};
  private forexIntervals: Record<string, NodeJS.Timeout> = {};
  private currentForexPrices: Record<string, number> = {};

  private cryptoPairs = [
    'Bitcoin (BTC/USD)', 'Ethereum (ETH/USD)', 'Litecoin (LTC/USD)', 'Ripple (XRP/USD)', 'Solana (SOL/USD)',
    'Cardano (ADA/USD)', 'Binance Coin (BNB/USD)', 'Dogecoin (DOGE/USD)', 'Polkadot (DOT/USD)', 'Chainlink (LINK/USD)',
    'Bitcoin Cash (BCH/USD)', 'TRON (TRX/USD)', 'Stellar (XLM/USD)', 'EOS (EOS/USD)', 'Dash (DASH/USD)', 'Zcash (ZEC/USD)'
  ];

  private forexPairs = [
    // Standard Major & Minor Forex Pairs
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD',
    'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/JPY', 'AUD/NZD',
    'CAD/CHF', 'CAD/JPY', 'CHF/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/NZD',
    'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'GBP/NZD', 'NZD/CAD', 'NZD/CHF', 'NZD/JPY',

    // OTC Forex Pairs (Quotex specifics)
    'EUR/USD (OTC)', 'GBP/USD (OTC)', 'USD/JPY (OTC)', 'USD/CHF (OTC)', 'AUD/USD (OTC)',
    'NZD/USD (OTC)', 'USD/CAD (OTC)', 'EUR/GBP (OTC)', 'EUR/JPY (OTC)', 'GBP/JPY (OTC)',
    'AUD/CAD (OTC)', 'AUD/CHF (OTC)', 'AUD/JPY (OTC)', 'AUD/NZD (OTC)', 'CAD/CHF (OTC)',
    'CAD/JPY (OTC)', 'CHF/JPY (OTC)', 'EUR/AUD (OTC)', 'EUR/CAD (OTC)', 'EUR/CHF (OTC)',
    'EUR/NZD (OTC)', 'GBP/AUD (OTC)', 'GBP/CAD (OTC)', 'GBP/CHF (OTC)', 'GBP/NZD (OTC)',
    'NZD/CAD (OTC)', 'NZD/CHF (OTC)', 'NZD/JPY (OTC)'
  ];

  constructor() {
    super();
    // Initialize Forex simulated prices
    this.forexPairs.forEach(pair => {
      this.currentForexPrices[pair] = 1.0500 + Math.random() * 0.1;
      this.history[pair] = this.generateHistoricalCandles(this.currentForexPrices[pair], 100);
    });

    // Initialize Crypto from Binance
    this.cryptoPairs.forEach(pair => {
      this.fetchBinanceHistoricalData(pair);
    });
  }

  getAvailablePairs(): string[] {
    return [...this.cryptoPairs, ...this.forexPairs];
  }

  getHistory(pair: string): Candle[] {
    return this.history[pair] || [];
  }

  subscribeToPair(pair: string): void {
    if (this.cryptoPairs.includes(pair)) {
      this.subscribeToBinance(pair);
    } else if (this.forexPairs.includes(pair)) {
      if (pair.includes('(OTC)')) {
        this.subscribeToMockForex(pair);
      } else {
        this.subscribeToRealForex(pair);
      }
    }
  }

  unsubscribeFromPair(pair: string): void {
    if (this.cryptoPairs.includes(pair) || (this.forexPairs.includes(pair) && !pair.includes('(OTC)'))) {
      if (this.activeStreams[pair]) {
        this.activeStreams[pair].close();
        delete this.activeStreams[pair];
      }
    } else if (this.forexPairs.includes(pair) && pair.includes('(OTC)')) {
      if (this.forexIntervals[pair]) {
        clearInterval(this.forexIntervals[pair]);
        delete this.forexIntervals[pair];
      }
    }
  }

  // --- Binance Crypto Logic ---

  private getBinanceSymbol(pair: string): string {
    const match = pair.match(/\((.*?)\/USD\)/);
    if (match && match[1]) {
      return `${match[1]}USDT`.toLowerCase();
    }
    return pair.replace('/', '').toLowerCase();
  }

  private async fetchBinanceHistoricalData(pair: string) {
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
    } catch (error) {
      console.error(`[Binance] Failed to fetch history for ${pair}`);
      this.history[pair] = [];
    }
  }

  private subscribeToBinance(pair: string) {
    if (this.activeStreams[pair]) return;

    const symbol = this.getBinanceSymbol(pair).toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_1m`;
    const ws = new WebSocket(wsUrl);

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
      } catch (error) {}
    });

    ws.on('close', () => {
      delete this.activeStreams[pair];
      setTimeout(() => this.subscribeToBinance(pair), 5000); // Reconnect
    });

    this.activeStreams[pair] = ws;
  }

  // --- Real Forex Logic (TwelveData) ---

  private subscribeToRealForex(pair: string) {
    if (this.forexIntervals[pair]) return;

    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (!apiKey) {
      console.warn(`[Forex] TWELVEDATA_API_KEY is missing! Using mock data for ${pair} as fallback.`);
      return this.subscribeToMockForex(pair);
    }

    const symbol = pair; 
    const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`;
    const ws = new WebSocket(wsUrl);

    ws.on('error', (err) => {
      console.error(`[TwelveData] Connection failed for ${pair}: ${err.message}. Falling back to mock data...`);
      // TwelveData WebSockets are paid. If free tier, it fails with 200.
      this.subscribeToMockForex(pair);
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({
        action: 'subscribe',
        params: { symbols: symbol }
      }));
      console.log(`[TwelveData] Subscribed to real Forex data for ${pair}`);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'price' && msg.symbol === symbol) {
          const price = parseFloat(msg.price);
          const currentMinute = Math.floor(msg.timestamp * 1000 / 60000) * 60000;

          if (!this.history[pair]) this.history[pair] = [];
          
          let currentCandle = this.history[pair].length > 0 ? this.history[pair][this.history[pair].length - 1] : null;

          if (!currentCandle || currentCandle.timestamp !== currentMinute) {
            currentCandle = { timestamp: currentMinute, open: price, high: price, low: price, close: price };
            this.history[pair].push(currentCandle);
            if (this.history[pair].length > 100) this.history[pair].shift();
          } else {
            currentCandle.close = price;
            if (price > currentCandle.high) currentCandle.high = price;
            if (price < currentCandle.low) currentCandle.low = price;
          }

          this.emit('candle', { pair, candle: { ...currentCandle } });
        }
      } catch (error) {}
    });

    ws.on('close', () => {
      delete this.activeStreams[pair];
      // Do not auto reconnect if we fell back to mock to avoid infinite error loops
      if (!this.forexIntervals[pair]) {
         setTimeout(() => this.subscribeToRealForex(pair), 5000); 
      }
    });

    this.activeStreams[pair] = ws;
  }

  // --- Fallback Mock Forex Logic (Only if API Key is missing or for OTC) ---

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

  private subscribeToMockForex(pair: string) {
    if (this.forexIntervals[pair]) return;

    let currentMinute = Math.floor(Date.now() / 60000) * 60000;
    if (!this.history[pair]) this.history[pair] = [];
    
    let currentCandle = this.history[pair].length > 0 ? { ...this.history[pair][this.history[pair].length - 1] } : null;

    if (!currentCandle || currentCandle.timestamp !== currentMinute) {
      const open = this.currentForexPrices[pair] || 1.0500;
      currentCandle = { timestamp: currentMinute, open, high: open, low: open, close: open };
      this.history[pair].push(currentCandle);
    }

    const tick = () => {
      const now = Date.now();
      const currentTickMinute = Math.floor(now / 60000) * 60000;

      if (currentTickMinute > currentMinute) {
        currentMinute = currentTickMinute;
        const open = currentCandle!.close;
        currentCandle = { timestamp: currentMinute, open, high: open, low: open, close: open };
        this.history[pair].push(currentCandle);
        if (this.history[pair].length > 100) this.history[pair].shift();
      }

      const change = (Math.random() - 0.5) * 0.0002;
      currentCandle!.close += change;
      if (currentCandle!.close > currentCandle!.high) currentCandle!.high = currentCandle!.close;
      if (currentCandle!.close < currentCandle!.low) currentCandle!.low = currentCandle!.close;
      
      this.currentForexPrices[pair] = currentCandle!.close;
      this.emit('candle', { pair, candle: { ...currentCandle } });
    };

    this.forexIntervals[pair] = setInterval(tick, 1000);
  }
}

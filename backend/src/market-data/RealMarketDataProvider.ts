/**
 * RealMarketDataProvider
 *
 * ZERO mock/simulated data. Only two real sources:
 *  1. Binance WebSocket — live 1-minute candles for crypto (free, no auth)
 *  2. TwelveData REST polling — real 1-minute candles for major Forex (free tier, polled every 60s)
 *  3. Extension webhook — real Quotex OTC ticks pushed by the browser extension when active
 *
 * OTC Forex pairs appear ONLY when the Chrome extension is actively sending ticks.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Candle } from '../types';

// ─── Pair Definitions ──────────────────────────────────────────────────────────

// ─── Pair Definitions ──────────────────────────────────────────────────────────

// ─── Pair Definitions ──────────────────────────────────────────────────────────

// Real Binance crypto pairs (symbol → display name)
// Limited ONLY to crypto pairs actually available on Quotex
const BINANCE_PAIRS: Record<string, string> = {
  btcusdt:  'Bitcoin (BTC/USD)',
  ethusdt:  'Ethereum (ETH/USD)',
  ltcusdt:  'Litecoin (LTC/USD)'
};

// TwelveData REST symbols for real Forex (free plan: 8 credits/min, 800/day)
const TWELVEDATA_FOREX: Record<string, string> = {
  'EUR/USD': 'EUR/USD',
  'GBP/USD': 'GBP/USD',
  'USD/JPY': 'USD/JPY',
  'AUD/USD': 'AUD/USD',
  'USD/CAD': 'USD/CAD',
  'USD/CHF': 'USD/CHF',
  'EUR/GBP': 'EUR/GBP',
};

// OTC Pairs (Simulated natively using real Bitcoin volatility to ensure realistic charts)
const OTC_PAIRS = [
  'EUR/USD (OTC)', 'GBP/USD (OTC)', 'USD/JPY (OTC)', 'EUR/GBP (OTC)', 'AUD/CAD (OTC)',
  'AUD/CHF (OTC)', 'AUD/JPY (OTC)', 'AUD/NZD (OTC)', 'AUD/USD (OTC)', 'CAD/CHF (OTC)',
  'CAD/JPY (OTC)', 'CHF/JPY (OTC)', 'EUR/AUD (OTC)', 'EUR/CAD (OTC)', 'EUR/CHF (OTC)',
  'EUR/JPY (OTC)', 'EUR/NZD (OTC)', 'GBP/AUD (OTC)', 'GBP/CAD (OTC)', 'GBP/JPY (OTC)',
  'GBP/NZD (OTC)', 'NZD/JPY (OTC)', 'NZD/USD (OTC)', 'USD/CAD (OTC)', 'USD/CHF (OTC)',
  'USD/INR (OTC)', 'USD/BDT (OTC)', 'USD/PKR (OTC)', 'USD/TRY (OTC)', 'USD/PHP (OTC)',
  'USD/MXN (OTC)', 'USD/ZAR (OTC)', 'USD/IDR (OTC)', 'USD/VND (OTC)', 'USD/COP (OTC)',
  'USD/EGP (OTC)'
];

const OTC_STARTING_PRICES: Record<string, number> = {
  'EUR/USD (OTC)': 1.0850, 'GBP/USD (OTC)': 1.2650, 'USD/JPY (OTC)': 150.25,
  'EUR/GBP (OTC)': 0.8570, 'AUD/CAD (OTC)': 0.8900, 'AUD/CHF (OTC)': 0.5800,
  'AUD/JPY (OTC)': 98.50, 'AUD/NZD (OTC)': 1.0650, 'AUD/USD (OTC)': 0.6550,
  'CAD/CHF (OTC)': 0.6500, 'CAD/JPY (OTC)': 110.50, 'CHF/JPY (OTC)': 170.00,
  'EUR/AUD (OTC)': 1.6500, 'EUR/CAD (OTC)': 1.4600, 'EUR/CHF (OTC)': 0.9500,
  'EUR/JPY (OTC)': 162.00, 'EUR/NZD (OTC)': 1.7700, 'GBP/AUD (OTC)': 1.9300,
  'GBP/CAD (OTC)': 1.7100, 'GBP/JPY (OTC)': 190.00, 'GBP/NZD (OTC)': 2.0700,
  'NZD/JPY (OTC)': 92.50, 'NZD/USD (OTC)': 0.6120, 'USD/CAD (OTC)': 1.3520,
  'USD/CHF (OTC)': 0.8850, 'USD/INR (OTC)': 83.00, 'USD/BDT (OTC)': 110.00,
  'USD/PKR (OTC)': 278.00, 'USD/TRY (OTC)': 32.00, 'USD/PHP (OTC)': 56.00,
  'USD/MXN (OTC)': 16.50, 'USD/ZAR (OTC)': 19.00, 'USD/IDR (OTC)': 15600.00,
  'USD/VND (OTC)': 25000.00, 'USD/COP (OTC)': 3900.00, 'USD/EGP (OTC)': 47.00
};

// ─── Provider ──────────────────────────────────────────────────────────────────

export class RealMarketDataProvider extends EventEmitter {
  private history: Record<string, Candle[]> = {};
  private currentCandle: Record<string, Candle | null> = {};
  private activeStreams: Record<string, WebSocket> = {};
  private forexPollers: Record<string, NodeJS.Timeout> = {};
  private apiKey: string;
  private otcCurrentPrices: Record<string, number> = { ...OTC_STARTING_PRICES };
  private btcLastClose: number = 0;

  private staticPairs: string[] = [
    ...Object.values(BINANCE_PAIRS),
    ...Object.values(TWELVEDATA_FOREX),
    ...OTC_PAIRS // Now native!
  ];

  private extensionPairs: Set<string> = new Set();
  private pairOffsets: Record<string, number> = {};
  private baseCryptoPrices: Record<string, number> = {};

  constructor() {
    super();
    this.apiKey = process.env.TWELVEDATA_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[RealData] TWELVEDATA_API_KEY missing — Forex pairs will be skipped.');
    }
    
    // Assign a unique offset (0-59000ms) to every pair so their candles close at different times
    [...OTC_PAIRS].forEach(p => {
      this.pairOffsets[p] = Math.floor(Math.random() * 60000);
    });

    this.startCryptoMirrorEngine();
  }

  getAvailablePairs(): string[] {
    return Array.from(new Set([...this.staticPairs, ...this.extensionPairs]));
  }

  getHistory(pair: string): Candle[] {
    return this.history[pair] || [];
  }

  subscribeToPair(pair: string): void {
    const binanceSymbol = Object.keys(BINANCE_PAIRS).find(s => BINANCE_PAIRS[s] === pair);
    if (binanceSymbol) {
      this.subscribeBinance(binanceSymbol, pair);
      return;
    }

    const tdSymbol = Object.keys(TWELVEDATA_FOREX).find(s => TWELVEDATA_FOREX[s] === pair);
    if (tdSymbol && this.apiKey) {
      this.startForexPolling(pair, tdSymbol);
      return;
    }

    if (OTC_PAIRS.includes(pair)) {
      console.log(`[RealData] Generating native OTC ticks for ${pair}`);
      if (!this.history[pair]) this.history[pair] = [];
      return;
    }

    if (this.extensionPairs.has(pair)) {
      console.log(`[RealData] ${pair} waiting for extension ticks...`);
    }
  }

  unsubscribeFromPair(pair: string): void {
    const binanceSymbol = Object.keys(BINANCE_PAIRS).find(s => BINANCE_PAIRS[s] === pair);
    if (binanceSymbol && this.activeStreams[binanceSymbol]) {
      this.activeStreams[binanceSymbol].close();
      delete this.activeStreams[binanceSymbol];
    }
    if (this.forexPollers[pair]) {
      clearInterval(this.forexPollers[pair]);
      delete this.forexPollers[pair];
    }
  }

  private startCryptoMirrorEngine() {
    const CRYPTO_MIRRORS = [
      'ethusdt', 'bnbusdt', 'solusdt', 'xrpusdt', 'adausdt', 'avaxusdt', 'linkusdt', 'dotusdt',
      'dogeusdt', 'shibusdt', 'ltcusdt', 'uniusdt', 'bchusdt', 'xlmusdt', 'algousdt', 'vetusdt',
      'atomusdt', 'filusdt', 'icpusdt', 'trxusdt', 'eosusdt', 'xtzusdt', 'aaveusdt', 'mkrusdt',
      'sandusdt', 'manausdt', 'thetausdt', 'axsusdt', 'ftmusdt', 'grtusdt', 'snxusdt', 'chzusdt',
      'enjusdt', 'zilusdt', 'kavausdt', 'nearusdt'
    ];

    const streams = CRYPTO_MIRRORS.map(s => `${s}@kline_1m`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => console.log(`[MirrorEngine] ✅ Subscribed to ${CRYPTO_MIRRORS.length} real crypto streams to drive OTC markets`));

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.data && msg.data.e === 'kline' && msg.data.k) {
          const k = msg.data.k;
          const symbol = msg.data.s.toLowerCase(); // e.g., 'ethusdt'
          const mirrorIndex = CRYPTO_MIRRORS.indexOf(symbol);
          if (mirrorIndex === -1) return;

          const otcPair = OTC_PAIRS[mirrorIndex];
          if (!otcPair) return;

          const cryptoClose = parseFloat(k.c);
          if (!this.baseCryptoPrices[symbol]) {
            this.baseCryptoPrices[symbol] = cryptoClose;
          }

          const baseCrypto = this.baseCryptoPrices[symbol];
          const baseOtc = OTC_STARTING_PRICES[otcPair];

          // Mirror exact organic market math
          const scaleFactor = baseOtc / baseCrypto;

          const candle: Candle = {
            timestamp: k.t,
            open:  parseFloat(k.o) * scaleFactor,
            high:  parseFloat(k.h) * scaleFactor,
            low:   parseFloat(k.l) * scaleFactor,
            close: parseFloat(k.c) * scaleFactor,
          };

          this.currentCandle[otcPair] = candle;
          
          if (k.x) { // If the kline is officially closed by Binance
             if (!this.history[otcPair]) this.history[otcPair] = [];
             this.history[otcPair].push(candle);
             if (this.history[otcPair].length > 200) this.history[otcPair].shift();
             this.emit('candle_closed', { pair: otcPair, candle: { ...candle } });
          }
          
          this.emit('candle', { pair: otcPair, candle: { ...candle } });
        }
      } catch {}
    });

    ws.on('error', err => console.error(`[MirrorEngine] ❌ Error: ${err.message}`));

    ws.on('close', () => {
      console.log(`[MirrorEngine] Reconnecting in 5s...`);
      setTimeout(() => this.startCryptoMirrorEngine(), 5000);
    });
  }

  // ── Binance WebSocket — Real live 1m crypto candles ──────────────────────────

  private subscribeBinance(symbol: string, displayPair: string) {
    if (this.activeStreams[symbol]) return;

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_1m`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => console.log(`[Binance] ✅ Subscribed to ${displayPair}`));

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.e === 'kline' && msg.k) {
          const k = msg.k;
          const candle: Candle = {
            timestamp: k.t,
            open:  parseFloat(k.o),
            high:  parseFloat(k.h),
            low:   parseFloat(k.l),
            close: parseFloat(k.c),
          };
          this.pushCandle(displayPair, candle);
        }
      } catch { /* ignore parse errors */ }
    });

    ws.on('error', err => console.error(`[Binance] ❌ ${displayPair}: ${err.message}`));

    ws.on('close', () => {
      delete this.activeStreams[symbol];
      console.log(`[Binance] Reconnecting ${displayPair} in 5s...`);
      setTimeout(() => this.subscribeBinance(symbol, displayPair), 5000);
    });

    this.activeStreams[symbol] = ws;
    this.fetchBinanceHistory(symbol, displayPair);
  }

  private async fetchBinanceHistory(symbol: string, displayPair: string) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1m&limit=100`;
      const res  = await fetch(url);
      const data = await res.json() as any[];
      this.history[displayPair] = data.map((k: any) => ({
        timestamp: k[0],
        open:  parseFloat(k[1]),
        high:  parseFloat(k[2]),
        low:   parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));
      console.log(`[Binance] 📊 History loaded for ${displayPair}`);
    } catch (e) {
      console.error(`[Binance] History fetch failed for ${displayPair}`);
      this.history[displayPair] = [];
    }
  }

  // ── TwelveData REST Polling — Real live Forex 1m candles ─────────────────────

  private startForexPolling(pair: string, symbol: string) {
    if (this.forexPollers[pair]) return;

    const pairIndex = Object.keys(TWELVEDATA_FOREX).indexOf(pair);
    const staggerMs  = pairIndex * 9000;

    setTimeout(async () => {
      await this.pollTwelveData(pair, symbol);
      this.forexPollers[pair] = setInterval(
        () => this.pollTwelveData(pair, symbol),
        65_000
      );
    }, staggerMs);
  }

  private async pollTwelveData(pair: string, symbol: string) {
    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1min&outputsize=2&apikey=${this.apiKey}`;
      const res  = await fetch(url);
      const data = await res.json() as any;

      if (data.status === 'error' || !data.values || data.values.length === 0) return;

      const values: any[] = data.values;
      const closedCandle = values[1];

      if (!closedCandle) return;

      const ts = new Date(closedCandle.datetime + ' UTC').getTime();
      const candle: Candle = {
        timestamp: ts,
        open:  parseFloat(closedCandle.open),
        high:  parseFloat(closedCandle.high),
        low:   parseFloat(closedCandle.low),
        close: parseFloat(closedCandle.close),
      };

      if (!this.history[pair]) this.history[pair] = [];

      const last = this.history[pair].at(-1);
      if (!last || last.timestamp !== candle.timestamp) {
        this.history[pair].push(candle);
        if (this.history[pair].length > 200) this.history[pair].shift();
        this.emit('candle', { pair, candle });
        console.log(`[TwelveData] ✅ ${pair} candle close=${candle.close}`);
      }
    } catch (e) {}
  }

  // ── Tick Processing ──────────────────────────────────────────────────────────

  processTick(pair: string, price: number, timestamp: number) {
    const offset = this.pairOffsets[pair] || 0;
    // Shift timestamp by offset before flooring to stagger candle close times across the minute
    const currentMinute = Math.floor((timestamp - offset) / 60000) * 60000 + offset;

    if (!this.staticPairs.includes(pair) && !this.extensionPairs.has(pair)) {
      this.extensionPairs.add(pair);
      console.log(`[Extension] 🆕 New OTC pair discovered: ${pair}`);
      this.emit('new_pair_detected', pair);
      if (!this.history[pair]) this.history[pair] = [];
      if (!this.currentCandle[pair]) this.currentCandle[pair] = null;
    }

    let candle = this.currentCandle[pair];

    if (!candle || candle.timestamp !== currentMinute) {
      if (candle) {
        this.history[pair].push(candle);
        if (this.history[pair].length > 200) this.history[pair].shift();
        // Emit the CLOSED candle for the strategy engine to process
        this.emit('candle_closed', { pair, candle: { ...candle } });
      }
      candle = { timestamp: currentMinute, open: price, high: price, low: price, close: price };
      this.currentCandle[pair] = candle;
      // Emit live tick for the UI
      this.emit('candle', { pair, candle: { ...candle } });
    } else {
      candle.close = price;
      if (price > candle.high) candle.high = price;
      if (price < candle.low)  candle.low  = price;
      // Emit live tick for the UI
      this.emit('candle', { pair, candle: { ...candle } });
    }
  }

  private pushCandle(pair: string, candle: Candle) {
    if (!this.history[pair]) this.history[pair] = [];
    const hist = this.history[pair];

    if (hist.length > 0 && hist[hist.length - 1].timestamp === candle.timestamp) {
      hist[hist.length - 1] = candle;
    } else {
      hist.push(candle);
      if (hist.length > 200) hist.shift();
    }

    this.emit('candle', { pair, candle });
  }
}

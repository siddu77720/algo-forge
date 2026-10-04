import { EventEmitter } from 'events';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Candle } from '../types';

puppeteer.use(StealthPlugin());

export class PuppeteerMarketDataProvider extends EventEmitter {
  private history: Record<string, Candle[]> = {};
  private currentCandle: Record<string, Candle | null> = {};
  private browser: any;
  private page: any;

  private predefinedPairs = [
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
    'NZD/CAD (OTC)', 'NZD/CHF (OTC)', 'NZD/JPY (OTC)',

    // Crypto
    'Bitcoin (BTC/USD)', 'Ethereum (ETH/USD)', 'Litecoin (LTC/USD)', 'Ripple (XRP/USD)', 'Solana (SOL/USD)',
    'Cardano (ADA/USD)', 'Binance Coin (BNB/USD)', 'Dogecoin (DOGE/USD)', 'Polkadot (DOT/USD)', 'Chainlink (LINK/USD)',
    'Bitcoin Cash (BCH/USD)', 'TRON (TRX/USD)', 'Stellar (XLM/USD)', 'EOS (EOS/USD)', 'Dash (DASH/USD)', 'Zcash (ZEC/USD)'
  ];

  constructor() {
    super();
    this.initBrowser();
  }

  getAvailablePairs(): string[] {
    const dynamicPairs = Object.keys(this.history);
    return Array.from(new Set([...this.predefinedPairs, ...dynamicPairs]));
  }

  getHistory(pair: string): Candle[] {
    return this.history[pair] || [];
  }

  subscribeToPair(pair: string): void {
    console.log(`[Puppeteer] Strategy subscribed to ${pair}. Real data will flow when Quotex broadcasts it.`);
  }

  unsubscribeFromPair(pair: string): void {}

  private async initBrowser() {
    try {
      console.log('[Puppeteer] Launching headless Chrome to intercept Quotex OTC data...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
      });
      
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 720 });

      // Expose a Node.js function to the browser context
      await this.page.exposeFunction('onQuotexTick', (pair: string, price: number) => {
        this.processTick(pair, price, Date.now());
      });

      // Inject WebSocket interceptor before page loads
      await this.page.evaluateOnNewDocument(() => {
        const OrigWebSocket = window.WebSocket;
        (window as any).WebSocket = function(url: string, protocols: any) {
          const ws = new OrigWebSocket(url, protocols);
          ws.addEventListener('message', (event) => {
            if (typeof event.data === 'string') {
              try {
                // Fuzzy search to find asset and price in the raw Quotex WebSocket string
                const assetMatch = event.data.match(/"asset":\s*"([^"]+)"/);
                const priceMatch = event.data.match(/"price":\s*([\d\.]+)/) || event.data.match(/"close":\s*([\d\.]+)/);
                
                if (assetMatch && priceMatch) {
                  let rawAsset = assetMatch[1]; // e.g. "EURUSD_otc"
                  let price = parseFloat(priceMatch[1]);
                  
                  // Format "EURUSD_otc" -> "EUR/USD (OTC)"
                  if (rawAsset.includes('_otc')) {
                    const cleanAsset = rawAsset.replace('_otc', '').toUpperCase();
                    if (cleanAsset.length === 6) {
                      const formattedPair = `${cleanAsset.substring(0, 3)}/${cleanAsset.substring(3, 6)} (OTC)`;
                      (window as any).onQuotexTick(formattedPair, price);
                    }
                  } else {
                     // Standard non-OTC pairs
                     const cleanAsset = rawAsset.toUpperCase();
                     if (cleanAsset.length === 6) {
                        const formattedPair = `${cleanAsset.substring(0, 3)}/${cleanAsset.substring(3, 6)}`;
                        (window as any).onQuotexTick(formattedPair, price);
                     }
                  }
                }
              } catch(e) {}
            }
          });
          return ws;
        };
      });

      console.log('[Puppeteer] Navigating to Quotex...');
      // By going to the demo page, the websocket automatically connects
      await this.page.goto('https://quotex.com/en/demo', { waitUntil: 'networkidle2' });
      
      console.log('[Puppeteer] Quotex loaded! Listening for real OTC WebSocket ticks in the background...');

    } catch (error) {
      console.error('[Puppeteer] Error launching browser:', error);
    }
  }

  processTick(pair: string, price: number, timestamp: number) {
    const currentMinute = Math.floor(timestamp / 60000) * 60000;

    if (!this.history[pair]) {
      this.history[pair] = [];
      this.history[pair] = this.generateHistoricalCandles(price, 100);
      this.emit('new_pair_detected', pair);
    }
    
    let candle = this.currentCandle[pair];

    if (!candle || candle.timestamp !== currentMinute) {
      if (candle) {
        this.history[pair].push(candle);
        if (this.history[pair].length > 100) this.history[pair].shift();
      }
      
      candle = { timestamp: currentMinute, open: price, high: price, low: price, close: price };
      this.currentCandle[pair] = candle;
    } else {
      candle.close = price;
      if (price > candle.high) candle.high = price;
      if (price < candle.low) candle.low = price;
    }

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

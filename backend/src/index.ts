import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RealMarketDataProvider } from './market-data/RealMarketDataProvider';
import { OTCStrategyEngine } from './strategy/OTCStrategyEngine';
import { signalHistory } from './SignalHistory';

dotenv.config();

import authRouter from './routes/auth';
import adminRouter from './routes/admin';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const provider = new RealMarketDataProvider();
const engines: Record<string, OTCStrategyEngine> = {};

// ── Debug/status endpoint — use to verify data is flowing ────────────────────
const tickCounts: Record<string, number> = {};
const lastTick: Record<string, number> = {};

app.get('/api/debug/status', (_req, res) => {
  const now = Date.now();
  const pairs = provider.getAvailablePairs();
  const pairStatus = pairs.map(p => ({
    pair: p,
    ticks: tickCounts[p] || 0,
    lastTickMs: lastTick[p] ? now - lastTick[p] : null,
    engineStatus: engines[p]?.getState().status || 'NO_ENGINE',
    baseConfirmations: engines[p]?.getState().baseConfirmations || 0,
    signal: engines[p]?.getState().signal || null,
  }));
  const activePairs = pairStatus.filter(p => p.ticks > 0);
  res.json({
    time: new Date().toISOString(),
    totalPairs: pairs.length,
    activePairs: activePairs.length,
    signalsRecorded: signalHistory.getAll().length,
    pairs: pairStatus,
  });
});

app.get('/api/pairs', (req, res) => {
  res.json({ pairs: provider.getAvailablePairs() });
});

import fs from 'fs';

app.get('/api/pairs/:pair/history', (req, res) => {
  const pair = req.params.pair;
  res.json({ history: provider.getHistory(pair) });
});

// Signal history endpoint — returns all completed setups with optional date range
app.get('/api/history', (req, res) => {
  const fromMs = req.query.from ? Number(req.query.from) : undefined;
  const toMs   = req.query.to   ? Number(req.query.to)   : undefined;
  const pair   = req.query.pair  ? String(req.query.pair)  : undefined;
  res.json({ signals: signalHistory.query(fromMs, toMs, pair) });
});

// Extension webhook — raw WebSocket intercept
app.post('/api/webhook/raw', (req, res) => {
  const { rawData } = req.body;
  if (typeof rawData === 'string') {
    try {
      const assetMatch = rawData.match(/"asset":\s*"([^"]+)"/);
      const priceMatch = rawData.match(/"price":\s*([\d\.]+)/) || rawData.match(/"close":\s*([\d\.]+)/);
      
      if (assetMatch && priceMatch) {
        let rawAsset = assetMatch[1]; // e.g. "EURUSD_otc"
        let price = parseFloat(priceMatch[1]);
        let formattedPair = '';
        
        if (rawAsset.includes('_otc')) {
          const cleanAsset = rawAsset.replace('_otc', '').toUpperCase();
          if (cleanAsset.length === 6) formattedPair = `${cleanAsset.substring(0, 3)}/${cleanAsset.substring(3, 6)} (OTC)`;
        } else {
          const cleanAsset = rawAsset.toUpperCase();
          if (cleanAsset.length === 6) formattedPair = `${cleanAsset.substring(0, 3)}/${cleanAsset.substring(3, 6)}`;
        }

        if (formattedPair) {
          provider.processTick(formattedPair, price, Date.now());
          if (!engines[formattedPair]) {
            engines[formattedPair] = new OTCStrategyEngine(formattedPair);
            io.emit('pairs_updated', provider.getAvailablePairs());
            console.log(`[Extension] New engine created for ${formattedPair} via WS`);
          }
        }
      }
    } catch(e) {}
  }
  res.sendStatus(200);
});

// Extension webhook — DOM fallback scraper
app.post('/api/webhook/tick', (req, res) => {
  const { pair, price, timestamp } = req.body;
  if (pair && price) {
    provider.processTick(pair, parseFloat(price), timestamp || Date.now());
    if (!engines[pair]) {
      engines[pair] = new OTCStrategyEngine(pair);
      io.emit('pairs_updated', provider.getAvailablePairs());
      console.log(`[Extension] New engine created for ${pair} via DOM`);
    }
  }
  res.sendStatus(200);
});

// Debug endpoint for outgoing WS messages
app.post('/api/webhook/debug_send', (req, res) => {
  console.log('[Quotex WS OUTGOING]:', req.body.payload);
  fs.appendFileSync('../quotex_ws_outgoing.log', req.body.payload + '\n');
  res.sendStatus(200);
});

// Endpoint to receive DOM dump for debugging
app.post('/api/webhook/dump', (req, res) => {
  const { dom } = req.body;
  if (dom) {
    fs.writeFileSync('../quotex_dom_dump.html', dom);
    console.log('[Backend] Received DOM dump from extension and saved to quotex_dom_dump.html');
  }
  res.sendStatus(200);
});

provider.getAvailablePairs().forEach(pair => {
  engines[pair] = new OTCStrategyEngine(pair);
  provider.subscribeToPair(pair);
});

provider.on('candle', ({ pair, candle }) => {
  // Track tick counts for debug
  tickCounts[pair] = (tickCounts[pair] || 0) + 1;
  lastTick[pair] = Date.now();

  const engine = engines[pair];
  if (engine) {
    // Only emit to UI, do NOT process candle in strategy
    io.emit('strategy_update', { pair, state: engine.getState(), candle });
  }
});

// For Strategy Engine ONLY:
provider.on('candle_closed', ({ pair, candle }) => {
  const engine = engines[pair];
  if (engine) {
    const prevStatus = engine.getState().status;
    
    // Process the completed candle
    const state = engine.processCandle(candle);
    
    // UI is already updated via the live tick, but we also emit state changes
    io.emit('strategy_update', { pair, state, candle });

    // Record signal when it first becomes SIGNAL_READY
    if (state.status === 'SIGNAL_READY' && prevStatus !== 'SIGNAL_READY') {
      if (state.signal && state.breakoutDirection) {
        const record = signalHistory.addSignal({
          pair,
          signal: state.signal as 'CALL' | 'PUT',
          timestamp: candle.timestamp || Date.now(),
          baseHigh: state.baseHigh!,
          baseLow: state.baseLow!,
          baseConfirmations: state.baseConfirmations,
          breakoutDirection: state.breakoutDirection as 'UP' | 'DOWN',
          breakoutHigh: state.breakoutHigh!,
          breakoutLow: state.breakoutLow!,
          breakoutConfirmations: state.breakoutConfirmations,
        });
        // Broadcast the new signal to all clients
        io.emit('new_signal', record);
        console.log(`[Signal] ${pair} → ${state.signal} at ${new Date(candle.timestamp).toISOString()}`);
      }
    }
  }
});

// trigger restart

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  // Send initial states
  Object.keys(engines).forEach(pair => {
    socket.emit('strategy_update', { 
      pair, 
      state: engines[pair].getState(),
      candle: null 
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
// Trigger restart for puppeteer
// Restart triggered for stagger update
// Restart for volatility spikes
// Restart for crypto mirror engine

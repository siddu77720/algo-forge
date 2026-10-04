import { describe, it, expect, beforeEach } from 'vitest';
import { OTCStrategyEngine } from './OTCStrategyEngine';
import { Candle } from '../types';

describe('OTCStrategyEngine', () => {
  let engine: OTCStrategyEngine;

  beforeEach(() => {
    engine = new OTCStrategyEngine('TEST/PAIR');
  });

  const makeCandle = (open: number, high: number, low: number, close: number): Candle => ({
    timestamp: Date.now(),
    open, high, low, close
  });

  it('detects a base candle and waits for confirmation', () => {
    engine.processCandle(makeCandle(10, 20, 5, 15));
    expect(engine.getState().status).toBe('WAITING_FOR_BASE_CONFIRMATION');
    expect(engine.getState().baseHigh).toBe(20);
    expect(engine.getState().baseLow).toBe(5);
  });

  it('confirms the base after 2 valid closes inside wick range', () => {
    engine.processCandle(makeCandle(10, 20, 5, 15)); // Base
    
    // Conf 1
    engine.processCandle(makeCandle(15, 18, 12, 16));
    expect(engine.getState().status).toBe('WAITING_FOR_BASE_CONFIRMATION');
    expect(engine.getState().baseConfirmations).toBe(1);

    // Conf 2
    engine.processCandle(makeCandle(16, 17, 10, 12));
    expect(engine.getState().status).toBe('BASE_CONFIRMED');
    expect(engine.getState().baseConfirmations).toBe(2);
  });

  it('detects upper breakout and confirms it', () => {
    engine.processCandle(makeCandle(10, 20, 5, 15)); // Base
    engine.processCandle(makeCandle(15, 18, 12, 16)); // Conf 1
    engine.processCandle(makeCandle(16, 17, 10, 12)); // Conf 2
    
    // Breakout UP (close > 20)
    engine.processCandle(makeCandle(12, 25, 10, 22)); 
    expect(engine.getState().status).toBe('WAITING_FOR_BREAKOUT_CONFIRMATION');
    expect(engine.getState().breakoutDirection).toBe('UP');
    expect(engine.getState().breakoutHigh).toBe(25);
    expect(engine.getState().breakoutLow).toBe(10);

    // Breakout Conf 1 (close between 10 and 25)
    engine.processCandle(makeCandle(22, 24, 15, 20));
    expect(engine.getState().breakoutConfirmations).toBe(1);

    // Breakout Conf 2
    engine.processCandle(makeCandle(20, 21, 11, 15));
    expect(engine.getState().status).toBe('BREAKOUT_CONFIRMED');
    expect(engine.getState().breakoutConfirmations).toBe(2);
  });

  it('generates a PUT signal for an upper breakout if no gap', () => {
    engine.processCandle(makeCandle(10, 20, 5, 15)); // Base
    engine.processCandle(makeCandle(15, 18, 12, 16)); // Conf 1
    engine.processCandle(makeCandle(16, 17, 10, 12)); // Conf 2
    
    // Breakout UP (close > 20)
    engine.processCandle(makeCandle(12, 25, 10, 22)); 
    engine.processCandle(makeCandle(22, 24, 15, 20)); // Conf 1
    engine.processCandle(makeCandle(20, 21, 11, 15)); // Conf 2 (closes at 15)
    
    // Entry candle opens at 15 (no gap)
    engine.processCandle(makeCandle(15, 16, 10, 12));
    expect(engine.getState().status).toBe('SIGNAL_READY');
    expect(engine.getState().signal).toBe('PUT');
  });

  it('invalidates signal if there is a gap up', () => {
    engine.processCandle(makeCandle(10, 20, 5, 15)); // Base
    engine.processCandle(makeCandle(15, 18, 12, 16)); // Conf 1
    engine.processCandle(makeCandle(16, 17, 10, 12)); // Conf 2
    
    // Breakout UP (close > 20)
    engine.processCandle(makeCandle(12, 25, 10, 22)); 
    engine.processCandle(makeCandle(22, 24, 15, 20)); // Conf 1
    engine.processCandle(makeCandle(20, 21, 11, 15)); // Conf 2 (closes at 15)
    
    // Entry candle opens at 16 (gap up)
    engine.processCandle(makeCandle(16, 17, 10, 12));
    expect(engine.getState().status).toBe('GAP_INVALIDATED');
    expect(engine.getState().signal).toBeNull();
  });
});

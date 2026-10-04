export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type BreakoutDirection = 'UP' | 'DOWN' | null;

export type Signal = 'CALL' | 'PUT' | null;

export type StrategyStatus = 
  | 'WAITING_FOR_BASE'
  | 'BASE_FOUND'
  | 'WAITING_FOR_BASE_CONFIRMATION'
  | 'BASE_CONFIRMED'
  | 'WAITING_FOR_BREAKOUT'
  | 'BREAKOUT_FOUND'
  | 'WAITING_FOR_BREAKOUT_CONFIRMATION'
  | 'BREAKOUT_CONFIRMED'
  | 'CHECKING_ENTRY'
  | 'SIGNAL_READY'
  | 'GAP_INVALIDATED'
  | 'COMPLETED';

export interface StrategyState {
  status: StrategyStatus;
  baseCandle: Candle | null;
  baseHigh: number | null;
  baseLow: number | null;
  baseConfirmations: number;
  
  breakoutDirection: BreakoutDirection;
  breakoutCandle: Candle | null;
  breakoutHigh: number | null;
  breakoutLow: number | null;
  breakoutConfirmations: number;
  
  signal: Signal;
}

export interface SetupInfo {
  pair: string;
  state: StrategyState;
}

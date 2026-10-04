import { Candle, StrategyState, Signal } from '../types';

export class OTCStrategyEngine {
  private pair: string;
  private state: StrategyState;

  constructor(pair: string) {
    this.pair = pair;
    this.state = this.getInitialState();
  }

  private getInitialState(): StrategyState {
    return {
      status: 'WAITING_FOR_BASE',
      baseCandle: null,
      baseHigh: null,
      baseLow: null,
      baseConfirmations: 0,
      breakoutDirection: null,
      breakoutCandle: null,
      breakoutHigh: null,
      breakoutLow: null,
      breakoutConfirmations: 0,
      signal: null,
    };
  }

  public getState(): StrategyState {
    return this.state;
  }

  public getPair(): string {
    return this.pair;
  }

  public forceReset() {
    this.state = this.getInitialState();
  }

  public processCandle(candle: Candle): StrategyState {
    // After signal emitted or invalidated, reset and try this candle as base
    if (['SIGNAL_READY', 'COMPLETED'].includes(this.state.status)) {
      this.state = this.getInitialState();
    }

    switch (this.state.status) {
      case 'WAITING_FOR_BASE':
        // First candle sets the base range
        this.state.baseCandle = candle;
        this.state.baseHigh = candle.high;
        this.state.baseLow = candle.low;
        this.state.status = 'WAITING_FOR_BASE_CONFIRMATION';
        break;

      case 'WAITING_FOR_BASE_CONFIRMATION':
      case 'BASE_CONFIRMED': {
        const bHigh = this.state.baseHigh!;
        const bLow = this.state.baseLow!;

        // Check: candle must form INSIDE the base candle (high <= baseHigh AND low >= baseLow)
        const isInsideBase =
          candle.high <= bHigh &&
          candle.low >= bLow;

        if (isInsideBase) {
          // This confirmation candle forms inside the base — valid
          this.state.baseConfirmations++;
          if (this.state.baseConfirmations >= 2) {
            this.state.status = 'BASE_CONFIRMED';
          } else {
            this.state.status = 'WAITING_FOR_BASE_CONFIRMATION';
          }
        } else {
          // Candle broke out of the base range
          if (this.state.baseConfirmations >= 2) {
            // Enough confirmations — valid breakout
            this.state.breakoutCandle = candle;
            this.state.breakoutHigh = candle.high;
            this.state.breakoutLow = candle.low;
            this.state.breakoutDirection = candle.close > bHigh ? 'UP' : 'DOWN';
            this.state.status = 'WAITING_FOR_BREAKOUT_CONFIRMATION';
          } else {
            // Not enough base confirmations — reset, treat this candle as new base
            this.state = this.getInitialState();
            this.state.baseCandle = candle;
            this.state.baseHigh = candle.high;
            this.state.baseLow = candle.low;
            this.state.status = 'WAITING_FOR_BASE_CONFIRMATION';
          }
        }
        break;
      }

      case 'WAITING_FOR_BREAKOUT_CONFIRMATION': {
        const brHigh = this.state.breakoutHigh!;
        const brLow = this.state.breakoutLow!;

        if (candle.close >= brLow && candle.close <= brHigh) {
          // Candle closes inside breakout range — confirmation
          this.state.breakoutConfirmations++;
          if (this.state.breakoutConfirmations >= 1) {
            // Breakout confirmed — fire signal immediately (no gap check)
            this.state.status = 'SIGNAL_READY';
            this.state.signal = this.state.breakoutDirection === 'UP' ? 'PUT' : 'CALL';
          }
        } else {
          // Failed breakout confirmation — reset, use this candle as new base
          this.state = this.getInitialState();
          this.state.baseCandle = candle;
          this.state.baseHigh = candle.high;
          this.state.baseLow = candle.low;
          this.state.status = 'WAITING_FOR_BASE_CONFIRMATION';
        }
        break;
      }
    }

    return this.state;
  }
}


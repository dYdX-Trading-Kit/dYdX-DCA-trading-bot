import { describe, it, expect } from 'vitest';
import {
  calculateMovingAverage,
  calculatePercentChange,
  formatCurrency,
  parseMarketTicker,
  roundToStepSize,
  usdcToBaseSize,
} from '../src/utils/helpers.js';

describe('Helpers', () => {
  it('calculates moving average', () => {
    const prices = [100, 110, 120, 130, 140];
    expect(calculateMovingAverage(prices, 5)).toBe(120);
    expect(calculateMovingAverage(prices, 3)).toBe(130);
  });

  it('calculates percent change', () => {
    expect(calculatePercentChange(110, 100)).toBe(10);
    expect(calculatePercentChange(90, 100)).toBe(-10);
    expect(calculatePercentChange(100, 0)).toBe(0);
  });

  it('formats currency with correct decimals', () => {
    expect(formatCurrency(1.23456789, 'BTC')).toBe('1.23456789 BTC');
    expect(formatCurrency(50.5, 'USDC')).toBe('50.50 USDC');
  });

  it('parses market ticker', () => {
    expect(parseMarketTicker('BTC-USD')).toEqual({ base: 'BTC', quote: 'USD' });
    expect(parseMarketTicker('ETHUSD')).toEqual({ base: 'ETH', quote: 'USD' });
  });

  it('converts USDC to base size', () => {
    expect(usdcToBaseSize(100, 50_000)).toBeCloseTo(0.002, 6);
  });

  it('rounds to step size', () => {
    expect(roundToStepSize(0.00123, 0.0001)).toBe(0.0012);
  });

  it('throws on invalid price for size calculation', () => {
    expect(() => usdcToBaseSize(100, 0)).toThrow('Invalid price');
  });
});

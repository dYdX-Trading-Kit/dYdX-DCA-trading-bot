import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DcaStrategy } from '../../src/core/dca-strategy.js';
import { loadConfig } from '../../src/config/index.js';
import { createLogger } from '../../src/utils/logger.js';
import type { DcaState, IExchangeClient, TickerData } from '../../src/types/index.js';

const logger = createLogger('error', 'logs/test.log');

function createMockExchange(overrides: Partial<IExchangeClient> = {}): IExchangeClient {
  const ticker: TickerData = {
    pair: 'BTC-USD',
    ask: 95_100,
    bid: 94_900,
    last: 95_000,
    volume24h: 1000,
    vwap24h: 94_800,
    high24h: 96_000,
    low24h: 93_000,
    open24h: 94_500,
    timestamp: Date.now(),
  };

  return {
    getTicker: vi.fn().mockResolvedValue(ticker),
    getBalance: vi.fn().mockResolvedValue({ currency: 'USDC', available: 5000, total: 5000 }),
    placeMarketBuy: vi.fn(),
    validateOrder: vi.fn().mockResolvedValue(true),
    getCandles: vi.fn().mockResolvedValue(Array.from({ length: 30 }, (_, i) => 95_000 - i * 100)),
    ...overrides,
  };
}

function createInitialState(): DcaState {
  return {
    totalInvested: 0,
    totalVolumeAcquired: 0,
    averagePrice: 0,
    executionCount: 0,
    dailySpent: 0,
    dailySpentDate: new Date().toISOString().slice(0, 10),
    lastExecutionAt: null,
    priceHistory: [],
  };
}

describe('DcaStrategy', () => {
  let config: ReturnType<typeof loadConfig>;

  beforeEach(() => {
    config = loadConfig({
      BOT_MODE: 'paper',
      TRADING_PAIR: 'BTC-USD',
      DCA_AMOUNT: '50',
      MAX_DAILY_SPEND: '200',
      MIN_BALANCE_RESERVE: '100',
      MIN_ORDER_VALUE: '10',
      SMART_DCA_ENABLED: 'false',
    });
  });

  it('approves execution when balance is sufficient', async () => {
    const exchange = createMockExchange();
    const strategy = new DcaStrategy({ config, exchange, logger });
    const state = createInitialState();

    const result = await strategy.evaluate(state);

    expect(result.shouldExecute).toBe(true);
    expect(result.effectiveAmount).toBe(50);
  });

  it('rejects when daily spend limit is reached', async () => {
    const exchange = createMockExchange();
    const strategy = new DcaStrategy({ config, exchange, logger });
    const state = createInitialState();
    state.dailySpent = 200;

    const result = await strategy.evaluate(state);

    expect(result.shouldExecute).toBe(false);
    expect(result.reason).toContain('Daily spend limit');
  });

  it('rejects when balance is below reserve', async () => {
    const exchange = createMockExchange({
      getBalance: vi.fn().mockResolvedValue({ currency: 'USDC', available: 50, total: 50 }),
    });
    const strategy = new DcaStrategy({ config, exchange, logger });
    const state = createInitialState();

    const result = await strategy.evaluate(state);

    expect(result.shouldExecute).toBe(false);
    expect(result.reason).toContain('Insufficient balance');
  });

  it('boosts amount when smart DCA detects price drop', async () => {
    const smartConfig = loadConfig({
      BOT_MODE: 'paper',
      DCA_AMOUNT: '50',
      SMART_DCA_ENABLED: 'true',
      SMART_DCA_DROP_THRESHOLD: '5',
      SMART_DCA_BOOST_MULTIPLIER: '1.5',
      MAX_DAILY_SPEND: '200',
    });

    const exchange = createMockExchange({
      getTicker: vi.fn().mockResolvedValue({
        pair: 'BTC-USD',
        ask: 80_000,
        bid: 79_900,
        last: 80_000,
        volume24h: 1000,
        vwap24h: 94_000,
        high24h: 96_000,
        low24h: 79_000,
        open24h: 94_500,
        timestamp: Date.now(),
      }),
      getCandles: vi.fn().mockResolvedValue(Array.from({ length: 30 }, () => 95_000)),
    });

    const strategy = new DcaStrategy({ config: smartConfig, exchange, logger });
    const state = createInitialState();

    const result = await strategy.evaluate(state);

    expect(result.shouldExecute).toBe(true);
    expect(result.effectiveAmount).toBe(75);
    expect(result.reason).toContain('Smart DCA boost');
  });

  it('boosts shipped clip when price is below the 20-day MA', async () => {
    const shipped = loadConfig({
      BOT_MODE: 'paper',
      SMART_DCA_ENABLED: 'true',
      MAX_DAILY_SPEND: '200',
    });

    const exchange = createMockExchange({
      getTicker: vi.fn().mockResolvedValue({
        pair: 'BTC-USD',
        ask: 80_000,
        bid: 79_900,
        last: 80_000,
        volume24h: 1000,
        vwap24h: 94_000,
        high24h: 96_000,
        low24h: 79_000,
        open24h: 94_500,
        timestamp: Date.now(),
      }),
      getCandles: vi.fn().mockResolvedValue(Array.from({ length: 20 }, () => 95_000)),
    });

    const strategy = new DcaStrategy({ config: shipped, exchange, logger });
    const state = createInitialState();

    const result = await strategy.evaluate(state);

    expect(shipped.dca.amount).toBe(75);
    expect(shipped.smartDca.boostMultiplier).toBe(2);
    expect(result.shouldExecute).toBe(true);
    expect(result.effectiveAmount).toBe(150);
    expect(result.reason).toContain('Smart DCA boost');
  });

  it('updates state after execution', () => {
    const exchange = createMockExchange();
    const strategy = new DcaStrategy({ config, exchange, logger });
    const state = createInitialState();

    strategy.updateStateAfterExecution(state, 50, 0.0005, 95_000);

    expect(state.executionCount).toBe(1);
    expect(state.totalInvested).toBe(50);
    expect(state.totalVolumeAcquired).toBe(0.0005);
    expect(state.averagePrice).toBe(100_000);
  });
});

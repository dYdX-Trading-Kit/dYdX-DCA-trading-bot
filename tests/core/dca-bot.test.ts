import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DcaBot } from '../../src/core/dca-bot.js';
import { loadConfig } from '../../src/config/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { PaperTradingClient } from '../../src/api/dydx/paper-trading.js';

const TEST_STATE_DIR = 'data/test-dca-bot';
const logger = createLogger('error', 'logs/test.log');

describe('DcaBot', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true });
    }
  });

  function createBot(dryRun = false): DcaBot {
    const config = loadConfig({
      BOT_MODE: 'paper',
      TRADING_PAIR: 'BTC-USD',
      DCA_AMOUNT: '50',
      MAX_DAILY_SPEND: '200',
      MIN_BALANCE_RESERVE: '100',
      MIN_ORDER_VALUE: '10',
      SMART_DCA_ENABLED: 'false',
      DRY_RUN: dryRun ? 'true' : 'false',
    });

    const exchange = new PaperTradingClient({
      initialBalance: 10_000,
      baseCurrency: 'USDC',
      quoteCurrency: 'BTC',
      minOrderValue: 10,
      logger,
    });

    return new DcaBot({
      config,
      exchange,
      logger,
      stateDir: TEST_STATE_DIR,
    });
  }

  it('executes a DCA cycle successfully', async () => {
    const bot = createBot();
    const result = await bot.executeOnce();

    expect(result.success).toBe(true);
    expect(result.amountSpent).toBeGreaterThan(0);
    expect(result.order).toBeDefined();
    expect(bot.getState().executionCount).toBe(1);
  });

  it('dry run does not update state', async () => {
    const bot = createBot(true);
    const result = await bot.executeOnce();

    expect(result.success).toBe(true);
    expect(result.amountSpent).toBe(0);
    expect(bot.getState().executionCount).toBe(0);
  });

  it('persists state across instances', async () => {
    const bot1 = createBot();
    await bot1.executeOnce();

    const bot2 = createBot();
    expect(bot2.getState().executionCount).toBe(1);
  });

  it('resets state', async () => {
    const bot = createBot();
    await bot.executeOnce();
    bot.resetState();

    expect(bot.getState().executionCount).toBe(0);
    expect(fs.existsSync(path.join(TEST_STATE_DIR, 'dca-state.json'))).toBe(false);
  });

  it('returns bot stats', async () => {
    const bot = createBot();
    const stats = bot.getStats();

    expect(stats.mode).toBe('paper');
    expect(stats.pair).toBe('BTC-USD');
    expect(stats.network).toBe('testnet');
    expect(stats.isRunning).toBe(false);
  });
});

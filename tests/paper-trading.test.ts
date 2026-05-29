import { describe, it, expect } from 'vitest';
import { createLogger } from '../src/utils/logger.js';
import { PaperTradingClient } from '../src/api/dydx/paper-trading.js';

const logger = createLogger('error', 'logs/test.log');

describe('PaperTradingClient', () => {
  function createClient(initialBalance = 10_000, simulatedPrice = 95_000) {
    return new PaperTradingClient({
      initialBalance,
      baseCurrency: 'USDC',
      quoteCurrency: 'BTC',
      simulatedPrice,
      minOrderValue: 10,
      logger,
    });
  }

  it('returns ticker data', async () => {
    const client = createClient();
    const ticker = await client.getTicker('BTC-USD');

    expect(ticker.pair).toBe('BTC-USD');
    expect(ticker.last).toBeGreaterThan(0);
    expect(ticker.ask).toBeGreaterThan(ticker.bid);
  });

  it('returns USDC balance', async () => {
    const client = createClient(5000);
    const balance = await client.getBalance('USDC');

    expect(balance.available).toBe(5000);
  });

  it('executes market buy and updates balances', async () => {
    const client = createClient(10_000, 100_000);
    const order = await client.placeMarketBuy('BTC-USD', 100);

    expect(order.side).toBe('buy');
    expect(order.cost).toBe(100);
    expect(order.volume).toBeCloseTo(0.001, 4);

    const usdc = await client.getBalance('USDC');
    expect(usdc.available).toBeLessThan(10_000);

    const btc = await client.getBalance('BTC');
    expect(btc.available).toBeGreaterThan(0);
  });

  it('rejects buy when insufficient balance', async () => {
    const client = createClient(50, 100_000);

    await expect(client.placeMarketBuy('BTC-USD', 100)).rejects.toThrow('Insufficient');
  });

  it('validates minimum order value', async () => {
    const client = createClient();

    expect(await client.validateOrder('BTC-USD', 5)).toBe(false);
    expect(await client.validateOrder('BTC-USD', 50)).toBe(true);
  });

  it('returns candle price history', async () => {
    const client = createClient();
    const candles = await client.getCandles('BTC-USD');

    expect(candles.length).toBeGreaterThan(0);
    expect(candles.every((p) => p > 0)).toBe(true);
  });
});

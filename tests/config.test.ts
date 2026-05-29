import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../src/config/index.js';

describe('Config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads default paper mode config', () => {
    const config = loadConfig({
      BOT_MODE: 'paper',
      TRADING_PAIR: 'BTC-USD',
      DCA_AMOUNT: '50',
    });

    expect(config.bot.mode).toBe('paper');
    expect(config.trading.pair).toBe('BTC-USD');
    expect(config.dca.amount).toBe(50);
    expect(config.dydx.network).toBe('testnet');
  });

  it('normalizes trading pair without dash', () => {
    const config = loadConfig({
      BOT_MODE: 'paper',
      TRADING_PAIR: 'ETHUSD',
    });

    expect(config.trading.pair).toBe('ETH-USD');
  });

  it('requires mnemonic for live mode', () => {
    expect(() =>
      loadConfig({
        BOT_MODE: 'live',
        DYDX_MNEMONIC: '',
      })
    ).toThrow('DYDX_MNEMONIC must be set');
  });

  it('validates mnemonic word count for live mode', () => {
    expect(() =>
      loadConfig({
        BOT_MODE: 'live',
        DYDX_MNEMONIC: 'one two three',
      })
    ).toThrow('valid 12 or 24 word phrase');
  });

  it('accepts valid live config with 24-word mnemonic', () => {
    const words = Array.from({ length: 24 }, (_, i) => `word${i + 1}`).join(' ');
    const config = loadConfig({
      BOT_MODE: 'live',
      DYDX_MNEMONIC: words,
      DYDX_NETWORK: 'mainnet',
    });

    expect(config.bot.mode).toBe('live');
    expect(config.dydx.network).toBe('mainnet');
  });

  it('parses smart DCA settings', () => {
    const config = loadConfig({
      BOT_MODE: 'paper',
      SMART_DCA_ENABLED: 'true',
      SMART_DCA_DROP_THRESHOLD: '10',
      SMART_DCA_BOOST_MULTIPLIER: '2',
      SMART_DCA_MA_PERIOD: '14',
    });

    expect(config.smartDca.enabled).toBe(true);
    expect(config.smartDca.dropThresholdPercent).toBe(10);
    expect(config.smartDca.boostMultiplier).toBe(2);
    expect(config.smartDca.movingAveragePeriod).toBe(14);
  });
});

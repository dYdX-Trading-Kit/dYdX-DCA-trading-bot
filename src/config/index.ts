import { z } from 'zod';
import type { BotMode, DydxNetwork } from '../types/index.js';

const botModeSchema = z.enum(['live', 'paper']);
const networkSchema = z.enum(['mainnet', 'testnet']);

const configSchema = z.object({
  dydx: z.object({
    mnemonic: z.string(),
    subaccountNumber: z.number().int().min(0).max(127),
    network: networkSchema,
  }),
  trading: z.object({
    pair: z.string().min(1),
    baseCurrency: z.string().min(1),
    quoteCurrency: z.string().min(1),
  }),
  dca: z.object({
    amount: z.number().positive('DCA_AMOUNT must be positive'),
    intervalType: z.enum(['cron', 'minutes']),
    cronExpression: z.string().min(1),
    intervalMinutes: z.number().int().positive(),
  }),
  smartDca: z.object({
    enabled: z.boolean(),
    dropThresholdPercent: z.number().min(0).max(100),
    boostMultiplier: z.number().min(1).max(10),
    movingAveragePeriod: z.number().int().min(2).max(365),
  }),
  safety: z.object({
    maxDailySpend: z.number().positive(),
    minBalanceReserve: z.number().min(0),
    maxOrderRetries: z.number().int().min(1).max(10),
    minOrderValue: z.number().positive(),
  }),
  bot: z.object({
    mode: botModeSchema,
    dryRun: z.boolean(),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    file: z.string(),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === '') return defaultValue;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value: "${value}"`);
  }
  return parsed;
}

function normalizeTradingPair(pair: string): string {
  const trimmed = pair.trim().toUpperCase();
  if (trimmed.includes('-')) {
    return trimmed;
  }
  if (trimmed.endsWith('USD')) {
    return `${trimmed.slice(0, -3)}-USD`;
  }
  return trimmed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = (env.BOT_MODE ?? 'paper') as BotMode;
  const network = (env.DYDX_NETWORK ?? 'testnet') as DydxNetwork;

  const raw = {
    dydx: {
      mnemonic: env.DYDX_MNEMONIC ?? '',
      subaccountNumber: parseNumber(env.DYDX_SUBACCOUNT_NUMBER, 0),
      network,
    },
    trading: {
      pair: normalizeTradingPair(env.TRADING_PAIR ?? 'BTC-USD'),
      baseCurrency: env.BASE_CURRENCY ?? 'USDC',
      quoteCurrency: env.QUOTE_CURRENCY ?? 'BTC',
    },
    dca: {
      amount: parseNumber(env.DCA_AMOUNT, 50),
      intervalType: (env.DCA_INTERVAL === 'minutes' ? 'minutes' : 'cron') as 'cron' | 'minutes',
      cronExpression: env.DCA_CRON ?? '0 9 * * *',
      intervalMinutes: parseNumber(env.DCA_INTERVAL_MINUTES, 1440),
    },
    smartDca: {
      enabled: parseBoolean(env.SMART_DCA_ENABLED, true),
      dropThresholdPercent: parseNumber(env.SMART_DCA_DROP_THRESHOLD, 5),
      boostMultiplier: parseNumber(env.SMART_DCA_BOOST_MULTIPLIER, 1.5),
      movingAveragePeriod: parseNumber(env.SMART_DCA_MA_PERIOD, 30),
    },
    safety: {
      maxDailySpend: parseNumber(env.MAX_DAILY_SPEND, 200),
      minBalanceReserve: parseNumber(env.MIN_BALANCE_RESERVE, 100),
      maxOrderRetries: parseNumber(env.MAX_ORDER_RETRIES, 3),
      minOrderValue: parseNumber(env.MIN_ORDER_VALUE, 10),
    },
    bot: {
      mode,
      dryRun: parseBoolean(env.DRY_RUN, false),
    },
    logging: {
      level: (env.LOG_LEVEL ?? 'info') as 'error' | 'warn' | 'info' | 'debug',
      file: env.LOG_FILE ?? 'logs/bot.log',
    },
  };

  if (mode === 'live') {
    if (!raw.dydx.mnemonic || raw.dydx.mnemonic === 'your_mnemonic_phrase_here') {
      throw new Error('DYDX_MNEMONIC must be set for live trading mode');
    }
    const wordCount = raw.dydx.mnemonic.trim().split(/\s+/).length;
    if (wordCount !== 12 && wordCount !== 24) {
      throw new Error('DYDX_MNEMONIC must be a valid 12 or 24 word phrase');
    }
  }

  return configSchema.parse(raw);
}

export { configSchema };

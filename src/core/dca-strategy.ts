import type { AppConfig } from '../config/index.js';
import type { DcaState, IExchangeClient } from '../types/index.js';
import {
  calculateMovingAverage,
  calculatePercentChange,
  getTodayDateString,
} from '../utils/helpers.js';
import type { Logger } from '../utils/logger.js';

export interface DcaStrategyResult {
  shouldExecute: boolean;
  effectiveAmount: number;
  reason: string;
}

export interface DcaStrategyOptions {
  config: AppConfig;
  exchange: IExchangeClient;
  logger: Logger;
}

export class DcaStrategy {
  private readonly config: AppConfig;
  private readonly exchange: IExchangeClient;
  private readonly logger: Logger;

  constructor(options: DcaStrategyOptions) {
    this.config = options.config;
    this.exchange = options.exchange;
    this.logger = options.logger;
  }

  async evaluate(state: DcaState): Promise<DcaStrategyResult> {
    const baseAmount = this.config.dca.amount;
    const today = getTodayDateString();

    if (state.dailySpentDate !== today) {
      state.dailySpent = 0;
      state.dailySpentDate = today;
    }

    if (state.dailySpent >= this.config.safety.maxDailySpend) {
      return {
        shouldExecute: false,
        effectiveAmount: 0,
        reason: `Daily spend limit reached (${this.config.safety.maxDailySpend})`,
      };
    }

    const balance = await this.exchange.getBalance(this.config.trading.baseCurrency);
    const availableAfterReserve = balance.available - this.config.safety.minBalanceReserve;

    if (availableAfterReserve <= 0) {
      return {
        shouldExecute: false,
        effectiveAmount: 0,
        reason: `Insufficient balance after reserve (available: ${balance.available}, reserve: ${this.config.safety.minBalanceReserve})`,
      };
    }

    let effectiveAmount = Math.min(baseAmount, availableAfterReserve);
    let reason = `Standard DCA: ${effectiveAmount}`;

    if (this.config.smartDca.enabled) {
      const smartResult = await this.applySmartDca(effectiveAmount, state);
      effectiveAmount = smartResult.amount;
      reason = smartResult.reason;
    }

    const remainingDaily = this.config.safety.maxDailySpend - state.dailySpent;
    if (effectiveAmount > remainingDaily) {
      effectiveAmount = remainingDaily;
      reason += ` (capped to daily limit: ${remainingDaily})`;
    }

    if (effectiveAmount < this.config.safety.minOrderValue) {
      return {
        shouldExecute: false,
        effectiveAmount: 0,
        reason: `Effective amount ${effectiveAmount} below minimum order value (${this.config.safety.minOrderValue})`,
      };
    }

    if (effectiveAmount <= 0) {
      return {
        shouldExecute: false,
        effectiveAmount: 0,
        reason: 'Effective amount is zero after adjustments',
      };
    }

    const isValid = await this.exchange.validateOrder(
      this.config.trading.pair,
      effectiveAmount
    );

    if (!isValid) {
      return {
        shouldExecute: false,
        effectiveAmount: 0,
        reason: 'Order validation failed on exchange',
      };
    }

    return {
      shouldExecute: true,
      effectiveAmount,
      reason,
    };
  }

  private async applySmartDca(
    baseAmount: number,
    state: DcaState
  ): Promise<{ amount: number; reason: string }> {
    const { smartDca } = this.config;

    try {
      const ticker = await this.exchange.getTicker(this.config.trading.pair);
      const currentPrice = ticker.last;

      state.priceHistory.push(currentPrice);
      if (state.priceHistory.length > 365) {
        state.priceHistory = state.priceHistory.slice(-365);
      }

      const candlePrices = await this.exchange.getCandles(
        this.config.trading.pair,
        '1DAY',
        smartDca.movingAveragePeriod
      );

      const pricesForMa =
        candlePrices.length >= smartDca.movingAveragePeriod
          ? candlePrices
          : state.priceHistory;

      if (pricesForMa.length < 2) {
        return { amount: baseAmount, reason: 'Standard DCA (insufficient price history)' };
      }

      const movingAverage = calculateMovingAverage(
        pricesForMa,
        smartDca.movingAveragePeriod
      );

      const percentBelowMa = calculatePercentChange(currentPrice, movingAverage);

      if (percentBelowMa <= -smartDca.dropThresholdPercent) {
        const boostedAmount = Math.min(
          baseAmount * smartDca.boostMultiplier,
          this.config.safety.maxDailySpend - state.dailySpent
        );

        this.logger.info(
          `Smart DCA boost: price ${currentPrice.toFixed(2)} is ${Math.abs(percentBelowMa).toFixed(2)}% ` +
            `below MA(${smartDca.movingAveragePeriod})=${movingAverage.toFixed(2)}, ` +
            `boosting ${baseAmount} -> ${boostedAmount}`
        );

        return {
          amount: boostedAmount,
          reason: `Smart DCA boost: price ${percentBelowMa.toFixed(2)}% below MA, amount ${boostedAmount}`,
        };
      }

      if (percentBelowMa >= smartDca.dropThresholdPercent) {
        const reducedAmount = baseAmount * 0.75;
        this.logger.info(
          `Smart DCA reduce: price ${percentBelowMa.toFixed(2)}% above MA, reducing to ${reducedAmount}`
        );
        return {
          amount: reducedAmount,
          reason: `Smart DCA reduce: price ${percentBelowMa.toFixed(2)}% above MA, amount ${reducedAmount}`,
        };
      }

      return {
        amount: baseAmount,
        reason: `Standard DCA: price near MA (${percentBelowMa.toFixed(2)}%)`,
      };
    } catch (error) {
      this.logger.warn(
        `Smart DCA evaluation failed, using base amount: ${error instanceof Error ? error.message : String(error)}`
      );
      return { amount: baseAmount, reason: 'Standard DCA (smart evaluation failed)' };
    }
  }

  updateStateAfterExecution(
    state: DcaState,
    amountSpent: number,
    volume: number,
    _price: number
  ): void {
    state.totalInvested += amountSpent;
    state.totalVolumeAcquired += volume;
    state.averagePrice =
      state.totalVolumeAcquired > 0
        ? state.totalInvested / state.totalVolumeAcquired
        : 0;
    state.executionCount++;
    state.dailySpent += amountSpent;
    state.lastExecutionAt = Date.now();
  }

  createInitialState(): DcaState {
    return {
      totalInvested: 0,
      totalVolumeAcquired: 0,
      averagePrice: 0,
      executionCount: 0,
      dailySpent: 0,
      dailySpentDate: getTodayDateString(),
      lastExecutionAt: null,
      priceHistory: [],
    };
  }
}

import type { AppConfig } from '../config/index.js';
import type {
  BotStats,
  DcaExecutionResult,
  DcaState,
  IExchangeClient,
} from '../types/index.js';
import { sleep } from '../utils/helpers.js';
import type { Logger } from '../utils/logger.js';
import { DcaStrategy } from './dca-strategy.js';
import { StateManager } from './state-manager.js';

export interface DcaBotOptions {
  config: AppConfig;
  exchange: IExchangeClient;
  logger: Logger;
  stateDir?: string;
}

export class DcaBot {
  private readonly config: AppConfig;
  private readonly exchange: IExchangeClient;
  private readonly logger: Logger;
  private readonly strategy: DcaStrategy;
  private readonly stateManager: StateManager;
  private state: DcaState;
  private isRunning = false;
  private startTime = 0;
  private nextScheduledRun: string | null = null;

  constructor(options: DcaBotOptions) {
    this.config = options.config;
    this.exchange = options.exchange;
    this.logger = options.logger;
    this.strategy = new DcaStrategy({
      config: this.config,
      exchange: this.exchange,
      logger: this.logger,
    });
    this.stateManager = new StateManager(this.logger, options.stateDir);
    this.state = this.stateManager.load() ?? this.strategy.createInitialState();
  }

  async executeOnce(): Promise<DcaExecutionResult> {
    const timestamp = Date.now();

    try {
      this.logger.info('Starting DCA execution cycle...');

      const evaluation = await this.strategy.evaluate(this.state);

      if (!evaluation.shouldExecute) {
        this.logger.info(`DCA skipped: ${evaluation.reason}`);
        return {
          success: false,
          amountSpent: 0,
          effectiveAmount: 0,
          priceAtExecution: 0,
          strategyReason: evaluation.reason,
          timestamp,
        };
      }

      const ticker = await this.exchange.getTicker(this.config.trading.pair);
      const priceAtExecution = ticker.last;

      if (this.config.bot.dryRun) {
        this.logger.info(
          `[DRY RUN] Would long ${evaluation.effectiveAmount} ${this.config.trading.baseCurrency} ` +
            `notional on ${this.config.trading.pair} @ ${priceAtExecution.toFixed(2)} — ${evaluation.reason}`
        );
        return {
          success: true,
          amountSpent: 0,
          effectiveAmount: evaluation.effectiveAmount,
          priceAtExecution,
          strategyReason: `[DRY RUN] ${evaluation.reason}`,
          timestamp,
        };
      }

      const order = await this.executeWithRetry(
        this.config.trading.pair,
        evaluation.effectiveAmount
      );

      this.strategy.updateStateAfterExecution(
        this.state,
        order.cost,
        order.volume,
        order.price
      );
      this.stateManager.save(this.state);

      this.logger.info(
        `DCA executed successfully: long ${order.volume.toFixed(8)} ${this.config.trading.quoteCurrency} ` +
          `for ${order.cost.toFixed(2)} ${this.config.trading.baseCurrency} @ ${order.price.toFixed(2)}`
      );

      return {
        success: true,
        order,
        amountSpent: order.cost,
        effectiveAmount: evaluation.effectiveAmount,
        priceAtExecution,
        strategyReason: evaluation.reason,
        timestamp,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`DCA execution failed: ${message}`);
      return {
        success: false,
        amountSpent: 0,
        effectiveAmount: 0,
        priceAtExecution: 0,
        strategyReason: 'Execution error',
        error: message,
        timestamp,
      };
    }
  }

  private async executeWithRetry(pair: string, amount: number) {
    const maxRetries = this.config.safety.maxOrderRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.exchange.placeMarketBuy(pair, amount);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Order attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);

        if (attempt < maxRetries) {
          const backoff = attempt * 2000;
          this.logger.info(`Retrying in ${backoff}ms...`);
          await sleep(backoff);
        }
      }
    }

    throw lastError ?? new Error('Order failed after all retries');
  }

  getStats(): BotStats {
    return {
      mode: this.config.bot.mode,
      pair: this.config.trading.pair,
      network: this.config.dydx.network,
      state: { ...this.state },
      isRunning: this.isRunning,
      nextScheduledRun: this.nextScheduledRun,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
    };
  }

  getState(): DcaState {
    return { ...this.state };
  }

  setRunning(running: boolean): void {
    this.isRunning = running;
    if (running) {
      this.startTime = Date.now();
    }
  }

  setNextScheduledRun(scheduledRun: string | null): void {
    this.nextScheduledRun = scheduledRun;
  }

  resetState(): void {
    this.state = this.strategy.createInitialState();
    this.stateManager.reset();
    this.logger.info('Bot state has been reset');
  }
}

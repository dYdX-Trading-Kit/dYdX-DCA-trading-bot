import type { AppConfig } from '../config/index.js';
import { DcaBot } from '../core/dca-bot.js';
import type { IExchangeClient } from '../types/index.js';
import type { Logger } from '../utils/logger.js';
import { Scheduler } from './scheduler.js';

export class BotService {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private bot: DcaBot | null = null;
  private scheduler: Scheduler | null = null;
  private exchange: IExchangeClient | null = null;

  constructor(config: AppConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  private async createExchange(): Promise<IExchangeClient> {
    if (this.config.bot.mode === 'paper') {
      const { PaperTradingClient } = await import('../api/dydx/paper-trading.js');
      return new PaperTradingClient({
        initialBalance: 10_000,
        baseCurrency: this.config.trading.baseCurrency,
        quoteCurrency: this.config.trading.quoteCurrency,
        minOrderValue: this.config.safety.minOrderValue,
        logger: this.logger,
      });
    }

    const { DydxClient } = await import('../api/dydx/client.js');
    const client = new DydxClient({
      config: this.config,
      minOrderValue: this.config.safety.minOrderValue,
      logger: this.logger,
    });
    await client.initialize();
    return client;
  }

  async initializeAsync(): Promise<DcaBot> {
    if (this.bot) {
      return this.bot;
    }

    this.exchange = await this.createExchange();
    this.bot = new DcaBot({
      config: this.config,
      exchange: this.exchange,
      logger: this.logger,
    });
    this.scheduler = new Scheduler(this.config, this.bot, this.logger);

    this.logger.info(
      `Bot initialized in ${this.config.bot.mode.toUpperCase()} mode — ` +
        `network: ${this.config.dydx.network}, pair: ${this.config.trading.pair}, ` +
        `DCA amount: ${this.config.dca.amount} ${this.config.trading.baseCurrency}`
    );

    return this.bot;
  }

  async start(): Promise<void> {
    if (!this.bot || !this.scheduler) {
      await this.initializeAsync();
    }
    this.scheduler!.start();
  }

  stop(): void {
    this.scheduler?.stop();
  }

  async runOnce(): Promise<void> {
    if (!this.bot) {
      await this.initializeAsync();
    }
    await this.bot!.executeOnce();
  }

  async getBot(): Promise<DcaBot> {
    if (!this.bot) {
      await this.initializeAsync();
    }
    return this.bot!;
  }

  async shutdown(): Promise<void> {
    this.stop();
    this.logger.info('Bot service shut down gracefully');
  }
}

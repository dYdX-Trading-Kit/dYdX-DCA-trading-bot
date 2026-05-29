import { CronJob } from 'cron';
import type { AppConfig } from '../config/index.js';
import type { DcaBot } from '../core/dca-bot.js';
import type { Logger } from '../utils/logger.js';

export class Scheduler {
  private cronJob: CronJob | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: AppConfig;
  private readonly bot: DcaBot;
  private readonly logger: Logger;

  constructor(config: AppConfig, bot: DcaBot, logger: Logger) {
    this.config = config;
    this.bot = bot;
    this.logger = logger;
  }

  start(): void {
    if (this.config.dca.intervalType === 'cron') {
      this.startCron();
    } else {
      this.startInterval();
    }

    this.bot.setRunning(true);
    this.logger.info('Scheduler started');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    this.bot.setRunning(false);
    this.logger.info('Scheduler stopped');
  }

  private startCron(): void {
    const expression = this.config.dca.cronExpression;

    this.cronJob = new CronJob(
      expression,
      () => {
        void this.runExecution();
      },
      null,
      true,
      'UTC'
    );

    const next = this.cronJob.nextDate().toISO();
    this.bot.setNextScheduledRun(next ?? null);
    this.logger.info(`Cron scheduler active: "${expression}" — next run: ${next}`);
  }

  private startInterval(): void {
    const minutes = this.config.dca.intervalMinutes;
    const ms = minutes * 60 * 1000;

    this.intervalTimer = setInterval(() => {
      void this.runExecution();
    }, ms);

    const nextRun = new Date(Date.now() + ms).toISOString();
    this.bot.setNextScheduledRun(nextRun);
    this.logger.info(`Interval scheduler active: every ${minutes} minutes — next run: ${nextRun}`);
  }

  private async runExecution(): Promise<void> {
    this.logger.info('Scheduled DCA execution triggered');
    const result = await this.bot.executeOnce();

    if (result.success) {
      this.logger.info(`Scheduled execution completed: ${result.strategyReason}`);
    } else {
      this.logger.warn(
        `Scheduled execution skipped/failed: ${result.strategyReason || result.error}`
      );
    }

    if (this.cronJob) {
      const next = this.cronJob.nextDate().toISO();
      this.bot.setNextScheduledRun(next ?? null);
    } else if (this.intervalTimer) {
      const minutes = this.config.dca.intervalMinutes;
      const nextRun = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      this.bot.setNextScheduledRun(nextRun);
    }
  }

  async runOnce(): Promise<void> {
    await this.runExecution();
  }
}

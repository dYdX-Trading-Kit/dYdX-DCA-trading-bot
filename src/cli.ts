import { Command } from 'commander';
import dotenv from 'dotenv';
import { loadConfig } from './config/index.js';
import { BotService } from './services/bot-service.js';
import { createLogger, setLogger } from './utils/logger.js';
import { formatCurrency } from './utils/helpers.js';

dotenv.config();

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('dydx-dca-bot')
    .description('dYdX DCA Trading Bot — Dollar Cost Averaging for perpetual markets')
    .version('1.0.0');

  program
    .option('-m, --mode <mode>', 'Bot mode: live or paper', 'paper')
    .option('-n, --network <network>', 'dYdX network: mainnet or testnet', 'testnet')
    .option('--dry-run', 'Simulate without placing orders', false)
    .option('--once', 'Execute a single DCA cycle and exit', false)
    .option('--status', 'Show bot status and exit', false)
    .option('--reset', 'Reset DCA state and exit', false);

  program.parse(argv);
  const opts = program.opts<{
    mode: string;
    network: string;
    dryRun: boolean;
    once: boolean;
    status: boolean;
    reset: boolean;
  }>();

  if (opts.mode) {
    process.env.BOT_MODE = opts.mode;
  }
  if (opts.network) {
    process.env.DYDX_NETWORK = opts.network;
  }
  if (opts.dryRun) {
    process.env.DRY_RUN = 'true';
  }

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(
      `Configuration error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  const logger = createLogger(config.logging.level, config.logging.file);
  setLogger(logger);

  const service = new BotService(config, logger);
  const bot = await service.initializeAsync();

  if (opts.reset) {
    bot.resetState();
    console.log('DCA state has been reset.');
    process.exit(0);
  }

  if (opts.status) {
    printStatus(bot.getStats(), config);
    process.exit(0);
  }

  if (opts.once) {
    logger.info('Running single DCA execution...');
    const result = await bot.executeOnce();
    printExecutionResult(result, config);
    process.exit(result.success ? 0 : 1);
  }

  service.start().catch((error: unknown) => {
    logger.error(`Failed to start bot: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    await service.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('dYdX DCA Bot is running. Press Ctrl+C to stop.');
}

function printStatus(
  stats: ReturnType<import('./core/dca-bot.js').DcaBot['getStats']>,
  config: ReturnType<typeof loadConfig>
): void {
  const { state } = stats;
  console.log('\n=== dYdX DCA Bot — Status ===\n');
  console.log(`Mode:              ${stats.mode.toUpperCase()}`);
  console.log(`Network:           ${stats.network.toUpperCase()}`);
  console.log(`Trading Pair:      ${stats.pair}`);
  console.log(`Running:           ${stats.isRunning ? 'Yes' : 'No'}`);
  console.log(`Next Scheduled:    ${stats.nextScheduledRun ?? 'N/A'}`);
  console.log(`Executions:        ${state.executionCount}`);
  console.log(
    `Total Invested:    ${formatCurrency(state.totalInvested, config.trading.baseCurrency)}`
  );
  console.log(
    `Position Size:     ${formatCurrency(state.totalVolumeAcquired, config.trading.quoteCurrency)}`
  );
  console.log(
    `Average Entry:     ${formatCurrency(state.averagePrice, config.trading.baseCurrency)}`
  );
  console.log(
    `Daily Spent:       ${formatCurrency(state.dailySpent, config.trading.baseCurrency)}`
  );
  console.log(
    `Last Execution:    ${state.lastExecutionAt ? new Date(state.lastExecutionAt).toISOString() : 'Never'}`
  );
  console.log('');
}

function printExecutionResult(
  result: Awaited<ReturnType<import('./core/dca-bot.js').DcaBot['executeOnce']>>,
  config: ReturnType<typeof loadConfig>
): void {
  console.log('\n=== DCA Execution Result ===\n');
  console.log(`Success:           ${result.success ? 'Yes' : 'No'}`);
  console.log(`Strategy:          ${result.strategyReason}`);
  console.log(
    `Effective Amount:  ${formatCurrency(result.effectiveAmount, config.trading.baseCurrency)}`
  );
  console.log(`Amount Spent:      ${formatCurrency(result.amountSpent, config.trading.baseCurrency)}`);
  console.log(
    `Price:             ${formatCurrency(result.priceAtExecution, config.trading.baseCurrency)}`
  );
  if (result.order) {
    console.log(`Order ID:          ${result.order.orderId}`);
    console.log(
      `Volume:            ${formatCurrency(result.order.volume, config.trading.quoteCurrency)}`
    );
    console.log(`Fee:               ${formatCurrency(result.order.fee, config.trading.baseCurrency)}`);
  }
  if (result.error) {
    console.log(`Error:             ${result.error}`);
  }
  console.log('');
}

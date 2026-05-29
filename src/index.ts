import { runCli } from './cli.js';

runCli(process.argv).catch((error: unknown) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

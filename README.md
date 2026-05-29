# dYdX DCA Trading Bot

Production-grade **Dollar Cost Averaging (DCA)** trading bot for [dYdX v4](https://dydx.exchange/) perpetual markets. Automatically accumulates long positions at fixed intervals with intelligent price-adaptive strategies, safety limits, and full paper-trading support.

---

## Features

- **Automated DCA** — Schedule recurring long entries via cron expressions or fixed intervals
- **Smart DCA** — Dynamically adjusts buy amounts based on moving average price signals
- **dYdX v4 Integration** — Uses official `@dydxprotocol/v4-client-js` for indexer and validator clients
- **Perpetual Markets** — Supports BTC-USD, ETH-USD, and all dYdX v4 perpetual tickers
- **Safety Limits** — Daily spend caps, minimum balance reserves, and order retry logic
- **Paper Trading** — Full simulation mode for risk-free testing
- **Dry Run** — Preview execution without placing any orders
- **State Persistence** — Tracks investment history, average entry price, and execution count
- **Production Logging** — Structured logging with file rotation via Winston
- **Type-Safe** — Built entirely in TypeScript with Zod configuration validation

---

## Project Structure

```
dYdX-DCA-trading-bot/
├── src/
│   ├── api/dydx/         # dYdX v4 client, paper trading simulator
│   ├── config/           # Environment & Zod schema validation
│   ├── core/             # DCA strategy, bot engine, state manager
│   ├── services/         # Bot service orchestrator & scheduler
│   ├── types/            # Shared TypeScript interfaces
│   ├── utils/            # Helpers, logging utilities
│   ├── cli.ts            # CLI entry point & commands
│   └── index.ts          # Application bootstrap
├── tests/                # Vitest unit test suite
├── data/                 # Persistent DCA state (auto-created)
├── logs/                 # Log files (auto-created)
├── .env.example          # Environment variable template
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Quick Start

### 1. Navigate to the project

```bash
cd dYdX-DCA-trading-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your settings. For paper trading (recommended to start), no wallet mnemonic is required.

### 4. Run in paper trading mode

```bash
npm run bot:paper
```

### 5. Execute a single DCA cycle

```bash
npm run dev -- --once
```

### 6. Check bot status

```bash
npm run dev -- --status
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DYDX_MNEMONIC` | — | 12/24-word wallet mnemonic (required for live mode) |
| `DYDX_SUBACCOUNT_NUMBER` | `0` | dYdX subaccount index (0–127) |
| `DYDX_NETWORK` | `testnet` | `mainnet` or `testnet` |
| `TRADING_PAIR` | `BTC-USD` | dYdX perpetual ticker (e.g. `ETH-USD`, `SOL-USD`) |
| `BASE_CURRENCY` | `USDC` | Collateral currency |
| `QUOTE_CURRENCY` | `BTC` | Base asset of the perpetual market |
| `DCA_AMOUNT` | `50` | Base USDC notional per DCA cycle |
| `DCA_INTERVAL` | `cron` | Schedule type: `cron` or `minutes` |
| `DCA_CRON` | `0 9 * * *` | Cron expression (UTC) |
| `DCA_INTERVAL_MINUTES` | `1440` | Interval in minutes (when using minutes mode) |
| `SMART_DCA_ENABLED` | `true` | Enable price-adaptive DCA |
| `SMART_DCA_DROP_THRESHOLD` | `5` | % below MA to trigger boost |
| `SMART_DCA_BOOST_MULTIPLIER` | `1.5` | Multiplier when price drops |
| `SMART_DCA_MA_PERIOD` | `30` | Moving average period (days) |
| `MAX_DAILY_SPEND` | `200` | Maximum USDC spend per day |
| `MIN_BALANCE_RESERVE` | `100` | Minimum USDC to keep in account |
| `MIN_ORDER_VALUE` | `10` | Minimum order notional |
| `MAX_ORDER_RETRIES` | `3` | Order retry attempts |
| `BOT_MODE` | `paper` | `paper` or `live` |
| `LOG_LEVEL` | `info` | Logging level |

---

## CLI Commands

```bash
# Start bot with scheduler (paper mode)
npm run bot:paper

# Start bot in live mode on testnet
npm run dev -- --mode live --network testnet

# Dry run — preview without placing orders
npm run bot:dry-run -- --once

# Single execution
npm run dev -- --once

# Show current status
npm run dev -- --status

# Reset DCA state
npm run dev -- --reset

# Build for production
npm run build
npm start
```

---

## DCA Strategy

### Standard DCA
Purchases a fixed USDC notional long position at each scheduled interval regardless of price.

### Smart DCA
Uses a moving average (MA) to adapt buy amounts:

| Condition | Action |
|---|---|
| Price ≥ `MA + threshold%` | Reduce buy amount by 25% |
| Price within threshold of MA | Standard buy amount |
| Price ≤ `MA - threshold%` | Boost buy amount by multiplier |

### Safety Controls
- **Daily spend cap** — Prevents exceeding `MAX_DAILY_SPEND` per calendar day
- **Balance reserve** — Always maintains `MIN_BALANCE_RESERVE` USDC in account
- **Minimum order value** — Enforces dYdX minimum order requirements
- **Retry with backoff** — Automatically retries failed orders up to `MAX_ORDER_RETRIES`

---

## Live Trading Setup

1. Export your dYdX wallet mnemonic (12 or 24 words) from your wallet app
2. Fund your dYdX subaccount with USDC on the selected network
3. Set credentials in `.env`:

```env
DYDX_MNEMONIC=word1 word2 word3 ... word24
DYDX_NETWORK=testnet
BOT_MODE=live
```

4. Test with dry run first:

```bash
npm run dev -- --mode live --network testnet --dry-run --once
```

5. Start live bot:

```bash
npm run dev -- --mode live --network testnet
```

> **Warning:** Live trading involves real financial risk. Always test thoroughly in paper mode first. Never invest more than you can afford to lose.

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type check
npm run lint
```

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Scheduler  │────▶│   DcaBot     │────▶│  DcaStrategy    │
│  (Cron/Timer)│     │  Orchestrator│     │  (Smart Logic)  │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │  Exchange    │
                    │  Client      │
                    ├──────────────┤
                    │  DydxClient  │──▶ dYdX v4 Indexer + Validator
                    │ PaperClient  │──▶ Simulated Market
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │ StateManager │
                    │ (Persistence)│
                    └──────────────┘
```

---

## License

MIT

---

## Technical Support

Need help setting up, configuring, or troubleshooting the bot?

<div align="center">

### 📬 Contact Us on Telegram

# [@tradingtermin](https://t.me/tradingtermin)

**For technical support, questions, or assistance — reach out on Telegram**

</div>

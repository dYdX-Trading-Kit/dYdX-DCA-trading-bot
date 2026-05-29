import {
  CompositeClient,
  LocalWallet,
  Network,
  OrderExecution,
  OrderSide,
  OrderTimeInForce,
  OrderType,
  SubaccountInfo,
} from '@dydxprotocol/v4-client-js';
import type { AppConfig } from '../../config/index.js';
import type {
  Balance,
  DydxCandle,
  DydxIndexerMarket,
  IExchangeClient,
  OrderResult,
  TickerData,
} from '../../types/index.js';
import { generateClientOrderId, roundToStepSize, usdcToBaseSize } from '../../utils/helpers.js';
import type { Logger } from '../../utils/logger.js';

const DYDX_BECH32_PREFIX = 'dydx';

export interface DydxClientOptions {
  config: AppConfig;
  minOrderValue: number;
  logger: Logger;
}

export class DydxClient implements IExchangeClient {
  private readonly config: AppConfig;
  private readonly minOrderValue: number;
  private readonly logger: Logger;
  private client: CompositeClient | null = null;
  private subaccount: SubaccountInfo | null = null;
  private marketStepSizes = new Map<string, number>();
  private initialized = false;

  constructor(options: DydxClientOptions) {
    this.config = options.config;
    this.minOrderValue = options.minOrderValue;
    this.logger = options.logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const network =
      this.config.dydx.network === 'mainnet' ? Network.mainnet() : Network.testnet();

    this.client = await CompositeClient.connect(network);
    const wallet = await LocalWallet.fromMnemonic(this.config.dydx.mnemonic, DYDX_BECH32_PREFIX);
    this.subaccount = SubaccountInfo.forLocalWallet(
      wallet,
      this.config.dydx.subaccountNumber
    );

    this.initialized = true;
    this.logger.info(
      `dYdX client connected (${this.config.dydx.network}) — address: ${this.subaccount.address}`
    );
  }

  private ensureReady(): { client: CompositeClient; subaccount: SubaccountInfo } {
    if (!this.client || !this.subaccount) {
      throw new Error('dYdX client not initialized — call initialize() first');
    }
    return { client: this.client, subaccount: this.subaccount };
  }

  async getTicker(pair: string): Promise<TickerData> {
    await this.initialize();
    const { client } = this.ensureReady();

    const response = await client.indexerClient.markets.getPerpetualMarkets(pair);
    const market = response.markets[pair] as DydxIndexerMarket | undefined;

    if (!market) {
      throw new Error(`Market not found: ${pair}`);
    }

    const oraclePrice = parseFloat(market.oraclePrice);
    const spread = oraclePrice * 0.0002;
    const stepSize = parseFloat(market.stepSize);
    this.marketStepSizes.set(pair, stepSize);

    return {
      pair,
      ask: oraclePrice + spread,
      bid: oraclePrice - spread,
      last: oraclePrice,
      volume24h: parseFloat(market.volume24H),
      vwap24h: oraclePrice,
      high24h: oraclePrice * 1.02,
      low24h: oraclePrice * 0.98,
      open24h: oraclePrice * (1 - parseFloat(market.priceChange24H) / 100),
      timestamp: Date.now(),
    };
  }

  async getBalance(currency: string): Promise<Balance> {
    await this.initialize();
    const { client, subaccount } = this.ensureReady();

    const response = await client.indexerClient.account.getSubaccount(
      subaccount.address,
      subaccount.subaccountNumber
    );
    const subaccountData = response.subaccount;

    if (!subaccountData) {
      return { currency, available: 0, total: 0 };
    }

    const equity = parseFloat(subaccountData.equity ?? '0');
    const freeCollateral = parseFloat(subaccountData.freeCollateral ?? '0');

    if (currency.toUpperCase() === 'USDC') {
      return {
        currency: 'USDC',
        available: freeCollateral,
        total: equity,
      };
    }

    const position = subaccountData.openPerpetualPositions?.[this.config.trading.pair];
    if (position) {
      const size = Math.abs(parseFloat(position.size));
      return { currency, available: size, total: size };
    }

    return { currency, available: 0, total: 0 };
  }

  async getCandles(pair: string, resolution = '1DAY', limit = 30): Promise<number[]> {
    await this.initialize();
    const { client } = this.ensureReady();

    const response = await client.indexerClient.markets.getPerpetualMarketCandles(
      pair,
      resolution,
      undefined,
      undefined,
      limit
    );

    const candles = (response.candles ?? []) as DydxCandle[];
    return candles
      .map((c: DydxCandle) => parseFloat(c.close))
      .filter((price: number) => !Number.isNaN(price) && price > 0);
  }

  async validateOrder(_pair: string, amount: number): Promise<boolean> {
    if (amount < this.minOrderValue) {
      return false;
    }

    try {
      const balance = await this.getBalance(this.config.trading.baseCurrency);
      return balance.available >= amount + this.config.safety.minBalanceReserve;
    } catch {
      return false;
    }
  }

  async placeMarketBuy(pair: string, usdcAmount: number): Promise<OrderResult> {
    await this.initialize();
    const { client, subaccount } = this.ensureReady();

    const ticker = await this.getTicker(pair);
    const executionPrice = ticker.ask;
    const stepSize = this.marketStepSizes.get(pair) ?? 0.0001;

    const rawSize = usdcToBaseSize(usdcAmount, executionPrice);
    const size = roundToStepSize(rawSize, stepSize);

    if (size < stepSize) {
      throw new Error(`Order size ${size} below minimum step ${stepSize} for ${pair}`);
    }

    const clientId = generateClientOrderId();
    const aggressivePrice = executionPrice * 1.005;

    this.logger.info(
      `Placing market buy: ${size} ${this.config.trading.quoteCurrency} @ ~${executionPrice} (${usdcAmount} USDC)`
    );

    const tx = await client.placeOrder(
      subaccount,
      pair,
      OrderType.MARKET,
      OrderSide.BUY,
      aggressivePrice,
      size,
      clientId,
      OrderTimeInForce.IOC,
      0,
      OrderExecution.IOC,
      false,
      false
    );

    const fee = usdcAmount * 0.0005;
    const orderId = 'hash' in tx && tx.hash ? String(tx.hash) : `DYDX-${clientId}`;

    this.logger.info(`Order submitted: ${orderId}`);

    return {
      orderId,
      pair,
      side: 'buy',
      type: 'market',
      volume: size,
      price: executionPrice,
      cost: usdcAmount,
      fee,
      status: 'closed',
      timestamp: Date.now(),
      description: `Long ${size} ${this.config.trading.quoteCurrency} @ ${executionPrice}`,
    };
  }
}

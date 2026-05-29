import type {
  Balance,
  IExchangeClient,
  OrderResult,
  TickerData,
} from '../../types/index.js';
import type { Logger } from '../../utils/logger.js';

export interface PaperTradingOptions {
  initialBalance: number;
  baseCurrency: string;
  quoteCurrency: string;
  simulatedPrice?: number;
  minOrderValue?: number;
  logger: Logger;
}

interface PaperState {
  usdcBalance: number;
  positionSize: number;
  currentPrice: number;
  orders: OrderResult[];
  priceHistory: number[];
}

const DEFAULT_BTC_PRICE = 95_000;
const PAPER_TAKER_FEE = 0.0005;

export class PaperTradingClient implements IExchangeClient {
  private state: PaperState;
  private readonly baseCurrency: string;
  private readonly quoteCurrency: string;
  private readonly minOrderValue: number;
  private readonly logger: Logger;
  private orderCounter = 0;

  constructor(options: PaperTradingOptions) {
    this.baseCurrency = options.baseCurrency;
    this.quoteCurrency = options.quoteCurrency;
    this.minOrderValue = options.minOrderValue ?? 10;
    this.logger = options.logger;

    const initialPrice = options.simulatedPrice ?? DEFAULT_BTC_PRICE;
    this.state = {
      usdcBalance: options.initialBalance,
      positionSize: 0,
      currentPrice: initialPrice,
      orders: [],
      priceHistory: this.generateInitialPriceHistory(initialPrice),
    };

    this.logger.info(
      `Paper trading initialized: ${options.initialBalance} ${options.baseCurrency}, ` +
        `simulated ${options.quoteCurrency}-USD price: ${initialPrice}`
    );
  }

  private generateInitialPriceHistory(basePrice: number): number[] {
    const history: number[] = [];
    for (let i = 30; i >= 0; i--) {
      const variance = (Math.random() - 0.5) * basePrice * 0.02;
      history.push(basePrice + variance - i * (basePrice * 0.001));
    }
    return history;
  }

  simulatePriceMovement(): void {
    const volatility = 0.005;
    const change = (Math.random() - 0.48) * this.state.currentPrice * volatility;
    this.state.currentPrice = Math.max(this.state.currentPrice + change, 1);
    this.state.priceHistory.push(this.state.currentPrice);

    if (this.state.priceHistory.length > 365) {
      this.state.priceHistory = this.state.priceHistory.slice(-365);
    }
  }

  async getTicker(pair: string): Promise<TickerData> {
    this.simulatePriceMovement();

    const spread = this.state.currentPrice * 0.0002;
    const price = this.state.currentPrice;

    return {
      pair,
      ask: price + spread,
      bid: price - spread,
      last: price,
      volume24h: 1500 + Math.random() * 500,
      vwap24h: price * (1 + (Math.random() - 0.5) * 0.01),
      high24h: price * 1.03,
      low24h: price * 0.97,
      open24h: price * (1 + (Math.random() - 0.5) * 0.02),
      timestamp: Date.now(),
    };
  }

  async getBalance(currency: string): Promise<Balance> {
    const upper = currency.toUpperCase();
    if (upper === this.quoteCurrency.toUpperCase()) {
      return {
        currency,
        available: this.state.positionSize,
        total: this.state.positionSize,
      };
    }
    if (upper === this.baseCurrency.toUpperCase() || upper === 'USDC') {
      return {
        currency: this.baseCurrency,
        available: this.state.usdcBalance,
        total: this.state.usdcBalance,
      };
    }
    return { currency, available: 0, total: 0 };
  }

  async placeMarketBuy(pair: string, amount: number): Promise<OrderResult> {
    const ticker = await this.getTicker(pair);
    const executionPrice = ticker.ask;
    const cost = amount;
    const fee = cost * PAPER_TAKER_FEE;
    const totalCost = cost + fee;
    const volume = cost / executionPrice;

    if (totalCost > this.state.usdcBalance) {
      throw new Error(
        `Insufficient ${this.baseCurrency} balance: need ${totalCost.toFixed(2)}, ` +
          `have ${this.state.usdcBalance.toFixed(2)}`
      );
    }

    this.state.usdcBalance -= totalCost;
    this.state.positionSize += volume;
    this.orderCounter++;

    const order: OrderResult = {
      orderId: `PAPER-${this.orderCounter}`,
      pair,
      side: 'buy',
      type: 'market',
      volume,
      price: executionPrice,
      cost,
      fee,
      status: 'closed',
      timestamp: Date.now(),
      description: `Paper long ${volume.toFixed(8)} @ ${executionPrice.toFixed(2)}`,
    };

    this.state.orders.push(order);
    this.logger.info(
      `Paper order executed: long ${volume.toFixed(8)} ${this.quoteCurrency} ` +
        `for ${cost.toFixed(2)} ${this.baseCurrency} @ ${executionPrice.toFixed(2)}`
    );

    return order;
  }

  async validateOrder(_pair: string, amount: number): Promise<boolean> {
    if (amount < this.minOrderValue) {
      return false;
    }
    const balance = await this.getBalance(this.baseCurrency);
    const estimatedCost = amount * (1 + PAPER_TAKER_FEE);
    return balance.available >= estimatedCost;
  }

  async getCandles(_pair: string, _resolution?: string, _limit?: number): Promise<number[]> {
    return [...this.state.priceHistory];
  }

  getPaperState(): Readonly<PaperState> {
    return { ...this.state, orders: [...this.state.orders] };
  }

  getOrderHistory(): OrderResult[] {
    return [...this.state.orders];
  }
}

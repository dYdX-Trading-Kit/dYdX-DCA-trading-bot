export type BotMode = 'live' | 'paper';

export type DydxNetwork = 'mainnet' | 'testnet';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit';

export type OrderStatus =
  | 'pending'
  | 'open'
  | 'closed'
  | 'canceled'
  | 'expired'
  | 'failed';

export interface TickerData {
  pair: string;
  ask: number;
  bid: number;
  last: number;
  volume24h: number;
  vwap24h: number;
  high24h: number;
  low24h: number;
  open24h: number;
  timestamp: number;
}

export interface Balance {
  currency: string;
  available: number;
  total: number;
  reserved?: number;
}

export interface OrderResult {
  orderId: string;
  pair: string;
  side: OrderSide;
  type: OrderType;
  volume: number;
  price: number;
  cost: number;
  fee: number;
  status: OrderStatus;
  timestamp: number;
  description?: string;
}

export interface DcaExecutionResult {
  success: boolean;
  order?: OrderResult;
  amountSpent: number;
  effectiveAmount: number;
  priceAtExecution: number;
  strategyReason: string;
  error?: string;
  timestamp: number;
}

export interface DcaState {
  totalInvested: number;
  totalVolumeAcquired: number;
  averagePrice: number;
  executionCount: number;
  dailySpent: number;
  dailySpentDate: string;
  lastExecutionAt: number | null;
  priceHistory: number[];
}

export interface BotStats {
  mode: BotMode;
  pair: string;
  network: DydxNetwork;
  state: DcaState;
  isRunning: boolean;
  nextScheduledRun: string | null;
  uptime: number;
}

export interface IExchangeClient {
  getTicker(pair: string): Promise<TickerData>;
  getBalance(currency: string): Promise<Balance>;
  placeMarketBuy(pair: string, amount: number): Promise<OrderResult>;
  validateOrder(pair: string, amount: number): Promise<boolean>;
  getCandles(pair: string, resolution?: string, limit?: number): Promise<number[]>;
}

export interface PerpetualMarketInfo {
  ticker: string;
  clobPairId: number;
  atomicResolution: number;
  stepBaseQuantums: number;
  subticksPerTick: number;
  quantumConversionExponent: number;
  minOrderSize: number;
  tickSize: number;
  oraclePrice: number;
}

export interface DydxCandle {
  startedAt: string;
  open: string;
  high: string;
  low: string;
  close: string;
  baseTokenVolume: string;
  usdVolume: string;
}

export interface DydxIndexerMarket {
  clobPairId: string;
  ticker: string;
  status: string;
  oraclePrice: string;
  priceChange24H: string;
  volume24H: string;
  trades24H: number;
  nextFundingRate: string;
  initialMarginFraction: string;
  maintenanceMarginFraction: string;
  openInterest: string;
  atomicResolution: number;
  quantumConversionExponent: number;
  tickSize: string;
  stepSize: string;
  stepBaseQuantums: number;
  subticksPerTick: number;
}

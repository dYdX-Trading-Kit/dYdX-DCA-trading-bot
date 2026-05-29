export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateMovingAverage(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, p) => acc + p, 0);
  return sum / slice.length;
}

export function calculatePercentChange(current: number, reference: number): number {
  if (reference === 0) return 0;
  return ((current - reference) / reference) * 100;
}

export function formatCurrency(amount: number, currency: string): string {
  const crypto = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'LINK'];
  const decimals = crypto.includes(currency.toUpperCase()) ? 8 : 2;
  return `${amount.toFixed(decimals)} ${currency}`;
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function parseMarketTicker(pair: string): { base: string; quote: string } {
  const normalized = pair.toUpperCase();
  if (normalized.includes('-')) {
    const [base, quote] = normalized.split('-');
    return { base: base ?? 'BTC', quote: quote ?? 'USD' };
  }
  return { base: normalized.slice(0, 3), quote: 'USD' };
}

/**
 * Convert USDC notional to base asset size for dYdX perpetual orders.
 */
export function usdcToBaseSize(usdcAmount: number, price: number): number {
  if (price <= 0) {
    throw new Error('Invalid price for size calculation');
  }
  return usdcAmount / price;
}

/**
 * Round order size down to step size to satisfy exchange constraints.
 */
export function roundToStepSize(size: number, stepSize: number): number {
  if (stepSize <= 0) return size;
  const steps = Math.floor(size / stepSize);
  return roundToDecimals(steps * stepSize, countDecimals(stepSize));
}

function countDecimals(value: number): number {
  const str = value.toString();
  const dotIndex = str.indexOf('.');
  return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
}

export function generateClientOrderId(): number {
  return Math.floor(Math.random() * 2_000_000_000);
}

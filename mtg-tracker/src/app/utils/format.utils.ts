/**
 * Centralized Currency & Math Format Utilities for Lorehold MTG Price Tracker
 */

export interface VariationResult {
  pct: number;
  text: string;
  isPositive: boolean;
  cssClass: 'variation-up' | 'variation-down' | 'variation-neutral';
}

/**
 * Formats a numeric price into Euro currency format '€123.45'.
 */
export function formatEuroCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return `€${val.toFixed(2)}`;
}

/**
 * Calculates percentage variation and returns formatted percentage string with sign.
 */
export function calculatePercentageVariation(
  initialPrice: number | null | undefined,
  currentPrice: number | null | undefined,
  context: 'buy' | 'sell' = 'buy'
): VariationResult {
  if (!initialPrice || !currentPrice || initialPrice <= 0) {
    return { pct: 0, text: '0.0%', isPositive: false, cssClass: 'variation-neutral' };
  }

  const diff = currentPrice - initialPrice;
  const pct = (diff / initialPrice) * 100;
  const text = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;

  // For buying: a price drop is positive (green / variation-down)
  // For selling: a price rise is positive (green / variation-up)
  if (context === 'buy') {
    const cssClass = diff < 0 ? 'variation-down' : (diff > 0 ? 'variation-up' : 'variation-neutral');
    return { pct, text, isPositive: diff < 0, cssClass };
  } else {
    const cssClass = diff > 0 ? 'variation-up' : (diff < 0 ? 'variation-down' : 'variation-neutral');
    return { pct, text, isPositive: diff > 0, cssClass };
  }
}

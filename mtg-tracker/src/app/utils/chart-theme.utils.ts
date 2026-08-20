// ============================================================================
// DYNAMIC CSS-DRIVEN CHART THEME UTILITIES
// Resolves colors strictly from CSS/SCSS Custom Properties (--chart-*)
// ============================================================================

/**
 * Reads a CSS variable value directly from document root styles.
 */
export function getCssThemeColor(variableName: string, fallback = ''): string {
  if (typeof window === 'undefined' || !window.document) {
    return fallback;
  }
  const val = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return val || fallback;
}

/**
 * Converts a hex or rgb/rgba CSS color string to rgba with a specified alpha.
 */
export function toAlphaColor(colorStr: string, alpha: number): string {
  const c = colorStr.trim();
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (c.startsWith('rgba(')) {
    return c.replace(/[\d\.]+\)$/, `${alpha})`);
  }
  if (c.startsWith('rgb(')) {
    return c.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  return c;
}

/**
 * Dynamic Chart Theme tokens resolved from CSS custom properties.
 */
export const CHART_THEME = {
  get colors() {
    return {
      primary: getCssThemeColor('--chart-primary'),
      primaryCyan: getCssThemeColor('--chart-cyan'),
      success: getCssThemeColor('--chart-success'),
      pink: getCssThemeColor('--chart-pink'),
      axisText: getCssThemeColor('--chart-axis-text'),
      axisTextDim: getCssThemeColor('--chart-axis-text-dim'),
      grid: getCssThemeColor('--chart-grid'),
      gridBorder: getCssThemeColor('--chart-grid-border')
    };
  },
  typography: {
    fontSize: 9,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  }
};

/**
 * Creates a linear gradient on a Canvas context using CSS variables and alpha blending.
 */
export function createThemeGradient(
  ctx: CanvasRenderingContext2D,
  variableName: string,
  startAlpha = 0.35,
  endAlpha = 0.0,
  height = 75
): CanvasGradient {
  const baseColor = getCssThemeColor(variableName);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, toAlphaColor(baseColor, startAlpha));
  gradient.addColorStop(1, toAlphaColor(baseColor, endAlpha));
  return gradient;
}

/**
 * Dynamic fallback color generator for chart backgrounds.
 */
export function getThemeAlphaColor(variableName: string, alpha: number): string {
  return toAlphaColor(getCssThemeColor(variableName), alpha);
}

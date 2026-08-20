// ============================================================================
// MARKET ANALYSIS DOMAIN MODELS & ENUMS
// ============================================================================

export enum InsightSeverity {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  NEUTRAL = 'NEUTRAL',
  WAIT = 'WAIT',
  WARNING = 'WARNING',
  AVOID = 'AVOID'
}

export enum ProductType {
  PLAY_BOOSTER = 'PLAY_BOOSTER',
  BUNDLE = 'BUNDLE',
  FAT_PACK = 'FAT_PACK',
  PRERELEASE = 'PRERELEASE',
  SECRET_LAIR = 'SECRET_LAIR',
  DRAFT_NIGHT = 'DRAFT_NIGHT'
}

export interface HistoricalPrice {
  date: Date | string;
  price: number;
}

export interface Product {
  currentPrice: number;
  launchDate: Date | string;
  releaseDate?: Date | string;
  historicalPrices: HistoricalPrice[];
  baseLaunchPrice: number;
  productType: ProductType;
}

export interface ProductState {
  currentPrice: number;
  baseLaunchPrice: number;
  daysSinceLaunch: number;
  historicalPrices: HistoricalPrice[];
  productType: ProductType;
}

export interface MarketInsight {
  severity: InsightSeverity;
  badgeText: string;
  message: string;
}

export interface MarketRecommendation {
  state: 'BUY' | 'WAIT' | 'AVOID';
  percentageOffset: number;
  message: string;
  badgeText: string;
}

export interface MarketAdviceSuggestion {
  label: string;
  explanation: string;
  icon: string;
  severity?: InsightSeverity;
}

export interface InsightMessageMap {
  ALL_TIME_LOW: string;
  FLASH_CRASH: string;
  GOOD_DEAL: string;
  IDEAL_WINDOW: string;
  DECLINING: string;
  STANDARD_PRICE: string;
  FOMO_SPIKE: string;
  EVENT_OVERPRICED: string;
  OUT_OF_STOCK: string;
  DEFAULT_WAIT: string;
  DEFAULT_BUY: string;
  DEFAULT_AVOID: string;
}

export interface PreorderMessageMap {
  PRODUCT_RELEASED: string;
  TOO_EARLY: string;
  PREORDER_NOW: string;
  PREORDER_NOW_TREND: string;
  UNDER_OBSERVATION: string;
  PRE_LAUNCH_SPIKE: string;
  MISSING_DATE: string;
  SECRET_LAIR_OK: string;
  SECRET_LAIR_SCALPER: string;
}

export interface BadgeTextMap {
  EVENT_OVERPRICED: string;
  OUT_OF_PRINT: string;
  FOMO_SPIKE: string;
  FLASH_CRASH: string;
  ALL_TIME_LOW: string;
  IDEAL_WINDOW: string;
  DECLINING: string;
  GOOD_DEAL: string;
  STANDARD_PRICE: string;
  MISSING_DATE: string;
  PRODUCT_RELEASED: string;
  PREORDER_OK: string;
  SCALPER_ALERT: string;
  TOO_EARLY: string;
  PREORDER_NOW: string;
  UNDER_OBSERVATION: string;
  PRE_LAUNCH_SPIKE: string;
}

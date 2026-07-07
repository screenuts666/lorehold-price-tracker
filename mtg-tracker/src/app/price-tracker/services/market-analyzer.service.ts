import { Injectable } from '@angular/core';

export enum ProductType {
  PLAY_BOOSTER = 'PLAY_BOOSTER',
  BUNDLE = 'BUNDLE',
  FAT_PACK = 'FAT_PACK',
  PRERELEASE = 'PRERELEASE',
  SECRET_LAIR = 'SECRET_LAIR',
  DRAFT_NIGHT = 'DRAFT_NIGHT'
}

export enum InsightSeverity {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  NEUTRAL = 'NEUTRAL',
  WAIT = 'WAIT',
  WARNING = 'WARNING',
  AVOID = 'AVOID'
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

export const INSIGHT_MESSAGES = {
  ALL_TIME_LOW: "The price has reached an all-time low since it has been tracked. Great time to buy, stock at this price might run out quickly.",
  FLASH_CRASH: "Sudden price drop detected! This might be a seller looking for quick liquidity. Buy immediately before it sells out.",
  GOOD_DEAL: "The market has absorbed the high initial printing. Price is stable and below average, purchase recommended.",
  IDEAL_WINDOW: "Bundles tend to rise in price after the first few months due to limited printing. Buy it now while stock is good.",
  DECLINING: "Classic post-launch 'Race to the bottom' effect. Sellers are lowering prices to compete. Wait, it might drop further.",
  STANDARD_PRICE: "The product is at its initial market price. If you are not in a hurry to crack packs, wait for the first price drops.",
  FOMO_SPIKE: "Warning: speculative spike due to FOMO (Fear Of Missing Out). The price is artificially inflated, avoid buying and wait for stabilization.",
  EVENT_OVERPRICED: "Overpriced for a Prerelease Pack. Store owners generally sell them off near or immediately after the event. Do not buy.",
  OUT_OF_STOCK: "The product is now out of print (OOP) and remaining sellers are charging a premium for scarcity. Avoid buying unless for specific collecting.",
  DEFAULT_WAIT: "Price is stable. Recommended to wait for further market fluctuations.",
  DEFAULT_BUY: "Competitive price compared to launch. Purchase recommended.",
  DEFAULT_AVOID: "High price compared to initial launch. Recommended to avoid purchasing at this time."
};

export const PREORDER_MESSAGES = {
  PRODUCT_RELEASED: "The preorder period has ended. Apply normal post-launch market logic.",
  TOO_EARLY: "Preorders just opened. Prices are inflated by initial hype and uncertain allocations. Wait for the price war among stores.",
  PREORDER_NOW: "Golden pre-launch window! Stores are cutting prices to pay distributors. Buy now before release week FOMO kickstarts.",
  PREORDER_NOW_TREND: "Golden pre-launch window with confirmed falling price trend! Stores are cutting prices. Buy now, the trend is in your favor.",
  UNDER_OBSERVATION: "We are in the pre-launch devaluation window, but the price has not hit the ideal target yet. Check daily.",
  PRE_LAUNCH_SPIKE: "Cheap preorder stock is gone. The price is rising due to last-minute FOMO. If you haven't preordered, wait for post-launch stabilization.",
  MISSING_DATE: "Enter the release date of the set to unlock market analysis.",
  SECRET_LAIR_OK: "Price is in line with the official WotC drop, calculating shipping fees. Fair preorder.",
  SECRET_LAIR_SCALPER: "Price inflated by scalpers even before shipping. If possible, buy on the official WotC site or ignore."
};

@Injectable({
  providedIn: 'root'
})
export class MarketAnalyzerService {

  constructor() { }

  /**
   * Analyzes a product's price history and returns a market recommendation.
   * @param product The product to analyze.
   */
  analyzeMarket(product: Product): MarketRecommendation {
    const currentPrice = product.currentPrice;
    const baseLaunchPrice = product.baseLaunchPrice;
    
    // Calculates percentage offset from base launch price
    const percentageOffset = baseLaunchPrice > 0 
      ? ((currentPrice - baseLaunchPrice) / baseLaunchPrice) * 100 
      : 0;

    const launchDateObj = new Date(product.launchDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - launchDateObj.getTime());
    const daysSinceLaunch = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const productState: ProductState = {
      currentPrice: currentPrice,
      baseLaunchPrice: baseLaunchPrice,
      daysSinceLaunch: daysSinceLaunch,
      historicalPrices: product.historicalPrices || [],
      productType: product.productType
    };

    const insight = this.getInsightForProduct(productState);

    let recommendationState: 'BUY' | 'WAIT' | 'AVOID' = 'WAIT';
    if (insight.severity === InsightSeverity.STRONG_BUY || insight.severity === InsightSeverity.BUY) {
      recommendationState = 'BUY';
    } else if (insight.severity === InsightSeverity.AVOID || insight.severity === InsightSeverity.WARNING) {
      recommendationState = 'AVOID';
    }

    return {
      state: recommendationState,
      percentageOffset: percentageOffset,
      message: insight.message,
      badgeText: insight.badgeText
    };
  }

  /**
   * Generates a MarketInsight based on product state.
   */
  getInsightForProduct(productState: ProductState): MarketInsight {
    const currentPrice = productState.currentPrice;
    const baseLaunchPrice = productState.baseLaunchPrice;
    const daysSinceLaunch = productState.daysSinceLaunch;
    const historicalPrices = productState.historicalPrices || [];

    const initialPrice = historicalPrices.length > 0 ? historicalPrices[0].price : currentPrice;
    const minHistoricalPrice = historicalPrices.length > 0
      ? Math.min(...historicalPrices.map(p => p.price))
      : currentPrice;

    // Hard caps (AVOID)
    if (productState.productType === ProductType.PRERELEASE && currentPrice > 32) {
      return {
        severity: InsightSeverity.AVOID,
        badgeText: 'EVENT OVERPRICED',
        message: INSIGHT_MESSAGES.EVENT_OVERPRICED
      };
    }

    if (productState.productType === ProductType.BUNDLE && currentPrice > 50) {
      return {
        severity: InsightSeverity.AVOID,
        badgeText: 'OUT OF PRINT',
        message: INSIGHT_MESSAGES.OUT_OF_STOCK
      };
    }

    if (productState.productType === ProductType.SECRET_LAIR
        && daysSinceLaunch <= 7
        && baseLaunchPrice > 0
        && currentPrice > baseLaunchPrice * 1.15) {
      return {
        severity: InsightSeverity.AVOID,
        badgeText: 'FOMO SPIKE',
        message: INSIGHT_MESSAGES.FOMO_SPIKE
      };
    }

    // Flash Crash
    if (historicalPrices.length >= 2 && this.checkFlashCrash(historicalPrices, currentPrice)) {
      return {
        severity: InsightSeverity.STRONG_BUY,
        badgeText: 'FLASH CRASH',
        message: INSIGHT_MESSAGES.FLASH_CRASH
      };
    }

    // All-time low
    const hasRichHistory = historicalPrices.length >= 3 && daysSinceLaunch >= 3;
    const isActuallyLower = currentPrice < initialPrice * 0.99;

    if (hasRichHistory && isActuallyLower && currentPrice <= minHistoricalPrice * 1.005) {
      return {
        severity: InsightSeverity.STRONG_BUY,
        badgeText: 'ALL-TIME LOW',
        message: INSIGHT_MESSAGES.ALL_TIME_LOW
      };
    }

    // Product specific rules
    if (productState.productType === ProductType.BUNDLE && currentPrice <= 42 && daysSinceLaunch <= 60) {
      return {
        severity: InsightSeverity.BUY,
        badgeText: 'IDEAL WINDOW',
        message: INSIGHT_MESSAGES.IDEAL_WINDOW
      };
    }

    if (productState.productType === ProductType.PLAY_BOOSTER
        && daysSinceLaunch >= 30
        && daysSinceLaunch <= 60
        && this.checkPlayBoosterDecline(historicalPrices)) {
      return {
        severity: InsightSeverity.WAIT,
        badgeText: 'DECLINING (WAIT)',
        message: INSIGHT_MESSAGES.DECLINING
      };
    }

    // Good deal fallback
    if (daysSinceLaunch > 90 && currentPrice <= baseLaunchPrice * 0.90) {
      return {
        severity: InsightSeverity.BUY,
        badgeText: 'GOOD DEAL',
        message: INSIGHT_MESSAGES.GOOD_DEAL
      };
    }

    return {
      severity: InsightSeverity.WAIT,
      badgeText: 'STANDARD PRICE',
      message: INSIGHT_MESSAGES.STANDARD_PRICE
    };
  }

  private checkFlashCrash(historicalPrices: HistoricalPrice[], currentPrice: number): boolean {
    if (!historicalPrices || historicalPrices.length < 2) return false;

    const sorted = [...historicalPrices].map(p => ({
      price: p.price,
      time: new Date(p.date).getTime()
    })).sort((a, b) => b.time - a.time);

    const latestTime = sorted[0].time;
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    for (const point of sorted) {
      if (latestTime - point.time > fortyEightHoursMs) break;
      if (point.price > currentPrice && ((point.price - currentPrice) / point.price) > 0.15) {
        return true;
      }
    }

    return false;
  }

  private checkPlayBoosterDecline(historicalPrices: HistoricalPrice[]): boolean {
    if (!historicalPrices || historicalPrices.length < 2) return true;
    const sorted = [...historicalPrices].map(p => p.price);
    const len = sorted.length;
    return sorted[len - 1] <= sorted[0];
  }

  private readonly PREORDER_TARGETS: Record<string, number> = {
    [ProductType.PLAY_BOOSTER]: 118,
    [ProductType.FAT_PACK]:     42,
    [ProductType.BUNDLE]:       42,
    [ProductType.DRAFT_NIGHT]:  95,
    [ProductType.PRERELEASE]:   26,
    [ProductType.SECRET_LAIR]:  9999
  };

  /**
   * Analyzes the preorder phase of a sealed product.
   */
  analyzePreorderPhase(product: Product): MarketInsight {
    if (!product.releaseDate || isNaN(new Date(product.releaseDate).getTime())) {
      return {
        severity: InsightSeverity.NEUTRAL,
        badgeText: 'MISSING DATE',
        message: PREORDER_MESSAGES.MISSING_DATE
      };
    }

    const now = new Date();
    const releaseDate = new Date(product.releaseDate);
    const diffMs = releaseDate.getTime() - now.getTime();
    const daysToRelease = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysToRelease <= 0) {
      return {
        severity: InsightSeverity.NEUTRAL,
        badgeText: 'PRODUCT RELEASED',
        message: PREORDER_MESSAGES.PRODUCT_RELEASED
      };
    }

    if (product.productType === ProductType.SECRET_LAIR) {
      if (product.currentPrice <= 115) {
        return {
          severity: InsightSeverity.BUY,
          badgeText: 'PREORDER OK',
          message: PREORDER_MESSAGES.SECRET_LAIR_OK
        };
      }
      return {
        severity: InsightSeverity.AVOID,
        badgeText: 'SCALPER ALERT',
        message: PREORDER_MESSAGES.SECRET_LAIR_SCALPER
      };
    }

    if (daysToRelease > 40) {
      return {
        severity: InsightSeverity.WARNING,
        badgeText: 'TOO EARLY',
        message: PREORDER_MESSAGES.TOO_EARLY
      };
    }

    if (daysToRelease >= 15 && daysToRelease <= 40) {
      const targetPrice = this.PREORDER_TARGETS[product.productType] ?? 9999;

      if (product.currentPrice <= targetPrice) {
        const trendDown = this.checkRecentTrendDown(product.historicalPrices, 3);

        return {
          severity: InsightSeverity.STRONG_BUY,
          badgeText: 'PREORDER NOW',
          message: trendDown
            ? PREORDER_MESSAGES.PREORDER_NOW_TREND
            : PREORDER_MESSAGES.PREORDER_NOW
        };
      }

      return {
        severity: InsightSeverity.WAIT,
        badgeText: 'UNDER OBSERVATION',
        message: PREORDER_MESSAGES.UNDER_OBSERVATION
      };
    }

    return {
      severity: InsightSeverity.AVOID,
      badgeText: 'PRE-LAUNCH SPIKE',
      message: PREORDER_MESSAGES.PRE_LAUNCH_SPIKE
    };
  }

  private checkRecentTrendDown(historicalPrices: HistoricalPrice[], lookbackDays: number = 3): boolean {
    if (!historicalPrices || historicalPrices.length < 2) return false;

    const now = new Date();
    const cutoffMs = lookbackDays * 24 * 60 * 60 * 1000;

    const sorted = [...historicalPrices].map(p => ({
      price: p.price,
      time: new Date(p.date).getTime()
    })).sort((a, b) => a.time - b.time);

    const nowMs = now.getTime();
    const recentPrices: number[] = [];
    const olderPrices: number[] = [];

    for (const point of sorted) {
      if (nowMs - point.time <= cutoffMs) {
        recentPrices.push(point.price);
      } else {
        olderPrices.push(point.price);
      }
    }

    if (recentPrices.length === 0 || olderPrices.length === 0) {
      if (sorted.length >= 2) {
        return sorted[sorted.length - 1].price < sorted[sorted.length - 2].price;
      }
      return false;
    }

    const avgRecent = recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length;
    const avgOlder = olderPrices.reduce((s, p) => s + p, 0) / olderPrices.length;

    return avgRecent < avgOlder;
  }
}

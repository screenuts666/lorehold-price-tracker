import { Injectable } from '@angular/core';

export enum ProductType {
  PLAY_BOOSTER = 'PLAY_BOOSTER',
  BUNDLE = 'BUNDLE',
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
  stato: 'BUY' | 'WAIT' | 'AVOID';
  scostamentoPercentuale: number;
  messaggio: string;
  badgeText: string;
}

// Costanti per le descrizioni dei consigli (facilmente localizzabili)
export const INSIGHT_MESSAGES = {
  MINIMO_STORICO: "Il prezzo ha toccato il minimo storico da quando è monitorato. Ottimo momento per l'acquisto, le scorte a questo prezzo potrebbero esaurirsi a breve.",
  FLASH_CRASH: "Crollo improvviso del prezzo rilevato! Potrebbe trattarsi di un venditore che necessita di liquidità. Da comprare subitissimo prima che venga venduto.",
  BUON_AFFARE: "Il mercato ha assorbito l'alta tiratura iniziale. Il prezzo è stabile e sotto la media, acquisto consigliato.",
  FINESTRA_IDEALE: "I Bundle tendono a salire di prezzo dopo i primi mesi a causa della stampa limitata. Acquistalo ora finché le scorte sono buone.",
  IN_CALO: "Classico effetto 'Race to the bottom' post-lancio. I venditori stanno abbassando i prezzi per competere. Attendi, potrebbe scendere ancora.",
  PREZZO_STANDARD: "Il prodotto è al suo prezzo di mercato iniziale. Se non hai urgenza di sbustare, attendi le prime svalutazioni.",
  PICCO_FOMO: "Attenzione: picco speculativo dovuto alla FOMO (Fear Of Missing Out). Il prezzo è gonfiato artificialmente, evita l'acquisto e attendi l'assestamento.",
  SOVRAPPREZZO_EVENTO: "Prezzo fuori mercato per un Prerelease Pack. Generalmente vengono svenduti dai negozianti a ridosso o subito dopo l'evento per recuperare liquidità. Non comprare.",
  SCORTE_ESAURITE: "Il prodotto è ormai fuori stampa (Out of Print) e i venditori rimasti applicano un sovrapprezzo per la scarsità. Evita l'acquisto a meno di collezionismo specifico.",
  DEFAULT_WAIT: "Prezzo stabile. Si raccomanda di attendere ulteriori oscillazioni di mercato.",
  DEFAULT_BUY: "Prezzo competitivo rispetto al lancio. Si consiglia l'acquisto.",
  DEFAULT_AVOID: "Prezzo elevato rispetto al lancio iniziale. Si consiglia di evitarne l'acquisto al momento."
};

@Injectable({
  providedIn: 'root'
})
export class MarketAnalyzerService {

  constructor() { }

  /**
   * Analizza lo storico prezzi di un prodotto e restituisce una raccomandazione di mercato.
   * @param product Il prodotto da analizzare.
   */
  analyzeMarket(product: Product): MarketRecommendation {
    const currentPrice = product.currentPrice;
    const baseLaunchPrice = product.baseLaunchPrice;
    
    // Calcola lo scostamento percentuale dal prezzo di lancio base
    const scostamentoPercentuale = baseLaunchPrice > 0 
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

    // Mappa la severity all'enum dello stato consigliato per l'acquisto
    let recommendationStato: 'BUY' | 'WAIT' | 'AVOID' = 'WAIT';
    if (insight.severity === InsightSeverity.STRONG_BUY || insight.severity === InsightSeverity.BUY) {
      recommendationStato = 'BUY';
    } else if (insight.severity === InsightSeverity.AVOID || insight.severity === InsightSeverity.WARNING) {
      recommendationStato = 'AVOID';
    }

    return {
      stato: recommendationStato,
      scostamentoPercentuale: scostamentoPercentuale,
      messaggio: insight.message,
      badgeText: insight.badgeText
    };
  }

  /**
   * Genera un oggetto MarketInsight basato sullo stato del prodotto.
   * Gerarchia di priorità:
   *   1. AVOID (tetti massimi assoluti per tipo prodotto) — bloccano tutto il resto
   *   2. FLASH CRASH (calo >15% in <48h)
   *   3. MINIMO STORICO (guard: ≥3 punti, ≥3 giorni, prezzo realmente sceso)
   *   4. Regole BUY per tipo prodotto + finestra temporale
   *   5. BUON AFFARE generico dopo 90 giorni
   *   6. Fallback → PREZZO STANDARD
   */
  getInsightForProduct(productState: ProductState): MarketInsight {
    const currentPrice = productState.currentPrice;
    const baseLaunchPrice = productState.baseLaunchPrice;
    const daysSinceLaunch = productState.daysSinceLaunch;
    const historicalPrices = productState.historicalPrices || [];

    const scostamentoPercentuale = baseLaunchPrice > 0
      ? ((currentPrice - baseLaunchPrice) / baseLaunchPrice) * 100
      : 0;

    const prezzoIniziale = historicalPrices.length > 0 ? historicalPrices[0].price : currentPrice;
    const minHistoricalPrice = historicalPrices.length > 0
      ? Math.min(...historicalPrices.map(p => p.price))
      : currentPrice;

    // ═══════════════════════════════════════════════════════════
    // HARD CAP — AVOID: soglie massime assolute per tipo prodotto
    // Si attivano IMMEDIATAMENTE in base al solo prezzo, PRIMA
    // di qualsiasi check su storico, trend o giorni dal lancio.
    // ═══════════════════════════════════════════════════════════

    // Prerelease Pack > €32 → fuori mercato, a prescindere da tutto
    if (productState.productType === ProductType.PRERELEASE && currentPrice > 32) {
      return {
        severity: InsightSeverity.AVOID,
        badgeText: 'SOVRAPPREZZO EVENTO',
        message: INSIGHT_MESSAGES.SOVRAPPREZZO_EVENTO
      };
    }

    // Bundle/Fat Pack > €50 → fuori mercato, a prescindere da tutto
    if (productState.productType === ProductType.BUNDLE && currentPrice > 50) {
      return {
        severity: InsightSeverity.AVOID,
        badgeText: 'SCORTE ESAURITE',
        message: INSIGHT_MESSAGES.SCORTE_ESAURITE
      };
    }

    // Secret Lair: picco FOMO >15% nella prima settimana
    if (productState.productType === ProductType.SECRET_LAIR
        && daysSinceLaunch <= 7
        && baseLaunchPrice > 0
        && currentPrice > baseLaunchPrice * 1.15) {
      return {
        severity: InsightSeverity.AVOID,
        badgeText: 'PICCO FOMO',
        message: INSIGHT_MESSAGES.PICCO_FOMO
      };
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITÀ 2 — FLASH CRASH: calo >15% in <48h (richiede storico)
    // ═══════════════════════════════════════════════════════════
    if (historicalPrices.length >= 2 && this.checkFlashCrash(historicalPrices, currentPrice)) {
      return {
        severity: InsightSeverity.STRONG_BUY,
        badgeText: 'FLASH CRASH',
        message: INSIGHT_MESSAGES.FLASH_CRASH
      };
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITÀ 3 — MINIMO STORICO con guard clause rigorosa:
    //   a) ≥3 punti storici registrati
    //   b) ≥3 giorni di monitoraggio (non è il Giorno 0)
    //   c) prezzo sceso ≥1% rispetto al primo rilevamento
    //   d) prezzo attuale ≤ minimo storico (tolleranza 0.5%)
    // ═══════════════════════════════════════════════════════════
    const hasRichHistory = historicalPrices.length >= 3 && daysSinceLaunch >= 3;
    const isActuallyLower = currentPrice < prezzoIniziale * 0.99;

    if (hasRichHistory && isActuallyLower && currentPrice <= minHistoricalPrice * 1.005) {
      return {
        severity: InsightSeverity.STRONG_BUY,
        badgeText: 'MINIMO STORICO',
        message: INSIGHT_MESSAGES.MINIMO_STORICO
      };
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITÀ 4 — REGOLE BUY per tipo prodotto + finestra temporale
    // ═══════════════════════════════════════════════════════════

    // Bundle: finestra ideale sotto €42 entro i primi 2 mesi
    if (productState.productType === ProductType.BUNDLE && currentPrice <= 42 && daysSinceLaunch <= 60) {
      return {
        severity: InsightSeverity.BUY,
        badgeText: 'FINESTRA IDEALE',
        message: INSIGHT_MESSAGES.FINESTRA_IDEALE
      };
    }

    // Play Booster: race-to-the-bottom nei giorni 30–60 con trend in calo
    if (productState.productType === ProductType.PLAY_BOOSTER
        && daysSinceLaunch >= 30
        && daysSinceLaunch <= 60
        && this.checkPlayBoosterDecline(historicalPrices)) {
      return {
        severity: InsightSeverity.WAIT,
        badgeText: 'IN CALO (ATTENDI)',
        message: INSIGHT_MESSAGES.IN_CALO
      };
    }

    // ═══════════════════════════════════════════════════════════
    // PRIORITÀ 5 — BUON AFFARE generico: -10% dal lancio dopo 90gg
    // ═══════════════════════════════════════════════════════════
    if (daysSinceLaunch > 90 && scostamentoPercentuale <= -10) {
      return {
        severity: InsightSeverity.BUY,
        badgeText: 'BUON AFFARE',
        message: INSIGHT_MESSAGES.BUON_AFFARE
      };
    }

    // ═══════════════════════════════════════════════════════════
    // FALLBACK SICURO — storico piatto, prodotto appena inserito,
    // nessuna regola soddisfatta → PREZZO STANDARD (WAIT)
    // ═══════════════════════════════════════════════════════════
    return {
      severity: InsightSeverity.WAIT,
      badgeText: 'PREZZO STANDARD',
      message: INSIGHT_MESSAGES.PREZZO_STANDARD
    };
  }

  /**
   * Rileva se si è verificato un calo improvviso del prezzo superiore al 15% in meno di 48 ore.
   */
  private checkFlashCrash(historicalPrices: HistoricalPrice[], currentPrice: number): boolean {
    if (!historicalPrices || historicalPrices.length < 2) return false;

    // Ordina i punti storici per data decrescente (più recente all'inizio)
    const sorted = [...historicalPrices].map(p => ({
      price: p.price,
      time: new Date(p.date).getTime()
    })).sort((a, b) => b.time - a.time);

    const latestTime = sorted[0].time;
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    for (const point of sorted) {
      // Se andiamo oltre le 48 ore di distanza dall'ultimo rilevamento, ci fermiamo
      if (latestTime - point.time > fortyEightHoursMs) break;

      // Se il prezzo precedente era maggiore del prezzo attuale di oltre il 15%
      if (point.price > currentPrice && ((point.price - currentPrice) / point.price) > 0.15) {
        return true;
      }
    }

    return false;
  }

  /**
   * Rileva se un Play Booster ha un trend generale in calo.
   */
  private checkPlayBoosterDecline(historicalPrices: HistoricalPrice[]): boolean {
    if (!historicalPrices || historicalPrices.length < 2) return true;
    const sorted = [...historicalPrices].map(p => p.price);
    const len = sorted.length;
    // Se l'ultimo prezzo rilevato è inferiore all'iniziale, confermiamo il calo post-lancio
    return sorted[len - 1] <= sorted[0];
  }
}

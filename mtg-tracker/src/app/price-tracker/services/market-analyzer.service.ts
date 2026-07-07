import { Injectable } from '@angular/core';

export enum ProductType {
  PLAY_BOOSTER = 'PLAY_BOOSTER',
  BUNDLE = 'BUNDLE',
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
  historicalPrices: HistoricalPrice[];
  baseLaunchPrice: number;
  productType: ProductType;
}

export interface MarketRecommendation {
  stato: 'BUY' | 'WAIT' | 'AVOID';
  scostamentoPercentuale: number;
  messaggio: string;
}

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

    // Determina il minimo storico registrato nell'array dello storico prezzi
    const historicalPrices = product.historicalPrices || [];
    const minHistoricalPrice = historicalPrices.length > 0
      ? Math.min(...historicalPrices.map(p => p.price))
      : currentPrice;

    switch (product.productType) {
      case ProductType.PLAY_BOOSTER:
        return this.analyzePlayBooster(currentPrice, baseLaunchPrice, daysSinceLaunch, minHistoricalPrice, scostamentoPercentuale);

      case ProductType.BUNDLE:
        return this.analyzeBundle(currentPrice, baseLaunchPrice, daysSinceLaunch, historicalPrices, scostamentoPercentuale);

      case ProductType.PRERELEASE:
        return this.analyzePrerelease(currentPrice, baseLaunchPrice, daysSinceLaunch, scostamentoPercentuale);

      case ProductType.SECRET_LAIR:
        return this.analyzeSecretLair(currentPrice, baseLaunchPrice, daysSinceLaunch, scostamentoPercentuale);

      case ProductType.DRAFT_NIGHT:
        return this.analyzeDraftNight(currentPrice, baseLaunchPrice, daysSinceLaunch, historicalPrices, scostamentoPercentuale);

      default:
        return {
          stato: 'WAIT',
          scostamentoPercentuale,
          messaggio: 'Tipo di prodotto non riconosciuto. Monitoraggio standard attivo.'
        };
    }
  }

  // --- LOGICA PLAY BOOSTER ---
  private analyzePlayBooster(
    currentPrice: number,
    baseLaunchPrice: number,
    daysSinceLaunch: number,
    minHistoricalPrice: number,
    scostamentoPercentuale: number
  ): MarketRecommendation {
    // Evita: primi 14 giorni a meno che non sia sotto i €110
    if (daysSinceLaunch <= 14 && currentPrice >= 110) {
      return {
        stato: 'AVOID',
        scostamentoPercentuale,
        messaggio: `Prodotto nei primi 14 giorni dal lancio (${daysSinceLaunch}gg). Il prezzo attuale di €${currentPrice.toFixed(2)} non è ancora assestato.`
      };
    }

    // Compra Ora: se siamo tra 90 e 150 giorni e prezzo < €115, OPPURE prezzo <= minimo storico
    const isWithinOptimalWindow = daysSinceLaunch > 90 && daysSinceLaunch < 150;
    const isUnderThreshold = currentPrice < 115;
    const isAtHistoricalMin = currentPrice <= minHistoricalPrice;

    if ((isWithinOptimalWindow && isUnderThreshold) || isAtHistoricalMin) {
      let msg = '';
      if (isAtHistoricalMin) {
        msg = `Minimo storico locale per Play Booster raggiunto (€${currentPrice.toFixed(2)}). `;
      }
      if (isWithinOptimalWindow && isUnderThreshold) {
        msg += `Finestra ottimale post-lancio raggiunta (${daysSinceLaunch}gg) con prezzo sotto la soglia critica (€${currentPrice.toFixed(2)} < €115).`;
      }
      return {
        stato: 'BUY',
        scostamentoPercentuale,
        messaggio: msg.trim()
      };
    }

    // Altrimenti: Wait
    return {
      stato: 'WAIT',
      scostamentoPercentuale,
      messaggio: `Play Booster in fase di assestamento. Giorni dal lancio: ${daysSinceLaunch}. Attendi la finestra dei 90-120 giorni per il race to the bottom.`
    };
  }

  // --- LOGICA BUNDLE ---
  private analyzeBundle(
    currentPrice: number,
    baseLaunchPrice: number,
    daysSinceLaunch: number,
    historicalPrices: HistoricalPrice[],
    scostamentoPercentuale: number
  ): MarketRecommendation {
    // Evita: prezzo superiore del 20% rispetto al prezzo base di lancio
    if (currentPrice > baseLaunchPrice * 1.20) {
      return {
        stato: 'AVOID',
        scostamentoPercentuale,
        messaggio: `Prezzo fuori mercato per speculazione! Supera del 20% il valore di lancio (€${currentPrice.toFixed(2)} > €${(baseLaunchPrice * 1.2).toFixed(2)}).`
      };
    }

    // Calcola il prezzo medio degli ultimi 30 giorni
    const nowTime = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const last30DaysPrices = historicalPrices
      .filter(p => {
        const time = new Date(p.date).getTime();
        return (nowTime - time) <= thirtyDaysMs;
      })
      .map(p => p.price);

    const average30Days = last30DaysPrices.length > 0
      ? last30DaysPrices.reduce((acc, p) => acc + p, 0) / last30DaysPrices.length
      : baseLaunchPrice;

    // Compra Ora: prezzo <= €42 entro i primi 3 mesi, o inferiore alla media degli ultimi 30 giorni
    const isUnderLaunchCap = currentPrice <= 42 && daysSinceLaunch <= 90;
    const isUnder30DayAverage = last30DaysPrices.length > 0 && currentPrice < average30Days;

    if (isUnderLaunchCap || isUnder30DayAverage) {
      let msg = '';
      if (isUnderLaunchCap) {
        msg = `Ottimo prezzo d'acquisto per Bundle (€${currentPrice.toFixed(2)} <= €42) nei primi 3 mesi di rilascio (${daysSinceLaunch}gg).`;
      } else {
        msg = `Prezzo d'acquisto conveniente (€${currentPrice.toFixed(2)}) poiché inferiore alla media degli ultimi 30 giorni (€${average30Days.toFixed(2)}).`;
      }
      return {
        stato: 'BUY',
        scostamentoPercentuale,
        messaggio: msg
      };
    }

    // Altrimenti: Wait
    return {
      stato: 'WAIT',
      scostamentoPercentuale,
      messaggio: `Prezzo stabile per il Bundle. Finestra ottimale consigliata: 30-60 giorni post-lancio (attualmente: ${daysSinceLaunch}gg).`
    };
  }

  // --- LOGICA PRERELEASE PACK ---
  private analyzePrerelease(
    currentPrice: number,
    baseLaunchPrice: number,
    daysSinceLaunch: number,
    scostamentoPercentuale: number
  ): MarketRecommendation {
    // Evita: prezzo > €32
    if (currentPrice > 32) {
      return {
        stato: 'AVOID',
        scostamentoPercentuale,
        messaggio: `Kit fuori mercato post-evento! Il prezzo di €${currentPrice.toFixed(2)} supera la soglia massima consigliata di €32.`
      };
    }

    // Compra Ora: prezzo <= €25
    if (currentPrice <= 25) {
      return {
        stato: 'BUY',
        scostamentoPercentuale,
        messaggio: `Prezzo eccellente per Prerelease Pack (€${currentPrice.toFixed(2)} <= €25). Ottimo affare da svendita post-evento.`
      };
    }

    // Altrimenti: Wait
    return {
      stato: 'WAIT',
      scostamentoPercentuale,
      messaggio: `Prezzo in fase di svalutazione fisiologica. Consigliabile attendere la finestra ottimale tra i 14 e i 30 giorni post-evento (ora: ${daysSinceLaunch}gg).`
    };
  }

  // --- LOGICA SECRET LAIR BUNDLE ---
  private analyzeSecretLair(
    currentPrice: number,
    baseLaunchPrice: number,
    daysSinceLaunch: number,
    scostamentoPercentuale: number
  ): MarketRecommendation {
    // Attendi: spike > 10% nella prima settimana
    if (daysSinceLaunch <= 7 && currentPrice >= baseLaunchPrice * 1.10) {
      return {
        stato: 'WAIT',
        scostamentoPercentuale,
        messaggio: `Forte picco speculativo (FOMO) registrato nella prima settimana post-lancio (+${scostamentoPercentuale.toFixed(1)}%). Si consiglia di attendere.`
      };
    }

    // Compra Ora: solo se il prezzo attuale è <= prezzo lancio ufficiale
    if (currentPrice <= baseLaunchPrice) {
      return {
        stato: 'BUY',
        scostamentoPercentuale,
        messaggio: `Ottimo momento per comprare! Secret Lair offerto a prezzo ufficiale di lancio o inferiore (€${currentPrice.toFixed(2)} <= €${baseLaunchPrice.toFixed(2)}).`
      };
    }

    // Altrimenti: Wait (consigliato attendere almeno 6 mesi per assestamento post-FOMO)
    return {
      stato: 'WAIT',
      scostamentoPercentuale,
      messaggio: `Prodotto Secret Lair oltre il prezzo di costo. Si consiglia di attendere almeno 6 mesi per l'assestamento speculativo (attualmente: ${daysSinceLaunch}gg).`
    };
  }

  // --- LOGICA DRAFT NIGHT ---
  private analyzeDraftNight(
    currentPrice: number,
    baseLaunchPrice: number,
    daysSinceLaunch: number,
    historicalPrices: HistoricalPrice[],
    scostamentoPercentuale: number
  ): MarketRecommendation {
    // Compra Ora: calo continuo per 3 settimane consecutive (21gg) e prezzo <= €90
    const isUnderThreshold = currentPrice <= 90;
    const hasThreeWeeksDecline = this.checkThreeWeeksDecline(historicalPrices, currentPrice);

    if (isUnderThreshold && hasThreeWeeksDecline) {
      return {
        stato: 'BUY',
        scostamentoPercentuale,
        messaggio: `Segnale di acquisto forte! Rilevato un calo continuo per 3 settimane consecutive e prezzo sotto la soglia critica (€${currentPrice.toFixed(2)} <= €90).`
      };
    }

    // Altrimenti: Wait
    return {
      stato: 'WAIT',
      scostamentoPercentuale,
      messaggio: `Draft Night stabile o in oscillazione. Consigliato attendere calo continuo su 3 settimane consecutive e prezzo sotto i €90.`
    };
  }

  /**
   * Controlla se c'è una decrescita continua del prezzo medio/rappresentativo
   * nelle ultime 3 settimane (21 giorni) rispetto alla data attuale.
   */
  private checkThreeWeeksDecline(historicalPrices: HistoricalPrice[], currentPrice: number): boolean {
    if (!historicalPrices || historicalPrices.length < 3) return false;

    // Ordina i punti storici per data crescente
    const sorted = [...historicalPrices].map(p => ({
      price: p.price,
      time: new Date(p.date).getTime()
    })).sort((a, b) => a.time - b.time);

    const nowTime = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Definiamo i 3 intervalli settimanali arretrati rispetto ad oggi:
    // W1: da 0 a 7 giorni fa (settimana corrente/ultima)
    // W2: da 8 a 14 giorni fa (settimana precedente)
    // W3: da 15 a 21 giorni fa (due settimane fa)
    const w1 = sorted.filter(p => (nowTime - p.time) <= 7 * dayMs);
    const w2 = sorted.filter(p => (nowTime - p.time) > 7 * dayMs && (nowTime - p.time) <= 14 * dayMs);
    const w3 = sorted.filter(p => (nowTime - p.time) > 14 * dayMs && (nowTime - p.time) <= 21 * dayMs);

    const getAverage = (points: typeof sorted) => points.reduce((acc, curr) => acc + curr.price, 0) / points.length;

    if (w1.length > 0 && w2.length > 0 && w3.length > 0) {
      const avgW1 = getAverage(w1);
      const avgW2 = getAverage(w2);
      const avgW3 = getAverage(w3);

      // Calo costante: il prezzo scende da due settimane fa (W3), alla scorsa settimana (W2), a questa settimana (W1)
      return avgW3 > avgW2 && avgW2 > avgW1;
    }

    // Se non ci sono punti raggruppabili perfettamente per settimana, facciamo un fallback
    // confrontando gli ultimi 3 punti rilevati distanziati temporalmente di almeno qualche giorno
    const len = sorted.length;
    if (len >= 3) {
      const p1 = sorted[len - 1]; // Più recente
      const p2 = sorted[len - 2];
      const p3 = sorted[len - 3]; // Più vecchio

      // Assicuriamoci che i punti siano distribuiti su un arco temporale di almeno 10-15 giorni complessivi
      const totalTimeSpan = p1.time - p3.time;
      if (totalTimeSpan >= 10 * dayMs) {
        return p3.price > p2.price && p2.price > p1.price;
      }
    }

    return false;
  }
}

import { Injectable, signal, computed } from '@angular/core';

export type SupportedLanguage = 'it' | 'en';

export interface Translations {
  HUB_TAB: string;
  SEALED_TAB: string;
  BARGAINS_TAB: string;
  CLOUD_SCAN: string;
  SEARCH_EXP: string;
  SEARCH_SEALED: string;
  MIN_PRICE: string;
  MAX_PRICE: string;
  ALL_EXPANSIONS: string;
  ALL_TYPES: string;
  ALL_VERDICTS: string;
  SHOW_SCENE_BOXES: string;
  SHOW_COMMANDER_DECKS: string;
  SHOW_STARTER_DECKS: string;
  BARGAIN_THRESHOLDS: string;
  PRERELEASE_THRESHOLD: string;
  PLAYBOX_THRESHOLD: string;
  COLLECTOR_THRESHOLD: string;
  UPCOMING_EXPANSIONS: string;
  EXPANSION_SUBTITLE: string;
  STATUS_ALL: string;
  STATUS_PREORDER: string;
  STATUS_RELEASED: string;
  TIME_3M: string;
  TIME_6M: string;
  TIME_1Y: string;
  TIME_ALL: string;
  SORT_DATE_DESC: string;
  SORT_DATE_ASC: string;
  SORT_PRODUCTS_DESC: string;
  SORT_NAME_ASC: string;
  BACK_HUB: string;
  SEALED_PRODUCTS: string;
  RESCAN_EXP: string;
  OFFICIAL_RELEASE: string;
  INITIAL_PRICE: string;
  CHECKED: string;
  NEVER: string;
  STABLE_PRICE: string;
  MARKET_STOCK: string;
  SELLER_LOCATION: string;
  AVG_TOP5: string;
  UNITS: string;
  PRIVATE_SELLER: string;
}

const dictionary: Record<SupportedLanguage, Translations> = {
  it: {
    HUB_TAB: 'HUB ESPANSIONI',
    SEALED_TAB: 'TUTTI I SIGILLATI',
    BARGAINS_TAB: 'TOP OCCASIONI',
    CLOUD_SCAN: 'Scansione IA Cloud',
    SEARCH_EXP: '🔍 Cerca espansione...',
    SEARCH_SEALED: '🔍 Cerca sigillato per nome...',
    MIN_PRICE: 'Min €',
    MAX_PRICE: 'Max €',
    ALL_EXPANSIONS: 'Tutte le Espansioni',
    ALL_TYPES: 'Tutte le Tipologie',
    ALL_VERDICTS: 'Tutti i Verdetti IA',
    SHOW_SCENE_BOXES: 'Mostra Scene Box',
    SHOW_COMMANDER_DECKS: 'Mostra Commander Decks',
    SHOW_STARTER_DECKS: 'Mostra Starter Decks',
    BARGAIN_THRESHOLDS: '🎯 Soglie Occasioni:',
    PRERELEASE_THRESHOLD: 'Prerelease:',
    PLAYBOX_THRESHOLD: 'Play Box:',
    COLLECTOR_THRESHOLD: 'Collector:',
    UPCOMING_EXPANSIONS: '🔥 Prossime Espansioni in Prevendita',
    EXPANSION_SUBTITLE: "Seleziona un'espansione per visualizzare i prodotti sigillati e l'analisi prezzi con l'IA.",
    STATUS_ALL: 'Tutti gli stati',
    STATUS_PREORDER: 'Solo Prevendita',
    STATUS_RELEASED: 'Solo Rilasciate',
    TIME_3M: '📅 Ultimi 3 Mesi & Future',
    TIME_6M: '📅 Ultimi 6 Mesi',
    TIME_1Y: '📅 Ultimo Anno (12 Mesi)',
    TIME_ALL: '📜 Tutte le Espansioni (Tutto)',
    SORT_DATE_DESC: 'Uscita: Più Futura',
    SORT_DATE_ASC: 'Uscita: Meno Futura',
    SORT_PRODUCTS_DESC: 'Più Prodotti Sigillati',
    SORT_NAME_ASC: 'Nome (A-Z)',
    BACK_HUB: "Torna all'Hub Espansioni",
    SEALED_PRODUCTS: 'Prodotti Sigillati',
    RESCAN_EXP: 'Riscansiona Espansione (Re-pull)',
    OFFICIAL_RELEASE: "Data Uscita Ufficiale:",
    INITIAL_PRICE: 'Iniziale:',
    CHECKED: 'Ultimo Controllo:',
    NEVER: 'Mai',
    STABLE_PRICE: 'Prezzo Iniziale Stabile',
    MARKET_STOCK: 'Disponibilità Mercato:',
    SELLER_LOCATION: 'Paese Venditore:',
    AVG_TOP5: 'Media Top 5 Offerte:',
    UNITS: 'unità',
    PRIVATE_SELLER: 'privato'
  },
  en: {
    HUB_TAB: 'EXPANSIONS HUB',
    SEALED_TAB: 'ALL SEALED',
    BARGAINS_TAB: 'TOP DEALS',
    CLOUD_SCAN: 'Cloud AI Scan',
    SEARCH_EXP: '🔍 Search expansion...',
    SEARCH_SEALED: '🔍 Search sealed product...',
    MIN_PRICE: 'Min €',
    MAX_PRICE: 'Max €',
    ALL_EXPANSIONS: 'All Expansions',
    ALL_TYPES: 'All Categories',
    ALL_VERDICTS: 'All AI Verdicts',
    SHOW_SCENE_BOXES: 'Show Scene Boxes',
    SHOW_COMMANDER_DECKS: 'Show Commander Decks',
    SHOW_STARTER_DECKS: 'Show Starter Decks',
    BARGAIN_THRESHOLDS: '🎯 Deal Thresholds:',
    PRERELEASE_THRESHOLD: 'Prerelease:',
    PLAYBOX_THRESHOLD: 'Play Box:',
    COLLECTOR_THRESHOLD: 'Collector:',
    UPCOMING_EXPANSIONS: '🔥 Upcoming Pre-order Expansions',
    EXPANSION_SUBTITLE: 'Select an expansion to view sealed products and AI price insights.',
    STATUS_ALL: 'All Statuses',
    STATUS_PREORDER: 'Pre-order Only',
    STATUS_RELEASED: 'Released Only',
    TIME_3M: '📅 Last 3 Months & Future',
    TIME_6M: '📅 Last 6 Months',
    TIME_1Y: '📅 Last 1 Year',
    TIME_ALL: '📜 All Expansions',
    SORT_DATE_DESC: 'Release: Furthest',
    SORT_DATE_ASC: 'Release: Nearest',
    SORT_PRODUCTS_DESC: 'Most Sealed Products',
    SORT_NAME_ASC: 'Name (A-Z)',
    BACK_HUB: 'Back to Expansions Hub',
    SEALED_PRODUCTS: 'Sealed Products',
    RESCAN_EXP: 'Rescan Expansion (Re-pull)',
    OFFICIAL_RELEASE: 'Official Release Date:',
    INITIAL_PRICE: 'Initial:',
    CHECKED: 'Last Checked:',
    NEVER: 'Never',
    STABLE_PRICE: 'Stable Initial Price',
    MARKET_STOCK: 'Market Stock:',
    SELLER_LOCATION: 'Seller Country:',
    AVG_TOP5: 'Avg Top 5 Offers:',
    UNITS: 'units',
    PRIVATE_SELLER: 'private'
  }
};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly STORAGE_KEY = 'mtg_tracker_lang';
  
  public currentLang = signal<SupportedLanguage>('it');
  
  public t = computed(() => dictionary[this.currentLang()]);

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY) as SupportedLanguage;
    if (saved === 'it' || saved === 'en') {
      this.currentLang.set(saved);
    }
  }

  public setLanguage(lang: SupportedLanguage): void {
    this.currentLang.set(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
  }

  public toggleLanguage(): void {
    const next = this.currentLang() === 'it' ? 'en' : 'it';
    this.setLanguage(next);
  }
}

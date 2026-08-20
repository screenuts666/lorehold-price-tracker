// ============================================================================
// LANGUAGE & LOCALIZATION SERVICE
// Multi-language support (Italian & English)
// ============================================================================

import { Injectable, signal, computed } from '@angular/core';

export type SupportedLanguage = 'it' | 'en';

export interface Translations {
  HUB_TAB: string;
  SEALED_TAB: string;
  BARGAINS_TAB: string;
  SEARCH_TAB: string;
  CLOUD_SCAN: string;
  SEARCH_EXP: string;
  SEARCH_SEALED: string;
  PRICE_LABEL: string;
  MIN_PRICE: string;
  MAX_PRICE: string;
  ALL_EXPANSIONS: string;
  ALL_TYPES: string;
  ALL_VERDICTS: string;
  VERDICT_BUY: string;
  VERDICT_WAIT: string;
  VERDICT_OVERPRICED: string;
  SORT_RECENT: string;
  SORT_PRICE_ASC: string;
  SORT_PRICE_DESC: string;
  SORT_VAR_BEST: string;
  SORT_VAR_WORST: string;
  VISIBILITY_TITLE: string;
  BTN_ALL: string;
  BTN_NONE: string;
  CAT_COLLECTOR: string;
  CAT_PLAY: string;
  CAT_PRERELEASE: string;
  CAT_BUNDLE: string;
  CAT_DRAFT: string;
  CAT_SCENE: string;
  CAT_COMMANDER: string;
  CAT_STARTER: string;
  CAT_OTHER: string;
  HIDE_NA: string;
  ONLY_OLD_SCHOOL: string;
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
  DEAL_PREFIX: string;
  DEAL_SUFFIX: string;
  OLD_SCHOOL_BANNER_TITLE: string;
  OLD_SCHOOL_BANNER_DESC: string;
  OLD_SCHOOL_BARGAINS_TITLE: string;
  OLD_SCHOOL_BARGAINS_DESC: string;
  OLD_SCHOOL_DISMISS: string;
  BARGAINS_HERO_TITLE: string;
  BARGAINS_HERO_DESC: string;
  BARGAINS_FOUND: string;
  FILTER_DRAWER_TITLE: string;
  ACTIVE_FILTERS: string;
  SHOW: string;
  HIDE: string;
  PASTE_URL_BUYING: string;
  PASTE_URL_SELLING: string;
  ADD_BUTTON: string;
  SELLING_DASHBOARD_TITLE: string;
  TOTAL_CARDS_MONITORED: string;
  CURRENT_PORTFOLIO_VALUE: string;
  TOTAL_YIELD_RETURN: string;
  OVERALL_TIMELINE: string;
  EXP_TOP_DEALS_BANNER: string;
  EXP_DEALS_BANNER_SUB: string;
  EXP_SEE_DEALS_BTN: string;
  CHIP_PREORDER: string;
  CHIP_3MONTHS: string;
  CHIP_WITH_PRODUCTS: string;
  CHIP_6MONTHS: string;
  CHIP_RELEASED: string;
  CHIP_ALL_SETS: string;
  CHIP_OLD_SCHOOL: string;
  OLD_SCHOOL_ARCHIVE_TITLE: string;
  OLD_SCHOOL_ARCHIVE_SUB: string;
  EXPLORE_PRODUCTS_BTN: string;
  PRODUCT_SINGULAR: string;
  PRODUCT_PLURAL: string;
  DATE_NA: string;
  EMPTY_NO_PRODUCTS: string;
}

const dictionary: Record<SupportedLanguage, Translations> = {
  it: {
    HUB_TAB: 'HUB ESPANSIONI',
    SEALED_TAB: 'TUTTI I SIGILLATI',
    BARGAINS_TAB: 'TOP OCCASIONI',
    SEARCH_TAB: 'RICERCA',
    CLOUD_SCAN: 'Scansione IA Cloud',
    SEARCH_EXP: '🔍 Cerca espansione...',
    SEARCH_SEALED: '🔍 Cerca prodotto o set...',
    PRICE_LABEL: 'Prezzo:',
    MIN_PRICE: 'Min €',
    MAX_PRICE: 'Max €',
    ALL_EXPANSIONS: 'Tutte le Espansioni',
    ALL_TYPES: 'Tutti i Tipi Sigillato',
    ALL_VERDICTS: 'Tutti i Verdetti IA',
    VERDICT_BUY: '🟢 COMPRA SUBITO',
    VERDICT_WAIT: '🟡 ASPETTA',
    VERDICT_OVERPRICED: '🔴 SOVRAPPREZZO / NON CONVENIENTE',
    SORT_RECENT: 'Più Recenti',
    SORT_PRICE_ASC: 'Prezzo: Crescente',
    SORT_PRICE_DESC: 'Prezzo: Decrescente',
    SORT_VAR_BEST: 'Variazione: Migliore (Ribasso)',
    SORT_VAR_WORST: 'Variazione: Peggiore (Rialzo)',
    VISIBILITY_TITLE: 'Visibilità Tipologie:',
    BTN_ALL: '✓ Tutti',
    BTN_NONE: '✕ Nessuno',
    CAT_COLLECTOR: '👑 Collector Box',
    CAT_PLAY: '⚡ Play Box',
    CAT_PRERELEASE: '🎁 Prerelease Pack',
    CAT_BUNDLE: '💜 Bundle',
    CAT_DRAFT: '🌸 Draft Night',
    CAT_SCENE: '🎬 Scene Box',
    CAT_COMMANDER: '🃏 Commander',
    CAT_STARTER: '🔰 Starter Decks',
    CAT_OTHER: '📦 Altro Sigillato',
    HIDE_NA: '🚫 Nascondi N/A',
    ONLY_OLD_SCHOOL: '🏛️ Solo Old School',
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
    RESCAN_EXP: 'Riscansiona Espansione',
    OFFICIAL_RELEASE: 'Data Uscita Ufficiale:',
    INITIAL_PRICE: 'Iniziale:',
    CHECKED: 'Ultimo Controllo:',
    NEVER: 'Mai',
    STABLE_PRICE: 'Prezzo Iniziale Stabile',
    MARKET_STOCK: 'Disponibilità Mercato:',
    SELLER_LOCATION: 'Paese Venditore:',
    AVG_TOP5: 'Media Top 5 Offerte:',
    UNITS: 'unità',
    PRIVATE_SELLER: 'privato',
    DEAL_PREFIX: 'Occasione',
    DEAL_SUFFIX: '',
    OLD_SCHOOL_BANNER_TITLE: 'Archivio Sigillati Old School Attivo (1993 - 2003)',
    OLD_SCHOOL_BANNER_DESC: 'Stai visualizzando esclusivamente i prodotti sigillati delle storiche espansioni col bordo classico pre-8th Edition.',
    OLD_SCHOOL_BARGAINS_TITLE: 'Affari Old School Attivo (1993 - 2003)',
    OLD_SCHOOL_BARGAINS_DESC: 'Stai visualizzando le migliori occasioni e affari limitati alle espansioni vintage Old School.',
    OLD_SCHOOL_DISMISS: 'Disattiva Filtro Old School ✕',
    BARGAINS_HERO_TITLE: 'Radar Occasioni & Affari Da Comprare',
    BARGAINS_HERO_DESC: "Mostra tutti i prodotti sigillati raccomandati dall'IA con verdetto COMPRA o con prezzo inferiore alle tue soglie smart.",
    BARGAINS_FOUND: 'Affari Trovati',
    FILTER_DRAWER_TITLE: 'Filtri & Opzioni Sezione',
    ACTIVE_FILTERS: 'attivi',
    SHOW: 'Mostra',
    HIDE: 'Nascondi',
    PASTE_URL_BUYING: 'Incolla URL CardTrader da monitorare...',
    PASTE_URL_SELLING: 'Incolla URL CardTrader della carta da vendere...',
    ADD_BUTTON: 'Aggiungi',
    SELLING_DASHBOARD_TITLE: 'Dashboard Portafoglio Carte in Vendita',
    TOTAL_CARDS_MONITORED: 'Totale Carte Monitorate',
    CURRENT_PORTFOLIO_VALUE: 'Valore Attuale Portafoglio',
    TOTAL_YIELD_RETURN: 'Rendimento Totale',
    OVERALL_TIMELINE: 'Andamento Valore Totale Portafoglio nel Tempo',
    EXP_TOP_DEALS_BANNER: '🎯 TOP AFFARI',
    EXP_DEALS_BANNER_SUB: 'Scopri i prodotti sigillati in offerta ed occasioni IA',
    EXP_SEE_DEALS_BTN: 'Vedi Affari ➔',
    CHIP_PREORDER: '🔥 Solo Prevendite',
    CHIP_3MONTHS: '📅 Prossimi 3 Mesi',
    CHIP_WITH_PRODUCTS: '📦 Con Prodotti',
    CHIP_6MONTHS: '📅 6 Mesi',
    CHIP_RELEASED: '✨ Rilasciate',
    CHIP_ALL_SETS: '🌐 Tutti i Set',
    CHIP_OLD_SCHOOL: '🏛️ Old School',
    OLD_SCHOOL_ARCHIVE_TITLE: 'Archivio Old School',
    OLD_SCHOOL_ARCHIVE_SUB: "Espansioni con il bordo classico — dal 1993 all'estate 2003, prima dell'introduzione del nuovo frame con la 8th Edition",
    EXPLORE_PRODUCTS_BTN: 'Esplora prodotti ➔',
    PRODUCT_SINGULAR: 'prodotto',
    PRODUCT_PLURAL: 'prodotti',
    DATE_NA: 'Data N/D',
    EMPTY_NO_PRODUCTS: 'Nessun prodotto trovato'
  },
  en: {
    HUB_TAB: 'EXPANSIONS HUB',
    SEALED_TAB: 'ALL SEALED',
    BARGAINS_TAB: 'TOP DEALS',
    SEARCH_TAB: 'SEARCH',
    CLOUD_SCAN: 'Cloud AI Scan',
    SEARCH_EXP: '🔍 Search expansion...',
    SEARCH_SEALED: '🔍 Search product or set...',
    PRICE_LABEL: 'Price:',
    MIN_PRICE: 'Min €',
    MAX_PRICE: 'Max €',
    ALL_EXPANSIONS: 'All Expansions',
    ALL_TYPES: 'All Categories',
    ALL_VERDICTS: 'All AI Verdicts',
    VERDICT_BUY: '🟢 BUY NOW',
    VERDICT_WAIT: '🟡 WAIT',
    VERDICT_OVERPRICED: '🔴 OVERPRICED / AVOID',
    SORT_RECENT: 'Most Recent',
    SORT_PRICE_ASC: 'Price: Low to High',
    SORT_PRICE_DESC: 'Price: High to Low',
    SORT_VAR_BEST: 'Variation: Best (Discount)',
    SORT_VAR_WORST: 'Variation: Worst (Increase)',
    VISIBILITY_TITLE: 'Category Visibility:',
    BTN_ALL: '✓ All',
    BTN_NONE: '✕ None',
    CAT_COLLECTOR: '👑 Collector Box',
    CAT_PLAY: '⚡ Play Box',
    CAT_PRERELEASE: '🎁 Prerelease Pack',
    CAT_BUNDLE: '💜 Bundle',
    CAT_DRAFT: '🌸 Draft Night',
    CAT_SCENE: '🎬 Scene Box',
    CAT_COMMANDER: '🃏 Commander',
    CAT_STARTER: '🔰 Starter Decks',
    CAT_OTHER: '📦 Other Sealed',
    HIDE_NA: '🚫 Hide N/A',
    ONLY_OLD_SCHOOL: '🏛️ Old School Only',
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
    RESCAN_EXP: 'Rescan Expansion',
    OFFICIAL_RELEASE: 'Official Release Date:',
    INITIAL_PRICE: 'Initial:',
    CHECKED: 'Last Checked:',
    NEVER: 'Never',
    STABLE_PRICE: 'Stable Initial Price',
    MARKET_STOCK: 'Market Stock:',
    SELLER_LOCATION: 'Seller Country:',
    AVG_TOP5: 'Avg Top 5 Offers:',
    UNITS: 'units',
    PRIVATE_SELLER: 'private',
    DEAL_PREFIX: '',
    DEAL_SUFFIX: 'Deal',
    OLD_SCHOOL_BANNER_TITLE: 'Old School Archive Active (1993 - 2003)',
    OLD_SCHOOL_BANNER_DESC: 'You are viewing exclusively sealed products from classic vintage pre-8th Edition sets.',
    OLD_SCHOOL_BARGAINS_TITLE: 'Old School Deals Active (1993 - 2003)',
    OLD_SCHOOL_BARGAINS_DESC: 'You are viewing top bargains and deals limited to vintage Old School expansions.',
    OLD_SCHOOL_DISMISS: 'Disable Old School Filter ✕',
    BARGAINS_HERO_TITLE: 'Bargains & Deals Radar',
    BARGAINS_HERO_DESC: 'Displays all sealed products recommended by AI as BUY or with prices below your smart thresholds.',
    BARGAINS_FOUND: 'Deals Found',
    FILTER_DRAWER_TITLE: 'Filters & Section Options',
    ACTIVE_FILTERS: 'active',
    SHOW: 'Show',
    HIDE: 'Hide',
    PASTE_URL_BUYING: 'Paste CardTrader URL to monitor...',
    PASTE_URL_SELLING: 'Paste CardTrader URL of card to sell...',
    ADD_BUTTON: 'Add',
    SELLING_DASHBOARD_TITLE: 'Selling Portfolio Dashboard',
    TOTAL_CARDS_MONITORED: 'Total Cards Monitored',
    CURRENT_PORTFOLIO_VALUE: 'Current Portfolio Value',
    TOTAL_YIELD_RETURN: 'Total Yield / Return',
    OVERALL_TIMELINE: 'Overall Selling Portfolio Value Timeline',
    EXP_TOP_DEALS_BANNER: '🎯 TOP DEALS',
    EXP_DEALS_BANNER_SUB: 'Discover discounted sealed products and AI bargain verdicts',
    EXP_SEE_DEALS_BTN: 'View Deals ➔',
    CHIP_PREORDER: '🔥 Pre-orders Only',
    CHIP_3MONTHS: '📅 Next 3 Months',
    CHIP_WITH_PRODUCTS: '📦 With Products',
    CHIP_6MONTHS: '📅 6 Months',
    CHIP_RELEASED: '✨ Released Only',
    CHIP_ALL_SETS: '🌐 All Sets',
    CHIP_OLD_SCHOOL: '🏛️ Old School',
    OLD_SCHOOL_ARCHIVE_TITLE: 'Old School Archive',
    OLD_SCHOOL_ARCHIVE_SUB: 'Expansions with the classic frame — from 1993 to summer 2003, before the 8th Edition modern frame',
    EXPLORE_PRODUCTS_BTN: 'Explore Products ➔',
    PRODUCT_SINGULAR: 'product',
    PRODUCT_PLURAL: 'products',
    DATE_NA: 'Date N/A',
    EMPTY_NO_PRODUCTS: 'No products found'
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

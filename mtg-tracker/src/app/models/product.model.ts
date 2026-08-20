// ============================================================================
// MTG PRODUCT DOMAIN MODELS & ENUMS
// ============================================================================

export enum MtgProductCategoryKey {
  COLLECTOR_BOX = 'collector-box',
  PLAY_BOX = 'play-box',
  PRERELEASE = 'prerelease',
  BUNDLE = 'bundle',
  DRAFT_NIGHT = 'draft-night',
  SCENE_BOX = 'scene-box',
  COMMANDER_DECK = 'commander-deck',
  STARTER_DECK = 'starter-deck',
  SINGLE_CARD = 'single-card',
  OTHER = 'other'
}

export interface MtgSmartCategoryInfo {
  key: MtgProductCategoryKey;
  nameType: string;
  defaultThreshold: number;
}

export enum AiVerdict {
  COMPRA = 'COMPRA',
  ASPETTA = 'ASPETTA',
  SOVRAPPREZZO = 'SOVRAPPREZZO'
}

export interface PricePoint {
  data: string;
  prezzo: number;
  timestamp?: number;
}

export interface CardTraderHistoricalPoint {
  d: string;
  p: number;
}

export interface MtgProduct {
  id: string;
  nome: string;
  url: string;
  prezzoAttuale: number | null;
  storico: PricePoint[];
  sezione: 'buy' | 'sell';
  intento?: 'buy' | 'sell';
  immagine?: string;
  isSealed?: boolean;
  isOldSchool?: boolean;
  expansion?: string;
  releaseDate?: string;
  foil?: boolean | null;
  lingua?: string;
  condizione?: string;
  ai_verdict?: string;
  ai_reason?: string;
  ai_timestamp?: string;
  ctHistory?: CardTraderHistoricalPoint[];
  min_price_cents?: number;
  last_sync_timestamp?: number;
  dataInserimento?: string;
  stock?: number;
  sellerCountry?: string;
  sellerType?: string;
  avgTop5?: number;
}

export interface MtgSealedProduct extends MtgProduct {
  prezzoIniziale?: number;
  verdict?: AiVerdict | string;
  verdictExplanation?: string;
  stockCount?: number;
}

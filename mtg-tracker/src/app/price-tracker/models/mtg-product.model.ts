export enum MtgProductCategoryKey {
  COLLECTOR_BOX = 'collector-box',
  PLAY_BOX = 'play-box',
  PRERELEASE = 'prerelease',
  BUNDLE = 'bundle',
  DRAFT_NIGHT = 'draft-night',
  SCENE_BOX = 'scene-box',
  COMMANDER_DECK = 'commander-deck',
  STARTER_DECK = 'starter-deck',
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
}

export interface MtgSealedProduct {
  id: string;
  nome: string;
  prezzoAttuale: number | null;
  prezzoIniziale?: number;
  storico?: PricePoint[];
  url?: string;
  immagine?: string;
  expansion?: string;
  releaseDate?: string;
  intento?: 'buy' | 'sell';
  verdict?: AiVerdict | string;
  verdictExplanation?: string;
  stockCount?: number;
  foil?: boolean | null;
  lingua?: string | null;
  condizione?: string | null;
}

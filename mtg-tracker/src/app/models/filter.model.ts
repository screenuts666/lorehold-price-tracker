// ============================================================================
// FILTER & NAVIGATION DOMAIN MODELS
// ============================================================================

export interface UserFilterState {
  expansionFilter: string;
  typeFilter: string;
  verdictFilter: string;
  includeCollectorBoxes: boolean;
  includePlayBoxes: boolean;
  includePrereleasePacks: boolean;
  includeBundles: boolean;
  includeDraftNight: boolean;
  includeSceneBoxes: boolean;
  includeCommanderDecks: boolean;
  includeStarterDecks: boolean;
  includeOther: boolean;
  hideNAPrices: boolean;
  onlyOldSchool: boolean;
  searchQuery: string;
  minPrice: number | null;
  maxPrice: number | null;
  sortMode: string;
}

export interface FilterModalData {
  id?: string;
  name?: string;
  nome?: string;
  url?: string;
  image?: string;
  immagine?: string;
  isNew?: boolean;
  foil?: boolean | null;
  lingua?: string;
  condizione?: string;
  sezione?: 'buy' | 'sell';
}

export interface FilterModalSaveResult {
  foil: 'any' | 'normal' | 'foil';
  lang: 'any' | 'it' | 'en';
  cond: 'any' | 'Near Mint';
  intent: 'buy' | 'sell';
}

export type TimeWindowFilter = '3months' | '6months' | '1year' | 'all';
export type QuickChipFilter = 'preorder' | '3months' | '6months' | 'has-products' | 'released' | 'all' | 'old-school';
export type FoilFilterType = 'any' | 'normal' | 'foil';
export type LangFilterType = 'any' | 'it' | 'en';
export type CondFilterType = 'any' | 'Near Mint';
export type IntentFilterType = 'buy' | 'sell';
export type ActiveSectionType = 'expansions-hub' | 'expansion-detail' | 'all-sealed' | 'bargains' | 'search';
export type ViewModeType = 'grid' | 'table';
export type SortOrderType =
  | 'nome-asc'
  | 'nome-desc'
  | 'prezzo-asc'
  | 'prezzo-desc'
  | 'variazione-desc'
  | 'variazione-asc'
  | 'alpha-desc'
  | 'alpha-asc'
  | 'data-desc'
  | 'data-asc'
  | 'products-desc';

// ============================================================================
// BACKEND & CLOUD FUNCTION API RESPONSES
// ============================================================================

import { ScryfallCardResult } from './scryfall.model';

export interface TriggerAiResponse {
  success: boolean;
  message?: string;
  count?: number;
}

export interface PriceApiResponse {
  success?: boolean;
  prezzo?: number;
  current_price?: number;
  message?: string;
  [key: string]: unknown;
}

export interface AutoDiscoverResponse {
  success?: boolean;
  message?: string;
  discovered?: number;
  found?: number;
  added?: number;
}

export interface SearchCardResponse {
  cards: ScryfallCardResult[];
}

export interface MapCardTraderResponse {
  id: number | string;
  name: string;
  url: string;
  image?: string;
}

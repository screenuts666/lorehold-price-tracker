// ============================================================================
// SCRYFALL & EXPANSIONS HUB DOMAIN MODELS
// ============================================================================

export interface ScryfallSet {
  id?: string;
  code: string;
  name: string;
  released_at: string;
  set_type?: string;
  card_count?: number;
  icon_svg_uri?: string | null;
}

export interface ExpansionItem {
  name: string;
  code: string;
  count: number;
  icon_svg_uri: string | null;
  released_at: string | null;
  formattedDate: string;
  isPreorder: boolean;
  isOldSchool: boolean;
  coverImage: string | null;
}

export interface ScryfallCardResult {
  id: string;
  name: string;
  printed_name?: string;
  set_code: string;
  set_name: string;
  image: string;
  collector_number?: string;
}

export interface ScryfallSetsResponse {
  data: ScryfallSet[];
}

import { Injectable } from '@angular/core';
import { UserFilterState } from '../../models';

export { UserFilterState };

@Injectable({
  providedIn: 'root'
})
export class StorageFilterService {
  private readonly KEYS = {
    EXPANSION: 'mtg_tracker_exp_filter',
    TYPE: 'mtg_tracker_type_filter',
    VERDICT: 'mtg_tracker_verdict_filter',
    INC_COLLECTOR: 'mtg_tracker_inc_collector',
    INC_PLAY: 'mtg_tracker_inc_play',
    INC_PRERELEASE: 'mtg_tracker_inc_prerelease',
    INC_BUNDLE: 'mtg_tracker_inc_bundle',
    INC_DRAFT: 'mtg_tracker_inc_draft',
    INC_SCENE: 'mtg_tracker_inc_scene_boxes',
    INC_CMD: 'mtg_tracker_inc_cmd_decks',
    INC_STR: 'mtg_tracker_inc_str_decks',
    INC_OTHER: 'mtg_tracker_inc_other',
    HIDE_NA: 'mtg_tracker_hide_na',
    ONLY_OLD_SCHOOL: 'mtg_tracker_only_old_school',
    SEARCH: 'mtg_tracker_sealed_search',
    MIN_PRICE: 'mtg_tracker_min_price',
    MAX_PRICE: 'mtg_tracker_max_price',
    SORT_MODE: 'mtg_tracker_ordinamento',
    VISTA_MODE: 'mtg_tracker_vista',
    HUB_SEARCH: 'mtg_tracker_hub_search',
    HUB_SORT: 'mtg_tracker_hub_sort',
    HUB_STATUS: 'mtg_tracker_hub_status',
    HUB_TIME_WINDOW: 'mtg_tracker_hub_time_window',
    HUB_QUICK_CHIP: 'mtg_tracker_hub_quick_chip'
  };

  public loadFilterState(): UserFilterState {
    const minP = localStorage.getItem(this.KEYS.MIN_PRICE);
    const maxP = localStorage.getItem(this.KEYS.MAX_PRICE);

    return {
      expansionFilter: localStorage.getItem(this.KEYS.EXPANSION) || 'all',
      typeFilter: localStorage.getItem(this.KEYS.TYPE) || 'all',
      verdictFilter: localStorage.getItem(this.KEYS.VERDICT) || 'all',
      includeCollectorBoxes: localStorage.getItem(this.KEYS.INC_COLLECTOR) !== 'false',
      includePlayBoxes: localStorage.getItem(this.KEYS.INC_PLAY) !== 'false',
      includePrereleasePacks: localStorage.getItem(this.KEYS.INC_PRERELEASE) !== 'false',
      includeBundles: localStorage.getItem(this.KEYS.INC_BUNDLE) !== 'false',
      includeDraftNight: localStorage.getItem(this.KEYS.INC_DRAFT) !== 'false',
      includeSceneBoxes: localStorage.getItem(this.KEYS.INC_SCENE) !== 'false',
      includeCommanderDecks: localStorage.getItem(this.KEYS.INC_CMD) !== 'false',
      includeStarterDecks: localStorage.getItem(this.KEYS.INC_STR) !== 'false',
      includeOther: localStorage.getItem(this.KEYS.INC_OTHER) !== 'false',
      hideNAPrices: localStorage.getItem(this.KEYS.HIDE_NA) !== 'false',
      onlyOldSchool: localStorage.getItem(this.KEYS.ONLY_OLD_SCHOOL) === 'true',
      searchQuery: localStorage.getItem(this.KEYS.SEARCH) || '',
      minPrice: minP ? parseFloat(minP) : null,
      maxPrice: maxP ? parseFloat(maxP) : null,
      sortMode: localStorage.getItem(this.KEYS.SORT_MODE) || 'recent'
    };
  }

  public saveFilterState(state: Partial<UserFilterState>): void {
    if (state.expansionFilter !== undefined) localStorage.setItem(this.KEYS.EXPANSION, state.expansionFilter);
    if (state.typeFilter !== undefined) localStorage.setItem(this.KEYS.TYPE, state.typeFilter);
    if (state.verdictFilter !== undefined) localStorage.setItem(this.KEYS.VERDICT, state.verdictFilter);
    if (state.includeCollectorBoxes !== undefined) localStorage.setItem(this.KEYS.INC_COLLECTOR, state.includeCollectorBoxes.toString());
    if (state.includePlayBoxes !== undefined) localStorage.setItem(this.KEYS.INC_PLAY, state.includePlayBoxes.toString());
    if (state.includePrereleasePacks !== undefined) localStorage.setItem(this.KEYS.INC_PRERELEASE, state.includePrereleasePacks.toString());
    if (state.includeBundles !== undefined) localStorage.setItem(this.KEYS.INC_BUNDLE, state.includeBundles.toString());
    if (state.includeDraftNight !== undefined) localStorage.setItem(this.KEYS.INC_DRAFT, state.includeDraftNight.toString());
    if (state.includeSceneBoxes !== undefined) localStorage.setItem(this.KEYS.INC_SCENE, state.includeSceneBoxes.toString());
    if (state.includeCommanderDecks !== undefined) localStorage.setItem(this.KEYS.INC_CMD, state.includeCommanderDecks.toString());
    if (state.includeStarterDecks !== undefined) localStorage.setItem(this.KEYS.INC_STR, state.includeStarterDecks.toString());
    if (state.includeOther !== undefined) localStorage.setItem(this.KEYS.INC_OTHER, state.includeOther.toString());
    if (state.hideNAPrices !== undefined) localStorage.setItem(this.KEYS.HIDE_NA, state.hideNAPrices.toString());
    if (state.onlyOldSchool !== undefined) localStorage.setItem(this.KEYS.ONLY_OLD_SCHOOL, state.onlyOldSchool.toString());
    if (state.searchQuery !== undefined) localStorage.setItem(this.KEYS.SEARCH, state.searchQuery);
    if (state.minPrice !== undefined) localStorage.setItem(this.KEYS.MIN_PRICE, state.minPrice !== null ? state.minPrice.toString() : '');
    if (state.maxPrice !== undefined) localStorage.setItem(this.KEYS.MAX_PRICE, state.maxPrice !== null ? state.maxPrice.toString() : '');
    if (state.sortMode !== undefined) localStorage.setItem(this.KEYS.SORT_MODE, state.sortMode);
  }

  public getVistaMode(): 'grid' | 'table' {
    const v = localStorage.getItem(this.KEYS.VISTA_MODE);
    return (v === 'grid' || v === 'table') ? v : 'grid';
  }

  public saveVistaMode(mode: 'grid' | 'table'): void {
    localStorage.setItem(this.KEYS.VISTA_MODE, mode);
  }
}

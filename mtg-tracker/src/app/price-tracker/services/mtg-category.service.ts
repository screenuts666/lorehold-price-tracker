import { Injectable } from '@angular/core';
import { MtgProductCategoryKey, MtgSmartCategoryInfo } from '../models/mtg-product.model';

@Injectable({
  providedIn: 'root'
})
export class MtgCategoryService {
  public categoryThresholds: Record<MtgProductCategoryKey, number> = {
    [MtgProductCategoryKey.COLLECTOR_BOX]: 250,
    [MtgProductCategoryKey.PLAY_BOX]: 110,
    [MtgProductCategoryKey.PRERELEASE]: 30,
    [MtgProductCategoryKey.BUNDLE]: 40,
    [MtgProductCategoryKey.DRAFT_NIGHT]: 60,
    [MtgProductCategoryKey.SCENE_BOX]: 35,
    [MtgProductCategoryKey.COMMANDER_DECK]: 35,
    [MtgProductCategoryKey.STARTER_DECK]: 25,
    [MtgProductCategoryKey.OTHER]: 50
  };

  constructor() {
    this.restoreThresholds();
  }

  public restoreThresholds(): void {
    Object.values(MtgProductCategoryKey).forEach(key => {
      const saved = localStorage.getItem('mtg_tracker_threshold_' + key);
      if (saved) {
        const num = parseFloat(saved);
        if (!isNaN(num)) {
          this.categoryThresholds[key as MtgProductCategoryKey] = num;
        }
      }
    });
  }

  public updateThreshold(key: MtgProductCategoryKey, val: number): void {
    if (!isNaN(val)) {
      this.categoryThresholds[key] = val;
      localStorage.setItem('mtg_tracker_threshold_' + key, val.toString());
    }
  }

  public isSealedProduct(name: string): boolean {
    if (!name || name.includes('//')) return false;
    const sealedRegex = /\b(box|boxes|booster|boosters|pack|packs|deck|decks|bundle|bundles|display|displays|prerelease|pre-release|fat pack|starter kit|scene box|challenger|intro pack)\b/i;
    return sealedRegex.test(name);
  }

  public detectCategory(name: string): MtgSmartCategoryInfo {
    const n = (name || '').toLowerCase();

    if (n.includes('collector booster box') || n.includes('collector box') || n.includes('collector display')) {
      return {
        key: MtgProductCategoryKey.COLLECTOR_BOX,
        nameType: 'Collector Box',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.COLLECTOR_BOX]
      };
    }
    if (n.includes('play booster box') || n.includes('play box') || n.includes('booster box') || n.includes('booster display') || n.includes('draft box')) {
      return {
        key: MtgProductCategoryKey.PLAY_BOX,
        nameType: 'Box Normali / Play Box',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.PLAY_BOX]
      };
    }
    if (n.includes('prerelease pack') || n.includes('prerelease')) {
      return {
        key: MtgProductCategoryKey.PRERELEASE,
        nameType: 'Prerelease Pack',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.PRERELEASE]
      };
    }
    if (n.includes('fat pack') || n.includes('bundle') || n.includes('gift edition')) {
      return {
        key: MtgProductCategoryKey.BUNDLE,
        nameType: 'Fat Pack / Bundle',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.BUNDLE]
      };
    }
    if (n.includes('draft night')) {
      return {
        key: MtgProductCategoryKey.DRAFT_NIGHT,
        nameType: 'Draft Night Kit',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.DRAFT_NIGHT]
      };
    }
    if (n.includes('scene box') || n.includes('scene')) {
      return {
        key: MtgProductCategoryKey.SCENE_BOX,
        nameType: 'Scene Box',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.SCENE_BOX]
      };
    }
    if (n.includes('commander deck') || n.includes('commander display') || (n.includes('commander') && (n.includes('deck') || n.includes('box') || n.includes('pack')))) {
      return {
        key: MtgProductCategoryKey.COMMANDER_DECK,
        nameType: 'Commander Deck',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.COMMANDER_DECK]
      };
    }
    if (n.includes('starter') || n.includes('challenger') || n.includes('pioneer') || n.includes('intro pack') || n.includes('deck')) {
      return {
        key: MtgProductCategoryKey.STARTER_DECK,
        nameType: 'Starter / Other Deck',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.STARTER_DECK]
      };
    }

    return {
      key: MtgProductCategoryKey.OTHER,
      nameType: 'Altro Sigillato',
      defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.OTHER]
    };
  }
}

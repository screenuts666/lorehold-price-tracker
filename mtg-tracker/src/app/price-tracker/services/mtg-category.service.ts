import { Injectable } from '@angular/core';
import { MtgProductCategoryKey, MtgSmartCategoryInfo, MtgProduct } from '../../models';
import { isOldSchoolDate } from '../../utils/date.utils';

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
    [MtgProductCategoryKey.SINGLE_CARD]: 15,
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

  public readonly OLD_SCHOOL_CUTOFF = '2003-07-28';

  private readonly OLD_SCHOOL_SETS = [
    'alpha', 'beta', 'unlimited', 'arabian nights', 'antiquities', 'legends', 'the dark', 'fallen empires',
    'fourth edition', '4th edition', 'ice age', 'chronicles', 'homelands', 'alliances', 'mirage', 'visions',
    'fifth edition', '5th edition', 'weatherlight', 'tempest', 'stronghold', 'exodus',
    "urza's saga", 'urzas saga', "urza's legacy", 'urzas legacy', 'classic sixth edition', 'sixth edition', '6th edition',
    "urza's destiny", 'urzas destiny', 'mercadian masques', 'nemesis', 'prophecy', 'invasion', 'planeshift',
    'seventh edition', '7th edition', 'apocalypse', 'odyssey', 'torment', 'judgment', 'onslaught', 'legions', 'scourge',
    'starter 1999', 'starter 2000', 'portal', 'portal second age', 'portal three kingdoms', 'unglued', 'anthologies',
    'battle royale', 'beatdown'
  ];

  public isOldSchool(p: MtgProduct | Partial<MtgProduct>): boolean {
    if (!p) return false;
    if (p.releaseDate && isOldSchoolDate(p.releaseDate, this.OLD_SCHOOL_CUTOFF)) return true;
    const exp = (p.expansion || '').toLowerCase().trim();
    const name = (p.nome || '').toLowerCase().trim();
    for (const s of this.OLD_SCHOOL_SETS) {
      if (exp === s || exp.includes(s) || name.includes(s)) return true;
    }
    return false;
  }

  public isSealedProduct(name: string): boolean {
    if (!name || name.includes('//')) return false;
    const sealedRegex = /\b(booster|boosters|collector box|collector booster|collector display|play box|play booster|play display|draft box|draft booster|draft display|booster box|booster pack|booster display|prerelease|pre-release|fat pack|bundle|bundles|starter kit|starter deck|scene box|challenger deck|intro pack|tournament pack|display box|display of \d+|theme booster|deck builder's toolkit|starter set|starter box)\b/i;
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
    if (n.includes('starter') || n.includes('challenger') || n.includes('pioneer') || n.includes('intro pack') || n.includes('tournament pack') || n.includes('tournament deck') || n.includes('duel deck') || n.includes('clash pack') || n.includes('theme deck') || n.includes('theme booster') || n.includes('deck')) {
      return {
        key: MtgProductCategoryKey.STARTER_DECK,
        nameType: 'Starter / Tournament Deck',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.STARTER_DECK]
      };
    }

    if (!this.isSealedProduct(name)) {
      return {
        key: MtgProductCategoryKey.SINGLE_CARD,
        nameType: 'Carta Singola',
        defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.SINGLE_CARD]
      };
    }

    return {
      key: MtgProductCategoryKey.OTHER,
      nameType: 'Altro Sigillato',
      defaultThreshold: this.categoryThresholds[MtgProductCategoryKey.OTHER]
    };
  }
}

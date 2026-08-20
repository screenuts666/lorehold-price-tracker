import { Component, input, output, OnInit, effect, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import {
  MtgProduct,
  ExpansionItem,
  ScryfallSet,
  ScryfallSetsResponse,
  TimeWindowFilter,
  QuickChipFilter
} from '../../../models';
import {
  getIsoDateDaysAgo,
  getTodayIsoString,
  formatLocalizedDate,
  isOldSchoolDate,
  OLD_SCHOOL_CUTOFF_DATE
} from '../../../utils/date.utils';

@Component({
  selector: 'app-expansions-hub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expansions-hub.component.html',
  styleUrls: ['./expansions-hub.component.scss']
})
export class ExpansionsHubComponent implements OnInit {
  products = input<MtgProduct[]>([]);
  expansionSelected = output<string>();
  jumpToBargains = output<void>();

  public langService = inject(LanguageService);
  private http = inject(HttpClient);
  public t = computed(() => this.langService.t());

  expansionsData = signal<ExpansionItem[]>([]);
  loadingSets = signal<boolean>(true);
  private scryfallSetsCache: ScryfallSet[] = [];

  // Filters & Search
  searchQuery = signal<string>('');
  sortOrder = signal<string>('date-desc');
  statusFilter = signal<string>('all');
  timeWindowFilter = signal<TimeWindowFilter>('3months');
  quickChip = signal<QuickChipFilter>('preorder');

  readonly OLD_SCHOOL_CUTOFF = OLD_SCHOOL_CUTOFF_DATE;

  selectQuickChip(chip: QuickChipFilter) {
    this.quickChip.set(chip);
    localStorage.setItem('mtg_tracker_hub_quick_chip', chip);
    if (chip === 'preorder') {
      this.statusFilter.set('preorder');
      this.timeWindowFilter.set('3months');
    } else if (chip === '3months') {
      this.statusFilter.set('all');
      this.timeWindowFilter.set('3months');
    } else if (chip === '6months') {
      this.statusFilter.set('all');
      this.timeWindowFilter.set('6months');
    } else if (chip === 'has-products') {
      this.statusFilter.set('all');
      this.timeWindowFilter.set('all');
    } else if (chip === 'released') {
      this.statusFilter.set('released');
      this.timeWindowFilter.set('all');
    } else if (chip === 'all') {
      this.statusFilter.set('all');
      this.timeWindowFilter.set('all');
    } else if (chip === 'old-school') {
      this.statusFilter.set('old-school');
      this.timeWindowFilter.set('all');
    }
    this.processExpansions(this.products());
  }

  filteredExpansionsData = computed(() => {
    const list = [...this.expansionsData()];
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const sort = this.sortOrder();

    let result = list;

    // Search query
    if (query) {
      result = result.filter(e =>
        e.name.toLowerCase().includes(query) ||
        (e.code && e.code.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (status === 'preorder') {
      result = result.filter(e => e.isPreorder);
    } else if (status === 'released') {
      result = result.filter(e => !e.isPreorder);
    } else if (status === 'old-school') {
      result = result.filter(e => e.isOldSchool);
    }

    // Quick chip extra filter
    if (this.quickChip() === 'has-products') {
      result = result.filter(e => e.count > 0);
    }

    // Sorting
    if (sort === 'date-desc') {
      result.sort((a, b) => new Date(b.released_at || 0).getTime() - new Date(a.released_at || 0).getTime());
    } else if (sort === 'date-asc') {
      result.sort((a, b) => new Date(a.released_at || 0).getTime() - new Date(b.released_at || 0).getTime());
    } else if (sort === 'name-asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'products-desc') {
      result.sort((a, b) => b.count - a.count);
    }

    return result;
  });

  constructor() {
    effect(() => {
      const currentProducts = this.products();
      const lang = this.langService.currentLang();
      if (this.scryfallSetsCache.length > 0 || !this.loadingSets()) {
        this.processExpansions(currentProducts);
      }
    });
  }

  ngOnInit() {
    const savedQuery = localStorage.getItem('mtg_tracker_hub_search');
    if (savedQuery !== null) this.searchQuery.set(savedQuery);

    const savedSort = localStorage.getItem('mtg_tracker_hub_sort');
    if (savedSort !== null) this.sortOrder.set(savedSort);

    const savedChip = localStorage.getItem('mtg_tracker_hub_quick_chip') as QuickChipFilter;
    if (savedChip) this.selectQuickChip(savedChip);

    this.fetchScryfallSets();
  }

  fetchScryfallSets() {
    this.loadingSets.set(true);
    this.http.get<ScryfallSetsResponse>('https://api.scryfall.com/sets').subscribe({
      next: (res) => {
        this.scryfallSetsCache = res.data || [];
        this.loadingSets.set(false);
        this.processExpansions(this.products());
      },
      error: (err) => {
        console.error('Error loading sets from Scryfall API:', err);
        this.loadingSets.set(false);
        this.processExpansions(this.products());
      }
    });
  }

  processExpansions(productsList: MtgProduct[]) {
    const todayStr = getTodayIsoString();
    const expProductsCount: Record<string, number> = {};
    const expCoverMap: Record<string, string> = {};

    productsList.forEach(p => {
      if (p.expansion) {
        expProductsCount[p.expansion] = (expProductsCount[p.expansion] || 0) + 1;
        if (p.immagine && !expCoverMap[p.expansion]) {
          expCoverMap[p.expansion] = p.immagine;
        }
      }
    });

    const getSetProductsInfo = (setName: string) => {
      const normTarget = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
      let count = expProductsCount[setName] || 0;
      let cover = expCoverMap[setName] || null;

      const genericWords = ['commander', 'masters', 'horizons', 'coreset', 'duels', 'anthology', 'remastered', 'chronicles', 'promo', 'promos'];
      const isGeneric = genericWords.some(w => normTarget === w || normTarget.endsWith(w));

      if (count === 0 && normTarget.length > 3 && !isGeneric) {
        Object.keys(expProductsCount).forEach(expKey => {
          const normExp = expKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normExp === normTarget) {
            count += expProductsCount[expKey];
            if (!cover && expCoverMap[expKey]) cover = expCoverMap[expKey];
          }
        });
      }
      return { count, cover };
    };

    const setsList: ExpansionItem[] = [];
    const addedNames = new Set<string>();

    const threeMonthsAgoStr = getIsoDateDaysAgo(90);
    const sixMonthsAgoStr = getIsoDateDaysAgo(180);
    const oneYearAgoStr = getIsoDateDaysAgo(365);

    const tw = this.timeWindowFilter();
    const isOldSchoolMode = this.quickChip() === 'old-school';

    // 1. Trova tutte le espansioni principali da Scryfall
    if (this.scryfallSetsCache.length > 0) {
      const futureScryfallSets = this.scryfallSetsCache.filter(s => {
        if (!s.released_at) return false;
        
        const nameLower = s.name.toLowerCase();

        // Old School mode: show only pre-2003 sets (old card frame)
        if (isOldSchoolMode) {
          if (s.released_at >= this.OLD_SCHOOL_CUTOFF) return false;
          if (s.set_type !== 'expansion' && s.set_type !== 'core' && s.set_type !== 'masters') return false;
          return true;
        }

        // Escludiamo set generici/promo senza prodotti sigillati
        if (nameLower.includes('foundations')) return false;
        if (nameLower === 'commander' && s.code === 'cmd') return false;

        const info = getSetProductsInfo(s.name);
        if (info.count === 0) {
          if (s.set_type !== 'expansion' && s.set_type !== 'masters' && s.set_type !== 'draft_innovation') return false;
          if (nameLower.includes('commander') && !nameLower.includes('20') && !nameLower.includes('legends') && !nameLower.includes('masters')) return false;
        }

        // Finestra temporale configurabile
        if (tw === '3months') return s.released_at >= threeMonthsAgoStr;
        if (tw === '6months') return s.released_at >= sixMonthsAgoStr;
        if (tw === '1year') return s.released_at >= oneYearAgoStr;
        return true;
      });

      futureScryfallSets.forEach(s => {
        addedNames.add(s.name.toLowerCase());
        const info = getSetProductsInfo(s.name);
        const cover = info.cover || productsList.find(p => p.expansion && p.expansion.toLowerCase() === s.name.toLowerCase() && p.immagine)?.immagine || null;

        const isPreorder = s.released_at >= todayStr;
        const isOldSchool = isOldSchoolDate(s.released_at);

        setsList.push({
          name: s.name,
          code: s.code ? s.code.toUpperCase() : '',
          count: info.count,
          icon_svg_uri: s.icon_svg_uri || null,
          released_at: s.released_at,
          formattedDate: formatLocalizedDate(s.released_at, this.langService.currentLang()),
          isPreorder: isPreorder,
          isOldSchool: isOldSchool,
          coverImage: cover
        });
      });
    }

    // 2. Aggiungi le espansioni presenti nel DB che non sono già state incluse
    Object.keys(expProductsCount).forEach(expName => {
      if (!addedNames.has(expName.toLowerCase())) {
        const expLower = expName.toLowerCase();
        let scryfallSet = this.scryfallSetsCache.find(s => s.name.toLowerCase() === expLower);
        if (!scryfallSet) {
          scryfallSet = this.scryfallSetsCache.find(s => 
            s.name.length > 3 && (expLower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(expLower))
          );
        }

        const relDate = scryfallSet?.released_at || null;
        const isPreorder = relDate ? (relDate >= todayStr) : false;

        if (isOldSchoolMode) {
          if (!relDate || relDate >= this.OLD_SCHOOL_CUTOFF) return;
        } else {
          if (tw === '3months' && relDate && relDate < threeMonthsAgoStr) return;
          if (tw === '6months' && relDate && relDate < sixMonthsAgoStr) return;
          if (tw === '1year' && relDate && relDate < oneYearAgoStr) return;
        }

        addedNames.add(expName.toLowerCase());

        const matchingProduct = productsList.find(p => p.expansion === expName && p.immagine);
        const cover = expCoverMap[expName] || matchingProduct?.immagine || null;

        setsList.push({
          name: expName,
          code: scryfallSet?.code ? scryfallSet.code.toUpperCase() : '',
          count: expProductsCount[expName],
          icon_svg_uri: scryfallSet?.icon_svg_uri || null,
          released_at: relDate,
          formattedDate: relDate ? formatLocalizedDate(relDate, this.langService.currentLang()) : this.t().DATE_NA,
          isPreorder: isPreorder,
          isOldSchool: isOldSchoolDate(relDate),
          coverImage: cover
        });
      }
    });

    setsList.sort((a, b) => {
      if (a.isPreorder && !b.isPreorder) return -1;
      if (!a.isPreorder && b.isPreorder) return 1;
      if (a.released_at && b.released_at) {
        return new Date(b.released_at).getTime() - new Date(a.released_at).getTime();
      }
      return b.count - a.count;
    });

    this.expansionsData.set(setsList);
  }

  selectExpansion(name: string) {
    this.expansionSelected.emit(name);
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.updateSearchQuery(target.value);
    }
  }

  onSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.updateSortOrder(target.value);
    }
  }

  onStatusChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.updateStatusFilter(target.value);
    }
  }

  updateSearchQuery(val: string) {
    this.searchQuery.set(val);
    localStorage.setItem('mtg_tracker_hub_search', val);
  }

  updateSortOrder(val: string) {
    this.sortOrder.set(val);
    localStorage.setItem('mtg_tracker_hub_sort', val);
  }

  updateStatusFilter(val: string) {
    this.statusFilter.set(val);
    localStorage.setItem('mtg_tracker_hub_status', val);
  }
}

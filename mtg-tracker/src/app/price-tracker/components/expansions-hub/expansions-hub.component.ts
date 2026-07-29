import { Component, input, output, OnInit, effect, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IonGrid, IonRow, IonCol, IonCard, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-expansions-hub',
  standalone: true,
  imports: [IonGrid, IonRow, IonCol, IonCard, IonIcon, FormsModule],
  templateUrl: './expansions-hub.component.html',
  styleUrls: ['./expansions-hub.component.scss']
})
export class ExpansionsHubComponent implements OnInit {
  products = input<any[]>([]);
  onSelectExpansion = output<string>();

  expansionsData = signal<any[]>([]);
  loadingSets = signal<boolean>(true);
  private scryfallSetsCache: any[] = [];

  // Filters & Search
  searchQuery = signal<string>('');
  sortOrder = signal<string>('date-desc');
  statusFilter = signal<string>('all');
  timeWindowFilter = signal<'3months' | '6months' | '1year' | 'all'>('3months');

  updateTimeWindow(val: any) {
    this.timeWindowFilter.set(val);
    localStorage.setItem('mtg_tracker_hub_time_window', val);
    this.processExpansions(this.products());
  }

  filteredExpansionsData = computed(() => {
    let list = [...this.expansionsData()];
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const sort = this.sortOrder();

    if (query) {
      list = list.filter(e => e.name.toLowerCase().includes(query) || (e.code && e.code.toLowerCase().includes(query)));
    }

    if (status === 'preorder') {
      list = list.filter(e => e.isPreorder);
    } else if (status === 'released') {
      list = list.filter(e => !e.isPreorder);
    }

    if (sort === 'date-desc') {
      list.sort((a, b) => new Date(b.released_at || 0).getTime() - new Date(a.released_at || 0).getTime());
    } else if (sort === 'date-asc') {
      list.sort((a, b) => new Date(a.released_at || 0).getTime() - new Date(b.released_at || 0).getTime());
    } else if (sort === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'products-desc') {
      list.sort((a, b) => b.count - a.count);
    }

    return list;
  });

  constructor(private http: HttpClient) {
    effect(() => {
      const currentProducts = this.products();
      this.processExpansions(currentProducts);
    });
  }

  ngOnInit() {
    const savedQuery = localStorage.getItem('mtg_tracker_hub_search');
    if (savedQuery !== null) this.searchQuery.set(savedQuery);

    const savedSort = localStorage.getItem('mtg_tracker_hub_sort');
    if (savedSort !== null) this.sortOrder.set(savedSort);

    const savedStatus = localStorage.getItem('mtg_tracker_hub_status');
    if (savedStatus !== null) this.statusFilter.set(savedStatus);

    this.http.get('https://api.scryfall.com/sets').subscribe({
      next: (res: any) => {
        this.scryfallSetsCache = res.data || [];
        this.loadingSets.set(false);
        this.processExpansions(this.products());
      },
      error: (err) => {
        console.error("Scryfall fetch error", err);
        this.loadingSets.set(false);
      }
    });
  }

  processExpansions(productsList: any[]) {
    const todayStr = new Date().toISOString().split('T')[0];
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

    // Helper per trovare prodotti per nome set (gestendo differenze tra Scryfall e CardTrader ed evitando sovrapposizioni su set generici)
    const getSetProductsInfo = (setName: string) => {
      const normTarget = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
      let count = expProductsCount[setName] || 0;
      let cover = expCoverMap[setName] || null;

      // Parole generiche che non devono fare partial-match con sub-set (es: "Commander" non deve catturare "Commander 2018")
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

    const setsList: any[] = [];
    const addedNames = new Set<string>();

    const now = new Date();
    const threeMonthsAgoStr = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const sixMonthsAgoStr = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const oneYearAgoStr = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    const tw = this.timeWindowFilter();

    // 1. Trova tutte le espansioni principali in prevendita/future da Scryfall
    if (this.scryfallSetsCache.length > 0) {
      const futureScryfallSets = this.scryfallSetsCache.filter(s => {
        if (s.digital) return false;
        if (!s.released_at) return false;
        
        const nameLower = s.name.toLowerCase();

        // Escludiamo set generici/promo senza prodotti sigillati o promo come generic "Commander"
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

        setsList.push({
          name: s.name,
          code: s.code ? s.code.toUpperCase() : '',
          count: info.count,
          icon_svg_uri: s.icon_svg_uri || null,
          released_at: s.released_at,
          formattedDate: this.formatItalianDate(s.released_at),
          isPreorder: isPreorder,
          coverImage: cover
        });
      });
    }

    // 2. Aggiungi le espansioni presenti nel DB che non sono già state incluse (rispettando il filtro temporale)
    Object.keys(expProductsCount).forEach(expName => {
      if (!addedNames.has(expName.toLowerCase())) {
        let scryfallSet = this.scryfallSetsCache.find(s => s.name.toLowerCase() === expName.toLowerCase());
        if (!scryfallSet) {
          scryfallSet = this.scryfallSetsCache.find(s => 
            s.name.toLowerCase().includes(expName.toLowerCase()) || 
            expName.toLowerCase().includes(s.name.toLowerCase())
          );
        }

        const relDate = scryfallSet?.released_at || null;
        const isPreorder = relDate ? relDate >= todayStr : true;

        // Applica la finestra temporale (3 mesi, 6 mesi, 1 anno) anche alle espansioni presenti nel DB
        if (relDate) {
          if (tw === '3months' && relDate < threeMonthsAgoStr) return;
          if (tw === '6months' && relDate < sixMonthsAgoStr) return;
          if (tw === '1year' && relDate < oneYearAgoStr) return;
        }

        setsList.push({
          name: expName,
          code: scryfallSet?.code ? scryfallSet.code.toUpperCase() : '',
          count: expProductsCount[expName],
          icon_svg_uri: scryfallSet?.icon_svg_uri || null,
          released_at: relDate,
          formattedDate: relDate ? this.formatItalianDate(relDate) : 'In Arrivo',
          isPreorder: isPreorder,
          coverImage: expCoverMap[expName] || null
        });
      }
    });

    // 3. Ordina per data di uscita decrescente (le più lontane nel futuro in alto)
    setsList.sort((a, b) => {
      if (a.released_at && b.released_at) {
        return new Date(b.released_at).getTime() - new Date(a.released_at).getTime();
      }
      if (a.released_at) return -1;
      if (b.released_at) return 1;
      return 0;
    });

    this.expansionsData.set(setsList);
  }

  formatItalianDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const mesi = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    return `${d.getDate()} ${mesi[d.getMonth()]} ${d.getFullYear()}`;
  }

  selectExpansion(name: string) {
    this.onSelectExpansion.emit(name);
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

import { Component, OnInit, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  refresh, appsOutline, listOutline, cartOutline, cashOutline, gridOutline, 
  searchOutline, closeOutline, settingsOutline, optionsOutline, funnelOutline, 
  sparklesOutline, arrowBackOutline, chevronDownOutline, chevronUpOutline
} from 'ionicons/icons';
import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonContent,
  ToastController
} from '@ionic/angular/standalone';
import { BuyingSectionComponent } from './components/buying-section/buying-section.component';
import { SearchSectionComponent } from './components/search-section/search-section.component';
import { ExpansionsHubComponent } from './components/expansions-hub/expansions-hub.component';
import { FilterModalComponent, OldSchoolBannerComponent } from '../shared';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { MtgCategoryService } from './services/mtg-category.service';
import { StorageFilterService } from './services/storage-filter.service';
import { LanguageService } from './services/language.service';
import { environment } from 'src/environments/environment';
import {
  MtgProduct,
  PricePoint,
  FilterModalData,
  FilterModalSaveResult,
  ActiveSectionType,
  ViewModeType,
  FoilFilterType,
  LangFilterType,
  CondFilterType,
  IntentFilterType,
  MtgProductCategoryKey,
  TriggerAiResponse,
  PriceApiResponse,
  AutoDiscoverResponse
} from '../models';
import { formatItalianDate } from '../utils/date.utils';

@Component({
  selector: 'app-price-tracker',
  templateUrl: './price-tracker.page.html',
  styleUrls: ['./price-tracker.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButton,
    IonIcon,
    IonContent,
    BuyingSectionComponent,
    SearchSectionComponent,
    FilterModalComponent,
    OldSchoolBannerComponent,
    ExpansionsHubComponent
  ],
})
export class PriceTrackerPage implements OnInit {
  activeSection = signal<ActiveSectionType>('expansions-hub');
  selectedExpansionForDetail = signal<string>('');
  
  products = signal<MtgProduct[]>([]);
  loading = signal<boolean>(false);
  viewMode = signal<ViewModeType>('grid');
  sortMode = signal<string>('recent');
  gridColumns = signal<number>(4);
  firstLoadDone = signal<boolean>(false);

  // Filter editing modal state
  showFilterModal = signal<boolean>(false);
  selectedProduct = signal<FilterModalData | null>(null);
  foilFilter = signal<FoilFilterType>('any');
  langFilter = signal<LangFilterType>('any');
  condFilter = signal<CondFilterType>('any');
  intentFilter = signal<IntentFilterType>('buy');

  selectedExpansionFilter = signal<string>('all');
  selectedTypeFilter = signal<string>('all');
  selectedVerdictFilter = signal<string>('all');
  searchSealedQuery = signal<string>('');
  bargainThreshold = signal<number>(110);

  includeCollectorBoxes = signal<boolean>(true);
  includePlayBoxes = signal<boolean>(true);
  includePrereleasePacks = signal<boolean>(true);
  includeBundles = signal<boolean>(true);
  includeDraftNight = signal<boolean>(true);
  includeSceneBoxes = signal<boolean>(true);
  includeCommanderDecks = signal<boolean>(true);
  includeStarterDecks = signal<boolean>(true);
  includeOther = signal<boolean>(true);
  hideNAPrices = signal<boolean>(true);
  onlyOldSchool = signal<boolean>(false);
  minPriceFilter = signal<number | null>(null);
  maxPriceFilter = signal<number | null>(null);
  showMobileFilters = signal<boolean>(false);

  // Cached options for selects — populated from localStorage immediately, updated from Firestore
  private _cachedExpansions = signal<string[]>([]);
  private _cachedTypes = signal<string[]>([]);

  public categoryService = inject(MtgCategoryService);
  public storageService = inject(StorageFilterService);
  public langService = inject(LanguageService);
  private http = inject(HttpClient);
  private firestore = inject(Firestore);
  private toastController = inject(ToastController);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  t = computed(() => this.langService.t());
  categoryThresholds = computed(() => this.categoryService.categoryThresholds);

  uniqueExpansions = computed(() => {
    if (this._cachedExpansions().length > 0) return this._cachedExpansions();
    const sets = new Set<string>();
    this.products().forEach(p => {
      if (p.expansion) sets.add(p.expansion);
    });
    return Array.from(sets).sort();
  });

  uniqueTypes = computed(() => {
    if (this._cachedTypes().length > 0) return this._cachedTypes();
    const types = new Set<string>();
    this.products().forEach(p => {
      const typeInfo = this.detectMtgType(p.nome);
      types.add(typeInfo.nameType);
    });
    return Array.from(types).sort();
  });

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.searchSealedQuery() && this.searchSealedQuery().trim()) count++;
    const minP = this.minPriceFilter();
    if (minP && minP > 0) count++;
    const maxP = this.maxPriceFilter();
    if (maxP && maxP > 0) count++;
    if (this.selectedExpansionFilter() !== 'all') count++;
    if (this.selectedTypeFilter() !== 'all') count++;
    if (this.selectedVerdictFilter() !== 'all') count++;
    if (this.hideNAPrices()) count++;
    if (this.onlyOldSchool()) count++;
    return count;
  });

  productsSorted = computed(() => {
    const list = [...this.products()];
    switch (this.sortMode()) {
      case 'name':
        return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      case 'release-date':
        return list.sort((a, b) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : Infinity;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : Infinity;
          return dateA - dateB;
        });
      case 'price-ascending':
        return list.sort((a, b) => (a.prezzoAttuale || 0) - (b.prezzoAttuale || 0));
      case 'price-descending':
        return list.sort((a, b) => (b.prezzoAttuale || 0) - (a.prezzoAttuale || 0));
      case 'variation-best':
        return list.sort((a, b) => this.calculateValueVariation(b) - this.calculateValueVariation(a));
      case 'variation-worst':
        return list.sort((a, b) => this.calculateValueVariation(a) - this.calculateValueVariation(b));
      case 'recent':
      default:
        return list.reverse();
    }
  });

  allSealedProducts = computed(() => {
    let list = [...this.productsSorted()].filter(p => this.categoryService.isSealedProduct(p.nome));
    const q = (this.searchSealedQuery() || '').toLowerCase().trim();

    if (!this.includeCollectorBoxes()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'collector-box');
    }
    if (!this.includePlayBoxes()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'play-box');
    }
    if (!this.includePrereleasePacks()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'prerelease');
    }
    if (!this.includeBundles()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'bundle');
    }
    if (!this.includeDraftNight()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'draft-night');
    }
    if (!this.includeSceneBoxes()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'scene-box');
    }
    if (!this.includeCommanderDecks()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'commander-deck');
    }
    if (!this.includeStarterDecks()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'starter-deck');
    }
    if (!this.includeOther()) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'other');
    }

    if (this.onlyOldSchool()) {
      list = list.filter(p => this.categoryService.isOldSchool(p));
    }

    if (q) {
      list = list.filter(p => (p.nome || '').toLowerCase().includes(q) || (p.expansion || '').toLowerCase().includes(q));
    }
    const minP = this.minPriceFilter();
    if (minP !== null && !isNaN(minP) && minP > 0) {
      list = list.filter(p => (p.prezzoAttuale || 0) >= minP);
    }
    const maxP = this.maxPriceFilter();
    if (maxP !== null && !isNaN(maxP) && maxP > 0) {
      list = list.filter(p => (p.prezzoAttuale || 0) <= maxP);
    }
    const expFilter = this.selectedExpansionFilter();
    if (expFilter !== 'all') {
      list = list.filter(p => p.expansion === expFilter);
    }
    const typeFilter = this.selectedTypeFilter();
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter(p => p.nome && (
        this.detectMtgType(p.nome).key === typeFilter ||
        this.detectMtgType(p.nome).nameType === typeFilter
      ));
    }
    const verdictFilter = this.selectedVerdictFilter();
    if (verdictFilter && verdictFilter !== 'all') {
      list = list.filter(p => p.ai_verdict && p.ai_verdict.toLowerCase().includes(verdictFilter.toLowerCase()));
    }
    if (this.hideNAPrices()) {
      list = list.filter(p => p.prezzoAttuale !== null && p.prezzoAttuale !== undefined && p.prezzoAttuale > 0);
    }
    return list;
  });

  bargainProducts = computed(() => {
    const list = this.allSealedProducts().filter(p => {
      const price = p.prezzoAttuale;
      if (!price || price <= 0) return false;

      // 1. AI Gemini COMPRA Recommendation
      if (p.ai_verdict && p.ai_verdict.toUpperCase().includes('COMPRA')) {
        return true;
      }

      // 2. Below category threshold
      const catInfo = this.detectMtgType(p.nome);
      const threshold = this.categoryService.categoryThresholds[catInfo.key] || catInfo.defaultThreshold;
      return price <= threshold;
    });

    return list.sort((a, b) => {
      const isAiA = a.ai_verdict && a.ai_verdict.toUpperCase().includes('COMPRA');
      const isAiB = b.ai_verdict && b.ai_verdict.toUpperCase().includes('COMPRA');
      if (isAiA && !isAiB) return -1;
      if (!isAiA && isAiB) return 1;
      return (a.prezzoAttuale || 0) - (b.prezzoAttuale || 0);
    });
  });

  productsForExpansionDetail = computed(() => {
    const exp = this.selectedExpansionForDetail();
    if (!exp) return [];
    const normTarget = exp.toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.productsSorted().filter(p => {
      if (!p.expansion) return false;
      const normExp = p.expansion.toLowerCase().replace(/[^a-z0-9]/g, '');
      return p.expansion.toLowerCase() === exp.toLowerCase() || normExp === normTarget;
    });
  });

  constructor() {
    addIcons({ 
      refresh, appsOutline, listOutline, cartOutline, cashOutline, gridOutline, 
      searchOutline, closeOutline, settingsOutline, optionsOutline, funnelOutline, 
      sparklesOutline, arrowBackOutline, chevronDownOutline, chevronUpOutline 
    });

    const s = this.storageService.loadFilterState();
    this.includeCollectorBoxes.set(s.includeCollectorBoxes);
    this.includePlayBoxes.set(s.includePlayBoxes);
    this.includePrereleasePacks.set(s.includePrereleasePacks);
    this.includeBundles.set(s.includeBundles);
    this.includeDraftNight.set(s.includeDraftNight);
    this.includeSceneBoxes.set(s.includeSceneBoxes);
    this.includeCommanderDecks.set(s.includeCommanderDecks);
    this.includeStarterDecks.set(s.includeStarterDecks);
    this.includeOther.set(s.includeOther);
    this.hideNAPrices.set(s.hideNAPrices);
    this.onlyOldSchool.set(s.onlyOldSchool);

    // Auto-save changes to StorageFilterService
    effect(() => {
      this.storageService.saveFilterState({
        includeCollectorBoxes: this.includeCollectorBoxes(),
        includePlayBoxes: this.includePlayBoxes(),
        includePrereleasePacks: this.includePrereleasePacks(),
        includeBundles: this.includeBundles(),
        includeDraftNight: this.includeDraftNight(),
        includeSceneBoxes: this.includeSceneBoxes(),
        includeCommanderDecks: this.includeCommanderDecks(),
        includeStarterDecks: this.includeStarterDecks(),
        includeOther: this.includeOther(),
        hideNAPrices: this.hideNAPrices(),
        onlyOldSchool: this.onlyOldSchool()
      });
    });
  }

  getExpansionReleaseDate(expName: string): string {
    const prod = this.products().find(p => p.expansion && p.expansion.toLowerCase() === expName.toLowerCase() && p.releaseDate);
    return prod?.releaseDate ? formatItalianDate(prod.releaseDate) : '';
  }

  ngOnInit() {
    const savedVista = localStorage.getItem('mtg_tracker_vista') as ViewModeType;
    if (savedVista) this.viewMode.set(savedVista);

    const savedOrd = localStorage.getItem('mtg_tracker_ordinamento');
    if (savedOrd) this.sortMode.set(savedOrd);

    const savedCols = localStorage.getItem('mtg_tracker_colonne');
    if (savedCols) this.gridColumns.set(parseInt(savedCols, 10));

    const savedThreshold = localStorage.getItem('mtg_tracker_soglia_affari');
    if (savedThreshold) this.bargainThreshold.set(parseFloat(savedThreshold));

    try {
      const cachedExps = localStorage.getItem('mtg_tracker_unique_expansions');
      if (cachedExps) this._cachedExpansions.set(JSON.parse(cachedExps));
      const cachedTyps = localStorage.getItem('mtg_tracker_unique_types');
      if (cachedTyps) this._cachedTypes.set(JSON.parse(cachedTyps));
    } catch (e) {
      console.warn('Could not restore cached options from localStorage:', e);
    }

    this.route.queryParams.subscribe(params => {
      if (params['set']) {
        if (this.selectedExpansionForDetail() !== params['set']) {
          this.selectedExpansionForDetail.set(params['set']);
        }
        if (this.activeSection() !== 'expansion-detail') {
          this.activeSection.set('expansion-detail');
        }
      } else if (params['section']) {
        const sec = params['section'] as ActiveSectionType;
        if (this.activeSection() !== sec) {
          this.activeSection.set(sec);
        }
        if (this.selectedExpansionForDetail() !== '') {
          this.selectedExpansionForDetail.set('');
        }
      }
    });

    const productsCollection = collection(this.firestore, 'products');
    collectionData(productsCollection).subscribe({
      next: (data: unknown[]) => {
        const prodList = (data || []) as MtgProduct[];
        this.products.set(prodList);
        this.deduplicatePriceHistory();
        this.purgeFoundations();
        // Update and persist select options cache
        const exps = Array.from(new Set(this.products().filter(p => p.expansion).map(p => p.expansion!))).sort();
        const typs = Array.from(new Set(this.products().map(p => this.detectMtgType(p.nome).nameType))).sort();
        this._cachedExpansions.set(exps);
        this._cachedTypes.set(typs);
        localStorage.setItem('mtg_tracker_unique_expansions', JSON.stringify(exps));
        localStorage.setItem('mtg_tracker_unique_types', JSON.stringify(typs));
        if (!this.firstLoadDone()) {
          this.firstLoadDone.set(true);
        }
      },
      error: (err) => {
        console.error('[Firestore Error] Failed to fetch products collection:', err);
      }
    });
  }

  purgeFoundations() {
    this.products().forEach(p => {
      const name = (p.nome || '').toLowerCase();
      const exp = (p.expansion || '').toLowerCase();
      if (name.includes('foundations') || exp.includes('foundations')) {
        const docRef = doc(this.firestore, 'products', p.id);
        deleteDoc(docRef).catch(err => console.error('Error purging Foundations:', err));
      }
    });
  }

  updateCategoryThreshold(key: string, val: string | number) {
    const num = typeof val === 'number' ? val : parseFloat(val);
    this.categoryService.updateThreshold(key as MtgProductCategoryKey, num);
  }

  detectMtgType(name: string) {
    return this.categoryService.detectCategory(name);
  }

  handleCardSelected(mappedCard: FilterModalData) {
    this.selectedProduct.set(mappedCard);
    this.foilFilter.set('any');
    this.langFilter.set('any');
    this.condFilter.set('any');
    this.intentFilter.set('buy');
    this.showFilterModal.set(true);
  }

  openEditFilters(product: MtgProduct) {
    this.selectedProduct.set({
      id: product.id,
      name: product.nome,
      url: product.url,
      image: product.immagine,
      isNew: false,
      foil: product.foil,
      lingua: product.lingua,
      condizione: product.condizione,
      sezione: product.sezione
    });
    this.foilFilter.set(product.foil === true ? 'foil' : product.foil === false ? 'normal' : 'any');
    this.langFilter.set((product.lingua as LangFilterType) || 'any');
    this.condFilter.set((product.condizione as CondFilterType) || 'any');
    this.intentFilter.set(product.sezione || 'buy');
    this.showFilterModal.set(true);
  }

  handleSaveFilters(event: FilterModalSaveResult) {
    const sel = this.selectedProduct();
    if (!sel || !sel.id) return;

    const foilVal = event.foil === 'foil' ? true : (event.foil === 'normal' ? false : null);
    const langVal = event.lang === 'any' ? null : event.lang;
    const condVal = event.cond === 'any' ? null : event.cond;

    if (sel.isNew) {
      const newProduct: MtgProduct = {
        id: sel.id,
        nome: sel.name || sel.nome || '',
        prezzoAttuale: null,
        storico: [],
        url: sel.url || '',
        immagine: sel.image || sel.immagine,
        sezione: event.intent,
        foil: foilVal,
        lingua: langVal || undefined,
        condizione: condVal || undefined,
        releaseDate: undefined
      };

      if (!this.products().find(p => p.id === newProduct.id)) {
        const docRef = doc(this.firestore, 'products', newProduct.id);
        setDoc(docRef, newProduct).then(() => {
          this.activeSection.set('all-sealed');
          this.onSezioneChange();
          this.updateSingleProductPrice(newProduct, true);
        }).catch(err => console.error('Error adding product:', err));
      } else {
        alert('Product already tracked!');
      }
    } else {
      const updatedProduct: Partial<MtgProduct> = {
        foil: foilVal,
        lingua: langVal || undefined,
        condizione: condVal || undefined,
        sezione: event.intent
      };

      const docRef = doc(this.firestore, 'products', sel.id);
      setDoc(docRef, updatedProduct, { merge: true }).then(() => {
        const existing = this.products().find(p => p.id === sel.id);
        if (existing) {
          const merged: MtgProduct = { ...existing, ...updatedProduct };
          this.updateSingleProductPrice(merged, true);
        }
      }).catch(err => console.error('Error updating product filters in Firestore:', err));
    }

    this.showFilterModal.set(false);
  }

  handleCloseFilters() {
    this.showFilterModal.set(false);
  }

  enableAllCategories() {
    this.includeCollectorBoxes.set(true);
    this.includePlayBoxes.set(true);
    this.includePrereleasePacks.set(true);
    this.includeBundles.set(true);
    this.includeDraftNight.set(true);
    this.includeSceneBoxes.set(true);
    this.includeCommanderDecks.set(true);
    this.includeStarterDecks.set(true);
    this.includeOther.set(true);
  }

  disableAllCategories() {
    this.includeCollectorBoxes.set(false);
    this.includePlayBoxes.set(false);
    this.includePrereleasePacks.set(false);
    this.includeBundles.set(false);
    this.includeDraftNight.set(false);
    this.includeSceneBoxes.set(false);
    this.includeCommanderDecks.set(false);
    this.includeStarterDecks.set(false);
    this.includeOther.set(false);
  }

  resetAllFilters() {
    this.searchSealedQuery.set('');
    this.minPriceFilter.set(null);
    this.maxPriceFilter.set(null);
    this.selectedExpansionFilter.set('all');
    this.selectedTypeFilter.set('all');
    this.selectedVerdictFilter.set('all');
    this.hideNAPrices.set(false);
    this.onlyOldSchool.set(false);
    this.enableAllCategories();
  }

  addProduct(productData: { url: string; releaseDate: string }, intento: 'buy' | 'sell' = 'buy') {
    const rawUrl = productData.url.trim();
    const releaseDate = productData.releaseDate ? productData.releaseDate.trim() : undefined;
    const match = rawUrl.match(/\/cards\/(\d+)/);

    if (match && match[1]) {
      const id = match[1];
      const existingProduct = this.products().find((p) => p.id === id);

      if (!existingProduct) {
        this.loading.set(true);
        this.http.get<PriceApiResponse>(`${environment.apiBaseUrl}/prezzo/${id}`).subscribe({
          next: (res) => {
            const cleanUrl = rawUrl.split('?')[0];
            const cleanName = cleanUrl.split('/').pop()?.replace(/-/g, ' ') || 'New Card';
            const initialHistorical: PricePoint[] = res.prezzo ? [{
              data: new Date().toLocaleDateString(),
              prezzo: res.prezzo,
              timestamp: Date.now()
            }] : [];

            const newProduct: MtgProduct = {
              id: id,
              nome: cleanName,
              prezzoAttuale: res.prezzo || null,
              storico: initialHistorical,
              url: cleanUrl,
              sezione: intento,
              releaseDate: releaseDate
            };

            const docRef = doc(this.firestore, 'products', id);
            setDoc(docRef, newProduct).then(() => {
              this.loading.set(false);
            }).catch(err => {
              this.loading.set(false);
              console.error('Error adding product to Firestore:', err);
            });
          },
          error: (err) => {
            this.loading.set(false);
            console.error('Error fetching initial price from backend:', err);
            alert('Error fetching initial price from backend.');
          }
        });
      } else {
        alert('Product already tracked!');
      }
    } else {
      alert('Invalid URL. Make sure to paste a valid CardTrader card product URL.');
    }
  }

  updateSingleProductPrice(product: MtgProduct, force: boolean = false): Promise<void> {
    return new Promise<void>((resolve) => {
      const COOLDOWN_MS = 12 * 60 * 60 * 1000;
      const now = Date.now();

      if (!force && product.prezzoAttuale && product.storico && product.storico.length > 0) {
        const lastPoint = product.storico[product.storico.length - 1];
        const lastTimestamp = lastPoint.timestamp || new Date(lastPoint.data).getTime();
        if ((now - lastTimestamp) <= COOLDOWN_MS) {
          resolve();
          return;
        }
      }

      const params: string[] = [];
      if (product.foil === true) params.push('foil=true');
      if (product.foil === false) params.push('foil=false');
      if (product.lingua) params.push(`lang=${product.lingua}`);
      if (product.condizione) params.push(`cond=${encodeURIComponent(product.condizione)}`);
      const queryStr = params.length > 0 ? '?' + params.join('&') : '';

      this.http
        .get<PriceApiResponse>(`${environment.apiBaseUrl}/prezzo/${product.id}${queryStr}`)
        .subscribe({
          next: (res) => {
            const updatedProduct: MtgProduct = { ...product };
            if (res.prezzo) {
              updatedProduct.prezzoAttuale = res.prezzo;
              if (!updatedProduct.storico) {
                updatedProduct.storico = [];
              }
              const todayDate = new Date().toLocaleDateString();
              const existingPoint = updatedProduct.storico.find(s => s.data === todayDate);
              if (existingPoint) {
                existingPoint.prezzo = res.prezzo;
                existingPoint.timestamp = now;
              } else {
                updatedProduct.storico.push({
                  data: todayDate,
                  prezzo: res.prezzo,
                  timestamp: now
                });
              }
            }

            const docRef = doc(this.firestore, 'products', product.id);
            setDoc(docRef, updatedProduct, { merge: true })
              .then(() => resolve())
              .catch(err => {
                console.error(`Error saving product ${product.id} to Firestore:`, err);
                resolve();
              });
          },
          error: (err) => {
            console.error(`Error updating product ${product.id}:`, err);
            resolve();
          }
        });
    });
  }

  updatePrices() {
    this.loading.set(true);
    let listToUpdate: MtgProduct[] = [];
    
    if (this.activeSection() === 'expansion-detail') {
      listToUpdate = this.productsForExpansionDetail();
    } else {
      listToUpdate = this.allSealedProducts();
    }

    const updates = listToUpdate.map((product) => {
      return this.updateSingleProductPrice(product, true);
    });

    Promise.all(updates).then(() => {
      this.loading.set(false);
    });
  }

  triggerAiAgent() {
    this.loading.set(true);
    this.http.get<TriggerAiResponse>(`${environment.apiBaseUrl}/trigger-ai`).subscribe({
      next: async (res) => {
        this.loading.set(false);
        const toast = await this.toastController.create({
          message: res.message || '⚡ Scansione AI e aggiornamento completati!',
          duration: 4000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      },
      error: async (err) => {
        this.loading.set(false);
        console.error('Errore trigger AI:', err);
        const errorMsg = err.error?.message || err.error?.error || '⚠️ La Scansione IA è protetta da rate-limiting. Attendi 5 minuti tra le chiamate.';
        const toast = await this.toastController.create({
          message: errorMsg,
          duration: 4500,
          color: err.status === 429 ? 'warning' : 'primary',
          position: 'top'
        });
        await toast.present();
      }
    });
  }

  removeProduct(id: string) {
    const product = this.products().find((p) => p.id === id);
    const productName = product ? product.nome : 'this product';
    if (confirm(`Are you sure you want to stop tracking "${productName}"?`)) {
      const docRef = doc(this.firestore, 'products', id);
      deleteDoc(docRef).catch(err => console.error('Error deleting product:', err));
    }
  }

  deduplicatePriceHistory() {
    let modified = false;
    this.products().forEach(p => {
      if (p.storico && p.storico.length > 0) {
        const dateMap = new Map<string, PricePoint>();
        p.storico.forEach(point => {
          const dateKey = point.data;
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, point);
          } else {
            const existingPoint = dateMap.get(dateKey)!;
            const tExisting = existingPoint.timestamp || 0;
            const tNew = point.timestamp || 0;
            if (tNew >= tExisting) {
              dateMap.set(dateKey, point);
            }
            modified = true;
          }
        });

        if (modified) {
          p.storico = Array.from(dateMap.values()).sort((a, b) => {
            const tA = a.timestamp || 0;
            const tB = b.timestamp || 0;
            return tA - tB;
          });
        }
      }
    });
  }

  calculateValueVariation(item: MtgProduct): number {
    if (!item.storico || item.storico.length < 2) return 0;
    const initialPrice = item.storico[0].prezzo;
    const currentPrice = item.prezzoAttuale;
    if (!initialPrice || !currentPrice) return 0;
    return ((currentPrice - initialPrice) / initialPrice) * 100;
  }

  toggleMobileFilters() {
    this.showMobileFilters.update(v => !v);
  }

  updateBargainThreshold(val: string | number) {
    const num = typeof val === 'number' ? val : parseFloat(val);
    const threshold = isNaN(num) ? 110 : num;
    this.bargainThreshold.set(threshold);
    localStorage.setItem('mtg_tracker_soglia_affari', threshold.toString());
  }

  saveProduct(product: MtgProduct) {
    const docRef = doc(this.firestore, 'products', product.id);
    setDoc(docRef, product).catch(err => console.error('Error saving product to Firestore:', err));
  }

  onVistaChange(mode: ViewModeType) {
    this.viewMode.set(mode);
    localStorage.setItem('mtg_tracker_vista', mode);
  }

  onOrdinamentoChange(mode: string) {
    this.sortMode.set(mode);
    localStorage.setItem('mtg_tracker_ordinamento', mode);
  }

  onSezioneChange(sec?: ActiveSectionType) {
    if (sec) this.activeSection.set(sec);
    const current = this.activeSection();
    localStorage.setItem('mtg_tracker_sezione', current);
    this.selectedExpansionFilter.set('all');
    this.selectedTypeFilter.set('all');
    this.router.navigate([], { relativeTo: this.route, queryParams: { set: null, section: current }, replaceUrl: true });
  }

  onColonneGridChange(cols: number) {
    this.gridColumns.set(cols);
    localStorage.setItem('mtg_tracker_colonne', cols.toString());
  }

  openExpansionDetail(expName: string) {
    this.selectedExpansionForDetail.set(expName);
    this.activeSection.set('expansion-detail');
    localStorage.setItem('mtg_tracker_sezione', 'expansion-detail');
    this.router.navigate([], { relativeTo: this.route, queryParams: { set: expName }, replaceUrl: true });

    const normTarget = expName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = this.products().filter(p => p.expansion && (
      p.expansion.toLowerCase() === expName.toLowerCase() ||
      p.expansion.toLowerCase().replace(/[^a-z0-9]/g, '') === normTarget
    ));
    if (existing.length === 0) {
      this.autoDiscoverExpansion(expName);
    }
  }

  autoDiscoverExpansion(expName: string) {
    this.loading.set(true);
    this.http.get<AutoDiscoverResponse>(`${environment.apiBaseUrl}/discover-expansion-sealed?name=${encodeURIComponent(expName)}`).subscribe({
      next: async (res) => {
        this.loading.set(false);
        const toast = await this.toastController.create({
          message: res.message || `🤖 Ricerca automatica per '${expName}' completata!`,
          duration: 3500,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      },
      error: async (err) => {
        this.loading.set(false);
        console.error('Errore auto-discovery:', err);
      }
    });
  }

  triggerRePullExpansion() {
    const exp = this.selectedExpansionForDetail();
    if (!exp) return;
    this.autoDiscoverExpansion(exp);
  }

  backToHub() {
    this.activeSection.set('expansions-hub');
    this.selectedExpansionForDetail.set('');
    localStorage.setItem('mtg_tracker_sezione', 'expansions-hub');
    this.router.navigate([], { relativeTo: this.route, queryParams: { set: null, section: null }, replaceUrl: true });
  }

  // --- TYPED TEMPLATE HANDLERS (ZERO $any) ---
  onSearchSealedInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target) this.searchSealedQuery.set(target.value);
  }

  onMinPriceInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.minPriceFilter.set(target?.value ? parseFloat(target.value) : null);
  }

  onMaxPriceInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.maxPriceFilter.set(target?.value ? parseFloat(target.value) : null);
  }

  onExpansionFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) this.selectedExpansionFilter.set(target.value);
  }

  onTypeFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) this.selectedTypeFilter.set(target.value);
  }

  onVerdictFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) this.selectedVerdictFilter.set(target.value);
  }

  onOrdinamentoSelect(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) this.onOrdinamentoChange(target.value);
  }

  onCategoryCheckboxChange(key: 'collector' | 'play' | 'prerelease' | 'bundle' | 'draft' | 'scene' | 'commander' | 'starter' | 'other', event: Event) {
    const target = event.target as HTMLInputElement;
    const checked = target?.checked ?? false;
    switch (key) {
      case 'collector': this.includeCollectorBoxes.set(checked); break;
      case 'play': this.includePlayBoxes.set(checked); break;
      case 'prerelease': this.includePrereleasePacks.set(checked); break;
      case 'bundle': this.includeBundles.set(checked); break;
      case 'draft': this.includeDraftNight.set(checked); break;
      case 'scene': this.includeSceneBoxes.set(checked); break;
      case 'commander': this.includeCommanderDecks.set(checked); break;
      case 'starter': this.includeStarterDecks.set(checked); break;
      case 'other': this.includeOther.set(checked); break;
    }
  }

  onHideNAChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.hideNAPrices.set(target?.checked ?? false);
  }

  onOnlyOldSchoolChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.onlyOldSchool.set(target?.checked ?? false);
  }

  onCategoryThresholdChange(key: string, event: Event) {
    const target = event.target as HTMLInputElement;
    if (target && target.value) {
      this.updateCategoryThreshold(key, target.value);
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  refresh, appsOutline, listOutline, cartOutline, cashOutline, gridOutline, 
  searchOutline, closeOutline, settingsOutline, optionsOutline, funnelOutline, 
  sparklesOutline, arrowBackOutline 
} from 'ionicons/icons';
import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonContent,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  ToastController
} from '@ionic/angular/standalone';
import { BuyingSectionComponent } from './components/buying-section/buying-section.component';
import { SellingSectionComponent } from './components/selling-section/selling-section.component';
import { SearchSectionComponent } from './components/search-section/search-section.component';
import { FilterModalComponent } from './components/filter-modal/filter-modal.component';
import { ExpansionsHubComponent } from './components/expansions-hub/expansions-hub.component';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { MtgCategoryService } from './services/mtg-category.service';
import { StorageFilterService } from './services/storage-filter.service';
import { LanguageService } from './services/language.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-price-tracker',
  templateUrl: './price-tracker.page.html',
  styleUrls: ['./price-tracker.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonButton,
    IonIcon,
    IonContent,
    BuyingSectionComponent,
    SearchSectionComponent,
    FilterModalComponent,
    ExpansionsHubComponent
  ],
})
export class PriceTrackerPage implements OnInit {
  activeSection: 'expansions-hub' | 'expansion-detail' | 'all-sealed' | 'bargains' | 'search' = 'expansions-hub';
  selectedExpansionForDetail: string = '';
  
  products: any[] = [];
  loading: boolean = false;
  viewMode: 'grid' | 'table' = 'grid';
  sortMode: string = 'recent';
  gridColumns: number = 4;
  firstLoadDone: boolean = false;

  // Filter editing modal state
  showFilterModal: boolean = false;
  selectedProduct: any = null;
  foilFilter: 'any' | 'normal' | 'foil' = 'any';
  langFilter: 'any' | 'it' | 'en' = 'any';
  condFilter: 'any' | 'Near Mint' = 'any';
  intentFilter: 'buy' | 'sell' = 'buy';

  selectedExpansionFilter: string = 'all';
  selectedTypeFilter: string = 'all';
  selectedVerdictFilter: string = 'all';
  searchSealedQuery: string = '';
  bargainThreshold: number = 110;

  includeCollectorBoxes: boolean = true;
  includePlayBoxes: boolean = true;
  includePrereleasePacks: boolean = true;
  includeBundles: boolean = true;
  includeDraftNight: boolean = true;
  includeSceneBoxes: boolean = false;
  includeCommanderDecks: boolean = false;
  includeStarterDecks: boolean = false;
  minPriceFilter: number | null = null;
  maxPriceFilter: number | null = null;

  constructor(
    private http: HttpClient, 
    private firestore: Firestore, 
    private toastController: ToastController,
    private route: ActivatedRoute,
    private router: Router,
    public categoryService: MtgCategoryService,
    public storageService: StorageFilterService,
    public langService: LanguageService
  ) {
    addIcons({ 
      refresh, appsOutline, listOutline, cartOutline, cashOutline, gridOutline,
      searchOutline, closeOutline, settingsOutline, optionsOutline, funnelOutline, sparklesOutline, arrowBackOutline 
    });
  }

  get t() {
    return this.langService.t();
  }

  get categoryThresholds() {
    return this.categoryService.categoryThresholds;
  }

  ngOnInit() {
    this.viewMode = this.storageService.getVistaMode();

    const state = this.storageService.loadFilterState();
    this.selectedExpansionFilter = state.expansionFilter;
    this.selectedTypeFilter = state.typeFilter;
    this.selectedVerdictFilter = state.verdictFilter;
    this.includeCollectorBoxes = state.includeCollectorBoxes;
    this.includePlayBoxes = state.includePlayBoxes;
    this.includePrereleasePacks = state.includePrereleasePacks;
    this.includeBundles = state.includeBundles;
    this.includeDraftNight = state.includeDraftNight;
    this.includeSceneBoxes = state.includeSceneBoxes;
    this.includeCommanderDecks = state.includeCommanderDecks;
    this.includeStarterDecks = state.includeStarterDecks;
    this.searchSealedQuery = state.searchQuery;
    this.minPriceFilter = state.minPrice;
    this.maxPriceFilter = state.maxPrice;
    this.sortMode = state.sortMode;

    const savedCols = localStorage.getItem('mtg_tracker_colonne');
    if (savedCols) {
      this.gridColumns = parseInt(savedCols, 10) || 4;
    }

    // Dynamic URL QueryParams Listener (Browser Back Button & Direct URL Links Support)
    this.route.queryParams.subscribe(params => {
      if (params['set']) {
        this.selectedExpansionForDetail = params['set'];
        this.activeSection = 'expansion-detail';
      } else if (params['section']) {
        this.activeSection = params['section'];
        this.selectedExpansionForDetail = '';
      } else {
        this.activeSection = 'expansions-hub';
        this.selectedExpansionForDetail = '';
      }
    });

    const productsCollection = collection(this.firestore, 'products');
    collectionData(productsCollection).subscribe({
      next: (data: any[]) => {
        this.products = data || [];
        this.deduplicatePriceHistory();
        this.purgeFoundations();
        if (!this.firstLoadDone) {
          this.firstLoadDone = true;
        }
      },
      error: (err) => console.error('Error fetching Firestore products:', err)
    });
  }

  purgeFoundations() {
    this.products.forEach(p => {
      const name = (p.nome || '').toLowerCase();
      const exp = (p.expansion || '').toLowerCase();
      if (name.includes('foundations') || exp.includes('foundations')) {
        const docRef = doc(this.firestore, 'products', p.id);
        deleteDoc(docRef).catch(err => console.error('Error purging Foundations:', err));
      }
    });
  }

  updateCategoryThreshold(key: string, val: any) {
    this.categoryService.updateThreshold(key as any, parseFloat(val));
  }

  onFiltroChange() {
    this.storageService.saveFilterState({
      expansionFilter: this.selectedExpansionFilter,
      typeFilter: this.selectedTypeFilter,
      verdictFilter: this.selectedVerdictFilter,
      includeCollectorBoxes: this.includeCollectorBoxes,
      includePlayBoxes: this.includePlayBoxes,
      includePrereleasePacks: this.includePrereleasePacks,
      includeBundles: this.includeBundles,
      includeDraftNight: this.includeDraftNight,
      includeSceneBoxes: this.includeSceneBoxes,
      includeCommanderDecks: this.includeCommanderDecks,
      includeStarterDecks: this.includeStarterDecks,
      searchQuery: this.searchSealedQuery,
      minPrice: this.minPriceFilter,
      maxPrice: this.maxPriceFilter,
      sortMode: this.sortMode
    });
  }

  detectMtgType(name: string) {
    return this.categoryService.detectCategory(name);
  }

  handleCardSelected(mappedCard: any) {
    this.selectedProduct = mappedCard;
    this.foilFilter = 'any';
    this.langFilter = 'any';
    this.condFilter = 'any';
    this.intentFilter = 'buy';
    this.showFilterModal = true;
  }

  openEditFilters(product: any) {
    this.selectedProduct = product;
    this.foilFilter = product.foil === true ? 'foil' : product.foil === false ? 'normal' : 'any';
    this.langFilter = product.lingua || 'any';
    this.condFilter = product.condizione || 'any';
    this.intentFilter = product.intento;
    this.selectedProduct.isNew = false;
    this.showFilterModal = true;
  }

  handleSaveFilters(event: { foil: boolean | null; lang: string | null; cond: string | null; intent: 'buy' | 'sell' }) {
    if (!this.selectedProduct) return;

    if (this.selectedProduct.isNew) {
      const newProduct = {
        id: this.selectedProduct.id,
        nome: this.selectedProduct.name,
        prezzoAttuale: null,
        storico: [],
        url: this.selectedProduct.url,
        immagine: this.selectedProduct.image,
        dataInserimento: new Date().toLocaleDateString(),
        intento: event.intent,
        foil: event.foil,
        lingua: event.lang,
        condizione: event.cond,
        releaseDate: undefined
      };

      if (!this.products.find(p => p.id === newProduct.id)) {
        const docRef = doc(this.firestore, 'products', newProduct.id);
        setDoc(docRef, newProduct).then(() => {
          this.activeSection = 'all-sealed';
          this.onSezioneChange();
          this.updateSingleProductPrice(newProduct, true);
        }).catch(err => console.error('Error adding product:', err));
      } else {
        alert('Product already tracked!');
      }
    } else {
      const updatedProduct = {
        ...this.selectedProduct,
        foil: event.foil,
        lingua: event.lang,
        condizione: event.cond,
        intento: event.intent,
        prezzoAttuale: null,
        storico: []
      };
      
      const docRef = doc(this.firestore, 'products', updatedProduct.id);
      setDoc(docRef, updatedProduct).then(() => {
        this.updateSingleProductPrice(updatedProduct, true);
      }).catch(err => console.error('Error updating product:', err));
    }

    this.showFilterModal = false;
    this.selectedProduct = null;
  }

  getExpansionReleaseDate(expansionName: string): string | null {
    if (!expansionName) return null;
    const p = this.products.find(item => item.expansion === expansionName && item.releaseDate);
    if (p && p.releaseDate) {
      try {
        const parts = p.releaseDate.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return p.releaseDate;
      } catch (e) {
        return p.releaseDate;
      }
    }
    return null;
  }

  handleCloseFilters() {
    this.showFilterModal = false;
    this.selectedProduct = null;
  }

  addManualProduct(intent: 'buy' | 'sell', target: string | { url: string; releaseDate?: string }) {
    const url = typeof target === 'string' ? target : target.url;
    const releaseDate = typeof target === 'string' ? undefined : target.releaseDate;
    if (!url) return;
    
    const regex = /cards\/(\d+)-(.+)/;
    const match = url.match(regex);

    if (match) {
      const id = match[1];
      const name = match[2].replace(/-/g, ' ').toUpperCase();

      if (!this.products.find((p) => p.id === id)) {
        const newProduct = {
          id: id,
          nome: name,
          prezzoAttuale: null,
          storico: [],
          url: url,
          dataInserimento: new Date().toLocaleDateString(),
          intento: intent,
          foil: null,
          lingua: null,
          condizione: null,
          releaseDate: releaseDate
        };

        const docRef = doc(this.firestore, 'products', id);
        setDoc(docRef, newProduct).then(() => {
          this.updateSingleProductPrice(newProduct, true);
        }).catch(err => console.error('Error manual adding:', err));
      } else {
        alert('Product already tracked!');
      }
    } else {
      alert('Invalid URL. Make sure to paste a valid CardTrader card product URL.');
    }
  }

  updateSingleProductPrice(product: any, force: boolean = false): Promise<void> {
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
        .get(`${environment.apiBaseUrl}/prezzo/${product.id}${queryStr}`)
        .subscribe({
          next: (res: any) => {
            const updatedProduct = { ...product };
            if (res.prezzo) {
              updatedProduct.prezzoAttuale = res.prezzo;
              if (!updatedProduct.storico) {
                updatedProduct.storico = [];
              }
              const todayDate = new Date().toLocaleDateString();
              const existingPoint = updatedProduct.storico.find((s: any) => s.data === todayDate);
              if (existingPoint) {
                existingPoint.prezzo = res.prezzo;
                existingPoint.timestamp = now;
                if (res.pricesByLanguage) {
                  existingPoint.pricesByLanguage = res.pricesByLanguage;
                }
              } else {
                updatedProduct.storico.push({
                  data: todayDate,
                  timestamp: now,
                  prezzo: res.prezzo,
                  pricesByLanguage: res.pricesByLanguage || null
                });
              }
            }
            if (res.immagine) updatedProduct.immagine = res.immagine;
            if (res.nome) updatedProduct.nome = res.nome;
            if (res.releaseDate && !updatedProduct.releaseDate) updatedProduct.releaseDate = res.releaseDate;
            if (res.espansione) updatedProduct.expansion = res.espansione;
            if (res.stock !== undefined) updatedProduct.stock = res.stock;
            if (res.sellerCountry !== undefined) updatedProduct.sellerCountry = res.sellerCountry;
            if (res.sellerType !== undefined) updatedProduct.sellerType = res.sellerType;
            if (res.avgTop5 !== undefined) updatedProduct.avgTop5 = res.avgTop5;
            if (res.pricesByLanguage !== undefined) updatedProduct.pricesByLanguage = res.pricesByLanguage;

            const docRef = doc(this.firestore, 'products', product.id);
            setDoc(docRef, updatedProduct)
              .then(() => resolve())
              .catch(err => {
                console.error('Error updating price in Firestore:', err);
                resolve();
              });
          },
          error: async (err) => {
            console.error('Error fetching price from API:', err);
            resolve();
          },
        });
    });
  }

  updateAllPrices(force: boolean = false) {
    if (this.products.length === 0) {
      this.loading = false;
      return;
    }

    this.loading = true;
    const updates = this.products.map((product) => this.updateSingleProductPrice(product, force));

    Promise.all(updates).then(() => {
      this.loading = false;
    });
  }

  // --- TRIGGER SCANNER CLOUD AGENT ON DEMAND ---
  triggerAiAgent() {
    this.loading = true;
    this.http.get(`${environment.apiBaseUrl}/trigger-ai`).subscribe({
      next: async (res: any) => {
        this.loading = false;
        const toast = await this.toastController.create({
          message: res.message || '⚡ Scansione AI e aggiornamento completati!',
          duration: 4000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      },
      error: async (err) => {
        this.loading = false;
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
    const product = this.products.find((p) => p.id === id);
    const productName = product ? product.nome : 'this product';
    if (confirm(`Are you sure you want to stop tracking "${productName}"?`)) {
      const docRef = doc(this.firestore, 'products', id);
      deleteDoc(docRef).catch(err => console.error('Error deleting product:', err));
    }
  }

  deduplicatePriceHistory() {
    let modified = false;
    this.products.forEach(p => {
      if (p.storico && p.storico.length > 0) {
        const dateMap = new Map<string, any>();
        p.storico.forEach((point: any) => {
          const dateKey = point.data;
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, point);
          } else {
            const existingPoint = dateMap.get(dateKey);
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

  calculateValueVariation(item: any): number {
    if (!item.storico || item.storico.length < 2) return 0;
    const initialPrice = item.storico[0].prezzo;
    const currentPrice = item.prezzoAttuale;
    if (!initialPrice || !currentPrice) return 0;
    return ((currentPrice - initialPrice) / initialPrice) * 100;
  }

  get productsSorted(): any[] {
    const list = [...this.products];
    switch (this.sortMode) {
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
  }

  get uniqueExpansions(): string[] {
    const sets = new Set<string>();
    this.products.forEach(p => {
      if (p.expansion) sets.add(p.expansion);
    });
    return Array.from(sets).sort();
  }

  get uniqueTypes(): string[] {
    const types = new Set<string>();
    this.products.forEach(p => {
      const typeInfo = this.detectMtgType(p.nome);
      types.add(typeInfo.nameType);
    });
    return Array.from(types).sort();
  }

  showMobileFilters = false;

  toggleMobileFilters() {
    this.showMobileFilters = !this.showMobileFilters;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.searchSealedQuery && this.searchSealedQuery.trim()) count++;
    if (this.minPriceFilter && this.minPriceFilter > 0) count++;
    if (this.maxPriceFilter && this.maxPriceFilter > 0) count++;
    if (this.selectedExpansionFilter !== 'all') count++;
    if (this.selectedTypeFilter !== 'all') count++;
    if (this.selectedVerdictFilter !== 'all') count++;
    return count;
  }

  updateBargainThreshold(val: any) {
    const num = parseFloat(val);
    this.bargainThreshold = isNaN(num) ? 110 : num;
    localStorage.setItem('mtg_tracker_soglia_affari', this.bargainThreshold.toString());
  }

  get allSealedProducts(): any[] {
    let list = [...this.productsSorted].filter(p => this.categoryService.isSealedProduct(p.nome));
    const q = (this.searchSealedQuery || '').toLowerCase().trim();

    // Flexible Category Toggles Filter
    if (!this.includeCollectorBoxes) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'collector-box');
    }
    if (!this.includePlayBoxes) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'play-box');
    }
    if (!this.includePrereleasePacks) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'prerelease');
    }
    if (!this.includeBundles) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'bundle');
    }
    if (!this.includeDraftNight) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'draft-night');
    }
    if (!this.includeSceneBoxes) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'scene-box');
    }
    if (!this.includeCommanderDecks) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'commander-deck');
    }
    if (!this.includeStarterDecks) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'starter-deck');
    }

    if (q) {
      list = list.filter(p => (p.nome || '').toLowerCase().includes(q) || (p.expansion || '').toLowerCase().includes(q));
    }
    if (this.minPriceFilter !== null && !isNaN(this.minPriceFilter) && this.minPriceFilter > 0) {
      list = list.filter(p => (p.prezzoAttuale || 0) >= (this.minPriceFilter as number));
    }
    if (this.maxPriceFilter !== null && !isNaN(this.maxPriceFilter) && this.maxPriceFilter > 0) {
      list = list.filter(p => (p.prezzoAttuale || 0) <= (this.maxPriceFilter as number));
    }
    if (this.selectedExpansionFilter !== 'all') {
      list = list.filter(p => p.expansion === this.selectedExpansionFilter);
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => this.detectMtgType(p.nome).key === this.selectedTypeFilter);
    }
    if (this.selectedVerdictFilter !== 'all') {
      list = list.filter(p => {
        const v = (p.verdict || p.aiVerdict || '').toUpperCase();
        return v.includes(this.selectedVerdictFilter.toUpperCase());
      });
    }
    return list;
  }

  get bargainProducts(): any[] {
    return this.allSealedProducts.filter(p => {
      const v = (p.verdict || p.aiVerdict || '').toUpperCase();
      const isCompra = v.includes('COMPRA');
      
      const cat = this.detectMtgType(p.nome);
      const threshold = this.categoryThresholds[cat.key] !== undefined ? this.categoryThresholds[cat.key] : cat.defaultThreshold;
      const isUnderThreshold = p.prezzoAttuale && p.prezzoAttuale > 0 && p.prezzoAttuale <= threshold;
      
      return isCompra || isUnderThreshold;
    });
  }

  get productsBuying(): any[] {
    let list = this.productsSorted.filter(p => p.intento === 'buy');
    if (this.selectedExpansionFilter !== 'all') {
      list = list.filter(p => p.expansion === this.selectedExpansionFilter);
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => p.nome && this.detectMtgType(p.nome).key === this.selectedTypeFilter);
    }
    return list;
  }

  get productsSelling(): any[] {
    let list = this.productsSorted.filter(p => p.intento === 'sell');
    if (this.selectedExpansionFilter !== 'all') {
      list = list.filter(p => p.expansion === this.selectedExpansionFilter);
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => p.nome && this.detectMtgType(p.nome).key === this.selectedTypeFilter);
    }
    return list;
  }

  saveProduct(product: any) {
    const docRef = doc(this.firestore, 'products', product.id);
    setDoc(docRef, product).catch(err => console.error('Error saving product to Firestore:', err));
  }

  onVistaChange() {
    localStorage.setItem('mtg_tracker_vista', this.viewMode);
  }

  onOrdinamentoChange() {
    localStorage.setItem('mtg_tracker_ordinamento', this.sortMode);
  }

  onSezioneChange() {
    localStorage.setItem('mtg_tracker_sezione', this.activeSection);
    this.selectedExpansionFilter = 'all';
    this.selectedTypeFilter = 'all';
    this.router.navigate([], { relativeTo: this.route, queryParams: { set: null, section: this.activeSection } });
  }

  onColonneGridChange() {
    localStorage.setItem('mtg_tracker_colonne', this.gridColumns.toString());
  }

  openExpansionDetail(expName: string) {
    this.selectedExpansionForDetail = expName;
    this.activeSection = 'expansion-detail';
    localStorage.setItem('mtg_tracker_sezione', this.activeSection);
    this.router.navigate([], { relativeTo: this.route, queryParams: { set: expName } });

    const normTarget = expName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = this.products.filter(p => p.expansion && (
      p.expansion.toLowerCase() === expName.toLowerCase() ||
      p.expansion.toLowerCase().replace(/[^a-z0-9]/g, '') === normTarget
    ));
    if (existing.length === 0) {
      this.autoDiscoverExpansion(expName);
    }
  }

  autoDiscoverExpansion(expName: string) {
    this.loading = true;
    this.http.get(`${environment.apiBaseUrl}/discover-expansion-sealed?name=${encodeURIComponent(expName)}`).subscribe({
      next: async (res: any) => {
        this.loading = false;
        const toast = await this.toastController.create({
          message: res.message || `🤖 Ricerca automatica per '${expName}' completata!`,
          duration: 3500,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      },
      error: async (err) => {
        this.loading = false;
        console.error('Errore auto-discovery:', err);
      }
    });
  }

  triggerRePullExpansion() {
    if (!this.selectedExpansionForDetail) return;
    this.autoDiscoverExpansion(this.selectedExpansionForDetail);
  }

  backToHub() {
    this.activeSection = 'expansions-hub';
    this.selectedExpansionForDetail = '';
    localStorage.setItem('mtg_tracker_sezione', this.activeSection);
    this.router.navigate([], { relativeTo: this.route, queryParams: { set: null, section: null } });
  }

  get productsForExpansionDetail(): any[] {
    const targetNorm = (this.selectedExpansionForDetail || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let list = this.productsSorted.filter(p => p.expansion && (
      p.expansion.toLowerCase() === this.selectedExpansionForDetail.toLowerCase() ||
      p.expansion.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm
    ));
    const q = (this.searchSealedQuery || '').toLowerCase().trim();

    if (!this.includeCollectorBoxes) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'collector-box');
    }
    if (!this.includePlayBoxes) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'play-box');
    }
    if (!this.includePrereleasePacks) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'prerelease');
    }
    if (!this.includeBundles) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'bundle');
    }
    if (!this.includeDraftNight) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'draft-night');
    }
    if (!this.includeSceneBoxes) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'scene-box');
    }
    if (!this.includeCommanderDecks) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'commander-deck');
    }
    if (!this.includeStarterDecks) {
      list = list.filter(p => this.detectMtgType(p.nome).key !== 'starter-deck');
    }

    if (q) {
      list = list.filter(p => (p.nome || '').toLowerCase().includes(q));
    }
    if (this.minPriceFilter !== null && !isNaN(this.minPriceFilter) && this.minPriceFilter > 0) {
      list = list.filter(p => (p.prezzoAttuale || 0) >= (this.minPriceFilter as number));
    }
    if (this.maxPriceFilter !== null && !isNaN(this.maxPriceFilter) && this.maxPriceFilter > 0) {
      list = list.filter(p => (p.prezzoAttuale || 0) <= (this.maxPriceFilter as number));
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => this.detectMtgType(p.nome).key === this.selectedTypeFilter);
    }
    if (this.selectedVerdictFilter !== 'all') {
      list = list.filter(p => {
        const v = (p.verdict || p.aiVerdict || '').toUpperCase();
        return v.includes(this.selectedVerdictFilter.toUpperCase());
      });
    }
    return list;
  }
}

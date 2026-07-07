import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { refresh, appsOutline, listOutline, cartOutline, cashOutline, gridOutline, searchOutline, closeOutline, settingsOutline, optionsOutline, funnelOutline, sparklesOutline } from 'ionicons/icons';
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
  IonSelectOption
} from '@ionic/angular/standalone';
import { BuyingSectionComponent } from './components/buying-section/buying-section.component';
import { SellingSectionComponent } from './components/selling-section/selling-section.component';
import { SearchSectionComponent } from './components/search-section/search-section.component';
import { FilterModalComponent } from './components/filter-modal/filter-modal.component';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
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
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    BuyingSectionComponent,
    SellingSectionComponent,
    SearchSectionComponent,
    FilterModalComponent
  ],
})
export class PriceTrackerPage implements OnInit {
  activeSection: 'buying' | 'selling' | 'search' = 'buying';
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

  constructor(private http: HttpClient, private firestore: Firestore) {
    addIcons({ 
      refresh, appsOutline, listOutline, cartOutline, cashOutline, gridOutline,
      searchOutline, closeOutline, settingsOutline, optionsOutline, funnelOutline, sparklesOutline 
    });
  }

  ngOnInit() {
    // Load view configuration
    const savedVista = localStorage.getItem('mtg_tracker_vista');
    if (savedVista === 'grid' || savedVista === 'table') {
      this.viewMode = savedVista;
    }
    
    const savedOrdinamento = localStorage.getItem('mtg_tracker_ordinamento');
    if (savedOrdinamento) {
      if (savedOrdinamento === 'recente') this.sortMode = 'recent';
      else if (savedOrdinamento === 'prezzo-crescente') this.sortMode = 'price-ascending';
      else if (savedOrdinamento === 'prezzo-decrescente') this.sortMode = 'price-descending';
      else if (savedOrdinamento === 'variazione-peggiore') this.sortMode = 'variation-best';
      else if (savedOrdinamento === 'variazione-migliore') this.sortMode = 'variation-worst';
      else this.sortMode = savedOrdinamento;
    }

    const savedSezione = localStorage.getItem('mtg_tracker_sezione');
    if (savedSezione) {
      if (savedSezione === 'acquisto') this.activeSection = 'buying';
      else if (savedSezione === 'vendita') this.activeSection = 'selling';
      else if (savedSezione === 'search') this.activeSection = 'search';
    }

    const savedCols = localStorage.getItem('mtg_tracker_colonne');
    if (savedCols) {
      this.gridColumns = parseInt(savedCols, 10) || 4;
    }

    // Subscribe to products from Firestore in real-time
    const productsCollection = collection(this.firestore, 'products');
    collectionData(productsCollection).subscribe({
      next: (data: any[]) => {
        this.products = data || [];
        this.deduplicatePriceHistory();
        if (!this.firstLoadDone) {
          this.firstLoadDone = true;
          this.updateAllPrices(false);
        }
      },
      error: (err) => console.error('Error fetching Firestore products:', err)
    });
  }

  detectMtgType(name: string): { nameType: string } {
    const n = (name || '').toLowerCase();
    if (n.includes('play booster box') || n.includes('play box')) {
      return { nameType: 'Play Box' };
    }
    if (n.includes('collector booster box') || n.includes('collector box')) {
      return { nameType: 'Collector Box' };
    }
    if (n.includes('prerelease pack') || n.includes('prerelease')) {
      return { nameType: 'Prerelease Pack' };
    }
    if (n.includes('fat pack') || n.includes('bundle') || n.includes('gift edition')) {
      return { nameType: 'Bundle' };
    }
    if (n.includes('commander') && n.includes('deck')) {
      return { nameType: 'Commander Deck' };
    }
    if (n.includes('draft night')) {
      return { nameType: 'Draft Night Kit' };
    }
    if (n.includes('collector booster') || n.includes('booster pack') || n.includes('pack')) {
      return { nameType: 'Single Pack' };
    }
    return { nameType: 'Generico' };
  }

  // Opens the filters modal when a card is selected from Search Section
  handleCardSelected(mappedCard: any) {
    this.selectedProduct = mappedCard;
    this.foilFilter = 'any';
    this.langFilter = 'any';
    this.condFilter = 'any';
    this.intentFilter = this.activeSection === 'selling' ? 'sell' : 'buy';
    
    this.showFilterModal = true;
  }

  // Opens the filters modal to edit an existing product
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
      // Create new tracked product
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
          // Go to target section tab
          this.activeSection = event.intent === 'buy' ? 'buying' : 'selling';
          this.onSezioneChange();
          this.updateSingleProductPrice(newProduct, true);
        }).catch(err => console.error('Error adding product:', err));
      } else {
        alert('Product already tracked!');
      }
    } else {
      // Update existing product
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

  handleCloseFilters() {
    this.showFilterModal = false;
    this.selectedProduct = null;
  }

  // Adding via manual url input inside buying/selling sections
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
          error: () => resolve(),
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

    if (modified) {
      console.log('Deduplicated historical pricing logs.');
    }
  }


  calculateValueVariation(item: any): number {
    if (!item.storico || item.storico.length < 2) return 0;
    const initialPrice = item.storico[0].prezzo;
    const currentPrice = item.prezzoAttuale;
    if (!initialPrice || !currentPrice) return 0;
    return ((currentPrice - initialPrice) / initialPrice) * 100;
  }

  // --- MEMOIZATION CACHE PER PRESTAZIONI ED EVITARE LAG DI RE-RENDER ---
  private lastProductsSortedSource: any[] = [];
  private lastSortModeSorted: string = '';
  private cachedProductsSorted: any[] = [];

  get productsSorted(): any[] {
    if (
      this.products === this.lastProductsSortedSource &&
      this.sortMode === this.lastSortModeSorted
    ) {
      return this.cachedProductsSorted;
    }

    this.lastProductsSortedSource = this.products;
    this.lastSortModeSorted = this.sortMode;

    const list = [...this.products];
    let result = [];
    switch (this.sortMode) {
      case 'name':
        result = list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        break;
      case 'release-date':
        result = list.sort((a, b) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : Infinity;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : Infinity;
          return dateA - dateB;
        });
        break;
      case 'price-ascending':
        result = list.sort((a, b) => (a.prezzoAttuale || 0) - (b.prezzoAttuale || 0));
        break;
      case 'price-descending':
        result = list.sort((a, b) => (b.prezzoAttuale || 0) - (a.prezzoAttuale || 0));
        break;
      case 'variation-best':
        result = list.sort((a, b) => this.calculateValueVariation(b) - this.calculateValueVariation(a));
        break;
      case 'variation-worst':
        result = list.sort((a, b) => this.calculateValueVariation(a) - this.calculateValueVariation(b));
        break;
      case 'recent':
      default:
        result = list.reverse();
        break;
    }
    this.cachedProductsSorted = result;
    return result;
  }

  private lastProductsExpSource: any[] = [];
  private lastActiveSectionExp: string = '';
  private cachedUniqueExpansions: string[] = [];

  get uniqueExpansions(): string[] {
    if (
      this.products === this.lastProductsExpSource &&
      this.activeSection === this.lastActiveSectionExp
    ) {
      return this.cachedUniqueExpansions;
    }

    this.lastProductsExpSource = this.products;
    this.lastActiveSectionExp = this.activeSection;

    const sets = new Set<string>();
    const intentFilter = this.activeSection === 'buying' ? 'buy' : this.activeSection === 'selling' ? 'sell' : null;
    this.products.forEach(p => {
      if (intentFilter && p.intento !== intentFilter) return;
      if (p.expansion) sets.add(p.expansion);
    });
    this.cachedUniqueExpansions = Array.from(sets).sort();
    return this.cachedUniqueExpansions;
  }

  private lastProductsTypeSource: any[] = [];
  private lastActiveSectionType: string = '';
  private cachedUniqueTypes: string[] = [];

  get uniqueTypes(): string[] {
    if (
      this.products === this.lastProductsTypeSource &&
      this.activeSection === this.lastActiveSectionType
    ) {
      return this.cachedUniqueTypes;
    }

    this.lastProductsTypeSource = this.products;
    this.lastActiveSectionType = this.activeSection;

    const types = new Set<string>();
    const intentFilter = this.activeSection === 'buying' ? 'buy' : this.activeSection === 'selling' ? 'sell' : null;
    this.products.forEach(p => {
      if (intentFilter && p.intento !== intentFilter) return;
      const typeInfo = this.detectMtgType(p.nome);
      types.add(typeInfo.nameType);
    });
    this.cachedUniqueTypes = Array.from(types).sort();
    return this.cachedUniqueTypes;
  }

  private lastProductsBuyingSource: any[] = [];
  private lastSortModeBuying: string = '';
  private lastExpansionFilterBuying: string = '';
  private lastTypeFilterBuying: string = '';
  private cachedProductsBuying: any[] = [];

  get productsBuying(): any[] {
    if (
      this.products === this.lastProductsBuyingSource &&
      this.sortMode === this.lastSortModeBuying &&
      this.selectedExpansionFilter === this.lastExpansionFilterBuying &&
      this.selectedTypeFilter === this.lastTypeFilterBuying
    ) {
      return this.cachedProductsBuying;
    }

    this.lastProductsBuyingSource = this.products;
    this.lastSortModeBuying = this.sortMode;
    this.lastExpansionFilterBuying = this.selectedExpansionFilter;
    this.lastTypeFilterBuying = this.selectedTypeFilter;

    let list = this.productsSorted.filter(p => p.intento === 'buy');
    if (this.selectedExpansionFilter !== 'all') {
      list = list.filter(p => p.expansion === this.selectedExpansionFilter);
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => this.detectMtgType(p.nome).nameType === this.selectedTypeFilter);
    }
    this.cachedProductsBuying = list;
    return list;
  }

  private lastProductsSellingSource: any[] = [];
  private lastSortModeSelling: string = '';
  private lastExpansionFilterSelling: string = '';
  private lastTypeFilterSelling: string = '';
  private cachedProductsSelling: any[] = [];

  get productsSelling(): any[] {
    if (
      this.products === this.lastProductsSellingSource &&
      this.sortMode === this.lastSortModeSelling &&
      this.selectedExpansionFilter === this.lastExpansionFilterSelling &&
      this.selectedTypeFilter === this.lastTypeFilterSelling
    ) {
      return this.cachedProductsSelling;
    }

    this.lastProductsSellingSource = this.products;
    this.lastSortModeSelling = this.sortMode;
    this.lastExpansionFilterSelling = this.selectedExpansionFilter;
    this.lastTypeFilterSelling = this.selectedTypeFilter;

    let list = this.productsSorted.filter(p => p.intento === 'sell');
    if (this.selectedExpansionFilter !== 'all') {
      list = list.filter(p => p.expansion === this.selectedExpansionFilter);
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => this.detectMtgType(p.nome).nameType === this.selectedTypeFilter);
    }
    this.cachedProductsSelling = list;
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
    // Reset filters on section change
    this.selectedExpansionFilter = 'all';
    this.selectedTypeFilter = 'all';
  }

  onColonneGridChange() {
    localStorage.setItem('mtg_tracker_colonne', this.gridColumns.toString());
    this.products = [...this.products];
  }
}

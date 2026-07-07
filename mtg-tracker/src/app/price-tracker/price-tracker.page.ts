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

  // Filter editing modal state
  showFilterModal: boolean = false;
  selectedProduct: any = null;
  foilFilter: 'any' | 'normal' | 'foil' = 'any';
  langFilter: 'any' | 'it' | 'en' = 'any';
  condFilter: 'any' | 'Near Mint' = 'any';
  intentFilter: 'buy' | 'sell' = 'buy';

  selectedExpansionFilter: string = 'all';
  selectedTypeFilter: string = 'all';

  constructor(private http: HttpClient) {
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
      // Map Italian sort keys to English
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

    // Load and migrate products cache
    const cache = localStorage.getItem('mtg_tracker_data');
    if (cache) {
      this.products = JSON.parse(cache);
      
      let migrated = false;
      this.products.forEach(p => {
        // Migrate Italian intents to English
        if (p.intento) {
          if (p.intento === 'compra') {
            p.intento = 'buy';
            migrated = true;
          } else if (p.intento === 'vendi') {
            p.intento = 'sell';
            migrated = true;
          }
        } else {
          p.intento = this.detectMtgType(p.nome).nameType === 'Generico' ? 'sell' : 'buy';
          migrated = true;
        }
      });

      this.deduplicatePriceHistory();
      if (migrated) this.saveCache();
      this.updateAllPrices(false);
    } else {
      this.http.get('http://localhost:3000/api/backup').subscribe({
        next: (backup: any) => {
          if (Array.isArray(backup) && backup.length > 0) {
            this.products = backup;
            this.products.forEach(p => {
              if (p.intento) {
                if (p.intento === 'compra') p.intento = 'buy';
                if (p.intento === 'vendi') p.intento = 'sell';
              } else {
                p.intento = this.detectMtgType(p.nome).nameType === 'Generico' ? 'sell' : 'buy';
              }
            });
            this.deduplicatePriceHistory();
            this.saveCache();
            console.log('Restored products data successfully from file backup.');
          }
          this.updateAllPrices(false);
        },
        error: () => {
          this.updateAllPrices(false);
        }
      });
    }
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
        this.products.push(newProduct);
        this.saveCache();
        
        // Go to target section tab
        this.activeSection = event.intent === 'buy' ? 'buying' : 'selling';
        this.onSezioneChange();
        
        this.updateAllPrices(true);
      } else {
        alert('Product already tracked!');
      }
    } else {
      // Update existing product
      this.selectedProduct.foil = event.foil;
      this.selectedProduct.lingua = event.lang;
      this.selectedProduct.condizione = event.cond;
      this.selectedProduct.intento = event.intent;
      
      // Clear historical values and current price so they recalculate with new parameters
      this.selectedProduct.prezzoAttuale = null;
      this.selectedProduct.storico = [];
      
      this.saveCache();
      this.updateAllPrices(true);
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
        this.products.push({
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
        });

        this.saveCache();
        this.updateAllPrices(true);
      } else {
        alert('Product already tracked!');
      }
    } else {
      alert('Invalid URL. Make sure to paste a valid CardTrader card product URL.');
    }
  }

  updateAllPrices(force: boolean = false) {
    if (this.products.length === 0) {
      this.loading = false;
      return;
    }

    const COOLDOWN_MS = 12 * 60 * 60 * 1000;
    const now = Date.now();

    const productsToUpdate = force
      ? this.products
      : this.products.filter(product => {
          if (!product.prezzoAttuale || !product.storico || product.storico.length === 0) {
            return true;
          }
          const lastPoint = product.storico[product.storico.length - 1];
          const lastTimestamp = lastPoint.timestamp || new Date(lastPoint.data).getTime();
          return (now - lastTimestamp) > COOLDOWN_MS;
        });

    if (productsToUpdate.length === 0) {
      console.log('Prices are updated (12h cooldown active).');
      this.loading = false;
      this.products = [...this.products];
      return;
    }

    this.loading = true;

    const updates = productsToUpdate.map((product) => {
      return new Promise<void>((resolve) => {
        const params: string[] = [];
        if (product.foil === true) params.push('foil=true');
        if (product.foil === false) params.push('foil=false');
        if (product.lingua) params.push(`lang=${product.lingua}`);
        if (product.condizione) params.push(`cond=${encodeURIComponent(product.condizione)}`);
        const queryStr = params.length > 0 ? '?' + params.join('&') : '';

        this.http
          .get(`http://localhost:3000/api/prezzo/${product.id}${queryStr}`)
          .subscribe({
            next: (res: any) => {
              if (res.prezzo) {
                product.prezzoAttuale = res.prezzo;
                if (!product.storico) {
                  product.storico = [];
                }
                const todayDate = new Date().toLocaleDateString();
                const existingPoint = product.storico.find((s: any) => s.data === todayDate);
                if (existingPoint) {
                  existingPoint.prezzo = res.prezzo;
                  existingPoint.timestamp = now;
                  if (res.pricesByLanguage) {
                    existingPoint.pricesByLanguage = res.pricesByLanguage;
                  }
                } else {
                  product.storico.push({
                    data: todayDate,
                    timestamp: now,
                    prezzo: res.prezzo,
                    pricesByLanguage: res.pricesByLanguage || null
                  });
                }
              }
              if (res.immagine) {
                product.immagine = res.immagine;
              }
              if (res.nome) {
                product.nome = res.nome;
              }
              if (res.espansione) {
                product.expansion = res.espansione;
              }
              if (res.stock !== undefined) {
                product.stock = res.stock;
              }
              if (res.sellerCountry !== undefined) {
                product.sellerCountry = res.sellerCountry;
              }
              if (res.sellerType !== undefined) {
                product.sellerType = res.sellerType;
              }
              if (res.avgTop5 !== undefined) {
                product.avgTop5 = res.avgTop5;
              }
              if (res.pricesByLanguage !== undefined) {
                product.pricesByLanguage = res.pricesByLanguage;
              }
              resolve();
            },
            error: () => resolve(),
          });
      });
    });

    Promise.all(updates).then(() => {
      this.products = [...this.products];
      this.saveCache();
      this.loading = false;
    });
  }

  removeProduct(id: string) {
    const product = this.products.find((p) => p.id === id);
    const productName = product ? product.nome : 'this product';
    if (confirm(`Are you sure you want to stop tracking "${productName}"?`)) {
      this.products = this.products.filter((p) => p.id !== id);
      this.saveCache();
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

  saveCache() {
    localStorage.setItem('mtg_tracker_data', JSON.stringify(this.products));
    this.http.post('http://localhost:3000/api/backup', this.products).subscribe({
      next: () => console.log('Saved data backup on server file system.'),
      error: (err) => console.error('Error saving data backup:', err)
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
    const intentFilter = this.activeSection === 'buying' ? 'buy' : this.activeSection === 'selling' ? 'sell' : null;
    this.products.forEach(p => {
      if (intentFilter && p.intento !== intentFilter) return;
      if (p.expansion) sets.add(p.expansion);
    });
    return Array.from(sets).sort();
  }

  get uniqueTypes(): string[] {
    const types = new Set<string>();
    const intentFilter = this.activeSection === 'buying' ? 'buy' : this.activeSection === 'selling' ? 'sell' : null;
    this.products.forEach(p => {
      if (intentFilter && p.intento !== intentFilter) return;
      const typeInfo = this.detectMtgType(p.nome);
      types.add(typeInfo.nameType);
    });
    return Array.from(types).sort();
  }

  get productsBuying(): any[] {
    let list = this.productsSorted.filter(p => p.intento === 'buy');
    if (this.selectedExpansionFilter !== 'all') {
      list = list.filter(p => p.expansion === this.selectedExpansionFilter);
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => this.detectMtgType(p.nome).nameType === this.selectedTypeFilter);
    }
    return list;
  }

  get productsSelling(): any[] {
    let list = this.productsSorted.filter(p => p.intento === 'sell');
    if (this.selectedExpansionFilter !== 'all') {
      list = list.filter(p => p.expansion === this.selectedExpansionFilter);
    }
    if (this.selectedTypeFilter !== 'all') {
      list = list.filter(p => this.detectMtgType(p.nome).nameType === this.selectedTypeFilter);
    }
    return list;
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

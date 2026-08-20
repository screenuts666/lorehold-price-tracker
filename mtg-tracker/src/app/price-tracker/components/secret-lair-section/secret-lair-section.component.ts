import { Component, computed, inject, input, output, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  sparklesOutline, 
  flameOutline, 
  cardOutline, 
  cubeOutline, 
  pricetagOutline,
  openOutline,
  trashOutline,
  trendingUpOutline,
  trendingDownOutline,
  shieldCheckmarkOutline,
  warningOutline,
  searchOutline
} from 'ionicons/icons';
import { Chart, ChartDataset } from 'chart.js/auto';

import { MtgProduct } from '../../../models/product.model';
import { ViewModeType } from '../../../models/filter.model';
import { LanguageService } from '../../services/language.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { CHART_THEME, createThemeGradient } from '../../../utils/chart-theme.utils';

export type SecretLairChip = 'all' | 'commander' | 'bundles' | 'artist' | 'universes' | 'lands' | 'bargains';
export type SecretLairFoilFilter = 'all' | 'foil' | 'nonfoil';

@Component({
  selector: 'app-secret-lair-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    EmptyStateComponent
  ],
  templateUrl: './secret-lair-section.component.html',
  styleUrls: ['./secret-lair-section.component.scss']
})
export class SecretLairSectionComponent implements OnDestroy {
  public langService = inject(LanguageService);
  public t = this.langService.t;

  // Inputs & Outputs
  products = input<MtgProduct[]>([]);
  gridColumns = input<number>(3);
  viewMode = input<ViewModeType>('grid');
  removeProduct = output<string>();

  // Filter Signals
  searchQuery = signal<string>('');
  activeChip = signal<SecretLairChip>('all');
  foilFilter = signal<SecretLairFoilFilter>('all');
  sortMode = signal<string>('recent');

  private chartInstances: { [key: string]: Chart } = {};

  constructor() {
    addIcons({
      sparklesOutline,
      flameOutline,
      cardOutline,
      cubeOutline,
      pricetagOutline,
      openOutline,
      trashOutline,
      trendingUpOutline,
      trendingDownOutline,
      shieldCheckmarkOutline,
      warningOutline,
      searchOutline
    });

    effect(() => {
      const list = this.filteredProducts();
      setTimeout(() => {
        this.renderCharts(list);
      }, 50);
    });
  }

  ngOnDestroy() {
    Object.values(this.chartInstances).forEach(c => c.destroy());
    this.chartInstances = {};
  }

  // Filtered Secret Lair Products
  filteredProducts = computed(() => {
    const raw = this.products();
    const q = this.searchQuery().toLowerCase().trim();
    const chip = this.activeChip();
    const foil = this.foilFilter();

    // 1. Filtra solo drop Secret Lair
    let list = raw.filter(p => {
      if (p.isSecretLair) return true;
      const name = (p.nome || '').toLowerCase();
      const exp = (p.expansion || '').toLowerCase();
      return name.includes('secret lair') || exp.includes('secret lair');
    });

    // 2. Filtro Ricerca
    if (q) {
      list = list.filter(p => (p.nome || '').toLowerCase().includes(q));
    }

    // 3. Filtro Quick Chips
    if (chip === 'commander') {
      list = list.filter(p => {
        const name = (p.nome || '').toLowerCase();
        return p.dropType === 'commander' || p.dropType === 'countdown' || name.includes('commander') || name.includes('deck') || name.includes('heads i win') || name.includes('angels') || name.includes('cats') || name.includes('countdown kit') || name.includes('encyclopedia') || name.includes('goblin storm') || name.includes('miku');
      });
    } else if (chip === 'bundles') {
      list = list.filter(p => {
        const name = (p.nome || '').toLowerCase();
        return p.dropType === 'bundle' || name.includes('bundle') || name.includes('superdrop') || name.includes('festival in a box') || name.includes('all-in');
      });
    } else if (chip === 'artist') {
      list = list.filter(p => {
        const name = (p.nome || '').toLowerCase();
        return p.dropType === 'artist-series' || name.includes('artist series') || name.includes('seb mckinnon') || name.includes('junji ito') || name.includes('johannes voss') || name.includes('mark poole') || name.includes('rebecca guay') || name.includes('john avon') || name.includes('nils hamm') || name.includes('rovina cai');
      });
    } else if (chip === 'universes') {
      list = list.filter(p => {
        const name = (p.nome || '').toLowerCase();
        return p.dropType === 'universes-beyond' || name.includes('marvel') || name.includes('deadpool') || name.includes('tomb raider') || name.includes('street fighter') || name.includes('warhammer') || name.includes('transformers') || name.includes('godzilla') || name.includes('monty python') || name.includes('ghostbusters') || name.includes('fallout') || name.includes('hatsune miku') || name.includes('d&d') || name.includes('dungeons');
      });
    } else if (chip === 'lands') {
      list = list.filter(p => {
        const name = (p.nome || '').toLowerCase();
        return p.dropType === 'lands' || name.includes('land') || name.includes('lands') || name.includes('pixel snow') || name.includes('space') || name.includes('tokyo');
      });
    } else if (chip === 'bargains') {
      list = list.filter(p => {
        const price = p.prezzoAttuale || 0;
        if (price <= 0) return false;
        const isDeck = (p.nome || '').toLowerCase().includes('deck') || (p.nome || '').toLowerCase().includes('commander');
        const threshold = isDeck ? 160 : 45;
        return price <= threshold || (p.ai_verdict && p.ai_verdict.toUpperCase().includes('COMPRA'));
      });
    }

    // 4. Filtro Foil
    if (foil === 'foil') {
      list = list.filter(p => p.foil === true || (p.nome || '').toLowerCase().includes('foil'));
    } else if (foil === 'nonfoil') {
      list = list.filter(p => p.foil === false || !(p.nome || '').toLowerCase().includes('foil'));
    }

    // 5. Ordinamento
    switch (this.sortMode()) {
      case 'name':
        return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      case 'price-asc':
        return list.sort((a, b) => (a.prezzoAttuale || 999999) - (b.prezzoAttuale || 999999));
      case 'price-desc':
        return list.sort((a, b) => (b.prezzoAttuale || 0) - (a.prezzoAttuale || 0));
      case 'recent':
      default:
        return list.sort((a, b) => {
          const tA = a.dataInserimento ? new Date(a.dataInserimento).getTime() : 0;
          const tB = b.dataInserimento ? new Date(b.dataInserimento).getTime() : 0;
          return tB - tA;
        });
    }
  });

  // Chart.js Rendering
  private renderCharts(list: MtgProduct[]) {
    list.slice(0, 30).forEach(item => {
      const canvas = document.getElementById('sl-chart-' + item.id) as HTMLCanvasElement;
      if (!canvas || !item.storico || item.storico.length === 0) return;

      if (this.chartInstances[item.id]) {
        this.chartInstances[item.id].destroy();
        delete this.chartInstances[item.id];
      }

      const labels = item.storico.map(h => h.data);
      const data = item.storico.map(h => h.prezzo);

      const ctx = canvas.getContext('2d');
      const gradient = ctx ? createThemeGradient(ctx, '--chart-primary', 0.25, 0.0, 55) : undefined;

      const datasets: ChartDataset<'line'>[] = [{
        label: 'Prezzo (€)',
        data: data,
        borderColor: CHART_THEME.colors.primary,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        backgroundColor: gradient || 'rgba(99, 102, 241, 0.08)',
        tension: 0.25
      }];

      this.chartInstances[item.id] = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#f8fafc',
              bodyColor: '#94a3b8',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              padding: 6,
              displayColors: false,
              callbacks: {
                label: (context) => `€${context.parsed.y?.toFixed(2)}`
              }
            }
          },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }
      });
    });
  }

  // Helper Methods
  cleanDropName(name: string): string {
    if (!name) return '';
    return name
      .replace(/^Magic:\s*The Gathering\s*-\s*/i, '')
      .replace(/^Secret Lair Drop Series:\s*/i, '')
      .replace(/^Secret Lair:\s*/i, '')
      .trim();
  }

  isFoilDrop(item: MtgProduct): boolean {
    if (item.foil === true) return true;
    return (item.nome || '').toLowerCase().includes('foil');
  }

  getSecretLairVerdict(item: MtgProduct): { badge: string; type: 'deal' | 'scalper' | 'fair'; text: string } {
    const price = item.prezzoAttuale;
    if (!price || price <= 0) {
      return { badge: 'N/A', type: 'fair', text: 'Prezzo non disponibile' };
    }

    const name = (item.nome || '').toLowerCase();
    const isDeck = name.includes('deck') || name.includes('commander') || name.includes('countdown');
    const isBundle = name.includes('bundle') || name.includes('festival');

    if (isDeck) {
      if (price <= 150) return { badge: '🎯 PREZZO EQUO', type: 'deal', text: 'Prezzo in linea con il lancio WotC (~$149).' };
      if (price > 320) return { badge: '⚠️ ALLERTA BAGARINI', type: 'scalper', text: 'Prezzo fortemente speculato rispetto al lancio.' };
      return { badge: '📊 VALORE REGOLARE', type: 'fair', text: 'Prezzo di mercato secondario consolidato.' };
    }

    if (isBundle) {
      return { badge: '📦 BUNDLE COLLECTION', type: 'fair', text: 'Set cumulativo multi-drop.' };
    }

    if (price <= 42) return { badge: '🟢 OCCASIONE', type: 'deal', text: 'Prezzo molto vicino all\'MSRP ufficiale WotC.' };
    if (price >= 120) return { badge: '⚠️ FORTE SOVRAPPREZZO', type: 'scalper', text: 'Drop raro con elevato premio speculativo.' };
    return { badge: '✨ PREZZO MERCATO', type: 'fair', text: 'Quotazione standard mercato europeo.' };
  }

  selectChip(chip: SecretLairChip) {
    this.activeChip.set(chip);
  }

  setFoilFilter(foil: SecretLairFoilFilter) {
    this.foilFilter.set(foil);
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target) this.searchQuery.set(target.value);
  }

  onSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) this.sortMode.set(target.value);
  }

  onDelete(id: string) {
    this.removeProduct.emit(id);
  }
}

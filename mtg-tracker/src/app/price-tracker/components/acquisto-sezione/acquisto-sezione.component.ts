import { Component, Input, Output, EventEmitter, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trash, image, openOutline, cartOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline } from 'ionicons/icons';
import { Chart } from 'chart.js/auto';
import { IonIcon, IonInput, IonButton, IonGrid, IonRow, IonCol, IonCard } from '@ionic/angular/standalone';
import { MarketAnalyzerService, ProductType, Product } from '../../services/market-analyzer.service';

@Component({
  selector: 'app-acquisto-sezione',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    IonInput,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonCard
  ],
  templateUrl: './acquisto-sezione.component.html',
  styleUrls: []
})
export class AcquistoSezioneComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() prodotti: any[] = [];
  @Input() vista: 'grid' | 'table' = 'grid';
  @Input() colonneGrid: number = 4;
  @Output() onAdd = new EventEmitter<string>();
  @Output() onRemove = new EventEmitter<string>();

  urlAcquisto: string = '';
  private chartInstances: { [key: string]: Chart } = {};

  constructor(private marketAnalyzer: MarketAnalyzerService) {
    addIcons({ 
      trash, image, openOutline, cartOutline, trendingDownOutline, 
      checkmarkCircleOutline, alertCircleOutline, timeOutline 
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderizzaGrafici(), 150);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['prodotti'] || changes['vista'] || changes['colonneGrid']) {
      setTimeout(() => this.renderizzaGrafici(), 150);
    }
  }

  ngOnDestroy() {
    Object.values(this.chartInstances).forEach(chart => chart.destroy());
    this.chartInstances = {};
  }

  aggiungi() {
    if (!this.urlAcquisto) return;
    this.onAdd.emit(this.urlAcquisto);
    this.urlAcquisto = '';
  }

  rimuovi(id: string) {
    this.onRemove.emit(id);
  }

  rilevaTipoMtg(nome: string): { nomeTipo: string; standard: number; ottimo: number; caro: number } {
    const n = (nome || '').toLowerCase();
    if (n.includes('play booster box') || n.includes('play box')) {
      return { nomeTipo: 'Play Box', standard: 135, ottimo: 120, caro: 150 };
    }
    if (n.includes('collector booster box') || n.includes('collector box')) {
      return { nomeTipo: 'Collector Box', standard: 220, ottimo: 195, caro: 245 };
    }
    if (n.includes('prerelease pack') || n.includes('prerelease')) {
      return { nomeTipo: 'Prerelease Pack', standard: 30, ottimo: 25, caro: 35 };
    }
    if (n.includes('fat pack') || n.includes('bundle') || n.includes('gift edition')) {
      return { nomeTipo: 'Bundle', standard: 42, ottimo: 35, caro: 50 };
    }
    if (n.includes('commander') && n.includes('deck')) {
      return { nomeTipo: 'Commander Deck', standard: 45, ottimo: 38, caro: 55 };
    }
    if (n.includes('draft night')) {
      return { nomeTipo: 'Draft Night Kit', standard: 90, ottimo: 80, caro: 110 };
    }
    if (n.includes('collector booster') || n.includes('booster pack') || n.includes('pack')) {
      return { nomeTipo: 'Single Pack', standard: 5, ottimo: 4, caro: 6.5 };
    }
    return { nomeTipo: 'Generico', standard: 0, ottimo: 0, caro: 999999 };
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return new Date(dateStr);
  }

  mappaTipoMtgAlProductType(nome: string): ProductType | null {
    const n = (nome || '').toLowerCase();
    if (n.includes('play booster box') || n.includes('play box') || n.includes('collector booster box') || n.includes('collector box')) {
      return ProductType.PLAY_BOOSTER;
    }
    if (n.includes('fat pack') || n.includes('bundle') || n.includes('gift edition') || n.includes('commander')) {
      return ProductType.BUNDLE;
    }
    if (n.includes('prerelease pack') || n.includes('prerelease')) {
      return ProductType.PRERELEASE;
    }
    if (n.includes('secret lair')) {
      return ProductType.SECRET_LAIR;
    }
    if (n.includes('draft night')) {
      return ProductType.DRAFT_NIGHT;
    }
    return null;
  }

  // --- ALGORITMO DI ACQUISTO (BUY) ---
  ottieniSuggerimento(item: any): { stato: string; colore: string; spiegazione: string; icona: string } {
    const pType = this.mappaTipoMtgAlProductType(item.nome);
    
    if (pType !== null) {
      const tipo = this.rilevaTipoMtg(item.nome);
      const launchPrice = tipo.standard > 0 ? tipo.standard : (item.storico && item.storico.length > 0 ? item.storico[0].prezzo : 100);
      
      const parsedLaunchDate = this.parseDate(item.dataInserimento);
      const historicalPrices = (item.storico || []).map((h: any) => ({
        date: this.parseDate(h.data),
        price: h.prezzo
      }));

      const product: Product = {
        currentPrice: item.prezzoAttuale || (historicalPrices.length > 0 ? historicalPrices[historicalPrices.length - 1].price : 0),
        launchDate: parsedLaunchDate,
        historicalPrices: historicalPrices,
        baseLaunchPrice: launchPrice,
        productType: pType
      };

      const analysis = this.marketAnalyzer.analyzeMarket(product);

      let colore = '#64748b';
      let icona = 'analytics-outline';
      let statoTesto = 'ATTENDI';

      if (analysis.stato === 'BUY') {
        colore = '#10b981';
        icona = 'trending-down-outline';
        statoTesto = 'COMPRA ORA';
      } else if (analysis.stato === 'AVOID') {
        colore = '#ef4444';
        icona = 'alert-circle-outline';
        statoTesto = 'EVITA';
      } else {
        colore = '#f59e0b';
        icona = 'time-outline';
        statoTesto = 'ATTENDI';
      }

      return {
        stato: statoTesto,
        colore: colore,
        spiegazione: analysis.messaggio,
        icona: icona
      };
    }

    // --- FALLBACK GENERALE PER PRODOTTI NON STANDARD / CARTE SINGOLE INSERITE IN ACQUISTO ---
    const tipo = this.rilevaTipoMtg(item.nome);
    const prezzi = item.storico ? item.storico.map((p: any) => p.prezzo) : [];
    const prezzoAttuale = item.prezzoAttuale || (prezzi.length > 0 ? prezzi[prezzi.length - 1] : null);

    if (!prezzoAttuale) {
      return { 
        stato: 'ANALISI', 
        colore: '#64748b', 
        spiegazione: 'Rilevamento in corso. Nessun prezzo attuale disponibile.',
        icona: 'analytics-outline'
      };
    }

    const min = prezzi.length > 0 ? Math.min(...prezzi) : prezzoAttuale;
    const max = prezzi.length > 0 ? Math.max(...prezzi) : prezzoAttuale;
    const media = prezzi.length > 0 ? prezzi.reduce((a: number, b: number) => a + b, 0) / prezzi.length : prezzoAttuale;

    if (prezzi.length < 2) {
      return { 
        stato: 'IN CODA', 
        colore: '#3b82f6',
        spiegazione: `Prodotto ${tipo.nomeTipo !== 'Generico' ? tipo.nomeTipo : 'monitorato'}. In attesa di storico.`,
        icona: 'analytics-outline'
      };
    }

    if (prezzoAttuale <= min * 1.02) {
      const risparmio = max > prezzoAttuale ? (((max - prezzoAttuale) / max) * 100).toFixed(0) : '0';
      return {
        stato: 'COMPRA ORA',
        colore: '#10b981',
        spiegazione: `Minimo storico locale! Risparmi il ${risparmio}% rispetto al picco massimo (€${max.toFixed(2)}).`,
        icona: 'trending-down-outline'
      };
    }
    
    if (prezzoAttuale < media) {
      const scontoMedia = (((media - prezzoAttuale) / media) * 100).toFixed(0);
      return {
        stato: 'BUON PREZZO',
        colore: '#34d399',
        spiegazione: `Prezzo inferiore del ${scontoMedia}% rispetto alla media dello storico (€${media.toFixed(2)}).`,
        icona: 'checkmark-circle-outline'
      };
    }
    
    if (prezzoAttuale >= max * 0.95) {
      const rincaro = min > 0 ? (((prezzoAttuale - min) / min) * 100).toFixed(0) : '0';
      return {
        stato: 'EVITA',
        colore: '#ef4444',
        spiegazione: `Picco massimo registrato! È aumentato del ${rincaro}% rispetto al minimo (€${min.toFixed(2)}). Evita l'acquisto.`,
        icona: 'alert-circle-outline'
      };
    }
    
    const eccessoMedia = (((prezzoAttuale - media) / media) * 100).toFixed(0);
    return {
      stato: 'ATTENDI',
      colore: '#f59e0b',
      spiegazione: `Prezzo superiore del ${eccessoMedia}% rispetto alla media dello storico (€${media.toFixed(2)}). Attendi un ribasso.`,
      icona: 'time-outline'
    };
  }

  calcolaVariazioneTesto(item: any): string {
    if (!item.storico || item.storico.length < 2) return '';
    const iniz = item.storico[0].prezzo;
    const att = item.prezzoAttuale;
    if (!iniz || !att) return '';
    const diff = att - iniz;
    const pct = (diff / iniz) * 100;
    const segno = diff >= 0 ? '+' : '';
    return `${segno}${pct.toFixed(1)}%`;
  }

  calcolaVariazioneColor(item: any): string {
    if (!item.storico || item.storico.length < 2) return '#94a3b8';
    const iniz = item.storico[0].prezzo;
    const att = item.prezzoAttuale;
    if (!iniz || !att) return '#94a3b8';
    // Per chi compra, un calo di prezzo è positivo (verde), un aumento è negativo (rosso)
    return att < iniz ? '#10b981' : '#ef4444';
  }

  renderizzaGrafici() {
    this.prodotti.forEach((prodotto) => {
      const canvasId = `chart-acquisto-${prodotto.id}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

      if (!canvas) return;

      if (this.chartInstances[prodotto.id]) {
        this.chartInstances[prodotto.id].destroy();
      }

      const storico = prodotto.storico || [];
      const labels = storico.map((p: any) => p.data);
      const data = storico.map((p: any) => p.prezzo);

      const ctx = canvas.getContext('2d');
      let gradient = null;
      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 100);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)'); // Purple neon
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
      }

      this.chartInstances[prodotto.id] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            borderColor: '#a78bfa', // Purple
            borderWidth: 2,
            pointBackgroundColor: '#c084fc',
            pointBorderColor: 'rgba(255,255,255,0.8)',
            pointRadius: labels.length === 1 ? 4 : 2,
            pointHoverRadius: 6,
            fill: true,
            backgroundColor: gradient || 'rgba(139, 92, 246, 0.1)',
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: {
                color: '#64748b',
                font: { size: 9, weight: 'bold' },
                callback: (value) => '€' + Number(value).toFixed(0)
              }
            }
          }
        }
      });
    });
  }
}

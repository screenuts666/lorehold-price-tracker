import { Component, Input, Output, EventEmitter, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trash, image, openOutline, cartOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline } from 'ionicons/icons';
import { Chart } from 'chart.js/auto';
import { IonIcon, IonInput, IonButton, IonGrid, IonRow, IonCol, IonCard } from '@ionic/angular/standalone';

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
  @Output() onAdd = new EventEmitter<string>();
  @Output() onRemove = new EventEmitter<string>();

  urlAcquisto: string = '';
  private chartInstances: { [key: string]: Chart } = {};

  constructor() {
    addIcons({ 
      trash, image, openOutline, cartOutline, trendingDownOutline, 
      checkmarkCircleOutline, alertCircleOutline, timeOutline 
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderizzaGrafici(), 150);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['prodotti'] || changes['vista']) {
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

  // --- ALGORITMO DI ACQUISTO (BUY) ---
  ottieniSuggerimento(item: any): { stato: string; colore: string; spiegazione: string; icona: string } {
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

    // --- CONFRONTO CON IL MERCATO STANDARD MTG ---
    if (tipo.standard > 0) {
      if (prezzoAttuale <= tipo.ottimo) {
        const risparmioMercato = (((tipo.standard - prezzoAttuale) / tipo.standard) * 100).toFixed(0);
        return {
          stato: '🔥 COMPRA ORA',
          colore: '#10b981', // Verde smeraldo neon
          spiegazione: `Prezzo eccezionale per un ${tipo.nomeTipo}! Risparmi il ${risparmioMercato}% rispetto al prezzo standard (€${tipo.standard}).`,
          icona: 'trending-down-outline'
        };
      }
      if (prezzoAttuale >= tipo.caro) {
        const rincaroMercato = (((prezzoAttuale - tipo.standard) / tipo.standard) * 100).toFixed(0);
        return {
          stato: '🔴 EVITA',
          colore: '#ef4444', // Rosso neon
          spiegazione: `Prezzo fuori mercato per un ${tipo.nomeTipo}! Costa il ${rincaroMercato}% in più del prezzo standard di lancio (€${tipo.standard}).`,
          icona: 'alert-circle-outline'
        };
      }
    }

    // --- CONFRONTO CON LO STORICO PERSONALE ---
    if (prezzi.length < 2) {
      return { 
        stato: 'IN CODA', 
        colore: '#3b82f6', // Blu
        spiegazione: `Prodotto ${tipo.nomeTipo !== 'Generico' ? tipo.nomeTipo : 'monitorato'}. In attesa di storico.`,
        icona: 'analytics-outline'
      };
    }

    // Se siamo vicino al minimo storico (entro il 2%) -> COMPRA ORA
    if (prezzoAttuale <= min * 1.02) {
      const risparmio = max > prezzoAttuale ? (((max - prezzoAttuale) / max) * 100).toFixed(0) : '0';
      return {
        stato: 'COMPRA ORA',
        colore: '#10b981', // Verde smeraldo neon
        spiegazione: `Minimo storico locale! Risparmi il ${risparmio}% rispetto al picco massimo (€${max.toFixed(2)}).`,
        icona: 'trending-down-outline'
      };
    }
    
    // Se siamo sotto la media -> BUON PREZZO (Acquisto conveniente)
    if (prezzoAttuale < media) {
      const scontoMedia = (((media - prezzoAttuale) / media) * 100).toFixed(0);
      return {
        stato: 'BUON PREZZO',
        colore: '#34d399', // Verde chiaro
        spiegazione: `Prezzo inferiore del ${scontoMedia}% rispetto alla media dello storico (€${media.toFixed(2)}).`,
        icona: 'checkmark-circle-outline'
      };
    }
    
    // Se siamo vicino al massimo storico (entro il 5%) -> EVITA
    if (prezzoAttuale >= max * 0.95) {
      const rincaro = min > 0 ? (((prezzoAttuale - min) / min) * 100).toFixed(0) : '0';
      return {
        stato: 'EVITA',
        colore: '#ef4444', // Rosso neon
        spiegazione: `Picco massimo registrato! È aumentato del ${rincaro}% rispetto al minimo (€${min.toFixed(2)}). Evita l'acquisto.`,
        icona: 'alert-circle-outline'
      };
    }
    
    // Se siamo sopra la media -> ATTENDI
    const eccessoMedia = (((prezzoAttuale - media) / media) * 100).toFixed(0);
    return {
      stato: 'ATTENDI',
      colore: '#f59e0b', // Arancione
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

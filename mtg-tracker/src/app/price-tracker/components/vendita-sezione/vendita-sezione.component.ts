import { Component, Input, Output, EventEmitter, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trash, image, openOutline, cashOutline, trendingUpOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline } from 'ionicons/icons';
import { Chart } from 'chart.js/auto';
import { IonIcon, IonInput, IonButton, IonGrid, IonRow, IonCol, IonCard } from '@ionic/angular/standalone';

@Component({
  selector: 'app-vendita-sezione',
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
  templateUrl: './vendita-sezione.component.html',
  styleUrls: []
})
export class VenditaSezioneComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() prodotti: any[] = [];
  @Input() vista: 'grid' | 'table' = 'grid';
  @Output() onAdd = new EventEmitter<string>();
  @Output() onRemove = new EventEmitter<string>();

  urlVendita: string = '';
  private chartInstances: { [key: string]: Chart } = {};

  constructor() {
    addIcons({ 
      trash, image, openOutline, cashOutline, trendingUpOutline, 
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
    if (!this.urlVendita) return;
    this.onAdd.emit(this.urlVendita);
    this.urlVendita = '';
  }

  rimuovi(id: string) {
    this.onRemove.emit(id);
  }

  rilevaTipoMtg(nome: string): { nomeTipo: string; standard: number; ottimo: number; caro: number } {
    return { nomeTipo: 'Generico', standard: 0, ottimo: 0, caro: 999999 };
  }

  // --- ALGORITMO DI VENDITA (SELL) ---
  ottieniSuggerimento(item: any): { stato: string; colore: string; spiegazione: string; icona: string } {
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
        colore: '#3b82f6', // Blu
        spiegazione: `Carta monitorata. In attesa di accumulare storico dei prezzi.`,
        icona: 'analytics-outline'
      };
    }

    // Se siamo vicino al massimo storico (entro il 5%) -> VENDI ORA
    if (prezzoAttuale >= max * 0.95) {
      const incremento = min > 0 ? (((prezzoAttuale - min) / min) * 100).toFixed(0) : '0';
      return {
        stato: 'VENDI ORA',
        colore: '#10b981', // Verde smeraldo neon
        spiegazione: `Picco massimo storico locale! Valore aumentato del ${incremento}% rispetto al minimo (€${min.toFixed(2)}).`,
        icona: 'trending-up-outline'
      };
    }
    
    // Se siamo sopra la media -> BUON PREZZO (Vendita vantaggiosa)
    if (prezzoAttuale > media) {
      const guadagnoMedia = (((prezzoAttuale - media) / media) * 100).toFixed(0);
      return {
        stato: 'BUON PREZZO',
        colore: '#34d399', // Verde chiaro
        spiegazione: `Valore superiore del ${guadagnoMedia}% rispetto alla media dello storico (€${media.toFixed(2)}). Buon momento per vendere.`,
        icona: 'checkmark-circle-outline'
      };
    }
    
    // Se siamo vicino al minimo storico (entro il 2%) -> EVITA VENDITA (TIENI)
    if (prezzoAttuale <= min * 1.02) {
      const perditaPicco = max > prezzoAttuale ? (((max - prezzoAttuale) / max) * 100).toFixed(0) : '0';
      return {
        stato: 'TIENI (HOLD)',
        colore: '#ef4444', // Rosso neon
        spiegazione: `Minimo storico registrato! Valore sceso del ${perditaPicco}% rispetto al picco massimo (€${max.toFixed(2)}). Evita di vendere ora.`,
        icona: 'alert-circle-outline'
      };
    }
    
    // Se siamo sotto la media -> ATTENDI RIALZO
    const deficitMedia = (((media - prezzoAttuale) / media) * 100).toFixed(0);
    return {
      stato: 'ATTENDI RIALZO',
      colore: '#f59e0b', // Arancione
      spiegazione: `Valore inferiore del ${deficitMedia}% rispetto alla media dello storico (€${media.toFixed(2)}). Attendi che si rialzi.`,
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
    // Per chi vende, un incremento di valore è positivo (verde), un calo è negativo (rosso)
    return att >= iniz ? '#10b981' : '#ef4444';
  }

  renderizzaGrafici() {
    this.prodotti.forEach((prodotto) => {
      const canvasId = `chart-vendita-${prodotto.id}`;
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
        gradient.addColorStop(0, 'rgba(244, 114, 182, 0.4)'); // Pink neon
        gradient.addColorStop(1, 'rgba(244, 114, 182, 0.0)');
      }

      this.chartInstances[prodotto.id] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            borderColor: '#f472b6', // Pink
            borderWidth: 2,
            pointBackgroundColor: '#f472b6',
            pointBorderColor: 'rgba(255,255,255,0.8)',
            pointRadius: labels.length === 1 ? 4 : 2,
            pointHoverRadius: 6,
            fill: true,
            backgroundColor: gradient || 'rgba(244, 114, 182, 0.1)',
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

import { Component, Input, Output, EventEmitter, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trash, image, openOutline, cashOutline, trendingUpOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline, funnelOutline } from 'ionicons/icons';
import { Chart } from 'chart.js/auto';
import { IonIcon, IonInput, IonButton, IonGrid, IonRow, IonCol, IonCard } from '@ionic/angular/standalone';

@Component({
  selector: 'app-selling-section',
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
  templateUrl: './selling-section.component.html',
  styleUrls: []
})
export class SellingSectionComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() products: any[] = [];
  @Input() viewMode: 'grid' | 'table' = 'grid';
  @Input() gridColumns: number = 4;
  
  @Output() onAdd = new EventEmitter<string>();
  @Output() onRemove = new EventEmitter<string>();
  @Output() onEditFilters = new EventEmitter<any>();

  urlInput: string = '';
  totalCards: number = 0;
  totalInitialValue: number = 0;
  totalCurrentValue: number = 0;
  totalYield: number = 0;
  totalReturnPercentage: number = 0;

  private chartInstances: { [key: string]: Chart } = {};
  private totalChartInstance: Chart | null = null;

  constructor() {
    addIcons({ 
      trash, image, openOutline, cashOutline, trendingUpOutline, 
      checkmarkCircleOutline, alertCircleOutline, timeOutline, funnelOutline
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.calculateTotalStats();
      this.renderCharts();
      this.renderTotalChart();
    }, 150);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['products'] || changes['viewMode'] || changes['gridColumns']) {
      setTimeout(() => {
        this.calculateTotalStats();
        this.renderCharts();
        this.renderTotalChart();
      }, 150);
    }
  }

  ngOnDestroy() {
    Object.values(this.chartInstances).forEach(chart => chart.destroy());
    if (this.totalChartInstance) {
      this.totalChartInstance.destroy();
    }
  }

  add() {
    if (this.urlInput.trim()) {
      this.onAdd.emit(this.urlInput.trim());
      this.urlInput = '';
    }
  }

  remove(id: string) {
    this.onRemove.emit(id);
  }

  editFilters(item: any) {
    this.onEditFilters.emit(item);
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

  getSuggestion(item: any): { label: string; color: string; explanation: string; icon: string } {
    if (!item.storico || item.storico.length < 2) {
      return { label: 'HOLD', color: '#3b82f6', explanation: 'Gathering price data to evaluate selling windows.', icon: 'time-outline' };
    }
    
    const initialPrice = item.storico[0].prezzo;
    const currentPrice = item.prezzoAttuale || 0;
    
    if (initialPrice <= 0) {
      return { label: 'HOLD', color: '#3b82f6', explanation: 'Gathering price data to evaluate selling windows.', icon: 'time-outline' };
    }

    const pct = ((currentPrice - initialPrice) / initialPrice) * 100;

    if (pct >= 30) {
      return { 
        label: 'SELL NOW', 
        color: '#10b981', 
        explanation: `Target met! Card is up ${pct.toFixed(0)}% from purchase price. Excellent profit lock-in window.`, 
        icon: 'checkmark-circle-outline' 
      };
    }
    
    if (pct <= -15) {
      return { 
        label: 'AVOID SELLING', 
        color: '#ef4444', 
        explanation: `Decline warning. Currently down ${Math.abs(pct).toFixed(0)}%. Avoid selling at a loss unless necessary.`, 
        icon: 'alert-circle-outline' 
      };
    }

    if (pct > 0) {
      return { 
        label: 'GOOD GROWTH', 
        color: '#3b82f6', 
        explanation: `Positive trend (+${pct.toFixed(0)}%). Monitor for the +30% profit target.`, 
        icon: 'trending-up-outline' 
      };
    }

    return { 
      label: 'STABLE HOLD', 
      color: '#64748b', 
      explanation: `Slight devaluation (${pct.toFixed(0)}%). Hold for rebound.`, 
      icon: 'time-outline' 
    };
  }

  calculateVariationText(item: any): string {
    if (!item.storico || item.storico.length < 2) return '0.0%';
    const initialPrice = item.storico[0].prezzo;
    const currentPrice = item.prezzoAttuale;
    if (!initialPrice || !currentPrice) return '0.0%';
    
    const diff = currentPrice - initialPrice;
    const pct = (diff / initialPrice) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  }

  calculateVariationColor(item: any): string {
    if (!item.storico || item.storico.length < 2) return '#64748b';
    const initialPrice = item.storico[0].prezzo;
    const currentPrice = item.prezzoAttuale;
    if (!initialPrice || !currentPrice) return '#64748b';
    return (currentPrice - initialPrice) >= 0 ? '#10b981' : '#ef4444'; // Green is good for selling (gain)
  }

  calculateTotalStats() {
    this.totalCards = this.products.length;
    this.totalInitialValue = 0;
    this.totalCurrentValue = 0;

    this.products.forEach(p => {
      const initialPrice = p.storico && p.storico.length > 0 ? p.storico[0].prezzo : p.prezzoAttuale || 0;
      this.totalInitialValue += initialPrice;
      this.totalCurrentValue += p.prezzoAttuale || initialPrice;
    });

    this.totalYield = this.totalCurrentValue - this.totalInitialValue;
    this.totalReturnPercentage = this.totalInitialValue > 0 
      ? (this.totalYield / this.totalInitialValue) * 100 
      : 0;
  }

  private renderCharts() {
    if (this.viewMode !== 'grid') return;
    
    this.products.forEach(item => {
      const canvasId = 'chart-vendita-' + item.id;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!canvas) return;

      if (this.chartInstances[item.id]) {
        this.chartInstances[item.id].destroy();
      }

      const history = item.storico || [];
      if (history.length === 0) return;

      const labels = history.map((h: any) => h.data);
      const data = history.map((h: any) => h.prezzo);

      const ctx = canvas.getContext('2d');
      let gradient = null;
      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 90);
        gradient.addColorStop(0, 'rgba(244, 114, 182, 0.15)');
        gradient.addColorStop(1, 'rgba(244, 114, 182, 0.00)');
      }

      const datasets: any[] = [{
        label: 'Selected Price',
        data: data,
        borderColor: '#f472b6',
        borderWidth: 2.5,
        pointRadius: data.length === 1 ? 3 : 0,
        pointHoverRadius: 5,
        fill: true,
        backgroundColor: gradient || 'rgba(244, 114, 182, 0.1)',
        tension: 0.3
      }];

      // English history comparisons
      const enData = history.map((h: any) => h.pricesByLanguage ? h.pricesByLanguage.en : null);
      if (enData.some((v: any) => v !== null && v !== undefined)) {
        datasets.push({
          label: 'EN Price',
          data: enData,
          borderColor: '#60a5fa',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
          tension: 0.3
        });
      }

      // Italian history comparisons
      const itData = history.map((h: any) => h.pricesByLanguage ? h.pricesByLanguage.it : null);
      if (itData.some((v: any) => v !== null && v !== undefined)) {
        datasets.push({
          label: 'IT Price',
          data: itData,
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
          tension: 0.3
        });
      }

      this.chartInstances[item.id] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
            legend: { 
              display: datasets.length > 1,
              position: 'top',
              labels: {
                color: '#94a3b8',
                boxWidth: 8,
                padding: 6,
                font: { size: 9, weight: 'bold' }
              }
            } 
          },
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

  private renderTotalChart() {
    const canvas = document.getElementById('chart-vendite-totale') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.totalChartInstance) {
      this.totalChartInstance.destroy();
      this.totalChartInstance = null;
    }

    if (this.products.length === 0) return;

    const dateSet = new Set<string>();
    this.products.forEach(p => {
      (p.storico || []).forEach((h: any) => {
        if (h.data) dateSet.add(h.data);
      });
    });

    const parseDate = (dStr: string) => {
      const parts = dStr.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
      return new Date(dStr);
    };

    const sortedDates = Array.from(dateSet).sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime());

    if (sortedDates.length === 0) return;

    const totalValues = sortedDates.map(date => {
      let dailySum = 0;
      this.products.forEach(p => {
        const history = p.storico || [];
        const targetTime = parseDate(date).getTime();
        
        let matchingPoint = null;
        for (const point of history) {
          const pointTime = parseDate(point.data).getTime();
          if (pointTime <= targetTime) {
            if (!matchingPoint || pointTime > parseDate(matchingPoint.data).getTime()) {
              matchingPoint = point;
            }
          }
        }
        
        if (matchingPoint) {
          dailySum += matchingPoint.prezzo;
        } else if (history.length > 0) {
          dailySum += history[0].prezzo;
        } else {
          dailySum += p.prezzoAttuale || 0;
        }
      });
      return dailySum;
    });

    const ctx = canvas.getContext('2d');
    let gradient = null;
    if (ctx) {
      gradient = ctx.createLinearGradient(0, 0, 0, 160);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    }

    this.totalChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: [{
          label: 'Total Value',
          data: totalValues,
          borderColor: '#10b981',
          borderWidth: 2,
          pointRadius: totalValues.length === 1 ? 4 : 0,
          pointHoverRadius: 5,
          fill: true,
          backgroundColor: gradient || 'rgba(16, 185, 129, 0.1)',
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => `Total Portfolio: €${Number(context.raw).toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#64748b', font: { size: 10, weight: 'bold' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: {
              color: '#64748b',
              font: { size: 10, weight: 'bold' },
              callback: (value) => '€' + Number(value).toFixed(2)
            }
          }
        }
      }
    });
  }
}

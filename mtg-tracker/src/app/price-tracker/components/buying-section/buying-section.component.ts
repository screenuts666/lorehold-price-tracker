import { Component, Input, Output, EventEmitter, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trash, image, openOutline, cartOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline, star, calendarOutline, funnelOutline } from 'ionicons/icons';
import { Chart } from 'chart.js/auto';
import { IonIcon, IonInput, IonButton, IonGrid, IonRow, IonCol, IonCard } from '@ionic/angular/standalone';
import { MarketAnalyzerService, ProductType, Product, InsightSeverity } from '../../services/market-analyzer.service';

@Component({
  selector: 'app-buying-section',
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
  templateUrl: './buying-section.component.html',
  styleUrls: []
})
export class BuyingSectionComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() products: any[] = [];
  @Input() viewMode: 'grid' | 'table' = 'grid';
  @Input() gridColumns: number = 4;
  
  @Output() onAdd = new EventEmitter<{url: string, releaseDate: string}>();
  @Output() onRemove = new EventEmitter<string>();
  @Output() onUpdate = new EventEmitter<any>();
  @Output() onEditFilters = new EventEmitter<any>();

  expandedCardId: string | null = null;

  toggleExpand(id: string, event: Event) {
    if (window.innerWidth < 576) {
      this.expandedCardId = this.expandedCardId === id ? null : id;
    }
  }

  urlInput: string = '';
  releaseDateInput: string = '';
  private chartInstances: { [key: string]: Chart } = {};
  readonly InsightSeverity = InsightSeverity;
  
  // Cache to avoid recalculating suggestion on every change detection cycle
  private suggestionCache: Map<string, { label: string; color: string; explanation: string; icon: string; severity?: InsightSeverity }> = new Map();

  constructor(private marketAnalyzer: MarketAnalyzerService) {
    addIcons({ 
      trash, image, openOutline, cartOutline, trendingDownOutline, 
      checkmarkCircleOutline, alertCircleOutline, timeOutline, star, calendarOutline, funnelOutline
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderCharts(), 150);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['products'] || changes['viewMode'] || changes['gridColumns']) {
      this.suggestionCache.clear();
      setTimeout(() => this.renderCharts(), 150);
    }
  }

  ngOnDestroy() {
    Object.values(this.chartInstances).forEach(chart => chart.destroy());
  }

  add() {
    if (this.urlInput.trim()) {
      this.onAdd.emit({
        url: this.urlInput.trim(),
        releaseDate: this.releaseDateInput
      });
      this.urlInput = '';
      this.releaseDateInput = '';
    }
  }

  remove(id: string) {
    this.onRemove.emit(id);
  }

  editFilters(item: any) {
    this.onEditFilters.emit(item);
  }

  updateReleaseDate(item: any, date: string) {
    item.releaseDate = date || undefined;
    this.onUpdate.emit(item);
    this.suggestionCache.delete(item.id);
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

  getSuggestion(item: any): { label: string; color: string; explanation: string; icon: string; severity?: InsightSeverity } {
    if (this.suggestionCache.has(item.id)) {
      return this.suggestionCache.get(item.id)!;
    }

    try {
      const historicalPrices = (item.storico || []).map((h: any) => ({
        date: this.parseDate(h.data),
        price: h.prezzo
      }));

      const parsedLaunchDate = historicalPrices.length > 0 ? historicalPrices[0].date : new Date();
      const launchPrice = historicalPrices.length > 0 ? historicalPrices[0].price : item.prezzoAttuale || 0;
      const mtgInfo = this.detectMtgType(item.nome);
      
      let pType = ProductType.PLAY_BOOSTER;
      if (mtgInfo.nameType === 'Bundle') pType = ProductType.BUNDLE;
      if (mtgInfo.nameType === 'Prerelease Pack') pType = ProductType.PRERELEASE;
      if (mtgInfo.nameType === 'Commander Deck') pType = ProductType.PLAY_BOOSTER;
      if (mtgInfo.nameType === 'Collector Box') pType = ProductType.PLAY_BOOSTER;
      if (item.nome && item.nome.toLowerCase().includes('secret lair')) {
        pType = ProductType.SECRET_LAIR;
      }

      const product: Product = {
        currentPrice: item.prezzoAttuale || (historicalPrices.length > 0 ? historicalPrices[historicalPrices.length - 1].price : 0),
        launchDate: parsedLaunchDate,
        releaseDate: item.releaseDate || undefined,
        historicalPrices: historicalPrices,
        baseLaunchPrice: launchPrice,
        productType: pType
      };

      // Check if releaseDate is set and in the future
      let usePreorder = false;
      if (product.releaseDate) {
        const relDate = new Date(product.releaseDate);
        if (!isNaN(relDate.getTime()) && relDate.getTime() > new Date().getTime()) {
          usePreorder = true;
        }
      }

      if (usePreorder) {
        const preorderInsight = this.marketAnalyzer.analyzePreorderPhase(product);
        const color = this.severityToHex(preorderInsight.severity);
        const icon = preorderInsight.severity === InsightSeverity.STRONG_BUY
          ? 'star'
          : (preorderInsight.severity === InsightSeverity.AVOID ? 'alert-circle-outline' : 'time-outline');

        const suggestion = {
          label: preorderInsight.badgeText,
          color: color,
          explanation: preorderInsight.message,
          icon: icon,
          severity: preorderInsight.severity
        };
        this.suggestionCache.set(item.id, suggestion);
        return suggestion;
      } else {
        const recommendation = this.marketAnalyzer.analyzeMarket(product);
        const stateSeverity = recommendation.state === 'BUY' 
          ? InsightSeverity.BUY 
          : (recommendation.state === 'AVOID' ? InsightSeverity.AVOID : InsightSeverity.NEUTRAL);
          
        const color = this.severityToHex(stateSeverity);
        const icon = recommendation.state === 'BUY' 
          ? 'checkmark-circle-outline' 
          : (recommendation.state === 'AVOID' ? 'alert-circle-outline' : 'time-outline');

        const suggestion = {
          label: recommendation.badgeText,
          color: color,
          explanation: recommendation.message,
          icon: icon,
          severity: stateSeverity
        };
        this.suggestionCache.set(item.id, suggestion);
        return suggestion;
      }
    } catch (e) {
      console.error(e);
      return { label: 'ERROR', color: '#64748b', explanation: 'Error analyzing card details.', icon: 'alert-circle-outline' };
    }
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return new Date(dateStr);
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
    return (currentPrice - initialPrice) < 0 ? '#10b981' : '#ef4444'; // Green is good for buy (decline)
  }

  severityToHex(severity: InsightSeverity): string {
    switch (severity) {
      case InsightSeverity.STRONG_BUY: return '#8b5cf6'; // Violet glow
      case InsightSeverity.BUY: return '#10b981'; // Green
      case InsightSeverity.NEUTRAL: return '#3b82f6'; // Blue
      case InsightSeverity.WAIT: return '#f59e0b'; // Amber
      case InsightSeverity.WARNING: return '#f97316'; // Orange
      case InsightSeverity.AVOID: return '#ef4444'; // Red
      default: return '#64748b';
    }
  }

  severityToGlow(severity?: InsightSeverity): string {
    if (severity === InsightSeverity.STRONG_BUY) {
      return '0 0 10px rgba(139, 92, 246, 0.4)';
    }
    return '';
  }

  private renderCharts() {
    if (this.viewMode !== 'grid') return;
    
    this.products.forEach(item => {
      const canvasId = 'chart-acquisto-' + item.id;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!canvas) return;

      if (this.chartInstances[item.id]) {
        this.chartInstances[item.id].destroy();
      }

      const history = item.storico || [];
      if (history.length === 0 && (!item.ctHistory || item.ctHistory.length === 0)) return;

      let labels: string[] = [];
      const datasets: any[] = [];
      const ctx = canvas.getContext('2d');
      let gradient = null;
      let gradientBlue = null;

      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 90);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.00)');
        
        gradientBlue = ctx.createLinearGradient(0, 0, 0, 90);
        gradientBlue.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
        gradientBlue.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
      }

      // If we have CardTrader full history, use that as the primary X-axis and dataset
      if (item.ctHistory && item.ctHistory.length > 0) {
        labels = item.ctHistory.map((h: any) => {
          const d = new Date(h.t);
          return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
        });
        
        datasets.push({
          label: 'CT Market',
          data: item.ctHistory.map((h: any) => h.p),
          borderColor: '#38bdf8',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          backgroundColor: gradientBlue || 'rgba(56, 189, 248, 0.1)',
          tension: 0.3
        });
      } else {
        // Fallback to our limited cron history
        labels = history.map((h: any) => h.data);
      }

      // Always show our own "Selected Price" history if it has data
      if (history.length > 0) {
        // If CT history is present, we need to align the data points to the end of the array
        let data = history.map((h: any) => h.prezzo);
        if (item.ctHistory && item.ctHistory.length > 0) {
           const paddedData = new Array(labels.length).fill(null);
           // Put our data at the very end (assuming our history is the most recent)
           for (let i = 0; i < data.length; i++) {
             if (labels.length - data.length + i >= 0) {
               paddedData[labels.length - data.length + i] = data[i];
             }
           }
           data = paddedData;
        }

        datasets.push({
          label: 'Selected Price',
          data: data,
          borderColor: '#a78bfa',
          borderWidth: 2.5,
          pointRadius: history.length === 1 ? 3 : 0,
          pointHoverRadius: 5,
          fill: !item.ctHistory || item.ctHistory.length === 0,
          backgroundColor: gradient || 'rgba(139, 92, 246, 0.1)',
          tension: 0.3
        });
      }

      // English history comparisons
      let enData = history.map((h: any) => h.pricesByLanguage ? h.pricesByLanguage.en : null);
      if (enData.some((v: any) => v !== null && v !== undefined)) {
        if (item.ctHistory && item.ctHistory.length > 0) {
           const paddedData = new Array(labels.length).fill(null);
           for (let i = 0; i < enData.length; i++) {
             if (labels.length - enData.length + i >= 0) {
               paddedData[labels.length - enData.length + i] = enData[i];
             }
           }
           enData = paddedData;
        }
        datasets.push({
          label: 'EN Price',
          data: enData,
          borderColor: '#60a5fa',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: enData.filter((v: any) => v !== null).length === 1 ? 3 : 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.3
        });
      }

      // Italian history comparisons
      let itData = history.map((h: any) => h.pricesByLanguage ? h.pricesByLanguage.it : null);
      if (itData.some((v: any) => v !== null && v !== undefined)) {
        if (item.ctHistory && item.ctHistory.length > 0) {
           const paddedData = new Array(labels.length).fill(null);
           for (let i = 0; i < itData.length; i++) {
             if (labels.length - itData.length + i >= 0) {
               paddedData[labels.length - itData.length + i] = itData[i];
             }
           }
           itData = paddedData;
        }
        datasets.push({
          label: 'IT Price',
          data: itData,
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: itData.filter((v: any) => v !== null).length === 1 ? 3 : 0,
          pointHoverRadius: 5,
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
            x: { 
              display: true,
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: {
                color: '#64748b',
                font: { size: 9 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 6
              }
            },
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

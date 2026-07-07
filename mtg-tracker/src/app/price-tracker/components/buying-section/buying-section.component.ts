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
  @Output() onUpdate = new EventEmitter<void>();
  @Output() onEditFilters = new EventEmitter<any>();

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
    this.onUpdate.emit();
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
      if (history.length === 0) return;

      const labels = history.map((h: any) => h.data);
      const data = history.map((h: any) => h.prezzo);

      const ctx = canvas.getContext('2d');
      let gradient = null;
      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 90);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.00)');
      }

      const datasets: any[] = [{
        label: 'Selected Price',
        data: data,
        borderColor: '#a78bfa',
        borderWidth: 2.5,
        pointRadius: data.length === 1 ? 3 : 0,
        pointHoverRadius: 5,
        fill: true,
        backgroundColor: gradient || 'rgba(139, 92, 246, 0.1)',
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
}

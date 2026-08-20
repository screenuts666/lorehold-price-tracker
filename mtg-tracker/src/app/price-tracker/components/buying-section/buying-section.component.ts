import { Component, input, output, inject, OnChanges, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { trash, image, openOutline, cartOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline, star, calendarOutline, funnelOutline } from 'ionicons/icons';
import { Chart, ChartDataset } from 'chart.js/auto';
import { IonIcon, IonInput, IonButton } from '@ionic/angular/standalone';
import { MarketAnalyzerService } from '../../services/market-analyzer.service';
import { MtgCategoryService } from '../../services/mtg-category.service';
import { LanguageService } from '../../services/language.service';
import { EmptyStateComponent, MarketAdviceBadgeComponent } from '../../../shared';
import { MtgProduct, MarketAdviceSuggestion, ViewModeType, ProductType, Product, InsightSeverity } from '../../../models';
import { parseItalianDate } from '../../../utils/date.utils';
import { calculatePercentageVariation } from '../../../utils/format.utils';
import { CHART_THEME, createThemeGradient, getThemeAlphaColor } from '../../../utils/chart-theme.utils';

@Component({
  selector: 'app-buying-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    IonInput,
    IonButton,
    EmptyStateComponent,
    MarketAdviceBadgeComponent
  ],
  templateUrl: './buying-section.component.html',
  styleUrls: ['./buying-section.component.scss']
})
export class BuyingSectionComponent implements OnChanges, OnDestroy {
  products = input<MtgProduct[]>([]);
  viewMode = input<ViewModeType>('grid');
  gridColumns = input<number>(4);
  isDetailView = input<boolean>(false);
  
  productAdded = output<{url: string, releaseDate: string}>();
  productRemoved = output<string>();
  productUpdated = output<MtgProduct>();
  filtersEdited = output<MtgProduct>();

  expandedCardId = signal<string | null>(null);

  toggleExpand(id: string, event: Event) {
    if (window.innerWidth < 576) {
      this.expandedCardId.set(this.expandedCardId() === id ? null : id);
    }
  }

  urlInput = signal<string>('');
  releaseDateInput = signal<string>('');
  private chartInstances: { [key: string]: Chart } = {};
  readonly InsightSeverity = InsightSeverity;
  
  private marketAnalyzer = inject(MarketAnalyzerService);
  public langService = inject(LanguageService);
  public categoryService = inject(MtgCategoryService);

  // Cache to avoid recalculating suggestion on every change detection cycle
  private suggestionCache: Map<string, MarketAdviceSuggestion> = new Map();
  private renderTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentRenderBatch = 0;

  constructor() {
    addIcons({ 
      trash, image, openOutline, cartOutline, trendingDownOutline, 
      checkmarkCircleOutline, alertCircleOutline, timeOutline, star, calendarOutline, funnelOutline
    });

    effect(() => {
      this.products();
      this.viewMode();
      this.gridColumns();
      this.scheduleChartRender();
    });

    effect(() => {
      // Invalidate suggestion cache when language changes
      this.langService.currentLang();
      this.suggestionCache.clear();
    });
  }

  ngOnChanges() {
    this.suggestionCache.clear();
  }

  ngOnDestroy() {
    this.cancelScheduledRender();
    Object.values(this.chartInstances).forEach(chart => chart.destroy());
    this.chartInstances = {};
  }

  private cancelScheduledRender() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
    this.currentRenderBatch++;
  }

  private scheduleChartRender() {
    this.cancelScheduledRender();
    this.renderTimeout = setTimeout(() => {
      this.renderChartsChunked();
    }, 50);
  }

  onUrlInput(event: CustomEvent) {
    this.urlInput.set(event.detail.value || '');
  }

  add() {
    if (this.urlInput().trim()) {
      this.productAdded.emit({
        url: this.urlInput().trim(),
        releaseDate: this.releaseDateInput()
      });
      this.urlInput.set('');
      this.releaseDateInput.set('');
    }
  }

  remove(id: string) {
    this.productRemoved.emit(id);
  }

  editFilters(item: MtgProduct) {
    this.filtersEdited.emit(item);
  }

  updateReleaseDate(item: MtgProduct, date: string) {
    item.releaseDate = date || undefined;
    this.productUpdated.emit(item);
    this.suggestionCache.delete(item.id);
  }

  detectMtgType(name: string) {
    return this.categoryService.detectCategory(name);
  }

  getBargainBannerText(item: MtgProduct): string {
    const info = this.detectMtgType(item.nome);
    if (this.langService.currentLang() === 'en') {
      return `${info.nameType} Deal (≤ €${info.defaultThreshold})!`;
    }
    return `Occasione ${info.nameType} (≤ ${info.defaultThreshold}€)!`;
  }

  getSuggestion(item: MtgProduct): MarketAdviceSuggestion {
    if (this.suggestionCache.has(item.id)) {
      return this.suggestionCache.get(item.id)!;
    }

    if (item.ai_verdict && item.ai_reason) {
      let severity = InsightSeverity.NEUTRAL;
      const verdictUpper = item.ai_verdict.toUpperCase();
      if (verdictUpper.includes('COMPRA') || verdictUpper.includes('BUY')) severity = InsightSeverity.BUY;
      else if (verdictUpper.includes('ASPETTA') || verdictUpper.includes('WAIT')) severity = InsightSeverity.WAIT;
      else if (verdictUpper.includes('SOVRAPPREZZO') || verdictUpper.includes('OVERPRICED') || verdictUpper.includes('EXPENSIVE')) severity = InsightSeverity.AVOID;

      let displayVerdict = item.ai_verdict;
      if (this.langService.currentLang() === 'en') {
        if (verdictUpper.includes('COMPRA')) displayVerdict = 'BUY NOW';
        else if (verdictUpper.includes('ASPETTA')) displayVerdict = 'WAIT';
        else if (verdictUpper.includes('SOVRAPPREZZO')) displayVerdict = 'OVERPRICED';
      }

      const suggestion: MarketAdviceSuggestion = {
        label: `✨ AI: ${displayVerdict}`,
        explanation: item.ai_reason,
        icon: severity === InsightSeverity.BUY ? 'star' : (severity === InsightSeverity.AVOID ? 'alert-circle-outline' : 'time-outline'),
        severity: severity
      };
      this.suggestionCache.set(item.id, suggestion);
      return suggestion;
    }

    try {
      const historicalPrices = (item.storico || []).map(h => ({
        date: parseItalianDate(h.data),
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
        const icon = preorderInsight.severity === InsightSeverity.STRONG_BUY
          ? 'star'
          : (preorderInsight.severity === InsightSeverity.AVOID ? 'alert-circle-outline' : 'time-outline');

        const suggestion: MarketAdviceSuggestion = {
          label: preorderInsight.badgeText,
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
          
        const icon = recommendation.state === 'BUY' 
          ? 'checkmark-circle-outline' 
          : (recommendation.state === 'AVOID' ? 'alert-circle-outline' : 'time-outline');

        const suggestion: MarketAdviceSuggestion = {
          label: recommendation.badgeText,
          explanation: recommendation.message,
          icon: icon,
          severity: stateSeverity
        };
        this.suggestionCache.set(item.id, suggestion);
        return suggestion;
      }
    } catch (e) {
      console.error(e);
      return { label: 'ERROR', explanation: 'Error analyzing card details.', icon: 'alert-circle-outline', severity: InsightSeverity.WARNING };
    }
  }

  calculateVariationText(item: MtgProduct): string {
    const initialPrice = item.storico && item.storico.length > 0 ? item.storico[0].prezzo : null;
    return calculatePercentageVariation(initialPrice, item.prezzoAttuale, 'buy').text;
  }

  getVariationClass(item: MtgProduct): string {
    const initialPrice = item.storico && item.storico.length > 0 ? item.storico[0].prezzo : null;
    return calculatePercentageVariation(initialPrice, item.prezzoAttuale, 'buy').cssClass;
  }

  hasPriceVariation(item: MtgProduct): boolean {
    if (item.ctHistory && item.ctHistory.length > 1) {
      const firstP = item.ctHistory[0].p;
      return item.ctHistory.some(h => h.p !== firstP);
    }
    if (item.storico && item.storico.length > 1) {
      const firstP = item.storico[0].prezzo;
      return item.storico.some(h => h.prezzo !== firstP);
    }
    return false;
  }  private renderChartsChunked() {
    if (this.viewMode() !== 'grid') return;
    const batchId = ++this.currentRenderBatch;
    const list = this.products();
    if (!list || list.length === 0) return;

    let index = 0;
    const CHUNK_SIZE = 6;

    const renderNextChunk = () => {
      if (batchId !== this.currentRenderBatch) return; // Batch superseded
      const end = Math.min(index + CHUNK_SIZE, list.length);
      
      for (let i = index; i < end; i++) {
        this.renderSingleProductChart(list[i]);
      }
      
      index = end;
      if (index < list.length) {
        requestAnimationFrame(renderNextChunk);
      }
    };

    requestAnimationFrame(renderNextChunk);
  }

  private renderSingleProductChart(item: MtgProduct) {
    const canvasId = 'chart-acquisto-' + item.id;
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    if (this.chartInstances[item.id]) {
      this.chartInstances[item.id].destroy();
      delete this.chartInstances[item.id];
    }

    const history = item.storico || [];
    if (history.length === 0 && (!item.ctHistory || item.ctHistory.length === 0)) return;

    let labels: string[] = [];
    const datasets: ChartDataset<'line'>[] = [];
    const ctx = canvas.getContext('2d');
    let gradient: CanvasGradient | null = null;
    let gradientBlue: CanvasGradient | null = null;
    if (ctx) {
      gradient = createThemeGradient(ctx, '--chart-primary', 0.35, 0.00, 75);
      gradientBlue = createThemeGradient(ctx, '--chart-cyan', 0.25, 0.00, 75);
    }

    // If we have CardTrader full history, use that as the primary X-axis and dataset
    if (item.ctHistory && item.ctHistory.length > 0) {
      labels = item.ctHistory.map(h => {
        const d = new Date(h.d);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
      });
      
      datasets.push({
        label: 'CT Market',
        data: item.ctHistory.map(h => h.p),
        borderColor: CHART_THEME.colors.primaryCyan,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        backgroundColor: gradientBlue || getThemeAlphaColor('--chart-cyan', 0.1),
        tension: 0.3
      });
    } else {
      labels = history.map(h => h.data);
    }

    // Always show our own "Selected Price" history if it has data
    if (history.length > 0) {
      let data: (number | null)[] = history.map(h => h.prezzo);
      if (item.ctHistory && item.ctHistory.length > 0) {
         const paddedData: (number | null)[] = new Array(labels.length).fill(null);
         for (let i = 0; i < data.length; i++) {
           if (labels.length - data.length + i >= 0) {
             paddedData[labels.length - data.length + i] = data[i];
           }
         }
         data = paddedData;
      }

      datasets.push({
        label: 'Selected Price',
        data: data as number[],
        borderColor: CHART_THEME.colors.primary,
        borderWidth: 2.5,
        pointRadius: history.length === 1 ? 3 : 0,
        pointHoverRadius: 5,
        fill: !item.ctHistory || item.ctHistory.length === 0,
        backgroundColor: gradient || getThemeAlphaColor('--chart-primary', 0.1),
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
        animation: { duration: 0 }, // Instant render without animation lag
        plugins: { 
          legend: { 
            display: datasets.length > 1,
            position: 'top',
            labels: {
              color: CHART_THEME.colors.axisText,
              boxWidth: 8,
              padding: 6,
              font: { size: CHART_THEME.typography.fontSize, weight: 'bold' }
            }
          } 
        },
        scales: {
          x: { 
            display: true,
            grid: { color: CHART_THEME.colors.grid },
            ticks: {
              color: CHART_THEME.colors.axisTextDim,
              font: { size: CHART_THEME.typography.fontSize },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6
            }
          },
          y: { 
            grid: { color: CHART_THEME.colors.grid },
            ticks: {
              color: CHART_THEME.colors.axisTextDim,
              font: { size: CHART_THEME.typography.fontSize, weight: 'bold' },
              callback: (value) => '€' + Number(value).toFixed(0)
            }
          }
        }
      }
    });
  }
}

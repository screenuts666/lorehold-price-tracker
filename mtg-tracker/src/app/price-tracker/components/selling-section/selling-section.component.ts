import {
  Component,
  input,
  output,
  OnDestroy,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  trash,
  image,
  openOutline,
  cashOutline,
  trendingUpOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  timeOutline,
  funnelOutline,
} from 'ionicons/icons';
import { Chart, ChartDataset } from 'chart.js/auto';
import {
  IonIcon,
  IonInput,
  IonButton,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
} from '@ionic/angular/standalone';
import { MarketAdviceBadgeComponent } from '../../../shared';
import {
  MtgProduct,
  MarketAdviceSuggestion,
  ViewModeType,
  InsightSeverity,
} from '../../../models';
import { parseItalianDate } from '../../../utils/date.utils';
import { calculatePercentageVariation } from '../../../utils/format.utils';
import { MtgCategoryService } from '../../services/mtg-category.service';
import { LanguageService } from '../../services/language.service';
import {
  CHART_THEME,
  createThemeGradient,
  getThemeAlphaColor,
} from '../../../utils/chart-theme.utils';

@Component({
  selector: 'app-selling-section',
  standalone: true,
  imports: [
    IonCard,
    IonCol,
    IonRow,
    IonGrid,
    CommonModule,
    IonButton,
    IonIcon,
    IonInput,
    MarketAdviceBadgeComponent,
  ],
  templateUrl: './selling-section.component.html',
  styleUrls: ['./selling-section.component.scss'],
})
export class SellingSectionComponent implements OnDestroy {
  products = input<MtgProduct[]>([]);
  viewMode = input<ViewModeType>('grid');
  gridColumns = input<number>(4);

  productAdded = output<string>();
  productRemoved = output<string>();
  filtersEdited = output<MtgProduct>();

  expandedCardId = signal<string | null>(null);

  toggleExpand(id: string, event: Event) {
    if (window.innerWidth < 576) {
      this.expandedCardId.set(this.expandedCardId() === id ? null : id);
    }
  }

  urlInput = signal<string>('');

  totalCards = computed(() => this.products().length);

  totalInitialValue = computed(() => {
    let sum = 0;
    this.products().forEach((p) => {
      const initialPrice =
        p.storico && p.storico.length > 0
          ? p.storico[0].prezzo
          : p.prezzoAttuale || 0;
      sum += initialPrice;
    });
    return sum;
  });

  totalCurrentValue = computed(() => {
    let sum = 0;
    this.products().forEach((p) => {
      sum += p.prezzoAttuale || 0;
    });
    return sum;
  });

  totalYield = computed(() => {
    return this.totalCurrentValue() - this.totalInitialValue();
  });

  totalReturnPercentage = computed(() => {
    const init = this.totalInitialValue();
    if (init === 0) return 0;
    return ((this.totalCurrentValue() - init) / init) * 100;
  });

  private chartInstances: { [key: string]: Chart } = {};
  private totalChartInstance: Chart | null = null;
  private renderTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentRenderBatch = 0;

  constructor() {
    addIcons({
      trash,
      image,
      openOutline,
      cashOutline,
      trendingUpOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      timeOutline,
      funnelOutline,
    });
    effect(() => {
      this.products();
      this.viewMode();
      this.gridColumns();
      this.scheduleChartRender();
    });
  }

  ngOnDestroy() {
    this.cancelScheduledRender();
    Object.values(this.chartInstances).forEach((chart) => chart.destroy());
    this.chartInstances = {};
    if (this.totalChartInstance) {
      this.totalChartInstance.destroy();
      this.totalChartInstance = null;
    }
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
      this.renderTotalChart();
    }, 50);
  }

  onUrlInput(event: CustomEvent) {
    this.urlInput.set(event.detail.value || '');
  }

  add() {
    const u = this.urlInput().trim();
    if (u) {
      this.productAdded.emit(u);
      this.urlInput.set('');
    }
  }

  remove(id: string) {
    this.productRemoved.emit(id);
  }

  editFilters(item: MtgProduct) {
    this.filtersEdited.emit(item);
  }

  public categoryService = inject(MtgCategoryService);
  public langService = inject(LanguageService);

  detectMtgType(name: string) {
    return this.categoryService.detectCategory(name);
  }

  getSuggestion(item: MtgProduct): MarketAdviceSuggestion {
    const isEn = this.langService.currentLang() === 'en';

    if (item.ai_verdict && item.ai_reason) {
      let severity = InsightSeverity.NEUTRAL;
      const verdictUpper = item.ai_verdict.toUpperCase();
      if (verdictUpper.includes('COMPRA') || verdictUpper.includes('BUY'))
        severity = InsightSeverity.BUY;
      else if (
        verdictUpper.includes('ASPETTA') ||
        verdictUpper.includes('WAIT')
      )
        severity = InsightSeverity.WAIT;
      else if (
        verdictUpper.includes('SOVRAPPREZZO') ||
        verdictUpper.includes('OVERPRICED') ||
        verdictUpper.includes('EXPENSIVE')
      )
        severity = InsightSeverity.AVOID;

      let displayVerdict = item.ai_verdict;
      if (isEn) {
        if (verdictUpper.includes('COMPRA')) displayVerdict = 'BUY NOW';
        else if (verdictUpper.includes('ASPETTA')) displayVerdict = 'WAIT';
        else if (verdictUpper.includes('SOVRAPPREZZO'))
          displayVerdict = 'OVERPRICED';
      }

      return {
        label: `✨ AI: ${displayVerdict}`,
        explanation: item.ai_reason,
        icon:
          severity === InsightSeverity.BUY
            ? 'trending-up-outline'
            : severity === InsightSeverity.AVOID
              ? 'alert-circle-outline'
              : 'time-outline',
        severity: severity,
      };
    }

    const initial =
      item.storico && item.storico.length > 0
        ? item.storico[0].prezzo
        : item.prezzoAttuale || 0;
    const current = item.prezzoAttuale || initial;

    if (initial === 0) {
      return {
        label: isEn ? 'PENDING' : 'IN ATTESA',
        explanation: isEn
          ? 'Initial price not yet recorded to determine market trend.'
          : 'Prezzo iniziale non ancora registrato per determinare il trend.',
        icon: 'time-outline',
        severity: InsightSeverity.NEUTRAL,
      };
    }

    const pct = ((current - initial) / initial) * 100;
    if (pct >= 20) {
      return {
        label: isEn ? 'GREAT PROFIT' : 'OTTIMO PROFITTO',
        explanation: isEn
          ? `Product gained ${pct.toFixed(1)}%. Prime window to capitalize and take profits!`
          : `Il prodotto ha guadagnato il ${pct.toFixed(1)}%. Ottima finestra per capitalizzare!`,
        icon: 'checkmark-circle-outline',
        severity: InsightSeverity.STRONG_BUY,
      };
    } else if (pct >= 5) {
      return {
        label: isEn ? 'GROWING' : 'IN CRESCITA',
        explanation: isEn
          ? `Moderate gain (+${pct.toFixed(1)}%). Positive upward trend.`
          : `Guadagno moderato (+${pct.toFixed(1)}%). Trend positivo.`,
        icon: 'trending-up-outline',
        severity: InsightSeverity.BUY,
      };
    } else if (pct > -5) {
      return {
        label: isEn ? 'STABLE' : 'STABILE',
        explanation: isEn
          ? 'Price is currently aligned with initial acquisition value.'
          : 'Il prezzo è in linea con il valore di carico iniziale.',
        icon: 'time-outline',
        severity: InsightSeverity.NEUTRAL,
      };
    } else {
      return {
        label: isEn ? 'AT A LOSS' : 'IN PERDITA',
        explanation: isEn
          ? `Product is down -${Math.abs(pct).toFixed(1)}%. Better to wait for a rebound before selling.`
          : `Il prodotto segna un -${Math.abs(pct).toFixed(1)}%. Conviene attendere un rimbalzo prima di vendere.`,
        icon: 'alert-circle-outline',
        severity: InsightSeverity.AVOID,
      };
    }
  }

  calculateVariationText(item: MtgProduct): string {
    const initialPrice =
      item.storico && item.storico.length > 0 ? item.storico[0].prezzo : null;
    return calculatePercentageVariation(
      initialPrice,
      item.prezzoAttuale,
      'sell',
    ).text;
  }

  getVariationClass(item: MtgProduct): string {
    const initialPrice =
      item.storico && item.storico.length > 0 ? item.storico[0].prezzo : null;
    return calculatePercentageVariation(
      initialPrice,
      item.prezzoAttuale,
      'sell',
    ).cssClass;
  }

  private renderChartsChunked() {
    if (this.viewMode() !== 'grid') return;
    const batchId = ++this.currentRenderBatch;
    const list = this.products();
    if (!list || list.length === 0) return;

    let index = 0;
    const CHUNK_SIZE = 6;

    const renderNextChunk = () => {
      if (batchId !== this.currentRenderBatch) return;
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
    const canvasId = 'chart-vendita-' + item.id;
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    if (this.chartInstances[item.id]) {
      this.chartInstances[item.id].destroy();
      delete this.chartInstances[item.id];
    }

    const history = item.storico || [];
    if (history.length === 0) return;

    const labels = history.map((h) => h.data);
    const data = history.map((h) => h.prezzo);

    const ctx = canvas.getContext('2d');
    let gradient: CanvasGradient | null = null;
    if (ctx) {
      gradient = createThemeGradient(ctx, '--chart-pink', 0.25, 0.0, 75);
    }

    const datasets: ChartDataset<'line'>[] = [
      {
        label: 'Selected Price',
        data: data,
        borderColor: CHART_THEME.colors.pink,
        borderWidth: 2.5,
        pointRadius: data.length === 1 ? 3 : 0,
        pointHoverRadius: 5,
        fill: true,
        backgroundColor: gradient || getThemeAlphaColor('--chart-pink', 0.1),
        tension: 0.3,
      },
    ];

    this.chartInstances[item.id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            display: true,
            grid: { color: CHART_THEME.colors.grid },
            ticks: {
              color: CHART_THEME.colors.axisTextDim,
              font: { size: CHART_THEME.typography.fontSize },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6,
            },
          },
          y: {
            grid: { color: CHART_THEME.colors.grid },
            ticks: {
              color: CHART_THEME.colors.axisTextDim,
              font: { size: CHART_THEME.typography.fontSize, weight: 'bold' },
              callback: (value) => '€' + Number(value).toFixed(0),
            },
          },
        },
      },
    });
  }

  private renderTotalChart() {
    const canvas = document.getElementById(
      'chart-vendite-totale',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    if (this.totalChartInstance) {
      this.totalChartInstance.destroy();
      this.totalChartInstance = null;
    }

    if (this.products().length === 0) return;

    const dateSet = new Set<string>();
    this.products().forEach((p) => {
      (p.storico || []).forEach((h) => {
        if (h.data) dateSet.add(h.data);
      });
    });

    const sortedDates = Array.from(dateSet).sort(
      (a, b) => parseItalianDate(a).getTime() - parseItalianDate(b).getTime(),
    );

    if (sortedDates.length === 0) return;

    const totalValues = sortedDates.map((date) => {
      let dailySum = 0;
      this.products().forEach((p) => {
        const history = p.storico || [];
        const targetTime = parseItalianDate(date).getTime();

        let matchingPoint = null;
        for (const point of history) {
          const pointTime = parseItalianDate(point.data).getTime();
          if (pointTime <= targetTime) {
            if (
              !matchingPoint ||
              pointTime > parseItalianDate(matchingPoint.data).getTime()
            ) {
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
    let gradient: CanvasGradient | null = null;
    if (ctx) {
      gradient = createThemeGradient(ctx, '--chart-success', 0.25, 0.0, 160);
    }

    this.totalChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: [
          {
            label: 'Total Value',
            data: totalValues,
            borderColor: CHART_THEME.colors.success,
            borderWidth: 3,
            pointRadius: totalValues.length === 1 ? 4 : 0,
            pointHoverRadius: 6,
            fill: true,
            backgroundColor:
              gradient || getThemeAlphaColor('--chart-success', 0.1),
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) =>
                ' Valore Totale: €' + Number(context.raw).toFixed(2),
            },
          },
        },
        scales: {
          x: {
            display: true,
            grid: { color: CHART_THEME.colors.gridBorder },
            ticks: {
              color: CHART_THEME.colors.axisText,
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
            },
          },
          y: {
            grid: { color: CHART_THEME.colors.gridBorder },
            ticks: {
              color: CHART_THEME.colors.success,
              font: { size: 10, weight: 'bold' },
              callback: (value) => '€' + Number(value).toFixed(0),
            },
          },
        },
      },
    });
  }
}

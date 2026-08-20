import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { MarketAdviceSuggestion, InsightSeverity } from '../../../models';

@Component({
  selector: 'app-market-advice-badge',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './market-advice-badge.component.html',
  styleUrls: ['./market-advice-badge.component.scss']
})
export class MarketAdviceBadgeComponent {
  suggestion = input<MarketAdviceSuggestion | null>(null);
  compact = input<boolean>(false);
  showExplanation = input<boolean>(false);

  InsightSeverity = InsightSeverity;

  get badgeClass(): string {
    const sg = this.suggestion();
    if (!sg) return '';
    if (sg.label && sg.label.includes('✨')) {
      const label = sg.label.toUpperCase();
      if (label.includes('COMPRA')) return 'advice-ai-buy';
      if (label.includes('ASPETTA')) return 'advice-ai-wait';
      if (label.includes('SOVRAPPREZZO') || label.includes('NON CONVENIENTE')) return 'advice-ai-avoid';
      return 'advice-ai-custom';
    }
    switch (sg.severity) {
      case InsightSeverity.STRONG_BUY:
        return 'advice-strong-buy';
      case InsightSeverity.BUY:
        return 'advice-buy';
      case InsightSeverity.WAIT:
        return 'advice-wait';
      case InsightSeverity.WARNING:
        return 'advice-warning';
      case InsightSeverity.AVOID:
        return 'advice-avoid';
      default:
        return 'advice-neutral';
    }
  }
}

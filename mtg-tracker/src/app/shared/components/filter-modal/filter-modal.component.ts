import { Component, input, output, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonIcon,
  IonButton,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';
import {
  FilterModalData,
  FilterModalSaveResult,
  FoilFilterType,
  LangFilterType,
  CondFilterType,
  IntentFilterType
} from '../../../models';

@Component({
  selector: 'app-filter-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    IonButton,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption
  ],
  templateUrl: './filter-modal.component.html',
  styleUrls: ['./filter-modal.component.scss']
})
export class FilterModalComponent {
  isOpen = input<boolean>(false);
  product = input<FilterModalData | null>(null);

  foilFilter = model<FoilFilterType>('any');
  langFilter = model<LangFilterType>('any');
  condFilter = model<CondFilterType>('any');
  intentFilter = model<IntentFilterType>('buy');

  closed = output<void>();
  saved = output<FilterModalSaveResult>();

  close() {
    this.closed.emit();
  }

  save() {
    this.saved.emit({
      foil: this.foilFilter(),
      lang: this.langFilter(),
      cond: this.condFilter(),
      intent: this.intentFilter()
    });
  }

  onIntentChange(event: CustomEvent) {
    if (event.detail.value) {
      this.intentFilter.set(event.detail.value as IntentFilterType);
    }
  }

  onFoilChange(event: CustomEvent) {
    if (event.detail.value) {
      this.foilFilter.set(event.detail.value as FoilFilterType);
    }
  }

  onLangChange(event: CustomEvent) {
    if (event.detail.value) {
      this.langFilter.set(event.detail.value as LangFilterType);
    }
  }

  onCondChange(event: CustomEvent) {
    if (event.detail.value) {
      this.condFilter.set(event.detail.value as CondFilterType);
    }
  }
}

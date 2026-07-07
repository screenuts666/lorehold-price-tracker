import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonButton, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, optionsOutline } from 'ionicons/icons';

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
  styleUrls: []
})
export class FilterModalComponent {
  @Input() isOpen = false;
  @Input() product: any = null;
  @Input() foilFilter: 'any' | 'normal' | 'foil' = 'any';
  @Input() langFilter: 'any' | 'it' | 'en' = 'any';
  @Input() condFilter: 'any' | 'Near Mint' = 'any';
  @Input() intentFilter: 'buy' | 'sell' = 'buy';

  @Output() onClose = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<{
    foil: boolean | null;
    lang: string | null;
    cond: string | null;
    intent: 'buy' | 'sell';
  }>();

  constructor() {
    addIcons({ closeOutline, optionsOutline });
  }

  close() {
    this.onClose.emit();
  }

  save() {
    const foilVal = this.foilFilter === 'foil' ? true : this.foilFilter === 'normal' ? false : null;
    const langVal = this.langFilter === 'any' ? null : this.langFilter;
    const condVal = this.condFilter === 'any' ? null : this.condFilter;

    this.onSave.emit({
      foil: foilVal,
      lang: langVal,
      cond: condVal,
      intent: this.intentFilter
    });
  }
}

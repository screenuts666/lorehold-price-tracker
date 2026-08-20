import { Component, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonIcon, IonButton, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, sparklesOutline, image } from 'ionicons/icons';
import { environment } from 'src/environments/environment';
import { FilterModalData, ScryfallCardResult, SearchCardResponse, MapCardTraderResponse } from '../../../models';

@Component({
  selector: 'app-search-section',
  standalone: true,
  imports: [
    CommonModule,
    IonIcon,
    IonButton,
    IonSpinner
  ],
  templateUrl: './search-section.component.html',
  styleUrls: ['./search-section.component.scss']
})
export class SearchSectionComponent {
  cardSelected = output<FilterModalData>();

  searchQuery = signal<string>('');
  searchResults = signal<ScryfallCardResult[]>([]);
  searching = signal<boolean>(false);

  private http = inject(HttpClient);

  constructor() {
    addIcons({ searchOutline, sparklesOutline, image });
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchQuery.set(target.value);
    }
  }

  search() {
    const q = this.searchQuery().trim();
    if (!q) return;
    this.searching.set(true);
    this.http.get<SearchCardResponse>(`${environment.apiBaseUrl}/search-card?q=${encodeURIComponent(q)}`).subscribe({
      next: (res) => {
        this.searchResults.set(res.cards || []);
        this.searching.set(false);
      },
      error: (err) => {
        console.error('Error searching card on Scryfall:', err);
        alert('Connection error with the tracker backend.');
        this.searching.set(false);
      }
    });
  }

  selectPrint(card: ScryfallCardResult) {
    this.searching.set(true);
    this.http.get<MapCardTraderResponse>(`${environment.apiBaseUrl}/map-cardtrader?name=${encodeURIComponent(card.name)}&set_code=${encodeURIComponent(card.set_code)}`).subscribe({
      next: (res) => {
        this.searching.set(false);
        
        // Emit mapped product details back to parent for filter modal configuration
        this.cardSelected.emit({
          id: res.id.toString(),
          name: res.name,
          url: res.url,
          image: res.image || card.image,
          isNew: true
        });
      },
      error: (err) => {
        this.searching.set(false);
        console.error('CardTrader mapping error:', err);
        alert(err.error?.errore || 'This edition/print is not currently mapped or available on CardTrader.');
      }
    });
  }
}

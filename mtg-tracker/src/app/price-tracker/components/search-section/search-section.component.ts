import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonIcon, IonButton, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, sparklesOutline, image } from 'ionicons/icons';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-search-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    IonButton,
    IonSpinner
  ],
  templateUrl: './search-section.component.html',
  styleUrls: []
})
export class SearchSectionComponent {
  @Output() onSelect = new EventEmitter<any>();

  searchQuery: string = '';
  searchResults: any[] = [];
  searching: boolean = false;

  constructor(private http: HttpClient) {
    addIcons({ searchOutline, sparklesOutline, image });
  }

  search() {
    if (!this.searchQuery.trim()) return;
    this.searching = true;
    this.http.get<any>(`${environment.apiBaseUrl}/search-card?q=${encodeURIComponent(this.searchQuery)}`).subscribe({
      next: (res) => {
        this.searchResults = res.cards || [];
        this.searching = false;
      },
      error: (err) => {
        console.error('Error searching card on Scryfall:', err);
        alert('Connection error with the tracker backend.');
        this.searching = false;
      }
    });
  }

  selectPrint(card: any) {
    this.searching = true;
    this.http.get<any>(`${environment.apiBaseUrl}/map-cardtrader?name=${encodeURIComponent(card.name)}&set_code=${encodeURIComponent(card.set_code)}`).subscribe({
      next: (res) => {
        this.searching = false;
        
        // Emit mapped product details back to parent for filter modal configuration
        this.onSelect.emit({
          id: res.id.toString(),
          name: res.name,
          url: res.url,
          image: res.image || card.image,
          isNew: true
        });
      },
      error: (err) => {
        this.searching = false;
        console.error('CardTrader mapping error:', err);
        alert(err.error?.errore || 'This edition/print is not currently mapped or available on CardTrader.');
      }
    });
  }
}


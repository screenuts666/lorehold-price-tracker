import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { refresh, appsOutline, listOutline, cartOutline, cashOutline } from 'ionicons/icons';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';
import { AcquistoSezioneComponent } from './components/acquisto-sezione/acquisto-sezione.component';
import { VenditaSezioneComponent } from './components/vendita-sezione/vendita-sezione.component';

@Component({
  selector: 'app-price-tracker',
  templateUrl: './price-tracker.page.html',
  styleUrls: ['./price-tracker.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    AcquistoSezioneComponent,
    VenditaSezioneComponent
  ],
})
export class PriceTrackerPage implements OnInit {
  sezioneAttiva: 'acquisto' | 'vendita' = 'acquisto';
  prodotti: any[] = [];
  caricamento: boolean = false;
  vista: 'grid' | 'table' = 'grid';
  ordinamento: string = 'recente';
  colonneGrid: number = 4;

  constructor(private http: HttpClient) {
    addIcons({ refresh, appsOutline, listOutline, cartOutline, cashOutline });
  }

  ngOnInit() {
    const savedVista = localStorage.getItem('mtg_tracker_vista');
    if (savedVista === 'grid' || savedVista === 'table') {
      this.vista = savedVista;
    }
    const savedOrdinamento = localStorage.getItem('mtg_tracker_ordinamento');
    if (savedOrdinamento) {
      this.ordinamento = savedOrdinamento;
    }
    const savedSezione = localStorage.getItem('mtg_tracker_sezione');
    if (savedSezione === 'acquisto' || savedSezione === 'vendita') {
      this.sezioneAttiva = savedSezione;
    }
    const savedCols = localStorage.getItem('mtg_tracker_colonne');
    if (savedCols) {
      this.colonneGrid = parseInt(savedCols, 10) || 4;
    }

    const cache = localStorage.getItem('mtg_tracker_data');
    if (cache) {
      this.prodotti = JSON.parse(cache);
      
      let migrato = false;
      this.prodotti.forEach(p => {
        if (!p.intento) {
          p.intento = this.rilevaTipoMtg(p.nome).nomeTipo === 'Generico' ? 'vendi' : 'compra';
          migrato = true;
        }
      });
      if (migrato) this.salvaCache();

      this.aggiornaTuttiIPrezzi(false);
    } else {
      this.http.get('http://localhost:3000/api/backup').subscribe({
        next: (backup: any) => {
          if (Array.isArray(backup) && backup.length > 0) {
            this.prodotti = backup;
            this.prodotti.forEach(p => {
              if (!p.intento) {
                p.intento = this.rilevaTipoMtg(p.nome).nomeTipo === 'Generico' ? 'vendi' : 'compra';
              }
            });
            this.salvaCache();
            console.log('Dati ripristinati con successo dal backup su file!');
          }
          this.aggiornaTuttiIPrezzi(false);
        },
        error: () => {
          this.aggiornaTuttiIPrezzi(false);
        }
      });
    }
  }

  aggiungiProdotto(intento: 'compra' | 'vendi', url: string) {
    if (!url) return;
    const regex = /cards\/(\d+)-(.+)/;
    const match = url.match(regex);

    if (match) {
      const idEstratto = match[1];
      const nomeEstratto = match[2].replace(/-/g, ' ').toUpperCase();

      if (!this.prodotti.find((p) => p.id === idEstratto)) {
        this.prodotti.push({
          id: idEstratto,
          nome: nomeEstratto,
          prezzoAttuale: null,
          storico: [],
          url: url,
          dataInserimento: new Date().toLocaleDateString(),
          intento: intento
        });

        this.salvaCache();
        this.aggiornaTuttiIPrezzi(true);
      } else {
        alert('Prodotto già in lista!');
      }
    } else {
      alert('URL non valido. Assicurati di incollare il link corretto di CardTrader.');
    }
  }

  aggiornaTuttiIPrezzi(force: boolean = false) {
    if (this.prodotti.length === 0) {
      this.caricamento = false;
      return;
    }

    const COOLDOWN_MS = 12 * 60 * 60 * 1000;
    const adesso = Date.now();

    const prodottiDaAggiornare = force
      ? this.prodotti
      : this.prodotti.filter(prodotto => {
          if (!prodotto.prezzoAttuale || !prodotto.storico || prodotto.storico.length === 0) {
            return true;
          }
          const ultimoPunto = prodotto.storico[prodotto.storico.length - 1];
          const ultimoTimestamp = ultimoPunto.timestamp || new Date(ultimoPunto.data).getTime();
          return (adesso - ultimoTimestamp) > COOLDOWN_MS;
        });

    if (prodottiDaAggiornare.length === 0) {
      console.log('Tutti i prezzi sono aggiornati (cooldown di 12 ore attivo).');
      this.caricamento = false;
      this.prodotti = [...this.prodotti];
      return;
    }

    this.caricamento = true;

    const chiamate = prodottiDaAggiornare.map((prodotto) => {
      return new Promise<void>((resolve) => {
        this.http
          .get(`http://localhost:3000/api/prezzo/${prodotto.id}`)
          .subscribe({
            next: (res: any) => {
              if (res.prezzo) {
                prodotto.prezzoAttuale = res.prezzo;
                if (!prodotto.storico) {
                  prodotto.storico = [];
                }
                prodotto.storico.push({
                  data: new Date().toLocaleDateString(),
                  timestamp: adesso,
                  prezzo: res.prezzo,
                });
              }
              if (res.immagine) {
                prodotto.immagine = res.immagine;
              }
              if (res.nome) {
                prodotto.nome = res.nome;
              }
              resolve();
            },
            error: () => resolve(),
          });
      });
    });

    Promise.all(chiamate).then(() => {
      this.prodotti = [...this.prodotti];
      this.salvaCache();
      this.caricamento = false;
    });
  }

  rimuoviProdotto(id: string) {
    this.prodotti = this.prodotti.filter((p) => p.id !== id);
    this.salvaCache();
  }

  salvaCache() {
    localStorage.setItem('mtg_tracker_data', JSON.stringify(this.prodotti));
    this.http.post('http://localhost:3000/api/backup', this.prodotti).subscribe({
      next: () => console.log('Backup sincrono su file completato.'),
      error: (err) => console.error('Errore durante la scrittura del backup su file:', err)
    });
  }

  rilevaTipoMtg(nome: string): { nomeTipo: string; standard: number; ottimo: number; caro: number } {
    const n = (nome || '').toLowerCase();
    if (n.includes('play booster box') || n.includes('play box')) {
      return { nomeTipo: 'Play Box', standard: 135, ottimo: 120, caro: 150 };
    }
    if (n.includes('collector booster box') || n.includes('collector box')) {
      return { nomeTipo: 'Collector Box', standard: 220, ottimo: 195, caro: 245 };
    }
    if (n.includes('prerelease pack') || n.includes('prerelease')) {
      return { nomeTipo: 'Prerelease Pack', standard: 30, ottimo: 25, caro: 35 };
    }
    if (n.includes('fat pack') || n.includes('bundle') || n.includes('gift edition')) {
      return { nomeTipo: 'Bundle', standard: 42, ottimo: 35, caro: 50 };
    }
    if (n.includes('commander') && n.includes('deck')) {
      return { nomeTipo: 'Commander Deck', standard: 45, ottimo: 38, caro: 55 };
    }
    if (n.includes('draft night')) {
      return { nomeTipo: 'Draft Night Kit', standard: 90, ottimo: 80, caro: 110 };
    }
    if (n.includes('collector booster') || n.includes('booster pack') || n.includes('pack')) {
      return { nomeTipo: 'Single Pack', standard: 5, ottimo: 4, caro: 6.5 };
    }
    return { nomeTipo: 'Generico', standard: 0, ottimo: 0, caro: 999999 };
  }

  calcolaVariazioneValore(item: any): number {
    if (!item.storico || item.storico.length < 2) return 0;
    const iniz = item.storico[0].prezzo;
    const att = item.prezzoAttuale;
    if (!iniz || !att) return 0;
    return ((att - iniz) / iniz) * 100;
  }

  get prodottiOrdinati(): any[] {
    const lista = [...this.prodotti];
    switch (this.ordinamento) {
      case 'nome':
        return lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      case 'prezzo-crescente':
        return lista.sort((a, b) => (a.prezzoAttuale || 0) - (b.prezzoAttuale || 0));
      case 'prezzo-decrescente':
        return lista.sort((a, b) => (b.prezzoAttuale || 0) - (a.prezzoAttuale || 0));
      case 'variazione-peggiore':
        return lista.sort((a, b) => this.calcolaVariazioneValore(b) - this.calcolaVariazioneValore(a));
      case 'variazione-migliore':
        return lista.sort((a, b) => this.calcolaVariazioneValore(a) - this.calcolaVariazioneValore(b));
      case 'recente':
      default:
        return lista.reverse();
    }
  }

  get prodottiAcquisto(): any[] {
    return this.prodottiOrdinati.filter(p => p.intento === 'compra');
  }

  get prodottiVendita(): any[] {
    return this.prodottiOrdinati.filter(p => p.intento === 'vendi');
  }

  onVistaChange() {
    localStorage.setItem('mtg_tracker_vista', this.vista);
  }

  onOrdinamentoChange() {
    localStorage.setItem('mtg_tracker_ordinamento', this.ordinamento);
  }

  onSezioneChange() {
    localStorage.setItem('mtg_tracker_sezione', this.sezioneAttiva);
  }

  onColonneGridChange() {
    localStorage.setItem('mtg_tracker_colonne', this.colonneGrid.toString());
    this.prodotti = [...this.prodotti]; // Aggiorna referenza per innescare OnChanges nei figli
  }
}

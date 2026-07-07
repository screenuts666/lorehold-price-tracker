import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Serve per [(ngModel)]
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { refresh, trash, image, openOutline, appsOutline, listOutline, analyticsOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline } from 'ionicons/icons';
import { Chart } from 'chart.js/auto';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonInput,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonCardHeader,
  IonCardTitle,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';

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
    IonCard,
    IonCardContent,
    IonItem,
    IonInput,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonCardHeader,
    IonCardTitle,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption
  ],
})
export class PriceTrackerPage implements OnInit, OnDestroy {
  nuovoUrl: string = '';
  prodotti: any[] = [];
  caricamento: boolean = false;
  vista: 'grid' | 'table' = 'grid';
  ordinamento: string = 'recente';
  
  // Per tracciare i grafici ed evitarne la sovrapposizione
  private chartInstances: { [key: string]: Chart } = {};

  constructor(private http: HttpClient) {
    addIcons({ 
      refresh, trash, image, openOutline, appsOutline, listOutline,
      analyticsOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline 
    });
  }

  ngOnInit() {
    // All'avvio, recupera i dati cached dal localStorage
    const cache = localStorage.getItem('mtg_tracker_data');
    if (cache) {
      this.prodotti = JSON.parse(cache);
      // Avvia l'aggiornamento automatico (cooldown attivo)
      this.aggiornaTuttiIPrezzi(false);
    } else {
      // Se il localStorage è vuoto, tenta il ripristino dal backup su file del backend
      this.http.get('http://localhost:3000/api/backup').subscribe({
        next: (backup: any) => {
          if (Array.isArray(backup) && backup.length > 0) {
            this.prodotti = backup;
            localStorage.setItem('mtg_tracker_data', JSON.stringify(this.prodotti));
            console.log('Dati ripristinati con successo dal backup su file!');
          }
          // Avvia l'aggiornamento automatico (cooldown attivo)
          this.aggiornaTuttiIPrezzi(false);
        },
        error: () => {
          this.aggiornaTuttiIPrezzi(false);
        }
      });
    }
  }

  ngOnDestroy() {
    // Distrugge tutte le istanze dei grafici all'uscita per evitare memory leak
    Object.values(this.chartInstances).forEach(chart => chart.destroy());
    this.chartInstances = {};
  }

  aggiungiDaUrl() {
    if (!this.nuovoUrl) return;

    // Estrapola l'ID e il nome dall'URL usando una Regex
    // Esempio URL: .../cards/123456-reality-fracture-play-booster-box
    const regex = /cards\/(\d+)-(.+)/;
    const match = this.nuovoUrl.match(regex);

    if (match) {
      const idEstratto = match[1];
      // Pulisce il nome rimuovendo i trattini
      const nomeEstratto = match[2].replace(/-/g, ' ').toUpperCase();

      // Evita duplicati
      if (!this.prodotti.find((p) => p.id === idEstratto)) {
        this.prodotti.push({
          id: idEstratto,
          nome: nomeEstratto,
          prezzoAttuale: null,
          storico: [], // Prepariamo l'array per lo storico futuro!
          url: this.nuovoUrl, // Salva il link intero (nascosto)
          dataInserimento: new Date().toLocaleDateString() // Data di inserimento
        });

        this.salvaCache();
        this.nuovoUrl = ''; // Svuota la barra
        this.aggiornaTuttiIPrezzi(true); // Aggiorna subito il nuovo prodotto forzando la chiamata
      } else {
        alert('Prodotto già in lista!');
      }
    } else {
      alert(
        'URL non valido. Assicurati di incollare il link corretto di CardTrader.',
      );
    }
  }

  aggiornaTuttiIPrezzi(force: boolean = false) {
    if (this.prodotti.length === 0) {
      this.caricamento = false;
      return;
    }

    const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 ore
    const adesso = Date.now();

    // Filtriamo i prodotti che hanno bisogno di essere aggiornati
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
      // Inizializziamo i grafici con i dati già presenti in cache
      setTimeout(() => this.renderizzaGrafici(), 100);
      return;
    }

    this.caricamento = true;

    // Usiamo le Promise per aspettare che tutte le chiamate finiscano
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

                // Aggiungiamo un nuovo rilevamento con data e timestamp
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
            error: () => resolve(), // Ignora gli errori per non bloccare gli altri
          });
      });
    });

    Promise.all(chiamate).then(() => {
      this.salvaCache(); // Salva i nuovi prezzi nel localStorage
      this.caricamento = false;
      // Aspettiamo che Angular renderizzi il canvas e poi disegniamo
      setTimeout(() => this.renderizzaGrafici(), 100);
    });
  }

  rimuoviProdotto(id: string) {
    if (this.chartInstances[id]) {
      this.chartInstances[id].destroy();
      delete this.chartInstances[id];
    }
    this.prodotti = this.prodotti.filter((p) => p.id !== id);
    this.salvaCache();
  }

  salvaCache() {
    localStorage.setItem('mtg_tracker_data', JSON.stringify(this.prodotti));
    
    // Invia i dati al backend per salvarli su file (backup)
    this.http.post('http://localhost:3000/api/backup', this.prodotti).subscribe({
      next: () => console.log('Backup sincrono su file completato.'),
      error: (err) => console.error('Errore durante la scrittura del backup su file:', err)
    });
  }

  ottieniSuggerimento(item: any): { stato: string; colore: string; spiegazione: string; icona: string } {
    if (!item.storico || item.storico.length < 2) {
      return { 
        stato: 'ANALISI', 
        colore: '#64748b', 
        spiegazione: 'Rilevamento in corso. Servono almeno 2 punti prezzo per analizzare il trend.',
        icona: 'analytics-outline'
      };
    }

    const prezzi = item.storico.map((p: any) => p.prezzo);
    const prezzoAttuale = item.prezzoAttuale || prezzi[prezzi.length - 1];
    const min = Math.min(...prezzi);
    const max = Math.max(...prezzi);
    const media = prezzi.reduce((a: number, b: number) => a + b, 0) / prezzi.length;
    
    // 1. Vicino al minimo storico (entro il 2%)
    if (prezzoAttuale <= min * 1.02) {
      const risparmio = max > prezzoAttuale ? (((max - prezzoAttuale) / max) * 100).toFixed(0) : '0';
      return {
        stato: 'COMPRA ORA',
        colore: '#10b981', // Verde smeraldo neon
        spiegazione: `Minimo storico! Risparmi il ${risparmio}% rispetto al picco massimo (€${max.toFixed(2)}).`,
        icona: 'trending-down-outline'
      };
    }
    
    // 2. Sotto la media
    if (prezzoAttuale < media) {
      const scontoMedia = (((media - prezzoAttuale) / media) * 100).toFixed(0);
      return {
        stato: 'BUON PREZZO',
        colore: '#34d399', // Verde chiaro
        spiegazione: `Prezzo inferiore del ${scontoMedia}% rispetto alla media storica (€${media.toFixed(2)}).`,
        icona: 'checkmark-circle-outline'
      };
    }
    
    // 3. Vicino al massimo storico (entro il 5%)
    if (prezzoAttuale >= max * 0.95) {
      const rincaro = min > 0 ? (((prezzoAttuale - min) / min) * 100).toFixed(0) : '0';
      return {
        stato: 'EVITA',
        colore: '#ef4444', // Rosso neon
        spiegazione: `Vicino al massimo storico! È aumentato del ${rincaro}% rispetto al minimo registrato (€${min.toFixed(2)}).`,
        icona: 'alert-circle-outline'
      };
    }
    
    // 4. Sopra la media ma non al picco (Attendi calo)
    const eccessoMedia = (((prezzoAttuale - media) / media) * 100).toFixed(0);
    return {
      stato: 'ATTENDI',
      colore: '#f59e0b', // Arancione / Giallo
      spiegazione: `Prezzo superiore del ${eccessoMedia}% rispetto alla media (€${media.toFixed(2)}). Attendi un ribasso.`,
      icona: 'time-outline'
    };
  }

  calcolaVariazioneTesto(item: any): string {
    if (!item.storico || item.storico.length < 2) return '';
    const iniz = item.storico[0].prezzo;
    const att = item.prezzoAttuale;
    if (!iniz || !att) return '';
    const diff = att - iniz;
    const pct = (diff / iniz) * 100;
    const segno = diff >= 0 ? '+' : '';
    return `${segno}${pct.toFixed(1)}%`;
  }

  calcolaVariazioneColor(item: any): string {
    if (!item.storico || item.storico.length < 2) return '#94a3b8';
    const iniz = item.storico[0].prezzo;
    const att = item.prezzoAttuale;
    if (!iniz || !att) return '#94a3b8';
    // Per chi compra, un calo di prezzo è positivo (verde), un aumento è negativo (rosso)
    return att < item.storico[0].prezzo ? '#10b981' : '#ef4444';
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
      case 'variazione-migliore':
        return lista.sort((a, b) => this.calcolaVariazioneValore(a) - this.calcolaVariazioneValore(b));
      case 'variazione-peggiore':
        return lista.sort((a, b) => this.calcolaVariazioneValore(b) - this.calcolaVariazioneValore(a));
      case 'recente':
      default:
        return lista.reverse();
    }
  }

  onVistaChange() {
    if (this.vista === 'grid') {
      setTimeout(() => this.renderizzaGrafici(), 150);
    }
  }

  onOrdinamentoChange() {
    setTimeout(() => this.renderizzaGrafici(), 150);
  }

  renderizzaGrafici() {
    this.prodotti.forEach((prodotto) => {
      const canvasId = `chart-${prodotto.id}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

      if (!canvas) {
        return;
      }

      // Distruggi il grafico esistente se presente
      if (this.chartInstances[prodotto.id]) {
        this.chartInstances[prodotto.id].destroy();
      }

      const storico = prodotto.storico || [];
      const labels = storico.map((p: any) => p.data);
      const data = storico.map((p: any) => p.prezzo);

      const ctx = canvas.getContext('2d');
      let gradient = null;
      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 100);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
      }

      this.chartInstances[prodotto.id] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Prezzo (€)',
              data: data,
              borderColor: '#8b5cf6',
              borderWidth: 2.5,
              pointBackgroundColor: '#a78bfa',
              pointBorderColor: '#0b0f19',
              pointBorderWidth: 1.5,
              pointRadius: labels.length === 1 ? 5 : 2,
              pointHoverRadius: 6,
              fill: true,
              backgroundColor: gradient || 'rgba(139, 92, 246, 0.1)',
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: '#1e293b',
              titleColor: '#94a3b8',
              bodyColor: '#f8fafc',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              borderWidth: 1,
              displayColors: false,
              callbacks: {
                label: (context) => `€${Number(context.raw).toFixed(2)}`,
              },
            },
          },
          scales: {
            x: {
              display: false,
            },
            y: {
              grid: {
                color: 'rgba(255, 255, 255, 0.04)',
              },
              ticks: {
                color: '#64748b',
                font: {
                  size: 9,
                },
                callback: (value) => `€${Number(value).toFixed(2)}`,
              },
            },
          },
        },
      });
    });
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Serve per [(ngModel)]
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { refresh, trash, image, openOutline, appsOutline, listOutline, analyticsOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline, archiveOutline, cardOutline, cartOutline, cashOutline } from 'ionicons/icons';
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
  urlAcquisto: string = '';
  urlVendita: string = '';
  sezioneAttiva: 'acquisto' | 'vendita' = 'acquisto';
  prodotti: any[] = [];
  caricamento: boolean = false;
  vista: 'grid' | 'table' = 'grid';
  ordinamento: string = 'recente';
  
  // Per tracciare i grafici ed evitarne la sovrapposizione
  private chartInstances: { [key: string]: Chart } = {};

  constructor(private http: HttpClient) {
    addIcons({ 
      refresh, trash, image, openOutline, appsOutline, listOutline,
      analyticsOutline, trendingDownOutline, checkmarkCircleOutline, alertCircleOutline, timeOutline,
      archiveOutline, cardOutline, cartOutline, cashOutline
    });
  }

  ngOnInit() {
    // Recupera le preferenze salvate dell'utente
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

    // All'avvio, recupera i dati cached dal localStorage
    const cache = localStorage.getItem('mtg_tracker_data');
    if (cache) {
      this.prodotti = JSON.parse(cache);
      
      // Esegui la migrazione per i prodotti inseriti in precedenza
      let migrato = false;
      this.prodotti.forEach(p => {
        if (!p.intento) {
          // I sigillati (non Generici) vanno in acquisto, i singoli (Generici) in vendita
          p.intento = this.rilevaTipoMtg(p.nome).nomeTipo === 'Generico' ? 'vendi' : 'compra';
          migrato = true;
        }
      });
      if (migrato) this.salvaCache();

      // Avvia l'aggiornamento automatico (cooldown attivo)
      this.aggiornaTuttiIPrezzi(false);
    } else {
      // Se il localStorage è vuoto, tenta il ripristino dal backup su file del backend
      this.http.get('http://localhost:3000/api/backup').subscribe({
        next: (backup: any) => {
          if (Array.isArray(backup) && backup.length > 0) {
            this.prodotti = backup;
            
            // Esegui la migrazione per i prodotti inseriti in precedenza
            this.prodotti.forEach(p => {
              if (!p.intento) {
                p.intento = this.rilevaTipoMtg(p.nome).nomeTipo === 'Generico' ? 'vendi' : 'compra';
              }
            });
            this.salvaCache();
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

  aggiungiProdotto(intento: 'compra' | 'vendi') {
    const url = intento === 'compra' ? this.urlAcquisto : this.urlVendita;
    if (!url) return;

    // Estrapola l'ID e il nome dall'URL usando una Regex
    const regex = /cards\/(\d+)-(.+)/;
    const match = url.match(regex);

    if (match) {
      const idEstratto = match[1];
      const nomeEstratto = match[2].replace(/-/g, ' ').toUpperCase();

      // Evita duplicati
      if (!this.prodotti.find((p) => p.id === idEstratto)) {
        this.prodotti.push({
          id: idEstratto,
          nome: nomeEstratto,
          prezzoAttuale: null,
          storico: [], // Prepariamo l'array per lo storico futuro!
          url: url, // Salva il link intero (nascosto)
          dataInserimento: new Date().toLocaleDateString(), // Data di inserimento
          intento: intento // Associa l'intento di acquisto o vendita
        });

        this.salvaCache();
        if (intento === 'compra') {
          this.urlAcquisto = '';
        } else {
          this.urlVendita = '';
        }
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

  rilevaTipoMtg(nome: string): { nomeTipo: string; standard: number; ottimo: number; caro: number } {
    const n = (nome || '').toLowerCase();
    
    // Escludiamo Secret Lair dalle regole standard perché hanno prezzi non standardizzati
    if (n.includes('secret lair')) {
      return { nomeTipo: 'Secret Lair', standard: 0, ottimo: 0, caro: 999999 };
    }
    
    if (n.includes('collector') && (n.includes('box') || n.includes('display'))) {
      return { nomeTipo: 'Collector Box', standard: 220, ottimo: 190, caro: 250 };
    }
    if (n.includes('play booster box') || n.includes('draft booster box') || n.includes('set booster box') || n.includes('booster box') || n.includes('display') || n.includes('booster display')) {
      return { nomeTipo: 'Booster Box', standard: 120, ottimo: 105, caro: 135 };
    }
    if (n.includes('prerelease') || n.includes('pre-release')) {
      return { nomeTipo: 'Prerelease Pack', standard: 35, ottimo: 28, caro: 42 };
    }
    if (n.includes('bundle') || n.includes('fat pack') || n.includes('gift edition')) {
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

  ottieniSuggerimento(item: any): { stato: string; colore: string; spiegazione: string; icona: string } {
    const tipo = this.rilevaTipoMtg(item.nome);
    const prezzi = item.storico ? item.storico.map((p: any) => p.prezzo) : [];
    const prezzoAttuale = item.prezzoAttuale || (prezzi.length > 0 ? prezzi[prezzi.length - 1] : null);

    if (!prezzoAttuale) {
      return { 
        stato: 'ANALISI', 
        colore: '#64748b', 
        spiegazione: 'Rilevamento in corso. Nessun prezzo attuale disponibile.',
        icona: 'analytics-outline'
      };
    }

    const min = prezzi.length > 0 ? Math.min(...prezzi) : prezzoAttuale;
    const max = prezzi.length > 0 ? Math.max(...prezzi) : prezzoAttuale;
    const media = prezzi.length > 0 ? prezzi.reduce((a: number, b: number) => a + b, 0) / prezzi.length : prezzoAttuale;

    // --- ALGORITMO DI VENDITA BASATO SUL TIPO DI PRODOTTO MTG ---
    if (tipo.standard > 0) {
      // Se il prezzo è molto alto rispetto al mercato standard -> Ottimo momento per vendere
      if (prezzoAttuale >= tipo.caro) {
        const rincaroMercato = (((prezzoAttuale - tipo.standard) / tipo.standard) * 100).toFixed(0);
        return {
          stato: '🔥 VENDI ORA',
          colore: '#10b981', // Verde smeraldo neon
          spiegazione: `Valore eccellente per un ${tipo.nomeTipo}! Costa il ${rincaroMercato}% in più rispetto al prezzo standard di lancio (€${tipo.standard}). Massimizza il profitto!`,
          icona: 'trending-up-outline'
        };
      }
      // Se il prezzo è molto basso rispetto al mercato standard -> Evita di vendere ora, aspetta
      if (prezzoAttuale <= tipo.ottimo) {
        const risparmioMercato = (((tipo.standard - prezzoAttuale) / tipo.standard) * 100).toFixed(0);
        return {
          stato: '🔴 TIENI (HOLD)',
          colore: '#ef4444', // Rosso neon
          spiegazione: `Prezzo estremamente basso rispetto al valore standard di mercato (€${tipo.standard}). Evita di svendere adesso!`,
          icona: 'alert-circle-outline'
        };
      }
    }

    // --- ALGORITMO DI VENDITA BASATO SULLO STORICO DEI PREZZI ---
    if (prezzi.length < 2) {
      return { 
        stato: 'IN CODA', 
        colore: '#3b82f6', // Blu
        spiegazione: `Prodotto ${tipo.nomeTipo !== 'Generico' ? tipo.nomeTipo : 'monitorato'}. In attesa di accumulare storico dei prezzi.`,
        icona: 'analytics-outline'
      };
    }

    // Se siamo vicino al massimo storico (entro il 5%) -> VENDI ORA
    if (prezzoAttuale >= max * 0.95) {
      const incremento = min > 0 ? (((prezzoAttuale - min) / min) * 100).toFixed(0) : '0';
      return {
        stato: 'VENDI ORA',
        colore: '#10b981', // Verde smeraldo neon
        spiegazione: `Picco massimo storico locale! Valore aumentato del ${incremento}% rispetto al minimo (€${min.toFixed(2)}).`,
        icona: 'trending-down-outline'
      };
    }
    
    // Se siamo sopra la media -> BUON PREZZO (Vendita vantaggiosa)
    if (prezzoAttuale > media) {
      const guadagnoMedia = (((prezzoAttuale - media) / media) * 100).toFixed(0);
      return {
        stato: 'BUON PREZZO',
        colore: '#34d399', // Verde chiaro
        spiegazione: `Valore superiore del ${guadagnoMedia}% rispetto alla media dello storico (€${media.toFixed(2)}). Buon momento per vendere.`,
        icona: 'checkmark-circle-outline'
      };
    }
    
    // Se siamo vicino al minimo storico (entro il 2%) -> EVITA VENDITA (TIENI)
    if (prezzoAttuale <= min * 1.02) {
      const perditaPicco = max > prezzoAttuale ? (((max - prezzoAttuale) / max) * 100).toFixed(0) : '0';
      return {
        stato: 'TIENI (HOLD)',
        colore: '#ef4444', // Rosso neon
        spiegazione: `Minimo storico registrato! Valore sceso del ${perditaPicco}% rispetto al picco massimo (€${max.toFixed(2)}). Evita di vendere ora.`,
        icona: 'alert-circle-outline'
      };
    }
    
    // Se siamo sotto la media -> ATTENDI RIALZO
    const deficitMedia = (((media - prezzoAttuale) / media) * 100).toFixed(0);
    return {
      stato: 'ATTENDI RIALZO',
      colore: '#f59e0b', // Arancione
      spiegazione: `Valore inferiore del ${deficitMedia}% rispetto alla media dello storico (€${media.toFixed(2)}). Attendi che si rialzi.`,
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
    // Per chi vende, un incremento di valore è positivo (verde), un calo è negativo (rosso)
    return att >= iniz ? '#10b981' : '#ef4444';
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

  get prodottiAcquisto(): any[] {
    return this.prodottiOrdinati.filter(p => p.intento === 'compra');
  }

  get prodottiVendita(): any[] {
    return this.prodottiOrdinati.filter(p => p.intento === 'vendi');
  }

  onVistaChange() {
    localStorage.setItem('mtg_tracker_vista', this.vista);
    if (this.vista === 'grid') {
      setTimeout(() => this.renderizzaGrafici(), 150);
    }
  }

  onOrdinamentoChange() {
    localStorage.setItem('mtg_tracker_ordinamento', this.ordinamento);
    setTimeout(() => this.renderizzaGrafici(), 150);
  }

  onSezioneChange() {
    localStorage.setItem('mtg_tracker_sezione', this.sezioneAttiva);
    if (this.vista === 'grid') {
      setTimeout(() => this.renderizzaGrafici(), 150);
    }
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

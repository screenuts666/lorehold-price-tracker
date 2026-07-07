const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

require("dotenv").config();

// --- CONFIGURAZIONE ---
const API_TOKEN = process.env.CARDTRADER_API_TOKEN;

// --- LA ROTTA API ---
app.get("/api/prezzo/:id", async (req, res) => {
  const idProdotto = req.params.id;
  console.log(
    `[${new Date().toLocaleTimeString()}] Cerco nel marketplace l'ID: ${idProdotto}`,
  );

  try {
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    };

    // Chiamate in parallelo per recuperare sia i dettagli del Blueprint (nome, immagine) sia i prezzi
    const [blueprintResponse, response] = await Promise.all([
      fetch(`https://api.cardtrader.com/api/v2/blueprints/${idProdotto}`, { headers }).catch(err => {
        console.error("Errore recupero blueprint:", err.message);
        return null;
      }),
      fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${idProdotto}`, { headers }).catch(err => {
        console.error("Errore recupero offerte:", err.message);
        return null;
      })
    ]);

    let nomeBlueprint = null;
    let immagineUrl = null;

    if (blueprintResponse && blueprintResponse.ok) {
      try {
        const bpData = await blueprintResponse.json();
        nomeBlueprint = bpData.name || bpData.translated_name;
        if (bpData.image) {
          const imgPath = bpData.image.preview?.url || bpData.image.url;
          if (imgPath) {
            immagineUrl = imgPath.startsWith("http") ? imgPath : `https://api.cardtrader.com${imgPath}`;
          }
        }
      } catch (e) {
        console.error("Errore parsing blueprint:", e.message);
      }
    }

    let prezzoPiuBasso = null;

    if (response && response.ok) {
      const data = await response.json();

      let arrayOfferte = [];
      if (Array.isArray(data)) {
        arrayOfferte = data;
      } else if (data && typeof data === "object") {
        const chiavi = Object.keys(data);
        if (chiavi.length > 0 && Array.isArray(data[chiavi[0]])) {
          arrayOfferte = data[chiavi[0]];
        } else {
          arrayOfferte = Object.values(data);
        }
      }

      const offerteValide = arrayOfferte.filter(
        (item) => item && (item.price || item.price_cents),
      );

      if (offerteValide.length > 0) {
        const offerteCoordinate = offerteValide.sort((a, b) => {
          const valA = a.price ? a.price.cents : a.price_cents;
          const valB = b.price ? b.price.cents : b.price_cents;
          return valA - valB;
        });

        const min = offerteCoordinate[0];
        prezzoPiuBasso = (min.price ? min.price.cents : min.price_cents) / 100;
        console.log(`✅ Trovato prezzo per ID ${idProdotto}: €${prezzoPiuBasso}`);
      } else {
        console.log(`⚠️ Nessuna copia in vendita trovata per ID ${idProdotto}`);
      }
    } else if (response) {
      console.error(`❌ Errore API HTTP ${response.status} sui prezzi`);
    }

    return res.json({
      prezzo: prezzoPiuBasso,
      immagine: immagineUrl,
      nome: nomeBlueprint
    });
  } catch (error) {
    console.error(`Errore di rete su ID ${idProdotto}:`, error);
    return res.status(500).json({ errore: "Errore API" });
  }
});

// --- ROTTE BACKUP SU FILE ---
const BACKUP_FILE = path.join(__dirname, "data_backup.json");

// Riceve i dati dal frontend e li scrive nel file locale
app.post("/api/backup", (req, res) => {
  try {
    const dati = req.body;
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(dati, null, 2), "utf8");
    console.log(`[${new Date().toLocaleTimeString()}] Backup salvato su file correttamente.`);
    return res.json({ successo: true });
  } catch (err) {
    console.error("Errore durante il salvataggio del backup:", err);
    return res.status(500).json({ errore: "Errore salvataggio backup" });
  }
});

// Legge i dati dal file locale e li rispedisce al frontend
app.get("/api/backup", (req, res) => {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const datiRaw = fs.readFileSync(BACKUP_FILE, "utf8");
      const dati = JSON.parse(datiRaw);
      console.log(`[${new Date().toLocaleTimeString()}] Backup caricato da file correttamente.`);
      return res.json(dati);
    }
    return res.json([]);
  } catch (err) {
    console.error("Errore durante la lettura del backup:", err);
    return res.status(500).json({ errore: "Errore lettura backup" });
  }
});

// --- BACKGROUND SCHEDULER (AGGIORNAMENTO AUTOMATICO OGNI 6 ORE) ---
async function eseguiAggiornamentoAutomatico() {
  if (!fs.existsSync(BACKUP_FILE)) return;
  
  console.log(`[Background] [${new Date().toLocaleTimeString()}] Avvio controllo periodico dei prezzi...`);
  
  try {
    const datiRaw = fs.readFileSync(BACKUP_FILE, "utf8");
    const prodotti = JSON.parse(datiRaw);
    
    if (!Array.isArray(prodotti) || prodotti.length === 0) return;
    
    const COOLDOWN_MS = 6 * 60 * 60 * 1000; // Cooldown di 6 ore per i controlli in background
    const adesso = Date.now();
    let modificato = false;
    
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    };
    
    for (const prodotto of prodotti) {
      const ultimoPunto = prodotto.storico && prodotto.storico.length > 0 
        ? prodotto.storico[prodotto.storico.length - 1] 
        : null;
      const ultimoTimestamp = ultimoPunto ? (ultimoPunto.timestamp || new Date(ultimoPunto.data).getTime()) : 0;
      
      // Se sono passate più di 6 ore dall'ultimo aggiornamento
      if ((adesso - ultimoTimestamp) > COOLDOWN_MS) {
        console.log(`[Background] Aggiorno prezzo per ID: ${prodotto.id} (${prodotto.nome || 'Sconosciuto'})`);
        
        try {
          // Eseguiamo le chiamate in parallelo per la carta specifica
          const [blueprintResponse, response] = await Promise.all([
            fetch(`https://api.cardtrader.com/api/v2/blueprints/${prodotto.id}`, { headers }).catch(() => null),
            fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${prodotto.id}`, { headers }).catch(() => null)
          ]);
          
          if (blueprintResponse && blueprintResponse.ok) {
            const bpData = await blueprintResponse.json();
            prodotto.nome = bpData.name || bpData.translated_name;
            if (bpData.image) {
              const imgPath = bpData.image.preview?.url || bpData.image.url;
              if (imgPath) {
                prodotto.immagine = imgPath.startsWith("http") ? imgPath : `https://api.cardtrader.com${imgPath}`;
              }
            }
          }
          
          if (response && response.ok) {
            const data = await response.json();
            let arrayOfferte = [];
            if (Array.isArray(data)) {
              arrayOfferte = data;
            } else if (data && typeof data === "object") {
              const chiavi = Object.keys(data);
              if (chiavi.length > 0 && Array.isArray(data[chiavi[0]])) {
                arrayOfferte = data[chiavi[0]];
              } else {
                arrayOfferte = Object.values(data);
              }
            }
            
            const offerteValide = arrayOfferte.filter(item => item && (item.price || item.price_cents));
            
            if (offerteValide.length > 0) {
              offerteValide.sort((a, b) => {
                const valA = a.price ? a.price.cents : a.price_cents;
                const valB = b.price ? b.price.cents : b.price_cents;
                return valA - valB;
              });
              
              const min = offerteValide[0];
              const prezzoPiuBasso = (min.price ? min.price.cents : min.price_cents) / 100;
              
              prodotto.prezzoAttuale = prezzoPiuBasso;
              if (!prodotto.storico) {
                prodotto.storico = [];
              }
              
              prodotto.storico.push({
                data: new Date().toLocaleDateString(),
                timestamp: adesso,
                prezzo: prezzoPiuBasso
              });
              modificato = true;
              console.log(`[Background] ✅ Aggiornato ID ${prodotto.id} -> €${prezzoPiuBasso}`);
            }
          }
          
          // Aspettiamo 1.5 secondi tra una carta e l'altra per rispettare i rate limit dell'API
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (err) {
          console.error(`[Background] Errore aggiornamento carta ID ${prodotto.id}:`, err.message);
        }
      }
    }
    
    if (modificato) {
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(prodotti, null, 2), "utf8");
      console.log(`[Background] Backup su file aggiornato con i nuovi rilevamenti.`);
    }
  } catch (err) {
    console.error("[Background] Errore durante il ciclo di aggiornamento:", err.message);
  }
}

// Avvia il ciclo di controllo in background (controlla ogni 30 minuti)
setInterval(eseguiAggiornamentoAutomatico, 30 * 60 * 1000);
// Avvia anche un controllo iniziale ritardato di 15 secondi all'avvio del server
setTimeout(eseguiAggiornamentoAutomatico, 15000);

// --- AVVIO DEL SERVER ---
app.listen(3000, () => {
  console.log("🚀 Tracker in ascolto sulla porta 3000!");
});

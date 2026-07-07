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

let expansionsCache = null;

// --- LE ROTTE API ---

// 1. Ricerca carta su Scryfall
app.get("/api/search-card", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ errore: "Query query string (q) mancante" });
  
  try {
    const scryfallRes = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "MTGPriceTracker/1.0",
          "Accept": "application/json"
        }
      }
    );
    if (!scryfallRes.ok) {
      return res.json({ cards: [] });
    }
    const scryfallData = await scryfallRes.json();
    
    if (!scryfallData || !scryfallData.data || !Array.isArray(scryfallData.data)) {
      return res.json({ cards: [] });
    }
    
    const cards = scryfallData.data.map(card => ({
      name: card.name,
      printed_name: card.printed_name || card.name,
      set_code: card.set,
      set_name: card.set_name,
      image: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null,
      scryfall_id: card.id,
      collector_number: card.collector_number,
      lang: card.lang
    }));
    
    return res.json({ cards });
  } catch (error) {
    console.error("Errore ricerca carta:", error.message);
    return res.status(500).json({ errore: "Errore interno ricerca" });
  }
});

// 2. Mappatura da Scryfall a CardTrader
app.get("/api/map-cardtrader", async (req, res) => {
  const { name, set_code } = req.query;
  if (!name || !set_code) return res.status(400).json({ errore: "Parametri mancanti: name e set_code sono richiesti" });

  try {
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    };
    
    // Carica espansioni se non in cache
    if (!expansionsCache) {
      const response = await fetch("https://api.cardtrader.com/api/v2/expansions", { headers });
      if (response.ok) {
        const data = await response.json();
        expansionsCache = data.filter(e => e.game_id === 1);
      }
    }
    
    if (!expansionsCache) throw new Error("Espansioni non disponibili");
    
    // Trova l'espansione corrispondente al codice di Scryfall (case insensitive)
    const targetSetCode = set_code.toLowerCase();
    const expansion = expansionsCache.find(e => e.code && e.code.toLowerCase() === targetSetCode);
    
    if (!expansion) {
      return res.status(404).json({ errore: `Espansione '${set_code}' non trovata su CardTrader` });
    }
    
    // Recupera tutti i blueprint di questa espansione
    const bpRes = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${expansion.id}`, { headers });
    if (!bpRes.ok) throw new Error("Errore recupero blueprint da CardTrader");
    const blueprints = await bpRes.json();
    
    // Trova il blueprint che corrisponde al nome
    const cleanName = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanTargetName = cleanName(name);
    
    let matchedBp = blueprints.find(bp => cleanName(bp.name) === cleanTargetName);
    
    if (!matchedBp) {
      // Fallback 1: se non c'è match esatto, prova con inclusione parziale
      matchedBp = blueprints.find(bp => cleanName(bp.name).includes(cleanTargetName) || cleanTargetName.includes(cleanName(bp.name)));
    }
    
    if (!matchedBp) {
      return res.status(404).json({ errore: `Blueprint '${name}' non trovato su CardTrader per l'espansione '${expansion.name}'` });
    }
    
    const slug = matchedBp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const cardTraderUrl = `https://www.cardtrader.com/en/cards/${matchedBp.id}-${slug}`;
    
    return res.json({
      id: matchedBp.id,
      name: matchedBp.name,
      url: cardTraderUrl,
      image: matchedBp.image?.url ? (matchedBp.image.url.startsWith("http") ? matchedBp.image.url : `https://api.cardtrader.com${matchedBp.image.url}`) : null
    });
  } catch (error) {
    console.error("Errore mappatura CardTrader:", error.message);
    return res.status(500).json({ errore: "Errore interno durante il recupero dei dati" });
  }
});

// 3. Recupero prezzo con filtri
app.get("/api/prezzo/:id", async (req, res) => {
  const idProdotto = req.params.id;
  const foilFilter = req.query.foil === "true" ? true : req.query.foil === "false" ? false : null;
  const langFilter = req.query.lang ? req.query.lang.toLowerCase() : null;
  const condFilter = req.query.cond ? req.query.cond.toLowerCase() : null;

  console.log(
    `[${new Date().toLocaleTimeString()}] Cerco nel marketplace l'ID: ${idProdotto} con filtri - foil: ${foilFilter}, lang: ${langFilter}, cond: ${condFilter}`,
  );

  try {
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    };

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
    let expansionName = null;

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
        if (bpData.expansion_id) {
          if (!expansionsCache) {
            const expRes = await fetch("https://api.cardtrader.com/api/v2/expansions", { headers });
            if (expRes.ok) {
              expansionsCache = await expRes.json();
            }
          }
          if (expansionsCache) {
            const matchedExp = expansionsCache.find(e => e.id === bpData.expansion_id);
            if (matchedExp) {
              expansionName = matchedExp.name;
            }
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

      let offerteFiltrate = offerteValide;
      
      // Filtra per foil/non-foil
      if (foilFilter !== null) {
        offerteFiltrate = offerteFiltrate.filter(item => 
          item.properties_hash && (!!item.properties_hash.mtg_foil === foilFilter)
        );
      }
      
      // Filtra per lingua
      if (langFilter) {
        offerteFiltrate = offerteFiltrate.filter(item => 
          item.properties_hash && item.properties_hash.mtg_language && (item.properties_hash.mtg_language.toLowerCase() === langFilter)
        );
      }
      
      // Filtra per condizione
      if (condFilter) {
        offerteFiltrate = offerteFiltrate.filter(item => 
          item.properties_hash && item.properties_hash.condition && (item.properties_hash.condition.toLowerCase() === condFilter)
        );
      }

      let totalStock = 0;
      let sellerCountry = null;
      let sellerType = null;
      let avgTop5 = null;

      if (offerteFiltrate.length > 0) {
        const offerteCoordinate = offerteFiltrate.sort((a, b) => {
          const valA = a.price ? a.price.cents : a.price_cents;
          const valB = b.price ? b.price.cents : b.price_cents;
          return valA - valB;
        });

        const min = offerteCoordinate[0];
        prezzoPiuBasso = (min.price ? min.price.cents : min.price_cents) / 100;
        
        // Compute total stock of all active listings matching filters
        totalStock = offerteFiltrate.reduce((acc, item) => acc + (item.quantity || 1), 0);
        
        // Seller details for the cheapest offer
        sellerCountry = min.user ? min.user.country_code : null;
        sellerType = min.user ? min.user.user_type : null;
        
        // Compute average price of the top 5 cheapest listings
        const top5 = offerteCoordinate.slice(0, 5);
        const sumTop5 = top5.reduce((acc, item) => {
          const val = item.price ? item.price.cents : item.price_cents;
          return acc + (val / 100);
        }, 0);
        avgTop5 = top5.length > 0 ? Number((sumTop5 / top5.length).toFixed(2)) : prezzoPiuBasso;

        console.log(`✅ Trovato prezzo per ID ${idProdotto} (filtrato): €${prezzoPiuBasso}. Stock: ${totalStock}, Seller: ${sellerCountry} (${sellerType}), Avg Top5: €${avgTop5}`);
      } else {
        console.log(`⚠️ Nessuna copia corrispondente ai filtri trovata per ID ${idProdotto}`);
      }
    } else if (response) {
      console.error(`❌ Errore API HTTP ${response.status} sui prezzi`);
    }

    return res.json({
      prezzo: prezzoPiuBasso,
      immagine: immagineUrl,
      nome: nomeBlueprint,
      espansione: expansionName,
      stock: totalStock,
      sellerCountry: sellerCountry,
      sellerType: sellerType,
      avgTop5: avgTop5
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
            
            let offerteFiltrate = offerteValide;
            const foilFilter = prodotto.foil === true ? true : prodotto.foil === false ? false : null;
            const langFilter = prodotto.lingua ? prodotto.lingua.toLowerCase() : null;
            const condFilter = prodotto.condizione ? prodotto.condizione.toLowerCase() : null;

            if (foilFilter !== null) {
              offerteFiltrate = offerteFiltrate.filter(item => 
                item.properties_hash && (!!item.properties_hash.mtg_foil === foilFilter)
              );
            }
            if (langFilter) {
              offerteFiltrate = offerteFiltrate.filter(item => 
                item.properties_hash && item.properties_hash.mtg_language && (item.properties_hash.mtg_language.toLowerCase() === langFilter)
              );
            }
            if (condFilter) {
              offerteFiltrate = offerteFiltrate.filter(item => 
                item.properties_hash && item.properties_hash.condition && (item.properties_hash.condition.toLowerCase() === condFilter)
              );
            }

            if (offerteFiltrate.length > 0) {
              offerteFiltrate.sort((a, b) => {
                const valA = a.price ? a.price.cents : a.price_cents;
                const valB = b.price ? b.price.cents : b.price_cents;
                return valA - valB;
              });
              
              const min = offerteFiltrate[0];
              const prezzoPiuBasso = (min.price ? min.price.cents : min.price_cents) / 100;
              
              prodotto.prezzoAttuale = prezzoPiuBasso;
              if (!prodotto.storico) {
                prodotto.storico = [];
              }
              
              const dataOggi = new Date().toLocaleDateString();
              const puntoEsistente = prodotto.storico.find(s => s.data === dataOggi);
              if (puntoEsistente) {
                puntoEsistente.prezzo = prezzoPiuBasso;
                puntoEsistente.timestamp = adesso;
              } else {
                prodotto.storico.push({
                  data: dataOggi,
                  timestamp: adesso,
                  prezzo: prezzoPiuBasso
                });
              }
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

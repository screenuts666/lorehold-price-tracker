const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inizializza Firebase Admin SDK
admin.initializeApp();
const db = getFirestore("default");

// Configurazione cache espansioni globale per ottimizzare le chiamate
const MAX_RETRIES = 3;
let expansionsCache = null; // Caching for CardTrader expansions
let scryfallSetsCache = null; // Caching for Scryfall sets

// --- EXPRESS APP PER API ---
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const API_TOKEN = process.env.CARDTRADER_API_TOKEN;

// 1. Ricerca carta su Scryfall
app.get("/search-card", async (req, res) => {
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
app.get("/map-cardtrader", async (req, res) => {
  const { name, set_code } = req.query;
  if (!name || !set_code) return res.status(400).json({ errore: "Parametri mancanti: name e set_code sono richiesti" });

  try {
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    };
    
    if (!expansionsCache) {
      const response = await fetch("https://api.cardtrader.com/api/v2/expansions", { headers });
      if (response.ok) {
        const data = await response.json();
        expansionsCache = data.filter(e => e.game_id === 1);
      }
    }
    
    if (!expansionsCache) throw new Error("Espansioni non disponibili");
    
    const targetSetCode = set_code.toLowerCase();
    const expansion = expansionsCache.find(e => e.code && e.code.toLowerCase() === targetSetCode);
    
    if (!expansion) {
      return res.status(404).json({ errore: `Espansione '${set_code}' non trovata su CardTrader` });
    }
    
    const bpRes = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${expansion.id}`, { headers });
    if (!bpRes.ok) throw new Error("Errore recupero blueprint da CardTrader");
    const blueprints = await bpRes.json();
    
    const cleanName = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanTargetName = cleanName(name);
    
    let matchedBp = blueprints.find(bp => cleanName(bp.name) === cleanTargetName);
    
    if (!matchedBp) {
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
      image: matchedBp.image?.url ? (matchedBp.image.url.startsWith("http") ? matchedBp.image.url : `https://www.cardtrader.com${matchedBp.image.url}`) : null
    });
  } catch (error) {
    console.error("Errore mappatura CardTrader:", error.message);
    return res.status(500).json({ errore: "Errore interno durante il recupero dei dati" });
  }
});

// 3. Recupero prezzo con filtri
app.get("/prezzo/:id", async (req, res) => {
  const idProdotto = req.params.id;
  const foilFilter = req.query.foil === "true" ? true : req.query.foil === "false" ? false : null;
  const langFilter = req.query.lang ? req.query.lang.toLowerCase() : null;
  const condFilter = req.query.cond ? req.query.cond.toLowerCase() : null;

  console.log(`Cerco nel marketplace l'ID: ${idProdotto} con filtri - foil: ${foilFilter}, lang: ${langFilter}, cond: ${condFilter}`);

  try {
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    };

    const [blueprintResponse, response] = await Promise.all([
      fetch(`https://api.cardtrader.com/api/v2/blueprints/${idProdotto}`, { headers }).catch(() => null),
      fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${idProdotto}`, { headers }).catch(() => null)
    ]);

    let nomeBlueprint = null;
    let immagineUrl = null;
    let expansionName = null;
    let releaseDate = null;

    if (blueprintResponse && blueprintResponse.ok) {
      try {
        const bpData = await blueprintResponse.json();
        nomeBlueprint = bpData.name || bpData.translated_name;
        if (bpData.image) {
          const imgPath = bpData.image.preview?.url || bpData.image.url;
          if (imgPath) {
            immagineUrl = imgPath.startsWith("http") ? imgPath : `https://www.cardtrader.com${imgPath}`;
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
        
        // Fetch release date from Scryfall
        if (expansionName) {
          try {
            if (!scryfallSetsCache) {
              const scryRes = await fetch("https://api.scryfall.com/sets", { headers: { 'User-Agent': 'LoreholdPriceTracker/1.0' } });
              if (scryRes.ok) {
                const scryData = await scryRes.json();
                scryfallSetsCache = scryData.data;
              }
            }
            if (scryfallSetsCache) {
              // Try exact match first
              let matchedSet = scryfallSetsCache.find(s => s.name.toLowerCase() === expansionName.toLowerCase());
              // Try fuzzy match
              if (!matchedSet) {
                matchedSet = scryfallSetsCache.find(s => s.name.toLowerCase().includes(expansionName.toLowerCase()) || expansionName.toLowerCase().includes(s.name.toLowerCase()));
              }
              if (matchedSet && matchedSet.released_at) {
                releaseDate = matchedSet.released_at;
              }
            }
          } catch (e) {
            console.error("Errore fetch Scryfall sets:", e.message);
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

      const offerteValide = arrayOfferte.filter(item => item && (item.price || item.price_cents));

      const pricesByLanguage = {};
      offerteValide.forEach(offer => {
        if (offer.properties_hash && offer.properties_hash.mtg_language) {
          const lang = offer.properties_hash.mtg_language.toLowerCase();
          const cents = offer.price ? offer.price.cents : offer.price_cents;
          const price = cents / 100;
          if (!pricesByLanguage[lang] || price < pricesByLanguage[lang]) {
            pricesByLanguage[lang] = Number(price.toFixed(2));
          }
        }
      });

      let offerteFiltrate = offerteValide;
      
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
        totalStock = offerteFiltrate.reduce((acc, item) => acc + (item.quantity || 1), 0);
        
        sellerCountry = min.user ? min.user.country_code : null;
        sellerType = min.user ? min.user.user_type : null;
        
        const top5 = offerteCoordinate.slice(0, 5);
        const sumTop5 = top5.reduce((acc, item) => {
          const val = item.price ? item.price.cents : item.price_cents;
          return acc + (val / 100);
        }, 0);
        avgTop5 = top5.length > 0 ? Number((sumTop5 / top5.length).toFixed(2)) : prezzoPiuBasso;
      }

      return res.json({
        prezzo: prezzoPiuBasso,
        immagine: immagineUrl,
        nome: nomeBlueprint,
        espansione: expansionName,
        releaseDate: releaseDate,
        stock: totalStock,
        sellerCountry: sellerCountry,
        sellerType: sellerType,
        avgTop5: avgTop5,
        pricesByLanguage: pricesByLanguage
      });
    }

    return res.status(400).json({ errore: "Blueprint non trovato o errore api" });
  } catch (error) {
    console.error(`Errore di rete su ID ${idProdotto}:`, error);
    return res.status(500).json({ errore: "Errore API" });
  }
});

// 4. Recupero grafico storico (Scraping HTML CardTrader)
app.get("/ct-history/:id", async (req, res) => {
  const idProdotto = req.params.id;
  try {
    // Il formato dell'URL richiede di solito l'ID seguito dallo slug, ma se passiamo solo l'ID 
    // a volte CardTrader reindirizza o comunque funziona. Per sicurezza, l'ID esatto o url parziale.
    // L'utente passerà l'URL o l'ID. E.g. 389300
    
    // Per bypassare i blocchi Cloudflare, simuliamo Googlebot o un browser standard.
    const url = `https://www.cardtrader.com/it/cards/${idProdotto}`;
    console.log("Scraping history da:", url);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Google Chrome\";v=\"114\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": "\"Windows\"",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      }
    });
    
    const html = await response.text();
    
    if (!response.ok) {
       console.log("Cloudflare o errore! Status:", response.status);
       return res.status(response.status).send(html);
    }
    
    // Cerchiamo il JSON della chart usando RegEx
    const regex = /&quot;prices_for_graph&quot;:{.*?&quot;ct_market&quot;:(\[\[.*?\]\])/s;
    const match = html.match(regex);
    
    if (match && match[1]) {
      let dataStr = match[1].replace(/&quot;/g, '"');
      try {
        const ctMarket = JSON.parse(dataStr);
        return res.json({ history: ctMarket });
      } catch (e) {
        return res.status(500).json({ error: "Errore parsing JSON" });
      }
    }
    
    return res.status(404).json({ error: "Grafico non trovato nell'HTML" });
    
  } catch (err) {
    console.error("Errore nello scraping del grafico:", err.message);
    return res.status(500).json({ error: "Errore interno scraping" });
  }
});

// Esporta l'app Express come Cloud Function
exports.api = onRequest({ 
  cors: true, 
  memory: "256MiB", 
  timeoutSeconds: 60,
  minInstances: 0 
}, app);

// --- SCHEDULER PER AGGIORNAMENTO AUTOMATICO OGNI ORA (PER TEST) ---
exports.updatePricesScheduler = onSchedule({
  schedule: "every 1 hours",
  timeoutSeconds: 600,
  memory: "256MiB"
}, async (event) => {
  console.log("Avvio aggiornamento automatico dei prezzi da scheduler...");
  
  try {
    const productsSnapshot = await db.collection("products").get();
    if (productsSnapshot.empty) {
      console.log("Nessun prodotto trovato in Firestore.");
      return;
    }

    const now = Date.now();
    const COOLDOWN_MS = 1 * 60 * 60 * 1000;
    const headers = {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    };

    // Recupera espansioni in cache
    if (!expansionsCache) {
      const expRes = await fetch("https://api.cardtrader.com/api/v2/expansions", { headers }).catch(() => null);
      if (expRes && expRes.ok) {
        expansionsCache = await expRes.json();
      }
    }

    for (const doc of productsSnapshot.docs) {
      const prodotto = doc.data();
      const docRef = doc.ref;

      const ultimoPunto = prodotto.storico && prodotto.storico.length > 0 
        ? prodotto.storico[prodotto.storico.length - 1] 
        : null;
      const ultimoTimestamp = ultimoPunto ? (ultimoPunto.timestamp || new Date(ultimoPunto.data).getTime()) : 0;
      
      // Se sono passate più di 6 ore dall'ultimo aggiornamento
      if ((now - ultimoTimestamp) > COOLDOWN_MS) {
        console.log(`Aggiorno prezzo per ID: ${prodotto.id} (${prodotto.nome})`);
        
        try {
          const [blueprintResponse, response] = await Promise.all([
            fetch(`https://api.cardtrader.com/api/v2/blueprints/${prodotto.id}`, { headers }).catch(() => null),
            fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${prodotto.id}`, { headers }).catch(() => null)
          ]);
          
          const updateData = {};

          if (blueprintResponse && blueprintResponse.ok) {
            const bpData = await blueprintResponse.json();
            updateData.nome = bpData.name || bpData.translated_name;

            if (bpData.image) {
              const imgPath = bpData.image.preview?.url || bpData.image.url;
              if (imgPath) {
                updateData.immagine = imgPath.startsWith("http") ? imgPath : `https://www.cardtrader.com${imgPath}`;
              }
            }
            if (bpData.expansion_id && expansionsCache) {
              const matchedExp = expansionsCache.find(e => e.id === bpData.expansion_id);
              if (matchedExp) {
                updateData.expansion = matchedExp.name;
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

            const pricesByLanguage = {};
            offerteValide.forEach(offer => {
              if (offer.properties_hash && offer.properties_hash.mtg_language) {
                const lang = offer.properties_hash.mtg_language.toLowerCase();
                const cents = offer.price ? offer.price.cents : offer.price_cents;
                const price = cents / 100;
                if (!pricesByLanguage[lang] || price < pricesByLanguage[lang]) {
                  pricesByLanguage[lang] = Number(price.toFixed(2));
                }
              }
            });

            if (offerteFiltrate.length > 0) {
              offerteFiltrate.sort((a, b) => {
                const valA = a.price ? a.price.cents : a.price_cents;
                const valB = b.price ? b.price.cents : b.price_cents;
                return valA - valB;
              });
              
              const min = offerteFiltrate[0];
              const prezzoPiuBasso = (min.price ? min.price.cents : min.price_cents) / 100;
              
              updateData.prezzoAttuale = prezzoPiuBasso;
              updateData.stock = offerteFiltrate.reduce((acc, item) => acc + (item.quantity || 1), 0);
              updateData.sellerCountry = min.user ? min.user.country_code : null;
              updateData.sellerType = min.user ? min.user.user_type : null;
              updateData.pricesByLanguage = pricesByLanguage;

              const top5 = offerteFiltrate.slice(0, 5);
              const sumTop5 = top5.reduce((acc, item) => {
                const val = item.price ? item.price.cents : item.price_cents;
                return acc + (val / 100);
              }, 0);
              updateData.avgTop5 = top5.length > 0 ? Number((sumTop5 / top5.length).toFixed(2)) : prezzoPiuBasso;

              // Aggiorna storico
              const storico = prodotto.storico || [];
              const dataOggi = new Date().toLocaleDateString();
              const puntoEsistente = storico.find(s => s.data === dataOggi);
              if (puntoEsistente) {
                puntoEsistente.prezzo = prezzoPiuBasso;
                puntoEsistente.timestamp = now;
                puntoEsistente.pricesByLanguage = pricesByLanguage;
              } else {
                storico.push({
                  data: dataOggi,
                  timestamp: now,
                  prezzo: prezzoPiuBasso,
                  pricesByLanguage: pricesByLanguage
                });
              }
              updateData.storico = storico;
            }
          }
          
          // Esegui l'aggiornamento parziale nel documento Firestore se ci sono modifiche
          if (Object.keys(updateData).length > 0) {
            await docRef.update(updateData);
            console.log(`Documento ID ${prodotto.id} aggiornato correttamente.`);
          } else {
            console.log(`Nessun aggiornamento necessario per ID ${prodotto.id}.`);
          }
          
        } catch (err) {
          console.error(`Errore aggiornamento carta ID ${prodotto.id}:`, err.message);
        }
        
        // Aspettiamo 1.5 secondi per rispettare i rate limit dell'API CardTrader
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  } catch (err) {
    console.error("Errore generico nello scheduler:", err.message);
  }
});

// ============================================================
// --- RATE LIMITER STATE (IN-MEMORY, locale per istanza) ---
// ============================================================
const AI_SCAN_COOLDOWN_MS = 30 * 60 * 1000; // 30 minuti
const AI_SCAN_GLOBAL_KEY = "ai_scan_global_lock";

async function getGlobalScanLock() {
  const lockRef = db.collection("_system").doc("ai_scan_lock");
  const lockDoc = await lockRef.get();
  if (!lockDoc.exists) return null;
  return lockDoc.data();
}

async function setGlobalScanLock(data) {
  const lockRef = db.collection("_system").doc("ai_scan_lock");
  await lockRef.set(data, { merge: true });
}

// --- MANUAL AI ADVISOR TRIGGER ENDPOINT ---
app.post("/run-ai-advisor", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Manca GEMINI_API_KEY!" });

    // Controlla il lock globale su Firestore (blocca se gia' in corso o troppo recente)
    const lock = await getGlobalScanLock();
    const now = Date.now();
    if (lock) {
      if (lock.isRunning) {
        return res.status(429).json({ message: "Una scansione IA e' attualmente in corso da un altro dispositivo. Attendi che termini!" });
      }
      const remainingMs = AI_SCAN_COOLDOWN_MS - (now - lock.lastRun);
      if (remainingMs > 0) {
        const remainingMin = Math.ceil(remainingMs / 60000);
        return res.status(429).json({
          message: `Limitazione chiamate: Scansione IA eseguita di recente. Attendi ${remainingMin} minut${remainingMin === 1 ? 'o' : 'i'} prima di rilanciare.`,
          remainingMs
        });
      }
    }

    // Imposta il lock
    await setGlobalScanLock({ isRunning: true, lastRun: now, startedAt: new Date().toISOString() });
    res.status(202).json({ message: "Avvio scansione IA in background. Aggiorna tra qualche minuto!" });

    // --- ESEGUI L'ANALISI IN BACKGROUND ---
    (async () => {
      try {
        console.log("Avvio MANUALE AI Advisor Agent...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const snapshot = await db.collection("products").get();
        if (snapshot.empty) { await setGlobalScanLock({ isRunning: false, lastRun: now }); return; }

        const promptPrefix = `Sei un consulente finanziario esperto in investimenti su carte collezionabili di Magic: The Gathering (MTG).
Ti forniro' i dati di un prodotto sigillato (nome, prezzo attuale, e gli ultimi punti dello storico prezzi).
Il tuo compito e' analizzare rapidamente il trend.
Rispondi SOLO con un oggetto JSON valido contenente due campi:
- "verdict": una singola parola tra "COMPRA", "ASPETTA", "SOVRAPPREZZO".
- "reason": una frase sintetica (massimo 15 parole) che motiva la scelta.
Esempio: {"verdict": "COMPRA", "reason": "Prezzo ai minimi storici, ottimo punto di ingresso."}

Ecco i dati del prodotto:
`;

        for (const doc of snapshot.docs) {
          const p = doc.data();
          if (!p.prezzoAttuale || p.prezzoAttuale === 0) continue;
          const storicoLimitato = (p.storico || []).slice(-15).map(s => `Data: ${s.data}, Prezzo: ${s.prezzo}EUR`).join(" | ");
          const prompt = promptPrefix + `Nome: ${p.nome}\nPrezzo Attuale: ${p.prezzoAttuale}EUR\nStorico recente: ${storicoLimitato}`;
          try {
            const result = await model.generateContent(prompt);
            let text = result.response.text();
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const aiData = JSON.parse(text);
            await doc.ref.update({ ai_verdict: aiData.verdict, ai_reason: aiData.reason, ai_last_update: Date.now() });
            console.log(`Aggiornato ${p.nome}: ${aiData.verdict}`);
            await new Promise(resolve => setTimeout(resolve, 4000));
          } catch (err) {
            console.error(`Errore AI per ${p.nome}:`, err.message);
          }
        }
        console.log("AI Advisor Agent manuale terminato!");
      } catch (err) {
        console.error("Errore AI Advisor manuale:", err);
      } finally {
        await setGlobalScanLock({ isRunning: false, lastRun: now });
      }
    })();

  } catch (err) {
    console.error("Errore /run-ai-advisor:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- TELEGRAM BOT AI WEBHOOK ENDPOINT ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text, parseMode = "Markdown") {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const payload = { chat_id: chatId, text: text };
    if (parseMode) payload.parse_mode = parseMode;

    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Telegram sendMessage status ${response.status}: ${errText}. Retrying without parse_mode...`);
      delete payload.parse_mode;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
  } catch (err) {
    console.error("Errore invio messaggio Telegram:", err);
  }
}

// Funzione per impostare i comandi nativi di Telegram
async function setupTelegramBotCommands() {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setMyCommands`;
    const commands = [
      { command: "start", description: "Avvia il Bot e mostra il benvenuto" },
      { command: "affari", description: "Migliori occasioni e sconti MTG" },
      { command: "espansioni", description: "Lista dei set monitorati nel tracker" },
      { command: "cerca", description: "Cerca un prodotto (es: /cerca booster box)" },
      { command: "consigli", description: "Top 5 consigli d'acquisto dell'IA" },
      { command: "stats", description: "Statistiche generali del database" },
      { command: "prezzo", description: "Verifica rapida prezzo (es: /prezzo zendikar)" },
      { command: "help", description: "Guida e lista di tutti i comandi" }
    ];
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands: commands })
    });
    console.log("Comandi nativi Telegram impostati con successo!");
  } catch (e) {
    console.error("Errore impostazione comandi Telegram:", e.message);
  }
}

app.post("/telegram-webhook", async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.message) return res.status(200).send("OK");

    const message = body.message;
    const chatId = message.chat.id;
    const userText = (message.text || "").trim();
    if (!userText) return res.status(200).send("OK");

    console.log(`Telegram Bot messaggio da ${chatId}: "${userText}"`);
    const textLower = userText.toLowerCase();

    // 1. /start o /help o /comandi
    if (textLower === "/start" || textLower === "/help" || textLower === "/comandi") {
      const welcome = `🏰 Lorehold Price Tracker AI Bot\n\nCiao! Sono l'Agente IA per i prodotti sigillati Magic: The Gathering (MTG).\n\n📜 Comandi Rapidi Disponibili:\n• /affari - Migliori occasioni d'acquisto con sconti & verdict IA\n• /espansioni - Set e collezioni monitorate nel tracker\n• /cerca <nome> - Cerca prodotti (es: /cerca Play Booster Box)\n• /consigli - Top 5 acquisti consigliati dall'IA\n• /stats - Statistiche complessive del tracker\n• /prezzo <nome> - Consulta prezzo e stock di un prodotto\n• /help - Mostra questa guida\n\n💬 Oppure scrivimi qualsiasi domanda in linguaggio naturale!\nEs: "Quali sono i booster box sotto i 100 euro?" o "Conviene comprare ora Star Trek?"`;
      await sendTelegramMessage(chatId, welcome);
      return res.status(200).send("OK");
    }

    // 2. /affari o /deals
    if (textLower === "/affari" || textLower === "/deals") {
      const snapshot = await db.collection("products").get();
      const products = [];
      snapshot.forEach(doc => products.push(doc.data()));
      const deals = products.filter(p => {
        const v = (p.ai_verdict || p.verdict || '').toUpperCase();
        const price = p.prezzoAttuale || 0;
        return v.includes("COMPRA") || (price > 0 && price <= 110);
      });
      if (deals.length === 0) {
        await sendTelegramMessage(chatId, "🎯 Al momento non ci sono prodotti con verdict COMPRA in forte sconto. Ricontrolla tra poco!");
        return res.status(200).send("OK");
      }
      let reply = `🎯 OCCASIONI & AFFARI MTG SIGILLATI\n\n`;
      deals.slice(0, 8).forEach(d => {
        const v = d.ai_verdict || "COMPRA";
        const link = d.url || (d.id ? `https://www.cardtrader.com/it/cards/${d.id}` : null);
        const linkStr = link ? `\n[Vedi Offerta su CardTrader](${link})` : '';
        reply += `📦 ${d.nome}\n💰 Prezzo: EUR ${d.prezzoAttuale || 'N/D'}\n🎨 Set: ${d.expansion || 'Generico'}\n🧠 IA: ${v} (${d.ai_reason || 'Ottimo punto di ingresso'})${linkStr}\n\n`;
      });
      await sendTelegramMessage(chatId, reply);
      return res.status(200).send("OK");
    }

    // 3. /espansioni o /sets
    if (textLower === "/espansioni" || textLower === "/sets") {
      const snapshot = await db.collection("products").get();
      const expMap = {};
      snapshot.forEach(doc => {
        const p = doc.data();
        if (p.expansion) expMap[p.expansion] = (expMap[p.expansion] || 0) + 1;
      });
      let reply = `📦 ESPANSIONI MONITORATE NEL TRACKER\n\n`;
      const expList = Object.keys(expMap).sort();
      if (expList.length === 0) {
        reply += "Nessuna espansione attualmente in archivio.";
      } else {
        expList.forEach(exp => { reply += `• ${exp}: ${expMap[exp]} prodotti sigillati\n`; });
      }
      reply += `\nUsa /cerca <nome_set> per cercare prodotti di un set specifico!`;
      await sendTelegramMessage(chatId, reply);
      return res.status(200).send("OK");
    }

    // 4. /cerca o /prezzo
    if (textLower.startsWith("/cerca") || textLower.startsWith("/prezzo")) {
      const queryParts = userText.split(" ");
      queryParts.shift(); // rimuovi comando
      const searchQuery = queryParts.join(" ").trim().toLowerCase();
      if (!searchQuery) {
        await sendTelegramMessage(chatId, "⚠️ Specificare un nome o una parola chiave da cercare.\nEsempio: /cerca Zendikar oppure /prezzo Play Booster");
        return res.status(200).send("OK");
      }

      const snapshot = await db.collection("products").get();
      const matched = [];
      snapshot.forEach(doc => {
        const p = doc.data();
        const fullStr = `${p.nome || ''} ${p.expansion || ''}`.toLowerCase();
        if (fullStr.includes(searchQuery)) {
          matched.push(p);
        }
      });

      if (matched.length === 0) {
        await sendTelegramMessage(chatId, `🔍 Nessun prodotto trovato per "${searchQuery}". Prova con un nome più generale o usa /espansioni per la lista.`);
        return res.status(200).send("OK");
      }

      let reply = `🔍 RISULTATI RICERCA PER "${searchQuery.toUpperCase()}" (${matched.length} trovati):\n\n`;
      matched.slice(0, 7).forEach(p => {
        const link = p.url || (p.id ? `https://www.cardtrader.com/it/cards/${p.id}` : "");
        const linkStr = link ? `\n[Apri su CardTrader](${link})` : '';
        reply += `📦 ${p.nome}\n💰 Prezzo: EUR ${p.prezzoAttuale || 'N/D'} | Stock: ${p.stock ?? 'N/D'}\n🏷️ Set: ${p.expansion || 'N/D'} | IA: ${p.ai_verdict || 'STABILE'}${linkStr}\n\n`;
      });
      await sendTelegramMessage(chatId, reply);
      return res.status(200).send("OK");
    }

    // 5. /consigli o /top
    if (textLower === "/consigli" || textLower === "/top") {
      const snapshot = await db.collection("products").get();
      const products = [];
      snapshot.forEach(doc => products.push(doc.data()));

      const recommended = products
        .filter(p => p.prezzoAttuale && p.prezzoAttuale > 0)
        .sort((a, b) => {
          const scoreA = (a.ai_verdict === "COMPRA" ? 2 : 0) + (a.stock > 0 ? 1 : 0);
          const scoreB = (b.ai_verdict === "COMPRA" ? 2 : 0) + (b.stock > 0 ? 1 : 0);
          return scoreB - scoreA;
        })
        .slice(0, 5);

      let reply = `💡 TOP 5 ACQUISTI CONSIGLIATI DALL'IA\n\n`;
      recommended.forEach((p, idx) => {
        const link = p.url || (p.id ? `https://www.cardtrader.com/it/cards/${p.id}` : "");
        const linkStr = link ? `\n[Vedi Offerta](${link})` : '';
        reply += `${idx + 1}. ${p.nome}\n   💰 EUR ${p.prezzoAttuale} | Set: ${p.expansion || 'Generico'}\n   🧠 IA Verdict: ${p.ai_verdict || 'COMPRA'} (${p.ai_reason || 'Punto di ingresso favorevole'})${linkStr}\n\n`;
      });
      await sendTelegramMessage(chatId, reply);
      return res.status(200).send("OK");
    }

    // 6. /stats o /statistiche
    if (textLower === "/stats" || textLower === "/statistiche") {
      const snapshot = await db.collection("products").get();
      let totalProducts = 0;
      let totalValue = 0;
      const expSet = new Set();
      let minPriceItem = null;
      let maxPriceItem = null;

      snapshot.forEach(doc => {
        const p = doc.data();
        totalProducts++;
        if (p.expansion) expSet.add(p.expansion);
        const price = p.prezzoAttuale || 0;
        if (price > 0) {
          totalValue += price;
          if (!minPriceItem || price < minPriceItem.prezzoAttuale) minPriceItem = p;
          if (!maxPriceItem || price > maxPriceItem.prezzoAttuale) maxPriceItem = p;
        }
      });

      const avgPrice = totalProducts > 0 ? (totalValue / totalProducts).toFixed(2) : 0;
      let reply = `📊 STATISTICHE LOREHOLD PRICE TRACKER\n\n`;
      reply += `📦 Prodotti Sigillati Tracciati: ${totalProducts}\n`;
      reply += `🎨 Espansioni Monitorate: ${expSet.size}\n`;
      reply += `💶 Prezzo Medio: EUR ${avgPrice}\n`;
      if (minPriceItem) reply += `📉 Prezzo Più Basso: EUR ${minPriceItem.prezzoAttuale} (${minPriceItem.nome})\n`;
      if (maxPriceItem) reply += `📈 Prezzo Più Alto: EUR ${maxPriceItem.prezzoAttuale} (${maxPriceItem.nome})\n`;
      await sendTelegramMessage(chatId, reply);
      return res.status(200).send("OK");
    }

    // 7. Risposta in linguaggio naturale con Gemini 2.5 Flash + Fallback Locale DB
    const apiKey = process.env.GEMINI_API_KEY;
    const snapshot = await db.collection("products").get();
    const productsList = [];
    snapshot.forEach(doc => {
      const p = doc.data();
      if (!p.prezzoAttuale || p.prezzoAttuale === 0) return;
      const link = p.url || (p.id ? `https://www.cardtrader.com/it/cards/${p.id}` : "");
      productsList.push({ nome: p.nome, prezzoAttuale: p.prezzoAttuale, expansion: p.expansion, verdict: p.ai_verdict || p.verdict || "STABILE", reason: p.ai_reason || "", link: link });
    });

    // Se l'API Gemini e' disponibile, proviamo con il modello di punta
    if (apiKey) {
      const limitedList = productsList.slice(0, 60);
      const contextStr = limitedList.map(p =>
        `- ${p.nome} (${p.expansion || 'Generico'}): EUR${p.prezzoAttuale} | IA: ${p.verdict}. ${p.reason} | ${p.link}`
      ).join("\n");

      const prompt = `Sei l'Assistente IA Telegram di "Lorehold Price Tracker", esperto di investimenti su prodotti sigillati Magic: The Gathering (MTG).
Rispondi in italiano, in modo chiaro, amichevole e conciso (max 250 parole). Usa emoji per rendere il messaggio visivo.
Quando citi un prodotto con link, usa il formato: [Nome Prodotto](URL).
NON usare ** per il grassetto: usa solo testo normale e link cliccabili.

Dati aggiornati dal nostro database (${limitedList.length} prodotti monitorati):
${contextStr}

Domanda dell'utente: "${userText}"

Rispondi basandoti sui dati sopra. Se l'utente chiede consigli o prezzi, indica i dettagli esatti.`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
      let aiAnswer = null;

      for (const mName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: mName });
          const result = await model.generateContent(prompt);
          aiAnswer = result.response.text();
          if (aiAnswer) break;
        } catch (mErr) {
          console.warn(`Modello ${mName} non disponibile:`, mErr.message);
        }
      }

      if (aiAnswer) {
        aiAnswer = aiAnswer.replace(/\*\*(.*?)\*\*/g, "$1");
        if (aiAnswer.length > 4000) aiAnswer = aiAnswer.substring(0, 3990) + "\n\n..._(risposta troncata)_";
        await sendTelegramMessage(chatId, aiAnswer);
        return res.status(200).send("OK");
      }
    }

    // FALLBACK LOCALE INTELIGENTE (se l'API AI fallisce o e' in rate-limit)
    console.log("Fallback locale DB per query:", userText);
    const keywords = userText.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const matchedProducts = productsList.filter(p => {
      const full = `${p.nome} ${p.expansion}`.toLowerCase();
      return keywords.some(kw => full.includes(kw));
    });

    let fallbackReply = `🤖 LOREHOLD BOT - RISPOSTA RAPIDA\n\n`;
    if (matchedProducts.length > 0) {
      fallbackReply += `Ho trovato questi prodotti nel tracker correlati alla tua richiesta:\n\n`;
      matchedProducts.slice(0, 5).forEach(p => {
        const linkStr = p.link ? `\n[Vedi su CardTrader](${p.link})` : '';
        fallbackReply += `📦 ${p.nome}\n💰 Prezzo: EUR ${p.prezzoAttuale} | Set: ${p.expansion || 'Generico'}\n🧠 IA Verdict: ${p.verdict}${linkStr}\n\n`;
      });
    } else {
      fallbackReply += `Non ho trovato prodotti specifici per "${userText}".\n\nComandi utili:\n/affari - Migliori sconti\n/cerca <nome> - Cerca qualsiasi set o box\n/espansioni - Set monitorati\n/stats - Statistiche database`;
    }
    await sendTelegramMessage(chatId, fallbackReply);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Errore Telegram Webhook:", err);
    return res.status(200).send("OK");
  }
});

// Endpoint per configurare il Webhook ed i Comandi Telegram
app.get("/set-telegram-webhook", async (req, res) => {
  try {
    const webhookUrl = "https://api-ll4z4qe4ga-uc.a.run.app/telegram-webhook";
    const resTelegram = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
    const data = await resTelegram.json();
    await setupTelegramBotCommands();
    return res.json({ message: "Webhook e Comandi Telegram configurati con successo!", result: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- AI ADVISOR AGENT SCHEDULATO (ogni 24 ore) ---
exports.aiAdvisorAgent = onSchedule({
  schedule: "every 24 hours",
  timeoutSeconds: 540,
  memory: "256MiB"
}, async (event) => {
  console.log("Avvio AI Advisor Agent schedulato...");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { console.error("Manca GEMINI_API_KEY!"); return; }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const snapshot = await db.collection("products").get();
    if (snapshot.empty) return;
    const promptPrefix = `Sei un consulente finanziario esperto in investimenti su carte collezionabili di Magic: The Gathering (MTG).
Ti forniro' i dati di un prodotto sigillato.
Rispondi SOLO con un oggetto JSON valido:
- "verdict": "COMPRA", "ASPETTA", o "SOVRAPPREZZO".
- "reason": frase sintetica max 15 parole.
Esempio: {"verdict": "COMPRA", "reason": "Prezzo ai minimi storici, ottimo punto di ingresso."}
Dati del prodotto:
`;
    for (const doc of snapshot.docs) {
      const p = doc.data();
      if (!p.prezzoAttuale || p.prezzoAttuale === 0) continue;
      const storicoLimitato = (p.storico || []).slice(-15).map(s => `Data: ${s.data}, Prezzo: ${s.prezzo}EUR`).join(" | ");
      const prompt = promptPrefix + `Nome: ${p.nome}\nPrezzo Attuale: ${p.prezzoAttuale}EUR\nStorico recente: ${storicoLimitato}`;
      try {
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const aiData = JSON.parse(text);
        await doc.ref.update({ ai_verdict: aiData.verdict, ai_reason: aiData.reason, ai_last_update: Date.now() });
        console.log(`Aggiornato ${p.nome}: ${aiData.verdict}`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      } catch (err) {
        console.error(`Errore AI per ${p.nome}:`, err.message);
      }
    }
    console.log("AI Advisor Agent schedulato terminato!");
  } catch (err) {
    console.error("Errore fatale AI Advisor:", err);
  }
});

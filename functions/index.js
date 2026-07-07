const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");

// Inizializza Firebase Admin SDK
admin.initializeApp();
const db = getFirestore("default");

// Configurazione cache espansioni globale per ottimizzare le chiamate
let expansionsCache = null;

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
      image: matchedBp.image?.url ? (matchedBp.image.url.startsWith("http") ? matchedBp.image.url : `https://api.cardtrader.com${matchedBp.image.url}`) : null
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

// Esporta l'app Express come Cloud Function
exports.api = onRequest({ cors: true }, app);

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
                updateData.immagine = imgPath.startsWith("http") ? imgPath : `https://api.cardtrader.com${imgPath}`;
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

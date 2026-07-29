require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore("default");

const API_TOKEN = process.env.CARDTRADER_API_TOKEN || "uV928-u-kL_v_YjUeQz-4zJ";

async function seedAllUpcomingExpansions() {
  console.log("🚀 Avvio popolamento automatico di tutte le nuove espansioni in Firestore...");
  const headers = { Authorization: `Bearer ${API_TOKEN}`, Accept: "application/json" };

  const expRes = await fetch("https://api.cardtrader.com/api/v2/expansions", { headers });
  if (!expRes.ok) throw new Error("Impossibile recuperare espansioni da CardTrader");
  const allExpansions = await expRes.json();
  const mtgExpansions = allExpansions.filter(e => e.game_id === 1);

  // Lista delle espansioni target principali
  const targetKeywords = [
    "star trek", "reality fracture", "hobbit", "marvel", "strixhaven", "mystery booster", "lorwyn"
  ];

  const matchedExpansions = mtgExpansions.filter(e => {
    const name = e.name.toLowerCase();
    return targetKeywords.some(kw => name.includes(kw));
  });

  console.log(`Trovate ${matchedExpansions.length} espansioni in CardTrader correlate.`);

  const sealedCatIds = [3, 4, 7, 47, 54]; // Box, Booster, Prerelease, Collector Box, Bundle
  let totalAdded = 0;

  for (const exp of matchedExpansions) {
    console.log(`\n📦 Processo espansione: ${exp.name} (${exp.id})`);
    try {
      const bpRes = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${exp.id}`, { headers });
      if (!bpRes.ok) continue;
      const blueprints = await bpRes.json();
      const sealedBlueprints = blueprints.filter(bp => sealedCatIds.includes(bp.category_id));

      console.log(`Trovati ${sealedBlueprints.length} prodotti sigillati.`);

      for (const bp of sealedBlueprints) {
        const docRef = db.collection("products").doc(bp.id.toString());
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          const slug = bp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const imgPath = bp.image?.url || "";

          let prezzoAttuale = 0;
          let stock = 0;
          try {
            const mktRes = await fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${bp.id}`, { headers }).catch(() => null);
            if (mktRes && mktRes.ok) {
              const mktData = await mktRes.json();
              const offers = Array.isArray(mktData) ? mktData : Object.values(mktData).flat();
              const valid = offers.filter(o => o && (o.price || o.price_cents));
              if (valid.length > 0) {
                valid.sort((a, b) => (a.price ? a.price.cents : a.price_cents) - (b.price ? b.price.cents : b.price_cents));
                prezzoAttuale = (valid[0].price ? valid[0].price.cents : valid[0].price_cents) / 100;
                stock = valid.reduce((acc, item) => acc + (item.quantity || 1), 0);
              }
            }
          } catch (e) {}

          const todayDate = new Date().toLocaleDateString();
          const newProduct = {
            id: bp.id.toString(),
            nome: bp.name || bp.translated_name,
            prezzoAttuale: prezzoAttuale,
            url: `https://www.cardtrader.com/en/cards/${bp.id}-${slug}`,
            immagine: imgPath.startsWith("http") ? imgPath : (imgPath ? `https://www.cardtrader.com${imgPath}` : null),
            dataInserimento: todayDate,
            intento: "buy",
            foil: null,
            lingua: null,
            condizione: null,
            expansion: exp.name,
            stock: stock,
            storico: prezzoAttuale > 0 ? [{ data: todayDate, timestamp: Date.now(), prezzo: prezzoAttuale }] : [],
            isSealed: true
          };

          await docRef.set(newProduct);
          console.log(`  + Aggiunto: ${newProduct.nome} (€${prezzoAttuale})`);
          totalAdded++;
        }
      }
    } catch (e) {
      console.error(`Errore su ${exp.name}:`, e.message);
    }
  }

  console.log(`\n🎉 COMPLETATO! Aggiunti totali ${totalAdded} prodotti sigillati in Firestore.`);
  process.exit(0);
}

seedAllUpcomingExpansions().catch(err => {
  console.error("Errore fatale seed:", err);
  process.exit(1);
});

require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore("default");

const API_TOKEN = process.env.CARDTRADER_API_TOKEN;

async function seedHistoricalExpansions() {
  console.log("🚀 Avvio popolamento completo delle espansioni storiche e vecchie su CardTrader...");
  const headers = { Authorization: `Bearer ${API_TOKEN}`, Accept: "application/json" };

  const expRes = await fetch("https://api.cardtrader.com/api/v2/expansions", { headers });
  if (!expRes.ok) throw new Error("Impossibile recuperare espansioni da CardTrader");
  const allExpansions = await expRes.json();
  const mtgExpansions = allExpansions.filter(e => e.game_id === 1);

  console.log(`Trovate ${mtgExpansions.length} espansioni MTG totali in CardTrader.`);

  const sealedCatIds = [3, 4, 7, 47, 54]; // Box, Booster, Prerelease, Collector Box, Bundle
  let totalAdded = 0;
  let totalUpdated = 0;

  for (const exp of mtgExpansions) {
    try {
      const bpRes = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${exp.id}`, { headers });
      if (!bpRes.ok) continue;
      const blueprints = await bpRes.json();
      const sealedBlueprints = blueprints.filter(bp => sealedCatIds.includes(bp.category_id));

      if (sealedBlueprints.length === 0) continue;

      console.log(`📦 Set "${exp.name}" (${exp.id}): Trovati ${sealedBlueprints.length} prodotti sigillati.`);

      for (const bp of sealedBlueprints) {
        const docRef = db.collection("products").doc(bp.id.toString());
        const docSnap = await docRef.get();

        const slug = bp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const imgPath = bp.image?.preview?.url || bp.image?.url || "";

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

        if (!docSnap.exists) {
          const newProduct = {
            id: bp.id.toString(),
            nome: bp.name || bp.translated_name,
            prezzoAttuale: prezzoAttuale,
            url: `https://www.cardtrader.com/en/cards/${bp.id}-${slug}`,
            immagine: imgPath ? (imgPath.startsWith("http") ? imgPath : `https://www.cardtrader.com${imgPath}`) : null,
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
          console.log(`  + [NUOVO] ${newProduct.nome} (€${prezzoAttuale}) - Set: ${exp.name}`);
          totalAdded++;
        } else {
          // Se esiste già, assicuriamo che l'espansione ed il prezzo siano corretti
          const existing = docSnap.data();
          if (!existing.expansion || existing.expansion !== exp.name || existing.prezzoAttuale !== prezzoAttuale) {
            await docRef.update({
              expansion: exp.name,
              prezzoAttuale: prezzoAttuale > 0 ? prezzoAttuale : existing.prezzoAttuale,
              stock: stock
            });
            totalUpdated++;
          }
        }
      }
    } catch (e) {
      console.error(`Errore su ${exp.name}:`, e.message);
    }
  }

  console.log(`\n🎉 COMPLETATO SEEDING STORICO! Aggiunti ${totalAdded} nuovi prodotti, aggiornati ${totalUpdated}.`);
  process.exit(0);
}

seedHistoricalExpansions().catch(err => {
  console.error("Errore fatale seed storico:", err);
  process.exit(1);
});

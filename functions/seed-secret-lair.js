/**
 * Script per popolare e sincronizzare i prodotti sigillati Secret Lair da CardTrader in Firestore
 */
require('dotenv').config({ path: __dirname + '/.env' });
const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const token = process.env.CARDTRADER_API_TOKEN;

const SECRET_LAIR_EXPANSION_IDS = [
  990,  // Secret Lair Drop Series
  1658, // Secret Lair: Ultimate Edition
  2138, // Secret Lair: Ultimate Edition 2
  3168, // Secret Lair 30th Anniversary Countdown Kit
  3220, // Heads I Win, Tails You Lose
  3370, // From Cute to Brute
  3463, // Angels
  3603, // Raining Cats and Dogs
  3970, // 20 Ways to Win
  4169, // Everyone's Invited!
  4371, // Encyclopedia of Magic
  4640, // Goblin Storm
  4797  // Hatsune Miku
];

async function seedSecretLair() {
  console.log('🚀 Avvio estrazione drop sigillati Secret Lair da CardTrader...');
  const headers = { 'Authorization': `Bearer ${token}` };

  let totalImported = 0;

  for (const expId of SECRET_LAIR_EXPANSION_IDS) {
    try {
      console.log(`📦 Scaricamento blueprint per Expansion ID ${expId}...`);
      const res = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${expId}`, { headers });
      if (!res.ok) {
        console.warn(`⚠️ Impossibile scaricare expId ${expId}: ${res.status}`);
        continue;
      }
      const blueprints = await res.json();
      if (!Array.isArray(blueprints)) continue;

      // Filtra solo prodotti sigillati / box set / mazzi (esclude carte singole category_id === 1)
      const sealedDrops = blueprints.filter(b => {
        if (b.category_id === 1) return false;
        // In SLD 990, i drop sono in category_id 13 (Box Set) o hanno 'Secret Lair' nel nome
        const name = (b.name || '').toLowerCase();
        if (b.category_id === 13) return true;
        if (name.includes('secret lair') || name.includes('bundle') || name.includes('deck') || name.includes('kit') || name.includes('superdrop') || name.includes('drop series')) {
          return true;
        }
        return false;
      });

      console.log(`✨ Trovati ${sealedDrops.length} drop sigillati per expansion ${expId}`);

      let batch = db.batch();
      let countInBatch = 0;

      for (const drop of sealedDrops) {
        const docId = `ct_${drop.id}`;
        const docRef = db.collection('products').doc(docId);

        const isFoil = (drop.name || '').toLowerCase().includes('foil');
        const priceCents = drop.min_price_cents || drop.price_cents || 0;
        const priceEur = priceCents > 0 ? priceCents / 100 : null;

        const productData = {
          id: docId,
          cardTraderId: drop.id,
          nome: drop.name,
          expansion: 'Secret Lair Drop Series',
          url: `https://www.cardtrader.com/cards/${drop.id}`,
          immagine: drop.image_url || null,
          prezzoAttuale: priceEur,
          isSealed: true,
          isSecretLair: true,
          sezione: 'buy',
          foil: isFoil,
          dataInserimento: new Date().toISOString(),
          dataControllo: new Date().toISOString(),
          storico: priceEur ? [{
            data: new Date().toISOString().split('T')[0],
            prezzo: priceEur,
            timestamp: Date.now()
          }] : []
        };

        batch.set(docRef, productData, { merge: true });
        countInBatch++;
        totalImported++;

        if (countInBatch >= 400) {
          await batch.commit();
          console.log(`💾 Salvati ${countInBatch} drop in Firestore...`);
          countInBatch = 0;
          batch = db.batch();
        }
      }

      if (countInBatch > 0) {
        await batch.commit();
        console.log(`💾 Salvati ${countInBatch} drop in Firestore.`);
      }
    } catch (err) {
      console.error(`❌ Errore durante estrazione per expansion ${expId}:`, err);
    }
  }

  console.log(`🎉 Importazione completata! Totale drop Secret Lair nel database: ${totalImported}`);
  process.exit(0);
}

seedSecretLair();

/**
 * Comprehensive Secret Lair Database Seeder & Synchronizer
 * Downloads all sealed drops from CardTrader & Scryfall, enriches with MSRP, release dates, and high-res artwork.
 */
require('dotenv').config({ path: __dirname + '/.env' });
const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const token = process.env.CARDTRADER_API_TOKEN;

const EXP_IDS = [
  990, 1658, 2138, 3012, 3168, 3220, 3245, 3370, 3463, 3603,
  3970, 4169, 4323, 4371, 4569, 4640, 4797
];

const VALID_CATS = [4, 6, 7, 10, 13, 17, 23, 24];

function detectDropCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('commander') || n.includes('deck') || n.includes('heads i win') || n.includes('angels') || n.includes('cats') || n.includes('brute') || n.includes('goblin storm') || n.includes('20 ways to win') || n.includes("everyone's invited")) {
    return 'commander';
  }
  if (n.includes('countdown') || n.includes('encyclopedia') || n.includes('30th anniversary')) {
    return 'countdown';
  }
  if (n.includes('bundle') || n.includes('superdrop') || n.includes('festival in a box') || n.includes('all-in') || n.includes('foil bundle') || n.includes('non-foil bundle')) {
    return 'bundle';
  }
  if (n.includes('artist series') || n.includes('seb mckinnon') || n.includes('junji ito') || n.includes('johannes voss') || n.includes('mark poole') || n.includes('rebecca guay') || n.includes('john avon') || n.includes('rovina cai') || n.includes('nils hamm') || n.includes('magali villeneuve') || n.includes('alena aenami') || n.includes('lush') || n.includes('stephen bliss')) {
    return 'artist-series';
  }
  if (n.includes('marvel') || n.includes('deadpool') || n.includes('tomb raider') || n.includes('street fighter') || n.includes('warhammer') || n.includes('transformers') || n.includes('godzilla') || n.includes('monty python') || n.includes('ghostbusters') || n.includes('fallout') || n.includes('hatsune miku') || n.includes('fortnite') || n.includes('post malone') || n.includes('dungeons & dragons') || n.includes('d&d') || n.includes('doctor who') || n.includes('jurassic world') || n.includes('arcane') || n.includes('stranger things') || n.includes('walking dead')) {
    return 'universes-beyond';
  }
  if (n.includes('land') || n.includes('lands') || n.includes('pixel snow') || n.includes('space land') || n.includes('tokyo land') || n.includes('astrology') || n.includes('dracula') || n.includes('galaxy foil')) {
    return 'lands';
  }
  return 'standard-drop';
}

function calculateDropMSRP(name, category, isFoil) {
  const n = (name || '').toLowerCase();
  if (category === 'commander') {
    if (n.includes('heads i win')) return 99.99;
    return 149.99;
  }
  if (category === 'countdown') {
    return 149.99;
  }
  if (category === 'bundle') {
    if (n.includes('festival in a box')) return 249.99;
    if (n.includes('superdrop') || n.includes('all-in')) return 299.99;
    return 119.99;
  }
  // Standard drop MSRP
  if (isFoil || n.includes('foil') || n.includes('textured') || n.includes('galaxy') || n.includes('rainbow') || n.includes('halo')) {
    return 39.99;
  }
  return 29.99;
}

async function runSeed() {
  console.log('🚀 Avvio estrazione completa Secret Lair da CardTrader...');
  const headers = { 'Authorization': `Bearer ${token}` };

  let allBlueprints = [];

  for (const expId of EXP_IDS) {
    try {
      console.log(`📦 Scaricamento blueprints espansione ID ${expId}...`);
      const res = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${expId}`, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      const sealed = data.filter(b => {
        if (VALID_CATS.includes(b.category_id)) return true;
        const name = (b.name || '').toLowerCase();
        if (name.includes('drop') || name.includes('bundle') || name.includes('set') || name.includes('deck') || name.includes('kit') || name.includes('edition') || name.includes('box')) {
          if (b.category_id !== 1 && b.category_id !== 2 && b.category_id !== 12 && b.category_id !== 15 && b.category_id !== 16 && b.category_id !== 19 && b.category_id !== 20 && b.category_id !== 21 && b.category_id !== 22 && b.category_id !== 25 && b.category_id !== 26) {
            return true;
          }
        }
        return false;
      });

      console.log(`  ✓ Trovati ${sealed.length} drop sigillati.`);
      allBlueprints.push(...sealed);
    } catch (e) {
      console.error(`Errore exp ${expId}:`, e.message);
    }
  }

  console.log(`\n✨ Totale drop sigillati estratti da CardTrader: ${allBlueprints.length}`);

  // Scrittura batch su Firestore
  let batch = db.batch();
  let countInBatch = 0;
  let totalSaved = 0;

  for (const bp of allBlueprints) {
    const docId = `ct_${bp.id}`;
    const docRef = db.collection('products').doc(docId);

    const isFoil = (bp.name || '').toLowerCase().includes('foil');
    const category = detectDropCategory(bp.name);
    const msrp = calculateDropMSRP(bp.name, category, isFoil);
    const priceCents = bp.min_price_cents || bp.price_cents || 0;
    const priceEur = priceCents > 0 ? priceCents / 100 : null;

    // AI Verdict Logic
    let aiVerdict = 'ASPETTA';
    let aiReason = 'Prezzo allineato al mercato secondario.';
    if (priceEur) {
      if (priceEur <= msrp * 1.1) {
        aiVerdict = 'COMPRA';
        aiReason = `Prezzo di listino o sotto-soglia MSRP (€${msrp.toFixed(2)}). Ottima occasione!`;
      } else if (priceEur > msrp * 2.5) {
        aiVerdict = 'SOVRAPPREZZO';
        aiReason = `Forte sovrapprezzo da bagarini (+${Math.round((priceEur/msrp - 1)*100)}% sopra MSRP).`;
      }
    }

    const item = {
      id: docId,
      cardTraderId: bp.id,
      nome: bp.name,
      expansion: 'Secret Lair',
      url: `https://www.cardtrader.com/cards/${bp.id}`,
      immagine: bp.image_url || null,
      prezzoAttuale: priceEur,
      isSealed: true,
      isSecretLair: true,
      sezione: 'buy',
      foil: isFoil,
      dropType: category,
      msrp: msrp,
      ai_verdict: aiVerdict,
      ai_reason: aiReason,
      dataInserimento: new Date().toISOString(),
      dataControllo: new Date().toISOString(),
      storico: priceEur ? [{
        data: new Date().toISOString().split('T')[0],
        prezzo: priceEur,
        timestamp: Date.now()
      }] : []
    };

    batch.set(docRef, item, { merge: true });
    countInBatch++;
    totalSaved++;

    if (countInBatch >= 350) {
      await batch.commit();
      console.log(`💾 Salvati ${totalSaved}/${allBlueprints.length} drop su Firestore...`);
      batch = db.batch();
      countInBatch = 0;
    }
  }

  if (countInBatch > 0) {
    await batch.commit();
  }

  console.log(`🎉 SUCCESSO! Salvati complessivamente ${totalSaved} drop Secret Lair su Firestore.`);
}

runSeed().then(() => process.exit(0)).catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});

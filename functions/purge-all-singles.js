require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore("default");

async function purgeAllSingles() {
  console.log("🧹 Avvio pulizia radicale di TUTTE le carte singole e promo da Firestore...");

  const snapshot = await db.collection("products").get();
  console.log(`Trovati ${snapshot.size} prodotti totali nel database...`);

  const sealedKeywords = [
    "booster", "box", "pack", "deck", "bundle", "fat pack", "kit", "display", 
    "prerelease", "pre-release", "collector", "starter", "collection", 
    "intro", "challenger", "clash", "event", "gift", "scene", "set", "edition"
  ];

  let deleted = 0;

  for (const docSnap of snapshot.docs) {
    const p = docSnap.data();
    const name = (p.nome || "").toLowerCase();
    const exp = (p.expansion || "").toLowerCase();

    const isDoubleFaced = name.includes("//");
    const hasSealedKw = sealedKeywords.some(kw => name.includes(kw));

    // Se non contiene nessuna parola da prodotto sigillato (es. Booster, Box, Deck, Pack, Bundle, Prerelease, Kit, Scene, ecc.)
    // O se contiene "//"
    if (isDoubleFaced || !hasSealedKw) {
      console.log(`❌ ELIMINATO: "${p.nome}" (€${p.prezzoAttuale || '0'}) - Set: ${p.expansion}`);
      await docSnap.ref.delete();
      deleted++;
    }
  }

  console.log(`\n🎉 RISULTATO: Eliminati ${deleted} prodotti non sigillati/carte singole dal database Firestore!`);
  process.exit(0);
}

purgeAllSingles().catch(err => {
  console.error("Errore pulizia radicale:", err);
  process.exit(1);
});

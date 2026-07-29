require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore("default");

async function purgeSinglesAndInvalidProducts() {
  console.log("🧹 Avvio pulizia carte singole e prodotti non sigillati da Firestore...");

  const snapshot = await db.collection("products").get();
  console.log(`Analisi di ${snapshot.size} prodotti totali nel database...`);

  const sealedKeywords = [
    "booster", "box", "pack", "deck", "bundle", "fat pack", "kit", "display", 
    "prerelease", "pre-release", "collector", "commander", "starter", "collection", 
    "intro", "challenger", "clash", "event", "gift", "scene"
  ];

  // Parole chiave che indicano carte singole/oversized
  const singleCardKeywords = [
    "zedruu", "vorosh", "teneb", "tariel", "saheeli", "lord windgrace", "estrid", "aminatou", 
    "the ur-dragon", "inalla", "edgar markov", "arahbo", "oversized", "promo card", "singola"
  ];

  let deletedCount = 0;

  for (const docSnap of snapshot.docs) {
    const p = docSnap.data();
    const name = (p.nome || "").toLowerCase();
    const exp = (p.expansion || "").toLowerCase();

    // Verifico se e' una carta singola o non contiene parole da prodotto sigillato
    const isSingleByName = singleCardKeywords.some(kw => name.includes(kw));
    const hasSealedKeyword = sealedKeywords.some(kw => name.includes(kw) || exp.includes(kw));

    // Se il nome della carta e' palesemente una carta singola (es: "Zedruu the Greathearted") senza parole come "Deck" o "Box"
    const isExplicitSingle = isSingleByName && !name.includes("deck") && !name.includes("box");
    const isMissingSealedKeyword = !hasSealedKeyword && (p.prezzoAttuale < 5.00 || exp === "commander");

    if (isExplicitSingle || isMissingSealedKeyword) {
      console.log(`❌ Eliminazione non-sigillato/singola: "${p.nome}" (€${p.prezzoAttuale}) - Set: ${p.expansion}`);
      await docSnap.ref.delete();
      deletedCount++;
    }
  }

  console.log(`\n🎉 PULIZIA COMPLETATA! Eliminati ${deletedCount} prodotti non sigillati/carte singole.`);
  process.exit(0);
}

purgeSinglesAndInvalidProducts().catch(err => {
  console.error("Errore pulizia:", err);
  process.exit(1);
});

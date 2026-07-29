require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore("default");

// Regex rigorosa per rilevare i veri contenitori sigillati (usando Word Boundaries \b per evitare falso-positivi come "Toolbox")
const SEALED_PRODUCT_REGEX = /\b(box|boxes|booster|boosters|pack|packs|deck|decks|bundle|bundles|display|displays|prerelease|pre-release|fat pack|starter kit|scene box|challenger|intro pack)\b/i;

async function purgeStrictSingles() {
  console.log("🧹 Avvio pulizia RIGOROSA ed ASSOLUTA di tutte le carte singole da Firestore...");

  const snapshot = await db.collection("products").get();
  console.log(`Trovati ${snapshot.size} prodotti totali nel database...`);

  let deleted = 0;

  for (const docSnap of snapshot.docs) {
    const p = docSnap.data();
    const name = (p.nome || "").trim();

    const isSealed = SEALED_PRODUCT_REGEX.test(name) && !name.includes("//");

    if (!isSealed) {
      console.log(`❌ ELIMINATO: "${p.nome}" (€${p.prezzoAttuale || '0'}) - Set: ${p.expansion || 'N/D'}`);
      await docSnap.ref.delete();
      deleted++;
    }
  }

  console.log(`\n🎉 COMPLETATO! Eliminati ${deleted} prodotti non sigillati/carte singole dal database Firestore.`);
  process.exit(0);
}

purgeStrictSingles().catch(err => {
  console.error("Errore pulizia rigorosa:", err);
  process.exit(1);
});

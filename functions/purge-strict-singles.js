require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore("default");

// Regex iper-rigorosa per prodotti sigillati MTG (impedisce a carte come "A Display of My Dark Power" di essere scambiate per un box/display sigillato)
const SEALED_PRODUCT_REGEX = /\b(booster|boosters|collector box|collector booster|collector display|play box|play booster|play display|draft box|draft booster|draft display|booster box|booster pack|booster display|prerelease|pre-release|fat pack|bundle|bundles|starter kit|starter deck|scene box|challenger deck|intro pack|tournament pack|display box|display of \d+|theme booster|deck builder's toolkit|starter set|starter box)\b/i;

async function purgeStrictSingles() {
  console.log("🧹 Avvio eliminazione di 'A Display of My Dark Power' e di qualsiasi altra carta promo/singola residua...");

  const snapshot = await db.collection("products").get();
  console.log(`Trovati ${snapshot.size} prodotti totali nel database...`);

  let deleted = 0;

  for (const docSnap of snapshot.docs) {
    const p = docSnap.data();
    const name = (p.nome || "").trim();

    const isSealed = SEALED_PRODUCT_REGEX.test(name) && !name.includes("//");

    if (!isSealed) {
      console.log(`❌ ELIMINATO: [${docSnap.id}] "${p.nome}" (€${p.prezzoAttuale || '0'}) - Set: ${p.expansion || 'N/D'}`);
      await docSnap.ref.delete();
      deleted++;
    }
  }

  console.log(`\n🎉 COMPLETATO! Eliminati ${deleted} prodotti non sigillati dal database Firestore.`);
  process.exit(0);
}

purgeStrictSingles().catch(err => {
  console.error("Errore pulizia rigorosa:", err);
  process.exit(1);
});

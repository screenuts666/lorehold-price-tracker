const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore("default");

async function purgeSinglesAndOldSets() {
  console.log("🧹 Pulizia carte singole e vecchi set (es. Commander Strixhaven del 2021)...");
  const snapshot = await db.collection("products").get();

  let deletedCount = 0;
  for (const docSnap of snapshot.docs) {
    const p = docSnap.data();
    const name = (p.nome || '').toLowerCase();
    const exp = (p.expansion || '').toLowerCase();

    // 1. Rimuovi carte singole (es. Adrix and Nev, Osgir, Breena, Zaffai, Willowdusk)
    const isSingleCard = !name.includes("box") && 
                         !name.includes("pack") && 
                         !name.includes("bundle") && 
                         !name.includes("deck") && 
                         !name.includes("display") && 
                         !name.includes("prerelease") && 
                         !name.includes("scene") && 
                         !name.includes("booster") && 
                         p.prezzoAttuale < 5.0;

    // 2. Rimuovi vecchi set del 2021 come "Commander: Strixhaven" o "Strixhaven: School of Mages" (vecchi)
    const isOldSet = exp.includes("commander: strixhaven") || (exp.includes("strixhaven") && !exp.includes("secrets of strixhaven"));

    if (isSingleCard || isOldSet) {
      console.log(`❌ Eliminazione: ${p.nome} (${exp}) - Prezzo: €${p.prezzoAttuale}`);
      await docSnap.ref.delete();
      deletedCount++;
    }
  }

  console.log(`\n✅ Pulizia completata! Eliminati ${deletedCount} elementi errati/singole.`);
  process.exit(0);
}

purgeSinglesAndOldSets().catch(err => {
  console.error("Errore pulizia:", err);
  process.exit(1);
});

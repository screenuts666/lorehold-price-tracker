const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

admin.initializeApp();
const db = getFirestore("default");

async function deleteFoundations() {
  console.log("Ricerca prodotti Foundations da eliminare...");
  const snapshot = await db.collection("products").get();
  
  let deletedCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = (data.nome || '').toLowerCase();
    const exp = (data.expansion || '').toLowerCase();
    
    if (name.includes("foundations") || exp.includes("foundations")) {
      console.log(`Elimino: ${data.nome} (${doc.id})`);
      await doc.ref.delete();
      deletedCount++;
    }
  }
  
  console.log(`✅ Eliminati ${deletedCount} prodotti Foundations da Firestore!`);
  process.exit(0);
}

deleteFoundations().catch(err => {
  console.error("Errore:", err);
  process.exit(1);
});

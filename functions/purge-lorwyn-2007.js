const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore("default");

async function purgeLorwyn2007() {
  console.log("Eliminazione set Lorwyn 2007...");
  const snapshot = await db.collection("products").get();
  let count = 0;
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.expansion === "Lorwyn" || (data.nome && data.nome.startsWith("Lorwyn ") && !data.nome.includes("Eclipsed"))) {
      console.log(`Elimino: ${data.nome} (€${data.prezzoAttuale})`);
      await docSnap.ref.delete();
      count++;
    }
  }
  console.log(`✅ Eliminati ${count} prodotti di Lorwyn 2007!`);
  process.exit(0);
}

purgeLorwyn2007().catch(err => {
  console.error("Errore:", err);
  process.exit(1);
});

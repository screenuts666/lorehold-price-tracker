require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore("default");

async function checkRemainingProducts() {
  const snapshot = await db.collection("products").get();
  console.log(`=== CONTROLLO PRODOTTI IN FIRESTORE (${snapshot.size} totali) ===`);

  snapshot.docs.forEach(docSnap => {
    const p = docSnap.data();
    console.log(`[${docSnap.id}] "${p.nome}" (€${p.prezzoAttuale || '0'}) - Set: ${p.expansion}`);
  });
  process.exit(0);
}

checkRemainingProducts().catch(err => {
  console.error(err);
  process.exit(1);
});

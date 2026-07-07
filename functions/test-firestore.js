const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore("default");

async function test() {
  console.log("Provando a scrivere un singolo documento in Firestore...");
  const docRef = db.collection("test_migration").doc("test_doc");
  await docRef.set({
    test: true,
    timestamp: new Date()
  });
  console.log("Scrittura completata!");
  const docSnap = await docRef.get();
  console.log("Documento letto con successo:", docSnap.data());
}

test().catch(err => {
  console.error("Errore:", err);
});

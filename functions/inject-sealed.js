const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "service-account.json");
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore("default");

async function injectSealedProduct() {
  console.log("Inserimento Foundations: Play Booster Box (ID 295754) in Firestore...");
  
  const product = {
    id: "295754",
    nome: "Foundations: Play Booster Box",
    prezzoAttuale: 125.53,
    url: "https://www.cardtrader.com/en/cards/295754-foundations-play-booster-box",
    immagine: "https://api.cardtrader.com/uploads/blueprints/image/295754/preview_store-championship-2022-participant-booster-championship-2022.jpg",
    dataInserimento: new Date().toLocaleDateString(),
    intento: "buy",
    foil: null,
    lingua: null,
    condizione: null,
    expansion: "Foundations",
    stock: 30,
    sellerCountry: "CH",
    sellerType: "pro",
    avgTop5: 128.20,
    storico: [
      {
        data: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
        prezzo: 129.50
      },
      {
        data: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
        prezzo: 127.00
      },
      {
        data: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
        prezzo: 126.10
      },
      {
        data: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        prezzo: 125.53
      }
    ]
  };

  const docRef = db.collection("products").doc(product.id);
  await docRef.set(product);
  console.log("✅ Inserimento completato con successo!");
}

injectSealedProduct().then(() => process.exit(0)).catch(err => {
  console.error("Errore:", err);
  process.exit(1);
});

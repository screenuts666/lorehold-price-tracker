const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

// Carica la chiave del service account
const serviceAccountPath = path.join(__dirname, "service-account.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("\n❌ ERRORE: Non è stato trovato il file 'service-account.json' nella cartella 'functions/'.");
  console.log("Per ottenerlo:");
  console.log("1. Vai nella Console di Firebase -> Impostazioni Progetto -> Account di Servizio.");
  console.log("2. Clicca su 'Genera nuova chiave privata'.");
  console.log("3. Salva il file scaricato come 'service-account.json' all'interno della cartella 'functions/'.");
  console.log("4. Riavvia questo script.\n");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore("default");

// Percorso del backup locale
const backupFilePath = path.join(__dirname, "../data_backup.json");
if (!fs.existsSync(backupFilePath)) {
  console.error(`\n❌ ERRORE: File data_backup.json non trovato in ${path.resolve(backupFilePath)}`);
  process.exit(1);
}

const rawData = fs.readFileSync(backupFilePath, "utf8");
const products = JSON.parse(rawData);

async function migrate() {
  console.log(`Trovati ${products.length} prodotti da migrare.`);
  
  // Utilizziamo un batch per ottimizzare le scritture
  const batch = db.batch();
  
  for (const product of products) {
    if (!product.id) continue;
    const docRef = db.collection("products").doc(product.id.toString());
    batch.set(docRef, product);
    console.log(`Aggiunto al batch: ${product.nome} (ID: ${product.id})`);
  }
  
  console.log("Salvataggio su Firestore in corso...");
  await batch.commit();
  console.log("✅ Migrazione completata con successo!");
}

migrate().catch(err => {
  console.error("❌ Errore durante la migrazione:", err);
});

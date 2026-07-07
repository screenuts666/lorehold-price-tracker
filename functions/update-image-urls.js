const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "service-account.json");
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore("default");

async function fixImageUrls() {
  const productsSnapshot = await db.collection("products").get();
  let count = 0;
  
  for (const doc of productsSnapshot.docs) {
    const data = doc.data();
    if (data.immagine && data.immagine.includes("sg.cardtrader.com")) {
      const newUrl = data.immagine.replace("sg.cardtrader.com", "www.cardtrader.com");
      await doc.ref.update({ immagine: newUrl });
      console.log(`Updated ID ${doc.id}`);
      count++;
    }
  }
  
  console.log(`Finished updating ${count} products.`);
}

fixImageUrls().then(() => process.exit(0)).catch(console.error);

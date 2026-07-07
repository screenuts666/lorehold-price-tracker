const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "service-account.json");
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = getFirestore("default");

async function syncHistory() {
  const productsSnapshot = await db.collection("products").get();
  
  for (const doc of productsSnapshot.docs) {
    const data = doc.data();
    if (!data.url) continue;
    
    console.log(`Scraping history for: ${data.nome} (${data.url})`);
    
    try {
      const response = await fetch(data.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
          "Accept": "text/html"
        }
      });
      
      const html = await response.text();
      const regexMarket = /&quot;ct_market&quot;:(\[\[.*?\]\])/s;
      const regexLow = /&quot;ct_low&quot;:(\[\[.*?\]\])/s;
      
      const matchMarket = html.match(regexMarket);
      const matchLow = html.match(regexLow);
      
      let updateData = {};
      
      if (matchMarket && matchMarket[1]) {
        const dataStr = matchMarket[1].replace(/&quot;/g, '"');
        const ctMarket = JSON.parse(dataStr);
        updateData.ctHistory = ctMarket.map(point => ({ t: point[0], p: point[1] }));
      }
      
      if (matchLow && matchLow[1]) {
        const dataStr = matchLow[1].replace(/&quot;/g, '"');
        const ctLow = JSON.parse(dataStr);
        updateData.ctHistoryLow = ctLow.map(point => ({ t: point[0], p: point[1] }));
      }
      
      if (Object.keys(updateData).length > 0) {
        await doc.ref.update(updateData);
        console.log(`✅ Saved history for ${data.nome} (Market: ${updateData.ctHistory?.length || 0}, Low: ${updateData.ctHistoryLow?.length || 0})`);
      } else {
        console.log(`❌ Could not find graph data for ${data.nome}`);
      }
      
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (e) {
      console.error(`Error processing ${data.nome}:`, e.message);
    }
  }
  
  console.log("Finished syncing CardTrader history!");
}

syncHistory().then(() => process.exit(0)).catch(console.error);

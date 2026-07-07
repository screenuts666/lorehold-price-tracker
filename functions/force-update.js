// Script per forzare l'aggiornamento dei due prodotti (Foundations Play Booster Box e Reality Fracture) su Firestore
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "service-account.json");
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore("default");
const API_TOKEN = process.env.CARDTRADER_API_TOKEN || "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJjYXJkdHJhZGVyLXByb2R1Y3Rpb24iLCJzdWIiOiJhcHA6MTA0NjUiLCJhdWQiOiJhcHA6MTA0NjUiLCJleHAiOjQ5MzkwNjE5MDQsImp0aSI6IjA2MWY1MTNkLTdiZjQtNDExMi1iOThhLWY1MzdmMWM2YzQzNyIsImlhdCI6MTc4MzM4NDcwNCwibmFtZSI6IkdpcmFkaXNjaGk2NjYgQXBwIDIwMjQwNTI3MTU0NjMwIn0.q7FOsIKwIUwFino1wNpKRV-ItPDS8VKIvpXAMYFdOkiACfEuqMdMZqjQjNm1G80wC6opDswWghxMf-qCzxp86cWYFR1z1Sr6UHSGvp5s6Ih6VYFRs_1g9VtATW9J77YCfzoyMJ91tG-MHX5jXqtkCiNss4c_KjB5imQ4gs4jOvP79K8JpmnW40zhZEvY-PdjXdmyhhLfDK5EKZt5mr6rkDmUlTGQDBSyhFmIz4FlOifevMlQvJbheJKj87Cq80nkbjbfQsvWPgDhHDbtQYD0DTZJya-FtoiFQ65RkSidVkDUJ-O67fCfLp3-X4zW_zzi4wF96CkKKJZVGoCCBRuotQ";

const headers = {
  "Authorization": `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json"
};

async function forceUpdateProducts() {
  const ids = ["295754", "389397"];
  
  for (const id of ids) {
    console.log(`Aggiornamento dati per il prodotto ID: ${id}...`);
    try {
      const bpRes = await fetch(`https://api.cardtrader.com/api/v2/blueprints/${id}`, { headers });
      const mkRes = await fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${id}`, { headers });
      
      if (!bpRes.ok) {
        console.error(`Blueprint non trovato per ID ${id}`);
        continue;
      }
      
      const bpData = await bpRes.json();
      const mkData = await mkRes.json();
      
      let arrayOfferte = [];
      if (Array.isArray(mkData)) {
        arrayOfferte = mkData;
      } else if (mkData && typeof mkData === "object") {
        const keys = Object.keys(mkData);
        if (keys.length > 0 && Array.isArray(mkData[keys[0]])) {
          arrayOfferte = mkData[keys[0]];
        } else {
          arrayOfferte = Object.values(mkData);
        }
      }
      
      const offerteValide = arrayOfferte.filter(item => item && (item.price || item.price_cents));
      
      let prezzoPiuBasso = null;
      let stock = 0;
      let sellerCountry = null;
      let sellerType = null;
      let avgTop5 = null;
      
      if (offerteValide.length > 0) {
        offerteValide.sort((a, b) => {
          const valA = a.price ? a.price.cents : a.price_cents;
          const valB = b.price ? b.price.cents : b.price_cents;
          return valA - valB;
        });
        
        const min = offerteValide[0];
        prezzoPiuBasso = (min.price ? min.price.cents : min.price_cents) / 100;
        stock = offerteValide.reduce((acc, item) => acc + (item.quantity || 1), 0);
        sellerCountry = min.user ? min.user.country_code : null;
        sellerType = min.user ? min.user.user_type : null;
        
        const top5 = offerteValide.slice(0, 5);
        const sumTop5 = top5.reduce((acc, item) => {
          const val = item.price ? item.price.cents : item.price_cents;
          return acc + (val / 100);
        }, 0);
        avgTop5 = top5.length > 0 ? Number((sumTop5 / top5.length).toFixed(2)) : prezzoPiuBasso;
      }
      
      let immagineUrl = null;
      if (bpData.image) {
        const imgPath = bpData.image.preview?.url || bpData.image.url;
        if (imgPath) {
          immagineUrl = imgPath.startsWith("http") ? imgPath : `https://www.cardtrader.com${imgPath}`;
        }
      }
      
      const docRef = db.collection("products").doc(id);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        const currentData = docSnap.data();
        const storico = currentData.storico || [];
        const todayDate = new Date().toLocaleDateString();
        
        if (prezzoPiuBasso !== null) {
          const existingPoint = storico.find(s => s.data === todayDate);
          if (existingPoint) {
            existingPoint.prezzo = prezzoPiuBasso;
            existingPoint.timestamp = Date.now();
          } else {
            storico.push({
              data: todayDate,
              timestamp: Date.now(),
              prezzo: prezzoPiuBasso
            });
          }
        }
        
        await docRef.update({
          nome: bpData.name || bpData.translated_name,
          prezzoAttuale: prezzoPiuBasso,
          immagine: immagineUrl,
          stock: stock,
          sellerCountry: sellerCountry,
          sellerType: sellerType,
          avgTop5: avgTop5,
          storico: storico
        });
        
        console.log(`✅ ID ${id} aggiornato correttamente.`);
      } else {
        console.log(`Il documento ID ${id} non esiste su Firestore.`);
      }
      
    } catch (err) {
      console.error(`Errore durante l'aggiornamento dell'ID ${id}:`, err.message);
    }
  }
}

forceUpdateProducts().then(() => process.exit(0));

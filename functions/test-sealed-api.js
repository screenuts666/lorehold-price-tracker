// Test specifico per prodotti sigillati MTG su CardTrader
const API_TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJjYXJkdHJhZGVyLXByb2R1Y3Rpb24iLCJzdWIiOiJhcHA6MTA0NjUiLCJhdWQiOiJhcHA6MTA0NjUiLCJleHAiOjQ5MzkwNjE5MDQsImp0aSI6IjA2MWY1MTNkLTdiZjQtNDExMi1iOThhLWY1MzdmMWM2YzQzNyIsImlhdCI6MTc4MzM4NDcwNCwibmFtZSI6IkdpcmFkaXNjaGk2NjYgQXBwIDIwMjQwNTI3MTU0NjMwIn0.q7FOsIKwIUwFino1wNpKRV-ItPDS8VKIvpXAMYFdOkiACfEuqMdMZqjQjNm1G80wC6opDswWghxMf-qCzxp86cWYFR1z1Sr6UHSGvp5s6Ih6VYFRs_1g9VtATW9J77YCfzoyMJ91tG-MHX5jXqtkCiNss4c_KjB5imQ4gs4jOvP79K8JpmnW40zhZEvY-PdjXdmyhhLfDK5EKZt5mr6rkDmUlTGQDBSyhFmIz4FlOifevMlQvJbheJKj87Cq80nkbjbfQsvWPgDhHDbtQYD0DTZJya-FtoiFQ65RkSidVkDUJ-O67fCfLp3-X4zW_zzi4wF96CkKKJZVGoCCBRuotQ";

const headers = {
  "Authorization": `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json"
};

// Categorie MTG sealed (game_id = 1):
// ID: 3 = Booster Boxes
// ID: 4 = Boosters  
// ID: 7 = Prerelease Boxes
// ID: 47 = Collector Booster Boxes
// ID: 54 = Bundles and Fat Packs

async function testMTGSealed() {
  // Usiamo un'espansione MTG - Foundations (cerchiamo l'id MTG corretto)
  console.log("=== Cerco espansioni MTG per trovare quella giusta ===\n");
  
  try {
    const expRes = await fetch("https://api.cardtrader.com/api/v2/expansions", { headers });
    const expansions = await expRes.json();
    const mtgExp = expansions.filter(e => e.game_id === 1 && e.name?.toLowerCase().includes('foundations'));
    console.log("Espansioni MTG 'Foundations':");
    mtgExp.forEach(e => console.log(`  ID: ${e.id} | Name: ${e.name} | Game ID: ${e.game_id}`));
    
    // Prendiamo la prima espansione trovata o usiamo un ID noto
    const expId = mtgExp.length > 0 ? mtgExp[0].id : 3106; // fallback
    
    console.log(`\n=== Blueprint per espansione ${expId} - solo sealed (category != 1) ===\n`);
    
    const bpRes = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${expId}`, { headers });
    const blueprints = await bpRes.json();
    
    // Filtra per categorie sealed MTG (3, 4, 7, 47, 54, etc.)
    const sealedCatIds = [3, 4, 5, 6, 7, 8, 9, 10, 47, 48, 54, 271];
    const sealedBPs = blueprints.filter(bp => sealedCatIds.includes(bp.category_id));
    
    console.log(`Blueprint sealed MTG trovati: ${sealedBPs.length}`);
    sealedBPs.forEach(bp => {
      console.log(`  ID: ${bp.id} | Category: ${bp.category_id} | Name: ${bp.name}`);
    });
    
    // Se non troviamo sealed con quelle categorie, mostra tutti non-single
    if (sealedBPs.length === 0) {
      const nonSingles = blueprints.filter(bp => bp.category_id !== 1);
      console.log(`\nNessun sealed trovato con quelle categorie. Blueprint non-single (${nonSingles.length}):`);
      nonSingles.forEach(bp => {
        console.log(`  ID: ${bp.id} | Category: ${bp.category_id} | Name: ${bp.name}`);
      });
    }
    
    // Prova marketplace per il primo sealed
    const targetBP = sealedBPs.length > 0 ? sealedBPs[0] : null;
    if (targetBP) {
      console.log(`\n=== Marketplace products per: ${targetBP.name} (BP: ${targetBP.id}) ===\n`);
      
      const mkRes = await fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${targetBP.id}`, { headers });
      const mkData = await mkRes.json();
      
      if (Array.isArray(mkData) && mkData.length > 0) {
        console.log(`Offerte trovate: ${mkData.length}`);
        console.log("Primo prodotto:", JSON.stringify(mkData[0], null, 2));
      } else if (typeof mkData === 'object') {
        console.log("Risposta marketplace:", JSON.stringify(mkData, null, 2).substring(0, 1000));
      }
    }
    
  } catch (err) {
    console.error("Errore:", err.message);
  }

  // Test extra: provo endpoint specifici che potrebbero contenere storico
  console.log("\n\n=== TEST: Endpoint aggiuntivi per storico ===\n");
  
  const extraEndpoints = [
    "/api/v2/marketplace/products/statistics",
    "/api/v2/statistics",
    "/api/v2/market_data",
    "/api/v2/blueprints/292456/price_trend",
    "/api/v2/blueprints/292456/market_price",
  ];
  
  for (const endpoint of extraEndpoints) {
    try {
      const res = await fetch(`https://api.cardtrader.com${endpoint}`, { headers });
      const status = res.status;
      let body = await res.text();
      console.log(`  ${endpoint} => ${status} | ${body.substring(0, 200)}`);
    } catch (err) {
      console.log(`  ${endpoint} => ERROR: ${err.message}`);
    }
  }
}

testMTGSealed();

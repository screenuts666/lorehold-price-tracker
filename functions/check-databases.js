const { google } = require("googleapis");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key
  },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});

async function main() {
  const client = await auth.getClient();
  const projectId = serviceAccount.project_id;
  console.log("Interrogando le API di Firestore per il progetto:", projectId);
  
  const res = await client.request({
    url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases`
  });
  
  console.log("Risposta API Firestore (Databases):");
  console.log(JSON.stringify(res.data, null, 2));
}

main().catch(err => {
  console.error("Errore:", err.message);
  if (err.response && err.response.data) {
    console.error("Dettagli errore API:", JSON.stringify(err.response.data, null, 2));
  }
});

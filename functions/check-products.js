require("dotenv").config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "service-account.json"));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore("default");

function detectCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('collector booster box') || n.includes('collector box') || n.includes('collector display')) return { key: 'collector-box', nameType: 'Collector Box' };
  if (n.includes('play booster box') || n.includes('play box') || n.includes('booster box') || n.includes('booster display') || n.includes('draft box')) return { key: 'play-box', nameType: 'Box Normali / Play Box' };
  if (n.includes('prerelease pack') || n.includes('prerelease')) return { key: 'prerelease', nameType: 'Prerelease Pack' };
  if (n.includes('fat pack') || n.includes('bundle') || n.includes('gift edition')) return { key: 'bundle', nameType: 'Fat Pack / Bundle' };
  if (n.includes('draft night')) return { key: 'draft-night', nameType: 'Draft Night Kit' };
  if (n.includes('scene box') || n.includes('scene')) return { key: 'scene-box', nameType: 'Scene Box' };
  if (n.includes('commander deck') || n.includes('commander display') || (n.includes('commander') && (n.includes('deck') || n.includes('box') || n.includes('pack')))) return { key: 'commander-deck', nameType: 'Commander Deck' };
  if (n.includes('starter') || n.includes('challenger') || n.includes('pioneer') || n.includes('intro pack') || n.includes('deck')) return { key: 'starter-deck', nameType: 'Starter / Other Deck' };
  return { key: 'other', nameType: 'Altro Sigillato' };
}

async function testFilter() {
  const snap = await db.collection("products").get();
  const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const selectedExpansionForDetail = 'The Hobbit';
  const targetNorm = (selectedExpansionForDetail || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  console.log('--- ALL PRODUCTS IN FIRESTORE FOR HOBBIT ---');
  let list = allProducts.filter(p => p.expansion && (
    p.expansion.toLowerCase() === selectedExpansionForDetail.toLowerCase() ||
    p.expansion.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm
  ));
  console.log('Step 1 (by expansion):', list.length);
  list.forEach(p => console.log('  -', p.nome, '| intento:', p.intento, '| exp:', p.expansion));

  // Check filters:
  const includeCollectorBoxes = true;
  const includePlayBoxes = true;
  const includePrereleasePacks = true;
  const includeBundles = true;
  const includeDraftNight = true;
  const includeSceneBoxes = false;
  const includeCommanderDecks = false;
  const includeStarterDecks = false;

  let filtered = [...list];
  if (!includeCollectorBoxes) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'collector-box');
  if (!includePlayBoxes) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'play-box');
  if (!includePrereleasePacks) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'prerelease');
  if (!includeBundles) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'bundle');
  if (!includeDraftNight) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'draft-night');
  if (!includeSceneBoxes) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'scene-box');
  if (!includeCommanderDecks) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'commander-deck');
  if (!includeStarterDecks) filtered = filtered.filter(p => detectCategory(p.nome).key !== 'starter-deck');

  console.log('Step 2 (after category toggles):', filtered.length);
  filtered.forEach(p => console.log('  -', p.nome, '| cat:', detectCategory(p.nome).key));

  process.exit(0);
}

testFilter().catch(err => {
  console.error(err);
  process.exit(1);
});

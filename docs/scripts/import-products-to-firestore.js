#!/usr/bin/env node
/**
 * import-products-to-firestore.js
 * --------------------------------
 * Small utility to import product JSON into a Firestore collection.
 *
 * Usage:
 *  node import-products-to-firestore.js --file data/products.json --collection products --dry-run
 *  node import-products-to-firestore.js --file data/products.json --collection products --serviceAccount ./sa.json
 *
 * Notes:
 * - Uses GOOGLE_APPLICATION_CREDENTIALS env var or --serviceAccount to authenticate.
 * - By default writes to 'products' collection. Use --collection to change.
 * - --dry-run will show a summary without writing.
 * - Documents will be written with the source product `id` as the document ID.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Minimal arg parsing
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.replace(/^--/, '');
  const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  args[key] = val;
}

const SERVICE_ACCOUNT = args.serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
const IN_FILE = args.file || 'data/products.json';
const COLLECTION = args.collection || 'products';
const DRY_RUN = !!args['dry-run'] || !!args.dryRun;
const BATCH_SIZE = parseInt(args['batch-size'] || '500', 10) || 500;

async function initFirebase(){
  if (SERVICE_ACCOUNT && fs.existsSync(SERVICE_ACCOUNT)){
    const sa = require(path.resolve(SERVICE_ACCOUNT));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    // tries ADC (GOOGLE_APPLICATION_CREDENTIALS) or environment
    admin.initializeApp();
  }
  return admin.firestore();
}

function normalizeProductForWrite(p){
  // Ensure required fields are present
  const out = Object.assign({}, p);
  if (!out.id) throw new Error('Missing id for product');
  // Convert any ISO timestamps to Firestore Timestamps if needed (optional)
  return out;
}

async function run(){
  console.log('Reading', IN_FILE);
  if (!fs.existsSync(IN_FILE)){
    console.error('Input file not found:', IN_FILE);
    process.exit(1);
  }

  const raw = await fs.promises.readFile(IN_FILE, 'utf8');
  let products;
  try{ products = JSON.parse(raw); }catch(e){ console.error('Could not parse JSON:', e.message||e); process.exit(1); }
  if (!Array.isArray(products)) { console.error('Expected an array of products in the JSON file'); process.exit(1); }

  console.log(`Found ${products.length} products in ${IN_FILE}`);
  if (DRY_RUN) { console.log('Dry run mode — no writes will be performed'); }

  const db = await initFirebase();
  const colRef = db.collection(COLLECTION);

  // Batch writes (500 per batch)
  let batch = db.batch();
  let count = 0;
  let written = 0;

  for (let i = 0; i < products.length; i++){
    const p = products[i];
    try{
      const norm = normalizeProductForWrite(p);
      const docRef = colRef.doc(String(norm.id));
      batch.set(docRef, norm, { merge: true });
      count++;
      written++;
      if (count >= BATCH_SIZE) {
        if (!DRY_RUN) await batch.commit();
        batch = db.batch();
        count = 0;
        console.log(`Committed ${BATCH_SIZE} writes...`);
      }
    }catch(e){ console.error(`Skipping product at index ${i}:`, e.message || e); }
  }

  if (count > 0){
    if (!DRY_RUN) await batch.commit();
    console.log(`Committed final ${count} writes.`);
  }

  console.log(`Done. ${written} products processed${DRY_RUN ? ' (dry run - no writes)' : ''}.`);
}

run().catch(e => { console.error('Import failed:', e.message || e); process.exit(1); });
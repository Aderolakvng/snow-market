#!/usr/bin/env node
/**
 * import-products-from-firestore.js
 * --------------------------------
 * Small utility to export product documents from Firestore into a local JSON file
 * and optionally download product images into `images/products/`.
 *
 * Usage:
 *  node import-products-from-firestore.js --out data/products.json --collection products --dry-run
 *  node import-products-from-firestore.js --serviceAccount ./sa.json --out data/products.json --download-images
 *
 * Notes:
 * - The script uses the GOOGLE_APPLICATION_CREDENTIALS env var or --serviceAccount path to auth.
 * - By default it reads the `products` collection. Use --collection to change.
 * - --dry-run will not write files, only prints a summary.
 * - --rewrite-images will set product.imageURL to `images/products/<id>.<ext>` without downloading.
 * - --download-images will try to download remote images (requires `fetch` support in Node or `node-fetch`).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
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
const COLLECTION = args.collection || 'products';
const OUT_FILE = args.out || 'data/products.json';
const DRY_RUN = !!args['dry-run'] || !!args.dryRun;
const DOWNLOAD_IMAGES = !!args['download-images'] || !!args.downloadImages;
const REWRITE_IMAGES = !!args['rewrite-images'] || !!args.rewriteImages;
const PAGE_SIZE = parseInt(args['batch-size'] || args.pageSize || '500', 10) || 500;

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

function normalizeFirestoreValue(v){
  // Convert Firestore Timestamp -> ISO, leave other values as-is
  if (!v) return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return v;
}

function normalizeProduct(doc){
  const data = doc.data ? doc.data() : doc; // handle both docSnapshot or raw object
  const out = { id: (doc.id || data.id || '' ) };
  for (const k of Object.keys(data)){
    out[k] = normalizeFirestoreValue(data[k]);
  }
  // image normalization
  out.imageURL = out.imageURL || out.image || 'images/products/placeholder.svg';
  out.imageURL = String(out.imageURL);
  return out;
}

async function downloadImage(url, destPath){
  try{
    // Ensure directory
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    // Prefer global fetch (Node 18+), fallback to node-fetch if available
    const fetchFn = (typeof fetch !== 'undefined') ? fetch : (require('node-fetch'));
    const resp = await fetchFn(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buffer = await resp.arrayBuffer();
    await fs.promises.writeFile(destPath, Buffer.from(buffer));
    return true;
  }catch(e){
    console.error('downloadImage failed for', url, e.message || e);
    return false;
  }
}

async function run(){
  console.log('Connecting to Firestore...');
  const db = await initFirebase();

  console.log(`Fetching all documents from collection: ${COLLECTION}`);
  const collectionRef = db.collection(COLLECTION);

  const results = [];
  // simple get all (small collections). For huge collections consider paginated reads.
  let snapshot;
  try{
    snapshot = await collectionRef.get();
  }catch(e){
    console.error('Error reading collection:', e.message || e);
    process.exit(1);
  }

  snapshot.forEach(doc => results.push(doc));

  console.log(`Found ${results.length} documents.`);

  const products = results.map(normalizeProduct);

  if (REWRITE_IMAGES){
    products.forEach(p => {
      const extMatch = String(p.imageURL || '').match(/(\.jpg|\.jpeg|\.png|\.webp|\.svg)(?:\?|#|$)/i);
      const ext = extMatch ? extMatch[1] : '.jpg';
      p.imageURL = `images/products/${p.id}${ext}`;
    });
  }

  if (DRY_RUN){
    console.log('Dry run mode - not writing files. Sample output:');
    console.log(JSON.stringify(products.slice(0, 5), null, 2));
    console.log(`Would write ${products.length} products to ${OUT_FILE}.`);
    if (DOWNLOAD_IMAGES) console.log('Would attempt to download images (dry-run).');
    process.exit(0);
  }

  if (DOWNLOAD_IMAGES){
    console.log('Downloading images into images/products/ ...');
    const imgDir = path.join(process.cwd(), 'images', 'products');
    await fs.promises.mkdir(imgDir, { recursive: true });

    // Download concurrency
    const queue = products.slice();
    const concurrency = parseInt(args.concurrency || '6', 10) || 6;
    const workers = new Array(concurrency).fill(0).map(async () => {
      while (queue.length){
        const p = queue.shift();
        const imgUrl = p.imageURL || '';
        if (!/^https?:\/\//i.test(imgUrl)) continue;
        const m = imgUrl.match(/(\.jpg|\.jpeg|\.png|\.webp|\.svg)(?:\?|#|$)/i);
        const ext = m ? m[1] : '.jpg';
        const dest = path.join(imgDir, `${p.id}${ext}`);
        const ok = await downloadImage(imgUrl, dest);
        if (ok) {
          p.imageURL = `images/products/${p.id}${ext}`; // point locally
        }
      }
    });
    await Promise.all(workers);
  }

  // Write JSON file
  await fs.promises.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.promises.writeFile(OUT_FILE, JSON.stringify(products, null, 2), 'utf8');
  console.log(`Wrote ${products.length} products to ${OUT_FILE}`);
}

run().catch(e => {
  console.error('Script failed:', e.message || e);
  process.exit(1);
});

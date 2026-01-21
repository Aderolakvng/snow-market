/*
Node script: scripts/update-product-images.js
Purpose: Scan Firestore 'products' collection and patch documents whose image fields contain bare filenames or non-'images/products/' paths by setting `imageURL` to 'images/products/placeholder.svg' (or to a user-specified replacement).

Usage:
1. Install dependencies: npm i firebase-admin
2. Create a service account JSON credential and set GOOGLE_APPLICATION_CREDENTIALS to its path, or pass the path as --credentials
3. Dry-run first: node scripts/update-product-images.js --dry
4. To apply changes: node scripts/update-product-images.js --apply

Notes: This script is destructive only when run with --apply. It logs all candidate updates and requires confirmation (unless --force is provided).
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

async function main(){
  const credPath = argv.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    console.error('Service account path required. Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials /path/to/sa.json');
    process.exit(1);
  }
  if (!fs.existsSync(credPath)) { console.error('Credentials file not found:', credPath); process.exit(1); }

  admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(credPath))) });
  const db = admin.firestore();
  const col = db.collection('products');
  const snapshot = await col.get();
  console.log('Fetched products snapshot size=', snapshot.size);

  const updates = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const img = (data.imageURL || data.image || (data.images && data.images[0]) || '').toString();
    const isRemote = /^(https?:)?\/\//i.test(img);
    const looksLikeLocalFile = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(img);
    if (!img || (!isRemote && looksLikeLocalFile && !/images\/products\//.test(img))) {
      updates.push({ id: doc.id, current: img, new: 'images/products/placeholder.svg' });
    }
  });

  console.log('Candidates for update:', updates.length);
  updates.forEach(u => console.log(u.id, '->', u.current, '=>', u.new));

  if (updates.length === 0) { console.log('No updates necessary.'); process.exit(0); }

  if (argv.dry) { console.log('Dry run complete, no changes applied.'); process.exit(0); }

  if (!argv.apply) {
    console.log('Pass --apply to apply the updates (or --apply --force to skip confirmation).');
    process.exit(0);
  }

  if (!argv.force) {
    const prompt = require('prompt-sync')();
    const ans = prompt('Apply updates to Firestore? (yes/no) ');
    if (ans.trim().toLowerCase() !== 'yes') { console.log('Aborted.'); process.exit(0); }
  }

  for (const u of updates){
    console.log('Updating', u.id);
    await col.doc(u.id).update({ imageURL: u.new });
  }

  console.log('Update complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
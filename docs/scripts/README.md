Import/export utilities for product data

import-products-from-firestore.js
---------------------------------

Purpose: Export product documents from a Firestore collection into a local JSON file `data/products.json` and optionally download external images into `images/products/`.

Prerequisites
- Node.js (14+ recommended; Node 18+ preferred for built-in fetch)
- A Firebase service account JSON or ADC (set `GOOGLE_APPLICATION_CREDENTIALS` environment variable or pass `--serviceAccount ./sa.json`)

Examples
- Dry-run, preview 5 products (no write):
  node import-products-from-firestore.js --dry-run

- Export to `data/products.json`:
  node import-products-from-firestore.js --out data/products.json

- Export and rewrite images to local references:
  node import-products-from-firestore.js --out data/products.json --rewrite-images

- Export and download remote images into `images/products/`:
  node import-products-from-firestore.js --out data/products.json --download-images

Flags
- --serviceAccount <path>  Path to service-account JSON (optional if using ADC)
- --collection <name>      Firestore collection name (default: products)
- --out <path>            Destination JSON path (default: data/products.json)
- --dry-run               Show what would be done without writing files
- --rewrite-images        Rewrite product.imageURL -> images/products/<id>.<ext> (no download)
- --download-images       Download remote images and update product.imageURL to local path
- --concurrency <n>       Image download concurrency (default: 6)

Security
- Keep service account keys secret and do not commit them to source control.

import-products-to-firestore.js
---------------------------------

Purpose: Import a local JSON product file (e.g., `data/products.json`) into a Firestore collection. Useful to populate your Firestore `products` collection from the local dataset so the site can load real products directly from Firestore.

Examples
- Dry-run (preview only):
  node import-products-to-firestore.js --file data/products.json --dry-run

- Import into `products` collection (requires service account or ADC):
  node import-products-to-firestore.js --file data/products.json --collection products --serviceAccount ./sa.json

- Notes
  - The script writes documents with ID = product.id. If a document with the same ID exists, it will be merged.
  - Use `--batch-size` to change the commit batch size (default 500).


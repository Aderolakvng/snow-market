// js/firebase-products.js — Fetch products from Firebase (products collection) and shop products (shop collection)

import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// -------------------- 
// FETCH ALL PRODUCTS FROM FIREBASE (products collection)
// --------------------
async function fetchAllProducts() {
  try {
    const productsCollection = collection(db, "products");
    const querySnapshot = await getDocs(productsCollection);
    console.debug('firebase-products: fetched products snapshot size=', querySnapshot.size);

    const products = [];
    querySnapshot.forEach((docSnap) => {
      products.push({ id: docSnap.id, ...docSnap.data() });
    });

    let normalizedList = products;
    console.log(normalizedList);
    

    if (!normalizedList.length) {
      console.warn('[firebase-products] no products found in Firestore (collections may be empty or rules prevent read)');
      try { window.dispatchEvent(new CustomEvent('productsLoadedFrom', { detail: { source: 'firestore-empty', count: 0 } })); }catch(e){}
    } else {
      console.info(`[firebase-products] returning ${normalizedList.length} product(s) from Firestore`);
      try { window.dispatchEvent(new CustomEvent('productsLoadedFrom', { detail: { source: 'firestore', count: normalizedList.length } })); } catch(e) {}
    }

    // Normalize image fields to avoid bare filename 404s
    normalizedList = normalizedList.map(p => {
      try {
        const img = (typeof window.normalizeImg === 'function') ? window.normalizeImg(p.imageURL || p.image || (p.images && p.images[0])) : (p.imageURL || p.image || 'images/products/placeholder.svg');
        return { ...p, imageURL: img };
      } catch(e) { return p; }
    });

    try { window.dispatchEvent(new CustomEvent('productsUpdated', { detail: normalizedList })); } catch(e) {}
    try { window.dispatchEvent(new CustomEvent('productsLoadedFrom', { detail: { source: 'firestore', count: normalizedList.length } })); } catch(e) {}
    return normalizedList;
  } catch (error) {
    console.error("Error fetching products from Firestore:", error);
    try { window.dispatchEvent(new CustomEvent('productsLoadedFrom', { detail: { source: 'error', error: String(error) } })); } catch(e) {}
    return [];
  }
} 

// -------------------- 
// FETCH SHOP PRODUCTS FROM FIREBASE (shop collection)
// --------------------
async function fetchShopProducts() {
  try {
    const shopCollection = collection(db, "shop");
    const querySnapshot = await getDocs(shopCollection);
    console.log('firebase-products: fetched shop products snapshot size=', querySnapshot.size);
    const products = [];
    
    querySnapshot.forEach((doc) => {
      // keep document id as string to avoid collisions from parseInt
      products.push({ id: doc.id, ...doc.data() });
    });

    // Normalize image fields to avoid bare filename 404s
    try {
      const normalized = products.map(p => {
        const img = (typeof window.normalizeImg === 'function') ? window.normalizeImg(p.imageURL || p.image || (p.images && p.images[0])) : (p.imageURL || p.image || 'images/products/placeholder.svg');
        return { ...p, imageURL: img };
      });
      // emit an event so other parts of the site (categories, external UI) can update
      try { window.dispatchEvent(new CustomEvent('shopProductsUpdated', { detail: normalized })); } catch(e) {}
      return normalized;
    } catch(e) {
      try { window.dispatchEvent(new CustomEvent('shopProductsUpdated', { detail: products })); } catch(e) {}
      return products;
    }
  } catch (error) {
    console.error("Error fetching shop products:", error);
    return [];
  }
}

// -------------------- 
// RENDER PRODUCTS TO GRID
// --------------------
let allProducts = [];
let currentProductIndex = 0;
const productsPerBatch = 20;

async function renderProducts() {
  const productGrid = document.querySelector('.grid-container');
  if (!productGrid) return;
  
  // Show loading state
  productGrid.innerHTML = '<p>Loading products...</p>';
  
  allProducts = await fetchAllProducts();
  currentProductIndex = 0;
  
  if (allProducts.length === 0) {
    productGrid.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <h3>No products found</h3>
        <p>Please check your Firebase setup:</p>
        <ol style="text-align: left; display: inline-block;">
          <li>Products exist in the "products" collection</li>
          <li>Firebase security rules allow public read access</li>
          <li>Check browser console for specific errors</li>
        </ol>
      </div>
    `;
    return;
  }
  
  // Clear existing content
  productGrid.innerHTML = '';
  
  // Render first batch
  renderNextBatch();
}

function renderNextBatch() {
  const productGrid = document.querySelector('.grid-container');
  if (!productGrid) return;
  
  const endIndex = Math.min(currentProductIndex + productsPerBatch, allProducts.length);
  for (let i = currentProductIndex; i < endIndex; i++) {
    const productCard = createProductCard(allProducts[i]);
    productGrid.appendChild(productCard);
  }
  currentProductIndex = endIndex;
  
  // Add load more button if there are more products
  if (currentProductIndex < allProducts.length) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.textContent = 'Load More Products';
    loadMoreBtn.className = 'btn load-more-btn';
    loadMoreBtn.style.cssText = 'display: block; margin: 20px auto; padding: 10px 20px; background: var(--teal); color: white; border: none; border-radius: 5px; cursor: pointer;';
    loadMoreBtn.onclick = () => {
      loadMoreBtn.remove();
      renderNextBatch();
    };
    productGrid.appendChild(loadMoreBtn);
  }
}

// -------------------- 
// CREATE PRODUCT CARD ELEMENT
// --------------------
function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';

  const title = product.title || product.name || 'Product';
  const category = product.category || 'General';
  const sub = product.subcategory || product.subCategory || '';
  const description = product.description || 'Product description';
  const price = product.price || 0;

  // ✅ FIX: USE FIRESTORE IMAGE FIRST
  const image =
    product.imageURL ||
    getProductImage(category, sub) ||
    (window.resolveRoot
      ? window.resolveRoot('images/products/placeholder.svg')
      : 'images/products/placeholder.svg');
      log(image, 'this is the image url');

  const catHref = window.resolveRoot
    ? window.resolveRoot(`pages/categories.html?cat=${encodeURIComponent(category)}${sub ? '&sub=' + encodeURIComponent(sub) : ''}`)
    : `pages/categories.html?cat=${encodeURIComponent(category)}${sub ? '&sub=' + encodeURIComponent(sub) : ''}`;

  card.innerHTML = `
    <img 
      src="${image}" 
      alt="${title}" 
      loading="lazy"
      onerror="this.onerror=null;this.src='images/products/placeholder.svg';"
    >

    <h3>${title}</h3>

    <p class="category">
      <a href="${catHref}">
        ${category}${sub ? ' › ' + sub : ''}
      </a>
    </p>

    <p class="desc">${description}</p>

    <span class="price">₦${Number(price).toLocaleString()}</span>

    <button class="btn-add-cart"
      data-id="${product.id}"
      data-name="${title.replace(/"/g, '&quot;')}"
      data-price="${price}"
      data-img="${image}">
      Add to Cart
    </button>
  `;

  return card;
}


// -------------------- 
// GET PRODUCT IMAGE BASED ON CATEGORY
// --------------------
function getProductImage(category, subcategory) {
  console.log('getProductImage called with:', category, subcategory);
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();
  
  if (cat === 'phones') {
    if (sub.includes('iphone')) return window.resolveRoot ? window.resolveRoot('images/products/iphone.svg') : 'images/products/iphone.svg';
    if (sub.includes('samsung')) return window.resolveRoot ? window.resolveRoot('images/products/samsung.svg') : 'images/products/samsung.svg';
    if (sub.includes('nokia')) return window.resolveRoot ? window.resolveRoot('images/products/nokia.svg') : 'images/products/nokia.svg';
  }
  if (cat.includes('pet') || cat.includes('animal')) return window.resolveRoot ? window.resolveRoot('images/products/nokia.svg') : 'images/products/nokia.svg';
  
  // Default to placeholder for other categories
  return window.resolveRoot ? window.resolveRoot('images/products/placeholder.svg') : 'images/products/placeholder.svg';
}

// Expose globally
// window.getProductImage = getProductImage;

// -------------------- 
// INITIALIZE WHEN DOM IS READY
// --------------------
// Export functions for potential use in other files
window.fetchAllProducts = fetchAllProducts;
window.fetchShopProducts = fetchShopProducts;
window.renderProducts = renderProducts;
// expose helper to create product cards for other pages (categories page)
window.createProductCard = createProductCard;

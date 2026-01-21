// js/product.js — Firebase Integration

import { db } from "./firebase.js";
import { collection, getDocs, doc, getDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// --------------------
// GET PRODUCT ID
// --------------------
function getProductId() {
  const params = new URLSearchParams(window.location.search);
  // keep id as string (do not parseInt) because product document IDs are strings
  return params.get("id");
}

// -------------------- 
// FETCH PRODUCT FROM FIREBASE
// --------------------
async function fetchProduct(id) {
  try {
    // guard against missing id (e.g., user opened page without ?id= or param is null)
    if (!id) {
      console.warn('[product] fetchProduct called without an id');
      return null;
    }
    const idStr = String(id);

    const shopRef = doc(db, "shop", idStr);
    const shopSnap = await getDoc(shopRef);
    if (shopSnap.exists()) {
      return { id: shopSnap.id, _collection: 'shop', ...shopSnap.data() };
    }

    const productsRef = doc(db, "products", idStr);
    const productsSnap = await getDoc(productsRef);
    if (productsSnap.exists()) {
      return { id: productsSnap.id, _collection: 'products', ...productsSnap.data() };
    }

    console.log("No such product!");
    return null;
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

const productId = getProductId();
let product = null;

// --------------------

// --------------------
// DOM
// --------------------
const productContainer = document.getElementById("product-container");

// --------------------
// ADD TO CART
// --------------------
function handleAddToCart(item) {
  // prefer centralized addToCart if available
  if (window.addToCart) {
    window.addToCart(item);
    return;
  }

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const exists = cart.find(p => String(p.id) === String(item.id));
  if (exists) {
    exists.quantity = (exists.quantity || exists.qty || 0) + 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Item added to cart");
}

window.handleAddToCart = handleAddToCart;

// -------------------- 
// RENDER PRODUCT (polished)
// --------------------
async function renderProduct() {
  product = await fetchProduct(productId);
  
  if (!product) {
    productContainer.innerHTML = "<h2>Product not found</h2>";
    return;
  }

  // Variants: detect potential variants/skus and expose selection state
  let variants = Array.isArray(product.variants) ? product.variants : (Array.isArray(product.skus) ? product.skus : null);
  // hold currently selected variant (set by selectors)
  let selectedVariant = null;

  // If there is exactly one variant and it has no selectable attributes, auto-select it
  try{
    if (variants && Array.isArray(variants) && variants.length === 1) {
      const v = variants[0];
      const hasAttrs = (v && v.attributes && Object.keys(v.attributes||{}).length) || Object.keys(v||{}).some(k => !['id','sku','price','stock','image','imageURL','images','title','name'].includes(k));
      if (!hasAttrs) {
        selectedVariant = v; // auto-select simple single variant
      }
    }
  }catch(e){}

  // Normalize primary image and gallery
  const primary = (window.normalizeImg ? window.normalizeImg(product.imageURL || product.image || (product.images && product.images[0])) : (product.imageURL || product.image || 'images/products/placeholder.svg')) || 'images/products/placeholder.svg';
  const gallery = (product.images && product.images.length) ? product.images.map(i => (window.normalizeImg ? window.normalizeImg(i) : i)) : [primary];

  const safeTitle = (product.title || product.name || 'Product').replace(/"/g, '&quot;');
  const safeDesc = (product.description || '').replace(/\n/g, '<br />');
  const safePrice = Number(product.price || 0).toFixed(2);

  // Decide whether to render a full-bleed hero variant
  const paramsForHero = new URLSearchParams(window.location.search);
  const heroParam = paramsForHero.get('hero') === '1' || paramsForHero.get('hero') === 'true';
  const heroFull = Boolean(heroParam || product.heroVariant === 'full-bleed' || product.heroFull);

  if (heroFull) {
    productContainer.innerHTML = `
      <div class="product-page container full-hero">
        <div class="product-hero" style="background-image:url('${primary}')" role="img" aria-label="${safeTitle}">
          <!-- hidden image for screen readers and to ensure image is loaded for swap -->
          <img id="mainProductImage" src="${primary}" alt="${safeTitle}" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;clip:rect(1px,1px,1px,1px)" />
          <div class="hero-overlay">
            <div class="hero-inner">
              <h1 class="product-title">${safeTitle}</h1>
              <div class="product-meta">
                <div class="product-price">₦${safePrice}</div>
                <div class="product-rating" id="productRating" role="group" aria-label="Product rating" data-avg="${Number(product.ratingAvg||0).toFixed(2)}" data-count="${Number(product.ratingCount||0)}"></div>
              </div>
              <p class="hero-short">${(product.short || product.summary || '').length ? (product.short || product.summary) : (product.description ? product.description.split('\n')[0] : '')}</p>
              <div class="hero-cta">
                <button class="btn btn-primary" id="heroAddBtn">Add to Cart</button>
                <a class="back-link" href="${window.resolveRoot? window.resolveRoot('pages/shop.html') : 'pages/shop.html'}">← Back to shop</a>
              </div>
            </div>
          </div>
        </div>

        <div class="product-grid compact">
          <div class="product-media">
            <div class="media-thumbs">
              ${gallery.map((g, idx) => `<button class="thumb-btn" data-src="${g}"><img src="${g}" alt="${safeTitle} thumb ${idx+1}" onerror="this.onerror=null; if(window.__tryImageFallback){ window.__tryImageFallback(this); } else { this.src=(window.resolveRoot?window.resolveRoot('images/products/placeholder.svg'):'images/products/placeholder.svg'); }"/></button>`).join('')}
            </div>
          </div>

          <aside class="product-info">
            <div class="buy-box" id="buyBox">
              <div class="price-large">₦${safePrice}</div>
              <div class="qty-row">
                <label for="qtyInput">Quantity</label>
                <input id="qtyInput" type="number" min="1" value="1" />
              </div>

              <div id="variantSelectors" class="variant-selectors"></div>
              <div id="variantFeedback" class="variant-feedback" role="status" aria-live="polite"></div>

              <button id="addToCartBtn" class="btn btn-primary">Add to Cart</button>
              <div class="stock">${product.stock ? (product.stock + ' in stock') : 'In stock'}</div>
              <div class="share">Share: <a href="#">Facebook</a> • <a href="#">Twitter</a></div>
            </div>
          </aside>
        </div>

        <div class="product-details">
          <h2>Description</h2>
          <div class="desc-body">${safeDesc || '<p>No description available.</p>'}</div>
        </div>
      </div>
    `;
  } else {
    productContainer.innerHTML = `
      <div class="product-page container">
        <div class="product-grid">
          <div class="product-media">
            <div class="media-main"><img id="mainProductImage" src="${primary}" alt="${safeTitle}" onerror="this.onerror=null; if(window.__tryImageFallback){ window.__tryImageFallback(this); } else { this.src=(window.resolveRoot?window.resolveRoot('images/products/placeholder.svg'):'images/products/placeholder.svg'); }"/></div>
            <div class="media-thumbs">
              ${gallery.map((g, idx) => `<button class="thumb-btn" data-src="${g}"><img src="${g}" alt="${safeTitle} thumb ${idx+1}" onerror="this.onerror=null; if(window.__tryImageFallback){ window.__tryImageFallback(this); } else { this.src=(window.resolveRoot?window.resolveRoot('images/products/placeholder.svg'):'images/products/placeholder.svg'); }"/></button>`).join('')}
            </div>
          </div>

          <aside class="product-info">
            <a class="back-link" href="${window.resolveRoot? window.resolveRoot('pages/shop.html') : 'pages/shop.html'}">← Back to shop</a>
            <h1 class="product-title">${safeTitle}</h1>
            <div class="product-meta">
              <div class="product-price">₦${safePrice}</div>
              <div class="product-rating" id="productRating" role="group" aria-label="Product rating" data-avg="${Number(product.ratingAvg||0).toFixed(2)}" data-count="${Number(product.ratingCount||0)}"></div>
            </div>
            <p class="product-short">${(product.short || product.summary || '').length ? (product.short || product.summary) : (product.description ? product.description.split('\n')[0] : '')}</p>

            <div class="buy-box" id="buyBox">
              <div class="price-large">₦${safePrice}</div>
              <div class="qty-row">
                <label for="qtyInput">Quantity</label>
                <input id="qtyInput" type="number" min="1" value="1" />
              </div>
              <button id="addToCartBtn" class="btn btn-primary">Add to Cart</button>
              <div class="stock">${product.stock ? (product.stock + ' in stock') : 'In stock'}</div>
              <div class="share">Share: <a href="#">Facebook</a> • <a href="#">Twitter</a></div>
            </div>

          </aside>
        </div>

        <div class="product-details">
          <h2>Description</h2>
          <div class="desc-body">${safeDesc || '<p>No description available.</p>'}</div>
        </div>
      </div>
    `;
  }

  // Hook up gallery thumbnail clicks and keyboard accessibility
  try{
    const mainImg = document.getElementById('mainProductImage');
    const heroEl = productContainer.querySelector('.product-hero');
    const thumbs = Array.from(productContainer.querySelectorAll('.thumb-btn'));
    // set initial pressed state on first thumb
    thumbs.forEach((btn, i) => {
      btn.setAttribute('aria-pressed', i===0 ? 'true' : 'false');
      if (i===0) btn.classList.add('active');
      btn.addEventListener('click', ()=>{
        const s = btn.dataset.src;
        if (!s) return;
        // If hero variant is present, update hero background; otherwise update main image
        if (heroEl){
          heroEl.style.backgroundImage = `url('${s.replace(/"/g, '\\"')}')`;
          if (mainImg) mainImg.src = s;
        } else if (mainImg){
          mainImg.src = s;
        }
        thumbs.forEach(t=>{ t.classList.remove('active'); t.setAttribute('aria-pressed','false'); });
        btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      });
      // keyboard activation
      btn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
    });

    // if hero has a CTA that should trigger the buy flow, wire it to click the buy button
    const heroAdd = productContainer.querySelector('#heroAddBtn');
    const canonicalAdd = document.getElementById('addToCartBtn') || productContainer.querySelector('#addToCartBtn');
    if (heroAdd && canonicalAdd){ heroAdd.addEventListener('click', ()=> canonicalAdd.click()); }

    // VARIANT SELECTORS + VALIDATION
    try{
      // helpers to parse variant attributes regardless of shape
      function getVariantAttrs(v){
        if (!v) return {};
        if (v.attributes && typeof v.attributes === 'object') return v.attributes;
        const out = {};
        const exclude = new Set(['id','sku','price','stock','image','imageURL','images','title','name']);
        Object.keys(v).forEach(k=>{ if (!exclude.has(k)) out[k] = v[k]; });
        return out;
      }

      if (variants && variants.length){
        // build attribute map: { size: Set(...), color: Set(...) }
        const attrMap = {};
        variants.forEach(v=>{
          const attrs = getVariantAttrs(v);
          Object.keys(attrs).forEach(k=>{
            if (!attrMap[k]) attrMap[k] = new Set();
            const val = (attrs[k] === null || typeof attrs[k] === 'undefined') ? '' : String(attrs[k]);
            if (val !== '') attrMap[k].add(val);
          });
        });

        // convert to arrays for predictable ordering
        const attrList = {};
        Object.keys(attrMap).forEach(k=> attrList[k] = Array.from(attrMap[k]));

        // render selectors into host
        const selectorsHost = document.getElementById('variantSelectors') || productContainer.querySelector('#variantSelectors');
        const feedbackEl = document.getElementById('variantFeedback') || productContainer.querySelector('#variantFeedback');
        if (selectorsHost){
          selectorsHost.innerHTML = '';
          Object.keys(attrList).forEach(attrName => {
            const values = attrList[attrName] || [];
            const group = document.createElement('div'); group.className = 'variant-group'; group.dataset.attr = attrName;
            const label = document.createElement('label'); label.className = 'variant-label'; label.textContent = attrName.charAt(0).toUpperCase() + attrName.slice(1);
            group.appendChild(label);

            // render color swatches for color-like attributes
            if (attrName.toLowerCase() === 'color' || values.every(v=> /^#|rgb\(|hsl\(/i.test(v) || v.length<=3)){
              const wrap = document.createElement('div'); wrap.className='variant-swatch-wrap';
              values.forEach(v=>{
                const b = document.createElement('button'); b.type='button'; b.className='variant-swatch'; b.dataset.value = v; b.setAttribute('aria-pressed','false'); b.title = v;
                if (/^#([0-9a-f]{3,8})$/i.test(v) || /(rgb|hsl)\(/i.test(v)) { b.style.background = v; b.classList.add('has-color'); }
                else b.textContent = v;
                wrap.appendChild(b);
              });
              group.appendChild(wrap);
            } else {
              const sel = document.createElement('select'); sel.className='variant-select'; sel.dataset.attr = attrName; sel.setAttribute('aria-label', attrName);
              const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent = `Select ${attrName}`; sel.appendChild(opt0);
              values.forEach(v=>{ const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
              group.appendChild(sel);
            }

            selectorsHost.appendChild(group);
          });

          // bind change handlers
          const currentSelection = {};
          function allAttrsSelected(){ return Object.keys(attrList).every(k => !!currentSelection[k]); }

          function findMatchingVariant(sel){
            if (!allAttrsSelected()) return null;
            return variants.find(v=>{
              const attrs = getVariantAttrs(v);
              return Object.keys(attrList).every(k => String((attrs[k]||'')).trim().toLowerCase() === String((sel[k]||'')).trim().toLowerCase());
            }) || null;
          }

          function updateVariantUI(){
            selectedVariant = findMatchingVariant(currentSelection);
            const addBtn = document.getElementById('addToCartBtn');
            const priceEl = productContainer.querySelector('.price-large') || productContainer.querySelector('.product-price');
            if (!selectedVariant){
              if (addBtn) addBtn.disabled = true;
              if (feedbackEl) feedbackEl.textContent = allAttrsSelected() ? 'Selected combination not available' : '';
              // price back to base
              if (priceEl) priceEl.textContent = `₦${Number(product.price||0).toFixed(2)}`;
            } else {
              if (addBtn) addBtn.disabled = false;
              if (feedbackEl) feedbackEl.textContent = '';
              if (priceEl) priceEl.textContent = `₦${Number(selectedVariant.price||product.price||0).toFixed(2)}`;
              // update main image if variant has an image
              const mainImg = document.getElementById('mainProductImage');
              const heroEl = productContainer.querySelector('.product-hero');
              const vImg = selectedVariant.imageURL || selectedVariant.image || selectedVariant.img;
              if (vImg) {
                if (heroEl) heroEl.style.backgroundImage = `url('${vImg}')`;
                if (mainImg) mainImg.src = vImg;
              }
              // update stock display
              const stockEl = productContainer.querySelector('.stock');
              if (stockEl) stockEl.textContent = selectedVariant.stock ? (selectedVariant.stock + ' in stock') : 'In stock';
            }
          }

          // attach listeners for selects and swatches
          selectorsHost.querySelectorAll('.variant-select').forEach(sel => {
            sel.addEventListener('change', (e)=>{ currentSelection[sel.dataset.attr] = sel.value; updateVariantUI(); });
          });
          selectorsHost.querySelectorAll('.variant-swatch').forEach(btn => {
            btn.addEventListener('click', (e)=>{
              const val = btn.dataset.value;
              const parent = btn.closest('.variant-group');
              const attr = parent ? parent.dataset.attr : null;
              if (!attr) return;
              // toggle pressed state
              parent.querySelectorAll('.variant-swatch').forEach(x=>{ x.classList.remove('active'); x.setAttribute('aria-pressed','false'); });
              btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
              currentSelection[attr] = val;
              // if there is a select for the same attr, sync it
              const sel = selectorsHost.querySelector(`select[data-attr="${attr}"]`); if (sel) sel.value = val;
              updateVariantUI();
            });
          });

          // try auto-select when there's only one value for an attribute
          Object.keys(attrList).forEach(k=>{ if (attrList[k].length === 1){ currentSelection[k] = attrList[k][0]; const sel = selectorsHost.querySelector(`select[data-attr="${k}"]`); if (sel) sel.value = attrList[k][0]; const sw = selectorsHost.querySelector(`.variant-group[data-attr="${k}"] .variant-swatch[data-value="${attrList[k][0]}"]`); if (sw) { sw.classList.add('active'); sw.setAttribute('aria-pressed','true'); } } });

          // initial validation
          updateVariantUI();
        }
      }
    }catch(e){ console.warn('[product] variant selectors init failed', e); }

    // Hero load fade-in and optional parallax
    try{
      const heroEl = productContainer.querySelector('.product-hero');
      const heroInner = heroEl && heroEl.querySelector('.hero-inner');
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // always do a subtle fade-in for accessibility and polish
      if (heroEl && heroInner && !reduced){
        setTimeout(()=> heroEl.classList.add('hero-loaded'), 80);
      } else if (heroEl && heroInner) {
        // respect reduced motion — show immediately
        heroEl.classList.add('hero-loaded');
      }

      // optional parallax (enable via ?parallax=1 or product.heroParallax === true)
      const paramsForHero = new URLSearchParams(window.location.search);
      const parallaxParam = paramsForHero.get('parallax') === '1' || paramsForHero.get('parallax') === 'true';
      const parallaxEnabled = Boolean(heroEl && !reduced && (parallaxParam || product.heroParallax === true || product.heroParallax === 'true'));
      if (parallaxEnabled){
        heroEl.classList.add('parallax-enabled');
        let ticking = false;
        function updateParallax(){
          ticking = false;
          const rect = heroEl.getBoundingClientRect();
          const h = window.innerHeight || document.documentElement.clientHeight;
          // Calculate a gentle offset based on hero position; clamp for stability
          const percent = (h - rect.top) / (h + rect.height);
          const clamped = Math.max(-1, Math.min(1, percent));
          const translate = Math.round(clamped * 24); // up to ~24px
          if (heroInner) heroInner.style.transform = `translateY(${translate}px)`;
          heroEl.style.backgroundPosition = `center calc(50% + ${Math.round(translate * 0.25)}px)`;
        }
        const onScroll = ()=>{ if (!ticking){ ticking = true; requestAnimationFrame(updateParallax); } };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        // initial
        updateParallax();
      }

    }catch(err){ console.warn('[product] hero scroll/fade setup failed', err); }
  }catch(e){ console.error('[product] gallery hookup failed', e);}
  // Rating widget: interactive 5-star rating with localStorage persistence and optional server hook
  try{
    const ratingEl = document.getElementById('productRating');
    if (ratingEl){
      const productKey = `product_rating_${product.id}`;
      let saved = null;
      try{ saved = Number(localStorage.getItem(productKey)); }catch(e){}
      let avg = Number(ratingEl.dataset.avg || 0);
      let count = Number(ratingEl.dataset.count || 0);

      function renderStars(currentAvg, currentCount, userRating){
        ratingEl.innerHTML = '';
        const starsWrap = document.createElement('div'); starsWrap.className = 'stars'; starsWrap.setAttribute('role','radiogroup');
        for (let i=1;i<=5;i++){
          const btn = document.createElement('button'); btn.type='button'; btn.className='star'; btn.innerHTML='★'; btn.setAttribute('aria-label', `${i} star`); btn.setAttribute('role','radio'); btn.setAttribute('aria-checked', (userRating===i)? 'true' : 'false');
          // filled when user's rating or rounded average
          if (userRating ? i <= userRating : i <= Math.round(currentAvg)) btn.classList.add('filled');
          btn.addEventListener('click', ()=> setRating(i));
          btn.addEventListener('keydown', (e)=>{ if (e.key === 'ArrowRight'){ e.preventDefault(); const next = btn.nextElementSibling; next && next.focus(); } if (e.key === 'ArrowLeft'){ e.preventDefault(); const prev = btn.previousElementSibling; prev && prev.focus(); } if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); btn.click(); } });
          btn.addEventListener('mouseover', ()=>{ const btns = starsWrap.querySelectorAll('.star'); btns.forEach((b, idx)=> b.classList.toggle('filled', idx < i)); });
          btn.addEventListener('mouseout', ()=>{ renderStars(currentAvg, currentCount, userRating); });
          starsWrap.appendChild(btn);
        }
        ratingEl.appendChild(starsWrap);
        const metaSpan = document.createElement('span'); metaSpan.className = 'rating-meta'; metaSpan.textContent = currentCount ? `${currentAvg.toFixed(1)} (${currentCount})` : 'No reviews'; ratingEl.appendChild(metaSpan);
      }

      function setRating(r){
        const prev = saved;
        let newAvg = avg; let newCount = count;
        if (prev) {
          newAvg = (avg * newCount - prev + r) / newCount;
        } else {
          newCount = newCount + 1;
          newAvg = (avg * (newCount -1) + r) / newCount;
        }
        try{ localStorage.setItem(productKey, String(r)); saved = r; }catch(e){}
        // optimistic update
        avg = newAvg; count = newCount;
        renderStars(avg, count, saved);
        if (window.showToast) window.showToast('Thanks for rating'); else { const msg = document.createElement('div'); msg.className='rating-msg'; msg.textContent = 'Thanks for rating'; ratingEl.appendChild(msg); setTimeout(()=> msg.remove(), 2200); }
        // server persistence (transactional) — optimistic UI updated above, now persist to Firestore and reconcile
        try{ if (window.submitProductRating) {
          window.submitProductRating(product.id, r).then(res=>{
            if (res && typeof res.avg !== 'undefined'){
              avg = res.avg; count = res.count; renderStars(avg, count, saved);
              // small pop animation on the selected star
              setTimeout(()=>{
                const stars = ratingEl.querySelectorAll('.star');
                const btn = stars[(saved||1)-1];
                if (btn){ btn.classList.add('pop'); setTimeout(()=> btn.classList.remove('pop'), 420); }
              }, 60);
            }
          }).catch(err=>{ console.error('[rating] submit failed', err); });
        } }catch(e){ console.error('[rating] submit hook error', e); }
      }

      renderStars(avg, count, saved);
    }
  }catch(e){ console.error('[rating] failed to init', e); }

  // Firestore-backed rating submit helper
  async function submitProductRating(productId, rating){
    if (!productId) throw new Error('missing-product-id');
    // ensure client id exists
    const clientKey = 'snow_client_id';
    let clientId = null;
    try{ clientId = localStorage.getItem(clientKey); if (!clientId){ clientId = 'c_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-6); localStorage.setItem(clientKey, clientId); } }catch(e){ clientId = 'c_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-6); }

    const col = (product && product._collection) ? String(product._collection) : 'products';
    const prodRef = doc(db, col, String(productId));
    const ratingRef = doc(db, col, String(productId), 'ratings', clientId);

    try{
      const result = await runTransaction(db, async (tx)=>{
        const prodSnap = await tx.get(prodRef);
        if (!prodSnap.exists()) throw new Error('product-not-found');
        const prodData = prodSnap.data() || {};
        let prevAvg = Number(prodData.ratingAvg || 0);
        let prevCount = Number(prodData.ratingCount || 0);
        const ratingSnap = await tx.get(ratingRef);
        if (ratingSnap.exists()){
          const prevVal = Number(ratingSnap.data().rating || 0);
          // replace previous rating with new one
          const newSum = (prevAvg * prevCount) - prevVal + rating;
          const newAvg = prevCount ? (newSum / prevCount) : rating;
          tx.update(prodRef, { ratingAvg: newAvg });
          tx.set(ratingRef, { rating: rating, updatedAt: serverTimestamp() }, { merge: true });
          return { avg: newAvg, count: prevCount };
        } else {
          const newCount = prevCount + 1;
          const newAvg = (prevAvg * prevCount + rating) / newCount;
          tx.update(prodRef, { ratingAvg: newAvg, ratingCount: newCount });
          tx.set(ratingRef, { rating: rating, createdAt: serverTimestamp() });
          return { avg: newAvg, count: newCount };
        }
      });
      return result;
    }catch(err){ console.error('[submitRating] transaction failed', err); throw err; }
  }
  // expose for other modules to reuse (and it must match earlier hook)
  try{ window.submitProductRating = submitProductRating; }catch(e){}

  // Hook up Add to Cart
  const addBtn = document.getElementById('addToCartBtn');
  if (addBtn) {
    addBtn.addEventListener('click', ()=>{
      const qty = Math.max(1, Number(document.getElementById('qtyInput').value || 1));

      // If variants exist, require a matched variant (selectedVariant is set by selectors)
      if (variants && variants.length && !selectedVariant) {
        const fb = document.getElementById('variantFeedback') || productContainer.querySelector('.variant-feedback');
        if (fb) fb.textContent = 'Please select a valid option before adding to cart.';
        return;
      }

      const item = {
        id: String(product.id) + (selectedVariant && selectedVariant.id ? '::' + selectedVariant.id : ''),
        productId: String(product.id),
        variantId: selectedVariant && (selectedVariant.id || selectedVariant.sku) ? (selectedVariant.id || selectedVariant.sku) : null,
        title: product.title || product.name || '',
        price: Number((selectedVariant && selectedVariant.price) ? selectedVariant.price : product.price) || 0,
        quantity: qty,
        imageURL: (selectedVariant && (selectedVariant.imageURL || selectedVariant.image)) ? (selectedVariant.imageURL || selectedVariant.image) : primary
      };

      if (window.addToCart) window.addToCart(item);
      else handleAddToCart(item);
      // small toast feedback if available
      if (window.showToast) window.showToast('Added to cart');
    });
  }
}

renderProduct();

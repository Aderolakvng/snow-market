// External app JS adapted and namespaced to use site products (fetchAllProducts)
(function(){
  function el(id){return document.getElementById(id);} 

  function renderNavbar(){
    const nav = document.getElementById('external-navbar');
    if(!nav) return;

    // helper: normalize image URLs (fallback to placeholder for bare filenames or non-products paths)
    function normalizeImg(img){
      try{
        const v = String(img||'').trim();
        if (!v) return 'images/products/placeholder.svg';
        const isRemote = /^(https?:)?\/\//i.test(v);
        const looksLikeLocalFile = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(v);
        if (!isRemote && looksLikeLocalFile && !/images\/products\//.test(v)) return 'images/products/placeholder.svg';
        return v;
      }catch(e){ return 'images/products/placeholder.svg'; }
    }

    nav.innerHTML = `
      <div class="navbar-inner container">
        <div class="brand"><div class="logo"></div><h2>Snow Market</h2></div>
        <div class="search-box"><input id="externalSearchInput" placeholder="Search products, brand, category..." /></div>
        <div class="nav-actions">
          <a href="${window.resolveRoot ? window.resolveRoot('pages/cart.html') : 'pages/cart.html'}">Cart</a>
          <a href="${window.resolveRoot ? window.resolveRoot('pages/login.html') : 'pages/login.html'}" class="btn-primary">Sign In</a>
        </div>
      </div>
    `;
    const input = document.getElementById('externalSearchInput');
    if (input) input.addEventListener('input', (e)=>{
      const q = (e.target.value || '').toLowerCase();
      const results = (window.EXTERNAL_PRODUCTS_DATA || []).filter(p => {
        return (p.title||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q);
      });
      externalRenderProducts(results);
    });
  }

  // Hero removed: use site's existing hero instead of external hero

  function renderCategories(products){
    const sidebar = document.getElementById('externalCategorySidebar');
    const data = products || window.EXTERNAL_PRODUCTS_DATA || [];
    const cats = Array.from(new Set(data.map(p => p.category || 'Uncategorized'))).sort();
    let html = '<div class="card"><h3>Categories</h3><ul class="category-list">';
    html += `<li class="cat-item" data-cat="All">All</li>`;
    cats.forEach(c=> html += `<li class="cat-item" data-cat="${c}">${c}</li>`);
    html += '</ul></div>';
    if (sidebar) {
      sidebar.innerHTML = html;
      // determine selected category (persisted across renders)
      const selected = window.EXTERNAL_SELECTED_CATEGORY || 'All';
      sidebar.querySelectorAll('.cat-item').forEach(li => {
        const cat = li.getAttribute('data-cat');
        if (cat === selected) li.classList.add('active');
        li.addEventListener('click', () => {
          const chosen = li.getAttribute('data-cat');
          // persist selection
          window.EXTERNAL_SELECTED_CATEGORY = chosen;
          externalLoadProducts(chosen);
          // update active state
          sidebar.querySelectorAll('.cat-item').forEach(x=>x.classList.remove('active'));
          li.classList.add('active');
        });
      });
    }
  }

  // Render into main .grid-container so category filters affect the site's Featured Products grid
  function renderMainProducts(list){
    const grid = document.querySelector('.grid-container');
    if (!grid) return;
    grid.innerHTML = '';
    if (!list || !list.length) {
      grid.innerHTML = '<div style="padding:24px">No products found</div>';
      return;
    }
    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      const img = window.getProductImage ? window.getProductImage(p.category, p.subcategory || p.subCategory) : ((typeof normalizeImg === 'function') ? normalizeImg(p.imageURL || p.image || (p.images && p.images[0])) : (p.imageURL || 'images/products/placeholder.svg'));
      const title = p.title || p.name || '';
      const desc = p.description || '';
      const price = Number(p.price||0).toFixed(2);
      card.setAttribute('data-id', p.id || '');
      card.innerHTML = `
        <img src="${img}" alt="${title}" onerror="this.onerror=null;this.src='images/products/placeholder.svg'">
        <div class="product-body">
          <div class="product-title">${title}</div>
          <div class="product-desc">${desc}</div>
          <div class="product-price">₦${price}</div>
          <button class="btn-add-cart btn" data-id="${p.id}" data-name="${(title+'').replace(/"/g,'&quot;')}" data-price="${price}" data-img="${img}">Add to cart</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // Compact hero slider: left text (badge/title/sub) and right image, using site products
  function renderCompactHero(products){
    const pool = (products || window.EXTERNAL_PRODUCTS_DATA || []).slice();
    if (!pool.length) return;
    const slides = pool.slice(0,6);

    // create wrapper matching external hero structure
    const wrap = document.createElement('div');
    wrap.className = 'hero-wrap container external-hero-adapted';
    wrap.innerHTML = `
      <div class="hero">
        <div class="hero-left">
          <div class="hero-badge">Premium Deals</div>
          <div class="hero-title">Trending picks</div>
          <div class="hero-sub">Top picks from Snow Market — quality guaranteed.</div>
          <div class="hero-controls"><button id="extPrev" class="btn">Prev</button><button id="extNext" class="btn">Next</button></div>
        </div>
        <div class="hero-right">
          <div class="hero-slide" id="extHeroSlide"></div>
        </div>
      </div>
    `;

    const productsSection = document.getElementById('products') || document.querySelector('section.product-grid');
    const pageHero = document.querySelector('.hero');
    if (productsSection && productsSection.parentNode) {
      productsSection.parentNode.insertBefore(wrap, productsSection);
    } else if (pageHero && pageHero.parentNode) {
      pageHero.parentNode.insertBefore(wrap, pageHero.nextSibling);
    } else {
      document.body.insertBefore(wrap, document.body.firstChild);
    }

    // insert search bar below the hero card (so it's not inside the green card)
    const searchBlock = document.createElement('div');
    searchBlock.className = 'hero-search-below container';
    searchBlock.innerHTML = `<div class="hero-search"><input id="extSearchInput" placeholder="Search featured products..." /><button id="extSearchBtn" class="btn">Search</button></div>`;
    if (wrap.parentNode) wrap.parentNode.insertBefore(searchBlock, wrap.nextSibling);

    let idx = 0;
    const slideEl = () => document.getElementById('extHeroSlide');

    function show(i){
      const s = slides.length ? slides[i % slides.length] : null;
      const target = slideEl();
      if (!s) { if (target) target.innerHTML = ''; return; }
      const img = (typeof normalizeImg === 'function') ? normalizeImg(s.imageURL || s.image || (s.images && s.images[0])) : (s.imageURL || 'images/products/placeholder.svg');
      const title = s.title || s.name || '';
      const price = Number(s.price || 0).toFixed(2);
      if (target) target.innerHTML = `
        <img src="${img}" alt="${title}" onerror="this.onerror=null;this.src='images/products/placeholder.svg'" />
        <div class="hero-caption"><h3>${title}</h3><div style="color:var(--teal);font-weight:800">₦${price}</div></div>
      `;
    }

    // attach listeners safely
    const prevBtnId = 'extPrev';
    const nextBtnId = 'extNext';
    function onPrev(){ idx = (idx-1 + slides.length) % Math.max(1, slides.length); show(idx); }
    function onNext(){ idx = (idx+1) % Math.max(1, slides.length); show(idx); }

    // delegate after DOM ready for Prev/Next and Search
    function performSearch(q){
      const ql = (q||'').toLowerCase().trim();
      const data = window.EXTERNAL_PRODUCTS_DATA || [];
      if (!ql) return renderMainProducts(data.slice());
      const results = data.filter(p => {
        return (p.title||'').toLowerCase().includes(ql)
          || (p.description||'').toLowerCase().includes(ql)
          || (p.category||'').toLowerCase().includes(ql);
      });
      renderMainProducts(results);
    }

    setTimeout(()=>{
      const prev = document.getElementById(prevBtnId);
      const next = document.getElementById(nextBtnId);
      if (prev) prev.addEventListener('click', onPrev);
      if (next) next.addEventListener('click', onNext);

      const searchInput = document.getElementById('extSearchInput');
      const searchBtn = document.getElementById('extSearchBtn');
      if (searchInput) searchInput.addEventListener('input', (e)=>{ performSearch(e.target.value); });
      if (searchBtn) searchBtn.addEventListener('click', ()=> performSearch(document.getElementById('extSearchInput').value));
    }, 50);

    // fallback: also attach handlers after a longer delay if elements weren't ready yet
    setTimeout(()=>{
      const si = document.getElementById('extSearchInput');
      const sb = document.getElementById('extSearchBtn');
      if (si && !si._extBound) { si.addEventListener('keyup', (e)=>{ if (e.key === 'Enter') performSearch(e.target.value); }); si._extBound = true; }
      if (sb && !sb._extBound) { sb.addEventListener('click', ()=> performSearch(document.getElementById('extSearchInput').value)); sb._extBound = true; }
    }, 600);

    show(0);
    if (window._extHeroInterval) { clearInterval(window._extHeroInterval); window._extHeroInterval = null; }
    window._extHeroInterval = setInterval(()=>{ if (slides.length) { idx=(idx+1)%slides.length; show(idx); } },4000);
  }

  window.externalRenderProducts = function(list){
    const container = document.getElementById('externalProductsContainer');
    if(!container) return;
    container.innerHTML = '';
    list.forEach(p=>{
      const div = document.createElement('div');
      div.className = 'product-card';
      const pImg = (typeof normalizeImg === 'function') ? normalizeImg(p.imageURL || p.image || (p.images && p.images[0])) : (p.imageURL || 'images/products/placeholder.svg');
      div.innerHTML = `<img src="${pImg}" alt="${p.title}" onerror="this.onerror=null;this.src='images/products/placeholder.svg'" /><div class="product-body"><div class="product-title">${p.title}</div><div class="product-desc">${p.description||''}</div><div class="product-price">₦${Number(p.price||0).toFixed(2)}</div><button class="btn-add-cart btn">Add</button></div>`;
      container.appendChild(div);
    });
  };

  // Shop page render function
  window.shopRenderProducts = function(list){
    const container = document.getElementById('shopGrid');
    if(!container) return;
    container.innerHTML = '';
    list.forEach(p=>{
      const div = document.createElement('div');
      div.className = 'product-card';
      const pImg = (typeof normalizeImg === 'function') ? normalizeImg(p.imageURL || p.image || (p.images && p.images[0])) : (p.imageURL || 'images/products/placeholder.svg');
      div.innerHTML = `<img src="${pImg}" alt="${p.title}" onerror="this.onerror=null;this.src='images/products/placeholder.svg'" /><div class="product-body"><div class="product-title">${p.title}</div><div class="product-desc">${p.description||''}</div><div class="product-price">₦${Number(p.price||0).toFixed(2)}</div><button class="btn-add-cart btn" data-id="${p.id}">Add to cart</button></div>`;
      container.appendChild(div);
    });
  };

  window.externalLoadProducts = function(category, sub){
    const data = window.EXTERNAL_PRODUCTS_DATA || [];
    let all = [];
    if (!category || category === 'All') all = data.slice();
    else all = data.filter(p => ((p.category||'').toLowerCase() === (String(category||'').toLowerCase())));
    if (sub) {
      all = all.filter(p => ((p.subcategory||p.subCategory||p.sub||'').toLowerCase() === (String(sub||'').toLowerCase())));
    }
    // render into main grid
    renderMainProducts(all);
  };

  function renderFooterScroller(products){
    const data = products || window.EXTERNAL_PRODUCTS_DATA || [];
    const arr = data.slice().filter(p => p.imageURL).slice(0,8);
    const doubled = arr.concat(arr);
    const inner = document.createElement('div');
    inner.className = 'scroll-track-inner';
    doubled.forEach(p=>{
      const it = document.createElement('div');
      it.className = 'scroll-item';
      const fImg = (typeof normalizeImg === 'function') ? normalizeImg(p.imageURL || p.image || (p.images && p.images[0])) : (p.imageURL||'images/products/placeholder.svg');
      it.innerHTML = `<img src="${fImg}" style="width:100%;height:120px;object-fit:cover;border-radius:8px" onerror="this.onerror=null;this.src='images/products/placeholder.svg'" /><div style="font-weight:700">${p.title}</div><div style="color:var(--teal)">₦${Number(p.price||0).toFixed(2)}</div>`; 
      inner.appendChild(it);
    });

    // append only if a designated scroller host exists (do not append to body)
    const scrollerHost = document.getElementById('externalFooterScroller') || document.querySelector('footer.scroll-footer');
    if (scrollerHost) scrollerHost.appendChild(inner);
  }

  // featured area is represented by the site's Featured Products section now

  document.addEventListener('DOMContentLoaded', async ()=>{
    // Only run the home-page bootstrap on pages that actually contain the external sidebar.
    // Other pages (shop/categories) still rely on helper functions like shopRenderProducts,
    // but should not auto-fetch/render the "products" collection into their grids.
    const homeSidebar = document.getElementById('externalCategorySidebar');
    if (!homeSidebar) return;

    // Prefer site's Firebase products if available
    let products = [];
    if (window.fetchAllProducts) {
      try { products = await window.fetchAllProducts(); } catch(e){ products = []; }
    }
    if (!products || products.length === 0) products = window.EXTERNAL_SAMPLE_PRODUCTS ? [].concat(...Object.values(window.EXTERNAL_SAMPLE_PRODUCTS)) : [];
    // expose for other functions
    window.EXTERNAL_PRODUCTS_DATA = products;

    renderNavbar();
    // render compact hero between top hero and Featured Products
    renderCompactHero(products);
    // default selected category
    window.EXTERNAL_SELECTED_CATEGORY = window.EXTERNAL_SELECTED_CATEGORY || 'All';
    // render categories beside the site's Featured Products grid
    renderCategories(products);
    // initial render: show all in main grid and mark 'All' active
    renderMainProducts(products);
    renderFooterScroller(products);

    // listen for updates from firebase-products.js
    window.addEventListener('productsUpdated', (ev) => {
      const newProducts = (ev && ev.detail) ? ev.detail : [];
      window.EXTERNAL_PRODUCTS_DATA = newProducts;
      renderCategories(newProducts);
      renderMainProducts(newProducts);
      renderFooterScroller(newProducts);
    });
  });
})();

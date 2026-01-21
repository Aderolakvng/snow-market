(function(){
  // Helper: call callback once header DOM is injected/ready
  function whenHeaderReady(cb){
    try {
      const headerRoot = document.getElementById('header-component');
      // if categories area already exists, call immediately
      if (document.querySelector('.nav-categories')) return cb();
      // observe header component for children being added
      const target = headerRoot || document.body;
      const mo = new MutationObserver((_, obs)=>{
        if (document.querySelector('.nav-categories')){
          obs.disconnect();
          setTimeout(cb, 0);
        }
      });
      mo.observe(target, { childList: true, subtree: true });
      // safety timeout in case mutationobserver doesn't trigger
      setTimeout(()=>{ if (document.querySelector('.nav-categories')) cb(); }, 8000);
    } catch(e){ setTimeout(cb, 0); }
  }

  // Wait for header injection, then initialize categories dropdown
  function buildFromProducts(products){
    // Build a structured map: category -> { total, subs: [ {name,count,sample} ] }
    const map = new Map();
    (products||[]).forEach(p=>{
      const cat = (p.category || p.cat || 'Other') + '';
      const sub = (p.subcategory || p.subCategory || p.sub || '') + '';
      // normalize image using global helper to avoid bare filenames causing 404s
      let img = (window.normalizeImg ? window.normalizeImg(p.imageURL || p.image || (p.images && p.images[0])) : (p.imageURL || p.image || (p.images && p.images[0]) || 'images/products/placeholder.svg')) || 'images/products/placeholder.svg';
      if (window.resolveRoot) img = window.resolveRoot(img);

      if (!map.has(cat)) map.set(cat, { total: 0, subs: new Map() });
      const node = map.get(cat);
      node.total = (node.total || 0) + 1;
      if (sub && sub.trim()) {
        const key = sub.trim();
        const s = node.subs.get(key) || { count: 0, sample: '' };
        s.count = (s.count || 0) + 1;
        if (!s.sample && img) s.sample = img;
        node.subs.set(key, s);
      }
    });
    // Convert subs Map to sorted array for each category
    const out = new Map();
    map.forEach((val, cat) => {
      const subsArr = Array.from(val.subs.entries()).map(([name, o])=>({ name, count: o.count, sample: o.sample })).sort((a,b)=>b.count-a.count);
      out.set(cat, { total: val.total, subs: subsArr });
    });
    return out; // Map<Category, {total, subs:Array}>
  }

  function renderDropdown(map){
    const root = document.querySelector('.nav-categories .nav-dropdown-inner');
    if (!root) return;
    root.innerHTML = '';
    const cats = Array.from(map.entries()).sort((a,b)=>b[1].total - a[1].total);
    console.debug('[header-categories] renderDropdown categories:', cats.map(c=>({name:c[0], total:c[1].total})).slice(0,12));
    const columns = Math.min(4, Math.max(1, Math.ceil(cats.length/3)));
    const perCol = Math.ceil(cats.length/columns) || 1;

    // determine current selection from URL (if any)
    const params = new URLSearchParams(location.search.replace(/^\?/, ''));
    const curCat = (params.get('cat') || '').trim().toLowerCase();
    const curSub = (params.get('sub') || '').trim().toLowerCase();

    for (let i=0;i<columns;i++){
      const col = document.createElement('div');
      col.className = 'cat-column';
      const slice = cats.slice(i*perCol, (i+1)*perCol);
      slice.forEach(([cat, obj])=>{
        const group = document.createElement('div'); group.className='cat-group';
        const h = document.createElement('h4'); h.textContent = `${cat} (${obj.total})`;
        if (curCat && (String(cat||'').trim().toLowerCase() === curCat)) { h.classList.add('active'); group.classList.add('active'); }
        group.appendChild(h);
        const list = document.createElement('div'); list.className = 'cat-list';
        if (!obj.subs || obj.subs.length === 0){
          const a = document.createElement('a');
          const catTrim = (String(cat||'')).trim();
          a.href = (window.resolveRoot ? window.resolveRoot(`pages/categories.html?cat=${encodeURIComponent(catTrim)}`) : `pages/categories.html?cat=${encodeURIComponent(catTrim)}`);
          a.textContent = 'View all';
          a.setAttribute('role','menuitem'); a.setAttribute('tabindex','0'); a.dataset.cat = catTrim; a.setAttribute('aria-label', `View all ${catTrim}`);
          if (catTrim.toLowerCase() === curCat && !curSub) a.classList.add('active');
          list.appendChild(a);
        } else {
          obj.subs.slice(0,8).forEach(s=>{
            const subTrim = (String(s.name||'')).trim();
            const catTrim = (String(cat||'')).trim();
            const a = document.createElement('a');
            a.href = (window.resolveRoot ? window.resolveRoot(`pages/categories.html?cat=${encodeURIComponent(catTrim)}&sub=${encodeURIComponent(subTrim)}`) : `pages/categories.html?cat=${encodeURIComponent(catTrim)}&sub=${encodeURIComponent(subTrim)}`);
            a.className = 'cat-link';
            a.setAttribute('role','menuitem'); a.setAttribute('tabindex','0');
            a.dataset.cat = catTrim; a.dataset.sub = subTrim;
            const thumb = document.createElement('img'); thumb.className='sub-thumb'; thumb.src = (window.resolveRoot ? window.resolveRoot(s.sample || 'images/products/placeholder.svg') : (s.sample || 'images/products/placeholder.svg')); thumb.alt = subTrim; thumb.loading = 'lazy'; thumb.onerror = function(){ this.onerror=null; if(window.__tryImageFallback){ window.__tryImageFallback(this); } else { this.src = (window.resolveRoot?window.resolveRoot('images/products/placeholder.svg'):'images/products/placeholder.svg'); } };
            const title = document.createElement('span'); title.className='sub-title'; title.textContent = subTrim;
            const badge = document.createElement('span'); badge.className='sub-count'; badge.textContent = s.count;
            a.appendChild(thumb); a.appendChild(title); a.appendChild(badge);
            if (catTrim.toLowerCase() === curCat && subTrim.toLowerCase() === curSub) {
              a.classList.add('active');
              group.classList.add('active');
            }
            list.appendChild(a);
          });
          const more = document.createElement('a'); const catTrim = (String(cat||'')).trim(); more.href = (window.resolveRoot ? window.resolveRoot(`pages/categories.html?cat=${encodeURIComponent(catTrim)}`) : `pages/categories.html?cat=${encodeURIComponent(catTrim)}`); more.textContent = 'More…'; more.className='cat-more'; more.setAttribute('role','menuitem'); more.setAttribute('tabindex','0'); more.dataset.cat = catTrim; more.setAttribute('aria-label', `View all ${catTrim}`);
          if (catTrim.toLowerCase() === curCat && !curSub) more.classList.add('active');
          list.appendChild(more);
        }
        group.appendChild(list);
        col.appendChild(group);
      });
      root.appendChild(col);
    }

    const cta = document.createElement('div'); cta.className='dropdown-cta'; cta.innerHTML = `<a href="${window.resolveRoot? window.resolveRoot('pages/categories.html') : 'pages/categories.html'}" class="btn">Browse all categories</a>`;
    root.appendChild(cta);
    const itemCount = root.querySelectorAll('a[role="menuitem"]')[0] ? root.querySelectorAll('a[role="menuitem"]').length : 0;
    console.debug('[header-categories] rendered menu items:', itemCount);
    // mark dropdown host with has-items / empty to help debug visibility
    try{ const dropdownHost = document.querySelector('.nav-categories .nav-dropdown'); if (dropdownHost){ dropdownHost.classList.toggle('has-items', itemCount>0); dropdownHost.classList.toggle('empty', itemCount===0); } }catch(e){}

    // helper to update active state programmatically
    function setActive(cat, sub){
      const items = root.querySelectorAll('a[role="menuitem"]');
      const catNorm = String(cat||'').trim().toLowerCase();
      const subNorm = String(sub||'').trim().toLowerCase();
      items.forEach(it => {
        it.classList.remove('active'); it.removeAttribute('aria-current');
        const itCat = String(it.dataset.cat || '').trim().toLowerCase();
        const itSub = String(it.dataset.sub || '').trim().toLowerCase();
        if (itCat === catNorm && ((!subNorm && !itSub) || (subNorm && itSub === subNorm))) {
          it.classList.add('active'); it.setAttribute('aria-current','true');
          // highlight parent group header
          const parentGroup = it.closest('.cat-group'); if (parentGroup) parentGroup.classList.add('active');
        } else {
          const pg = it.closest('.cat-group'); if (pg) pg.classList.remove('active');
        }
      });
      // highlight matching category header too
      root.querySelectorAll('.cat-group h4').forEach(h=>{ h.classList.remove('active'); const txt = String(h.textContent||'').trim().toLowerCase(); if (catNorm && txt.startsWith(catNorm)) h.classList.add('active'); });
    }

    // listen for site-wide selection events (attach once)
    if (!root._catListenerBound) {
      window.addEventListener('categorySelected', (ev)=>{
        const d = ev && ev.detail ? ev.detail : {};
        setActive(d.cat || '', d.sub || '');
      });
      root._catListenerBound = true;
    }

    // initial set based on URL
    if (curCat) setActive(curCat, curSub);
  }

  function initDropdown(){
    const togg = document.querySelector('.nav-categories .nav-dropdown-toggle');
    const wrap = document.querySelector('.nav-categories');
    const dropdown = document.querySelector('.nav-categories .nav-dropdown');
    const root = document.querySelector('.nav-categories .nav-dropdown-inner');
    console.debug('[header-categories] initDropdown elements', { togg: !!togg, wrap: !!wrap, dropdown: !!dropdown, root: !!root });
    if (!togg || !wrap || !dropdown || !root) return;

    // prevent double-init
    if (wrap._dropdownInited) return; wrap._dropdownInited = true;

    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

    // ensure aria-controls is present
    try { togg.setAttribute('aria-controls', dropdown.id || 'categories-menu'); } catch(e){}
    // mark dropdown hidden by default
    try { dropdown.setAttribute('aria-hidden', 'true'); } catch(e){}

    function open(){
      // prepare staggered delays for visual entrance
      try{
        const groups = root.querySelectorAll('.cat-column .cat-group');
        groups.forEach((g, idx)=>{ g.style.setProperty('--delay', (idx * 50) + 'ms'); });
      }catch(e){}
      // small rAF before adding open to force transition
      requestAnimationFrame(()=>{ wrap.classList.add('open'); togg.setAttribute('aria-expanded','true'); try{ dropdown.setAttribute('aria-hidden','false'); }catch(e){}; console.debug('[header-categories] opened'); });
    }
    function close(){
      // remove stagger delays but keep selection state intact
      try{ root.querySelectorAll('.cat-group').forEach(g=>{ g.style.removeProperty('--delay'); }); }catch(e){}
      wrap.classList.remove('open'); togg.setAttribute('aria-expanded','false'); try{ dropdown.setAttribute('aria-hidden','true'); }catch(e){}; console.debug('[header-categories] closed');
    }

    togg.addEventListener('click', (e)=>{ e.stopPropagation(); const isOpen = wrap.classList.toggle('open'); togg.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); console.debug('[header-categories] toggle click, open?', isOpen); if (isOpen){ open(); setTimeout(()=>{ const first = root.querySelector('a[role="menuitem"]'); first && first.focus(); }, 80); } else { close(); } });

    // pointer-based hover for non-touch devices (reject touch pointerType)
    if (!isTouch){
      wrap.addEventListener('pointerenter', (e)=>{ if (e && e.pointerType !== 'touch') open(); });
      wrap.addEventListener('pointerleave', (e)=>{ if (e && e.pointerType !== 'touch') close(); });
    }

    // close on outside click or pointerdown (works for touch and mouse)
    document.addEventListener('click', (e)=>{ if (!wrap.contains(e.target)) close(); });
    document.addEventListener('pointerdown', (e)=>{ if (!wrap.contains(e.target)) close(); });

    // keyboard support on toggle (enter/space opens, esc closes, arrow down focuses first)
    togg.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); togg.click(); } if (e.key === 'Escape'){ close(); togg.focus(); } if (e.key === 'ArrowDown'){ e.preventDefault(); open(); setTimeout(()=>{ const first = root.querySelector('a[role="menuitem"]'); first && first.focus(); }, 60); } });

    // accessibility: allow focus to close the menu when focus moves away
    dropdown.addEventListener('focusout', (e)=>{ setTimeout(()=>{ if (!wrap.contains(document.activeElement)) close(); }, 10); });

    // quick active setter remains for instant visual feedback
    function quickSetActive(cat, sub){
      const items = root.querySelectorAll('a[role="menuitem"]');
      const catNorm = String(cat||'').trim().toLowerCase();
      const subNorm = String(sub||'').trim().toLowerCase();
      items.forEach(it=>{
        it.classList.remove('active'); it.removeAttribute('aria-current');
        const itCat = String(it.dataset.cat||'').trim().toLowerCase();
        const itSub = String(it.dataset.sub||'').trim().toLowerCase();
        if (itCat === catNorm && ((!subNorm && !itSub) || (subNorm && itSub === subNorm))){ it.classList.add('active'); it.setAttribute('aria-current','true'); const pg = it.closest('.cat-group'); if (pg) pg.classList.add('active'); } else { const pg = it.closest('.cat-group'); if (pg) pg.classList.remove('active'); }
      });
    }

    // handle clicks and keyboard navigation inside the dropdown (attach once)
    function handleMenuClick(e){
      const a = e.target.closest('a[role="menuitem"]');
      if (!a) return;
      e.preventDefault();
      const cat = a.dataset.cat || '';
      const sub = a.dataset.sub || '';
      const grid = document.querySelector('.grid-container');

      function updateUIWithFiltered(filtered){
        try {
          if (window.externalLoadProducts) window.externalLoadProducts(cat || undefined, sub || undefined);
          if (window.externalRenderProducts) window.externalRenderProducts(filtered);
        } catch(err){ console.error('[header-categories] external renderer error', err); }

        // fallback: render into main grid if no external renderer
        if (!window.externalRenderProducts && grid) {
          grid.innerHTML = '';
          filtered.forEach(p=>{
            const div = document.createElement('div'); div.className = 'product-card';
            const img = window.getProductImage ? window.getProductImage(p.category, p.subcategory || p.subCategory) : (p.imageURL || p.image || 'images/products/placeholder.svg');
            div.setAttribute('data-id', p.id || '');
            div.innerHTML = `<img src="${img}" alt="${(p.title||p.name||'') && (p.title||p.name||'')}" loading="lazy" onerror="this.onerror=null; if(window.__tryImageFallback){ window.__tryImageFallback(this); } else { this.src=(window.resolveRoot?window.resolveRoot('images/products/placeholder.svg'):'images/products/placeholder.svg'); }" /><div class="product-body"><div class="product-title">${p.title}</div><div class="product-desc">${p.description||''}</div><div class="product-price">₦${Number(p.price||0).toFixed(2)}</div><button class="btn-add-cart btn">Add</button></div>`;
            grid.appendChild(div);
          });
        }
      }

      if (window.fetchAllProducts) {
        if (grid) grid.innerHTML = '<div style="padding:24px">Loading category…</div>';
        const catNorm = String(cat||'').trim().toLowerCase();
        const subNorm = String(sub||'').trim().toLowerCase();
        if (!catNorm) { window.location.href = a.href; return; }
        // set active immediately for quick feedback
        try { quickSetActive(catNorm, subNorm); } catch(e) {}
        window.fetchAllProducts().then(list=>{
          const filtered = list.filter(p => {
            const pCat = String(p.category||p.cat||'').trim().toLowerCase();
            if (pCat !== catNorm) return false;
            if (subNorm) {
              const pSub = String(p.subcategory||p.subCategory||p.sub||'').trim().toLowerCase();
              return pSub === subNorm;
            }
            return true;
          });

          console.debug(`[header-categories] filtering cat=${catNorm} sub=${subNorm} => matched=${filtered.length}`);
          updateUIWithFiltered(filtered);

          // push a friendly URL for bookmarking
          const base = (window.resolveRoot ? window.resolveRoot('pages/categories.html') : 'pages/categories.html');
          const newUrl = base + `?cat=${encodeURIComponent(catNorm)}${subNorm ? '&sub=' + encodeURIComponent(subNorm) : ''}`;
          try { history.pushState({}, '', newUrl); } catch(e) {}

          // emit site-level event other pages can react to
          try { window.dispatchEvent(new CustomEvent('categorySelected', { detail: { cat: catNorm, sub: subNorm, filtered } })); } catch(e){}

          // close dropdown
          try { close(); togg.setAttribute('aria-expanded','false'); } catch(e){}
        }).catch(err=>{
          console.error('[header-categories] fetchAllProducts failed', err);
          window.location.href = a.href;
        });
      } else {
        // No JS fetch available — fallback to navigation
        window.location.href = a.href;
      }
    }

    function handleMenuKeydown(e){
      const items = Array.from(root.querySelectorAll('a[role="menuitem"]'));
      if (!items.length) return;
      const active = document.activeElement; let idx = items.indexOf(active);
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx+1) % items.length; items[idx].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx-1+items.length) % items.length; items[idx].focus(); }
      if (e.key === 'Escape') { close(); togg.focus(); }
    }

    // attach once
    if (!root._menuListenersAttached) { root.addEventListener('click', handleMenuClick); root.addEventListener('keydown', handleMenuKeydown); root._menuListenersAttached = true; }

    // mark initialization complete (helpful for debug/QA)
    try { togg.dataset.categoriesReady = '1'; wrap.dataset.categoriesReady = '1'; console.debug('[header-categories] init complete: toggle ready'); } catch(e){}
  }

  // try to build on productsUpdated event (fired by firebase-products.js) or from global EXP data
  function tryBuild(products){
    const p = products || window._LAST_PRODUCTS || window.EXTERNAL_PRODUCTS_DATA || [];
    const root = document.querySelector('.nav-categories .nav-dropdown-inner');
    if (root) root.innerHTML = '<div class="dropdown-loading">Loading categories…</div>';

    // If we have no products yet but fetchAllProducts exists, try it
    if ((!p || p.length === 0) && window.fetchAllProducts) {
      window.fetchAllProducts().then(list=>{
        window._LAST_PRODUCTS = list || [];
        if (list && list.length) renderDropdown(buildFromProducts(list));
        else renderFallback();
      }).catch(()=> renderFallback());
      return;
    }

    if (p && p.length) {
      console.debug('[header-categories] building from products count=', p.length);
      const built = buildFromProducts(p);
      console.debug('[header-categories] built map size=', built.size);
      renderDropdown(built);
    } else {
      console.debug('[header-categories] no product data, using fallback');
      renderFallback();
    }

    function renderFallback(){
      const fallback = new Map();
      const samples = {
        'Clothing': ['Jackets','Gloves','Boots'],
        'Electronics': ['Headphones','Cameras','Drones'],
        'Home': ['Kitchen','Furniture'],
        'Sports': ['Fitness','Outdoor']
      };
      Object.keys(samples).forEach(k=>{
        const subs = samples[k].map(n=>({ name: n, count: 0, sample: '/images/products/placeholder.svg' }));
        fallback.set(k, { total: subs.length, subs });
      });
      renderDropdown(fallback);
    }
  }

  async function waitForGlobal(name, timeoutMs){
    const start = Date.now();
    while (Date.now() - start < (timeoutMs || 7000)) {
      if (typeof window[name] === 'function') return window[name];
      await new Promise(r => setTimeout(r, 50));
    }
    return null;
  }

  whenHeaderReady(()=>{
    initDropdown();
    // catch updates
    window.addEventListener('productsUpdated', (ev)=>{ tryBuild(ev.detail || []); });
    // if there is already a fetchAllProducts function, call it and build
    (async function(){
      const fetchAll = window.fetchAllProducts || await waitForGlobal('fetchAllProducts', 7000);
      if (fetchAll) {
        try {
          const list = await fetchAll();
          window._LAST_PRODUCTS = list;
          tryBuild(list);
          return;
        } catch(e) {}
      }

      if (window.EXTERNAL_PRODUCTS_DATA && window.EXTERNAL_PRODUCTS_DATA.length){
      // external embedded data is available
      tryBuild(window.EXTERNAL_PRODUCTS_DATA);
      } else {
        // Local fallback: try to load data/products.json relative to current path (avoid leading slash to reduce noisy 404s)
        (async function(){
        const candidates = ['data/products.json','../data/products.json','/data/products.json'];
        try{
          // tolerant JSON parser for products file (strip comments if needed)
          async function parseJsonResponse(res){
            try{ return await res.json(); }catch(err){
              try{ const txt = await res.text(); const cleaned = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); return JSON.parse(cleaned); }catch(e2){ throw e2; }
            }
          }

          if (window.fetchFirstOk) {
            const res = await window.fetchFirstOk(candidates);
            const j = res && res.ok ? await parseJsonResponse(res).catch(()=>null) : null;
            if (j && j.length) { window._LAST_PRODUCTS = j; tryBuild(j); return; }
          } else if (window.pickExisting) {
            const found = await window.pickExisting(candidates);
            if (found) {
              const r = await fetch(found).catch(()=>null);
              const j = r && r.ok ? await parseJsonResponse(r).catch(()=>null) : null;
              if (j && j.length) { window._LAST_PRODUCTS = j; tryBuild(j); return; }
            }
          } else {
            for (const c of candidates) {
              try{
                const r = await fetch(c);
                if (r && r.ok) {
                  const j = await parseJsonResponse(r).catch(()=>null);
                  if (j && j.length) { window._LAST_PRODUCTS = j; tryBuild(j); return; }
                }
              }catch(e){}
            }
          }
        }catch(e){}
        tryBuild([]);
        })();
      }
    })();

    // Expose a safe re-init helper for diagnostics and to re-run init after header injection
    try{
      window.reinitHeaderCategories = function(){ try{ initDropdown(); tryBuild(window._LAST_PRODUCTS || window.EXTERNAL_PRODUCTS_DATA || []); console.debug('[header-categories] reinitHeaderCategories called'); }catch(e){ console.error('[header-categories] reinit failed', e); } };
    }catch(e){ /* ignore in browsers with strict CSP */ }

    // Delegated click fallback so dropdown toggles still work even if init didn't bind directly
    try{
      document.addEventListener('click', function(e){
        const togg = e.target.closest && e.target.closest('.nav-dropdown-toggle');
        if (togg){
          const wrap = togg.closest('.nav-categories'); if (!wrap) return;
          const dropdown = wrap.querySelector('.nav-dropdown');
          const nowOpen = wrap.classList.toggle('open');
          try{ togg.setAttribute('aria-expanded', nowOpen ? 'true' : 'false'); }catch(ex){}
          try{ dropdown && dropdown.setAttribute('aria-hidden', nowOpen ? 'false' : 'true'); }catch(ex){}
          if (nowOpen){ setTimeout(()=>{ const first = wrap.querySelector('a[role="menuitem"]'); first && first.focus(); }, 60); } else { togg.focus(); }
          return;
        }

        // Delegated handler for menu items — robust fallback if init didn't attach handlers
        const a = e.target.closest && e.target.closest('.nav-categories .nav-dropdown-inner a[role="menuitem"]');
        if (!a) return;

        const canHandleInPlace = !!document.getElementById('externalCategorySidebar') || !!document.getElementById('categoryGrid');
        if (!canHandleInPlace) return;

        // prevent default navigation
        e.preventDefault();
        const wrap = a.closest('.nav-categories'); if (!wrap) return;
        const cat = a.dataset.cat || '';
        const sub = a.dataset.sub || '';
        console.debug('[header-categories] delegated click on menuitem', { cat, sub });

        // Try to behave exactly like handleMenuClick — filter products and trigger external renderers
        const grid = document.querySelector('.grid-container');
        function updateUIWithFiltered(filtered){
          try { if (window.externalLoadProducts) window.externalLoadProducts(cat || undefined, sub || undefined); if (window.externalRenderProducts) window.externalRenderProducts(filtered); } catch(err){ console.error('[header-categories] delegated external renderer error', err); }
          if (!window.externalRenderProducts && grid) {
            grid.innerHTML = '';
            filtered.forEach(p=>{
              const div = document.createElement('div'); div.className = 'product-card';
              const img = p.imageURL || p.image || 'images/products/placeholder.svg';
              div.setAttribute('data-id', p.id || '');
              div.innerHTML = `<img src="${img}" alt="${(p.title||p.name||'') && (p.title||p.name||'')}" loading="lazy" onerror="this.onerror=null; if(window.__tryImageFallback){ window.__tryImageFallback(this); } else { this.src=(window.resolveRoot?window.resolveRoot('images/products/placeholder.svg'):'images/products/placeholder.svg'); }" /><div class="product-body"><div class="product-title">${p.title}</div><div class="product-desc">${p.description||''}</div><div class="product-price">₦${Number(p.price||0).toFixed(2)}</div><button class="btn-add-cart btn">Add</button></div>`;
              grid.appendChild(div);
            });
          }
        }

        if (window.fetchAllProducts) {
          if (grid) grid.innerHTML = '<div style="padding:24px">Loading category…</div>';
          const catNorm = String(cat||'').trim().toLowerCase();
          const subNorm = String(sub||'').trim().toLowerCase();
          if (!catNorm) { window.location.href = a.href; return; }
          window.fetchAllProducts().then(list=>{
            const filtered = list.filter(p => {
              const pCat = String(p.category||p.cat||'').trim().toLowerCase();
              if (pCat !== catNorm) return false;
              if (subNorm) {
                const pSub = String(p.subcategory||p.subCategory||p.sub||'').trim().toLowerCase();
                return pSub === subNorm;
              }
              return true;
            });
            console.debug(`[header-categories] delegated filtering cat=${catNorm} sub=${subNorm} => matched=${filtered.length}`);
            updateUIWithFiltered(filtered);
            const base = (window.resolveRoot ? window.resolveRoot('pages/categories.html') : 'pages/categories.html');
            const newUrl = base + `?cat=${encodeURIComponent(catNorm)}${subNorm ? '&sub=' + encodeURIComponent(subNorm) : ''}`;
            try { history.pushState({}, '', newUrl); } catch(e) {}
            try { window.dispatchEvent(new CustomEvent('categorySelected', { detail: { cat: catNorm, sub: subNorm, filtered } })); } catch(e){}
            // close any open dropdown
            const togg = wrap.querySelector('.nav-dropdown-toggle'); if (togg){ try { wrap.classList.remove('open'); togg.setAttribute('aria-expanded','false'); const dd = wrap.querySelector('.nav-dropdown'); dd && dd.setAttribute('aria-hidden','true'); }catch(e){} }
          }).catch(err=>{ console.error('[header-categories] delegated fetchAllProducts failed', err); window.location.href = a.href; });
        } else {
          window.location.href = a.href;
        }
      });
    }catch(e){ /* ignore */ }

    // Helper: debug dropdown visibility & structure
    try{
      window.debugHeaderCategories = function(){
        const wrap = document.querySelector('.nav-categories');
        const togg = document.querySelector('.nav-categories .nav-dropdown-toggle');
        const dropdown = document.querySelector('.nav-categories .nav-dropdown');
        const root = document.querySelector('.nav-categories .nav-dropdown-inner');
        console.log('header-categories: wrap', !!wrap, 'toggle', !!togg, 'dropdown', !!dropdown, 'root', !!root);
        if (!wrap || !dropdown || !root) return;
        console.log('dataset.categoriesReady:', togg && togg.dataset ? togg.dataset.categoriesReady : 'n/a');
        console.log('dropdown classes:', dropdown.className, 'wrap classes:', wrap.className);
        console.log('has-items:', dropdown.classList.contains('has-items'), 'empty:', dropdown.classList.contains('empty'));
        console.log('menuitem count:', root.querySelectorAll('a[role="menuitem"]').length);
        const cs = window.getComputedStyle(dropdown);
        console.log('computed display:', cs.display, 'visibility:', cs.visibility, 'opacity:', cs.opacity, 'height:', dropdown.offsetHeight, 'scrollHeight:', dropdown.scrollHeight);
        // try to open and observe
        wrap.classList.add('open'); togg && togg.setAttribute('aria-expanded','true'); dropdown && dropdown.setAttribute('aria-hidden','false');
        setTimeout(()=>{
          const cs2 = window.getComputedStyle(dropdown);
          console.log('after open - computed display:', cs2.display, 'opacity:', cs2.opacity, 'height:', dropdown.offsetHeight);
        }, 80);
      };
    }catch(e){}
    // Header scroll shrink: toggle .scrolled on the main header for a polished sticky effect
    try{
      (function(){
        const hdr = document.querySelector('.header') || document.querySelector('.main-header');
        if (!hdr) return;
        const onScroll = ()=>{
          const y = window.scrollY || window.pageYOffset || 0;
          if (y > 12) hdr.classList.add('scrolled'); else hdr.classList.remove('scrolled');
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        // run once
        onScroll();
      })();
    }catch(e){ console.warn('[header-categories] scroll handler init failed', e); }
  });
})();

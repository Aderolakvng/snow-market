;(function(){
  function detectBase(){
    const path = location.pathname;
    const topDirs = ['pages','components','css','js','images'];
    for (const dir of topDirs) {
      const idx = path.indexOf('/' + dir + '/');
      if (idx !== -1) return path.slice(0, idx + 1);
    }

    // fallback: use the directory portion of the current path
    if (path.endsWith('/')) return path;
    const last = path.lastIndexOf('/');
    return last === 0 ? '/' : path.slice(0, last + 1);
  }

  const APP_BASE = detectBase(); // e.g. '/' or '/Snow/'
  window.APP_BASE = APP_BASE;

  window.resolveRoot = function(p){
    if (!p) return p;
    if (typeof p !== 'string') return p;
    if (/^https?:\/\//i.test(p) || p.startsWith('//')) return p;
    // If explicitly root-anchored, map to app base
    if (p.startsWith('/')) {
      return APP_BASE + p.replace(/^\/+/, '');
    }
    // Preserve explicit relative paths (./ or ../)
    if (p.startsWith('./') || p.startsWith('../')) return p;
    // If it's a fragment or query, return as-is
    if (p.startsWith('#') || p.startsWith('?')) return p;
    // Bare paths like 'images/...', 'pages/shop.html' should be treated as root-relative
    return APP_BASE + p.replace(/^\/+/, '');
  };

  // Normalize image URLs across the app (resolve to app base when appropriate)
  window.normalizeImg = function(img){
    try{
      const v = String(img||'').trim();
      const placeholder = window.resolveRoot ? window.resolveRoot('images/products/placeholder.svg') : 'images/products/placeholder.svg';
      if (!v) return placeholder;
      const isRemote = /^(https?:)?\/\//i.test(v);
      const looksLikeLocalFile = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(v);
      if (isRemote) return v;
      // If explicitly root-anchored, map with resolveRoot
      if (v.startsWith('/')) return window.resolveRoot ? window.resolveRoot(v) : v;
      if (!looksLikeLocalFile) return placeholder;
      // If already relative with ./ or ../, leave as-is (assume caller knows path)
      if (v.startsWith('./') || v.startsWith('../')) return v;
      // Otherwise, map bare paths like 'images/...' to the app base so they work from / and /pages/
      return window.resolveRoot ? window.resolveRoot(v) : v;
    }catch(e){ return window.resolveRoot ? window.resolveRoot('images/products/placeholder.svg') : 'images/products/placeholder.svg'; }
  };

  // Global image fallback handler: on image load error, try alternate extensions (.svg, .jpg, .webp),
  // then fall back to a brand-level SVG (e.g., images/products/iphone.svg) before using the placeholder.
  (function(){
    window.__imgFallbackExtensions = ['.svg', '.jpg', '.webp'];

    window.__tryImageFallback = function(img){
      try{
        if (!img || img.tagName !== 'IMG') return;
        const src = img.getAttribute('src') || '';
        if (!src) { img.src = window.resolveRoot('images/products/placeholder.svg'); return; }
        if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) { img.src = window.resolveRoot('images/products/placeholder.svg'); return; }

        // Parse base and extension
        const m = src.match(/^(.*?)(\.[^.?#]+)(\?.*)?$/);
        let base, ext, query = '';
        if (m) { base = m[1]; ext = m[2]; query = m[3] || ''; } else { base = src; ext = ''; }

        let tried = (img.dataset.fallbackTried || '').split(',').filter(Boolean);
        const candidates = window.__imgFallbackExtensions.slice();

        // Find next candidate extension we haven't tried
        let next;
        for (const c of candidates) {
          if (c === ext) continue;
          if (tried.includes(c)) continue;
          next = c; break;
        }

        if (next) {
          tried.push(next);
          img.dataset.fallbackTried = tried.join(',');
          img.src = base + next + query;
          return;
        }

        // Try brand-level fallback (iphone/samsung/nokia)
        const brandMatch = base.match(/(iphone|samsung|nokia)/i);
        if (brandMatch) {
          img.dataset.fallbackTried = (img.dataset.fallbackTried || '') + ',brand';
          img.src = window.resolveRoot('images/products/' + brandMatch[1].toLowerCase() + '.svg');
          return;
        }

        // Final fallback
        img.src = window.resolveRoot('images/products/placeholder.svg');
      }catch(e){ try{ img.src = window.resolveRoot('images/products/placeholder.svg'); }catch(err){} }
    };

    window.addEventListener('error', function(e){
      const t = e.target || e.srcElement;
      if (t && t.tagName === 'IMG') {
        // protect against infinite retries
        const triedCount = (t.dataset && t.dataset.fallbackTried) ? t.dataset.fallbackTried.split(',').length : 0;
        if (triedCount > window.__imgFallbackExtensions.length + 2) { t.src = window.resolveRoot('images/products/placeholder.svg'); return; }
        setTimeout(function(){ window.__tryImageFallback(t); }, 0);
      }
    }, true);
  })();

  // Utility: find the first candidate path that exists (HEAD/GET), returns resolved URL or null
  window.pickExisting = async function(candidates){
    if (!Array.isArray(candidates)) return null;
    for (const c of candidates){
      try{
        const candidate = window.resolveRoot ? window.resolveRoot(c) : c;
        try{ const r = await fetch(candidate, { method: 'HEAD' }); if (r && r.ok) return candidate; }catch(e1){ try{ const r2 = await fetch(candidate); if (r2 && r2.ok) return candidate; }catch(e2){} }
      }catch(e){}
    }
    return null;
  };

  // Utility: fetch the first candidate that returns a successful response; returns Response or null
  window.fetchFirstOk = async function(candidates){
    if (!Array.isArray(candidates)) return null;
    for (const c of candidates){
      const candidate = window.resolveRoot ? window.resolveRoot(c) : c;
      try{
        const r = await fetch(candidate);
        if (r && r.ok) return r;
        else console.warn('[fetchFirstOk] non-ok response', r && r.status, candidate);
      }catch(e){ console.warn('[fetchFirstOk] fetch error for', candidate, e); }
    }
    return null;
  };

  // Expose a small debugging flag if needed
  window.DEBUG_ASSET_LOG = window.DEBUG_ASSET_LOG || false;

})();

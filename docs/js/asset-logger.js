(function(){
  // Lightweight asset/fetch logger for debugging missing assets
  const origFetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    try{
      const res = await origFetch(input, init);
      // console.log(res, 'here is the response i log');  
      
      if (!res || !res.ok) {
        try{ const url = (typeof input === 'string') ? input : (input && input.url) ? input.url : String(input); console.warn(`[asset-logger] fetch failed: ${res && res.status} ${res && res.statusText} - ${url}`); }catch(e){}
      }
      return res;
    }catch(e){
      try{ const url = (typeof input === 'string') ? input : (input && input.url) ? input.url : String(input); console.warn(`[asset-logger] fetch error for ${url}:`, e); }catch(err){}
      throw e;
    }
  };

  // Log resource load errors (images, scripts, links)
  window.addEventListener('error', function(ev){
    const t = ev.target || ev.srcElement;
    if (t && (t.tagName === 'IMG' || t.tagName === 'SCRIPT' || t.tagName === 'LINK')) {
      const url = t.src || t.href || (t.getAttribute && t.getAttribute('src')) || '';
      console.warn('[asset-logger] resource failed to load:', { tag: t.tagName, url: url, element: t });
    }
  }, true);

  // Log unhandled fetch rejections
  window.addEventListener('unhandledrejection', function(ev){
    try{ console.warn('[asset-logger] unhandled promise rejection', ev.reason); }catch(e){}
  });

})();
(function(){
  if (window.__globalLoader) return;
  const el = document.getElementById('global-loader');
  function _show(){ try{ if(el){ el.classList.add('visible'); el.setAttribute('aria-hidden','false'); } }catch(e){} }
  function _hide(){ try{ if(el){ el.classList.remove('visible'); el.setAttribute('aria-hidden','true'); } }catch(e){} }
  function setMsg(msg, sub){ try{ const m = document.querySelector('#global-loader .loader-msg'); const s = document.querySelector('#global-loader .loader-sub'); if (m) m.textContent = msg || 'Loading…'; if (s) s.textContent = sub || 'Please wait a moment'; }catch(e){} }

  // Reference-counted visibility with debounce to avoid flicker
  let count = 0; let timer = null; let visible = false; const SHOW_DELAY = 180; const HIDE_DELAY = 120;
  function showLoader(msg, sub){ count++; if (msg||sub) setMsg(msg,sub); if (timer) clearTimeout(timer); timer = setTimeout(()=>{ visible = true; _show(); }, SHOW_DELAY); }
  function hideLoader(){ if (count>0) count--; if (count>0) return; if (timer) { clearTimeout(timer); timer = null; } if (visible) { setTimeout(()=>{ visible=false; _hide(); }, HIDE_DELAY); } }

  // Expose globals
  window.showLoader = showLoader;
  window.hideLoader = hideLoader;
  window.setLoaderMessage = setMsg;

  // Instrument fetch to show loader for long-running network ops
  try{
    const origFetch = window.fetch.bind(window);
    window.fetch = function(...args){
      showLoader();
      return origFetch.apply(this,args).then(r => { hideLoader(); return r; }).catch(err => { hideLoader(); throw err; });
    };
  }catch(e){ console.warn('Could not wrap fetch for loader', e); }

  // helper to run async functions with loader
  window.withLoader = async function(promiseOrFn, { message, submessage } = {}){
    try{
      showLoader(message, submessage);
      const res = (typeof promiseOrFn === 'function') ? await promiseOrFn() : await promiseOrFn;
      hideLoader();
      return res;
    }catch(e){ hideLoader(); throw e; }
  };

  // Hide on initial load
  window.addEventListener('load', ()=>{ try{ hideLoader(); }catch(e){} });

  window.__globalLoader = { show: showLoader, hide: hideLoader, setMsg };
})();
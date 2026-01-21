(function(){
  async function pickExisting(candidates){
    for (const c of candidates){
      const candidate = window.resolveRoot ? window.resolveRoot(c) : c;
      try {
        const res = await fetch(candidate, { method: 'HEAD' });
        if (res && res.ok) return candidate;
      } catch(e) {
        try {
          const res2 = await fetch(candidate);
          if (res2 && res2.ok) return candidate;
        } catch(e2){}
      }
    }
    return window.resolveRoot ? window.resolveRoot(candidates[0]) : candidates[0];
  }

  async function fix(){
    const nav = document.getElementById('navMenu');
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll('a'));
    for (const a of links){
      const text = (a.textContent || '').trim().toLowerCase();
      const id = (a.id || '').trim();
      let candidates = [];

      if (id === 'cart-link') candidates = ['pages/cart.html','cart.html','/pages/cart.html','/cart.html','../cart.html'];
      else if (id === 'nav-login-link') candidates = ['pages/login.html','login.html','/pages/login.html','/login.html','../pages/login.html','../login.html'];
      else if (id === 'nav-signup-link') candidates = ['pages/signup.html','signup.html','/pages/signup.html','/signup.html','../pages/signup.html','../signup.html'];
      else if (id === 'nav-logout-link') candidates = ['index.html','/index.html','../index.html','/'];
      else if (id === 'nav-orders-link') candidates = ['pages/orders.html','orders.html','/pages/orders.html','/orders.html','../pages/orders.html','../orders.html'];
      else if (id === 'nav-profile-link') candidates = ['pages/profile.html','profile.html','/pages/profile.html','/profile.html','../pages/profile.html','../profile.html'];
      else if (text.startsWith('home')) candidates = ['index.html','/index.html','pages/index.html','../index.html'];
      else if (text.startsWith('shop')) candidates = ['pages/shop.html','shop.html','/pages/shop.html','../shop.html'];
      else if (text.startsWith('categories')) candidates = ['pages/categories.html','categories.html','/pages/categories.html','../categories.html'];
      else if (text.startsWith('contact')) candidates = ['pages/contact.html','contact.html','/pages/contact.html','../contact.html'];
      else if (text.startsWith('customer service')) candidates = ['pages/customer-service.html','customer-service.html','/pages/customer-service.html','../customer-service.html'];

      if (candidates.length){
        pickExisting(candidates).then(found => { if (found) a.href = found; }).catch(()=>{});
      }
    }
  }

  function setupMenuToggle(){
    const menuToggle = document.getElementById("menuToggle");
    const nav = document.querySelector(".nav");
    if (menuToggle && nav) {
      menuToggle.addEventListener("click", () => {
        nav.classList.toggle("show-nav");
      });
    }
  }

  function whenReady(){
    if (document.getElementById('navMenu')) { fix(); setupMenuToggle(); return; }
    try {
      const mo = new MutationObserver((_, obs) => {
        if (document.getElementById('navMenu')){ obs.disconnect(); fix(); setupMenuToggle(); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(()=>{ if (document.getElementById('navMenu')) { fix(); setupMenuToggle(); } }, 8000);
    } catch(e){ setTimeout(() => { if (document.getElementById('navMenu')) { fix(); setupMenuToggle(); } }, 0); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenReady);
  else whenReady();

  // expose for debugging
  window.fixHeaderLinks = fix;
})();
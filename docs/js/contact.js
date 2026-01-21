(function(){
  const form = document.getElementById('contactForm');
  const result = document.getElementById('contactResult');
  const clearBtn = document.getElementById('clearForm');
  function show(msg, ok=true){ result.hidden = false; result.textContent = msg; result.style.background = ok ? 'rgba(10,120,110,0.06)' : 'rgba(220,80,80,0.06)'; result.style.color = ok ? '#064' : '#8b1c1c'; }

  if (clearBtn) clearBtn.addEventListener('click', ()=>{ form.reset(); result.hidden=true; });

  // newsletter subscribe handler (also used by footer)
  const newsForm = document.getElementById('newsletterForm');
  if (newsForm) {
    newsForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const em = newsForm.querySelector('input[name="email"]');
      if (!em || !em.value) { alert('Enter your email'); return; }
      try { const s = JSON.parse(localStorage.getItem('newsletter')||'[]'); s.push({email: em.value, ts:Date.now()}); localStorage.setItem('newsletter', JSON.stringify(s)); } catch(e){}
      em.value=''; alert('Thanks — you have been subscribed (local demo).');
    });
  }

  if (!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = new FormData(form);
    const obj = Object.fromEntries(data.entries());
    // simple validation
    if (!obj.name || !obj.email || !obj.subject || !obj.message) { show('Please complete required fields', false); return; }

    // try to POST to /contact (if server exists), otherwise open mailto fallback and store to localStorage
    try {
      if (window.fetch && location.origin.indexOf('http') === 0) {
        // optimistic attempt — many dev setups have no backend
        const res = await fetch('/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
        if (res && res.ok) {
          show('Thanks — your message has been submitted. We will reply shortly.');
          form.reset(); return;
        }
      }
    } catch (e){ console.debug('contact submit proxy failed', e); }

    // fallback: store message locally and open mail client
    try {
      const stash = JSON.parse(localStorage.getItem('contact_messages') || '[]');
      stash.push({ ...obj, ts: Date.now() });
      localStorage.setItem('contact_messages', JSON.stringify(stash));
    } catch (e){}

    // mailto fallback (encode short body)
    try {
      const subject = encodeURIComponent(obj.subject || 'Contact from site');
      const body = encodeURIComponent(`Name: ${obj.name}\nEmail: ${obj.email}\nPhone: ${obj.phone || ''}\nOrder: ${obj.order || ''}\n\n${obj.message}`);
      window.location.href = `mailto:support@snowmarket.example?subject=${subject}&body=${body}`;
      show('Opening your mail client — or message saved locally for review.');
      form.reset();
    } catch (e) { show('Unable to open mail client — your message was saved locally.', false); }
  });
})();
document.addEventListener('DOMContentLoaded', () => {
    const dataEl = document.getElementById('heroProductsData');
    let products = [];
    try { products = JSON.parse(dataEl ? dataEl.textContent : '[]') || []; } catch (e) { products = []; }

    const slider = document.querySelector('.hero-slider');
    if (!slider) return;
    const track = slider.querySelector('.slides');
    const dots = slider.querySelector('.dots');
    const btnPrev = slider.querySelector('.slider-btn.prev');
    const btnNext = slider.querySelector('.slider-btn.next');

    function buildCards() {
        track.innerHTML = '';
        dots.innerHTML = '';
        products.forEach((p, i) => {
            const item = document.createElement('div');
            item.className = 'hero-card';
            item.setAttribute('role','listitem');
            item.innerHTML = `
                <a class="card-link" href="${p.url || '#'}">
                    <div class="card-img"><img src="${p.image}" alt="${p.title}"></div>
                    <div class="card-body">
                        <div class="card-title">${p.title}</div>
                        <div class="card-price">₦${p.price}</div>
                    </div>
                </a>`;
            track.appendChild(item);

            const dot = document.createElement('button');
            dot.className = 'dot';
            dot.setAttribute('aria-label', `Go to slide ${i+1}`);
            dot.addEventListener('click', () => { goToIndex(i); resetAutoplay(); });
            dots.appendChild(dot);
        });
    }

    let perPage = 3;
    function calcPerPage() {
        const w = window.innerWidth;
        if (w < 600) return 1;
        if (w < 900) return 2;
        return 3;
    }

    // `current` is the index of the center slide when perPage>=2.
    let current = 0;
    function updateLayout() {
        perPage = calcPerPage();
        document.documentElement.style.setProperty('--hero-per-page', perPage);
        if (products.length === 0) return;
        // initialize current to a sensible center if out of bounds
        if (current < 0 || current >= products.length) current = Math.min(Math.floor(perPage/2), products.length-1);
        applyTransform();
        updateDots();
        updateCardClasses();
    }

    function applyTransform() {
        const slidePercent = 100 / perPage;
        const offsetIndex = Math.max(0, current - Math.floor(perPage/2));
        track.style.transform = `translateX(-${offsetIndex * slidePercent}%)`;
    }

    function updateDots(){
        const dotEls = dots.querySelectorAll('.dot');
        dotEls.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    function goToIndex(i){
        current = Math.max(0, Math.min(i, products.length - 1));
        applyTransform();
        updateDots();
        updateCardClasses();
    }

    function updateCardClasses(){
        const cards = track.querySelectorAll('.hero-card');
        cards.forEach((c, i) => {
            c.classList.remove('center','tilt-left','tilt-right');
            if (i === current) c.classList.add('center');
            else if (i < current) c.classList.add('tilt-left');
            else c.classList.add('tilt-right');
        });
    }

    btnPrev.addEventListener('click', () => { goToIndex(current - 1); resetAutoplay(); });
    btnNext.addEventListener('click', () => { goToIndex(current + 1); resetAutoplay(); });

    // Pause / play
    const btnPause = slider.querySelector('.slider-btn.pause');
    let isPaused = false;
    if (btnPause) {
        function updatePauseUI(){ btnPause.textContent = isPaused ? '▶' : '❚❚'; }
        btnPause.addEventListener('click', () => { isPaused = !isPaused; if (isPaused) stopAutoplay(); else startAutoplay(); updatePauseUI(); });
        updatePauseUI();
    }

    // Keyboard navigation
    slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { goToIndex(current - 1); resetAutoplay(); }
        if (e.key === 'ArrowRight') { goToIndex(current + 1); resetAutoplay(); }
    });

    // Autoplay
    let autoplayId = null;
    function startAutoplay(){
        if (isPaused) return;
        stopAutoplay();
        autoplayId = setInterval(() => {
            // advance center index, wrap
            current = (current + 1) % products.length;
            applyTransform(); updateDots(); updateCardClasses();
        }, 3800);
    }
    function stopAutoplay(){ if (autoplayId) { clearInterval(autoplayId); autoplayId = null; } }
    function resetAutoplay(){ stopAutoplay(); startAutoplay(); }

    slider.addEventListener('mouseenter', stopAutoplay);
    slider.addEventListener('mouseleave', startAutoplay);

    // responsive
    window.addEventListener('resize', () => { updateLayout(); });

    // initialize
    buildCards();
    updateLayout();
    startAutoplay();

});

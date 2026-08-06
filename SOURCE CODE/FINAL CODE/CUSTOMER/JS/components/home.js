export function initHome(loadContentFunction) {
    console.log("Initializing Home Page...");

    document.querySelectorAll('.cus-nav-link').forEach(panel => {
        panel.addEventListener('click', () => {
            const pageName = panel.getAttribute('data-page');
            console.log("Navigating to:", pageName);

            if (typeof loadContentFunction === 'function') {
                loadContentFunction(pageName);
            } else {
                console.error("loadContentFunction is not provided!");
            }
        });
    });

    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.getElementById('banner-prev');
    const nextBtn = document.getElementById('banner-next');
    
    if (slides.length === 0) return;

    let currentSlide = 0;

    function goToSlide(index) {
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');

        currentSlide = (index + slides.length) % slides.length;
        
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));

    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            goToSlide(index);
        });
    });
}
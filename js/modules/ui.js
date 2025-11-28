// Inicializa todos os .swiper que ainda não foram iniciados
export function initPendingSwipers(rootEl = document) {
    if (typeof Swiper === 'undefined') return; // Swiper ainda não carregou
    const nodes = rootEl.querySelectorAll('.swiper:not(.is-init)');

    nodes.forEach(node => {
        const badgeCurrentEl = node.querySelector('.media-count-badge .mc-current');

        const updateBadge = (sw) => {
            if (!badgeCurrentEl) return;
            const idx = (typeof sw.realIndex === 'number' ? sw.realIndex : sw.activeIndex) + 1;
            badgeCurrentEl.textContent = String(idx);
        };

        const swiper = new Swiper(node, {
            loop: false,
            spaceBetween: 10,
            autoHeight: true,
            pagination: { el: node.querySelector('.swiper-pagination'), clickable: true },
            on: {
                init: updateBadge,
                slideChange: updateBadge
            }
        });

        node.classList.add('is-init');
    });
}

export function renderGallery(images) {
    if (!images || !images.length) return '';

    if (images.length === 1) {
        return `<img src="${images[0]}" class="memory-photo mb-3 w-100 rounded" alt="memória">`;
    }

    const cid = 'swiper-' + Math.random().toString(36).slice(2);
    const total = images.length;

    return `
    <div class="swiper mySwiper mb-3" id="${cid}">
      <div class="media-count-badge"><span class="mc-current">1</span>/${total}</div>
      <div class="swiper-wrapper">
        ${images.map(src => `
          <div class="swiper-slide">
            <img src="${src}" class="memory-photo w-100 rounded" alt="memória">
          </div>
        `).join('')}
      </div>
      <div class="swiper-pagination"></div>
    </div>
  `;
}

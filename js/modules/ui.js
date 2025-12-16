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

export function showToast(message, type = 'primary', options = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const { duration = 4000 } = options;

  const id = 'toast-' + Math.random().toString(36).slice(2);
  const bgClass = type === 'success' ? 'text-bg-success' :
    type === 'danger' ? 'text-bg-danger' :
      type === 'warning' ? 'text-bg-warning' : 'text-bg-primary';

  const icon = type === 'success' ? 'bi-check-circle-fill' :
    type === 'danger' ? 'bi-exclamation-octagon-fill' :
      type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';

  const toastHtml = `
        <div id="${id}" class="toast toast-modern align-items-center ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex align-items-center">
                <div class="toast-body d-flex align-items-center gap-2">
                    <i class="bi ${icon}"></i>
                    <span>${message}</span>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
            </div>
        </div>
    `;

  container.insertAdjacentHTML('beforeend', toastHtml);

  const toastEl = document.getElementById(id);
  const toast = new bootstrap.Toast(toastEl, { delay: duration, autohide: true });

  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });

  toast.show();
}

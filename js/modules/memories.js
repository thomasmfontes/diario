import { db } from './config.js';
import { formatDate, toBase64Compressed } from './utils.js';
import { renderGallery, initPendingSwipers } from './ui.js';

let currentOrder = 'asc';
let pendingDelete = null;

export function initMemories() {
    const form = document.getElementById('memoryForm');
    const imageInput = document.getElementById('images');
    const orderToggle = document.getElementById('orderToggle');
    const orderIcon = document.getElementById('orderIcon');

    // Image input listener
    imageInput.addEventListener('change', () => {
        const files = Array.from(imageInput.files || []);
        imageInput.nextElementSibling.textContent = files.length
            ? `${files.length} selecionada(s)`
            : 'Nenhuma selecionada';
    });

    // Form submit listener
    form.addEventListener('submit', async e => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const spinner = submitBtn.querySelector('.spinner-border');
        const btnText = submitBtn.querySelector('span:not(.spinner-border)');
        const originalBtnText = btnText.textContent; // Changed from submitBtn.textContent to btnText.textContent

        try {
            // UI Feedback
            submitBtn.disabled = true;
            spinner.classList.remove('d-none');
            btnText.textContent = 'Salvando...';
            // document.getElementById('loadingSpinner').classList.remove('d-none'); // Removed global spinner usage for this action

            const files = Array.from(imageInput.files || []);

            // Validate file sizes (optional check before processing)
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            const largeFiles = files.filter(f => f.size > MAX_SIZE);
            if (largeFiles.length > 0) {
                throw new Error(`Algumas imagens são muito grandes (>10MB): ${largeFiles.map(f => f.name).join(', ')}`);
            }

            const images = await Promise.all(files.map(f => toBase64Compressed(f)));

            const memory = {
                title: form.title.value,
                message: form.message.value,
                date: form.memoryDate.value,
                autor: form.autor.value,
                images: images.length ? images : null
            };

            await db.collection('memories').add(memory);

            loadMemories();
            form.reset();
            imageInput.nextElementSibling.textContent = 'Nenhuma selecionada';

            // Success feedback
            alert('Memória salva com sucesso!');

        } catch (error) {
            console.error('Erro em handleAddImages:', error); // Log original error
            const msg = error instanceof Error ? error.message : String(error); // Extract message safe
            alert(`Erro ao salvar: ${msg}`);
        } finally {
            // Restore UI
            submitBtn.disabled = false;
            spinner.classList.add('d-none');
            btnText.textContent = originalBtnText;
            // document.getElementById('loadingSpinner').classList.add('d-none');
        }
    });

    // Order toggle listener
    orderToggle.addEventListener('click', () => {
        currentOrder = currentOrder === 'desc' ? 'asc' : 'desc';
        orderIcon.classList.toggle('rotate-180');
        loadMemories();
    });

    // Expose functions for onclick handlers
    window.openAddImages = openAddImages;
    window.showModal = showModal;
    window.confirmDelete = confirmDelete;
}

export function loadMemories() {
    const container = document.getElementById('memoriesContainer');
    const progressThomas = document.getElementById('progress-thomas');
    const progressGabriela = document.getElementById('progress-gabriela');
    const countTotalEl = document.getElementById('count-total');

    container.innerHTML = '';
    document.getElementById('loadingSpinner').classList.remove('d-none');

    db.collection('memories').orderBy('date', currentOrder).get().then(snapshot => {
        let countThomas = 0, countGabriela = 0, countTotal = 0;

        snapshot.forEach(doc => {
            const data = { ...doc.data(), id: doc.id };
            addMemoryCard(data, container);
            countTotal++;
            if (data.autor === 'Thomas') countThomas++;
            if (data.autor === 'Gabriela') countGabriela++;
        });

        updateProgressBar(countThomas, countGabriela, countTotal, progressThomas, progressGabriela, countTotalEl);

        document.getElementById('loadingSpinner').classList.add('d-none');

        // após carregar todos os cards, inicializar sliders
        initPendingSwipers();
    });
}

function updateProgressBar(thomasCount, gabrielaCount, total, progressThomas, progressGabriela, countTotalEl) {
    const thomasPercent = total ? (thomasCount / total) * 100 : 0;
    const gabrielaPercent = total ? (gabrielaCount / total) * 100 : 0;

    progressThomas.style.width = `${thomasPercent}%`;
    progressThomas.textContent = thomasCount || '';
    progressGabriela.style.width = `${gabrielaPercent}%`;
    progressGabriela.textContent = gabrielaCount || '';
    countTotalEl.textContent = total;
}

function addMemoryCard({ title, message, images, image, date, autor, id }, container) {
    // compat docs antigos: "image" string -> vira array
    if (!images && image) images = [image];

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';

    const gallery = renderGallery(images);

    const card = document.createElement('div');
    card.className = 'card memory-card p-3 show';
    card.innerHTML = `
  <div class="d-flex justify-content-between align-items-start">
    <h5 class="card-title text-primary">${title}</h5>
    <div class="autor-dot ${autor === 'Thomas' ? 'dot-thomas' : 'dot-gabriela'}"></div>
  </div>
  <p class="card-text">${message}</p>
  ${gallery}
  <div class="d-flex justify-content-between align-items-center">
    <span class="text-muted small">${formatDate(date)}</span>
    <div class="btn-group" role="group" aria-label="Ações">
      <button type="button"
              class="btn btn-sm btn-outline-secondary icon-btn"
              title="Adicionar fotos" aria-label="Adicionar fotos"
              onclick="openAddImages('${id}')">
        <i class="bi bi-images"></i>
      </button>
      <button type="button"
              class="btn btn-sm btn-outline-danger icon-btn"
              title="Excluir" aria-label="Excluir"
              onclick="showModal('${id}')">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  </div>
`;

    col.appendChild(card);
    container.prepend(col);

    // inicializa qualquer swiper recém-inserido
    initPendingSwipers(card);

    setTimeout(() => card.style.opacity = 1, 50);
}

let addPicker = null;
let addTargetId = null;

function ensureAddPicker() {
    if (addPicker) return addPicker;
    addPicker = document.createElement('input');
    addPicker.type = 'file';
    addPicker.accept = 'image/*';
    addPicker.multiple = true;
    addPicker.className = 'd-none';
    document.body.appendChild(addPicker);
    addPicker.addEventListener('change', handleAddImages);
    return addPicker;
}

function openAddImages(memoryId) {
    addTargetId = memoryId;
    ensureAddPicker().click();
}

async function handleAddImages() {
    try {
        const files = Array.from(addPicker.files || []);
        if (!files.length || !addTargetId) { addTargetId = null; return; }

        // comprime para base64 (aproveita sua toBase64Compressed)
        const newImages = await Promise.all(files.map(f => toBase64Compressed(f)));

        const docRef = db.collection('memories').doc(addTargetId);

        // transaction para manter compat e não perder a foto antiga (campo "image")
        await firebase.firestore().runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists) throw new Error('Memória não encontrada');

            const d = snap.data() || {};
            let imagesArr = [];

            if (Array.isArray(d.images)) imagesArr = d.images.slice();
            else if (typeof d.image === 'string') imagesArr = [d.image];

            imagesArr.push(...newImages);

            const updates = {
                images: imagesArr,
            };
            if (d.image) {
                updates.image = firebase.firestore.FieldValue.delete(); // remove campo antigo
            }
            tx.update(docRef, updates);
        });

        addPicker.value = '';
        addTargetId = null;

        // recarrega lista para refletir as novas fotos
        await loadMemories();
    } catch (err) {
        console.error('Erro em handleAddImages:', err);
        const msg = err instanceof Error ? err.message : String(err);
        alert('Falha ao adicionar fotos: ' + msg);
    }
}

function showModal(id) {
    pendingDelete = id;
    new bootstrap.Modal('#confirmModal').show();
}

function confirmDelete() {
    if (pendingDelete) {
        db.collection('memories').doc(pendingDelete).delete().then(() => loadMemories());
        pendingDelete = null;
    }
    bootstrap.Modal.getInstance('#confirmModal').hide();
}

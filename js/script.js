const firebaseConfig = {
    apiKey: "AIzaSyDpGm8cbfEo2HnbAETxev1fZg9M9LDats4",
    authDomain: "nosso-diario-bdb66.firebaseapp.com",
    projectId: "nosso-diario-bdb66",
    storageBucket: "nosso-diario-bdb66.firebasestorage.app",
    messagingSenderId: "555433356561",
    appId: "1:555433356561:web:1918c584efe64fb8e8f0b0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const form = document.getElementById('memoryForm');
const container = document.getElementById('memoriesContainer');
const imageInput = document.getElementById('images'); // múltiplas imagens
const orderToggle = document.getElementById('orderToggle');
const orderIcon = document.getElementById('orderIcon');
const progressThomas = document.getElementById('progress-thomas');
const progressGabriela = document.getElementById('progress-gabriela');
const countTotalEl = document.getElementById('count-total');
const easterEggTrigger = document.getElementById('easterEggTrigger');
const easterEggForm = document.getElementById('easterEggForm');

const sendMessageForm = document.getElementById('sendMessageForm');
const toUser = document.getElementById('toUser');
const messageText = document.getElementById('messageText');
const popupMessageContent = document.getElementById('popupMessageContent');

// ===== Correção só com LanguageTool (pt-BR) =====
(function () {
    const messageEl = document.getElementById('message');
    const btn = document.getElementById('spellCheckBtn');
    const statusEl = document.getElementById('spellStatus');
    if (!messageEl || !btn || !statusEl) return;

    const LT_URL = 'https://api.languagetool.org/v2/check';
    const LT_LANG = 'pt-BR';
    const LT_TIMEOUT_MS = 12000;
    const MIN_LOADING_MS = 3000; // duração mínima do loading

    // --- status com fade suave e sem "soco" visual ---
    let statusHideTimer = null;
    function showStatus(msg, { autoHideMs } = {}) {
        if (statusHideTimer) { clearTimeout(statusHideTimer); statusHideTimer = null; }
        statusEl.textContent = msg || '';
        // reinicia a transição
        statusEl.classList.remove('is-visible');
        void statusEl.offsetWidth;
        statusEl.classList.add('is-visible');
        if (autoHideMs != null) {
            statusHideTimer = setTimeout(hideStatus, autoHideMs);
        }
    }
    function hideStatus() {
        if (statusHideTimer) { clearTimeout(statusHideTimer); statusHideTimer = null; }
        statusEl.classList.remove('is-visible');
        setTimeout(() => { statusEl.textContent = ''; }, 250);
    }

    const clean = (t) => String(t || '')
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    const ensurePeriod = (t) => /[.!?…]$/.test(t) ? t : (t ? t + '.' : t);

    let inFlight; // AbortController

    async function ltCheck(text) {
        if (inFlight) inFlight.abort();
        inFlight = new AbortController();
        const to = setTimeout(() => inFlight.abort(), LT_TIMEOUT_MS);
        try {
            const r = await fetch(LT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ text, language: LT_LANG }),
                signal: inFlight.signal
            });
            if (!r.ok) throw new Error('LanguageTool indisponível');
            return await r.json();
        } finally {
            clearTimeout(to);
            inFlight = null;
        }
    }

    function applyLtCorrections(text, matches) {
        const sorted = (matches || []).sort((a, b) => (b.offset + b.length) - (a.offset + a.length));
        let out = text;
        for (const m of sorted) {
            const rep = m.replacements?.[0]?.value; if (!rep) continue;
            out = out.slice(0, m.offset) + rep + out.slice(m.offset + m.length);
        }
        return out;
    }

    async function correctMessage(text) {
        let t = text;
        const r1 = await ltCheck(t);
        t = applyLtCorrections(t, r1.matches);
        t = ensurePeriod(clean(t));
        try {
            const r2 = await ltCheck(t);
            t = applyLtCorrections(t, r2.matches);
        } catch { }
        t = clean(t);
        if (!/[.!?…]$/.test(t)) t += '.';
        if (t.length > 20000) t = t.slice(0, 20000).trim();
        return t;
    }

    btn.addEventListener('click', async () => {
        const originalMsg = (messageEl.value || '').trim();
        if (!originalMsg) { showStatus('Digite algo para corrigir.', { autoHideMs: 2000 }); return; }

        const startedAt = performance.now();

        try {
            btn.disabled = true;
            messageEl.readOnly = true;
            messageEl.classList.add('loading');
            showStatus('Verificando ortografia/gramática…');

            const corrected = await correctMessage(originalMsg);

            const elapsed = performance.now() - startedAt;
            if (elapsed < MIN_LOADING_MS) {
                await new Promise(r => setTimeout(r, MIN_LOADING_MS - elapsed));
            }

            messageEl.value = corrected;
            showStatus('Correção aplicada.', { autoHideMs: 2000 });
        } catch (e) {
            console.error(e);
            showStatus(e.name === 'AbortError' ? 'Operação cancelada.' : 'Falhou a correção.');
        } finally {
            messageEl.classList.remove('loading');
            messageEl.readOnly = false;
            btn.disabled = false;
        }
    });
})();

// --- Cartinhas (lista + filtro radios) ---
const btnCartinhas = document.getElementById('btn-cartinhas');
const cartinhasModalEl = document.getElementById('cartinhasModal');
const cartinhasModal = new bootstrap.Modal(cartinhasModalEl);

const listaCartinhas = document.getElementById('lista-cartinhas');
const skeletonCartinhas = document.getElementById('skeleton-cartinhas');
const filtroRadios = document.querySelectorAll('input[name="filtroCartinhas"]');

let currentOrder = 'asc';
let pendingDelete = null;
let currentUser = localStorage.getItem('currentUser');
let currentMessageDoc = null;
let unsubscribeCartinhas = null;

window.addEventListener('load', () => {
    if (!currentUser || (currentUser !== 'Thomas' && currentUser !== 'Gabriela')) {
        new bootstrap.Modal('#userSelectModal').show();
    } else {
        init();
    }
    resetEasterEgg();

    // garante que sliders existentes sejam inicializados após o Swiper carregar
    initPendingSwipers();
});

function init() {
    updateUserUI();
    loadMemories();
    checkForMessage();
}

// Abrir modal + aplicar filtro salvo
btnCartinhas.addEventListener('click', () => {
    cartinhasModal.show();
    const salvo = localStorage.getItem('filtroCartinhas') || 'todas';
    const r = document.querySelector(`input[name="filtroCartinhas"][value="${salvo}"]`);
    if (r) r.checked = true;
    carregarCartinhas(salvo);
});

// Troca de filtro
filtroRadios.forEach(r =>
    r.addEventListener('change', (e) => {
        const v = e.target.value;
        localStorage.setItem('filtroCartinhas', v);
        carregarCartinhas(v);
    })
);

// Evita warning de aria-hidden, limpa listener e devolve foco
cartinhasModalEl.addEventListener('hide.bs.modal', () => {
    const f = document.activeElement;
    if (f && cartinhasModalEl.contains(f)) f.blur();
});
cartinhasModalEl.addEventListener('hidden.bs.modal', () => {
    if (unsubscribeCartinhas) { unsubscribeCartinhas(); unsubscribeCartinhas = null; }
    btnCartinhas?.focus();
});

// Carrega/observa cartinhas
function carregarCartinhas(destino) {
    if (unsubscribeCartinhas) { unsubscribeCartinhas(); unsubscribeCartinhas = null; }

    let ref = db.collection('messages');
    if (destino && destino !== 'todas') ref = ref.where('to', '==', destino); // precisa índice com orderBy
    ref = ref.orderBy('createdAt', 'desc');

    listaCartinhas.innerHTML = '';
    skeletonCartinhas?.classList.remove('d-none');

    unsubscribeCartinhas = ref.onSnapshot(snap => {
        skeletonCartinhas?.classList.add('d-none');
        listaCartinhas.innerHTML = '';

        if (snap.empty) {
            listaCartinhas.innerHTML = '<div class="text-center text-muted py-3">Nenhuma cartinha.</div>';
            return;
        }

        snap.forEach(doc => {
            const d = doc.data();
            const dtObj = d.createdAt?.toDate ? d.createdAt.toDate() : null;
            const dt = dtObj
                ? `${dtObj.toLocaleDateString('pt-BR')} - ${dtObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : '(sem data)';

            const el = document.createElement('div');
            el.className = 'carta-item';
            el.innerHTML = `
    <div class="linha">
      <span class="chip de">De: ${d.from || '-'}</span>
      <span class="chip ${d.to === 'Thomas' ? 'para-thomas' : 'para-gabriela'}">Para: ${d.to || '-'}</span>
      <span class="chip status ${d.read ? 'lida' : 'nao-lida'}">${d.read ? 'Lida' : 'Não lida'}</span>
    </div>
    <div class="texto">${(d.text || '').trim()}</div>
    <div class="data">${dt}</div>
  `;
            listaCartinhas.appendChild(el);
        });

    }, err => {
        skeletonCartinhas?.classList.add('d-none');
        console.error(err);
        listaCartinhas.innerHTML = `<div class="text-danger">Erro: ${err.message}</div>`;
    });
}

function setUser(user) {
    localStorage.setItem('currentUser', user);
    currentUser = user;

    bootstrap.Modal.getInstance('#userSelectModal').hide();

    resetEasterEgg();
    init();
}

function trocarUsuario() {
    localStorage.removeItem('currentUser');
    resetEasterEgg();
    new bootstrap.Modal('#userSelectModal').show();
}

function updateUserUI() {
    const badge = document.getElementById('currentUserBadge');
    const switcher = document.getElementById('userSwitcher');
    const messageToLabel = document.getElementById('messageToLabel');

    if (badge) badge.textContent = currentUser;

    if (switcher) {
        switcher.classList.remove('btn-outline-secondary', 'btn-gabriela', 'btn-thomas');
        if (currentUser === 'Thomas') switcher.classList.add('btn-thomas');
        if (currentUser === 'Gabriela') switcher.classList.add('btn-gabriela');
    }

    if (toUser && messageToLabel) {
        const otherUser = currentUser === 'Thomas' ? 'Gabriela' : 'Thomas';
        toUser.value = otherUser;

        messageToLabel.textContent = otherUser;

        messageToLabel.classList.remove('text-thomas', 'text-gabriela');
        if (otherUser === 'Thomas') {
            messageToLabel.classList.add('text-thomas');
        } else if (otherUser === 'Gabriela') {
            messageToLabel.classList.add('text-gabriela');
        }
    }
}

function resetEasterEgg() {
    easterEggForm?.classList.add('d-none');
}

easterEggTrigger?.addEventListener('click', () => {
    easterEggForm?.classList.toggle('d-none');
});

imageInput.addEventListener('change', () => {
    const files = Array.from(imageInput.files || []);
    imageInput.nextElementSibling.textContent = files.length
        ? `${files.length} selecionada(s)`
        : 'Nenhuma selecionada';
});

form.addEventListener('submit', async e => {
    e.preventDefault();

    const files = Array.from(imageInput.files || []);
    const images = await Promise.all(files.map(f => toBase64Compressed(f)));

    const memory = {
        title: form.title.value,
        message: form.message.value,
        date: form.memoryDate.value,
        autor: form.autor.value,
        images: images.length ? images : null
    };

    db.collection('memories').add(memory).then(() => {
        loadMemories();
        form.reset();
        imageInput.nextElementSibling.textContent = 'Nenhuma selecionada';
    });
});

orderToggle.addEventListener('click', () => {
    currentOrder = currentOrder === 'desc' ? 'asc' : 'desc';
    orderIcon.classList.toggle('rotate-180');
    loadMemories();
});

sendMessageForm.addEventListener('submit', e => {
    e.preventDefault();

    const message = {
        to: toUser.value,
        from: currentUser,
        text: messageText.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    };

    db.collection('messages').add(message).then(() => {
        messageText.value = '';

        const toastEl = document.getElementById('messageToast');
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    });

});

function checkForMessage() {
    db.collection('messages')
        .where('to', '==', currentUser)
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const msg = doc.data();

                // só mostra se não fui eu mesmo que enviei
                if (msg.from !== currentUser) {
                    currentMessageDoc = doc.ref;

                    popupMessageContent.textContent = msg.text;
                    const modal = new bootstrap.Modal(document.getElementById('popupMessageModal'));
                    modal.show();
                }
            }
        });
}

document.getElementById('markAsReadBtn').addEventListener('click', () => {
    if (currentMessageDoc) {
        currentMessageDoc.update({ read: true });
        currentMessageDoc = null;

        const modalEl = document.getElementById('popupMessageModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
    }
});

function loadMemories() {
    container.innerHTML = '';
    document.getElementById('loadingSpinner').classList.remove('d-none');

    db.collection('memories').orderBy('date', currentOrder).get().then(snapshot => {
        let countThomas = 0, countGabriela = 0, countTotal = 0;

        snapshot.forEach(doc => {
            const data = { ...doc.data(), id: doc.id };
            addMemoryCard(data);
            countTotal++;
            if (data.autor === 'Thomas') countThomas++;
            if (data.autor === 'Gabriela') countGabriela++;
        });

        updateProgressBar(countThomas, countGabriela, countTotal);

        document.getElementById('loadingSpinner').classList.add('d-none');

        // após carregar todos os cards, inicializar sliders
        initPendingSwipers();
    });
}

function updateProgressBar(thomasCount, gabrielaCount, total) {
    const thomasPercent = total ? (thomasCount / total) * 100 : 0;
    const gabrielaPercent = total ? (gabrielaCount / total) * 100 : 0;

    progressThomas.style.width = `${thomasPercent}%`;
    progressThomas.textContent = thomasCount || '';
    progressGabriela.style.width = `${gabrielaPercent}%`;
    progressGabriela.textContent = gabrielaCount || '';
    countTotalEl.textContent = total;
}

function addMemoryCard({ title, message, images, image, date, autor, id }) {
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
        console.error(err);
        alert('Falha ao adicionar fotos: ' + (err?.message || err));
    }
}

// ---- GALERIA (Swiper) ----
function renderGallery(images) {
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

// Inicializa todos os .swiper que ainda não foram iniciados
function initPendingSwipers(rootEl = document) {
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

function formatDate(dateStr) {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${dd}-${mm}-${yyyy}`;
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

function toBase64Compressed(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const img = new Image();
            img.src = reader.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleFactor = Math.min(1, maxWidth / img.width || 1);
                canvas.width = Math.round(img.width * scaleFactor);
                canvas.height = Math.round(img.height * scaleFactor);

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

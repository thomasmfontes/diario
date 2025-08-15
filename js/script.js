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
const imageInput = document.getElementById('image');
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

// =============== IA no navegador com WebLLM (GRÁTIS) ===============
(function () {
  const input  = document.getElementById('messageText');
  if (!input) return;

  // Pega/Cria controles
  let select = document.getElementById('tone');
  let btn    = document.getElementById('aiSuggestBtn');
  let status = document.getElementById('aiStatus');

  if (!select || !btn || !status) {
    const wrap = document.createElement('div');
    wrap.className = 'd-flex gap-2 mt-2 align-items-center flex-wrap';

    select = document.createElement('select');
    select.id = 'tone';
    select.className = 'form-select';
    select.style.maxWidth = '220px';
    ['romântica','fofa','sincera','engraçada','apaziguadora'].forEach((t, i) => {
      const op = document.createElement('option');
      op.value = t; op.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (i === 0) op.selected = true;
      select.appendChild(op);
    });

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'aiSuggestBtn';
    btn.className = 'btn btn-outline-secondary';
    btn.textContent = 'Aprimorar ✨';

    status = document.createElement('small');
    status.id = 'aiStatus';
    status.className = 'text-muted d-block';
    status.style.minHeight = '1.25rem';

    input.insertAdjacentElement('afterend', wrap);
    wrap.appendChild(select);
    wrap.appendChild(btn);
    wrap.insertAdjacentElement('afterend', status);
  }

  // ---------- Engine WebLLM ----------
  let engine = null; // webllm engine
  let loading = false;

  function setStatus(m){ if (status) status.textContent = m || ''; }

  async function ensureEngine() {
    if (engine) return engine;
    if (loading) return engine;
    loading = true;

    setStatus('Carregando IA (baixando modelo)...');
    const prefer  = 'Qwen2-0.5B-Instruct-q4f32_1-MLC';
    const fallback = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

    // barra de progresso opcional
    const initProgressCallback = (p) => {
      if (!p || !p.text) return;
      // exemplo: "Download xx%" / "Compile..." etc.
      setStatus(p.text);
    };

    try {
      engine = await webllm.CreateMLCEngine(prefer, { initProgressCallback });
    } catch (_) {
      engine = await webllm.CreateMLCEngine(fallback, { initProgressCallback });
    }

    setStatus('IA pronta ✨');
    return engine;
  }

  function buildMessages(text, tone) {
    const system = `Você reescreve mensagens curtas em pt-BR:
- Corrija gramática e acentuação.
- Mantenha o sentido e o nome da pessoa.
- Dê um tom ${tone}, sem clichês.
- No máx. 240 caracteres.
- Responda com UMA única frase final, sem explicações.`;
    const user = `Reescreva a mensagem: "${text}"`;
    return [
      { role: 'system', content: system },
      { role: 'user',   content: user }
    ];
  }

  async function improve(text, tone) {
    const eng = await ensureEngine();
    const res = await eng.chat.completions.create({
      messages: buildMessages(text, tone),
      temperature: 0.6,
      max_tokens: 120
    });

    let out = res?.choices?.[0]?.message?.content || '';
    out = out.replace(/^["“”']+|["“”']+$/g, '').trim();
    if (out.length > 240) out = out.slice(0, 240).trim();
    return out;
  }

  // Clique do botão
  btn.addEventListener('click', async () => {
    const original = (input.value || '').trim();
    if (!original) { setStatus('Digite algo primeiro 🙂'); input.focus(); return; }

    try {
      setStatus('Gerando sugestão...');
      const suggestion = await improve(original, select.value);
      input.value = suggestion || original;
      setStatus('Sugestão aplicada.');
    } catch (e) {
      console.error(e);
      setStatus('Erro na IA. Recarregue a página.');
    }
  });

  // Pré-carrega em ociosidade
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => ensureEngine().catch(console.warn));
  } else {
    setTimeout(() => ensureEngine().catch(console.warn), 1200);
  }
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
    const file = imageInput.files[0];
    imageInput.nextElementSibling.textContent = file ? file.name : 'Nenhuma selecionada';
});

form.addEventListener('submit', async e => {
    e.preventDefault();

    const memory = {
        title: form.title.value,
        message: form.message.value,
        date: form.memoryDate.value,
        autor: form.autor.value,
        image: imageInput.files[0] ? await toBase64Compressed(imageInput.files[0]) : null
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

function addMemoryCard({ title, message, image, date, autor, id }) {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';

    const card = document.createElement('div');
    card.className = 'card memory-card p-3 show';
    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <h5 class="card-title text-primary">${title}</h5>
            <div class="autor-dot ${autor === 'Thomas' ? 'dot-thomas' : 'dot-gabriela'}"></div>
        </div>
        <p class="card-text">${message}</p>
        ${image ? `<img src="${image}" class="memory-photo mb-3" alt="memória">` : ''}
        <div class="d-flex justify-content-between text-muted small">
            <span>${formatDate(date)}</span>
            <button class="btn btn-sm btn-outline-danger" onclick="showModal('${id}')">Excluir</button>
        </div>
    `;

    col.appendChild(card);
    container.prepend(col);

    setTimeout(() => card.style.opacity = 1, 50);
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
                const scaleFactor = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleFactor;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });

}






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

// ===== IA Turbo (WebLLM) + fallback Leve (LanguageTool) =====
(function () {
  const input  = document.getElementById('messageText');
  if (!input) return;

  // UI
  let select = document.getElementById('tone');
  let btn    = document.getElementById('aiSuggestBtn');
  let status = document.getElementById('aiStatus');
  if (!select || !btn || !status) {
    const wrap = document.createElement('div'); wrap.className = 'd-flex gap-2 mt-2 flex-wrap align-items-center';
    select = document.createElement('select'); select.id='tone'; select.className='form-select'; select.style.maxWidth='220px';
    ['romântica','fofa','sincera','engraçada','apaziguadora'].forEach((t,i)=>{ const op=document.createElement('option'); op.value=t; op.textContent=t[0].toUpperCase()+t.slice(1); if(!i) op.selected=true; select.appendChild(op); });
    btn = document.createElement('button'); btn.type='button'; btn.id='aiSuggestBtn'; btn.className='btn btn-outline-secondary'; btn.textContent='Aprimorar ✨';
    status = document.createElement('small'); status.id='aiStatus'; status.className='text-muted d-block'; status.style.minHeight='1.25rem';
    input.insertAdjacentElement('afterend', wrap); wrap.appendChild(select); wrap.appendChild(btn); wrap.insertAdjacentElement('afterend', status);
  }
  const setStatus = (m)=> status && (status.textContent = m || '');

  // ---------- TURBO (gera novo texto) ----------
  let engine = null, turboReady = false;
  async function tryInitTurbo() {
    if (engine || turboReady) return turboReady;
    // só ativa turbo em HTTPS e com WebGPU e lib carregada
    if (location.protocol !== 'https:' && location.hostname.indexOf('localhost') === -1) return false;
    if (!('gpu' in navigator)) return false;
    if (!window.webllm) return false;

    setStatus('Carregando IA (turbo)...');
    const prefer='Qwen2-0.5B-Instruct-q4f32_1-MLC', fallback='Llama-3.2-1B-Instruct-q4f32_1-MLC';
    const initProgressCallback = (p)=>{ if (p?.text) setStatus(p.text); };
    try {
      engine = await window.webllm.CreateMLCEngine(prefer,   { initProgressCallback });
    } catch (_) {
      try { engine = await window.webllm.CreateMLCEngine(fallback, { initProgressCallback }); }
      catch { engine = null; }
    }
    turboReady = !!engine;
    setStatus(turboReady ? 'Turbo ativo ✨' : 'Modo leve ativo');
    return turboReady;
  }

  function turboMessages(text, tone){
    const sys = `Você reescreve mensagens curtas em pt-BR, mantendo sentido, corrigindo gramática e acentuação.
Dê um tom ${tone} sem clichês. Máximo 240 caracteres. Responda com UMA frase final, sem explicações.`;
    return [{role:'system',content:sys},{role:'user',content:`Reescreva a mensagem: "${text}"`}];
  }

  async function improveTurbo(text, tone){
    if (!engine) throw new Error('no-engine');
    const res = await engine.chat.completions.create({
      messages: turboMessages(text, tone),
      temperature: 0.6,
      max_tokens: 120
    });
    let out = res?.choices?.[0]?.message?.content || '';
    out = out.replace(/^["'“”]+|["'“”]+$/g,'').trim();
    if (out.length>240) out = out.slice(0,240).trim();
    return out;
  }

  // ---------- LEVE (corrige + reformula simples) ----------
  async function grammarFixPTBR(text){
    try{
      const r = await fetch('https://api.languagetool.org/v2/check',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({text, language:'pt-BR'})
      });
      const data = await r.json();
      let out = text;
      const matches = (data.matches||[]).sort((a,b)=> (b.offset+b.length)-(a.offset+a.length));
      for(const m of matches){ if(!m.replacements?.length) continue;
        out = out.slice(0,m.offset)+m.replacements[0].value+out.slice(m.offset+m.length);
      }
      return out;
    } catch { return text; }
  }
  function normalize(t){ t=(t||'').trim().replace(/^["'“”]+|["'“”]+$/g,'').replace(/\s+/g,' '); return t; }
  function ensurePeriod(t){ return /[.!?…]$/.test(t)?t:t+'.'; }
  function applyTone(t,tone){
    t = normalize(t);
    switch(tone){
      case 'romântica': t = ensurePeriod(t); t += t.endsWith('❤')?'':' ❤'; break;
      case 'fofa': t = ensurePeriod(t); t += ' Com carinho.'; break;
      case 'sincera': t = ensurePeriod(t); break;
      case 'engraçada': t = ensurePeriod(t.replace(/!{2,}/g,'!')); break;
      case 'apaziguadora': t = ensurePeriod(t)+' Se errei, desculpa.'; break;
    }
    if (t.length>240) t=t.slice(0,240).trim();
    return t;
  }
  async function improveLeve(text,tone){
    const fixed = await grammarFixPTBR(text);
    // pequena reordenação pra parecer reescrita
    let t = fixed.replace(/^(\w+),\s*(.+)$/,'$2, $1'); // “Gabriela, te amo” -> “Te amo, Gabriela”
    t = t.replace(/\beu te\b/gi,'te');                // simplifica
    return applyTone(t,tone);
  }

  // ---------- Ação ----------
  btn.addEventListener('click', async () => {
    const original = (input.value||'').trim();
    if (!original){ setStatus('Digite algo primeiro 🙂'); input.focus(); return; }

    try{
      // tenta turbo se possível
      const turbo = await tryInitTurbo();
      setStatus('Gerando sugestão...');
      const out = turbo ? await improveTurbo(original, select.value)
                        : await improveLeve(original,  select.value);
      input.value = out || original;
      setStatus(turbo ? 'Sugestão aplicada (turbo).' : 'Sugestão aplicada (modo leve).');
    }catch(e){
      console.error(e);
      setStatus('Falhou agora. Tente de novo.');
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








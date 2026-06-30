import { db } from './config.js';
import { showToast } from './ui.js';
import { getCurrentUser } from './user.js';

let unsubscribeCartinhas = null;
let currentMessageDoc = null;
let cachedLetters = [];
let activeFilter = 'todas';

export function initMessages() {
    const btnCartinhas = document.getElementById('btn-cartinhas');
    const cartinhasModalEl = document.getElementById('cartinhasModal');
    const cartinhasModal = new bootstrap.Modal(cartinhasModalEl);
    const filtroRadios = document.querySelectorAll('input[name="filtroCartinhas"]');
    const sendMessageForm = document.getElementById('sendMessageForm');
    const toUser = document.getElementById('toUser');
    const messageText = document.getElementById('messageText');
    const markAsReadBtn = document.getElementById('markAsReadBtn');

    // Abrir modal + aplicar filtro salvo
    btnCartinhas.addEventListener('click', () => {
        cartinhasModal.show();
        const salvo = localStorage.getItem('filtroCartinhas') || 'todas';
        activeFilter = salvo;
        const r = document.querySelector(`input[name="filtroCartinhas"][value="${salvo}"]`);
        if (r) r.checked = true;
        iniciarEscutaCartinhas();
    });

    // Troca de filtro
    filtroRadios.forEach(r =>
        r.addEventListener('change', (e) => {
            const v = e.target.value;
            localStorage.setItem('filtroCartinhas', v);
            activeFilter = v;
            renderCartinhas();
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

    // Send Message Form
    sendMessageForm.addEventListener('submit', e => {
        e.preventDefault();

        const currentUser = getCurrentUser();
        const message = {
            to: toUser.value,
            from: currentUser,
            text: messageText.value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        };

        db.collection('messages').add(message).then(() => {
            // Disparar notificação via Vercel API
            fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: '💌 Você recebeu uma cartinha!',
                    body: `${currentUser} enviou uma cartinha para você.`,
                    authorName: currentUser
                })
            })
            .then(response => response.json())
            .then(data => console.log('[DEBUG] Resposta da notificação:', data))
            .catch(err => console.error('Erro ao disparar notificação:', err));

            messageText.value = '';
            showToast('Mensagem enviada! 💌', 'success');
        });
    });

    // Mark as read button
    markAsReadBtn.addEventListener('click', () => {
        if (currentMessageDoc) {
            currentMessageDoc.update({ read: true });
            currentMessageDoc = null;

            const modalEl = document.getElementById('popupMessageModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
        }
    });
}

function iniciarEscutaCartinhas() {
    const listaCartinhas = document.getElementById('lista-cartinhas');
    const skeletonCartinhas = document.getElementById('skeleton-cartinhas');

    if (unsubscribeCartinhas) { unsubscribeCartinhas(); unsubscribeCartinhas = null; }

    listaCartinhas.innerHTML = '';
    skeletonCartinhas?.classList.remove('d-none');

    const ref = db.collection('messages').orderBy('createdAt', 'desc');

    unsubscribeCartinhas = ref.onSnapshot(snap => {
        skeletonCartinhas?.classList.add('d-none');
        cachedLetters = [];

        snap.forEach(doc => {
            cachedLetters.push({
                id: doc.id,
                ...doc.data()
            });
        });

        renderCartinhas();
    }, err => {
        skeletonCartinhas?.classList.add('d-none');
        console.error(err);
        listaCartinhas.innerHTML = `<div class="text-danger">Erro: ${err.message}</div>`;
    });
}

function renderCartinhas() {
    const listaCartinhas = document.getElementById('lista-cartinhas');
    if (!listaCartinhas) return;

    listaCartinhas.innerHTML = '';

    const filtered = activeFilter === 'todas'
        ? cachedLetters
        : cachedLetters.filter(d => d.to === activeFilter);

    if (filtered.length === 0) {
        listaCartinhas.innerHTML = '<div class="text-center text-muted py-3">Nenhuma cartinha.</div>';
        return;
    }

    filtered.forEach(d => {
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
}

export function checkForMessage() {
    const currentUser = getCurrentUser();
    const popupMessageContent = document.getElementById('popupMessageContent');

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
        }, err => {
            console.error('Erro ao verificar novas mensagens (background):', err);
        });
}

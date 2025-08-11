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

let currentOrder = 'asc';
let pendingDelete = null;
let currentUser = localStorage.getItem('currentUser');
let currentMessageDoc = null;

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
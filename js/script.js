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

// Detecta usuário atual via ?user=Thomas ou ?user=Gabriela
const params = new URLSearchParams(window.location.search);
const currentUser = params.get('user');

if (!currentUser || (currentUser !== 'Thomas' && currentUser !== 'Gabriela')) {
  alert('Usuário não especificado! Use ?user=Thomas ou ?user=Gabriela na URL');
}

if (easterEggTrigger) {
  easterEggTrigger.addEventListener('click', () => {
    easterEggForm.classList.toggle('d-none');
  });
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  imageInput.nextElementSibling.textContent = file ? file.name : 'Nenhuma selecionada';
});

window.addEventListener('load', () => {
  loadMemories();
  checkForMessage();
});

form.addEventListener('submit', async e => {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const message = document.getElementById('message').value;
  const memoryDate = document.getElementById('memoryDate').value;
  const image = imageInput.files[0] ? await toBase64Compressed(imageInput.files[0]) : null;
  const autor = document.getElementById('autor').value;

  const memory = { title, message, image, date: memoryDate, autor };

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
    from: toUser.value === 'Gabriela' ? 'Thomas' : 'Gabriela',
    text: messageText.value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('messages').add(message).then(() => {
    messageText.value = '';
    alert('Mensagem enviada! 💌');
  });
});

function checkForMessage() {
  db.collection('messages')
    .where('to', '==', currentUser)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
    .then(snapshot => {
      if (!snapshot.empty) {
        const msg = snapshot.docs[0].data();
        popupMessageContent.textContent = msg.text;
        const modal = new bootstrap.Modal(document.getElementById('popupMessageModal'));
        modal.show();
      }
    });
}

function loadMemories() {
  container.innerHTML = '';
  document.getElementById('loadingSpinner').classList.remove('d-none');

  db.collection('memories').orderBy('date', currentOrder).get().then(snapshot => {
    let countThomas = 0;
    let countGabriela = 0;
    let countTotal = 0;

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

  const formattedDate = formatDate(date);

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
      <span>${formattedDate}</span>
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
  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  modal.show();
}

function confirmDelete() {
  if (pendingDelete) {
    db.collection('memories').doc(pendingDelete).delete().then(() => {
      loadMemories();
    });
    pendingDelete = null;
  }
  const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
  modal.hide();
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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

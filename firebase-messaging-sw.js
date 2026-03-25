importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

// Configuração do Firebase (copiada do config.js por questões de escopo de SW)
const firebaseConfig = {
    apiKey: "AIzaSyDpGm8cbfEo2HnbAETxev1fZg9M9LDats4",
    authDomain: "nosso-diario-bdb66.firebaseapp.com",
    projectId: "nosso-diario-bdb66",
    storageBucket: "nosso-diario-bdb66.firebasestorage.app",
    messagingSenderId: "555433356561",
    appId: "1:555433356561:web:1918c584efe64fb8e8f0b0"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handler opcional para plano de fundo se quiser customizar
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Recebida mensagem em segundo plano: ', payload);
    // Nota: O Firebase SDK já exibe automaticamente a notificação se o payload contiver o campo 'notification'.
    // Chamar showNotification manualmente aqui causaria uma notificação duplicada.
});

const CACHE_NAME = 'diario-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './css/header.css',
    './css/user.css',
    './css/new-memory.css',
    './css/memory.css',
    './css/letter-list.css',
    './css/letter.css',
    './css/ai.css',
    './js/main.js',
    './js/modules/config.js',
    './js/modules/utils.js',
    './js/modules/ui.js',
    './js/modules/user.js',
    './js/modules/spellcheck.js',
    './js/modules/memories.js',
    './js/modules/messages.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
    'https://fonts.googleapis.com/css2?family=Luxurious+Script&display=swap',
    'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',
    'https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});

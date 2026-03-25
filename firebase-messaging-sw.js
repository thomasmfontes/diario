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

// Handler para mensagens em segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensagem em segundo plano (Data):', payload);
    
    // Agora os dados vêm em payload.data porque desativamos o auto-display do SDK
    const data = payload.data || {};
    const notificationTitle = data.title || 'Novo aviso';
    const notificationOptions = {
        body: data.body || 'Você tem uma nova mensagem.',
        icon: data.icon || '/img/icon-192.png',
        badge: data.badge || '/img/drawable-xxhdpi/badge-72.png',
        data: data
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Lógica para abrir o diário ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notificação clicada');
    event.notification.close();

    // Tenta encontrar uma janela aberta e focar nela, ou abre uma nova
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Procura por uma aba já aberta com o nosso site
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    // Se a URL da aba atual começar com a origem do Service Worker, foca nela
                    if (client.url.startsWith(self.location.origin)) {
                        return client.focus();
                    }
                }
                // Se não encontrar nenhuma, abre uma nova aba na home
                if (clients.openWindow) {
                    return clients.openWindow(self.location.origin);
                }
            })
    );
});

const CACHE_NAME = 'diario-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './img/drawable-xxhdpi/badge-72.png',
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
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    // Só intercepta requisições GET
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isLocal = url.origin === self.location.origin;
    const isCdnAsset = ASSETS.some(asset => asset.startsWith('http') && event.request.url === asset);

    // Se não for arquivo local nem um asset de CDN conhecido, deixa o navegador lidar (Firestore, Google APIs, etc)
    if (!isLocal && !isCdnAsset) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => {
                // Se falhar o fetch e não tiver no cache, apenas retorna falha
                return null;
            });
        })
    );
});

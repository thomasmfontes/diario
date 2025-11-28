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

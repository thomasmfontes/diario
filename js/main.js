import { getCurrentUser, initUserSystem, updateUserUI } from './modules/user.js';
import { initMemories, loadMemories } from './modules/memories.js';
import { initMessages, checkForMessage } from './modules/messages.js';
import { initSpellCheck } from './modules/spellcheck.js';
import { initPendingSwipers } from './modules/ui.js';
import { initNotifications } from './modules/notifications.js';

window.addEventListener('load', () => {
    const currentUser = getCurrentUser();

    // Initialize modules
    initUserSystem({
        onUserChange: init
    });
    initMemories();
    initMessages();
    initSpellCheck();

    if (!currentUser || (currentUser !== 'Thomas' && currentUser !== 'Gabriela')) {
        new bootstrap.Modal('#userSelectModal').show();
    } else {
        init();
    }

    // garante que sliders existentes sejam inicializados após o Swiper carregar
    initPendingSwipers();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./firebase-messaging-sw.js')
            .then(reg => {
                console.log('Service Worker registrado!', reg);
                // Inicializa notificações com a registration do SW
                initNotifications(reg);
            })
            .catch(err => console.log('Falha ao registrar Service Worker:', err));
    }
});

function init() {
    updateUserUI();
    loadMemories();
    checkForMessage();
}

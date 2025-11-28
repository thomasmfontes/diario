import { getCurrentUser, initUserSystem, updateUserUI } from './modules/user.js';
import { initMemories, loadMemories } from './modules/memories.js';
import { initMessages, checkForMessage } from './modules/messages.js';
import { initSpellCheck } from './modules/spellcheck.js';
import { initPendingSwipers } from './modules/ui.js';

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
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado!', reg))
            .catch(err => console.log('Falha ao registrar Service Worker:', err));
    }
});

function init() {
    updateUserUI();
    loadMemories();
    checkForMessage();
}

import { getCurrentUser, initUserSystem, updateUserUI } from './modules/user.js';
import { initMemories, loadMemories } from './modules/memories.js';
import { initMessages, checkForMessage } from './modules/messages.js';
import { initSpellCheck } from './modules/spellcheck.js';
import { initPendingSwipers, showToast } from './modules/ui.js';
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
                
                // Inicializa notificações (tenta automático)
                initNotifications(reg);

                // Configura botões de notificação
                const notifBtn = document.getElementById('btn-enable-notif');
                const notifStatus = document.getElementById('notif-status');
                const notifHeaderBtn = document.getElementById('notif-header-btn');
                
                const updateNotifUI = () => {
                    if (Notification.permission === 'granted') {
                        if (notifStatus) notifStatus.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> Notificações ativas';
                        if (notifBtn) notifBtn.classList.add('d-none');
                        if (notifHeaderBtn) {
                            notifHeaderBtn.classList.remove('d-none');
                            notifHeaderBtn.innerHTML = '<i class="bi bi-bell-fill text-success"></i>';
                            notifHeaderBtn.title = 'Notificações Ativas';
                        }
                    } else if (Notification.permission === 'denied') {
                        if (notifStatus) notifStatus.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger"></i> Notificações bloqueadas';
                        if (notifBtn) notifBtn.innerHTML = '<i class="bi bi-gear-fill"></i> Como liberar';
                        if (notifHeaderBtn) {
                            notifHeaderBtn.classList.remove('d-none');
                            notifHeaderBtn.innerHTML = '<i class="bi bi-bell-slash-fill text-danger"></i>';
                            notifHeaderBtn.title = 'Notificações Bloqueadas';
                        }
                    } else {
                        if (notifStatus) notifStatus.textContent = 'Receba avisos de novas cartinhas 💌';
                        if (notifHeaderBtn) {
                            notifHeaderBtn.classList.remove('d-none');
                            notifHeaderBtn.innerHTML = '<i class="bi bi-bell"></i>';
                            notifHeaderBtn.title = 'Ativar Notificações';
                        }
                    }
                };

                updateNotifUI();

                const handleNotifClick = () => {
                    initNotifications(reg).then(() => {
                        setTimeout(updateNotifUI, 1000);
                    });
                };

                notifBtn?.addEventListener('click', handleNotifClick);
                notifHeaderBtn?.addEventListener('click', () => {
                    if (Notification.permission !== 'granted') {
                        handleNotifClick();
                    } else {
                        showToast('Suas notificações já estão ativas! ✅', 'info');
                    }
                });
            })
            .catch(err => console.log('Falha ao registrar Service Worker:', err));
    }
});

function init() {
    updateUserUI();
    loadMemories();
    checkForMessage();
}

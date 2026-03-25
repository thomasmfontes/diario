import { getCurrentUser, initUserSystem, updateUserUI } from './modules/user.js';
import { initMemories, loadMemories } from './modules/memories.js';
import { initMessages, checkForMessage } from './modules/messages.js';
import { initSpellCheck } from './modules/spellcheck.js';
import { initPendingSwipers, showToast } from './modules/ui.js';
import { initNotifications, removeNotifications } from './modules/notifications.js';

let swRegistration = null;

window.addEventListener('load', () => {
    const currentUser = getCurrentUser();

    // Initialize modules
    initUserSystem({
        onUserChange: init
    });
    initMemories();
    initMessages();
    initSpellCheck();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./firebase-messaging-sw.js')
            .then(reg => {
                console.log('Service Worker registrado!', reg);
                swRegistration = reg;
                
                // Se já temos usuário, inicializa notificações agora
                if (currentUser) {
                    initNotifications(reg);
                }

                // Configura botões de notificação
                const notifBtn = document.getElementById('btn-enable-notif');
                
                const updateNotifUI = () => {
                    // Se não estiver explicitamente 'false', assume que está 'true' (ativo) se a permissão for granted
                    const isEnabled = localStorage.getItem('notificationsEnabled') !== 'false';

                    if (Notification.permission === 'granted') {
                        if (isEnabled) {
                            if (notifBtn) {
                                notifBtn.innerHTML = '<i class="bi bi-bell-fill text-success"></i>';
                                notifBtn.title = 'Notificações ativas (clique para pausar)';
                            }
                        } else {
                            if (notifBtn) {
                                notifBtn.innerHTML = '<i class="bi bi-bell text-muted"></i>';
                                notifBtn.title = 'Notificações pausadas (clique para ativar)';
                            }
                        }
                    } else if (Notification.permission === 'denied') {
                        if (notifBtn) {
                            notifBtn.innerHTML = '<i class="bi bi-bell-slash-fill text-danger"></i>';
                            notifBtn.title = 'Notificações Bloqueadas no Navegador';
                        }
                    } else {
                        if (notifBtn) {
                            notifBtn.innerHTML = '<i class="bi bi-bell"></i>';
                            notifBtn.title = 'Ativar notificações push';
                        }
                    }
                };

                updateNotifUI();

                const handleNotifToggle = () => {
                    const isEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
                    if (Notification.permission === 'granted' && isEnabled) {
                        removeNotifications(reg).then(updateNotifUI);
                    } else {
                        initNotifications(reg).then(() => {
                            setTimeout(updateNotifUI, 1000);
                        });
                    }
                };

                notifBtn?.addEventListener('click', handleNotifToggle);
            })
            .catch(err => console.log('Falha ao registrar Service Worker:', err));
    }

    if (!currentUser || (currentUser !== 'Thomas' && currentUser !== 'Gabriela')) {
        new bootstrap.Modal('#userSelectModal').show();
    } else {
        init();
    }

    // garante que sliders existentes sejam inicializados após o Swiper carregar
    initPendingSwipers();
});

function init() {
    updateUserUI();
    loadMemories();
    checkForMessage();
    if (swRegistration) {
        initNotifications(swRegistration);
    }
}

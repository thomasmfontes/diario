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
                const notifStatus = document.getElementById('notif-status');
                const notifHeaderBtn = document.getElementById('notif-header-btn');
                
                const updateNotifUI = () => {
                    // Se não estiver explicitamente 'false', assume que está 'true' (ativo) se a permissão for granted
                    const isEnabled = localStorage.getItem('notificationsEnabled') !== 'false';

                    if (Notification.permission === 'granted') {
                        if (isEnabled) {
                            if (notifStatus) notifStatus.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> Notificações ativas';
                            if (notifBtn) notifBtn.classList.add('d-none');
                            if (notifHeaderBtn) {
                                notifHeaderBtn.classList.remove('d-none');
                                notifHeaderBtn.innerHTML = '<i class="bi bi-bell-fill text-success"></i>';
                                notifHeaderBtn.title = 'Pausar notificações';
                            }
                        } else {
                            if (notifStatus) notifStatus.innerHTML = '<i class="bi bi-bell-slash text-muted"></i> Notificações pausadas';
                            if (notifBtn) {
                                notifBtn.classList.remove('d-none');
                                notifBtn.innerHTML = '<i class="bi bi-bell-fill"></i> Ativar notificações';
                            }
                            if (notifHeaderBtn) {
                                notifHeaderBtn.classList.remove('d-none');
                                notifHeaderBtn.innerHTML = '<i class="bi bi-bell text-muted"></i>';
                                notifHeaderBtn.title = 'Ativar notificações';
                            }
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
                            notifHeaderBtn.title = 'Ativar notificações';
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
                notifHeaderBtn?.addEventListener('click', handleNotifToggle);
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

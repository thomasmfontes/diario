import { db, messaging } from './config.js';
import { showToast } from './ui.js';

const COLLECTION_TOKENS = 'fcm_tokens';

export async function initNotifications(swRegistration) {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Permissão para notificações concedida.');
            await saveToken(swRegistration);
        } else {
            console.warn('Permissão para notificações negada.');
        }

        // Lidar com mensagens em primeiro plano
        messaging.onMessage((payload) => {
            console.log('Mensagem recebida em primeiro plano:', payload);
            const { title, body } = payload.notification;
            showToast(`${title}: ${body}`, 'info');
        });

    } catch (error) {
        console.error('Erro ao inicializar notificações:', error);
    }
}

async function saveToken(swRegistration) {
    try {
        // Agora que o arquivo foi renomeado para o padrão do Firebase (firebase-messaging-sw.js),
        // ele deve funcionar automaticamente, mas ainda passamos a registration por segurança.
        const currentToken = await messaging.getToken({
            serviceWorkerRegistration: swRegistration
        });
        
        if (currentToken) {
            const user = localStorage.getItem('currentUser') || 'Desconhecido';
            
            // Salva ou atualiza o token no Firestore
            // Usamos o token como ID para evitar duplicatas
            await db.collection(COLLECTION_TOKENS).doc(currentToken).set({
                token: currentToken,
                user: user,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                platform: 'web'
            }, { merge: true });
            
            console.log('Token FCM salvo com sucesso.');
        } else {
            console.warn('Nenhum token disponível. Verifique as configurações do Firebase Messaging.');
        }
    } catch (error) {
        console.error('Erro ao salvar token:', error);
    }
}

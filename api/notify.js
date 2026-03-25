import { JWT } from 'google-auth-library';
import admin from 'firebase-admin';

// Inicializa o admin se ainda não estiver inicializado
// Nota: Em Vercel, o admin.apps pode persistir entre execuções
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type, data } = req.body;

    try {
        let title = '';
        let body = '';
        const authorName = data.autor || data.from;

        if (type === 'memory') {
            title = '📷 Novo momento no Diário';
            body = `${authorName} registrou: "${data.title}"`;
        } else if (type === 'message') {
            title = '💌 Você recebeu uma cartinha!';
            body = `${authorName} enviou uma mensagem para você.`;
        } else {
            return res.status(400).json({ error: 'Invalid notification type' });
        }

        // 1. Buscar tokens no Firestore
        const tokensSnapshot = await db.collection('fcm_tokens').get();
        const tokens = [];
        
        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            // Não envia para o próprio autor
            if (tokenData.user !== authorName) {
                tokens.push(tokenData.token);
            }
        });

        if (tokens.length === 0) {
            return res.status(200).json({ message: 'No tokens found for recipient' });
        }

        // 2. Enviar via Firebase Admin
        const payload = {
            notification: {
                title: title,
                body: body,
            },
            webpush: {
                fcm_options: {
                    link: 'https://nosso-diario-bdb66.firebaseapp.com/'
                }
            }
        };

        const response = await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: payload.notification,
            webpush: payload.webpush
        });

        console.log(`Successfully sent ${response.successCount} messages.`);
        return res.status(200).json({ 
            success: true, 
            sent: response.successCount, 
            failed: response.failureCount 
        });

    } catch (error) {
        console.error('Error sending notification:', error);
        return res.status(500).json({ error: error.message });
    }
}

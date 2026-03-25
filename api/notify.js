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

    const { title: reqTitle, body: reqBody, authorName: reqAuthor, type, data } = req.body;

    try {
        // Fallback para o novo formato ou formato antigo
        let authorName = reqAuthor || data?.autor || data?.from || 'Alguém';
        let title = reqTitle;
        let body = reqBody;

        if (!title) {
            if (type === 'memory') {
                title = '📸 Nova memória no Diário';
                body = `${authorName} registrou: "${data?.title || 'uma memória'}"`;
            } else if (type === 'message') {
                title = '💌 Você recebeu uma cartinha!';
                body = `${authorName} enviou uma cartinha para você.`;
            } else {
                return res.status(400).json({ error: 'Invalid notification payload' });
            }
        }

        // 1. Buscar tokens no Firestore
        const tokensSnapshot = await db.collection('fcm_tokens').get();
        const rawTokens = [];
        const registeredUsers = [];
        
        console.log(`[DEBUG] Buscando tokens. Autor da mensagem: ${authorName}`);

        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            registeredUsers.push(tokenData.user);
            // Não envia para o próprio autor
            if (tokenData.user !== authorName) {
                rawTokens.push(tokenData.token);
            }
        });

        console.log(`[DEBUG] Usuários com tokens registrados: ${registeredUsers.join(', ')}`);

        // Remove duplicatas (caso o mesmo token exista em documentos diferentes por erro)
        const tokens = [...new Set(rawTokens)];

        if (tokens.length === 0) {
            console.log(`[DEBUG] Nenhum token encontrado para destinatários (Autor: ${authorName})`);
            return res.status(200).json({ 
                message: 'No tokens found for recipient',
                registeredUsers: registeredUsers
            });
        }

        console.log(`[DEBUG] Enviando para ${tokens.length} tokens únicos.`);

        // 2. Enviar via Firebase Admin
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const baseUrl = `${protocol}://${host}`;
        const iconUrl = `${baseUrl}/img/icon-192.png`;

        const payload = {
            notification: {
                title: title,
                body: body,
                icon: iconUrl,
            },
            webpush: {
                fcm_options: {
                    link: `${baseUrl}/`
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

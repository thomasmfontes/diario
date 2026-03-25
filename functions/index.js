const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * Dispara uma notificação quando uma nova memória é adicionada.
 */
exports.notifyNewMemory = functions.firestore
    .document("memories/{memoryId}")
    .onCreate(async (snap, context) => {
      const newValue = snap.data();
      const title = newValue.title || "Nova Memória!";
      const autor = newValue.autor || "Alguém";
      const body = `${autor} registrou um novo momento: "${title}"`;

      const payload = {
        notification: {
          title: "📷 Novo momento no Diário",
          body: body,
          icon: "https://nosso-diario-bdb66.firebaseapp.com/img/favicon.ico",
          clickAction: "https://nosso-diario-bdb66.firebaseapp.com/",
        },
      };

      return sendToAllTokens(payload, autor);
    });

/**
 * Dispara uma notificação quando uma nova cartinha é enviada.
 */
exports.notifyNewMessage = functions.firestore
    .document("messages/{messageId}")
    .onCreate(async (snap, context) => {
      const newValue = snap.data();
      const from = newValue.from || "Alguém";
      const to = newValue.to || "Você";

      const payload = {
        notification: {
          title: "💌 Você recebeu uma cartinha!",
          body: `${from} enviou uma mensagem para ${to}`,
          icon: "https://nosso-diario-bdb66.firebaseapp.com/img/favicon.ico",
          clickAction: "https://nosso-diario-bdb66.firebaseapp.com/",
        },
      };

      return sendToAllTokens(payload, from);
    });

/**
 * Envia notificação para todos os tokens, exceto o autor.
 * @param {object} payload Conteúdo da notificação.
 * @param {string} authorName Nome de quem disparou a ação.
 * @return {Promise}
 * @private
 */
async function sendToAllTokens(payload, authorName) {
  const db = admin.firestore();
  const tokensSnapshot = await db.collection("fcm_tokens").get();

  if (tokensSnapshot.empty) {
    console.log("Nenhum token encontrado.");
    return null;
  }

  const tokens = [];
  tokensSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.user !== authorName) {
      tokens.push(data.token);
    }
  });

  if (tokens.length === 0) {
    console.log("Nenhum token de destinatário encontrado.");
    return null;
  }

  console.log(`Enviando para ${tokens.length} dispositivos.`);
  return admin.messaging().sendToDevice(tokens, payload);
}
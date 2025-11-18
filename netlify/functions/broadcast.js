// netlify/functions/broadcast.js
const admin = require('firebase-admin');
const sa = require('./firebase-sa.json'); // <- load service account JSON file

let appInit = false;
function init() {
  if (appInit) return;
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL: process.env.FIREBASE_DB_URL
  });
  appInit = true;
}

exports.handler = async (event) => {
  init();
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

    // simple secret check
    const secret = (event.headers['x-broadcast-secret'] || event.headers['X-Broadcast-Secret'] || '');
    if (!secret || secret !== process.env.BROADCAST_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { title, body, url, topic } = JSON.parse(event.body || '{}');
    if (!title || !body) return { statusCode: 400, body: JSON.stringify({ error: 'Missing title or body' }) };

    // === Try: send to tokens stored in DB for reliability ===
    const dbRef = admin.database().ref('/tokens'); // change if you use Firestore or a different path
    const snap = await dbRef.once('value');
    const tokenObjs = snap.val() || {};
    const tokens = Object.values(tokenObjs).map(o => o.token || o).filter(Boolean);

    if (!tokens.length) {
      // fallback to topic if no tokens found
      const messageTopic = {
        topic: topic || 'all',
        notification: { title, body },
        webpush: { fcmOptions: { link: url || '/' } }
      };
      const resp = await admin.messaging().send(messageTopic);
      return { statusCode: 200, body: JSON.stringify({ ok: true, resp, info: 'sentToTopicFallback' }) };
    }

    // send in chunks (sendMulticast supports up to 500 tokens at once)
    const chunkSize = 450;
    let aggregated = { successCount: 0, failureCount: 0, responses: [] };

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);
      const multicast = {
        tokens: chunk,
        notification: { title, body },
        webpush: { fcmOptions: { link: url || '/' } }
      };
      const r = await admin.messaging().sendMulticast(multicast);
      aggregated.successCount += r.successCount;
      aggregated.failureCount += r.failureCount;
      aggregated.responses.push({ chunkSize: chunk.length, ...r });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, aggregated }) };

  } catch (err) {
    console.error('broadcast error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

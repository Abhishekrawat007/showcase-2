// subscribe-topic.js
const admin = require('firebase-admin');

let appInit = false;
function init() {
  if (appInit) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
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

    const { token, topic } = JSON.parse(event.body || '{}');
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) };

    const targetTopic = topic || 'all';
    const resp = await admin.messaging().subscribeToTopic([token], targetTopic);
    return { statusCode: 200, body: JSON.stringify({ ok: true, resp }) };

  } catch (err) {
    console.error('subscribe-topic error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

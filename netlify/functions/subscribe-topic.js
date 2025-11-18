// netlify/functions/subscribe-topic.js
const admin = require('firebase-admin');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

let _saCache = null;
let _initPromise = null;

async function loadServiceAccountFromEnv() {
  if (_saCache) return _saCache;
  const b64 = process.env.FIREBASE_SA_GZ;
  if (!b64) throw new Error("Missing FIREBASE_SA_GZ env var");
  const gzBuffer = Buffer.from(b64, 'base64');
  const jsonBuf = await gunzip(gzBuffer);
  _saCache = JSON.parse(jsonBuf.toString('utf8'));
  return _saCache;
}

async function ensureFirebaseInit() {
  if (admin.apps && admin.apps.length) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const sa = await loadServiceAccountFromEnv();
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DB_URL
    });
  })();
  return _initPromise;
}

exports.handler = async (event) => {
  await ensureFirebaseInit();
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

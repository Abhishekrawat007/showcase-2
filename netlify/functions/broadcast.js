// netlify/functions/broadcast.js
import admin from "firebase-admin";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

let _saCache = null;
let _initPromise = null;

async function loadServiceAccountFromEnv() {
  if (_saCache) return _saCache;

  const b64 = process.env.FIREBASE_SA_GZ;
  if (!b64) throw new Error("Missing FIREBASE_SA_GZ env var");

  const gzBuffer = Buffer.from(b64, "base64");
  const jsonBuf = await gunzip(gzBuffer);
  _saCache = JSON.parse(jsonBuf.toString("utf8"));
  return _saCache;
}

async function ensureFirebaseInit() {
  if (admin.apps.length) return;

  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const sa = await loadServiceAccountFromEnv();
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
  })();

  return _initPromise;
}

export async function handler(event) {
  await ensureFirebaseInit();

  try {
    if (event.httpMethod !== "POST")
      return { statusCode: 405, body: "Method not allowed" };

    const secret =
      event.headers["x-broadcast-secret"] ||
      event.headers["X-Broadcast-Secret"] ||
      "";

    if (!secret || secret !== process.env.BROADCAST_SECRET) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const { title, body, url, topic } = JSON.parse(event.body || "{}");
    if (!title || !body)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing title or body" }),
      };

    const dbRef = admin.database().ref("/pushSubscribers");
    const snap = await dbRef.once("value");
    const tokenObjs = snap.val() || {};
    const tokens = Object.values(tokenObjs)
      .map((o) => o.token || o)
      .filter(Boolean);

    if (!tokens.length) {
      const messageTopic = {
        topic: topic || "all",
        notification: { title, body },
        webpush: { fcmOptions: { link: url || "/" } },
      };

      const resp = await admin.messaging().send(messageTopic);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, resp, info: "sentToTopicFallback" }),
      };
    }
// tokens currently might include duplicates — dedupe
const uniqueTokens = Array.from(new Set(tokens));

    // chunk sending with runtime fallback for environments where sendMulticast may be missing
const chunkSize = 450;
let aggregated = { successCount: 0, failureCount: 0, responses: [] };

// helper to attempt sendMulticast, otherwise fallback to sendAll
async function sendChunk(chunkTokens) {
  // Build common payload pieces
  const notification = { title, body };
  const webpush = {
    notification: {
      icon: 'https://showcase-2.netlify.app/web-app-manifest-192x192.png',
      badge: 'https://showcase-2.netlify.app/web-app-manifest-192x192.png',
      tag: 'sublime-notification'
    },
    fcmOptions: { link: url || "/" }
  };

  const messaging = admin.messaging();
  // Defensive logging for debugging
  console.log('admin.messaging() exists?', !!messaging, 'has sendMulticast?', typeof messaging.sendMulticast === 'function', 'has sendAll?', typeof messaging.sendAll === 'function');

  // Preferred path: sendMulticast if supported
  if (typeof messaging.sendMulticast === 'function') {
    const multicast = {
      tokens: chunkTokens,
      notification,
      webpush
    };
    return await messaging.sendMulticast(multicast);
  }

  // Fallback: build messages array and use sendAll (supported widely)
  const messages = chunkTokens.map(t => ({
    token: t,
    notification,
    webpush
  }));

  // sendAll returns { successCount, failureCount, responses: [...] }
  return await messaging.sendAll(messages);
}

for (let i = 0; i < uniqueTokens.length; i += chunkSize) {
  const chunk = uniqueTokens.slice(i, i + chunkSize);
  try {
    const r = await sendChunk(chunk);
    // Normalise response shape: sendMulticast returns { successCount, failureCount, responses }
    // sendAll returns same keys as well — keep it safe
    aggregated.successCount += r.successCount || 0;
    aggregated.failureCount += r.failureCount || 0;
    aggregated.responses.push({ chunkSize: chunk.length, ...r });
  } catch (err) {
    console.error('send chunk error', err);
    // push an error record so you can inspect failures in function logs / returned payload
    aggregated.responses.push({ chunkSize: chunk.length, error: err && err.message ? err.message : String(err) });
  }
}


    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, aggregated }),
    };
  } catch (err) {
    console.error("broadcast error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

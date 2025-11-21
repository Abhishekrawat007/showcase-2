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
  if (admin.apps && admin.apps.length) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const sa = await loadServiceAccountFromEnv();
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
    console.log("admin initialized. projectId:", sa.project_id || admin.app().options?.projectId);
  })();

  return _initPromise;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function handler(event) {
  try {
    await ensureFirebaseInit();
  } catch (e) {
    console.error("init error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "init error", detail: e.message }) };
  }

  try {
    if (event.httpMethod !== "POST") {
      // Allow a quick GET debug/test path: ?testToken=1
      if (event.httpMethod === "GET" && event.queryStringParameters?.testToken === "1") {
        const snap = await admin.database().ref("/pushSubscribers").limitToFirst(1).once("value");
        const tokensObj = snap.val() || {};
        const tokens = Object.values(tokensObj).map(o => o.token || o).filter(Boolean);
        if (!tokens.length) return { statusCode: 200, body: JSON.stringify({ ok: false, msg: "no tokens in /pushSubscribers" }) };

        const token = tokens[0];
        const payload = {
          token,
          notification: { title: "Test notification", body: "If you don't see this, server send failed" },
          webpush: { fcmOptions: { link: "/" } }
        };

        // Try a single-message send; whichever API exists
        const mg = admin.messaging();
        console.log("available messaging keys:", Object.keys(mg));
        if (typeof mg.send === "function") {
          try {
            const resp = await mg.send({
              token,
              notification: payload.notification,
              webpush: payload.webpush
            });
            return { statusCode: 200, body: JSON.stringify({ ok: true, testSend: true, resp }) };
          } catch (err) {
            return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message, stack: err.stack }) };
          }
        } else {
          return { statusCode: 500, body: JSON.stringify({ ok: false, error: "admin.messaging().send not available" }) };
        }
      }
      return { statusCode: 405, body: "Method not allowed" };
    }

    // AUTH
    const secret = event.headers["x-broadcast-secret"] || event.headers["X-Broadcast-Secret"] || "";
    if (!secret || secret !== process.env.BROADCAST_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const { title, body, url, topic } = JSON.parse(event.body || "{}");
    if (!title || !body) return { statusCode: 400, body: JSON.stringify({ error: "Missing title or body" }) };

    // Read tokens
    const dbRef = admin.database().ref("/pushSubscribers");
    const snap = await dbRef.once("value");
    const tokenObjs = snap.val() || {};
    const tokens = Object.values(tokenObjs).map(o => o.token || o).filter(Boolean);

    // Quick debug logs
    console.log("tokens count:", tokens.length);

    if (!tokens.length) {
      // fallback to topic send if you use topics
      const messageTopic = {
        topic: topic || "all",
        notification: { title, body },
        webpush: { fcmOptions: { link: url || "/" } },
      };
      try {
        const resp = await admin.messaging().send(messageTopic);
        return { statusCode: 200, body: JSON.stringify({ ok: true, resp, info: "sentToTopicFallback" }) };
      } catch (err) {
        console.error("topic send error", err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    }

    // dedupe tokens
    const uniqueTokens = Array.from(new Set(tokens));
    console.log("uniqueTokens:", uniqueTokens.length);

    // chunk size (sendMulticast supports up to 500)
    const chunkSize = 450;
    const chunks = chunkArray(uniqueTokens, chunkSize);

    const mg = admin.messaging();
    console.log("admin.messaging() keys:", Object.keys(mg));
    const supportsMulticast = typeof mg.sendMulticast === "function";
    const supportsSendAll = typeof mg.sendAll === "function";

    const aggregated = { successCount: 0, failureCount: 0, responses: [] };

    for (const chunk of chunks) {
      if (supportsMulticast) {
        // sendMulticast (preferred)
        const multicast = {
          tokens: chunk,
          notification: { title, body },
          webpush: {
            notification: {
              icon: process.env.PUSH_ICON || "https://sublimestore.in/web-app-manifest-192x192.png",
              badge: process.env.PUSH_ICON || "https://sublimestore.in/web-app-manifest-192x192.png",
              tag: 'sublime-notification'
            },
            fcmOptions: { link: url || "/" }
          }
        };
        try {
          const r = await mg.sendMulticast(multicast);
          aggregated.successCount += r.successCount || 0;
          aggregated.failureCount += r.failureCount || 0;
          aggregated.responses.push({ chunkSize: chunk.length, ok: true, r });
        } catch (err) {
          console.error("sendMulticast error for chunk:", err);
          aggregated.responses.push({ chunkSize: chunk.length, ok: false, error: err.message || String(err) });
        }
      } else if (supportsSendAll) {
        // fallback to sendAll (send array of messages)
        const messages = chunk.map(t => ({
          token: t,
          notification: { title, body },
          webpush: { fcmOptions: { link: url || "/" }, notification: { icon: process.env.PUSH_ICON, badge: process.env.PUSH_ICON, tag: 'sublime-notification' } }
        }));
        try {
          const r = await mg.sendAll(messages);
          aggregated.successCount += r.successCount || 0;
          aggregated.failureCount += r.failureCount || 0;
          aggregated.responses.push({ chunkSize: chunk.length, ok: true, r });
        } catch (err) {
          console.error("sendAll error for chunk:", err);
          aggregated.responses.push({ chunkSize: chunk.length, ok: false, error: err.message || String(err) });
        }
      } else {
        // final fallback: try to send to each token individually
        const perTokenResults = [];
        for (const t of chunk) {
          try {
            const resp = await mg.send({
              token: t,
              notification: { title, body },
              webpush: { fcmOptions: { link: url || "/" }, notification: { icon: process.env.PUSH_ICON, badge: process.env.PUSH_ICON, tag: 'sublime-notification' } }
            });
            perTokenResults.push({ token: t.slice(0, 12), ok: true, resp });
            aggregated.successCount++;
          } catch (err) {
            perTokenResults.push({ token: t.slice(0, 12), ok: false, error: err.message });
            aggregated.failureCount++;
          }
        }
        aggregated.responses.push({ chunkSize: chunk.length, ok: true, perTokenResults });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, aggregated }) };

  } catch (err) {
    console.error("broadcast error", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
}

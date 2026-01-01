// netlify/functions/broadcast.js
import admin from "firebase-admin";
import zlib from "zlib";
import { promisify } from "util";
import jwt from "jsonwebtoken"; // ✅ ADD THIS

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

function tokenShort(t) { return (t && t.slice ? t.slice(0, 16) : String(t)).replace(/\s+/g, ''); }

async function removeInvalidTokens(tokensToRemove = []) {
  if (!tokensToRemove.length) return;
  for (const t of tokensToRemove) {
    try {
      await admin.database().ref('sites/showcase-2/pushSubscribers/' + t).remove();
      const shortKey = t.slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, '');
      await admin.database().ref('sites/showcase-2/tokens/' + shortKey).remove().catch(()=>{});
      console.log('Removed invalid token from DB:', tokenShort(t));
    } catch (e) {
      console.warn('Failed to remove invalid token', tokenShort(t), e && e.message);
    }
  }
}

export async function handler(event) {
  try {
    await ensureFirebaseInit();
  } catch (e) {
    console.error("init error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "init error", detail: e.message }) };
  }

  try {
    // Quick GET debug/test path: ?testToken=1
    if (event.httpMethod === "GET" && event.queryStringParameters?.testToken === "1") {
      const snap = await admin.database().ref("sites/showcase-2/pushSubscribers").limitToFirst(1).once("value");
      const tokensObj = snap.val() || {};
      const tokens = Object.values(tokensObj).map(o => o.token || o).filter(Boolean);
      if (!tokens.length) return { statusCode: 200, body: JSON.stringify({ ok: false, msg: "no tokens in /pushSubscribers" }) };

      const token = tokens[0];
      const mg = admin.messaging();
      console.log("Test send -> token:", tokenShort(token));
      // Try single message send
      try {
        const resp = await mg.send({
          token,
          notification: { title: "Test notification", body: "Server send test" },
          webpush: { fcmOptions: { link: "/" } }
        });
        return { statusCode: 200, body: JSON.stringify({ ok: true, testSend: true, resp }) };
      } catch (err) {
        console.error('test single send error', err);
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message, stack: err.stack }) };
      }
    }

    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

    // ✅ REPLACE SECRET CHECK WITH JWT VERIFICATION
    const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
    const token = authHeader.replace("Bearer ", "").trim();
    
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "No token provided" }) };
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
    }

    const bodyJson = JSON.parse(event.body || "{}");
    const title = bodyJson.title;
    const bodyText = bodyJson.body;
    const url = bodyJson.url || "/";
    const topic = bodyJson.topic || "all";

    if (!title || !bodyText) return { statusCode: 400, body: JSON.stringify({ error: "Missing title or body" }) };

    // Read tokens
    const dbRef = admin.database().ref("sites/showcase-2/pushSubscribers");
    const snap = await dbRef.once("value");
    const tokenObjs = snap.val() || {};
    const tokens = Object.values(tokenObjs).map(o => (o && o.token) ? o.token : o).filter(Boolean);

    console.log("tokens count:", tokens.length);

    if (!tokens.length) {
      // fallback to topic send
      console.log('No tokens found -> sending to topic fallback:', topic);
      try {
        const resp = await admin.messaging().send({
          topic: topic,
          notification: { title, body: bodyText },
          webpush: { fcmOptions: { link: url } }
        });
        return { statusCode: 200, body: JSON.stringify({ ok: true, resp, info: "sentToTopicFallback" }) };
      } catch (err) {
        console.error("topic send error", err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    }

    const uniqueTokens = Array.from(new Set(tokens));
    console.log("uniqueTokens:", uniqueTokens.length);

    const chunkSize = 450;
    const chunks = chunkArray(uniqueTokens, chunkSize);

    const mg = admin.messaging();
    console.log("admin.messaging() has:", Object.keys(mg || {}));
    const supportsMulticast = typeof mg.sendMulticast === "function";
    const supportsSendAll = typeof mg.sendAll === "function";

    const aggregated = { successCount: 0, failureCount: 0, responses: [] };

    for (const chunk of chunks) {
      // Build message body
      if (supportsMulticast) {
        const multicast = {
          tokens: chunk,
          notification: { title, body: bodyText },
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

          // Detect invalid tokens from r.responses
          const toRemove = [];
          if (Array.isArray(r.responses)) {
            r.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const msg = (resp.error && (resp.error.code || resp.error.message)) ? (resp.error.code || resp.error.message) : String(resp.error || '');
                if (
                  msg.includes('registration-token-not-registered') ||
                  msg.includes('invalid-registration-token') ||
                  msg.includes('mismatched-sender-id') ||
                  msg.includes('NotRegistered') ||
                  msg.includes('InvalidRegistration')
                ) {
                  toRemove.push(chunk[idx]);
                }
              }
            });
          }
          if (toRemove.length) {
            console.log('Invalid tokens detected, removing:', toRemove.map(tokenShort));
            await removeInvalidTokens(toRemove);
          }

        } catch (err) {
          console.error("sendMulticast error for chunk:", err && err.message || err);
          aggregated.responses.push({ chunkSize: chunk.length, ok: false, error: err.message || String(err) });
        }

      } else if (supportsSendAll) {
        const messages = chunk.map(t => ({
          token: t,
          notification: { title, body: bodyText },
          webpush: { fcmOptions: { link: url || "/" }, notification: { icon: process.env.PUSH_ICON, badge: process.env.PUSH_ICON, tag: 'sublime-notification' } }
        }));

        try {
          const r = await mg.sendAll(messages);
          aggregated.successCount += r.successCount || 0;
          aggregated.failureCount += r.failureCount || 0;
          aggregated.responses.push({ chunkSize: chunk.length, ok: true, r });

          // cleanup invalid tokens
          const toRemove = [];
          if (Array.isArray(r.responses)) {
            r.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const msg = (resp.error && (resp.error.code || resp.error.message)) ? (resp.error.code || resp.error.message) : String(resp.error || '');
                if (msg.includes('registration-token-not-registered') || msg.includes('invalid-registration-token') || msg.includes('mismatched-sender-id')) {
                  toRemove.push(chunk[idx]);
                }
              }
            });
          }
          if (toRemove.length) {
            console.log('Invalid tokens detected (sendAll), removing:', toRemove.map(tokenShort));
            await removeInvalidTokens(toRemove);
          }

        } catch (err) {
          console.error("sendAll error for chunk:", err && err.message || err);
          aggregated.responses.push({ chunkSize: chunk.length, ok: false, error: err.message || String(err) });
        }

      } else {
        // final fallback: per-token send
        const perTokenResults = [];
        const toRemove = [];
        for (const t of chunk) {
          try {
            const resp = await mg.send({
              token: t,
              notification: { title, body: bodyText },
              webpush: { fcmOptions: { link: url || "/" }, notification: { icon: process.env.PUSH_ICON, badge: process.env.PUSH_ICON, tag: 'sublime-notification' } }
            });
            perTokenResults.push({ token: tokenShort(t), ok: true, resp });
            aggregated.successCount++;
          } catch (err) {
            const msg = (err && (err.code || err.message)) ? (err.code || err.message) : String(err || '');
            perTokenResults.push({ token: tokenShort(t), ok: false, error: msg });
            aggregated.failureCount++;
            if (msg.includes('registration-token-not-registered') || msg.includes('invalid-registration-token') || msg.includes('mismatched-sender-id')) {
              toRemove.push(t);
            }
          }
        }
        if (toRemove.length) {
          console.log('Invalid tokens detected (per-token), removing:', toRemove.map(tokenShort));
          await removeInvalidTokens(toRemove);
        }
        aggregated.responses.push({ chunkSize: chunk.length, ok: true, perTokenResults });
      } // end chunk handling
    } // end chunks loop

    return { statusCode: 200, body: JSON.stringify({ ok: true, aggregated }) };

  } catch (err) {
    console.error("broadcast error", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
}
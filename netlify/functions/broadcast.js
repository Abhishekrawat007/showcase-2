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

    const dbRef = admin.database().ref("/tokens");
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

    const chunkSize = 450;
    let aggregated = { successCount: 0, failureCount: 0, responses: [] };

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);
      const multicast = {
        tokens: chunk,
        notification: { title, body },
        webpush: { fcmOptions: { link: url || "/" } },
      };

      const r = await admin.messaging().sendMulticast(multicast);
      aggregated.successCount += r.successCount;
      aggregated.failureCount += r.failureCount;
      aggregated.responses.push({ chunkSize: chunk.length, ...r });
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

// netlify/functions/subscribe-topic.js
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

export async function handler(event) {
  try {
    await ensureFirebaseInit();
  } catch (e) {
    console.error("init error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "init error", detail: e.message }) };
  }

  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

    const body = JSON.parse(event.body || "{}");
    const token = body.token;
    const topic = body.topic || "all";

    if (!token) return { statusCode: 400, body: JSON.stringify({ error: "Missing token" }) };

    const mg = admin.messaging();
    try {
      const resp = await mg.subscribeToTopic([token], topic);
      console.log("subscribeToTopic resp:", JSON.stringify(resp));
      // Save metadata to RTDB under pushSubscribers/<token>/topics/<topic>
      try {
        const meta = {
          subscribed: true,
          topic,
          time: Date.now(),
          resp
        };
        await admin.database().ref('sites/showcase-2/pushSubscribers/' + token + '/topics/' + topic).set(meta);
      } catch (e) {
        console.warn('Could not write topic metadata to DB', e && e.message);
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, resp }) };
    } catch (err) {
      console.error("subscribe-topic error", err);
      // Write failure detail to DB for inspection
      try {
        await admin.database().ref('sites/showcase-2/pushSubscribers/' + token + '/topics/' + topic).set({
          subscribed: false,
          error: err.message || String(err),
          time: Date.now()
        });
      } catch (_) {}
      return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
    }

  } catch (err) {
    console.error("subscribe-topic handler error", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
}

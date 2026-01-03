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
  })();

  return _initPromise;
}

export async function handler(event) {
  try {
    await ensureFirebaseInit();
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "init error" }) };
  }

  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

    const body = JSON.parse(event.body || "{}");
    const { token, context, ua, origin } = body;

    if (!token || token.length < 100) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid token" }) };
    }
   if (typeof token !== 'string' || !token.includes(':')) {
  return { statusCode: 400, body: JSON.stringify({ error: "Invalid token format" }) };
}


const tokenString = typeof token === 'object' ? JSON.stringify(token) : String(token);

    const payload = {
      token,
      context: context || 'web',
      ua: ua || null,
      origin: origin || null,
      time: Date.now()
    };

    // Save to pushSubscribers
    await admin.database().ref("sites/showcase-2/pushSubscribers/" + token).set(payload);

    // Mirror to /tokens
    const shortKey = token.slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, '');
    await admin.database().ref("sites/showcase-2/tokens/" + shortKey).set({ token });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error("save-token error", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
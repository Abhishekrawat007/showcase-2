// netlify/functions/verifyEmail.js
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
      databaseURL: process.env.FIREBASE_DB_URL
    });
  })();
  return _initPromise;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body || "{}");
    const email = (body.email || "").toString().trim().toLowerCase();
    const code = (body.code || "").toString().trim();

    if (!email || !code) return { statusCode: 400, body: "Missing email or code" };

    await ensureFirebaseInit();
    const key = Buffer.from(email).toString("base64").replace(/\//g, "_");
    const ref = admin.database().ref(`emailVerifications/${key}`);
    const recSnap = await ref.once("value");
    const rec = recSnap.val();

    if (!rec) return { statusCode: 400, body: "No verification pending for this email" };

    const now = Date.now();
    if (rec.expiresAt && now > rec.expiresAt) {
      // expired: delete entry
      await ref.remove();
      return { statusCode: 400, body: "Code expired" };
    }

    if (rec.code !== code) {
      return { statusCode: 400, body: "Invalid code" };
    }

    // success: delete token and mark verified
    await ref.remove();
    await admin.database().ref(`emailVerified/${key}`).set({ email, verifiedAt: now });

    return { statusCode: 200, body: JSON.stringify({ verified: true }) };
  } catch (err) {
    console.error("verifyEmail error", err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err && err.message ? err.message : String(err) }) };
  }
}

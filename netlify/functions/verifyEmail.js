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
  if (!b64) throw new Error("Missing FIREBASE_SA_GZ");

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
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");

    // NORMALISE email + code
    const rawEmail = (body.email || "").toString();
    const rawCode =
      typeof body.code === "number"
        ? String(body.code)
        : (body.code || "").toString();

    const email = rawEmail.trim().toLowerCase();
    const code = rawCode.trim();

    if (!email) {
      return { statusCode: 400, body: "Missing email" };
    }

    if (!code || !/^\d{4,8}$/.test(code)) {
      return { statusCode: 400, body: "Invalid code format" };
    }

    await ensureFirebaseInit();

    // Firebase key
    const key = Buffer.from(email).toString("base64").replace(/\//g, "_");
    const ref = admin.database().ref(`emailVerifications/${key}`);
    const snap = await ref.once("value");
    const rec = snap.val();

    if (!rec) {
      if (process.env.DEBUG_VERIFY === "true") {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "No record found",
            key,
            email
          })
        };
      }
      return { statusCode: 400, body: "No verification pending for this email" };
    }

    // EXPIRY CHECK
    const now = Date.now();
    if (rec.expiresAt && now > Number(rec.expiresAt)) {
      await ref.remove();
      return { statusCode: 400, body: "Code expired" };
    }

    // CODE COMPARISON (string compare)
    const storedCode = (rec.code || "").toString().trim();

    if (storedCode !== code) {
      if (process.env.DEBUG_VERIFY === "true") {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Invalid code",
            storedCode,
            provided: code
          })
        };
      }
      return { statusCode: 400, body: "Invalid code" };
    }

    // SUCCESS
    await ref.remove();
    await admin.database().ref(`emailVerified/${key}`).set({
      email,
      verifiedAt: now
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ verified: true })
    };

  } catch (err) {
    console.error("verifyEmail error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
}

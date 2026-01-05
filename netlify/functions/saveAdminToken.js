import admin from "firebase-admin";
import jwt from "jsonwebtoken";
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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'No token' }) };
    }

    jwt.verify(token, process.env.JWT_SECRET);

    await ensureFirebaseInit();

    const { fcmToken } = JSON.parse(event.body || '{}');
    
    if (!fcmToken) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing fcmToken' }) };
    }

    await admin.database().ref('sites/showcase-2/adminTokens/' + fcmToken).set({
      token: fcmToken,
      timestamp: Date.now()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error("saveAdminToken error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}

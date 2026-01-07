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
    const db = admin.database();
    const snap = await db.ref("sites/showcase-2/orders").once("value");
    const orders = snap.val() || {};

    const toDelete = [];
    Object.entries(orders).forEach(([key, order]) => {
      if (!order.timestamp) toDelete.push(key);
    });

    for (const key of toDelete) {
      await db.ref(`sites/showcase-2/orders/${key}`).remove();
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ deleted: toDelete.length, keys: toDelete })
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
}
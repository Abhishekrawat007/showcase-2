import admin from "firebase-admin";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

let _saCache = null;
let _initPromise = null;

async function loadServiceAccount() {
  if (_saCache) return _saCache;
  const b64 = process.env.FIREBASE_SA_GZ;
  if (!b64) throw new Error("Missing FIREBASE_SA_GZ");

  const buff = Buffer.from(b64, "base64");
  const jsonBuf = await gunzip(buff);
  _saCache = JSON.parse(jsonBuf.toString());
  return _saCache;
}

async function ensureFirebaseInit() {
  if (admin.apps.length) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const sa = await loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DB_URL
    });
  })();
  return _initPromise;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    await ensureFirebaseInit();

    const { phone } = JSON.parse(event.body);
    
    const snapshot = await admin.database()
      .ref("sites/showcase-2/orders")
      .orderByChild("phone")
      .equalTo(phone)
      .once("value");
    
    const orders = snapshot.val();
    const ordersArray = orders ? Object.values(orders) : [];
    
    return {
      statusCode: 200,
      body: JSON.stringify({ orders: ordersArray })
    };
  } catch (err) {
    console.error("getOrders error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
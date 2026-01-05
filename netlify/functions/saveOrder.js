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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    await ensureFirebaseInit();

    const { pdfUrl, ...order } = JSON.parse(event.body || "{}");

    if (!order.orderId) {
      return { statusCode: 400, body: "Missing orderId" };
    }

    // Save order to Firebase
    const orderRef = await admin
      .database()
      .ref("orders")
      .push({
        ...order,
        pdfUrl: pdfUrl || null,
        createdAt: Date.now(),
      });

    // ✅ SEND NOTIFICATION IN BACKGROUND (NON-BLOCKING)
    (async () => {
      try {
        const snapshot = await admin.database().ref('adminTokens').once('value');
        const tokenData = snapshot.val() || {};
        const adminTokens = Object.values(tokenData).map(t => t.token).filter(Boolean);

        if (adminTokens.length > 0) {
          for (const token of adminTokens) {
            try {
              await admin.messaging().send({
                token: token,
                notification: {
                  title: "🔔 New Order!",
                  body: `${order.name || 'Customer'} - ₹${order.totalAmount || 0}`
                },
                webpush: { fcmOptions: { link: "/editor.html" } }
              });
            } catch (err) {
              if (err.code === 'messaging/registration-token-not-registered' || 
                  err.code === 'messaging/invalid-registration-token') {
                await admin.database().ref('adminTokens/' + token).remove();
              }
            }
          }
        }
      } catch (err) {
        console.error("Notification error:", err);
      }
    })();

    // Return immediately
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, orderId: orderRef.key }),
    };
  } catch (err) {
    console.error("saveOrder error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
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

    const order = JSON.parse(event.body || "{}");

    if (!order.orderId || !order.phone || !order.cart) {
      return { statusCode: 400, body: "Invalid order payload" };
    }

    // Save order
    const orderRef = await admin
      .database()
      .ref("sites/showcase-2/orders")
      .push({
        ...order,
        createdAt: Date.now(),
      });

    // ✅ SEND NOTIFICATION TO ALL ADMIN WORKERS
    let notifResult = { status: 'starting' };
    try {
      const snapshot = await admin.database().ref('sites/showcase-2/adminTokens').once('value');
      const tokenData = snapshot.val() || {};
      const adminTokens = Object.values(tokenData).map(t => t.token).filter(Boolean);
      
      notifResult.tokensFound = adminTokens.length;

      if (adminTokens.length > 0) {
        notifResult.status = 'sending';
        let successCount = 0;
        let failureCount = 0;
        
        for (const token of adminTokens) {
          try {
            await admin.messaging().send({
              token: token,
              notification: {
                title: "🔔 New Order!",
                body: `${order.name || 'Customer'} - ₹${order.totalAmount || 0}`
              },
              webpush: {
                fcmOptions: { link: "/editor.html" }
              }
            });
            successCount++;
          } catch (err) {
            failureCount++;
            console.error(`Failed to send:`, err.message);
          }
        }
        
        notifResult.status = 'sent';
        notifResult.success = successCount;
        notifResult.failed = failureCount;
      } else {
        notifResult.status = 'noTokens';
      }
    } catch (notifErr) {
      notifResult.status = 'error';
      notifResult.error = notifErr.message;
      console.error("Notification failed:", notifErr);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, orderId: orderRef.key, debug: notifResult }),
    };
  } catch (err) {
    console.error("saveOrder error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
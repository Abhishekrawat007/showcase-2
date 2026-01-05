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

// Save order to Firebase (including pdfUrl if present)
const orderRef = await admin
  .database()
  .ref("orders")
  .push({
    ...order,
    pdfUrl: pdfUrl || null,
    createdAt: Date.now(),
  });

 // ✅ SEND NOTIFICATION + AUTO-CLEANUP FAILED TOKENS
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
    const toRemove = []; // ✅ DEFINE ARRAY HERE
    
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
        toRemove.push(token);
        console.log('Failed token, removing:', token.substring(0, 20));
      }
    }
    
    // Cleanup invalid tokens
    for (const token of toRemove) {
      await admin.database().ref('sites/showcase-2/adminTokens/' + token).remove();
    }
    
    notifResult.status = 'sent';
    notifResult.success = successCount;
    notifResult.failed = failureCount;
    notifResult.removed = toRemove.length;
  } else {
    notifResult.status = 'noTokens';
  }
} catch (notifErr) {
  notifResult.status = 'error';
  notifResult.error = notifErr.message;
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
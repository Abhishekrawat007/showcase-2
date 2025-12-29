// netlify/functions/razorpay-webhook.js
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from "firebase-admin";
import fetch from "node-fetch";
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
  await ensureFirebaseInit();

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const signature = event.headers["x-razorpay-signature"];
  const body = event.body;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    return { statusCode: 400, body: "Invalid signature" };
  }

  const payload = JSON.parse(body);

  if (payload.event !== "payment.captured") {
    return { statusCode: 200, body: "Ignored" };
  }

  const payment = payload.payload.payment.entity;

  const firebaseOrderKey = payment.notes.firebaseOrderKey;
  if (!firebaseOrderKey) {
    return { statusCode: 200, body: "No firebase key" };
  }

  const db = admin.database();
  await db.ref("sites/showcase-2/secureOrders/" + firebaseOrderKey).update({
    isPaid: true,
    razorpay_payment_id: payment.id
  });

  // send Telegram
  await fetch(`${process.env.URL}/.netlify/functions/sendTelegramOrder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payment.notes.name,
      phone: payment.notes.phone,
      orderId: payment.notes.orderId,
      cart: JSON.parse(payment.notes.cart || "[]"),
      totalAmount: payment.amount / 100,
      payment: { status: "paid" },
      amountPaid: payment.amount / 100
    })
  });

  return { statusCode: 200, body: "OK" };
}

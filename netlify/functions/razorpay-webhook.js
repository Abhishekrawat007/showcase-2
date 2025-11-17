// netlify/functions/razorpay-webhook.js
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from "firebase-admin";
import fetch from "node-fetch";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

export async function handler(event) {
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
  await db.ref("secureOrders/" + firebaseOrderKey).update({
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

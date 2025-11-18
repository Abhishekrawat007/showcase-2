// netlify/functions/save-order.js
import admin from "firebase-admin";
import sa from "./firebase-sa.json"; // <- load service account JSON file

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { orderId, name, phone, cart, totalAmount, isPaid, razorpay_payment_id } = body;

    if (!orderId || !name || !phone || !cart || !totalAmount) {
      return { statusCode: 400, body: "Missing details" };
    }

    const db = admin.database();
    await db.ref("secureOrders/" + orderId).set({
      orderId,
      name,
      phone,
      cart,
      totalAmount,
      isPaid: !!isPaid,
      razorpay_payment_id: razorpay_payment_id || null,
      timestamp: Date.now()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error("save-order error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}

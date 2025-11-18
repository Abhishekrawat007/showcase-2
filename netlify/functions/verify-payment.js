// netlify/functions/verify-payment.js
import crypto from "crypto";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing fields" }),
      };
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RZP_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, msg: "Signature verified" }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Invalid signature" }),
      };
    }
  } catch (err) {
    console.error("verify-payment error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

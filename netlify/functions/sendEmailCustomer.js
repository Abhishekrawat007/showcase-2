// netlify/functions/sendEmailCustomer.js
const fetch = require("node-fetch");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, phone, email, orderId, cart, totalAmount, messageText, pdfBase64 } = body;

    if (!email || !orderId || !cart || !totalAmount) {
      return { statusCode: 400, body: "Missing required fields (email/orderId/cart/totalAmount)." };
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.FROM_EMAIL || "no-reply@example.com";
    if (!BREVO_API_KEY) {
      console.error("BREVO_API_KEY missing");
      return { statusCode: 500, body: "Brevo API key not configured" };
    }

    // build items plain/html
    const itemsText = Array.isArray(cart) ? cart.map(it => {
      const title = it.title || it.name || it.product || "Item";
      const qty = it.qty ?? it.quantity ?? 1;
      const price = it.price ?? it.newPrice ?? 0;
      return `${title} (x${qty}) - ₹${price * qty}`;
    }).join("\n") : "";

    const subject = `Sublime Store — Your receipt ${orderId}`;
    const htmlContent = `
      <h2>Thank you for your order — Sublime Store</h2>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Name:</strong> ${escapeHtml(name || "")}<br/>
      <strong>Phone:</strong> ${escapeHtml(phone || "")}<br/>
      <strong>Total:</strong> ₹${totalAmount}</p>
      <pre style="white-space:pre-wrap;">${escapeHtml(itemsText)}</pre>
      <p>We'll contact you to confirm delivery. — Sublime Store</p>
    `;

    // Brevo payload (v3 SMTP send)
    const payload = {
      sender: { email: FROM_EMAIL },
      to: [{ email }],
      subject,
      htmlContent
    };

    // attach PDF if present
    if (pdfBase64) {
      payload.attachment = [{
        name: `order-${orderId}.pdf`,
        content: pdfBase64 // already base64 string
      }];
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("Brevo error:", json);
      return { statusCode: 500, body: JSON.stringify({ error: json }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, result: json }) };

  } catch (err) {
    console.error("sendEmailCustomer error:", err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function escapeHtml(str) {
  return String(str || "").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

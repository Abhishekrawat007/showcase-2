// netlify/functions/sendEmailOrder.js
const nodemailer = require("nodemailer");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      name,
      phone,
      orderId,
      cart,
      totalAmount,
      messageText,
      pdfBase64, // expected base64 string (optional but recommended)
    } = body;

    if (!name || !phone || !orderId || !cart || !totalAmount) {
      return { statusCode: 400, body: "Missing order details" };
    }

    const ownerListRaw = process.env.OWNER_EMAILS || "";
    const toEmails = ownerListRaw.split(",").map(s => s.trim()).filter(Boolean);
    if (toEmails.length === 0) {
      console.error("No OWNER_EMAILS configured");
      return { statusCode: 500, body: "No owner emails configured" };
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
      console.error("Gmail SMTP credentials missing");
      return { statusCode: 500, body: "Email credentials not configured" };
    }

    // Build items HTML/text
    const itemLines = Array.isArray(cart) ? cart.map(it => {
      const title = it.title || it.name || it.product || "Item";
      const qty = it.qty ?? it.quantity ?? 1;
      const price = it.price ?? it.newPrice ?? 0;
      return `${title} (x${qty}) - ₹${price * qty}`;
    }).join("\n") : "";

    const subject = `Order ${orderId} — ${name} — ₹${totalAmount}`;
    const plain = (messageText && messageText.toString()) || `
Order ID: ${orderId}
Name: ${name}
Phone: ${phone}
Total: ₹${totalAmount}

Items:
${itemLines}
    `;

    // Nodemailer transport (Gmail SMTP using app password)
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });

    const attachments = [];
    if (pdfBase64) {
      attachments.push({
        filename: `order-${orderId}.pdf`,
        content: Buffer.from(pdfBase64, "base64"),
        contentType: "application/pdf"
      });
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL || gmailUser,
      to: toEmails.join(","),
      subject,
      text: plain,
      html: `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(plain)}</pre>`,
      attachments
    };

    await transporter.sendMail(mailOptions);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error("sendEmailOrder error:", err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

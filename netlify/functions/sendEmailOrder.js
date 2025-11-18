// netlify/functions/sendEmailOrder.js
import nodemailer from "nodemailer";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function handler(event) {
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
      pdfBase64,
    } = body;

    if (!name || !phone || !orderId || !cart || !totalAmount) {
      return { statusCode: 400, body: "Missing order details" };
    }

    const ownerListRaw = process.env.OWNER_EMAILS || "";
    const toEmails = ownerListRaw.split(",").map((s) => s.trim());

    if (!toEmails.length) {
      return { statusCode: 500, body: "No OWNER_EMAILS configured" };
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      return { statusCode: 500, body: "Gmail SMTP missing" };
    }

    const itemLines = Array.isArray(cart)
      ? cart
          .map((it) => {
            const title = it.title || it.name || "Item";
            const qty = it.qty ?? it.quantity ?? 1;
            const price = it.price ?? it.newPrice ?? 0;
            return `${title} (x${qty}) - ₹${price * qty}`;
          })
          .join("\n")
      : "";

    const subject = `Order ${orderId} — ${name} — ₹${totalAmount}`;

    const plain =
      messageText ||
      `Order ID: ${orderId}
Name: ${name}
Phone: ${phone}
Total: ₹${totalAmount}

Items:
${itemLines}
`;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });

    const attachments = [];
    if (pdfBase64) {
      attachments.push({
        filename: `order-${orderId}.pdf`,
        content: Buffer.from(pdfBase64, "base64"),
        contentType: "application/pdf",
      });
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL || gmailUser,
      to: toEmails.join(","),
      subject,
      text: plain,
      html: `<pre>${escapeHtml(plain)}</pre>`,
      attachments,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("sendEmailOrder error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

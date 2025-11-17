// netlify/functions/sendTelegramOrder.js
import fetch from "node-fetch";
import FormData from "form-data";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import sharp from "sharp";

// common helper (put near top of file)
function getChatIdsFromEnv() {
  const raw = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS || "";
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}


// --- Helper: Escape Markdown special chars ---
function escapeMarkdown(text) {
  return text.replace(/([_*[\]()~`>#+-=|{}.!])/g, "\\$1");
}

// --- Helper: Optimize Cloudinary URL or fetch & compress ---
async function fetchImageAsBase64(imgPath) {
  try {
    let finalUrl = imgPath;

    // If relative path, build full URL
    if (!/^https?:\/\//i.test(imgPath)) {
      const base = process.env.URL || process.env.SITE_URL || process.env.DEPLOY_URL || "";
const siteUrl = base && base.startsWith("http") ? base : (base ? `https://${base.replace(/^https?:\/\//,"")}` : "");

      finalUrl = siteUrl.replace(/\/$/, "") + "/" + imgPath.replace(/^\/?/, "");
    }

    // Optimize Cloudinary URL if detected
    if (/res\.cloudinary\.com/.test(finalUrl)) {
      finalUrl = finalUrl.replace(/(\/upload\/)(?!w_\d+)/, "$1w_80,q_50,f_auto/");
      const arrayBuffer = await (await fetch(finalUrl)).arrayBuffer();
      return `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
    }

    // Otherwise, fetch original and compress with Sharp
    const res = await fetch(finalUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const compressedBuffer = await sharp(buffer)
      .resize({ width: 80 })
      .jpeg({ quality: 50 })
      .toBuffer();

    return `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`;
  } catch (err) {
    console.error("Image fetch error:", imgPath, err.message);
    return "";
  }
}

// --- Helper: Send Telegram text messages safely ---
async function sendTelegramMessage(botToken, chatId, text) {
  const MAX_LENGTH = 4096;
  if (text.length <= MAX_LENGTH) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: escapeMarkdown(text), parse_mode: "MarkdownV2" })
    });
    return;
  }

  let start = 0;
  let part = 1;
  const totalParts = Math.ceil(text.length / MAX_LENGTH);

  while (start < text.length) {
    let end = start + MAX_LENGTH;
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    const chunk = `(${part}/${totalParts})\n` + text.slice(start, end).trim();
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: escapeMarkdown(chunk), parse_mode: "MarkdownV2" })
    });
    start = end;
    part++;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    // keep original destructuring but also capture whole body for payment fields
    const body = JSON.parse(event.body || "{}");
    const { name, phone, orderId, cart, totalAmount } = body;
    let messageText = body.messageText || body.message || "";

    // allow alternate amount fields
    const computedTotal = totalAmount ?? body.amount ?? body.amountPaid ?? body.amount_paid ?? 0;

    if (!name || !phone || !orderId || !cart || !computedTotal) {
      return { statusCode: 400, body: "Missing order details" };
    }

    // Build items list for message if needed
    const itemLines = Array.isArray(cart) ? cart.map((it) => {
      const title = it.title || it.name || it.product || "Item";
      const qty = it.qty ?? it.quantity ?? 1;
      const price = it.price ?? it.newPrice ?? 0;
      return `• ${title} (x${qty}) - Rs. ${price * qty}`;
    }).join("\n") : "";

    // Determine paid / cod badge (server-enforced)
    let statusBadge = '🔴 *COD / UNPAID*';
    try {
      const payment = body.payment || {};
      const status = (payment.status || '').toString().toLowerCase();
      const amountPaidNum = Number(body.amountPaid ?? body.amount ?? body.amount_paid ?? 0);

      if (status === 'paid' || status === 'success' || (!isNaN(amountPaidNum) && amountPaidNum > 0)) {
        statusBadge = '🟢 *PAID*';
      } else {
        statusBadge = '🔴 *COD / UNPAID*';
      }
    } catch (e) {
      statusBadge = '🔴 *COD / UNPAID*';
    }

    // WhatsApp link
    const waLink = phone ? `https://wa.me/91${String(phone).replace(/\D/g, "")}` : "";

    // ---------- NEW: Preserve "Buy Now" if the request is a buy-now ----------
    const lowerMsg = (messageText || "").toString().toLowerCase();
    const isBuyNowIndicator = /buy now/.test(lowerMsg) || (body.orderType && body.orderType.toString().toLowerCase() === 'buy_now') || (body.source && body.source.toString().toLowerCase() === 'buynow');

    if (messageText && typeof messageText === "string" && messageText.trim().length > 0) {
      if (isBuyNowIndicator) {
        // If it's already a buy-now style message, ensure badge is present and prefix appropriately
        if (!/^(🟢|🔴)/.test(messageText.trim())) {
          messageText = `🛒 *Buy Now Order* ${statusBadge}\n` + messageText;
        } else {
          // already has a badge - still ensure header text present
          if (!/Buy Now Order/i.test(messageText)) {
            messageText = messageText.replace(/^(🧾?\s*\*?New Order Received\*?\s*)/i, `🛒 *Buy Now Order* ${statusBadge}\n`);
          }
        }
      } else {
        // default behaviour: keep "New Order Received" header as before
        if (!/^(🟢|🔴)/.test(messageText.trim()) && !/New Order Received/i.test(messageText)) {
          messageText = `🧾 *New Order Received* ${statusBadge}\n` + messageText;
        } else if (!/New Order Received/i.test(messageText)) {
          messageText = `🧾 *New Order Received* ${statusBadge}\n` + messageText;
        } else {
          if (!/^(🟢|🔴)/.test(messageText.trim())) {
            messageText = messageText.replace(/^(🧾\s*\*New Order Received\*\s*)/i, `$1${statusBadge}\n`);
          }
        }
      }
    } else {
      // No custom messageText provided — build one.
      if (isBuyNowIndicator) {
        messageText = `🛒 *Buy Now Order* ${statusBadge}\n` +
          `*Order ID:* ${orderId}\n` +
          `${name ? `👤 *Name:* ${name}\n` : ""}` +
          `${phone ? `📞 *Phone:* ${phone}\n` : ""}` +
          `${waLink ? `💬 *WhatsApp:* [Chat](${waLink})\n` : ""}` +
          `💰 *Total:* Rs. ${computedTotal}\n` +
          `📦 *Items:*\n${itemLines}`;
      } else {
        messageText = `🧾 *New Order Received* ${statusBadge}\n` +
          `*Order ID:* ${orderId}\n` +
          `${name ? `👤 *Name:* ${name}\n` : ""}` +
          `${phone ? `📞 *Phone:* ${phone}\n` : ""}` +
          `${waLink ? `💬 *WhatsApp:* [Chat](${waLink})\n` : ""}` +
          `💰 *Total:* Rs. ${computedTotal}\n` +
          `📦 *Items:*\n${itemLines}`;
      }
    }

    // --- Create PDF ---
    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();

    // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("Sublime Store", pageWidth / 2, 40, { align: "center" });
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("Near Variety Store, Link Road, Takana Road, Pithoragarh", pageWidth / 2, 55, { align: "center" });
    pdf.text("Phone: +91 8868839446 | Website: sublimestore.in", pageWidth / 2, 70, { align: "center" });

    let y = 100;
    pdf.setFontSize(12);
    pdf.text(`Customer: ${name}`, 40, y);
    pdf.text(`Phone: ${phone}`, 40, y + 18);
    pdf.text(`Order ID: ${orderId}`, 40, y + 36);
    pdf.text(`Date: ${new Date().toLocaleString()}`, 40, y + 54);
    y += 80;

    const rows = [];
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const imgBase64 = await fetchImageAsBase64(item.image);
      rows.push([
        i + 1,
        { content: "", image: imgBase64 },
        item.title,
        item.qty,
        `Rs. ${item.price}`,
        `Rs. ${item.price * item.qty}`
      ]);
    }

    rows.push([
      { content: "Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
      { content: `Rs. ${computedTotal}`, styles: { halign: "right", fontStyle: "bold" } }
    ]);

    autoTable(pdf, {
      startY: y,
      head: [["No.", "Image", "Product", "Qty", "Price", "Subtotal"]],
      body: rows,
      styles: { fontSize: 10, valign: "middle", lineWidth: 0.5, lineColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.5, lineColor: [0, 0, 0] },
      bodyStyles: { minCellHeight: 50, lineWidth: 0.5, lineColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 50 }, 2: { cellWidth: 210 }, 3: { cellWidth: 50 }, 4: { cellWidth: 70 }, 5: { cellWidth: 80 } },
      didDrawCell: (data) => {
        if (data.column.index === 1 && data.cell.raw?.image) {
          const imgSize = 40;
          const xCenter = data.cell.x + (data.cell.width - imgSize) / 2;
          const yCenter = data.cell.y + (data.cell.height - imgSize) / 2;
          pdf.addImage(data.cell.raw.image, "JPEG", xCenter, yCenter, imgSize, imgSize);
        }
      }
    });

    const finalY = pdf.lastAutoTable.finalY + 20;
    pdf.setFont("times", "italic");
    pdf.setFontSize(11);
    pdf.setTextColor(60);
    pdf.text(
      "Thank you for shopping at Sublime Store.\nWe’ll call or WhatsApp you to confirm your order.",
      pageWidth / 2,
      finalY + 30,
      { align: "center" }
    );

    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));
   // Send a copy to owner emails via Netlify server function (optional — non-blocking)
try {
  const pdfB64 = pdfBuffer.toString('base64');
  // fire-and-forget: call Netlify function to email owners
  fetch(`${process.env.URL || ""}/.netlify/functions/sendEmailOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      phone,
      orderId,
      cart,
      totalAmount: computedTotal,
      messageText,
      pdfBase64: pdfB64
    })
  }).catch(err => {
    // log but do not fail the main function
    console.warn('sendEmailOrder call failed:', err && err.message);
  });
} catch (e) {
  console.warn('Error preparing email send:', e && e.message);
}
// after pdfBuffer created and maybe after owner email/fire-and-forget call
try {
  const pdfB64 = pdfBuffer.toString('base64');
  // call Netlify function to send customer receipt via Brevo
  if (body.email) {
    fetch(`${process.env.URL || ""}/.netlify/functions/sendEmailCustomer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        email: body.email,
        orderId,
        cart,
        totalAmount: computedTotal,
        messageText,
        pdfBase64: pdfB64
      })
    }).catch(err => {
      console.warn('sendEmailCustomer call failed:', err && err.message);
    });
  }
} catch (e) {
  console.warn('Error calling sendEmailCustomer:', e && e.message);
}

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_IDS = getChatIdsFromEnv();

    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) {
      console.error("Telegram env missing", { hasToken: !!TELEGRAM_BOT_TOKEN, chatCount: TELEGRAM_CHAT_IDS.length });
      return { statusCode: 500, body: "Telegram bot token or chat ids not configured" };
    }

    // Send text messages
    for (const chatId of TELEGRAM_CHAT_IDS) {
      try {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, messageText);
      } catch (err) {
        console.error("sendTelegramMessage error for chat", chatId, err && err.message);
      }
    }

    // Send PDF
    for (const chatId of TELEGRAM_CHAT_IDS) {
      try {
        const formData = new FormData();
        formData.append("document", pdfBuffer, "order.pdf");
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${chatId}`, { method: "POST", body: formData });
      } catch (err) {
        console.error("sendDocument error for chat", chatId, err && err.message);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error("Error generating order PDF:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

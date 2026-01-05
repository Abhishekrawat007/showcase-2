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
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
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
    console.error("Image fetch error:", imgPath, err && err.message ? err.message : err);
    return "";
  }
}

// --- Helper: Send Telegram text messages safely ---
async function sendTelegramMessage(botToken, chatId, text) {
  const MAX_LENGTH = 4096;
  if (!text) return;
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

    // ========== Get site/shop branding ==========
    // Dynamic per site (from env)
    const shopName = process.env.SHOP_NAME || "Sublime Store";
    const siteUrl = process.env.SITE_URL || process.env.URL || "sublimestore.netlify.app";
    const siteName = siteUrl.replace(/^https?:\/\//, '').replace(/\.netlify\.app$/, '').toUpperCase();
    
    // Fixed for all sites (hardcoded)
    const shopAddress = "Near Variety Store, Link Road, Takana Road";
    const shopCity = "Pithoragarh, Uttarakhand, India";
    const shopPhone = "+91 8937973753";
    // ============================================

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

    // ---------- Preserve "Buy Now" if the request is a buy-now ----------
    const lowerMsg = (messageText || "").toString().toLowerCase();
    const isBuyNowIndicator = /buy now/.test(lowerMsg) || (body.orderType && body.orderType.toString().toLowerCase() === 'buy_now') || (body.source && body.source.toString().toLowerCase() === 'buynow');

    if (messageText && typeof messageText === "string" && messageText.trim().length > 0) {
      if (isBuyNowIndicator) {
        if (!/^(🟢|🔴)/.test(messageText.trim())) {
          messageText = `🛒 *Buy Now Order from ${siteName}* ${statusBadge}\n` + messageText;
        } else {
          if (!/Buy Now Order/i.test(messageText)) {
            messageText = messageText.replace(/^(🧾?\s*\*?New Order Received\*?\s*)/i, `🛒 *Buy Now Order from ${siteName}* ${statusBadge}\n`);
          }
        }
      } else {
        if (!/^(🟢|🔴)/.test(messageText.trim()) && !/New Order Received/i.test(messageText)) {
          messageText = `🧾 *New Order from ${siteName}* ${statusBadge}\n` + messageText;
        } else if (!/New Order Received/i.test(messageText)) {
          messageText = `🧾 *New Order from ${siteName}* ${statusBadge}\n` + messageText;
        } else {
          if (!/^(🟢|🔴)/.test(messageText.trim())) {
            messageText = messageText.replace(/^(🧾\s*\*New Order Received\*\s*)/i, `$1from ${siteName} ${statusBadge}\n`);
          }
        }
      }
    } else {
      // No custom messageText provided — build one.
      if (isBuyNowIndicator) {
        messageText = `🛒 *Buy Now Order from ${siteName}* ${statusBadge}\n` +
          `*Order ID:* ${orderId}\n` +
          `${name ? `👤 *Name:* ${name}\n` : ""}` +
          `${phone ? `📞 *Phone:* ${phone}\n` : ""}` +
          `${waLink ? `💬 *WhatsApp:* [Chat](${waLink})\n` : ""}` +
          `💰 *Total:* Rs. ${computedTotal}\n` +
          `📦 *Items:*\n${itemLines}\n` +
          `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📍 *Site:* ${siteUrl}`;
      } else {
        messageText = `🧾 *New Order from ${siteName}* ${statusBadge}\n` +
          `*Order ID:* ${orderId}\n` +
          `${name ? `👤 *Name:* ${name}\n` : ""}` +
          `${phone ? `📞 *Phone:* ${phone}\n` : ""}` +
          `${waLink ? `💬 *WhatsApp:* [Chat](${waLink})\n` : ""}` +
          `💰 *Total:* Rs. ${computedTotal}\n` +
          `📦 *Items:*\n${itemLines}\n` +
          `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📍 *Site:* ${siteUrl}`;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔥 PREMIUM PDF - YOUR PROVEN LAYOUT + ORANGE/GOLD COLORS 🔥
    // ═══════════════════════════════════════════════════════════════

    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Premium cream background (subtle, not harsh white)
    pdf.setFillColor(255, 250, 240); // Very light cream
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    // PREMIUM ORANGE HEADER BAR (single solid color)
    pdf.setFillColor(255, 140, 0); // Orange
    pdf.rect(0, 0, pageWidth, 90, 'F');

    // Gold decorative line below header
    pdf.setDrawColor(255, 215, 0); // Gold
    pdf.setLineWidth(2);
    pdf.line(0, 90, pageWidth, 90);

    // Shop name - WHITE TEXT on orange background
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(255, 255, 255); // White
    pdf.text(shopName.toUpperCase(), pageWidth / 2, 45, { align: "center" });

    // Contact info - WHITE TEXT on orange header
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255); // White
    pdf.text(`${shopAddress}, ${shopCity}`, pageWidth / 2, 63, { align: "center" });
    pdf.text(`Phone: ${shopPhone} | Website: ${siteUrl.replace(/^https?:\/\//, '')}`, pageWidth / 2, 78, { align: "center" });

    // Customer and order details section - BLACK TEXT on cream background
    let y = 120;
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0); // Black text
    pdf.text(`Customer: ${name}`, 40, y);
    pdf.text(`Phone: ${phone}`, 40, y + 18);
    pdf.text(`Order ID: ${orderId}`, 40, y + 36);
    pdf.text(`Date: ${new Date().toLocaleString()}`, 40, y + 54);
    y += 80;

    // Build table rows with images
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

    // Total row with BIGGER, BOLDER text
    rows.push([
      { content: "Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold", fontSize: 14, textColor: [0, 0, 0] } },
      { content: `Rs. ${computedTotal}`, styles: { halign: "right", fontStyle: "bold", fontSize: 14, textColor: [255, 140, 0] } }
    ]);

    // Create the table with PREMIUM ORANGE HEADER
    autoTable(pdf, {
      startY: y,
      head: [["No.", "Image", "Product", "Qty", "Price", "Subtotal"]],
      body: rows,
      styles: { 
        fontSize: 10, 
        valign: "middle", 
        lineWidth: 0.5, 
        lineColor: [200, 200, 200] // Light gray borders
      },
      headStyles: { 
        fillColor: [255, 140, 0], // ORANGE HEADER
        textColor: [255, 255, 255], // White text
        fontStyle: "bold", 
        lineWidth: 0.5, 
        lineColor: [255, 140, 0] 
      },
      bodyStyles: { 
        minCellHeight: 50, 
        lineWidth: 0.5, 
        lineColor: [200, 200, 200] 
      },
      alternateRowStyles: {
        fillColor: [255, 248, 240] // Light cream for alternate rows
      },
      columnStyles: { 
        0: { cellWidth: 35 }, 
        1: { cellWidth: 50 }, 
        2: { cellWidth: 210 }, 
        3: { cellWidth: 50 }, 
        4: { cellWidth: 70 }, 
        5: { cellWidth: 80 } 
      },
      didDrawCell: (data) => {
        try {
          if (data.column.index === 1 && data.cell.raw?.image) {
            const imgSize = 40;
            const xCenter = data.cell.x + (data.cell.width - imgSize) / 2;
            const yCenter = data.cell.y + (data.cell.height - imgSize) / 2;
            pdf.addImage(data.cell.raw.image, "JPEG", xCenter, yCenter, imgSize, imgSize);
          }
        } catch (e) {
          // ignore image draw errors
        }
      }
    });

    // Premium footer with gold accent line
    const finalY = (pdf.lastAutoTable && pdf.lastAutoTable.finalY) ? pdf.lastAutoTable.finalY + 30 : y + 30;
    
    // Gold decorative line before footer
    pdf.setDrawColor(255, 215, 0); // Gold
    pdf.setLineWidth(1.5);
    pdf.line(40, finalY - 10, pageWidth - 40, finalY - 10);
    
    // Footer message
    pdf.setFont("times", "italic");
    pdf.setFontSize(11);
    pdf.setTextColor(139, 69, 19); // Brown for elegance
    pdf.text(
      `Thank you for shopping with ${shopName}.\nWe'll call or WhatsApp you to confirm your order.`,
      pageWidth / 2,
      finalY + 15,
      { align: "center" }
    );

    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

    // Send a copy to owner emails via Netlify server function (optional — non-blocking)
    try {
      const pdfB64 = pdfBuffer.toString('base64');
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
        console.warn('sendEmailOrder call failed:', err && err.message);
      });
    } catch (e) {
      console.warn('Error preparing email send:', e && e.message);
    }

    // Send customer receipt via Brevo
    try {
      const pdfB64 = pdfBuffer.toString('base64');
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
        formData.append("chat_id", chatId);
        formData.append("document", pdfBuffer, {
          filename: `${shopName.replace(/\s+/g, '-')}-Order-${orderId}.pdf`,
          contentType: "application/pdf"
        });
        const headers = formData.getHeaders ? formData.getHeaders() : {};
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, { method: "POST", body: formData, headers });
      } catch (err) {
        console.error("sendDocument error for chat", chatId, err && err.message);
      }
    }

   return { 
  statusCode: 200, 
  body: JSON.stringify({ 
    success: true,
    pdfUrl: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
  }) 
};

  } catch (err) {
    console.error("Error generating order PDF:", err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err && err.message ? err.message : String(err) }) };
  }
}
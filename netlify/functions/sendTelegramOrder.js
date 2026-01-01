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
    // 🔥 ULTRA-PREMIUM PDF DESIGN STARTS HERE 🔥
    // ═══════════════════════════════════════════════════════════════

    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // ========== COLOR PALETTE (Orange to Gold Premium) ==========
    const colors = {
      primary: [255, 140, 0],      // Orange #FF8C00
      gold: [255, 215, 0],          // Gold #FFD700
      darkGold: [218, 165, 32],     // Dark Goldenrod
      cream: [255, 248, 240],       // Floral White
      lightCream: [255, 250, 245],  // Very light cream
      darkText: [51, 51, 51],       // Almost black
      mediumText: [102, 102, 102],  // Medium gray
      accent: [139, 69, 19],        // Saddle brown (elegant)
      white: [255, 255, 255]
    };

    // ========== PREMIUM BACKGROUND ==========
    // Subtle gradient effect using rectangles
    pdf.setFillColor(...colors.cream);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    // Top accent bar with gradient simulation (3 layers)
    pdf.setFillColor(255, 140, 0); // Orange
    pdf.rect(0, 0, pageWidth, 80, 'F');
    
    pdf.setFillColor(255, 165, 0, 0.7); // Lighter orange (simulate gradient)
    pdf.rect(0, 0, pageWidth, 60, 'F');
    
    pdf.setFillColor(255, 200, 50, 0.4); // Even lighter
    pdf.rect(0, 0, pageWidth, 40, 'F');

    // Decorative line below header
    pdf.setDrawColor(...colors.gold);
    pdf.setLineWidth(3);
    pdf.line(40, 85, pageWidth - 40, 85);

    // ========== SHOP NAME (HEADER) ==========
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(32);
    pdf.setTextColor(255, 255, 255); // White text on colored background
    pdf.text(shopName.toUpperCase(), pageWidth / 2, 50, { align: "center" });

    // ========== CONTACT INFO BELOW HEADER (White on orange) ==========
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${shopAddress}, ${shopCity}`, pageWidth / 2, 68, { align: "center" });

    // Phone and Website on same line
    const contactLine = `Phone: ${shopPhone}  •  Website: ${siteUrl.replace(/^https?:\/\//, '')}`;
    pdf.setFontSize(8.5);
    pdf.text(contactLine, pageWidth / 2, 80, { align: "center" });

    // ========== INVOICE BADGE ==========
    let y = 115;
    
    // Premium "INVOICE" badge with border
    pdf.setFillColor(...colors.darkGold);
    pdf.roundedRect(40, y - 5, 120, 25, 3, 3, 'F');
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text("INVOICE", 100, y + 10, { align: "center" });

    // Order date on right side
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.darkText);
    const orderDate = new Date().toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Date: ${orderDate}`, pageWidth - 40, y + 10, { align: "right" });

    y += 45;

    // ========== CUSTOMER & ORDER DETAILS SECTION ==========
    // Left side - Customer info box
    pdf.setFillColor(...colors.lightCream);
    pdf.roundedRect(40, y, 250, 85, 5, 5, 'F');
    pdf.setDrawColor(...colors.gold);
    pdf.setLineWidth(1.5);
    pdf.roundedRect(40, y, 250, 85, 5, 5, 'S');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.accent);
    pdf.text("BILL TO", 50, y + 18);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...colors.darkText);
    pdf.text(name, 50, y + 38);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.mediumText);
    pdf.text(`Phone: ${phone}`, 50, y + 56);

    // Right side - Order info box
    pdf.setFillColor(...colors.lightCream);
    pdf.roundedRect(pageWidth - 290, y, 250, 85, 5, 5, 'F');
    pdf.setDrawColor(...colors.gold);
    pdf.setLineWidth(1.5);
    pdf.roundedRect(pageWidth - 290, y, 250, 85, 5, 5, 'S');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.accent);
    pdf.text("ORDER DETAILS", pageWidth - 280, y + 18);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.mediumText);
    pdf.text(`Order ID: #${orderId}`, pageWidth - 280, y + 40);
    
    // Payment status badge
    const isPaid = statusBadge.includes('PAID');
    pdf.setFillColor(isPaid ? 34 : 220, isPaid ? 197 : 53, isPaid ? 94 : 69); // Green or Red
    pdf.roundedRect(pageWidth - 280, y + 50, isPaid ? 50 : 90, 20, 3, 3, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(isPaid ? "PAID" : "COD/UNPAID", pageWidth - 255, y + 63, { align: "center" });

    y += 110;

    // ========== PRODUCTS TABLE (Ultra Premium) ==========
    const rows = [];
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const imgBase64 = await fetchImageAsBase64(item.image);
      rows.push([
        i + 1,
        { content: "", image: imgBase64 },
        item.title,
        item.qty,
        `₹${item.price}`,
        `₹${item.price * item.qty}`
      ]);
    }

    // Grand Total Row
    rows.push([
      { content: "", colSpan: 5, styles: { halign: "right", fontStyle: "bold", fontSize: 12, textColor: colors.darkText } },
      { content: `₹${computedTotal}`, styles: { halign: "right", fontStyle: "bold", fontSize: 12, fillColor: colors.gold, textColor: [51, 51, 51] } }
    ]);

    autoTable(pdf, {
      startY: y,
      head: [["#", "Image", "Product", "Qty", "Price", "Subtotal"]],
      body: rows,
      theme: 'plain',
      styles: { 
        fontSize: 10, 
        valign: "middle",
        cellPadding: 8,
        lineColor: colors.gold,
        lineWidth: 0.5
      },
      headStyles: { 
        fillColor: colors.primary,
        textColor: colors.white,
        fontStyle: "bold",
        fontSize: 11,
        halign: "center",
        lineWidth: 0
      },
      bodyStyles: { 
        minCellHeight: 55,
        textColor: colors.darkText
      },
      alternateRowStyles: {
        fillColor: colors.lightCream
      },
      columnStyles: { 
        0: { cellWidth: 30, halign: "center", fontStyle: "bold", textColor: colors.mediumText },
        1: { cellWidth: 55, halign: "center" },
        2: { cellWidth: 220 },
        3: { cellWidth: 45, halign: "center" },
        4: { cellWidth: 70, halign: "right" },
        5: { cellWidth: 75, halign: "right", fontStyle: "bold" }
      },
      didDrawCell: (data) => {
        try {
          if (data.column.index === 1 && data.cell.raw?.image && data.section === 'body') {
            const imgSize = 45;
            const xCenter = data.cell.x + (data.cell.width - imgSize) / 2;
            const yCenter = data.cell.y + (data.cell.height - imgSize) / 2;
            
            // Draw white background for image
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(xCenter - 2, yCenter - 2, imgSize + 4, imgSize + 4, 3, 3, 'F');
            
            // Draw image
            pdf.addImage(data.cell.raw.image, "JPEG", xCenter, yCenter, imgSize, imgSize);
          }
        } catch (e) {
          // ignore image draw errors
        }
      },
      didDrawPage: (data) => {
        // Add subtle border around table
        if (data.table.finalY) {
          pdf.setDrawColor(...colors.gold);
          pdf.setLineWidth(2);
          pdf.rect(40, data.table.pageStartY - 5, pageWidth - 80, data.table.finalY - data.table.pageStartY + 5, 'S');
        }
      }
    });

    const finalY = (pdf.lastAutoTable && pdf.lastAutoTable.finalY) ? pdf.lastAutoTable.finalY + 30 : y + 30;

    // ========== PREMIUM FOOTER SECTION ==========
    // Decorative line
    pdf.setDrawColor(...colors.gold);
    pdf.setLineWidth(1.5);
    pdf.line(40, finalY, pageWidth - 40, finalY);

    // Thank you message with elegant styling
    pdf.setFont("times", "italic");
    pdf.setFontSize(13);
    pdf.setTextColor(...colors.accent);
    const thankYouY = finalY + 25;
    pdf.text(`Thank you for shopping with ${shopName}!`, pageWidth / 2, thankYouY, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.mediumText);
    pdf.text("We will contact you shortly to confirm your order.", pageWidth / 2, thankYouY + 18, { align: "center" });

    // Contact CTA
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.primary);
    pdf.text(`📞 ${shopPhone}  •  🌐 ${siteUrl.replace(/^https?:\/\//, '')}`, pageWidth / 2, thankYouY + 36, { align: "center" });

    // Bottom decorative element
    const bottomY = pageHeight - 40;
    pdf.setFillColor(...colors.primary);
    pdf.rect(0, bottomY, pageWidth, 40, 'F');
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Order placed at ${siteUrl.replace(/^https?:\/\//, '')} • Generated on ${orderDate}`, pageWidth / 2, bottomY + 15, { align: "center" });
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("Powered by Sublime Technologies", pageWidth / 2, bottomY + 28, { align: "center" });

    // ═══════════════════════════════════════════════════════════════
    // 🔥 ULTRA-PREMIUM PDF DESIGN ENDS HERE 🔥
    // ═══════════════════════════════════════════════════════════════

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

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error("Error generating order PDF:", err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err && err.message ? err.message : String(err) }) };
  }
}
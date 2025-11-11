import fetch from "node-fetch";
import FormData from "form-data";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
// sharp may be optional on your platform — we try to import it and fallback
let sharp;
try { sharp = await import("sharp"); sharp = sharp.default || sharp; } catch (e) { sharp = null; }

function escapeMarkdownV2(text = "") {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

async function fetchImageAsBase64(imgPath) {
  try {
    let finalUrl = imgPath;
    if (!/^https?:\/\//i.test(imgPath)) {
      const siteUrl = process.env.URL || process.env.DEPLOY_URL || "";
      finalUrl = siteUrl.replace(/\/$/, "") + "/" + imgPath.replace(/^\/?/, "");
    }

    if (/res\.cloudinary\.com/.test(finalUrl)) {
      // optimize via Cloudinary simple transform
      finalUrl = finalUrl.replace(/(\/upload\/)(?!.*w_)/, "$1w_80,q_50,f_auto/");
      const res = await fetch(finalUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
    }

    // otherwise fetch and try to compress with sharp if available
    const res = await fetch(finalUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (sharp) {
      const compressed = await sharp(buffer).resize({ width: 80 }).jpeg({ quality: 50 }).toBuffer();
      return `data:image/jpeg;base64,${compressed.toString("base64")}`;
    } else {
      // fallback: return original as base64 (might be large)
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }
  } catch (err) {
    console.error("fetchImageAsBase64 error:", imgPath, err.message);
    return "";
  }
}

async function sendTelegramMessage(botToken, chatId, text) {
  const MAX_LENGTH = 4096;
  if (text.length <= MAX_LENGTH) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: escapeMarkdownV2(text), parse_mode: "MarkdownV2" })
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
      body: JSON.stringify({ chat_id: chatId, text: escapeMarkdownV2(chunk), parse_mode: "MarkdownV2" })
    });
    start = end;
    part++;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { name, phone, orderId, cart, totalAmount, messageText } = JSON.parse(event.body || "{}");

    if (!name || !phone || !orderId || !cart || !totalAmount || !messageText) {
      return { statusCode: 400, body: "Missing order details" };
    }

    // PDF creation (your existing logic)
    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();

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
      { content: `Rs. ${totalAmount}`, styles: { halign: "right", fontStyle: "bold" } }
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

    const finalY = pdf.lastAutoTable?.finalY || (y + 200);
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

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (!TELEGRAM_BOT_TOKEN) {
      return { statusCode: 500, body: "Missing TELEGRAM_BOT_TOKEN" };
    }
    if (TELEGRAM_CHAT_IDS.length === 0) {
      return { statusCode: 500, body: "No TELEGRAM_CHAT_ID configured" };
    }

    // Send text messages (sequential or parallel)
    for (const chatId of TELEGRAM_CHAT_IDS) {
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, messageText);
    }

    // Send PDF
    await Promise.all(
      TELEGRAM_CHAT_IDS.map(async (chatId) => {
        const formData = new FormData();
        formData.append("document", pdfBuffer, "order.pdf");
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${chatId}`, { method: "POST", body: formData });
      })
    );

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Error generating order PDF:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

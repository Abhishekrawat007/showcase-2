// netlify/functions/sendTelegramPDF.js
import { fetch } from "undici";
import FormData from "form-data";

function getChatIdsFromEnv() {
  const raw = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS || "";
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const body = JSON.parse(event.body || "{}");
    const pdfBase64 = body.pdfBase64 || body.pdf || "";
    if (!pdfBase64) return { statusCode: 400, body: "Missing pdfBase64" };

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_IDS = getChatIdsFromEnv();
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) {
      console.error("Telegram env missing", !!TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS.length);
      return { statusCode: 500, body: "Telegram not configured" };
    }

    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    await Promise.all(TELEGRAM_CHAT_IDS.map(async (chatId) => {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("document", pdfBuffer, { filename: "order.pdf", contentType: "application/pdf" });

      // Undici fetch with form-data requires headers from form.getHeaders()
      const headers = form.getHeaders();
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;

      const res = await fetch(url, { method: "POST", body: form, headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn("sendDocument failed for chat", chatId, res.status, txt.slice(0, 400));
      }
    }));

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("sendTelegramPDF error:", err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err && err.message ? err.message : String(err) }) };
  }
}

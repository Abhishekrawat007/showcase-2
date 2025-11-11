import fetch from "node-fetch";
import FormData from "form-data";

export async function handler(event) {
  try {
    const { pdfBase64 } = JSON.parse(event.body || "{}");
    if (!pdfBase64) return { statusCode: 400, body: "Missing pdfBase64" };

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (!TELEGRAM_BOT_TOKEN) return { statusCode: 500, body: "Missing TELEGRAM_BOT_TOKEN" };
    if (TELEGRAM_CHAT_IDS.length === 0) return { statusCode: 500, body: "No TELEGRAM_CHAT_ID configured" };

    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    await Promise.all(TELEGRAM_CHAT_IDS.map(async (chatId) => {
      const formData = new FormData();
      formData.append("document", pdfBuffer, "order.pdf");
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${chatId}`, { method: "POST", body: formData });
    }));

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("sendTelegramPDF error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

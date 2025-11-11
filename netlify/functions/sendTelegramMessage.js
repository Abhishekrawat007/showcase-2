import fetch from "node-fetch";
import FormData from "form-data";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { messageText, pdfBase64 } = JSON.parse(event.body || "{}");

    if (!messageText && !pdfBase64) {
      return { statusCode: 400, body: "Missing messageText or pdfBase64" };
    }

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (!TELEGRAM_BOT_TOKEN) {
      return { statusCode: 500, body: "Missing TELEGRAM_BOT_TOKEN env var" };
    }
    if (TELEGRAM_CHAT_IDS.length === 0) {
      return { statusCode: 500, body: "No TELEGRAM_CHAT_ID configured" };
    }

    // Send text (parallel)
    if (messageText) {
      await Promise.all(
        TELEGRAM_CHAT_IDS.map(chatId =>
          fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: messageText,
              parse_mode: "Markdown"
            })
          })
        )
      );
    }

    // Send PDF (parallel)
    if (pdfBase64) {
      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      await Promise.all(
        TELEGRAM_CHAT_IDS.map(async (chatId) => {
          const formData = new FormData();
          formData.append("document", pdfBuffer, "order.pdf");
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${chatId}`, {
            method: "POST",
            body: formData
          });
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("sendTelegramMessage error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

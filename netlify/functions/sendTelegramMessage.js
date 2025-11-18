// netlify/functions/sendTelegramMessage.js
import { fetch } from "undici";

function getChatIdsFromEnv() {
  const raw = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS || "";
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function escapeMarkdownV2(text = "") {
  // Escape according to Telegram MarkdownV2 rules
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body || "{}");
    const messageText = body.messageText || body.text || "";
    if (!messageText) return { statusCode: 400, body: "Missing messageText" };

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_IDS = getChatIdsFromEnv();
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) {
      console.error("Telegram env missing", !!TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS.length);
      return { statusCode: 500, body: "Telegram not configured" };
    }

    const MAX = 4096;

    // chunk message safely by words to avoid breaking Markdown escapes
    const plain = messageText.toString();
    const parts = [];
    if (plain.length <= MAX) {
      parts.push(plain);
    } else {
      let start = 0;
      while (start < plain.length) {
        let end = Math.min(plain.length, start + MAX);
        if (end < plain.length) {
          // try to break at last newline or space
          const lastNewline = plain.lastIndexOf("\n", end);
          const lastSpace = plain.lastIndexOf(" ", end);
          const splitAt = Math.max(lastNewline, lastSpace);
          if (splitAt > start) end = splitAt;
        }
        parts.push(plain.slice(start, end).trim());
        start = end;
      }
    }

    // send each part to all chats
    for (const part of parts) {
      const payload = {
        chat_id: null, // set per chat
        text: escapeMarkdownV2(part),
        parse_mode: "MarkdownV2"
      };

      await Promise.all(TELEGRAM_CHAT_IDS.map(chatId =>
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, chat_id: chatId })
        })
      ));
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, parts: parts.length }) };
  } catch (err) {
    console.error("sendTelegramMessage error:", err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err && err.message ? err.message : String(err) }) };
  }
}

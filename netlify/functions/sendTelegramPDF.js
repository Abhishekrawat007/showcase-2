import fetch from "node-fetch";
import FormData from "form-data";

export async function handler(event) {
  try {
    const { pdfBase64 } = JSON.parse(event.body);
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_IDS = process.env.TELEGRAM_CHAT_ID;

    // Convert base64 string to Buffer
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    for (const chatId of TELEGRAM_CHAT_IDS) {
      const formData = new FormData();
      formData.append("document", pdfBuffer, "order.pdf");

      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${chatId}`,
        {
          method: "POST",
          body: formData
        }
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}

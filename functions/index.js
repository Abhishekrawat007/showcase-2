// Firebase Cloud Function with exact PDF layout from buynow.html 
const functions = require("firebase-functions"); const admin = require("firebase-admin"); const PDFDocument = require("pdfkit"); const { onRequest } = require("firebase-functions/v2/https"); const { initializeApp } = require("firebase-admin/app"); const { getStorage } = require("firebase-admin/storage"); const { tmpdir } = require("os"); const { join } = require("path"); const { writeFileSync, readFileSync } = require("fs"); const fetch = require("node-fetch");

initializeApp();

const TELEGRAM_BOT_TOKEN = "8549572473:AAF_dCIp0Hn1IMS_BMEu1DZAXhEYTtm7jAE"; 
const TELEGRAM_CHAT_IDS = 6020806530;

exports.sendOrderPDF = onRequest(async (req, res) => { try { const { name, phone, cartItems, totalPrice } = req.body; const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", });

// Create PDF in memory
const doc = new PDFDocument();
const tempFilePath = join(tmpdir(), `order_${Date.now()}.pdf`);
const writeStream = doc.pipe(require("fs").createWriteStream(tempFilePath));

// Header
doc.fontSize(18).text("Sublime Store – Order Invoice", { align: "center" });
doc.moveDown();
doc.fontSize(12).text(`Name: ${name}`);
doc.text(`Phone: ${phone}`);
doc.text(`Date: ${timestamp}`);
doc.moveDown();

// Table Header
doc.fontSize(12).text("No.", 50, doc.y, { continued: true });
doc.text("Product", 100, doc.y, { continued: true });
doc.text("Qty", 300, doc.y, { continued: true });
doc.text("Price", 350, doc.y, { continued: true });
doc.text("Amount", 420, doc.y);
doc.moveDown(0.5);
doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

// Table Rows
cartItems.forEach((item, index) => {
  const amount = item.price * item.quantity;
  doc.text(`${index + 1}`, 50, doc.y, { continued: true });
  doc.text(`${item.name}`, 100, doc.y, { continued: true });
  doc.text(`${item.quantity}`, 300, doc.y, { continued: true });
  doc.text(`₹${item.price}`, 350, doc.y, { continued: true });
  doc.text(`₹${amount}`, 420, doc.y);
});

doc.moveDown();
doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
doc.moveDown();
doc.fontSize(13).text(`Total: ₹${totalPrice}`, { align: "right" });

doc.end();

await new Promise((resolve) => writeStream.on("finish", resolve));

// Upload to Firebase Storage
const bucket = getStorage().bucket();
const storageFileName = `orders/order_${Date.now()}.pdf`;
await bucket.upload(tempFilePath, {
  destination: storageFileName,
  metadata: { contentType: "application/pdf" },
});

const file = bucket.file(storageFileName);
const [url] = await file.getSignedUrl({
  action: "read",
  expires: Date.now() + 5 * 60 * 1000, // 5 minutes
});

// Send to Telegram
for (const chatId of TELEGRAM_CHAT_IDS) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      document: url,
      caption: `🧾 New Order from ${name} (📞 ${phone})\nTotal: ₹${totalPrice}`,
    }),
  });
}

res.status(200).json({ message: "PDF sent via Telegram successfully." });

} catch (error) { console.error("Error sending PDF:", error); res.status(500).json({ error: "Failed to generate or send PDF." }); } });
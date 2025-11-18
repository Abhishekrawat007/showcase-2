// netlify/functions/sendVerification.js
import admin from "firebase-admin";
import zlib from "zlib";
import { promisify } from "util";
import { fetch as undiciFetch } from "undici";

const gunzip = promisify(zlib.gunzip);

let _saCache = null;
let _initPromise = null;

async function loadServiceAccount() {
  if (_saCache) return _saCache;
  const b64 = process.env.FIREBASE_SA_GZ;
  if (!b64) throw new Error("Missing FIREBASE_SA_GZ");

  const buff = Buffer.from(b64, "base64");
  const jsonBuf = await gunzip(buff);
  _saCache = JSON.parse(jsonBuf.toString());
  return _saCache;
}

async function ensureFirebaseInit() {
  if (admin.apps.length) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const sa = await loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DB_URL
    });
  })();
  return _initPromise;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    await ensureFirebaseInit();

    const body = JSON.parse(event.body || "{}");
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: "Invalid email" };
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.FROM_EMAIL;

    if (!BREVO_API_KEY || !FROM_EMAIL) {
      return { statusCode: 500, body: "Brevo config missing" };
    }

    // Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = Buffer.from(email).toString("base64").replace(/\//g, "_");
    const now = Date.now();

    // Save OTP in Firebase
    await admin.database().ref("emailVerifications/" + key).set({
      email,
      code,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000
    });

    // Send email through Brevo
    const payload = {
      sender: { email: FROM_EMAIL },
      to: [{ email }],
      subject: "Your verification code",
      htmlContent: `<p>Your code is <strong>${code}</strong>. Valid for 10 min.</p>`
    };

    const res = await undiciFetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: json }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error("sendVerification error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

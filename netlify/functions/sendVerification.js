// netlify/functions/sendVerification.js
// Robust fetch handling for Netlify functions
let fetchFn = globalThis.fetch;

if (!fetchFn) {
  // Try undici (recommended) then node-fetch (v2 style)
  try {
    // undici is commonly available or can be installed; prefer undici.fetch
    fetchFn = require('undici').fetch;
  } catch (e1) {
    try {
      // node-fetch v2 supports require; v3 is ESM-only and will fail here.
      fetchFn = require('node-fetch');
    } catch (e2) {
      console.error('No fetch available in function runtime', e1, e2);
      // Throw so deploy fails loudly rather than doing strange runtime errors
      throw new Error('Fetch API not available in function runtime');
    }
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const email = (body.email || '').toString().trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: 'Invalid email' };
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.FROM_EMAIL;
    const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL; // e.g. https://project-id-default-rtdb.firebaseio.com
    const FIREBASE_SECRET = process.env.FIREBASE_SECRET || ''; // optional

    if (!BREVO_API_KEY || !FROM_EMAIL) {
      console.error('Brevo config missing');
      return { statusCode: 500, body: 'Mail config not set' };
    }
    if (!FIREBASE_DB_URL) {
      console.error('FIREBASE_DB_URL missing');
      return { statusCode: 500, body: 'Firebase DB url not configured' };
    }

    // create 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // store in firebase via REST
    const key = Buffer.from(email).toString('base64').replace(/\//g, '_');
    const now = Date.now();
    const record = {
      email,
      code,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000 // 10 minutes
    };

    // write: PUT to /emailVerifications/<key>.json
    const dbUrl = FIREBASE_DB_URL.replace(/\/$/, '');
    const writeUrl = `${dbUrl}/emailVerifications/${encodeURIComponent(key)}.json${FIREBASE_SECRET ? `?auth=${FIREBASE_SECRET}` : ''}`;

    const saveRes = await fetchFn(writeUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!saveRes.ok) {
      const errText = await saveRes.text();
      console.error('Firebase write failed', errText);
      return { statusCode: 500, body: 'Unable to save verification' };
    }

    // Send email via Brevo transactional API
    const subject = `Your ${process.env.SITE_NAME || 'Sublime Store'} verification code`;
    const htmlContent = `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>
      <p>If you didn't request this, ignore this email.</p>`;

    const payload = {
      sender: { email: FROM_EMAIL },
      to: [{ email }],
      subject,
      htmlContent
    };

    const mailRes = await fetchFn('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    let mailJson;
    try {
      mailJson = await mailRes.json();
    } catch (err) {
      // if Brevo returns non-JSON on error, capture text
      const text = await mailRes.text().catch(() => '');
      console.error('Brevo returned non-json response', text);
      return { statusCode: 500, body: JSON.stringify({ error: 'Brevo returned non-JSON response' }) };
    }

    if (!mailRes.ok) {
      console.error('Brevo send failed', mailJson);
      return { statusCode: 500, body: JSON.stringify({ error: mailJson }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: true }) };

  } catch (err) {
    console.error('sendVerification error', err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err && err.message ? err.message : String(err) }) };
  }
};

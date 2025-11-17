// netlify/functions/verifyEmail.js
const fetch = require('node-fetch');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const email = (body.email || '').toString().trim().toLowerCase();
    const code = (body.code || '').toString().trim();

    if (!email || !code) return { statusCode: 400, body: 'Missing email or code' };

    const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
    const FIREBASE_SECRET = process.env.FIREBASE_SECRET || '';

    if (!FIREBASE_DB_URL) {
      console.error('FIREBASE_DB_URL missing');
      return { statusCode: 500, body: 'Firebase DB url not configured' };
    }

    const key = Buffer.from(email).toString('base64').replace(/\//g, '_');
    const dbUrl = FIREBASE_DB_URL.replace(/\/$/, '');
    const readUrl = `${dbUrl}/emailVerifications/${encodeURIComponent(key)}.json${FIREBASE_SECRET ? `?auth=${FIREBASE_SECRET}` : ''}`;

    const resp = await fetch(readUrl);
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Firebase read failed', txt);
      return { statusCode: 500, body: 'Unable to check verification' };
    }
    const rec = await resp.json();
    if (!rec) return { statusCode: 400, body: 'No verification pending for this email' };

    const now = Date.now();
    if (rec.expiresAt && now > rec.expiresAt) {
      // expired: delete entry
      await fetch(readUrl, { method: 'DELETE' });
      return { statusCode: 400, body: 'Code expired' };
    }

    if (rec.code !== code) {
      return { statusCode: 400, body: 'Invalid code' };
    }

    // success: mark verified (set a flag or delete token)
    // Here we delete the token and write a small verified record
    const verifiedUrl = `${dbUrl}/emailVerified/${encodeURIComponent(key)}.json${FIREBASE_SECRET ? `?auth=${FIREBASE_SECRET}` : ''}`;
    await fetch(readUrl, { method: 'DELETE' });
    await fetch(verifiedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, verifiedAt: now })
    });

    return { statusCode: 200, body: JSON.stringify({ verified: true }) };

  } catch (err) {
    console.error('verifyEmail error', err && (err.stack || err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

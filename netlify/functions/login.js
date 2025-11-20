// netlify/functions/login.js  (ESM)
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const password = body.password || '';

    const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!ADMIN_HASH || !JWT_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    // Hash incoming password with sha256 (hex) and compare
    const incomingHash = crypto.createHash('sha256').update(String(password)).digest('hex');

    if (incomingHash !== ADMIN_HASH) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // Create token: include any claims you want (role, iat, etc.)
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });

    return {
      statusCode: 200,
      body: JSON.stringify({ token })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// netlify/functions/create-order.js
const Razorpay = require('razorpay');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Log helpful debug info (won't print secrets, only presence)
    console.log('create-order invoked. env RZP_KEY_ID present?', !!process.env.RZP_KEY_ID);
    console.log('create-order invoked. env RZP_KEY_SECRET present?', !!process.env.RZP_KEY_SECRET);
    console.log('create-order invoked. SITE_URL:', process.env.SITE_URL || '(none)');

    // Parse body and log minimal info
    const bodyRaw = event.body || '{}';
    let body;
    try {
      body = JSON.parse(bodyRaw);
    } catch (e) {
      console.warn('create-order: failed to parse JSON body', e);
      body = {};
    }
    console.log('create-order: request body keys:', Object.keys(body));

    // amount must be in paise. default fallback
    const amount = Number(body.amount) || 10000;

    // Guard: ensure keys exist before creating Razorpay instance
    if (!process.env.RZP_KEY_ID || !process.env.RZP_KEY_SECRET) {
      console.error('create-order error: missing RZP keys in environment');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server: missing RZP_KEY_ID or RZP_KEY_SECRET in environment' })
      };
    }

    const rz = new Razorpay({
      key_id: process.env.RZP_KEY_ID,
      key_secret: process.env.RZP_KEY_SECRET,
    });

    const order = await rz.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      payment_capture: 1,
    });

    console.log('create-order: created order id=', order && order.id);
    return {
      statusCode: 200,
      body: JSON.stringify(order),
    };
  } catch (err) {
    // More informative server error for local debugging
    console.error('create-order error:', err && (err.stack || err.message || err));
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err && (err.message || 'unknown error'),
        // include stack only when running locally (helpful), remove in production
        stack: process.env.NODE_ENV === 'development' ? (err && err.stack) : undefined
      })
    };
  }
};

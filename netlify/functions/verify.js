// netlify/functions/verify.js
const jwt = require("jsonwebtoken");

exports.handler = async function (event) {
  try {
    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Missing token" }) };
    }
    const token = auth.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return { statusCode: 500, body: JSON.stringify({ error: "Server misconfigured" }) };

    const payload = jwt.verify(token, jwtSecret);
    // Optionally check payload.role or other claims
    return { statusCode: 200, body: JSON.stringify({ ok: true, payload }) };
  } catch (err) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

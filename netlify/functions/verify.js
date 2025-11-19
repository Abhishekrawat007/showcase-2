// netlify/functions/verify.js  (ESM)
import jwt from "jsonwebtoken";

export const handler = async (event) => {
  try {
    // headers may be lowercase or capitalized depending on environment
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || null;
    if (!auth || !auth.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "Missing token" })
      };
    }

    const token = auth.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Server misconfigured (missing JWT_SECRET)" })
      };
    }

    let payload;
    try {
      // jwt.verify will throw on invalid token
      payload = jwt.verify(token, jwtSecret);
    } catch (err) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "Invalid token", details: err.message })
      };
    }

    // Optionally validate claims here (payload.role, exp, etc.)
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, payload })
    };

  } catch (err) {
    console.error("verify handler error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};

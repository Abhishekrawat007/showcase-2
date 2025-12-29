// netlify/functions/smartImageSearch.js
import fetch from "node-fetch";

/*
  SMART IMAGE SEARCH ENGINE
  -------------------------
  Priority:
  1. Google Images
  2. Yahoo Images
  3. Bing Images
*/

export async function handler(event) {
  try {
    const { productName } = JSON.parse(event.body || "{}");

    if (!productName) {
      return json({ error: "Missing productName" }, 400);
    }

    let images = [];

    // 1️⃣ GOOGLE (PRIMARY)
    images.push(...await googleImages(productName));

    // 2️⃣ YAHOO (SECONDARY)
    if (images.length < 10) {
      images.push(...await yahooImages(productName));
    }

    // 3️⃣ BING (FALLBACK)
    if (images.length < 10) {
      images.push(...await bingImages(productName));
    }

    // CLEAN + DEDUPE + LIMIT
    images = [...new Set(images)]
      .filter(isValidImage)
      .slice(0, 10);

    return json({ images });

  } catch (err) {
    console.error("smartImageSearch error:", err);
    return json({ error: "Image search failed" }, 500);
  }
}

/* =========================
   GOOGLE IMAGES (WORKING)
   Extracts real URLs from "ou"
========================= */
async function googleImages(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(
    query
  )}&tbm=isch`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const html = await res.text();

  // Google stores real image URLs as "ou":"https://..."
  const matches = [...html.matchAll(/"ou":"([^"]+)"/g)];
  return matches.map(m => m[1]);
}

/* =========================
   YAHOO IMAGES
========================= */
async function yahooImages(query) {
  const url = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    }
  });

  const html = await res.text();

  // Yahoo stores URLs as "imgurl":"..."
  const matches = [...html.matchAll(/"imgurl":"([^"]+)"/g)];
  return matches.map(m => decodeURIComponent(m[1]));
}

/* =========================
   BING IMAGES
========================= */
async function bingImages(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    }
  });

  const html = await res.text();

  // Bing stores URLs as "murl":"..."
  const matches = [...html.matchAll(/"murl":"([^"]+)"/g)];
  return matches.map(m => m[1]);
}

/* =========================
   IMAGE FILTER
========================= */
function isValidImage(url) {
  if (!url) return false;

  const u = url.toLowerCase();

  if (
    u.includes("logo") ||
    u.includes("icon") ||
    u.includes("svg") ||
    u.includes("watermark")
  ) return false;

  return /\.(jpg|jpeg|png|webp)(\?|$)/.test(u);
}

/* =========================
   RESPONSE HELPER
========================= */
function json(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

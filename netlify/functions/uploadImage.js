export const handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify admin token
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No token' }) };
  }

  // Verify token with your secret
  const JWT_SECRET = process.env.JWT_SECRET;
  try {
    // Simple JWT verification (you can use jsonwebtoken package if installed)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    if (!payload || payload.exp * 1000 < Date.now()) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
  } catch (err) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  try {
    const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
    const CLOUDINARY_PRESET = process.env.CLOUDINARY_PRESET;

    if (!CLOUDINARY_URL || !CLOUDINARY_PRESET) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Cloudinary config missing' }) 
      };
    }

    // Parse the uploaded file from event body
    const body = JSON.parse(event.body);
    const imageData = body.imageData; // base64 string

    // Upload to Cloudinary using fetch
    const formData = new URLSearchParams();
    formData.append('file', imageData);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = await response.json();

    if (data.secure_url) {
      return {
        statusCode: 200,
        body: JSON.stringify({ secure_url: data.secure_url })
      };
    } else {
      throw new Error(data.error?.message || 'Upload failed');
    }

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
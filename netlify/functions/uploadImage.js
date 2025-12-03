export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No token' }) };
  }

  try {
    const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
    const CLOUDINARY_PRESET = process.env.CLOUDINARY_PRESET;

    const body = JSON.parse(event.body);
    const imageData = body.imageData; // Full data URL like: data:image/png;base64,iVBOR...

    // Import fetch
    const fetch = (await import('node-fetch')).default;

    // Send directly to Cloudinary (it accepts data URLs)
    const formBody = new URLSearchParams();
    formBody.append('file', imageData);
    formBody.append('upload_preset', CLOUDINARY_PRESET);

    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody.toString()
    });

    const data = await response.json();

    if (data.secure_url) {
      return {
        statusCode: 200,
        body: JSON.stringify({ secure_url: data.secure_url })
      };
    } else {
      console.error('Cloudinary error:', data);
      throw new Error(data.error?.message || 'Cloudinary upload failed');
    }

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
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

    if (!CLOUDINARY_URL || !CLOUDINARY_PRESET) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Cloudinary config missing' }) 
      };
    }

    const body = JSON.parse(event.body);
    let imageData = body.imageData;

    // ✅ FIX: If it's a data URL, keep as-is. If it's raw base64, add prefix
    if (!imageData.startsWith('data:')) {
      imageData = 'data:image/jpeg;base64,' + imageData;
    }

    const { fetch: undiciFetch } = await import('undici');
    const { FormData } = await import('undici');

    const form = new FormData();
    form.append('file', imageData);
    form.append('upload_preset', CLOUDINARY_PRESET);

    const response = await undiciFetch(CLOUDINARY_URL, {
      method: 'POST',
      body: form
    });

    const data = await response.json();

    if (data.secure_url) {
      return {
        statusCode: 200,
        body: JSON.stringify({ secure_url: data.secure_url })
      };
    } else {
      console.error('Cloudinary error:', data);
      throw new Error(data.error?.message || JSON.stringify(data.error) || 'Upload failed');
    }

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
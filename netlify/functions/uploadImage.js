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
    const imageData = body.imageData;

    // Use undici (already in package.json)
    const { fetch: undiciFetch } = await import('undici');

    // Send to Cloudinary
    const formBody = new URLSearchParams();
    formBody.append('file', imageData);
    formBody.append('upload_preset', CLOUDINARY_PRESET);

    const response = await undiciFetch(CLOUDINARY_URL, {
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
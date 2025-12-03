const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify admin token (same as other functions)
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No token' }) };
  }

  // TODO: Verify token here (use your existing verify logic)
  
  try {
    const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
    const CLOUDINARY_PRESET = process.env.CLOUDINARY_PRESET;

    // Parse the uploaded file from event body
    const body = JSON.parse(event.body);
    const imageData = body.imageData; // base64 string

    // Create form data
    const formData = new FormData();
    formData.append('file', imageData);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    // Upload to Cloudinary
    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ secure_url: data.secure_url })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
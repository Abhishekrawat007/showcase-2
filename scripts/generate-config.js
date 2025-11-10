// scripts/generate-config.js
// Generates js/config.js from .env.local for Firebase + Cloudinary
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment file
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from .env.local`);
} else {
  console.warn('⚠️  .env.local not found! Proceeding with process.env...');
}

// Helper: safely get trimmed value
function getEnv(name) {
  return (process.env[name] || '').trim();
}

// Construct config object
const config = {
  firebase: {
    apiKey: getEnv('FIREBASE_API_KEY'),
    authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('FIREBASE_APP_ID')
  },
  cloudinary: {
    url: getEnv('CLOUDINARY_URL'),
    preset: getEnv('CLOUDINARY_PRESET')
  }
};

// Output file path
const outPath = path.resolve(process.cwd(), 'js', 'config.js');

// Create js folder if missing
fs.mkdirSync(path.dirname(outPath), { recursive: true });

// Write config.js
const output = `// Auto-generated — DO NOT COMMIT
window.__CONFIG = ${JSON.stringify(config, null, 2)};
`;

fs.writeFileSync(outPath, output, 'utf8');

console.log(`✅ Config written to js/config.js`);

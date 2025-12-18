const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

exports.handler = async () => {
  try {
    const snap = await admin.database().ref("orders").once("value");
    const val = snap.val() || {};
    const orders = Object.values(val);

    return {
      statusCode: 200,
      body: JSON.stringify({ orders })
    };
  } catch (err) {
    console.error("getAllOrders error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

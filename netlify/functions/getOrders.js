const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };

  try {
    const { phone } = JSON.parse(event.body);
    
    const snapshot = await admin.database()
      .ref("orders")
      .orderByChild("phone")
      .equalTo(phone)
      .once("value");
    
    const orders = snapshot.val();
    const ordersArray = orders ? Object.values(orders) : [];
    
    return {
      statusCode: 200,
      body: JSON.stringify({ orders: ordersArray })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
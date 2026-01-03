// ✅ SEND NOTIFICATION + AUTO-CLEANUP FAILED TOKENS
let notifResult = { status: 'starting' };
try {
  const snapshot = await admin.database().ref('sites/showcase-2/adminTokens').once('value');
  const tokenData = snapshot.val() || {};
  const adminTokens = Object.values(tokenData).map(t => t.token).filter(Boolean);
  
  notifResult.tokensFound = adminTokens.length;

  if (adminTokens.length > 0) {
    notifResult.status = 'sending';
    let successCount = 0;
    let failureCount = 0;
    const toRemove = []; // Track failed tokens
    
    for (const token of adminTokens) {
      try {
        await admin.messaging().send({
          token: token,
          notification: {
            title: "🔔 New Order!",
            body: `${order.name || 'Customer'} - ₹${order.totalAmount || 0}`
          },
          webpush: {
            fcmOptions: { link: "/editor.html" }
          }
        });
        successCount++;
      } catch (err) {
        failureCount++;
        // ✅ AUTO-REMOVE INVALID TOKENS
        if (err.code === 'messaging/registration-token-not-registered' || 
            err.code === 'messaging/invalid-registration-token') {
          toRemove.push(token);
          console.log('Invalid token detected, will remove:', token.substring(0, 20));
        }
      }
    }
    
    // ✅ CLEANUP INVALID TOKENS
    for (const token of toRemove) {
      await admin.database().ref('sites/showcase-2/adminTokens/' + token).remove();
    }
    
    notifResult.status = 'sent';
    notifResult.success = successCount;
    notifResult.failed = failureCount;
    notifResult.removed = toRemove.length;
  } else {
    notifResult.status = 'noTokens';
  }
} catch (notifErr) {
  notifResult.status = 'error';
  notifResult.error = notifErr.message;
}
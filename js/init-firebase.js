// js/init-firebase.js
(function initFirebase() {
  if (!window.__CONFIG || !window.__CONFIG.firebase) {
    console.warn('window.__CONFIG.firebase missing — Firebase not initialized');
    return;
  }
  try {
    const c = window.__CONFIG.firebase || {};
    const firebaseConfig = {
      apiKey: c.apiKey,
      authDomain: c.authDomain,
      projectId: c.projectId,
      storageBucket: c.storageBucket,
      messagingSenderId: c.messagingSenderId,
      appId: c.appId
    };
    // only init once
    if (window.firebase && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      window.database = firebase.database();
      console.log('✅ Firebase initialized via js/init-firebase.js');
    }
  } catch (err) {
    console.error('Firebase init error', err);
  }
})();

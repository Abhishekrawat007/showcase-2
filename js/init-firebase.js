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
      appId: c.appId,
      // <- ADD databaseURL (use value for your project region)
      databaseURL: c.databaseURL || "https://showcase-2-24f0a-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    // only init once
    if (window.firebase && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      // compat DB reference used by legacy code
      window.database = firebase.database();
      window.db = window.database; // keep both names used elsewhere
      console.log('✅ Firebase initialized via js/init-firebase.js');
    }
  } catch (err) {
    console.error('Firebase init error', err);
  }
})();

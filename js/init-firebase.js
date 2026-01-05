// js/init-firebase.js — robust loader + dispatcher
(function initFirebase() {
  // Wait until window.__CONFIG is available (most sites embed it early, but be defensive)
  function getConfig() {
    return window.__CONFIG && window.__CONFIG.firebase ? window.__CONFIG.firebase : null;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-firebase="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.setAttribute('data-firebase', src);
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function doInit() {
    const c = getConfig();
    if (!c) {
      console.warn('window.__CONFIG.firebase missing — Firebase not initialized (waiting 500ms and retry)');
      // retry once after 500ms (useful if config injected slightly later)
      await new Promise(r => setTimeout(r, 500));
    }

    const cfg = getConfig() || (c || {});
    const firebaseConfig = {
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId || 'showcase-2-24f0a',
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
      databaseURL: cfg.databaseURL || "https://showcase-2-24f0a-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    try {
      // Ensure compat scripts are present (use same version as your SW for consistency)
      const ver = '10.12.0';
      await loadScript(`https://www.gstatic.com/firebasejs/${ver}/firebase-app-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${ver}/firebase-messaging-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${ver}/firebase-database-compat.js`);
    } catch (err) {
      console.error('Failed to load firebase scripts', err);
      // still dispatch event so other code can handle fallback
      window.db = null;
      document.dispatchEvent(new Event('firebase-ready'));
      return;
    }

    try {
      // initialize only once
      if (!window.firebase || !firebase.initializeApp) {
        console.error('Firebase global not present after script load — aborting init');
        window.db = null;
        document.dispatchEvent(new Event('firebase-ready'));
        return;
      }

      if (!firebase.apps.length) {
        try { firebase.initializeApp(firebaseConfig); } catch(e) { /* ignore if already initted */ }
      }

      // back-compat globals used by your editor code
      try { window.database = firebase.database ? firebase.database() : null; } catch(e){ window.database = null; }
      try { window.db = window.database; } catch(e){ window.db = null; }
      try { window.firebase = firebase; } catch(e){ /* noop */ }

      console.log('✅ Firebase initialized via js/init-firebase.js — window.db:', !!window.db);

      // signal other code that firebase is ready
      document.dispatchEvent(new Event('firebase-ready'));
    } catch (err) {
      console.error('Firebase init error', err);
      window.db = null;
      document.dispatchEvent(new Event('firebase-ready'));
    }
  }

  // start it
  doInit();
   // Setup foreground handler after Firebase ready
  document.addEventListener('firebase-ready', () => {
    if (window.firebase && firebase.messaging) {
      try {
        const messaging = firebase.messaging();
        messaging.onMessage((payload) => {
          console.log('📬 Foreground message:', payload);
          const title = payload.notification?.title || 'New notification';
          const body = payload.notification?.body || '';
          new Notification(title, {body});
        });
        console.log('✅ Foreground handler registered');
      } catch(e) {
        console.warn('Foreground handler setup failed', e);
      }
    }
  });
})();

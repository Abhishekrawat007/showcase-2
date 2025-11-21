// js/push.js - safer, namespaced, backwards-compatible version
// ----------------------------------------------------------
(function () {
  const PREFIX = 'sublime'; // namespacing for keys & classes
  const LS_SHOWN_KEYS = [PREFIX + 'NotifPromptShown', 'notifPromptShown']; // honor old key too
  const LS_LAST_KEYS = [PREFIX + 'NotifPromptLastShown', 'notifPromptLastShown'];
  const HIDDEN_CLASS = PREFIX + '-hidden';

  const REPEAT_INTERVAL = 60 * 60 * 1000; // 1 hour
  const SHOW_DELAY_MS = 15 * 1000;

  let localToastTimer = null;

  function log(...args) { console.log('sublime-push:', ...args); }
  function warn(...args) { console.warn('sublime-push:', ...args); }
  function err(...args) { console.error('sublime-push:', ...args); }

  // helper to read/write namespaced LS but keep backwards compatibility
  function lsGet(keys) {
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k);
        if (v !== null) return v;
      } catch (_) {}
    }
    return null;
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  // Always try to restore scroll lock
  function restoreScroll() {
    try {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    } catch (_) {}
  }
// Debounce reconciler so it doesn't run repeatedly on focus/visibility/etc.
let __sublime_reconcile_last = 0;
function reconcileShouldRun() {
  try {
    const now = Date.now();
    const last = parseInt(localStorage.getItem('sublime:reconcileLast') || '0', 10);
    if (now - last < 6000) return false; // 6s throttle
    localStorage.setItem('sublime:reconcileLast', String(now));
    return true;
  } catch (e) { return true; }
}

  // Service worker registration safe wrapper
  let swRegistrationPromise = null;
  try {
    if ('serviceWorker' in navigator) {
      swRegistrationPromise = navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(reg => {
          log('Service Worker registered', reg.scope);
          return reg;
        })
        .catch(e => {
          warn('Service Worker registration failed', e);
          return null;
        });
    } else {
      swRegistrationPromise = Promise.resolve(null);
    }
  } catch (e) {
    swRegistrationPromise = Promise.resolve(null);
    warn('SW registration thrown', e);
  }

  // theme helper (keeps your existing logic)
  function applyModalTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') { document.documentElement.classList.add('dark-mode'); return; }
    if (saved === 'light') { document.documentElement.classList.remove('dark-mode'); return; }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) document.documentElement.classList.add('dark-mode');
    else document.documentElement.classList.remove('dark-mode');
  }
  window.addEventListener('storage', (e) => { if (e.key === 'theme') applyModalTheme(); });

  // Namespaced show/hide that also supports old 'hidden' class
  function showElement(el) {
    if (!el) return;
    el.classList.remove(HIDDEN_CLASS);
    el.classList.remove('hidden');
    el.style.display = ''; // let CSS control it
  }
  function hideElement(el) {
    if (!el) return;
    el.classList.add(HIDDEN_CLASS);
    el.classList.add('hidden');
    // do not forcibly set display:none in case other logic relies on it
  }

    async function shouldShowPopup() {
    try {
      const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
      // Try Permissions API for more accurate state
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const p = await navigator.permissions.query({ name: 'notifications' });
          if (p && p.state === 'denied') return false;
          if (p && p.state === 'granted') { try { lsSet(LS_SHOWN_KEYS[0], '1'); } catch(_){}; return false; }
        } catch(_) {}
      }

      if (perm === 'denied') return false;
      if (perm === 'granted') { try { lsSet(LS_SHOWN_KEYS[0], '1'); } catch(_){}; return false; }
      if (perm === 'default') return true;
    } catch (e) { /* fallback to legacy code */ }

    // old logic fallback
    try {
      if (lsGet(LS_SHOWN_KEYS) === '1') return false;
    } catch (_) {}
    const lastShown = lsGet(LS_LAST_KEYS);
    if (!lastShown) return true;
    const elapsed = Date.now() - parseInt(lastShown || '0', 10);
    return elapsed > REPEAT_INTERVAL;
  }


    async function savePushToken(token, context = 'web') {
    try {
      if (!window.firebase || !firebase.database) {
        warn('Firebase DB not available; token not saved.');
        return;
      }

      // Build payload with metadata so we can reason about tokens later
      const payload = {
        token,
        context,              // 'web' or 'pwa'
        ua: navigator.userAgent || null,
        origin: location.origin || null,
        time: Date.now()
      };

      // Save under pushSubscribers/<token> (idempotent)
      await firebase.database().ref("pushSubscribers/" + token).set(payload);
      log('Push token saved to DB ✅', token, context);
   // also mirror token to /tokens so server broadcast (legacy) can read it
try {
  // use a short stable key derived from token to avoid huge key names
  const shortKey = token.slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, '');
  await firebase.database().ref("/tokens/" + shortKey).set({ token });
  log('Mirrored token to /tokens/' + shortKey);
} catch (e) {
  warn('mirror to /tokens failed', e);
}

      // non-blocking subscribe call (best-effort)
      fetch("/.netlify/functions/subscribe-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, topic: "all" })
      }).then(r => r.json()).then(d => log('subscribe-topic response', d)).catch(e => warn('subscribe-topic error', e));
    } catch (e) {
      warn('savePushToken failed', e);
    }
  }
    // detect PWA / standalone display-mode
  function isRunningAsPWA() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true
        || document.referrer && document.referrer.startsWith('android-app://');
    } catch (_) { return false; }
  }

  async function createAndSaveToken(reason = 'manual') {
    if (!window.firebase || typeof firebase.messaging !== 'function') {
      warn('Firebase messaging not available');
      return null;
    }

    const messaging = firebase.messaging();
    const reg = await swRegistrationPromise.catch(()=>null);
    const context = isRunningAsPWA() ? 'pwa' : 'web';

    try {
      const token = await messaging.getToken({
        vapidKey: "BHBFlNFxt6EUM9f6NYU_o006ti5ZG0a-VMPJ-dWHYH_X6iqlWpEu3DDB7fvq6OSOaIoIeJBqpw7iZSDntJV-KMk",
        serviceWorkerRegistration: reg || undefined
      });

      if (!token) {
        warn('No token from getToken()');
        return null;
      }

      // Save token with metadata
      await savePushToken(token, context);

      // Optionally store last-known token locally for quick checks
      try { localStorage.setItem(PREFIX + 'LastPushToken', token); } catch(_) {}

      log('createAndSaveToken ok', { token, context, reason });
      return token;
    } catch (err) {
      err('createAndSaveToken error', err);
      return null;
    }
  }
  // expose for outside callers + debugging
try { window.createAndSaveToken = createAndSaveToken; } catch (_) {}


  // Display modal safely (supports both new and old IDs)
  function showNotifModal() {
    applyModalTheme();
    const modal = document.getElementById('sublime-notif-modal') || document.getElementById('notif-modal') || document.getElementById('notif-popup');
    const backdrop = document.getElementById('sublime-notif-backdrop') || document.getElementById('notif-backdrop');
    if (!modal) return;
    showElement(modal);
    if (backdrop) showElement(backdrop);
    try { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; } catch (_) {}
    try { lsSet(LS_LAST_KEYS[0], Date.now().toString()); } catch (_) {}
    // focus enable button if available
    const enableBtn = document.getElementById('sublime-notif-enable') || document.getElementById('notif-enable');
    if (enableBtn) try { enableBtn.focus(); } catch (_) {}
  }

  function hideNotifModal() {
    const modal = document.getElementById('sublime-notif-modal') || document.getElementById('notif-modal') || document.getElementById('notif-popup');
    const backdrop = document.getElementById('sublime-notif-backdrop') || document.getElementById('notif-backdrop');
    if (!modal) return;
    hideElement(modal);
    if (backdrop) hideElement(backdrop);
    restoreScroll();
  }

  // DOM wiring after load
  document.addEventListener('DOMContentLoaded', () => {
    log('popup condition', {
      permission: (typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'),
      shown: lsGet(LS_SHOWN_KEYS),
      last: lsGet(LS_LAST_KEYS)
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { lsSet(LS_SHOWN_KEYS[0], '1'); } catch (_) {}
    }

    if (shouldShowPopup()) {
      setTimeout(() => {
        if (!(typeof Notification !== 'undefined' && Notification.permission === 'granted')) showNotifModal();
      }, SHOW_DELAY_MS);
    }

    // elements (try namespaced first, then fall back)
    const enableBtn = document.getElementById('sublime-notif-enable') || document.getElementById('notif-enable');
    const closeBtn = document.getElementById('sublime-notif-close') || document.getElementById('notif-close');
    const backdrop = document.getElementById('sublime-notif-backdrop') || document.getElementById('notif-backdrop');

    if (backdrop) backdrop.addEventListener('click', (e) => { e.stopPropagation(); });

    // Using local timer so we don't overwrite window._subscribeToastTimer
    let localTimer = null;
    const toast = document.getElementById('sublimeSubscribeToast') || document.getElementById('subscribeToast');
    const toastText = document.getElementById('sublimeSubscribeToastText') || document.getElementById('subscribeToastText');
    const toastSpinner = document.getElementById('sublimeSubscribeToastSpinner') || document.getElementById('subscribeToastSpinner');

    enableBtn && enableBtn.addEventListener('click', (ev) => {
      // call requestPermission immediately as part of user gesture
      let permissionPromise;
      try { permissionPromise = Notification.requestPermission(); } catch (e) { err('requestPermission() failed sync', e); return; }

      hideNotifModal();

      if (toast && toastText && toastSpinner) {
        toastText.textContent = 'Requesting browser permission...';
        toastSpinner.style.display = 'inline-block';
        toast.style.display = 'block';
      }

      permissionPromise.then((permission) => {
        log('Permission result:', permission);
        if (permission !== 'granted') {
          if (toast && toastText && toastSpinner) {
            toastSpinner.style.display = 'none';
            toastText.textContent = 'Notifications blocked or ignored ❌';
            clearTimeout(localTimer);
            localTimer = setTimeout(() => { if (toast) toast.style.display = 'none'; }, 4000);
          }
          try { lsSet(LS_LAST_KEYS[0], Date.now().toString()); } catch (_) {}
          return;
        }

                  // get FCM token (centralized)
            (async () => {
              try {
                const token = await createAndSaveToken('user-click');
                if (token) {
                  try { lsSet(LS_SHOWN_KEYS[0], '1'); } catch (_) {}
                  if (toast && toastText && toastSpinner) {
                    toastSpinner.style.display = 'none';
                    toastText.textContent = 'Notifications enabled ✅';
                    clearTimeout(localTimer);
                    localTimer = setTimeout(() => { if (toast) toast.style.display = 'none'; }, 2000);
                  }
                } else {
                  if (toast && toastText && toastSpinner) {
                    toastSpinner.style.display = 'none';
                    toastText.textContent = 'Error generating token ❌';
                    clearTimeout(localTimer);
                    localTimer = setTimeout(() => { if (toast) toast.style.display = 'none'; }, 2500);
                  }
                }
              } catch (e) {
                err('FCM token error:', e);
                if (toast && toastText) {
                  toastText.textContent = 'Error enabling notifications';
                  clearTimeout(localTimer);
                  localTimer = setTimeout(() => { if (toast) toast.style.display = 'none'; }, 2500);
                }
                restoreScroll();
              }
            })();
      }).catch(e => {
        err('requestPermission() failed:', e);
        restoreScroll();
      });
    });

    // Prevent double-block on mousedown for laptop gestures (retain behaviour)
    enableBtn?.addEventListener('mousedown', (e) => { try { e.preventDefault(); enableBtn.click(); } catch(_){} });

    closeBtn && closeBtn.addEventListener('click', () => {
      try { lsSet(LS_LAST_KEYS[0], Date.now().toString()); } catch (_) {}
      hideNotifModal();
    });

    // restore scroll on escape if open
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('sublime-notif-modal') || document.getElementById('notif-modal') || document.getElementById('notif-popup');
      if (e.key === 'Escape' && modal && !(modal.classList.contains(HIDDEN_CLASS) || modal.classList.contains('hidden'))) {
        try { lsSet(LS_LAST_KEYS[0], Date.now().toString()); } catch (_) {}
        hideNotifModal();
      }
    });

    // restore scroll on page events (safety)
    window.addEventListener('pagehide', restoreScroll);
    window.addEventListener('beforeunload', restoreScroll);

    // watch permission changes if supported
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'notifications' }).then(p => {
          p.onchange = () => {
            log('Notification permission changed to', Notification.permission);
            if (Notification.permission === 'granted') {
              try { lsSet(LS_SHOWN_KEYS[0], '1'); } catch (_) {}
              hideNotifModal();
            }
          };
        }).catch(()=>{/*ignore*/});
      }
    } catch(_) {}

  }); // DOMContentLoaded
 // Reconcile tokens on install / visibility change — ensures PWA token is recorded when user installs app
 async function reconcileOnContext() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;
    if (!reconcileShouldRun()) return;   // <--- throttle here
    await createAndSaveToken('reconcile');
  } catch (e) {
    console.warn('reconcileOnContext failed', e);
  }
}


  window.addEventListener('appinstalled', () => reconcileOnContext());
  window.addEventListener('focus', () => reconcileOnContext());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconcileOnContext(); });

  // Also run once now (best-effort)
  (async () => { await reconcileOnContext(); })();

})(); // IIFE end
 
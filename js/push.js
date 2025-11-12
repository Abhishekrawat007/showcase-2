// js/push.js — refined for better UX & reliability
// ------------------------------------------------
console.log("Checking popup condition", {
  permission: Notification.permission,
  shown: localStorage.getItem('notifPromptShown'),
  last: localStorage.getItem('notifPromptLastShown')
});

// ---------------- Register service worker ----------------
let swRegistrationPromise = null;
if ('serviceWorker' in navigator) {
  swRegistrationPromise = navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(reg => {
      console.log('Push Service Worker registered ✅', reg);
      return reg;
    })
    .catch(err => {
      console.error('Service Worker registration failed ❌', err);
      return null;
    });
} else {
  swRegistrationPromise = Promise.resolve(null);
}

// ---------------- Config (tweakable) ----------------
const REPEAT_INTERVAL = 60 * 60 * 1000; // 1 hour in ms
const SHOW_DELAY_MS = 15 * 1000;        // show modal after 15s for better prompt reliability
const TOKEN_FETCH_TIMEOUT = 9000;       // timeout for messaging.getToken (ms)

// ---------------- Modal theme helper ----------------
function applyModalTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') { document.documentElement.classList.add('dark-mode'); return; }
  if (saved === 'light') { document.documentElement.classList.remove('dark-mode'); return; }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) document.documentElement.classList.add('dark-mode');
  else document.documentElement.classList.remove('dark-mode');
}
window.addEventListener('storage', (e) => { if (e.key === 'theme') applyModalTheme(); });

// ---------------- Modal show/hide helpers ----------------
function showNotifModal() {
  applyModalTheme();
  const modal = document.getElementById('notif-modal') || document.getElementById('notif-popup');
  const backdrop = document.getElementById('notif-backdrop');
  if (!modal) return;

  modal.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');

  // prevent background scroll
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  // accessibility
  document.getElementById('notif-enable')?.focus();

  // record last shown
  try { localStorage.setItem('notifPromptLastShown', Date.now().toString()); } catch (_) {}
}

function hideNotifModal() {
  const modal = document.getElementById('notif-modal') || document.getElementById('notif-popup');
  const backdrop = document.getElementById('notif-backdrop');
  if (!modal) return;
  modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');

  // restore scroll
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

// ---------------- Decide whether to show popup ----------------
function shouldShowPopup() {
  try {
    // already accepted before — never show
    if (localStorage.getItem('notifPromptShown') === '1') return false;
  } catch (_) {}

  // granted → skip
  if (Notification && Notification.permission === 'granted') {
    try { localStorage.setItem('notifPromptShown', '1'); } catch (_) {}
    return false;
  }

  // denied → skip (browser will not re-ask)
  if (Notification && Notification.permission === 'denied') {
    console.log("Permission previously denied — skipping popup.");
    return false;
  }

  // 🚀 If it's the first time (permission === 'default'), always show immediately
  if (Notification && Notification.permission === 'default') {
    console.log("First-time user — showing enable modal.");
    return true;
  }

  // fallback to interval re-show
  const lastShown = localStorage.getItem('notifPromptLastShown');
  if (!lastShown) return true;
  const elapsed = Date.now() - parseInt(lastShown || '0', 10);
  return elapsed > REPEAT_INTERVAL;
}

// ---------------- Save token ----------------
function savePushToken(token) {
  try {
    firebase.database().ref("pushSubscribers/" + token).set({
      token,
      time: Date.now()
    }).then(() => {
      console.log("Push token saved to DB ✅");
      // subscribe to topic via Netlify function
      fetch("/.netlify/functions/subscribe-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, topic: "all" })
      }).then((res) => res.json())
        .then((data) => { console.log("subscribe-topic response:", data); })
        .catch((err) => { console.warn("subscribe-topic error:", err); });
    }).catch((err) => {
      console.error("Token save failed", err);
    });
  } catch (err) {
    console.error("Token save failed", err);
  }
}

// ---------------- DOM wiring ----------------
document.addEventListener('DOMContentLoaded', () => {
  // if already granted, mark as such
  if (Notification && Notification.permission === 'granted') {
    try { localStorage.setItem('notifPromptShown', '1'); } catch (_) {}
  }

  // show modal if conditions say so (with configurable delay)
  if (shouldShowPopup()) {
    setTimeout(() => {
      // final guard: only show if not already granted and modal exists
      if (!(Notification && Notification.permission === 'granted')) showNotifModal();
    }, SHOW_DELAY_MS);
  }

  const enableBtn = document.getElementById('notif-enable');
  const closeBtn = document.getElementById('notif-close');
  const backdrop = document.getElementById('notif-backdrop');

  if (backdrop) backdrop.addEventListener('click', (e) => { e.stopPropagation(); });

 // FAST-UX enable handler — PRESERVE user gesture for mobile
enableBtn?.addEventListener('click', (ev) => {
  // don't call ev.preventDefault() here — leave default behavior unless required
  // (preventDefault can sometimes change gesture handling on some browsers)
  try { /* nothing */ } catch(_) {}

  // 1) CALL requestPermission() IMMEDIATELY as part of the click handler
  //    Do not await anything before this call.
  const permissionPromise = Notification.requestPermission();

  // 2) Update UI quickly (hide modal) AFTER calling requestPermission()
  //    This ensures the permission call is still in the original gesture.
  hideNotifModal();

  // optional: show toast feedback
  const toast = document.getElementById('subscribeToast');
  const toastText = document.getElementById('subscribeToastText');
  const toastSpinner = document.getElementById('subscribeToastSpinner');
  if (toast && toastText && toastSpinner) {
    toastText.textContent = 'Requesting browser permission...';
    toastSpinner.style.display = 'inline-block';
    toast.style.display = 'block';
  }

  // 3) Now handle the result asynchronously
  permissionPromise.then((permission) => {
    console.log('Permission result:', permission);

    if (permission !== 'granted') {
      // gracefully inform user
      if (toast && toastText && toastSpinner) {
        toastSpinner.style.display = 'none';
        toastText.textContent = 'Notifications blocked or ignored ❌';
        clearTimeout(window._subscribeToastTimer);
        window._subscribeToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
      }
      try { localStorage.setItem('notifPromptLastShown', Date.now().toString()); } catch (_) {}
      return;
    }

    // Permission granted — now get SW and FCM token
    (async () => {
      if (!window.firebase || !window.firebase.messaging) {
        console.error('firebase.messaging() missing!');
        return;
      }
      try {
        const reg = await swRegistrationPromise;
        const messaging = window.firebase.messaging();

        const token = await messaging.getToken({
          vapidKey: "BGqOSVUBJJiN8RroZyQ5kmiAzIfdLR-Y85JNYx4vsWxefv-8guZyZJlIWYBOYuFJ16i1DmH_bQlWvwPJpZM7ndM",
          serviceWorkerRegistration: reg || undefined
        });

        if (token) {
          console.log("✅ Got FCM token:", token);
          try { localStorage.setItem('notifPromptShown', '1'); } catch (_) {}
          savePushToken(token);

          if (toast && toastText && toastSpinner) {
            toastSpinner.style.display = 'none';
            toastText.textContent = 'Notifications enabled ✅';
            clearTimeout(window._subscribeToastTimer);
            window._subscribeToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
          }
        } else {
          console.warn('No token received from messaging.getToken()');
          if (toast && toastText && toastSpinner) {
            toastSpinner.style.display = 'none';
            toastText.textContent = 'Error generating token ❌';
            clearTimeout(window._subscribeToastTimer);
            window._subscribeToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2500);
          }
        }
      } catch (err) {
        console.error('FCM token error:', err);
      }
    })();
  }).catch(err => {
    console.error('requestPermission() failed:', err);
  });
});


  // extra protection for some laptop browsers where click might be blocked by focus/overlay
  enableBtn?.addEventListener('mousedown', (e) => { e.preventDefault(); enableBtn.click(); });

  // MAYBE LATER: hide and record lastShown (so reappears later)
  closeBtn?.addEventListener('click', () => {
    try { localStorage.setItem('notifPromptLastShown', Date.now().toString()); } catch (_) {}
    hideNotifModal();
  });

  // ESC key closes modal
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('notif-modal') || document.getElementById('notif-popup');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      try { localStorage.setItem('notifPromptLastShown', Date.now().toString()); } catch (_) {}
      hideNotifModal();
    }
  });

  // Bonus: listen to global permission changes (some browsers expose it)
  try {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'notifications' }).then(p => {
        p.onchange = () => {
          console.log('Notification permission changed to', Notification.permission);
          if (Notification.permission === 'granted') {
            try { localStorage.setItem('notifPromptShown', '1'); } catch (_) {}
            hideNotifModal();
          }
        };
      }).catch(()=>{/*ignore*/});
    }
  } catch(_) {}
});

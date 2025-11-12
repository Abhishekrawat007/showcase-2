// firebase-messaging-sw.js (place at site root)
// Minimal service-worker for FCM + push notifications — NO precaching, NO fetch handler.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

try {
  // Initialize with the same config used on the client. Keep keys allowed in client.
  firebase.initializeApp({
    apiKey: "AIzaSyBBfvlFpfG21SpMpyjmjM-EP_Dt54kYfAI",
    authDomain: "showcase-2-24f0a.firebaseapp.com",
    projectId: "showcase-2-24f0a",
    storageBucket: "showcase-2-24f0a.firebasestorage.app",
    messagingSenderId: "894978656187",
    appId: "1:894978656187:web:2c17a99781591a91c6a69e"
  });
} catch (e) {
  // If already initialized by other SW scope, ignore
  // (avoid noisy error if file is re-executed)
  console.warn('firebase init (sw) warning', e && e.message);
}

const messaging = firebase.messaging();

// Immediately activate new service worker and claim clients
self.addEventListener('install', (evt) => {
  self.skipWaiting();
});

// Remove old caches (if any) but do not create new caches for pages
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    // If you previously had caches you can explicitly delete them here.
    // Example: delete any caches named by you earlier (safe no-op if none).
    try {
      const names = await caches.keys();
      for (const name of names) {
        // Only delete caches created by older SWs of this site if they are not expected.
        // If you had no caches before, this will just skip.
        if (name && name.startsWith('sublime-') /* adjust prefix if used before */) {
          await caches.delete(name);
        }
      }
    } catch (err) {
      console.warn('cache cleanup error', err);
    }
    await self.clients.claim();
  })());
});

// Lightweight helper to extract notification data
function fromPayload(payload) {
  const notif = payload?.notification || {};
  const data = payload?.data || {};

  const title = notif.title || data.title || 'Showcase-2';
  const body = notif.body || data.body || data.message || 'You have a new update';
  const icon = notif.icon || data.icon || '/web-app-manifest-192x192.png';
  const url = (payload?.fcmOptions?.link || data.url || data.click_action || '/');

  return {
    title,
    options: {
      body,
      icon,
      data: { url },
      // Add badge or actions only if you need them
    }
  };
}

// Handle raw Push events (data-only or non-FCM pushes)
self.addEventListener('push', (evt) => {
  try {
    if (!evt.data) {
      evt.waitUntil(self.registration.showNotification('Sublime/Showcase', { body: 'New update' }));
      return;
    }
    let payload;
    try { payload = evt.data.json(); } catch (e) { payload = { data: { message: evt.data.text() } }; }
    const { title, options } = fromPayload(payload);
    evt.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('sw push handler error', err);
  }
});

// FCM background messages (compat)
messaging.onBackgroundMessage((payload) => {
  try {
    const { title, options } = fromPayload(payload);
    return self.registration.showNotification(title, options);
  } catch (err) {
    console.error('onBackgroundMessage error', err);
  }
});

// When a user clicks the notification
self.addEventListener('notificationclick', (evt) => {
  evt.notification.close();
  const url = evt.notification?.data?.url || '/';
  evt.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
    for (const c of windowClients) {
      // If a client with same url exists, focus it
      if (c.url === url && 'focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

// firebase-messaging-sw.js (site root)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: "AIzaSyBBfvlFpfG21SpMpyjmjM-EP_Dt54kYfAI",
    authDomain: "showcase-2-24f0a.firebaseapp.com",
    projectId: "showcase-2-24f0a",
    storageBucket: "showcase-2-24f0a.firebasestorage.app",
    messagingSenderId: "894978656187",
    appId: "1:894978656187:web:2c17a99781591a91c6a69e"
  });
} catch (e) {
  console.warn('firebase init (sw) warning', e && e.message);
}

const messaging = firebase.messaging();

// Activate / claim clients quickly
self.addEventListener('install', (evt) => { self.skipWaiting(); });
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    try {
      // optional: cleanup old caches if you used them previously
      const names = await caches.keys();
      for (const name of names) {
        if (name && name.startsWith('sublime-')) await caches.delete(name);
      }
    } catch (err) { console.warn('cache cleanup error', err); }
    await self.clients.claim();
  })());
});

// Helper: pick icon/badge/tag from payload with sane fallbacks
function notificationFromPayload(payload) {
  const notif = payload?.notification || {};
  const data = payload?.data || {};

  const title = notif.title || data.title || 'Showcase-2';
  const body = notif.body || data.body || data.message || 'You have a new update';

  // Prefer explicit icon from payload; fallback to manifest image placed at root
  const icon = notif.icon || data.icon || '/web-app-manifest-192x192.png';
  const badge = notif.badge || data.badge || '/web-app-manifest-192x192.png';

  // Use a tag to collapse identical notifications (optional per broadcast)
  // If the server sends data.tag, we respect it so you can control collapse behavior
  const tag = data.tag || 'sublime-notification';

  // Add URL to open on click
  const url = (payload?.fcmOptions?.link || data.url || data.click_action || '/');

  const options = {
    body,
    icon,
    badge,
    data: { url },
    tag,
    renotify: false,        // set true if you want to make a noise/vibration on replacement
    // optionally set actions here
  };

  return { title, options };
}


// Use FCM's background hook to display notifications (single path)
messaging.onBackgroundMessage((payload) => {
  try {
    const { title, options } = notificationFromPayload(payload);
    return self.registration.showNotification(title, options);
  } catch (err) {
    console.error('onBackgroundMessage error', err);
  }
});

// When user clicks the notification - open/focus URL
self.addEventListener('notificationclick', (evt) => {
  evt.notification.close();
  const url = evt.notification?.data?.url || '/';
  evt.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const c of windowClients) {
        if (c.url === url && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

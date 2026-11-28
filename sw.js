// Service Worker für Push-Benachrichtigungen (SVEvents)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'SVEvents', {
    body: d.body || '',
    tag: d.tag || undefined,          // gleiche Art ersetzt die vorige Nachricht statt zu stapeln
    renotify: !!d.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: d.url || 'cockpit.html' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || 'cockpit.html', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(target);
  }));
});

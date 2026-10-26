self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : { title: 'Notification', body: 'New message' };

  self.registration.showNotification(payload.title || 'Notification', {
    body: payload.body || 'You have a new notification',
    icon: '/icon.png',
    badge: '/icon.png',
    data: payload.data || {}
  });
});


// 推播提醒：收到通知就顯示；點通知就打開 App
self.addEventListener('push', function (event) {
  var d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title || '超連鎖', {
      body: d.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: d.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus()
      }
      return self.clients.openWindow(url)
    })
  )
})

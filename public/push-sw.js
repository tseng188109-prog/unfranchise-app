// 推播提醒：收到通知就顯示；點通知就打開 App（通知有指定頁面時，直接開到那一頁）
self.addEventListener('push', function (event) {
  var d
  try { d = event.data ? event.data.json() : {} } catch { d = {} }
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
        var c = list[i]
        if ('focus' in c) {
          return c.focus().then(function (fc) {
            if (url !== '/' && fc && 'navigate' in fc) return fc.navigate(url).catch(function () { return fc })
            return fc
          })
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

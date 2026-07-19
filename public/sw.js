// Service Worker for Restaurant POS notifications
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'FOOD_READY') {
    const { tableId, orderNo } = event.data
    self.registration.showNotification('🍽️ Your food is ready!', {
      body: 'Table ' + tableId + ' — Order ' + orderNo + ' is ready for pickup!',
      icon: '🍽️',
      badge: '🔔',
      tag: 'food-ready-' + orderNo,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300, 100, 300, 100, 300],
      actions: [
        { action: 'pickup', title: '🛎️ Pick Up' }
      ]
    })
  }
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].focus) return clientList[i].focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})

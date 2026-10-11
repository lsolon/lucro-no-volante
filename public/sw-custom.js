// LucroNoVolante - PWA Service Worker Personalizado
// Notificações Push para Metas Diárias e Alertas de Manutenção Preventiva

// 1. Tratamento de Push do Servidor / Nuvem
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'LucroNoVolante', body: event.data.text() };
    }
  }

  const title = data.title || 'LucroNoVolante';
  const options = {
    body: data.body || 'Você tem um novo alerta financeiro ou operacional.',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'lucro-push-' + Date.now(),
    renotify: true,
    data: {
      url: data.url || '/',
      tab: data.tab || 'dashboard',
      timestamp: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Clique na Notificação: foca o app e navega para a aba correta (Painel ou Revisão)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  const targetTab = event.notification.data?.tab;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (targetTab && 'postMessage' in client) {
            client.postMessage({ type: 'NAVIGATE_TAB', tab: targetTab });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. Comunicação via Mensagem com o aplicativo (disparo de notificação direto do PWA)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notificationOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      renotify: true,
      ...options
    };
    self.registration.showNotification(title, notificationOptions);
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Ignorar requisições analíticas e keepalive no fetch
self.addEventListener('fetch', (event) => {
  if (
    event.request.url.includes('google-analytics.com') ||
    event.request.url.includes('googletagmanager.com') ||
    event.request.keepalive
  ) {
    return;
  }
});

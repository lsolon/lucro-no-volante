// Register Service Worker for PWA Push & Offline Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function(registration) {
        console.log('[PWA] Service Worker registrado com sucesso:', registration.scope);
      })
      .catch(function(err) {
        console.warn('[PWA] Falha ao registrar Service Worker:', err);
      });
  });
}

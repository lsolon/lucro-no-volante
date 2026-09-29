import { useEffect, useState } from 'react';
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

export default function PWAPrompt() {
  useEffect(() => {
    try {
      const update = registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('Nova versão do PWA disponível. Atualizando automaticamente...');
          if (typeof update === 'function') {
            update(true);
          }
        },
        onOfflineReady() {
          console.log('App pronto para uso offline');
        },
      });
    } catch (err) {
      console.warn('Erro ao registrar SW:', err);
    }
  }, []);

  return null;
}

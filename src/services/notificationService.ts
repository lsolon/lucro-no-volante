// LucroNoVolante - Serviço de Notificações Push PWA

export interface NotificationSettings {
  enabled: boolean;
  notifyDailyGoal: boolean;
  notifyMaintenance: boolean;
  maintenanceThresholdKm: number;
  maintenanceThresholdDays: number;
}

const SETTINGS_KEY = 'lucro_notification_settings';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  notifyDailyGoal: true,
  notifyMaintenance: true,
  maintenanceThresholdKm: 500,
  maintenanceThresholdDays: 7
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[NotificationService] Erro ao salvar configurações:', err);
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (err) {
    console.warn('[NotificationService] Erro ao solicitar permissão:', err);
    return false;
  }
}

interface PWANotificationOptions extends NotificationOptions {
  tab?: 'dashboard' | 'maintenance' | 'history' | 'reports' | 'settings';
  url?: string;
}

/**
 * Dispara uma notificação personalizada aproveitando o Service Worker do PWA
 */
export async function showPWANotification(title: string, options: PWANotificationOptions = {}): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  const currentPermission = Notification.permission;
  if (currentPermission !== 'granted') {
    return false;
  }

  const notificationOptions = {
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200] as any,
    renotify: true,
    ...options,
    data: {
      url: options.url || '/',
      tab: options.tab || 'dashboard',
      timestamp: Date.now(),
      ...options.data
    }
  };

  // 1. Tentar exibir via Service Worker Registration (PWA nativo no sistema operacional)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    } catch (swErr) {
      console.warn('[NotificationService] Service Worker falhou ao exibir notificação, usando fallback:', swErr);
    }
  }

  // 2. Fallback direto da API de Notificação do navegador
  try {
    const n = new Notification(title, notificationOptions);
    n.onclick = () => {
      window.focus();
      if (options.tab) {
        window.dispatchEvent(new CustomEvent('lucro:navigate-tab', { detail: { tab: options.tab } }));
      }
      n.close();
    };
    return true;
  } catch (err) {
    console.error('[NotificationService] Falha ao instanciar notificação:', err);
    return false;
  }
}

/**
 * Verifica e alerta o usuário sobre Meta Diária alcançada
 */
export async function checkAndNotifyDailyGoal(
  todayEarnings: number,
  target: number
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.notifyDailyGoal) return false;
  if (target <= 0 || todayEarnings < target) return false;

  const todayStr = new Date().toISOString().slice(0, 10);
  const cacheKey = `notif_goal_reached_${todayStr}`;

  if (localStorage.getItem(cacheKey)) {
    return false; // Já alertado hoje
  }

  const formattedEarnings = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(todayEarnings);
  const formattedTarget = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(target);

  const success = await showPWANotification('🎉 Meta Diária Alcançada!', {
    body: `Parabéns! Você alcançou ${formattedEarnings} hoje e superou sua meta de ${formattedTarget}. Foco no lucro!`,
    tag: `daily-goal-${todayStr}`,
    tab: 'dashboard'
  });

  if (success) {
    localStorage.setItem(cacheKey, Date.now().toString());
  }

  return success;
}

/**
 * Verifica e alerta o usuário sobre Manutenções Preventivas próximas ao vencimento
 */
export async function checkAndNotifyMaintenance(
  currentKm: number,
  maintenanceIntervals: Array<{ id: string; item: string; intervaloKm: number }>,
  entries: any[],
  categories: Array<{ id: string; nome: string }>
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.notifyMaintenance) return false;
  if (!currentKm || currentKm <= 0) return false;

  let anyNotified = false;

  // 1. Manutenções Padrão (Troca de óleo, pastilhas, etc.)
  for (const interval of maintenanceIntervals) {
    const lastEntry = entries.find(e => {
      const cat = categories.find(c => c.id === e.categoriaId);
      const name = cat?.nome.toLowerCase() || '';
      const itemName = interval.item.toLowerCase();

      if (itemName.includes('óleo') || itemName.includes('oleo')) {
        return (name === 'troca de oleo' || name === 'troca de óleo') && e.km;
      }

      return name.includes(itemName) && e.km;
    });

    if (lastEntry && lastEntry.km) {
      const nextChange = lastEntry.km + interval.intervaloKm;
      const remainingKm = nextChange - currentKm;

      if (remainingKm <= settings.maintenanceThresholdKm) {
        const stage = remainingKm <= 0 ? 'expired' : Math.floor(remainingKm / 150);
        const cacheKey = `notif_maint_std_${interval.id}_${stage}`;

        if (!localStorage.getItem(cacheKey)) {
          const title = remainingKm <= 0
            ? `🚨 Troca Vencida: ${interval.item}`
            : `⚠️ Revisão Próxima: ${interval.item}`;

          const body = remainingKm <= 0
            ? `Atenção: A troca de ${interval.item} ultrapassou o ciclo em ${Math.abs(remainingKm)} km (Km Atual: ${currentKm}).`
            : `Faltam ${remainingKm} km para a troca de ${interval.item} (Km Atual: ${currentKm}). Planeje sua parada!`;

          const sent = await showPWANotification(title, {
            body,
            tag: `maint-${interval.id}`,
            tab: 'maintenance'
          });

          if (sent) {
            localStorage.setItem(cacheKey, Date.now().toString());
            anyNotified = true;
          }
        }
      }
    }
  }

  // 2. Troca de Óleo padrão se não estiver em maintenanceIntervals
  const hasOilInterval = maintenanceIntervals.some(i => i.item.toLowerCase().includes('óleo') || i.item.toLowerCase().includes('oleo'));
  if (!hasOilInterval) {
    const lastOilEntry = entries.find(e => {
      const cat = categories.find(c => c.id === e.categoriaId);
      const name = cat?.nome.toLowerCase() || '';
      return (name === 'troca de oleo' || name === 'troca de óleo') && e.km;
    });

    if (lastOilEntry && lastOilEntry.km) {
      const nextChange = lastOilEntry.km + 10000;
      const remainingKm = nextChange - currentKm;

      if (remainingKm <= settings.maintenanceThresholdKm) {
        const stage = remainingKm <= 0 ? 'expired' : Math.floor(remainingKm / 150);
        const cacheKey = `notif_maint_default_oil_${stage}`;

        if (!localStorage.getItem(cacheKey)) {
          const title = remainingKm <= 0
            ? `🚨 Troca de Óleo Vencida!`
            : `⚠️ Troca de Óleo Próxima!`;

          const body = remainingKm <= 0
            ? `Seu motor está rodando com óleo vencido há ${Math.abs(remainingKm)} km (Km Atual: ${currentKm}). Troque para evitar danos graves!`
            : `Faltam apenas ${remainingKm} km para a próxima Troca de Óleo (Km Atual: ${currentKm}).`;

          const sent = await showPWANotification(title, {
            body,
            tag: 'maint-default-oil',
            tab: 'maintenance'
          });

          if (sent) {
            localStorage.setItem(cacheKey, Date.now().toString());
            anyNotified = true;
          }
        }
      }
    }
  }

  // 3. Itens dinâmicos com garantia em KM ou Meses
  const dynamicEntries = entries.filter(e => (e.garantiaKm || e.garantiaMeses) && e.km);
  for (const entry of dynamicEntries) {
    let itemName = entry.manutencaoItem && entry.manutencaoItem !== 'Sim' ? entry.manutencaoItem : 'Item de Manutenção';
    if (entry.obs) {
      const obsClean = entry.obs.split('- Parcela')[0].trim();
      if (obsClean) itemName += ` (${obsClean.slice(0, 20)})`;
    }

    if (entry.garantiaKm) {
      const nextKm = entry.km + entry.garantiaKm;
      const remainingKm = nextKm - currentKm;

      if (remainingKm <= settings.maintenanceThresholdKm) {
        const stage = remainingKm <= 0 ? 'expired' : Math.floor(remainingKm / 150);
        const cacheKey = `notif_maint_dyn_${entry.id}_${stage}`;

        if (!localStorage.getItem(cacheKey)) {
          const title = remainingKm <= 0
            ? `🚨 Garantia/Revisão Vencida: ${itemName}`
            : `⚠️ Manutenção Próxima: ${itemName}`;

          const body = remainingKm <= 0
            ? `A garantia ou revisão de "${itemName}" venceu há ${Math.abs(remainingKm)} km!`
            : `Faltam apenas ${remainingKm} km para vencer o ciclo de "${itemName}".`;

          const sent = await showPWANotification(title, {
            body,
            tag: `maint-dyn-${entry.id}`,
            tab: 'maintenance'
          });

          if (sent) {
            localStorage.setItem(cacheKey, Date.now().toString());
            anyNotified = true;
          }
        }
      }
    }
  }

  return anyNotified;
}

/**
 * Envia notificação de teste personalizada para validação imediata do usuário
 */
export async function sendTestNotification(): Promise<boolean> {
  const permission = await requestNotificationPermission();
  if (!permission) return false;

  return showPWANotification('🔔 Notificações PWA Ativas!', {
    body: 'Parabéns! O serviço de notificações push do LucroNoVolante está configurado e pronto para alertar suas metas e revisões.',
    tag: 'test-notification-' + Date.now(),
    tab: 'dashboard'
  });
}

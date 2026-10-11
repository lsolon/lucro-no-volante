import { useState, useEffect } from 'react';
import { Bell, BellRing, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, Send, Loader2, Gauge } from 'lucide-react';
import { 
  getNotificationSettings, 
  saveNotificationSettings, 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendTestNotification,
  NotificationSettings 
} from '../services/notificationService';
import { cn } from '../lib/utils';

export default function PWANotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleToggleSetting = (key: keyof NotificationSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveNotificationSettings(next);
  };

  const handleChangeThreshold = (km: number) => {
    const next = { ...settings, maintenanceThresholdKm: km };
    setSettings(next);
    saveNotificationSettings(next);
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (granted) {
      setTestMessage('Permissão concedida com sucesso! Você receberá alertas do app.');
      setTimeout(() => setTestMessage(null), 4000);
    } else {
      setTestMessage('Permissão não foi aceita. Verifique as configurações de notificações do seu navegador.');
      setTimeout(() => setTestMessage(null), 5000);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      const ok = await sendTestNotification();
      setPermission(getNotificationPermission());
      if (ok) {
        setTestMessage('✅ Notificação enviada! Verifique a barra de status do seu celular ou sistema.');
      } else {
        setTestMessage('⚠️ Não foi possível exibir. Certifique-se de permitir notificações no dispositivo.');
      }
    } catch (err) {
      setTestMessage('Erro ao enviar notificação de teste.');
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestMessage(null), 6000);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
            <BellRing size={22} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-base">Notificações Push PWA</h3>
            <p className="text-xs text-slate-400 font-medium">Alertas inteligentes de metas e manutenções</p>
          </div>
        </div>

        <div>
          {permission === 'granted' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-black uppercase tracking-wider">
              <CheckCircle2 size={13} />
              Ativas
            </span>
          )}
          {permission === 'denied' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[11px] font-black uppercase tracking-wider">
              <ShieldAlert size={13} />
              Bloqueadas
            </span>
          )}
          {(permission === 'default' || permission === 'unsupported') && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-black uppercase tracking-wider">
              <AlertTriangle size={13} />
              Pendente
            </span>
          )}
        </div>
      </div>

      {permission !== 'granted' && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles className="text-blue-600 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">Ative as Notificações do Dispositivo</h4>
              <p className="text-xs text-blue-800 font-medium leading-relaxed">
                Receba avisos instantâneos quando você bater a sua meta diária de faturamento ou quando o carro estiver próximo da quilometragem de revisão.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Bell size={16} />
            Habilitar Notificações no Celular
          </button>
        </div>
      )}

      {/* Switches de Configuração */}
      <div className="space-y-3 pt-1">
        {/* Meta Diária */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
          <div className="space-y-0.5 pr-3">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span>🎯</span> Meta Diária Alcançada
            </span>
            <p className="text-[11px] text-slate-500 font-medium">
              Alerta quando seu lucro bruto do dia atingir seus custos diários + margem de lucro.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settings.notifyDailyGoal}
              onChange={() => handleToggleSetting('notifyDailyGoal')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Manutenção Preventiva */}
        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>🔧</span> Manutenções Próximas ao Vencimento
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Alerta sobre trocas de óleo, pastilhas, pneus e revisões que estão perto do ciclo.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.notifyMaintenance}
                onChange={() => handleToggleSetting('notifyMaintenance')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {settings.notifyMaintenance && (
            <div className="pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Gauge size={14} className="text-blue-500" />
                  Avisar quando faltarem:
                </span>
                <span className="text-xs font-black text-blue-600">{settings.maintenanceThresholdKm} km</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[300, 500, 1000].map(km => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => handleChangeThreshold(km)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black transition-all",
                      settings.maintenanceThresholdKm === km
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botão de Teste */}
      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleSendTest}
          disabled={isTesting}
          className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
        >
          {isTesting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Enviando Notificação de Teste...
            </>
          ) : (
            <>
              <Send size={15} />
              Enviar Notificação de Teste no Dispositivo
            </>
          )}
        </button>

        {testMessage && (
          <p className="text-xs text-center font-bold text-slate-700 mt-2.5 p-2 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in">
            {testMessage}
          </p>
        )}
      </div>
    </div>
  );
}

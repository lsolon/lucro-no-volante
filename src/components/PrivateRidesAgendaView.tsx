import React, { useState, useMemo } from 'react';
import { 
  Car, 
  PlusCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Share2, 
  Copy, 
  Check, 
  Settings, 
  Trash2, 
  Play, 
  Flag, 
  DollarSign, 
  TrendingUp, 
  X, 
  MessageCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { 
  PrivateRide, 
  PrivateRidesSettings, 
  Entry, 
  Category, 
  FixedCost 
} from '../types';
import { 
  deletePrivateRideFromFirestore, 
  savePrivateRideToFirestore 
} from '../services/privateRidesService';
import { generatePixPayload } from '../lib/pix';
import { formatCurrency, formatDateBR, formatMinutesToDisplay } from '../lib/utils';
import { showPWANotification } from '../services/notificationService';

interface PrivateRidesAgendaViewProps {
  rides: PrivateRide[];
  settings: PrivateRidesSettings;
  entries: Entry[];
  fixedCosts: FixedCost[];
  categories: Category[];
  earningCategories: Category[];
  driverUid: string;
  driverName: string;
  driverPhone?: string;
  onOpenCalculator: (rideToEdit?: PrivateRide) => void;
  onOpenSettings: () => void;
  onAddEntry: (entry: Omit<Entry, 'id'>) => Promise<any>;
}

export default function PrivateRidesAgendaView({
  rides,
  settings,
  entries,
  fixedCosts,
  categories,
  earningCategories,
  driverUid,
  driverName,
  driverPhone,
  onOpenCalculator,
  onOpenSettings,
  onAddEntry
}: PrivateRidesAgendaViewProps) {
  const [activeTabFilter, setActiveTabFilter] = useState<'ativas' | 'historico'>('ativas');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modal de finalização
  const [finishingRide, setFinishingRide] = useState<PrivateRide | null>(null);
  const [copiedFinalPix, setCopiedFinalPix] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Modal de cancelamento
  const [cancellingRide, setCancellingRide] = useState<PrivateRide | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Corridas filtradas
  const { activeRides, historyRides } = useMemo(() => {
    const now = Date.now();
    const active: PrivateRide[] = [];
    const history: PrivateRide[] = [];

    rides.forEach(ride => {
      // Auto expirar se orcamento expirou
      let currentStatus = ride.status;
      if ((currentStatus === 'orcamento_enviado' || currentStatus === 'aguardando_sinal') && ride.expiresAt) {
        if (new Date(ride.expiresAt).getTime() < now) {
          currentStatus = 'expirada';
        }
      }

      if (currentStatus === 'concluida' || currentStatus === 'cancelada' || currentStatus === 'expirada') {
        history.push({ ...ride, status: currentStatus });
      } else {
        active.push({ ...ride, status: currentStatus });
      }
    });

    // Ordenar ativas por data e horário
    active.sort((a, b) => `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`));
    // Ordenar histórico do mais recente ao mais antigo
    history.sort((a, b) => `${b.scheduledDate} ${b.scheduledTime}`.localeCompare(`${a.scheduledDate} ${a.scheduledTime}`));

    return { activeRides: active, historyRides: history };
  }, [rides]);

  // Estatísticas do Módulo no Mês Atual
  const currentMonthStats = useMemo(() => {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7).replace('-', '/'); // "2026/10"
    
    // Entradas financeiras do tipo Particular
    const particularCategory = earningCategories.find(c => c.nome.toLowerCase() === 'particular');
    const particularCatId = particularCategory?.id;

    let totalMonthEarnings = 0;
    let completedRidesCount = 0;
    let totalCommittedMinutes = 0;

    rides.forEach(r => {
      if (r.status === 'concluida' && r.scheduledDate.startsWith(currentMonthPrefix.replace('/', '-'))) {
        totalMonthEarnings += r.finalTotalAmount;
        completedRidesCount += 1;
        totalCommittedMinutes += r.totalCommittedMinutes || 0;
      }
    });

    // Lucro Líquido / Hora de Particulares
    const privateHours = totalCommittedMinutes > 0 ? (totalCommittedMinutes / 60) : (completedRidesCount * 1.5);
    const privateNetHourly = privateHours > 0 ? (totalMonthEarnings * 0.70) / privateHours : 0; // ~70% de margem líquida pós combustível

    // Lucro Líquido / Hora das Plataformas (Uber / 99) no mês
    let platformEarnings = 0;
    let platformMinutes = 0;
    entries.forEach(e => {
      if (e.data.startsWith(currentMonthPrefix) && e.tipo === 'Ganhos') {
        platformEarnings += e.valor;
        if (e.tempoTrabalhoMinutos) {
          platformMinutes += e.tempoTrabalhoMinutos;
        }
      }
    });
    const platformHours = platformMinutes > 0 ? (platformMinutes / 60) : 0;
    const platformNetHourly = platformHours > 0 ? (platformEarnings * 0.55) / platformHours : 28.50; // Margem média líquida de apps

    return {
      totalMonthEarnings,
      completedRidesCount,
      privateNetHourly: Math.round(privateNetHourly * 100) / 100,
      platformNetHourly: Math.round(platformNetHourly * 100) / 100
    };
  }, [rides, entries, earningCategories]);

  // Copiar link do passageiro
  const handleCopyPassengerLink = (token: string) => {
    const url = `${window.location.origin}/r/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Abrir WhatsApp com mensagem
  const handleShareWhatsApp = (ride: PrivateRide) => {
    const url = `${window.location.origin}/r/${ride.token}`;
    const msg = [
      `Olá, *${ride.passengerName}*! Segue o link com as informações da sua viagem agendada:`,
      `🚗 *${ride.origin}* ➔ *${ride.destination}*`,
      `📅 *${formatDateBR(ride.scheduledDate)}* às *${ride.scheduledTime}*`,
      `💰 *Total:* ${formatCurrency(ride.finalTotalAmount)} (Sinal de reserva: ${formatCurrency(ride.depositAmount)})`,
      ``,
      `Acesse o link seguro abaixo para conferir os dados e confirmar sua vaga:`,
      `${url}`,
      ``,
      `*Garante o motorista exclusivamente disponível para o seu horário!*`
    ].join('\n');

    const cleanPhone = ride.passengerPhone.replace(/\D/g, '');
    let target = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      target = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    }
    window.open(target, '_blank');
  };

  // Motorista confirma recebimento do sinal
  const handleConfirmDeposit = async (ride: PrivateRide) => {
    const updated: PrivateRide = {
      ...ride,
      status: 'confirmada',
      depositConfirmedAt: new Date().toISOString()
    };
    await savePrivateRideToFirestore(driverUid, updated, settings);

    // Push local alert
    showPWANotification('✅ Agendamento Confirmado!', {
      body: `O sinal da corrida com ${ride.passengerName} foi confirmado com sucesso.`,
      tab: 'dashboard'
    });
  };

  // Iniciar corrida
  const handleStartRide = async (ride: PrivateRide) => {
    const updated: PrivateRide = {
      ...ride,
      status: 'em_andamento',
      tripStartedAt: new Date().toISOString()
    };
    await savePrivateRideToFirestore(driverUid, updated, settings);
  };

  // Concluir corrida e lançar no Financeiro
  const handleConfirmFinalPayment = async () => {
    if (!finishingRide) return;
    setIsFinishing(true);
    try {
      // 1. Criar lançamento financeiro do tipo 'Ganhos' com categoria 'Particular'
      const todayFormatted = finishingRide.scheduledDate.replace(/-/g, '/');
      const particularCat = earningCategories.find(c => c.nome.toLowerCase() === 'particular') || { id: 'particular', nome: 'Particular' };

      const financialEntry: Omit<Entry, 'id'> = {
        data: todayFormatted,
        createdAt: new Date().toISOString(),
        tipo: 'Ganhos',
        categoriaId: '10', // Fechamento ou Particular
        valor: finishingRide.finalTotalAmount,
        kmRodado: finishingRide.totalKm,
        tempoTrabalhoMinutos: finishingRide.totalCommittedMinutes,
        tempoTrabalho: formatMinutesToDisplay(finishingRide.totalCommittedMinutes),
        obs: `Corrida Particular: ${finishingRide.origin} ➔ ${finishingRide.destination} (Passageiro: ${finishingRide.passengerName})`,
        ganhos: {
          [particularCat.id]: finishingRide.finalTotalAmount
        },
        ganhosDetalhes: {
          [particularCat.id]: {
            corridas: 1,
            kmRodado: finishingRide.totalKm,
            tempoMinutos: finishingRide.totalCommittedMinutes,
            tempoTrabalho: formatMinutesToDisplay(finishingRide.totalCommittedMinutes)
          }
        }
      };

      const createdEntry = await onAddEntry(financialEntry);

      // 2. Atualizar status da corrida para 'concluida'
      const updated: PrivateRide = {
        ...finishingRide,
        status: 'concluida',
        tripFinishedAt: new Date().toISOString(),
        finalPaymentConfirmedAt: new Date().toISOString(),
        financialEntryId: createdEntry?.id || 'entry_synced'
      };

      await savePrivateRideToFirestore(driverUid, updated, settings);
      setFinishingRide(null);

      // Push notification
      showPWANotification('🎉 Corrida Particular Finalizada!', {
        body: `Receita de ${formatCurrency(finishingRide.finalTotalAmount)} lançada automaticamente no seu painel financeiro.`,
        tab: 'history'
      });
    } catch (err) {
      console.error("Erro ao finalizar corrida:", err);
    } finally {
      setIsFinishing(false);
    }
  };

  // Cancelar corrida
  const handleExecuteCancellation = async () => {
    if (!cancellingRide) return;
    setIsCancelling(true);
    try {
      // Checar se falta mais ou menos de 24h
      const scheduledDateTime = new Date(`${cancellingRide.scheduledDate}T${cancellingRide.scheduledTime}:00`).getTime();
      const diffHours = (scheduledDateTime - Date.now()) / (1000 * 60 * 60);
      const refundHours = settings.cancellationRefundHours || 24;
      const refundEligible = diffHours >= refundHours;
      const refundAmount = refundEligible ? cancellingRide.depositAmount : 0;

      // Se sinal foi retido pelo motorista (<24h), lança como receita no financeiro!
      let retainedEntryId: string | undefined;
      if (!refundEligible && cancellingRide.depositAmount > 0 && cancellingRide.depositConfirmedAt) {
        const todayFormatted = new Date().toISOString().split('T')[0].replace(/-/g, '/');
        const particularCat = earningCategories.find(c => c.nome.toLowerCase() === 'particular') || { id: 'particular', nome: 'Particular' };

        const entry: Omit<Entry, 'id'> = {
          data: todayFormatted,
          createdAt: new Date().toISOString(),
          tipo: 'Ganhos',
          categoriaId: '10',
          valor: cancellingRide.depositAmount,
          obs: `Particular — sinal retido: ${cancellingRide.passengerName} (Cancelamento com menos de ${refundHours}h)`,
          ganhos: {
            [particularCat.id]: cancellingRide.depositAmount
          }
        };

        const res = await onAddEntry(entry);
        retainedEntryId = res?.id;
      }

      const updated: PrivateRide = {
        ...cancellingRide,
        status: 'cancelada',
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'driver',
        cancellationReason: cancelReason || 'Cancelado pelo motorista',
        refundEligible,
        refundAmount,
        refundDone: !refundEligible, // Se não tem devolução, já está resolvido
        retainedDepositEntryId: retainedEntryId
      };

      await savePrivateRideToFirestore(driverUid, updated, settings);
      setCancellingRide(null);
    } catch (err) {
      console.error("Erro ao cancelar corrida:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Excluir corrida
  const handleDeleteRide = async (ride: PrivateRide) => {
    if (!confirm(`Deseja realmente excluir o agendamento de ${ride.passengerName}?`)) return;
    try {
      await deletePrivateRideFromFirestore(driverUid, ride.id, ride.token);
    } catch (err) {
      console.error("Erro ao excluir corrida:", err);
    }
  };

  // Payload Pix para o saldo restante
  const finalPixPayload = useMemo(() => {
    if (!finishingRide || !finishingRide.pixKey) return '';
    try {
      return generatePixPayload({
        key: finishingRide.pixKey,
        name: finishingRide.pixReceiverName || driverName || 'MOTORISTA',
        city: finishingRide.pixReceiverCity || 'BRASIL',
        amount: finishingRide.remainingAmount,
        txid: `REST${finishingRide.token.slice(0, 15).toUpperCase()}`,
        description: `Saldo Restante ${finishingRide.scheduledDate}`
      });
    } catch (e) {
      return '';
    }
  }, [finishingRide, driverName]);

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 rounded-3xl shadow-xl shadow-blue-950/30 border border-blue-500/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-200 shadow-inner">
              <Car size={26} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-tight">Corridas Particulares</h1>
              <p className="text-xs text-blue-200/90 font-medium">Orçamentos, agendamentos com sinal e lucro real</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenSettings}
              className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-2xl transition-all border border-white/10 flex items-center justify-center"
              title="Configurações do Módulo"
            >
              <Settings size={18} />
            </button>

            <button
              onClick={() => onOpenCalculator()}
              className="flex-1 sm:flex-initial py-3 px-5 bg-white text-blue-800 hover:bg-blue-50 active:scale-95 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20"
            >
              <PlusCircle size={18} className="text-blue-600" />
              Novo Agendamento
            </button>
          </div>
        </div>

        {/* KPIs Mensais */}
        <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-white/10 text-center">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-blue-200/80 font-bold uppercase tracking-wider block">Faturamento Mês</span>
            <span className="text-lg sm:text-xl font-black text-white mt-0.5 block">
              {formatCurrency(currentMonthStats.totalMonthEarnings)}
            </span>
            <span className="text-[9px] text-emerald-300 font-medium">{currentMonthStats.completedRidesCount} {currentMonthStats.completedRidesCount === 1 ? 'corrida' : 'corridas'}</span>
          </div>

          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-blue-200/80 font-bold uppercase tracking-wider block">Lucro Particulares</span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5 block">
              {formatCurrency(currentMonthStats.privateNetHourly)}<span className="text-xs text-slate-300">/h</span>
            </span>
            <span className="text-[9px] text-blue-200/80 font-medium">Livre de combustível</span>
          </div>

          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-blue-200/80 font-bold uppercase tracking-wider block">Comparativo Apps</span>
            <span className="text-lg sm:text-xl font-black text-amber-300 mt-0.5 block">
              {formatCurrency(currentMonthStats.platformNetHourly)}<span className="text-xs text-slate-300">/h</span>
            </span>
            <span className="text-[9px] text-emerald-300 font-bold">
              {currentMonthStats.privateNetHourly > currentMonthStats.platformNetHourly 
                ? `+${Math.round(((currentMonthStats.privateNetHourly - currentMonthStats.platformNetHourly) / currentMonthStats.platformNetHourly) * 100)}% mais lucrativo`
                : 'Média de apps'}
            </span>
          </div>
        </div>
      </div>

      {/* Navegação entre Ativas e Histórico */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200/80 shadow-sm max-w-sm">
        <button
          onClick={() => setActiveTabFilter('ativas')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTabFilter === 'ativas'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar size={14} />
          Próximas & Ativas ({activeRides.length})
        </button>
        <button
          onClick={() => setActiveTabFilter('historico')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTabFilter === 'historico'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock size={14} />
          Histórico ({historyRides.length})
        </button>
      </div>

      {/* Lista de Corridas */}
      {activeTabFilter === 'ativas' ? (
        activeRides.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center space-y-3 border border-slate-200/60 shadow-sm">
            <div className="size-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
              <Calendar size={28} />
            </div>
            <h3 className="font-black text-slate-800 text-base">Nenhum agendamento ativo</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Crie orçamentos profissionais, envie o link no WhatsApp do cliente e garanta a corrida com sinal de 50% no Pix!
            </p>
            <button
              onClick={() => onOpenCalculator()}
              className="py-3 px-6 bg-blue-600 text-white rounded-2xl font-bold text-xs hover:bg-blue-700 transition-colors shadow-md"
            >
              Criar Primeiro Agendamento
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                copiedToken={copiedToken}
                onCopyLink={() => handleCopyPassengerLink(ride.token)}
                onShareWhatsApp={() => handleShareWhatsApp(ride)}
                onConfirmDeposit={() => handleConfirmDeposit(ride)}
                onStartRide={() => handleStartRide(ride)}
                onFinishRide={() => setFinishingRide(ride)}
                onCancelRide={() => setCancellingRide(ride)}
                onEditRide={() => onOpenCalculator(ride)}
                onDeleteRide={() => handleDeleteRide(ride)}
              />
            ))}
          </div>
        )
      ) : (
        historyRides.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center space-y-2 border border-slate-200/60 shadow-sm text-slate-400">
            <p className="text-xs">Nenhuma corrida no histórico até o momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historyRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                copiedToken={copiedToken}
                onCopyLink={() => handleCopyPassengerLink(ride.token)}
                onShareWhatsApp={() => handleShareWhatsApp(ride)}
                onConfirmDeposit={() => handleConfirmDeposit(ride)}
                onStartRide={() => handleStartRide(ride)}
                onFinishRide={() => setFinishingRide(ride)}
                onCancelRide={() => setCancellingRide(ride)}
                onEditRide={() => onOpenCalculator(ride)}
                onDeleteRide={() => handleDeleteRide(ride)}
              />
            ))}
          </div>
        )
      )}

      {/* Modal de Finalização de Corrida */}
      {finishingRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl text-center">
            <div className="size-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <DollarSign size={28} />
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-lg">Finalizar Corrida</h3>
              <p className="text-xs text-slate-500 mt-1">
                Passageiro: <strong>{finishingRide.passengerName}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Valor Total da Corrida:</span>
                <span className="font-bold text-slate-800">{formatCurrency(finishingRide.finalTotalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Sinal Já Pago:</span>
                <span className="font-bold text-emerald-600">-{formatCurrency(finishingRide.depositAmount)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                <span>Saldo a Receber Agora:</span>
                <span className="text-base text-blue-600">{formatCurrency(finishingRide.remainingAmount)}</span>
              </div>
            </div>

            {/* Pix QR Code do Saldo Restante */}
            {finalPixPayload && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 font-semibold">Mostre para o passageiro escanear:</p>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 inline-block shadow-sm">
                  <QRCode value={finalPixPayload} size={150} />
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(finalPixPayload);
                    setCopiedFinalPix(true);
                    setTimeout(() => setCopiedFinalPix(false), 2000);
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedFinalPix ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copiedFinalPix ? 'Código Pix Copiado!' : 'Copiar Pix do Restante'}
                </button>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleConfirmFinalPayment}
                disabled={isFinishing}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                {isFinishing ? 'Lançando no Financeiro...' : 'Confirmar Recebimento e Concluir'}
              </button>

              <button
                onClick={() => setFinishingRide(null)}
                className="w-full py-2.5 text-xs text-slate-400 font-bold hover:text-slate-600 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {cancellingRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertCircle size={22} />
              </div>
              <h3 className="font-black text-slate-900 text-base">Cancelar Corrida</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você está cancelando o agendamento de <strong>{cancellingRide.passengerName}</strong>.
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
              <span className="font-bold text-slate-700 block">Política de Sinal:</span>
              <p className="text-slate-500 leading-relaxed">
                Em caso de cancelamento pelo motorista, o sinal de {formatCurrency(cancellingRide.depositAmount)} deve ser devolvido integralmente ao passageiro.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Motivo</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Imprevisto no veículo"
                rows={2}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCancellingRide(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Voltar
              </button>
              <button
                onClick={handleExecuteCancellation}
                disabled={isCancelling}
                className="flex-1 py-3 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors"
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponente de Card de Corrida
interface RideCardProps {
  ride: PrivateRide;
  copiedToken: string | null;
  onCopyLink: () => void;
  onShareWhatsApp: () => void;
  onConfirmDeposit: () => void;
  onStartRide: () => void;
  onFinishRide: () => void;
  onCancelRide: () => void;
  onEditRide: () => void;
  onDeleteRide: () => void;
}

function RideCard({
  ride,
  copiedToken,
  onCopyLink,
  onShareWhatsApp,
  onConfirmDeposit,
  onStartRide,
  onFinishRide,
  onCancelRide,
  onEditRide,
  onDeleteRide
}: RideCardProps) {
  // Configuração visual do status
  const statusConfig = {
    orcamento_enviado: {
      label: 'Orçamento Enviado',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200'
    },
    aguardando_sinal: {
      label: 'Sinal Informado!',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200'
    },
    confirmada: {
      label: 'Confirmada',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200'
    },
    em_andamento: {
      label: 'Em Andamento',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200'
    },
    concluida: {
      label: 'Concluída',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200'
    },
    cancelada: {
      label: 'Cancelada',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200'
    },
    expirada: {
      label: 'Expirada',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200'
    }
  }[ride.status] || {
    label: ride.status,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200'
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between">
      
      {/* Header do Card */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
              {statusConfig.label}
            </span>
            <h3 className="text-base font-black text-slate-800 mt-2">{ride.passengerName}</h3>
            {ride.passengerPhone && (
              <p className="text-xs text-slate-400 font-medium">{ride.passengerPhone}</p>
            )}
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">{formatDateBR(ride.scheduledDate)}</span>
            <span className="text-base font-black text-slate-800">{ride.scheduledTime}</span>
          </div>
        </div>

        {/* Alerta de Ficar Offline (Exclusivo visão do motorista) */}
        {ride.status !== 'concluida' && ride.status !== 'cancelada' && ride.status !== 'expirada' && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
            <span className="font-bold text-amber-800 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-600" />
              Sair das plataformas às:
            </span>
            <span className="font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg">
              {ride.offlineTime}
            </span>
          </div>
        )}

        {/* Trajeto */}
        <div className="text-xs text-slate-600 space-y-1.5 pt-1">
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            <span className="truncate"><strong>Origem:</strong> {ride.origin}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <span className="truncate"><strong>Destino:</strong> {ride.destination}</span>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total</span>
            <span className="font-black text-slate-900">{formatCurrency(ride.finalTotalAmount)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Sinal ({ride.depositPercent}%)</span>
            <span className="font-black text-blue-600">{formatCurrency(ride.depositAmount)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Lucro Líq.</span>
            <span className="font-black text-emerald-600">{formatCurrency(ride.estimatedNetProfit)}</span>
          </div>
        </div>
      </div>

      {/* Ações Inteligentes por Status */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        
        {/* Caso 1: Orçamento Enviado ou Aguardando Sinal */}
        {(ride.status === 'orcamento_enviado' || ride.status === 'aguardando_sinal') && (
          <div className="space-y-2">
            {ride.depositPaidReported && (
              <button
                onClick={onConfirmDeposit}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
              >
                <CheckCircle2 size={16} />
                Confirmar Sinal Recebido ({formatCurrency(ride.depositAmount)})
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onCopyLink}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedToken === ride.token ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copiedToken === ride.token ? 'Link Copiado!' : 'Copiar Link'}
              </button>

              <button
                onClick={onShareWhatsApp}
                className="py-2.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle size={14} />
                WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* Caso 2: Confirmada */}
        {ride.status === 'confirmada' && (
          <div className="space-y-2">
            <button
              onClick={onStartRide}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <Play size={16} />
              Iniciar Corrida
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onCopyLink}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink size={14} />
                Ver Link
              </button>

              <button
                onClick={onCancelRide}
                className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <X size={14} />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Caso 3: Em Andamento */}
        {ride.status === 'em_andamento' && (
          <button
            onClick={onFinishRide}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
          >
            <Flag size={16} />
            Finalizar Corrida & Cobrar Restante
          </button>
        )}

        {/* Caso 4: Concluída */}
        {ride.status === 'concluida' && (
          <div className="flex items-center justify-between text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-2 rounded-xl">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              Lançada no Financeiro
            </span>
            <button
              onClick={onDeleteRide}
              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
              title="Excluir do histórico"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {/* Caso 5: Cancelada / Expirada */}
        {(ride.status === 'cancelada' || ride.status === 'expirada') && (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onEditRide}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Recriar Orçamento
            </button>

            <button
              onClick={onDeleteRide}
              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
              title="Excluir"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

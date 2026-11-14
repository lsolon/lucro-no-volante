import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ShieldCheck, 
  Info, 
  Phone,
  ArrowRight,
  Sparkles,
  Ban,
  Clock4
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PublicBookingData, PrivateRideStatus } from '../types';
import { generatePixPayload } from '../lib/pix';
import { formatCurrency, formatDateBR } from '../lib/utils';

interface PublicPassengerBookingViewProps {
  token: string;
}

export default function PublicPassengerBookingView({ token }: PublicPassengerBookingViewProps) {
  const [booking, setBooking] = useState<PublicBookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentReportedSuccess, setPaymentReportedSuccess] = useState(false);
  
  // Modal de cancelamento
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'public_bookings', token);
    const unsub = onSnapshot(docRef, (docSnap) => {
      setLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data() as PublicBookingData;
        setBooking(data);
        if (data.acceptedTerms) {
          setAcceptedTerms(true);
        }
        if (data.depositPaidReported) {
          setPaymentReportedSuccess(true);
        }
      } else {
        setNotFound(true);
      }
    }, (err) => {
      console.warn("Erro ao buscar agendamento público:", err);
      setLoading(false);
      setNotFound(true);
    });

    return () => unsub();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="size-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-medium text-sm">Carregando detalhes da viagem...</p>
        </div>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 text-center space-y-4">
          <div className="size-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800">Agendamento Não Encontrado</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            O link informado pode ter sido cancelado, expirado ou digitado incorretamente. Por favor, entre em contato com o motorista para solicitar um novo link.
          </p>
        </div>
      </div>
    );
  }

  // Verificar expiração automática
  const isExpired = booking.status === 'expirada' || (
    (booking.status === 'orcamento_enviado' || booking.status === 'aguardando_sinal') &&
    booking.expiresAt && new Date(booking.expiresAt).getTime() < Date.now()
  );

  // Valor a pagar no momento: sinal (se pendente) ou saldo restante (se corrida em andamento/concluída)
  const isRemainingPayment = booking.status === 'em_andamento' || booking.status === 'concluida';
  const currentPayAmount = isRemainingPayment ? booking.remainingAmount : booking.depositAmount;
  const payLabel = isRemainingPayment ? 'Saldo Restante' : 'Sinal de Reserva';

  // Gerar payload Pix
  let pixPayload = '';
  if (booking.pixKey && currentPayAmount > 0) {
    try {
      pixPayload = generatePixPayload({
        key: booking.pixKey,
        name: booking.pixReceiverName || booking.driverName || 'MOTORISTA',
        city: booking.pixReceiverCity || 'BRASIL',
        amount: currentPayAmount,
        txid: `RIDE${booking.token.slice(0, 15).toUpperCase()}`,
        description: `Viagem Particular ${booking.scheduledDate}`
      });
    } catch (e) {
      console.warn("Erro ao gerar payload Pix:", e);
    }
  }

  const handleCopyPix = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleAcceptTermsAndSave = async (accepted: boolean) => {
    setAcceptedTerms(accepted);
    try {
      const docRef = doc(db, 'public_bookings', token);
      await updateDoc(docRef, {
        acceptedTerms: accepted,
        acceptedTermsAt: accepted ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Erro ao atualizar aceite dos termos:", err);
    }
  };

  const handleReportPaid = async () => {
    if (!acceptedTerms) return;
    setSubmittingPayment(true);
    try {
      const docRef = doc(db, 'public_bookings', token);
      await updateDoc(docRef, {
        depositPaidReported: true,
        depositPaidAt: new Date().toISOString(),
        status: 'aguardando_sinal' as PrivateRideStatus,
        updatedAt: new Date().toISOString()
      });
      setPaymentReportedSuccess(true);
    } catch (err) {
      console.error("Erro ao reportar pagamento:", err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleRequestCancellation = async () => {
    setSubmittingCancel(true);
    try {
      // Checar se faltam mais de 24h
      const scheduledDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime}:00`).getTime();
      const diffHours = (scheduledDateTime - Date.now()) / (1000 * 60 * 60);
      const refundEligible = diffHours >= 24;
      const refundAmount = refundEligible ? booking.depositAmount : 0;

      const docRef = doc(db, 'public_bookings', token);
      await updateDoc(docRef, {
        cancellationRequested: true,
        cancellationRequestedAt: new Date().toISOString(),
        cancellationReason: cancelReason || 'Cancelado pelo passageiro',
        refundEligible,
        refundAmount,
        status: 'cancelada' as PrivateRideStatus,
        updatedAt: new Date().toISOString()
      });
      setShowCancelModal(false);
    } catch (err) {
      console.error("Erro ao solicitar cancelamento:", err);
    } finally {
      setSubmittingCancel(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/80 py-6 px-4 sm:px-6">
      <div className="max-w-lg mx-auto space-y-5">
        
        {/* Header Branding */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Car size={24} />
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-base leading-tight">LucroNoVolante</h1>
              <p className="text-xs text-slate-400 font-medium">Agendamento de Viagem Particular</p>
            </div>
          </div>
          
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Link Oficial
          </span>
        </div>

        {/* Status Banner */}
        {isExpired ? (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex items-start gap-3">
            <Clock4 className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 text-sm">Orçamento Expirado</h3>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                O prazo de reserva deste orçamento foi ultrapassado. Entre em contato com o motorista para solicitar uma nova cotação.
              </p>
            </div>
          </div>
        ) : booking.status === 'cancelada' ? (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-3xl flex items-start gap-3">
            <Ban className="size-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-900 text-sm">Viagem Cancelada</h3>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                Este agendamento foi cancelado.
                {booking.refundEligible && booking.refundAmount && booking.refundAmount > 0
                  ? ` Reembolso do sinal (R$ ${booking.refundAmount.toFixed(2).replace('.', ',')}) aprovado conforme as regras.`
                  : ''}
              </p>
            </div>
          </div>
        ) : booking.status === 'confirmada' ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-3xl flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-emerald-900 text-sm">Viagem Confirmada!</h3>
              <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                Seu agendamento está 100% confirmado! O motorista estará disponível exclusivamente para você no horário marcado.
              </p>
            </div>
          </div>
        ) : booking.status === 'em_andamento' ? (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-3xl flex items-start gap-3">
            <Sparkles className="size-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-900 text-sm">Viagem em Andamento</h3>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                Sua corrida está em andamento. Ao final, efetue o pagamento do saldo restante.
              </p>
            </div>
          </div>
        ) : booking.status === 'concluida' ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-3xl flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-emerald-900 text-sm">Viagem Concluída</h3>
              <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                Obrigado por viajar com a gente! Esperamos vê-lo novamente em breve.
              </p>
            </div>
          </div>
        ) : paymentReportedSuccess ? (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-3xl flex items-start gap-3">
            <CheckCircle2 className="size-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-900 text-sm">Sinal Informado!</h3>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                Você marcou que já realizou a transferência do sinal. O motorista conferirá o recebimento e o status mudará para Confirmada.
              </p>
            </div>
          </div>
        ) : null}

        {/* Driver & Vehicle Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/60 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-sm">
                {booking.driverName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{booking.driverName}</h3>
                <p className="text-xs text-slate-400">Motorista Profissional</p>
              </div>
            </div>

            {booking.driverCar?.model && (
              <div className="text-right">
                <span className="text-xs font-bold text-slate-700 block">
                  {booking.driverCar.model}
                </span>
                <span className="text-[11px] text-slate-400">
                  {booking.driverCar.color || ''} {booking.driverCar.plate ? `• ${booking.driverCar.plate}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Passageiro */}
          <div className="text-xs text-slate-500 flex justify-between">
            <span>Passageiro(a): <strong className="text-slate-800">{booking.passengerName}</strong></span>
            {booking.passengerPhone && <span>{booking.passengerPhone}</span>}
          </div>
        </div>

        {/* Route Details Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/60 space-y-4">
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar size={16} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Data</p>
                <p className="text-xs font-bold text-slate-800">{formatDateBR(booking.scheduledDate)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Horário</p>
                <p className="text-xs font-bold text-slate-800">{booking.scheduledTime}</p>
              </div>
            </div>
          </div>

          {/* Origem e Destino */}
          <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            <div className="relative">
              <div className="absolute -left-6 top-1 size-3 rounded-full border-2 border-emerald-500 bg-white"></div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Origem (Embarque)</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">{booking.origin}</p>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-1 size-3 rounded-full border-2 border-rose-500 bg-rose-500"></div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Destino (Desembarque)</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">{booking.destination}</p>
            </div>
          </div>

          {booking.notes && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600">
              <p className="font-bold text-[10px] uppercase text-slate-400 mb-0.5">Observações</p>
              <p>{booking.notes}</p>
            </div>
          )}
        </div>

        {/* Pricing Breakdown Card (REGRA 6: 100% Neutro para o passageiro) */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/60 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Resumo dos Valores</h3>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Valor da viagem:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(booking.tripPrice)}</span>
            </div>

            <div className="flex justify-between items-start text-slate-600">
              <div>
                <span>Taxa de reserva de horário:</span>
                <p className="text-[10px] text-slate-400 italic">Garante o motorista exclusivamente disponível para o seu horário.</p>
              </div>
              <span className="font-semibold text-slate-800">{formatCurrency(booking.scheduleFee)}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Valor Total:</span>
              <span className="text-base text-blue-600">{formatCurrency(booking.totalAmount)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Sinal de Reserva ({booking.depositPercent}%)</span>
                <span className="text-sm font-black text-blue-700 mt-0.5 block">{formatCurrency(booking.depositAmount)}</span>
                <span className="text-[10px] text-blue-500">Pago antecipadamente</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Restante no Desembarque</span>
                <span className="text-sm font-black text-slate-700 mt-0.5 block">{formatCurrency(booking.remainingAmount)}</span>
                <span className="text-[10px] text-slate-400">Pago ao finalizar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cancellation Terms & Acceptance */}
        {(!isExpired && booking.status !== 'cancelada') && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/60 space-y-3">
            <div className="flex items-center gap-2 text-slate-800">
              <ShieldCheck size={18} className="text-blue-600" />
              <h3 className="font-bold text-sm">Condições e Cancelamento</h3>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl text-[11px] text-slate-600 leading-relaxed whitespace-pre-line border border-slate-100">
              {booking.cancellationTermsText}
            </div>

            {/* Checkbox de Aceite */}
            {booking.status === 'orcamento_enviado' && (
              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => handleAcceptTermsAndSave(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Li e concordo com os valores, condições e regras de cancelamento.
                </span>
              </label>
            )}
          </div>
        )}

        {/* Pix Payment Section */}
        {(!isExpired && booking.status !== 'cancelada') && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 space-y-4 text-center">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Pagamento Seguro via Pix
              </span>
              <h3 className="text-base font-black text-slate-800 pt-1">
                Pagar {payLabel}: {formatCurrency(currentPayAmount)}
              </h3>
              <p className="text-xs text-slate-500">
                O valor é creditado diretamente na conta do motorista.
              </p>
            </div>

            {/* QR Code */}
            {pixPayload ? (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 inline-block shadow-sm">
                <QRCode
                  value={pixPayload}
                  size={190}
                  className="mx-auto"
                />
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500">
                Chave Pix não informada pelo motorista. Entre em contato para combinar.
              </div>
            )}

            {/* Pix Copia e Cola */}
            {pixPayload && (
              <div className="space-y-2">
                <button
                  onClick={handleCopyPix}
                  className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-900 active:scale-98 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  {copiedPix ? (
                    <>
                      <Check size={16} className="text-emerald-400" />
                      Código Pix Copiado com Sucesso!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copiar Pix Copia e Cola
                    </>
                  )}
                </button>

                <p className="text-[10px] text-slate-400">
                  Abra o app do seu banco e cole o código acima no Pix Copia e Cola.
                </p>
              </div>
            )}

            {/* Botão "Já paguei o sinal" */}
            {!isRemainingPayment && booking.status !== 'confirmada' && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={handleReportPaid}
                  disabled={!acceptedTerms || submittingPayment || paymentReportedSuccess}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                    paymentReportedSuccess
                      ? 'bg-emerald-600 text-white cursor-default'
                      : !acceptedTerms
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-emerald-500/20'
                  }`}
                >
                  {paymentReportedSuccess ? (
                    <>
                      <CheckCircle2 size={18} />
                      Pagamento Informado ao Motorista
                    </>
                  ) : submittingPayment ? (
                    'Enviando aviso...'
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Já paguei o sinal
                    </>
                  )}
                </button>

                {!acceptedTerms && !paymentReportedSuccess && (
                  <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
                    * Marque o aceite das condições acima para habilitar a confirmação.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Opção de Cancelamento pelo passageiro */}
        {booking.status === 'confirmada' && (
          <div className="text-center pt-2">
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-xs text-slate-400 hover:text-rose-600 font-bold transition-colors underline"
            >
              Precisa cancelar este agendamento?
            </button>
          </div>
        )}

        {/* Modal de Cancelamento */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <AlertCircle size={22} />
                </div>
                <h3 className="font-black text-slate-900 text-base">Cancelar Agendamento</h3>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-600 space-y-2 border border-slate-100">
                <p className="font-semibold text-slate-800">Regras de devolução do sinal:</p>
                <p>• Cancelamento com mais de 24h: devolução integral do sinal de {formatCurrency(booking.depositAmount)}.</p>
                <p>• Cancelamento com menos de 24h: o sinal é retido como compensação da reserva do horário.</p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Motivo do cancelamento (opcional)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explique brevemente o motivo..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={submittingCancel}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleRequestCancellation}
                  disabled={submittingCancel}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors"
                >
                  {submittingCancel ? 'Processando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

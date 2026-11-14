import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calculator, 
  MapPin, 
  Clock, 
  Calendar, 
  Phone, 
  User, 
  ArrowRight, 
  DollarSign, 
  AlertTriangle, 
  Check, 
  Share2, 
  Copy, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  ShieldCheck,
  Info
} from 'lucide-react';
import { 
  PrivateRide, 
  PrivateRidesSettings, 
  Entry, 
  FixedCost 
} from '../types';
import { 
  calculatePrivateRide, 
  calculateDriverRealCostPerKm, 
  calculateDriverNetHourlyProfit, 
  checkRideConflict, 
  generateBookingToken,
  savePrivateRideToFirestore
} from '../services/privateRidesService';
import { formatCurrency, formatDateBR } from '../lib/utils';
import { authFetch } from '../lib/api';

interface PrivateRideCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverUid: string;
  driverName: string;
  driverPhone?: string;
  settings: PrivateRidesSettings;
  entries: Entry[];
  fixedCosts: FixedCost[];
  targetKm?: number;
  existingRides: PrivateRide[];
  recentCycleCostPerKm?: number;
  editingRide?: PrivateRide | null;
  onSaved: (ride: PrivateRide) => void;
}

export default function PrivateRideCalculatorModal({
  isOpen,
  onClose,
  driverUid,
  driverName,
  driverPhone,
  settings,
  entries,
  fixedCosts,
  targetKm,
  existingRides,
  recentCycleCostPerKm,
  editingRide,
  onSaved
}: PrivateRideCalculatorModalProps) {
  // Dados do passageiro e viagem
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  
  // Data e hora padrão: amanhã às 10:00 ou dados existentes
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [scheduledTime, setScheduledTime] = useState('14:00');
  const [notes, setNotes] = useState('');

  // Distâncias e Tempos
  const [displacementKm, setDisplacementKm] = useState<number>(3);
  const [displacementMinutes, setDisplacementMinutes] = useState<number>(10);
  const [tripKm, setTripKm] = useState<number>(15);
  const [tripMinutes, setTripMinutes] = useState<number>(30);
  const [returnEmpty, setReturnEmpty] = useState<boolean>(true);
  const [returnKm, setReturnKm] = useState<number>(15);
  const [returnMinutes, setReturnMinutes] = useState<number>(30);

  // Extras
  const [toll, setToll] = useState<number>(0);
  const [parking, setParking] = useState<number>(0);
  const [otherExtra, setOtherExtra] = useState<number>(0);

  // Custos e Sobrescrita manual
  const [manualCostPerKm, setManualCostPerKm] = useState<string>('');
  const [isManualCost, setIsManualCost] = useState(false);
  const [manualHourlyRate, setManualHourlyRate] = useState<string>('');
  const [isManualHourlyRate, setIsManualHourlyRate] = useState(false);

  // Modal pós-salvamento com link de compartilhamento
  const [savedRide, setSavedRide] = useState<PrivateRide | null>(null);
  const [copiedLink, setCopiedPixLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Google Maps state
  const [originPlaceId, setOriginPlaceId] = useState<string | undefined>(undefined);
  const [destinationPlaceId, setDestinationPlaceId] = useState<string | undefined>(undefined);
  const [originSuggestions, setOriginSuggestions] = useState<Array<{ placeId: string; text: string; secondaryText: string }>>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<Array<{ placeId: string; text: string; secondaryText: string }>>([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [mapsApiError, setMapsApiError] = useState<string | null>(null);
  const sessionTokenRef = React.useRef(crypto.randomUUID());
  const [mapsFilled, setMapsFilled] = useState<{ displacement?: boolean; trip?: boolean; ret?: boolean }>({});
  const skipRouteCalcRef = React.useRef(false);

  useEffect(() => {
    if (!origin || origin.trim().length < 3 || originPlaceId) {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/maps/autocomplete?input=${encodeURIComponent(origin)}&sessionToken=${sessionTokenRef.current}`);
        if (res.ok) {
          const data = await res.json();
          setOriginSuggestions(data.suggestions || []);
          setShowOriginSuggestions(true);
        } else if (res.status === 503 || res.status === 502 || res.status === 429) {
          setMapsApiError("Não foi possível calcular automaticamente — preencha os km manualmente");
        }
      } catch (e) {
        console.warn("Autocomplete error:", e);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [origin, originPlaceId]);

  useEffect(() => {
    if (!destination || destination.trim().length < 3 || destinationPlaceId) {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/maps/autocomplete?input=${encodeURIComponent(destination)}&sessionToken=${sessionTokenRef.current}`);
        if (res.ok) {
          const data = await res.json();
          setDestinationSuggestions(data.suggestions || []);
          setShowDestinationSuggestions(true);
        } else if (res.status === 503 || res.status === 502 || res.status === 429) {
          setMapsApiError("Não foi possível calcular automaticamente — preencha os km manualmente");
        }
      } catch (e) {
        console.warn("Autocomplete error:", e);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [destination, destinationPlaceId]);

  useEffect(() => {
    if (!originPlaceId || !destinationPlaceId) return;
    if (skipRouteCalcRef.current) { skipRouteCalcRef.current = false; return; }
    let isMounted = true;
    async function calcRoute() {
      setIsCalculatingRoute(true);
      setMapsApiError(null);
      try {
        const depDate = new Date(scheduledDate + 'T' + scheduledTime + ':00');
        const departureTime = isNaN(depDate.getTime()) ? undefined : depDate.toISOString();
        const res = await authFetch('/api/maps/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { placeId: originPlaceId },
            destination: { placeId: destinationPlaceId },
            departureTime
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.km !== undefined && data.minutes !== undefined) {
            setTripKm(data.km);
            setTripMinutes(data.minutes);
          setMapsFilled(p => ({ ...p, trip: true }));
            if (returnEmpty && (returnKm === 0 || returnKm === tripKm)) {
              setReturnKm(data.km);
              setReturnMinutes(data.minutes);
            }
          }
        } else {
          if (isMounted) setMapsApiError("Não foi possível calcular automaticamente — preencha os km manualmente");
        }
      } catch (e) {
        console.error("Route error:", e);
        if (isMounted) setMapsApiError("Não foi possível calcular automaticamente — preencha os km manualmente");
      } finally {
        if (isMounted) setIsCalculatingRoute(false);
      }
    }
    calcRoute();
    return () => { isMounted = false; };
  }, [originPlaceId, destinationPlaceId, scheduledDate, scheduledTime]);

  const handleUseMyCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapsApiError('Seu navegador não permite obter a localização.');
      return;
    }
    if (!originPlaceId) {
      setMapsApiError('Escolha a origem na lista de sugestões para calcular o deslocamento.');
      return;
    }
    setMapsApiError(null);
    setIsCalculatingRoute(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let failed = false;
        try {
          const dispRes = await authFetch('/api/maps/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin: { lat, lng }, destination: { placeId: originPlaceId } })
          });
          if (dispRes.ok) {
            const data = await dispRes.json();
            if (typeof data.km === 'number') setDisplacementKm(data.km);
            if (typeof data.minutes === 'number') setDisplacementMinutes(data.minutes);
            setMapsFilled(p => ({ ...p, displacement: true }));
          } else {
            failed = true;
          }
          if (returnEmpty && destinationPlaceId) {
            const retRes = await authFetch('/api/maps/route', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ origin: { placeId: destinationPlaceId }, destination: { lat, lng } })
            });
            if (retRes.ok) {
              const data = await retRes.json();
              if (typeof data.km === 'number') setReturnKm(data.km);
              if (typeof data.minutes === 'number') setReturnMinutes(data.minutes);
              setMapsFilled(p => ({ ...p, ret: true }));
            } else {
              failed = true;
            }
          }
        } catch (e) {
          console.warn('Geolocation route error:', e);
          failed = true;
        } finally {
          setIsCalculatingRoute(false);
        }
        if (failed) setMapsApiError('Não foi possível calcular automaticamente — preencha os km manualmente');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsCalculatingRoute(false);
        setMapsApiError('Não foi possível obter sua localização. Verifique a permissão do navegador.');
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  };

  const pickSuggestion = (field: 'origin' | 'destination', sug: { placeId: string; text: string; secondaryText: string }) => {
    const label = sug.secondaryText ? sug.text + ' - ' + sug.secondaryText : sug.text;
    if (field === 'origin') {
      setOrigin(label);
      setOriginPlaceId(sug.placeId);
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
    } else {
      setDestination(label);
      setDestinationPlaceId(sug.placeId);
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
    }
    sessionTokenRef.current = crypto.randomUUID();
    setMapsApiError(null);
  };

  const renderSuggestions = (field: 'origin' | 'destination', list: Array<{ placeId: string; text: string; secondaryText: string }>) => (
    <ul role="listbox" aria-label="Sugestões de endereço" className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
      {list.map((sug) => (
        <li key={sug.placeId}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickSuggestion(field, sug)}
            className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
          >
            <span className="block text-xs font-semibold text-slate-800">{sug.text}</span>
            {sug.secondaryText && <span className="block text-[10px] text-slate-500">{sug.secondaryText}</span>}
          </button>
        </li>
      ))}
    </ul>
  );

  const mapsBadge = (
    <span className="ml-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 align-middle">Google Maps</span>
  );

  // Calcular custos reais automáticos
  const autoCostData = useMemo(() => {
    return calculateDriverRealCostPerKm(entries, fixedCosts, targetKm, recentCycleCostPerKm);
  }, [entries, fixedCosts, targetKm, recentCycleCostPerKm]);

  const autoHourlyData = useMemo(() => {
    return calculateDriverNetHourlyProfit(entries, scheduledDate, settings.defaultHourlyRate || 30);
  }, [entries, scheduledDate, settings.defaultHourlyRate]);

  // Taxas efetivas
  const effectiveCostPerKm = isManualCost && Number(manualCostPerKm) > 0 
    ? Number(manualCostPerKm) 
    : autoCostData.totalCostPerKm;

  const effectiveHourlyRate = isManualHourlyRate && Number(manualHourlyRate) > 0 
    ? Number(manualHourlyRate) 
    : autoHourlyData.hourlyRate;

  // Carregar dados de edição se fornecido
  useEffect(() => {
    if (editingRide) {
      setPassengerName(editingRide.passengerName || '');
      setPassengerPhone(editingRide.passengerPhone || '');
      setOrigin(editingRide.origin || '');
      setDestination(editingRide.destination || '');
      skipRouteCalcRef.current = !!(editingRide.originPlaceId && editingRide.destinationPlaceId);
      setOriginPlaceId(editingRide.originPlaceId);
      setDestinationPlaceId(editingRide.destinationPlaceId);
      setMapsFilled({});
      setMapsApiError(null);
      setScheduledDate(editingRide.scheduledDate || todayStr);
      setScheduledTime(editingRide.scheduledTime || '14:00');
      setNotes(editingRide.notes || '');
      setDisplacementKm(editingRide.displacementKm ?? 3);
      setDisplacementMinutes(editingRide.displacementMinutes ?? 10);
      setTripKm(editingRide.tripKm ?? 15);
      setTripMinutes(editingRide.tripMinutes ?? 30);
      setReturnEmpty(editingRide.returnEmpty ?? true);
      setReturnKm(editingRide.returnKm ?? 15);
      setReturnMinutes(editingRide.returnMinutes ?? 30);
      setToll(editingRide.extras?.toll || 0);
      setParking(editingRide.extras?.parking || 0);
      setOtherExtra(editingRide.extras?.other || 0);
      if (editingRide.costPerKmSource === 'manual') {
        setIsManualCost(true);
        setManualCostPerKm(String(editingRide.costPerKm));
      }
      if (editingRide.hourlyRateSource === 'manual') {
        setIsManualHourlyRate(true);
        setManualHourlyRate(String(editingRide.hourlyRate));
      }
    } else {
      // Resetar para valores padrão
      setPassengerName('');
      setPassengerPhone('');
      setOrigin('');
      setDestination('');
      setOriginPlaceId(undefined);
      setDestinationPlaceId(undefined);
      setMapsFilled({});
      setMapsApiError(null);
      setScheduledDate(todayStr);
      setScheduledTime('14:00');
      setNotes('');
      setSavedRide(null);
      setIsSaving(false);
      setFormError(null);
    }
  }, [editingRide, isOpen, todayStr]);

  // Se returnEmpty estiver ativo e returnKm for 0, sincronizar com tripKm
  const handleTripKmChange = (val: number) => {
    setTripKm(val);
    if (returnEmpty && (returnKm === 0 || returnKm === tripKm)) {
      setReturnKm(val);
    }
  };

  const handleTripMinutesChange = (val: number) => {
    setTripMinutes(val);
    if (returnEmpty && (returnMinutes === 0 || returnMinutes === tripMinutes)) {
      setReturnMinutes(val);
    }
  };

  // Cálculo ao vivo
  const calc = useMemo(() => {
    return calculatePrivateRide({
      displacementKm: Number(displacementKm) || 0,
      displacementMinutes: Number(displacementMinutes) || 0,
      tripKm: Number(tripKm) || 0,
      tripMinutes: Number(tripMinutes) || 0,
      returnEmpty,
      returnKm: returnEmpty ? (Number(returnKm) || 0) : 0,
      returnMinutes: returnEmpty ? (Number(returnMinutes) || 0) : 0,
      bufferMinutes: settings.bookingBufferMinutes || 15,
      scheduledTime,
      costPerKm: effectiveCostPerKm,
      hourlyRate: effectiveHourlyRate,
      extras: {
        toll: Number(toll) || 0,
        parking: Number(parking) || 0,
        other: Number(otherExtra) || 0
      },
      minimumFare: settings.minimumFare || 25,
      depositPercent: settings.depositPercent || 50
    });
  }, [
    displacementKm,
    displacementMinutes,
    tripKm,
    tripMinutes,
    returnEmpty,
    returnKm,
    returnMinutes,
    settings.bookingBufferMinutes,
    scheduledTime,
    effectiveCostPerKm,
    effectiveHourlyRate,
    toll,
    parking,
    otherExtra,
    settings.minimumFare,
    settings.depositPercent
  ]);

  // Conflito de horário
  const conflictingRide = useMemo(() => {
    return checkRideConflict({
      scheduledDate,
      scheduledTime,
      displacementMinutes: Number(displacementMinutes) || 0,
      bufferMinutes: settings.bookingBufferMinutes || 15,
      tripMinutes: Number(tripMinutes) || 0,
      returnEmpty,
      returnMinutes: returnEmpty ? (Number(returnMinutes) || 0) : 0,
      excludeRideId: editingRide?.id
    }, existingRides);
  }, [
    scheduledDate,
    scheduledTime,
    displacementMinutes,
    settings.bookingBufferMinutes,
    tripMinutes,
    returnEmpty,
    returnMinutes,
    editingRide,
    existingRides
  ]);

  if (!isOpen) return null;

  const handleSaveAndGenerateLink = async () => {
    setFormError(null);
    if (!passengerName.trim()) {
      setFormError('Por favor, informe o nome do passageiro.');
      return;
    }
    if (!origin.trim() || !destination.trim()) {
      setFormError('Por favor, informe a origem e o destino da viagem.');
      return;
    }

    setIsSaving(true);
    try {
      const rideId = editingRide?.id || `ride_${Date.now()}`;
      const token = editingRide?.token || generateBookingToken();

      // Expiração do orçamento: padrão 2 horas a partir de agora
      const validityHours = settings.budgetValidityHours || 2;
      const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString();

      const newRide: PrivateRide = {
        id: rideId,
        token,
        driverUid,
        driverName: driverName || 'Motorista Particular',
        driverPhone: driverPhone || '',
        driverCar: {
          model: settings.carModel || '',
          color: settings.carColor || '',
          plate: settings.carPlate || ''
        },
        passengerName: passengerName.trim(),
        passengerPhone: passengerPhone.trim(),
        origin: origin.trim(),
        destination: destination.trim(),
        originPlaceId: originPlaceId || undefined,
        destinationPlaceId: destinationPlaceId || undefined,
        scheduledDate,
        scheduledTime,
        notes: notes.trim(),

        displacementKm: Number(displacementKm) || 0,
        displacementMinutes: Number(displacementMinutes) || 0,
        tripKm: Number(tripKm) || 0,
        tripMinutes: Number(tripMinutes) || 0,
        returnEmpty,
        returnKm: returnEmpty ? (Number(returnKm) || 0) : 0,
        returnMinutes: returnEmpty ? (Number(returnMinutes) || 0) : 0,
        totalKm: calc.totalKm,
        totalCommittedMinutes: calc.totalCommittedMinutes,
        bufferMinutes: settings.bookingBufferMinutes || 15,
        offlineTime: calc.offlineTime,

        costPerKm: effectiveCostPerKm,
        costPerKmSource: isManualCost ? 'manual' : 'auto',
        hourlyRate: effectiveHourlyRate,
        hourlyRateSource: isManualHourlyRate ? 'manual' : autoHourlyData.source,
        kmCostTotal: calc.kmCostTotal,
        opportunityCostTotal: calc.opportunityCostTotal,
        extras: {
          toll: Number(toll) || 0,
          parking: Number(parking) || 0,
          other: Number(otherExtra) || 0
        },
        totalExtras: calc.totalExtras,
        rawCalculatedTotal: calc.rawCalculatedTotal,
        minimumFareApplied: calc.minimumFareApplied,
        finalTotalAmount: calc.finalTotalAmount,
        estimatedNetProfit: calc.estimatedNetProfit,

        tripPrice: calc.tripPrice,
        scheduleFee: calc.scheduleFee,
        depositPercent: calc.depositPercent,
        depositAmount: calc.depositAmount,
        remainingAmount: calc.remainingAmount,
        paymentProvider: 'pix_manual',

        pixKey: settings.pixKey,
        pixKeyType: settings.pixKeyType,
        pixReceiverName: settings.pixReceiverName,
        pixReceiverCity: settings.pixReceiverCity,

        status: editingRide?.status || 'orcamento_enviado',
        createdAt: editingRide?.createdAt || new Date().toISOString(),
        expiresAt: editingRide?.expiresAt || expiresAt
      };

      await savePrivateRideToFirestore(driverUid, newRide, settings);
      setSavedRide(newRide);
      onSaved(newRide);
    } catch (err: any) {
      console.error("Erro ao salvar corrida:", err);
      setFormError(err?.message || 'Erro ao salvar o agendamento.');
    } finally {
      setIsSaving(false);
    }
  };

  // URL pública do passageiro
  const publicBookingUrl = savedRide ? `${window.location.origin}/r/${savedRide.token}` : '';

  // Mensagem padronizada de WhatsApp (REGRA 6: ZERO menção a Uber/99/plataformas)
  const whatsappMessage = useMemo(() => {
    if (!savedRide) return '';
    return [
      `Olá, *${savedRide.passengerName}*! Segue o link com as informações da sua viagem agendada:`,
      `🚗 *${savedRide.origin}* ➔ *${savedRide.destination}*`,
      `📅 *${formatDateBR(savedRide.scheduledDate)}* às *${savedRide.scheduledTime}*`,
      `💰 *Total:* ${formatCurrency(savedRide.finalTotalAmount)} (Sinal de reserva: ${formatCurrency(savedRide.depositAmount)})`,
      ``,
      `Acesse o link seguro abaixo para conferir os dados e confirmar sua vaga:`,
      `${publicBookingUrl}`,
      ``,
      `*Garante o motorista exclusivamente disponível para o seu horário!*`
    ].join('\n');
  }, [savedRide, publicBookingUrl]);

  const handleCopyLink = () => {
    if (!publicBookingUrl) return;
    navigator.clipboard.writeText(publicBookingUrl);
    setCopiedPixLink(true);
    setTimeout(() => setCopiedPixLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!savedRide) return;
    const cleanPhone = savedRide.passengerPhone.replace(/\D/g, '');
    let targetUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    if (cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      targetUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    }
    window.open(targetUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-[32px] max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 leading-tight">
                {editingRide ? 'Editar Agendamento' : 'Calculadora de Corrida Particular'}
              </h2>
              <p className="text-xs text-slate-400">Preço inteligente com custo por km e lucro líquido</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal de Sucesso após salvar */}
        {savedRide ? (
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-center">
            <div className="size-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Check size={32} />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-800">Orçamento Criado com Sucesso!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Envie o link para <strong>{savedRide.passengerName}</strong> confirmar a vaga mediante o sinal de {formatCurrency(savedRide.depositAmount)}.
              </p>
            </div>

            {/* Link Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-left space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link do Passageiro (sem login)</span>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={publicBookingUrl} 
                  className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono text-slate-700 flex-1 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiedLink ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* WhatsApp CTA */}
            <button
              onClick={handleShareWhatsApp}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Share2 size={18} />
              Enviar pelo WhatsApp
            </button>

            <button
              onClick={() => {
                setSavedRide(null);
                onClose();
              }}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          /* Formulário de Criação */
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-slate-700">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Alerta de Conflito de Horário */}
            {conflictingRide && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle size={16} />
                  <span>Atenção: Conflito de Horário Detectado!</span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  Este horário conflita com a corrida confirmada de <strong>{conflictingRide.passengerName}</strong> no dia {formatDateBR(conflictingRide.scheduledDate)} às {conflictingRide.scheduledTime}. O motorista não estará liberado a tempo.
                </p>
              </div>
            )}

            {/* Dados do Passageiro */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Passageiro e Data</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Nome do Passageiro *</label>
                  <input
                    type="text"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">WhatsApp do Passageiro</label>
                  <input
                    type="text"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    placeholder="(21) 99999-9999"
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Data da Viagem</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Horário de Embarque</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Rota (Origem e Destino) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Trajeto</span>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Local de Embarque (Origem) *</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => { setOrigin(e.target.value); setOriginPlaceId(undefined); }}
                  onFocus={() => { if (originSuggestions.length) setShowOriginSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 150)}
                  autoComplete="off"
                    placeholder="Endereço, bairro ou aeroporto"
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                {showOriginSuggestions && originSuggestions.length > 0 && renderSuggestions('origin', originSuggestions)}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Local de Desembarque (Destino) *</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => { setDestination(e.target.value); setDestinationPlaceId(undefined); }}
                  onFocus={() => { if (destinationSuggestions.length) setShowDestinationSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowDestinationSuggestions(false), 150)}
                  autoComplete="off"
                    placeholder="Endereço de destino"
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                {showDestinationSuggestions && destinationSuggestions.length > 0 && renderSuggestions('destination', destinationSuggestions)}
                </div>
              </div>
            </div>

            {/* Cálculo automático (Google Maps) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseMyCurrentLocation}
                disabled={isCalculatingRoute}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <MapPin className="size-3.5" /> Usar minha localização
              </button>
              {isCalculatingRoute && <span role="status" className="text-[11px] font-semibold text-slate-500">Calculando rota...</span>}
              {!isCalculatingRoute && mapsApiError && <span role="alert" className="text-[11px] font-semibold text-amber-700">{mapsApiError}</span>}
              {!isCalculatingRoute && !mapsApiError && (!originPlaceId || !destinationPlaceId) && (
                <span className="text-[10px] text-slate-400">Escolha os endereços na lista para calcular km e tempo automaticamente.</span>
              )}
            </div>

            {/* Distâncias e Tempos (Km e Minutos) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Distâncias e Tempos Estimados</span>

              {/* 1. Deslocamento */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">1. Deslocamento até o Passageiro{mapsFilled.displacement && mapsBadge}</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Km de Ida</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={displacementKm}
                      onChange={(e) => { setDisplacementKm(Number(e.target.value)); setMapsFilled(p => ({ ...p, displacement: false })); }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tempo de Ida (min)</label>
                    <input
                      type="number"
                      min={0}
                      value={displacementMinutes}
                      onChange={(e) => { setDisplacementMinutes(Number(e.target.value)); setMapsFilled(p => ({ ...p, displacement: false })); }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Viagem */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">2. Viagem com o Passageiro{mapsFilled.trip && mapsBadge}</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Km da Viagem</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={tripKm}
                      onChange={(e) => { handleTripKmChange(Number(e.target.value)); setMapsFilled(p => ({ ...p, trip: false })); }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tempo de Viagem (min)</label>
                    <input
                      type="number"
                      min={1}
                      value={tripMinutes}
                      onChange={(e) => { handleTripMinutesChange(Number(e.target.value)); setMapsFilled(p => ({ ...p, trip: false })); }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Retorno Vazio */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">3. Retorno Vazio?{returnEmpty && mapsFilled.ret && mapsBadge}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={returnEmpty}
                      onChange={(e) => setReturnEmpty(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700">{returnEmpty ? 'Sim (cobrar volta)' : 'Não (ligo app lá)'}</span>
                  </label>
                </div>

                {returnEmpty && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Km de Volta</label>
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        value={returnKm}
                        onChange={(e) => { setReturnKm(Number(e.target.value)); setMapsFilled(p => ({ ...p, ret: false })); }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tempo de Volta (min)</label>
                      <input
                        type="number"
                        min={0}
                        value={returnMinutes}
                        onChange={(e) => { setReturnMinutes(Number(e.target.value)); setMapsFilled(p => ({ ...p, ret: false })); }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custos e Lucro/Hora */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Parâmetros Financeiros</span>

              <div className="grid grid-cols-2 gap-3">
                {/* Custo / KM */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Custo Real / Km</span>
                    <button
                      type="button"
                      onClick={() => setIsManualCost(!isManualCost)}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      {isManualCost ? 'Auto' : 'Alterar'}
                    </button>
                  </div>

                  {isManualCost ? (
                    <input
                      type="number"
                      step={0.01}
                      min={0.1}
                      value={manualCostPerKm}
                      onChange={(e) => setManualCostPerKm(e.target.value)}
                      placeholder={autoCostData.totalCostPerKm.toFixed(2)}
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 text-xs font-bold focus:outline-none"
                    />
                  ) : (
                    <div>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(autoCostData.totalCostPerKm)}/km</p>
                      <p className="text-[9px] text-slate-400">Combustível + Manutenção + Fixo</p>
                    </div>
                  )}
                </div>

                {/* Lucro Líquido / Hora */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Lucro Líq. / Hora</span>
                    <button
                      type="button"
                      onClick={() => setIsManualHourlyRate(!isManualHourlyRate)}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      {isManualHourlyRate ? 'Auto' : 'Alterar'}
                    </button>
                  </div>

                  {isManualHourlyRate ? (
                    <input
                      type="number"
                      step={1}
                      min={10}
                      value={manualHourlyRate}
                      onChange={(e) => setManualHourlyRate(e.target.value)}
                      placeholder={autoHourlyData.hourlyRate.toFixed(2)}
                      className="w-full p-2 bg-white rounded-xl border border-slate-300 text-xs font-bold focus:outline-none"
                    />
                  ) : (
                    <div>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(autoHourlyData.hourlyRate)}/h</p>
                      <p className="text-[9px] text-slate-400">
                        {autoHourlyData.source === 'history' ? `Média histórica do dia` : `Meta configurada`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Extras */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Extras (Opcional)</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pedágio (R$)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={toll || ''}
                    onChange={(e) => setToll(Number(e.target.value))}
                    placeholder="0,00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Estacionamento</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={parking || ''}
                    onChange={(e) => setParking(Number(e.target.value))}
                    placeholder="0,00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Outros (R$)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={otherExtra || ''}
                    onChange={(e) => setOtherExtra(Number(e.target.value))}
                    placeholder="0,00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Observações Internas (Opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bagagens, paradas intermediárias, etc."
                rows={2}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* LIVE BREAKDOWN CARD (Visão interna do motorista) */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-black uppercase tracking-wider text-blue-300">
                  Detalhamento do Cálculo
                </span>
                <span className="text-[11px] text-slate-300">
                  {calc.totalKm} km • {Math.floor(calc.totalCommittedMinutes / 60)}h {calc.totalCommittedMinutes % 60}m
                </span>
              </div>

              {/* Lembrete de ficar offline */}
              <div className="p-3 bg-amber-500/20 border border-amber-400/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <Clock size={16} />
                  <span>Horário para Ficar Offline:</span>
                </div>
                <span className="text-base font-black text-amber-200">
                  {calc.offlineTime}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 -mt-2 italic px-1">
                * Considera {displacementMinutes} min de deslocamento + {settings.bookingBufferMinutes || 15} min de folga prévia.
              </p>

              {/* Linhas de Custo */}
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Km rodados ({calc.totalKm} km × {formatCurrency(effectiveCostPerKm)}):</span>
                  <span className="font-semibold text-white">{formatCurrency(calc.kmCostTotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Tempo comprometido ({calc.totalCommittedMinutes} min × {formatCurrency(effectiveHourlyRate)}/h):</span>
                  <span className="font-semibold text-white">{formatCurrency(calc.opportunityCostTotal)}</span>
                </div>

                {calc.totalExtras > 0 && (
                  <div className="flex justify-between">
                    <span>Extras (pedágio/estacionamento):</span>
                    <span className="font-semibold text-white">{formatCurrency(calc.totalExtras)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-sm font-black text-white">
                  <span>Total (arredondado múltiplo de R$ 5):</span>
                  <span className="text-xl text-blue-400">{formatCurrency(calc.finalTotalAmount)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                  <div className="p-2.5 bg-white/10 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">Sinal ({calc.depositPercent}%)</span>
                    <span className="text-xs font-black text-blue-300">{formatCurrency(calc.depositAmount)}</span>
                  </div>
                  <div className="p-2.5 bg-white/10 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">Restante ao final</span>
                    <span className="text-xs font-black text-slate-200">{formatCurrency(calc.remainingAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Lucro Líquido Estimado */}
              <div className="p-3.5 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider block">
                    Lucro Líquido do Motorista
                  </span>
                  <span className="text-[10px] text-slate-300">Livre de combustível e custos do carro</span>
                </div>
                <span className="text-xl font-black text-emerald-400">
                  {formatCurrency(calc.estimatedNetProfit)}
                </span>
              </div>
            </div>

            {/* Botão de Salvar & Gerar Link */}
            <button
              onClick={handleSaveAndGenerateLink}
              disabled={isSaving}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 transition-all cursor-pointer"
            >
              {isSaving ? (
                'Gerando Orçamento...'
              ) : (
                <>
                  <Sparkles size={18} />
                  Salvar Agendamento & Gerar Link
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

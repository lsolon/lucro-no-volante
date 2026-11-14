import { doc, setDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  PrivateRide, 
  PrivateRidesSettings, 
  PublicBookingData, 
  Entry, 
  FixedCost, 
  Category 
} from '../types';
import { formatPixKeyForPayload, generatePixPayload } from '../lib/pix';

/**
 * Gera um token aleatório não adivinhável de 16 caracteres alfanuméricos
 */
export function generateBookingToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let token = '';
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < 16; i++) {
      token += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 16; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return token;
}

/**
 * Subtrai minutos de um horário "HH:mm" retornando "HH:mm"
 */
export function subtractMinutesFromHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const total = h * 60 + m - minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const newH = Math.floor(wrapped / 60).toString().padStart(2, '0');
  const newM = (wrapped % 60).toString().padStart(2, '0');
  return `${newH}:${newM}`;
}

/**
 * Adiciona minutos a uma data e horário
 */
export function addMinutesToDateTime(dateStr: string, timeStr: string, minutes: number): Date {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Calcula a média de custo por km real do motorista:
 * (combustível + manutenção + depreciação + custos fixos rateados)
 */
export function calculateDriverRealCostPerKm(
  entries: Entry[],
  fixedCosts: FixedCost[],
  targetKm: number = 2500,
  recentCycleCostPerKm?: number
): {
  totalCostPerKm: number;
  breakdown: {
    fuelKm: number;
    maintenanceKm: number;
    depreciationKm: number;
    fixedCostsKm: number;
  };
} {
  // 1. Combustível
  let fuelKm = 0.55; // Padrão realista
  if (recentCycleCostPerKm && recentCycleCostPerKm > 0) {
    fuelKm = recentCycleCostPerKm;
  } else {
    const fuelEntries = entries.filter(e => e.tipo === 'Despesa' && (e.combustivel || e.categoriaId === '1'));
    const totalFuelSpent = fuelEntries.reduce((sum, e) => sum + e.valor, 0);
    const kms = entries.filter(e => e.km && e.km > 0).map(e => e.km as number);
    const kmTotal = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
    if (totalFuelSpent > 0 && kmTotal > 100) {
      fuelKm = Math.min(2.5, Math.max(0.2, totalFuelSpent / kmTotal));
    }
  }

  // 2. Custos Fixos Rateados
  const activeFixedCosts = (fixedCosts || []).reduce((acc, fc) => acc + fc.valorMensal, 0);
  const baseMonthlyKm = targetKm > 500 ? targetKm : 2500;
  const fixedCostsKm = activeFixedCosts > 0 ? (activeFixedCosts / baseMonthlyKm) : 0.20;

  // 3. Manutenção preventiva rateada
  const maintenanceEntries = entries.filter(e => e.tipo === 'Despesa' && (e.categoriaId === '3' || e.categoriaId === '7' || e.categoriaId?.startsWith('3_')));
  const totalMaint = maintenanceEntries.reduce((acc, e) => acc + e.valor, 0);
  let maintenanceKm = 0.15; // Estimativa padrão realista (óleo, pneus, freios, filtros)
  if (totalMaint > 0) {
    const kms = entries.filter(e => e.km && e.km > 0).map(e => e.km as number);
    const kmTotal = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
    if (kmTotal > 500) {
      maintenanceKm = Math.max(0.08, Math.min(0.40, totalMaint / kmTotal));
    }
  }

  // 4. Depreciação do veículo estimada
  const depreciationKm = 0.12;

  const totalCostPerKm = Math.round((fuelKm + fixedCostsKm + maintenanceKm + depreciationKm) * 100) / 100;

  return {
    totalCostPerKm,
    breakdown: {
      fuelKm: Math.round(fuelKm * 100) / 100,
      maintenanceKm: Math.round(maintenanceKm * 100) / 100,
      depreciationKm,
      fixedCostsKm: Math.round(fixedCostsKm * 100) / 100
    }
  };
}

/**
 * Calcula o lucro líquido médio por hora do motorista com base no histórico real:
 * Busca entradas de ganhos com horas trabalhadas e despesas diárias associadas.
 */
export function calculateDriverNetHourlyProfit(
  entries: Entry[],
  scheduledDate: string,
  defaultHourlyRate: number = 30
): {
  hourlyRate: number;
  source: 'history' | 'default';
  samplesCount: number;
} {
  try {
    const dateObj = new Date(scheduledDate + 'T12:00:00');
    const targetDayOfWeek = dateObj.getDay(); // 0 a 6

    // Filtra dias de trabalho com registro de tempo de trabalho
    const dayMap = new Map<string, { earnings: number; expenses: number; minutes: number; dayOfWeek: number }>();

    entries.forEach(e => {
      const dateKey = e.data.replace(/\//g, '-');
      const cur = dayMap.get(dateKey) || { earnings: 0, expenses: 0, minutes: 0, dayOfWeek: new Date(dateKey + 'T12:00:00').getDay() };
      
      if (e.tipo === 'Ganhos') {
        cur.earnings += e.valor;
        if (e.tempoTrabalhoMinutos && e.tempoTrabalhoMinutos > 0) {
          cur.minutes = Math.max(cur.minutes, e.tempoTrabalhoMinutos);
        }
      } else {
        cur.expenses += e.valor;
      }
      dayMap.set(dateKey, cur);
    });

    // Filtra dias com mais de 60 minutos trabalhados
    const daysWithHours = Array.from(dayMap.values()).filter(d => d.minutes >= 60 && d.earnings > 0);
    
    // Tenta primeiro o mesmo dia da semana
    const sameDayOfWeekDays = daysWithHours.filter(d => d.dayOfWeek === targetDayOfWeek);
    
    const candidateDays = sameDayOfWeekDays.length >= 2 ? sameDayOfWeekDays : daysWithHours;

    if (candidateDays.length > 0) {
      let totalNet = 0;
      let totalHours = 0;
      candidateDays.forEach(d => {
        const net = Math.max(0, d.earnings - d.expenses);
        const hours = d.minutes / 60;
        totalNet += net;
        totalHours += hours;
      });

      if (totalHours >= 2) {
        const rate = totalNet / totalHours;
        if (rate >= 15 && rate <= 150) {
          return {
            hourlyRate: Math.round(rate * 100) / 100,
            source: 'history',
            samplesCount: candidateDays.length
          };
        }
      }
    }
  } catch (err) {
    console.warn("Erro ao calcular lucro por hora histórico:", err);
  }

  return {
    hourlyRate: defaultHourlyRate || 30,
    source: 'default',
    samplesCount: 0
  };
}

/**
 * Calculadora Principal de Preço de Corrida Particular
 */
export function calculatePrivateRide(params: {
  displacementKm: number;
  displacementMinutes: number;
  tripKm: number;
  tripMinutes: number;
  returnEmpty: boolean;
  returnKm: number;
  returnMinutes: number;
  bufferMinutes: number;
  scheduledTime: string;
  costPerKm: number;
  hourlyRate: number;
  extras: { toll: number; parking: number; other: number };
  minimumFare: number;
  depositPercent: number;
}) {
  const {
    displacementKm,
    displacementMinutes,
    tripKm,
    tripMinutes,
    returnEmpty,
    returnKm,
    returnMinutes,
    bufferMinutes,
    scheduledTime,
    costPerKm,
    hourlyRate,
    extras,
    minimumFare = 25,
    depositPercent = 50
  } = params;

  // 1. Quilometragem total
  const totalKm = Math.round((displacementKm + tripKm + (returnEmpty ? returnKm : 0)) * 10) / 10;

  // 2. Tempo comprometido (minutos)
  const reservationMinutes = displacementMinutes + bufferMinutes;
  const returnCommittedMinutes = returnEmpty ? returnMinutes : 0;
  const totalCommittedMinutes = reservationMinutes + tripMinutes + returnCommittedMinutes;

  // 3. Horário para ficar offline
  const offlineTime = subtractMinutesFromHHMM(scheduledTime, reservationMinutes);

  // 4. Custos
  const kmCostTotal = Math.round(totalKm * costPerKm * 100) / 100;
  const opportunityCostTotal = Math.round((totalCommittedMinutes / 60) * hourlyRate * 100) / 100;
  const totalExtras = Math.round((extras.toll + extras.parking + extras.other) * 100) / 100;

  // 5. Total Bruto Calculado
  const rawCalculatedTotal = kmCostTotal + opportunityCostTotal + totalExtras;

  // 6. Tarifa Mínima e Arredondamento para múltiplos de R$ 5 para cima
  const withMinFare = Math.max(rawCalculatedTotal, minimumFare);
  const finalTotalAmount = Math.ceil(withMinFare / 5) * 5;
  const minimumFareApplied = rawCalculatedTotal < minimumFare;

  // 7. Lucro Líquido Estimado que sobra para o motorista
  // (Total menos custos de combustível/carro e menos despesas pagas a terceiros como pedágio/estacionamento)
  const estimatedNetProfit = Math.max(0, Math.round((finalTotalAmount - kmCostTotal - extras.toll - extras.parking) * 100) / 100);

  // 8. Divisão amigável para o passageiro (REGRA 6)
  // Sem menções a Uber/99/offline: "Valor da viagem" e "Reserva de horário"
  const reservationPortionRatio = totalCommittedMinutes > 0 ? (reservationMinutes / totalCommittedMinutes) : 0.3;
  let scheduleFee = Math.round((opportunityCostTotal * reservationPortionRatio) / 5) * 5;
  if (scheduleFee < 10 && finalTotalAmount >= 30) scheduleFee = 10;
  if (scheduleFee > finalTotalAmount * 0.4) scheduleFee = Math.round((finalTotalAmount * 0.3) / 5) * 5;
  
  const tripPrice = Math.max(0, finalTotalAmount - scheduleFee);

  // 9. Sinal e Restante
  const safeDepositPercent = Math.min(100, Math.max(10, depositPercent || 50));
  const depositAmount = Math.round(finalTotalAmount * (safeDepositPercent / 100));
  const remainingAmount = finalTotalAmount - depositAmount;

  return {
    totalKm,
    reservationMinutes,
    totalCommittedMinutes,
    offlineTime,
    kmCostTotal,
    opportunityCostTotal,
    totalExtras,
    rawCalculatedTotal,
    minimumFareApplied,
    finalTotalAmount,
    estimatedNetProfit,
    tripPrice,
    scheduleFee,
    depositAmount,
    remainingAmount,
    depositPercent: safeDepositPercent
  };
}

/**
 * Valida conflitos de agendamento considerando todo o tempo comprometido:
 * [Horário Marcado - Reserva] até [Horário Marcado + Viagem + Retorno]
 */
export function checkRideConflict(
  candidate: {
    scheduledDate: string;
    scheduledTime: string;
    displacementMinutes: number;
    bufferMinutes: number;
    tripMinutes: number;
    returnEmpty: boolean;
    returnMinutes: number;
    excludeRideId?: string;
  },
  existingRides: PrivateRide[]
): PrivateRide | null {
  const reservationMinutes = candidate.displacementMinutes + candidate.bufferMinutes;
  const tripTotalMinutes = candidate.tripMinutes + (candidate.returnEmpty ? candidate.returnMinutes : 0);

  const candidateStart = addMinutesToDateTime(candidate.scheduledDate, candidate.scheduledTime, -reservationMinutes).getTime();
  const candidateEnd = addMinutesToDateTime(candidate.scheduledDate, candidate.scheduledTime, tripTotalMinutes).getTime();

  for (const ride of existingRides) {
    if (candidate.excludeRideId && ride.id === candidate.excludeRideId) continue;
    if (ride.status !== 'confirmada' && ride.status !== 'em_andamento') continue;

    const rideResMinutes = ride.displacementMinutes + ride.bufferMinutes;
    const rideTripMinutes = ride.tripMinutes + (ride.returnEmpty ? ride.returnMinutes : 0);

    const rideStart = addMinutesToDateTime(ride.scheduledDate, ride.scheduledTime, -rideResMinutes).getTime();
    const rideEnd = addMinutesToDateTime(ride.scheduledDate, ride.scheduledTime, rideTripMinutes).getTime();

    // Sobreposição: Max(StartA, StartB) < Min(EndA, EndB)
    if (Math.max(candidateStart, rideStart) < Math.min(candidateEnd, rideEnd)) {
      return ride;
    }
  }

  return null;
}

/**
 * Monta o texto padronizado das Regras de Cancelamento para a página do passageiro (REGRA 6)
 */
export function getPassengerCancellationTerms(depositAmount: number, refundHours: number = 24): string {
  return [
    `• Cancelamento com mais de ${refundHours} horas de antecedência do horário agendado: devolução integral do sinal de R$ ${depositAmount.toFixed(2).replace('.', ',')}.`,
    `• Cancelamento com menos de ${refundHours} horas de antecedência: o valor do sinal é retido para cobrir a reserva exclusiva da data e horário do veículo.`,
    `• Em caso de cancelamento pelo motorista ou não comparecimento: devolução integral imediata do valor do sinal.`
  ].join('\n');
}

/**
 * Salva a corrida no documento do motorista e sincroniza os dados públicos em public_bookings/{token}
 */
export function buildPublicBookingData(ride: PrivateRide, settings: PrivateRidesSettings): PublicBookingData {
  const pixKeyClean = formatPixKeyForPayload(ride.pixKey || settings.pixKey, (ride.pixKeyType || settings.pixKeyType) as any);
  
  return {
    token: ride.token,
    bookingId: ride.id,
    driverUid: ride.driverUid,
    driverName: ride.driverName || 'Motorista Particular',
    driverCar: ride.driverCar,
    passengerName: ride.passengerName,
    passengerPhone: ride.passengerPhone,
    origin: ride.origin,
    destination: ride.destination,
    scheduledDate: ride.scheduledDate,
    scheduledTime: ride.scheduledTime,
    notes: ride.notes,

    tripPrice: ride.tripPrice,
    scheduleFee: ride.scheduleFee,
    totalAmount: ride.finalTotalAmount,
    depositAmount: ride.depositAmount,
    remainingAmount: ride.remainingAmount,
    depositPercent: ride.depositPercent,

    cancellationTermsText: getPassengerCancellationTerms(ride.depositAmount, settings.cancellationRefundHours || 24),

    pixKey: pixKeyClean,
    pixKeyType: ride.pixKeyType || settings.pixKeyType,
    pixReceiverName: ride.pixReceiverName || settings.pixReceiverName,
    pixReceiverCity: ride.pixReceiverCity || settings.pixReceiverCity || 'BRASIL',

    status: ride.status,
    createdAt: ride.createdAt,
    expiresAt: ride.expiresAt,

    acceptedTerms: ride.acceptedTerms,
    acceptedTermsAt: ride.acceptedTermsAt,
    depositPaidReported: ride.depositPaidReported,
    depositPaidAt: ride.depositPaidAt,
    depositConfirmedAt: ride.depositConfirmedAt,

    cancellationRequested: ride.cancelledBy === 'passenger' || !!ride.cancellationReason,
    cancellationRequestedAt: ride.cancelledAt,
    cancellationReason: ride.cancellationReason,
    refundEligible: ride.refundEligible,
    refundAmount: ride.refundAmount,

    updatedAt: new Date().toISOString()
  };
}

/**
 * Salva/Atualiza corrida no Firestore
 */
export async function savePrivateRideToFirestore(
  driverUid: string,
  ride: PrivateRide,
  settings: PrivateRidesSettings
): Promise<void> {
  const rideRef = doc(db, 'users', driverUid, 'privateRides', ride.id);
  await setDoc(rideRef, ride, { merge: true });

  const publicData = buildPublicBookingData(ride, settings);
  const publicRef = doc(db, 'public_bookings', ride.token);
  await setDoc(publicRef, publicData, { merge: true });
}

/**
 * Exclui corrida do Firestore
 */
export async function deletePrivateRideFromFirestore(
  driverUid: string,
  rideId: string,
  token: string
): Promise<void> {
  const rideRef = doc(db, 'users', driverUid, 'privateRides', rideId);
  await deleteDoc(rideRef);

  if (token) {
    const publicRef = doc(db, 'public_bookings', token);
    await deleteDoc(publicRef).catch(e => console.warn("Erro ao deletar public_booking:", e));
  }
}

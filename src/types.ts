export type EntryType = 'Ganhos' | 'Despesa';

export interface Category {
  id: string;
  nome: string;
  parentId?: string;
}

export interface FixedCost {
  id: string;
  item: string;
  valorMensal: number;
  diaVencimento: number;
  dataInicio?: string; // YYYY-MM
  dataFim?: string; // YYYY-MM
}

export interface PlatformEarningDetail {
  corridas?: number;
  tempoTrabalho?: string; // e.g. "06:30" ou "6h 30m"
  tempoMinutos?: number; // minutos totais trabalhados
  kmRodado?: number; // km rodados na plataforma
}

export interface Entry {
  id: string;
  data: string; // YYYY/MM/DD
  createdAt: string; // YYYY/MM/DD HH:mm:ss
  tipo: EntryType;
  categoriaId: string;
  valor: number;
  km?: number;
  kmRodado?: number;
  posto?: string;
  bandeiraPosto?: string;
  combustivel?: string;
  combustivelPrincipal?: string;
  quantidade?: number;
  valorUnitario?: number;
  tanqueVazio?: boolean;
  location?: { lat: number; lng: number; address?: string };
  gps?: string; // "lat, lng"
  endereco?: string;
  photoUrl?: string;
  qrCodeData?: string;
  linkNota?: string;
  obs?: string;
  referenciaMes?: string; // YYYY-MM
  ganhos?: Record<string, number>; // Dynamic earnings by category ID
  ganhosDetalhes?: Record<string, PlatformEarningDetail>; // Detalhes por plataforma (corridas, tempo, km)
  totalCorridas?: number;
  tempoTrabalho?: string;
  tempoTrabalhoMinutos?: number;
  reembolsos?: Record<string, number>; // Dynamic refunds by category ID
  ratings?: {
    servico: number;
    higiene: number;
    atendimento: number;
  };
  manutencaoItem?: string;
  garantiaKm?: number;
  garantiaMeses?: number;
}

export interface AppSheetMapping {
  data: string;
  tipo: string;
  valor: string;
  categoria: string;
  km: string;
  obs: string;
  posto: string;
  combustivel: string;
  quantidade: string;
  valorUnitario: string;
}

export interface MaintenanceInterval {
  id: string;
  item: string;
  intervaloKm: number;
}

export interface GlobalStats {
  totalVisits: number;
  uniqueVisitors: number;
  lastUpdate: string;
}

export interface AppConfig {
  publishedVersion: string;
  betaVersion: string;
  maintenanceMode: boolean;
  announcement?: string;
}

export interface BacklogItem {
  id: string;
  text: string;
  createdAt: string;
  status: 'pending' | 'completed';
}

export interface AICampaign {
  id: string;
  title: string;
  messages: { role: 'user' | 'model'; text: string; image?: string; video?: string; }[];
  createdAt: string;
}

export type PrivateRideStatus = 
  | 'orcamento_enviado'
  | 'aguardando_sinal'
  | 'confirmada'
  | 'em_andamento'
  | 'concluida'
  | 'expirada'
  | 'cancelada';

export interface PrivateRidesSettings {
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  pixKey: string;
  pixReceiverName: string;
  pixReceiverCity?: string;
  depositPercent: number; // default 50
  budgetValidityHours: number; // default 2
  bookingBufferMinutes: number; // default 15
  minimumFare: number; // default 25
  defaultHourlyRate: number; // default 30
  cancellationRefundHours: number; // default 24
  whatsappMessageTemplate?: string;
  carModel?: string;
  carColor?: string;
  carPlate?: string;
}

export interface PrivateRide {
  id: string;
  token: string; // Token público aleatório e não adivinhável para /r/{token}
  driverUid: string;
  driverName: string;
  driverPhone?: string;
  driverCar?: {
    model: string;
    color: string;
    plate: string;
  };
  passengerName: string;
  passengerPhone: string;
  origin: string;
  originPlaceId?: string;
  destination: string;
  destinationPlaceId?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  notes?: string;

  // Distâncias e Tempos
  displacementKm: number; // Deslocamento até o cliente
  displacementMinutes: number; // Tempo até o cliente
  tripKm: number; // Viagem
  tripMinutes: number; // Tempo da viagem
  returnEmpty: boolean; // Volto vazio? (default true)
  returnKm: number; // Km de retorno
  returnMinutes: number; // Tempo de retorno
  totalKm: number;
  totalCommittedMinutes: number; // Reserva (deslocamento + folga) + viagem + retorno (se vazio)
  bufferMinutes: number; // Folga (padrão 15 min)
  offlineTime: string; // Horário para ficar offline (HH:mm)

  // Custos e Detalhamento (Apenas visão do motorista)
  costPerKm: number;
  costPerKmSource: 'auto' | 'manual';
  hourlyRate: number;
  hourlyRateSource: 'history' | 'default' | 'manual';
  kmCostTotal: number;
  opportunityCostTotal: number;
  extras: {
    toll: number;
    parking: number;
    other: number;
  };
  totalExtras: number;
  rawCalculatedTotal: number;
  minimumFareApplied: boolean;
  finalTotalAmount: number; // Arredondado para múltiplos de R$ 5
  estimatedNetProfit: number; // Lucro líquido do motorista

  // Campos visíveis ao passageiro (REGRA 6)
  tripPrice: number; // Valor da viagem
  scheduleFee: number; // Taxa de reserva de horário ("Garante o motorista exclusivamente disponível para o seu horário")
  depositPercent: number; // Padrão 50%
  depositAmount: number;
  remainingAmount: number;
  paymentProvider: 'pix_manual';

  // Chave Pix para o passageiro
  pixKey: string;
  pixKeyType: string;
  pixReceiverName: string;
  pixReceiverCity?: string;

  // Status e Timestamps
  status: PrivateRideStatus;
  createdAt: string;
  expiresAt: string; // ISO
  acceptedTerms?: boolean;
  acceptedTermsAt?: string;
  depositPaidReported?: boolean;
  depositPaidAt?: string;
  depositConfirmedAt?: string;
  tripStartedAt?: string;
  tripFinishedAt?: string;
  finalPaymentConfirmedAt?: string;

  // Cancelamento
  cancelledAt?: string;
  cancelledBy?: 'passenger' | 'driver';
  cancellationReason?: string;
  refundEligible?: boolean;
  refundAmount?: number;
  refundDone?: boolean;
  refundDoneAt?: string;

  // Integração financeira
  financialEntryId?: string;
  retainedDepositEntryId?: string;
}

export interface PublicBookingData {
  token: string;
  bookingId: string;
  driverUid: string;
  driverName: string;
  driverCar?: {
    model: string;
    color: string;
    plate: string;
  };
  passengerName: string;
  passengerPhone: string;
  origin: string;
  destination: string;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;

  tripPrice: number;
  scheduleFee: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  depositPercent: number;

  cancellationTermsText: string;

  pixKey: string;
  pixKeyType: string;
  pixReceiverName: string;
  pixReceiverCity?: string;

  status: PrivateRideStatus;
  createdAt: string;
  expiresAt: string;

  acceptedTerms?: boolean;
  acceptedTermsAt?: string;
  depositPaidReported?: boolean;
  depositPaidAt?: string;
  depositConfirmedAt?: string;

  cancellationRequested?: boolean;
  cancellationRequestedAt?: string;
  cancellationReason?: string;
  refundEligible?: boolean;
  refundAmount?: number;

  updatedAt?: string;
}

export interface AppState {
  entries: Entry[];
  fixedCosts: FixedCost[];
  categories: Category[];
  earningCategories: Category[];
  refundCategories: Category[];
  currentKm: number;
  targetKm: number;
  workDaysPerMonth?: number;
  combustivelPrincipal?: string;
  maintenanceIntervals: MaintenanceInterval[];
  trialStartDate?: string;
  appSheetMapping?: AppSheetMapping;
  hasSeenTutorial?: boolean;
  tutorialOptOut?: boolean;
  role?: 'admin' | 'user';
  email?: string;
  displayName?: string;
  visitCount?: number;
  hasContributed?: boolean;
  lastSeen?: string;
  appConfig?: AppConfig;
  isConfigLoaded?: boolean;
  privateRides?: PrivateRide[];
  privateRidesSettings?: PrivateRidesSettings;
}


import { format, subDays, addDays } from 'date-fns';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_EARNING_CATEGORIES,
  DEFAULT_REFUND_CATEGORIES,
} from '../constants';
import { Entry, FixedCost, MaintenanceInterval } from '../types';
import { formatMinutesToDisplay } from './utils';

/**
 * MODO DEMONSTRAÇÃO
 *
 * Gera um usuário genérico ("Carlos Motorista") com ~90 dias de lançamentos
 * fictícios, sempre relativos à data de hoje (o painel do mês atual nunca
 * fica vazio). Tudo roda apenas em memória: nada é lido nem gravado no Firebase.
 *
 * Os dados são determinísticos (mesmo gerador pseudoaleatório com semente fixa),
 * então cada vez que a demonstração é aberta os números são idênticos —
 * ótimo para regravar trechos do vídeo.
 */

export const DEMO_USER = {
  uid: 'demo-user',
  email: 'demo@lucronovolante.app.br',
  displayName: 'Carlos Motorista',
  photoURL: null,
  providerData: [],
} as any;

const DEMO_DAYS = 90;

// Gerador pseudoaleatório determinístico (mulberry32)
function createRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const DEMO_FIXED_COSTS: FixedCost[] = [
  { id: 'demo-fc-1', item: 'Financiamento', valorMensal: 1150, diaVencimento: 10 },
  { id: 'demo-fc-2', item: 'Seguro Uber', valorMensal: 260, diaVencimento: 15 },
  { id: 'demo-fc-3', item: 'Impostos', valorMensal: 180, diaVencimento: 20 },
  { id: 'demo-fc-4', item: 'Plano de celular', valorMensal: 70, diaVencimento: 25 },
];

export const DEMO_MAINTENANCE_INTERVALS: MaintenanceInterval[] = [
  { id: 'oil', item: 'Troca de Óleo', intervaloKm: 10000 },
  { id: 'demo-mi-pastilhas', item: 'Troca de pastilhas de freio', intervaloKm: 30000 },
  { id: 'demo-mi-pneus', item: 'Troca de Pneus', intervaloKm: 50000 },
  { id: 'demo-mi-filtro-ar', item: 'Troca de Filtro de Ar', intervaloKm: 15000 },
];

export interface DemoState {
  entries: Entry[];
  fixedCosts: FixedCost[];
  categories: typeof DEFAULT_CATEGORIES;
  earningCategories: typeof DEFAULT_EARNING_CATEGORIES;
  refundCategories: typeof DEFAULT_REFUND_CATEGORIES;
  currentKm: number;
  targetKm: number;
  workDaysPerMonth: number;
  combustivelPrincipal: string;
  maintenanceIntervals: MaintenanceInterval[];
  trialStartDate: string;
  hasSeenTutorial: boolean;
  tutorialOptOut: boolean;
}

export function buildDemoState(): DemoState {
  const rng = createRng(20261114);
  const between = (min: number, max: number) => min + rng() * (max - min);
  const pick = <T,>(list: T[]): T => list[Math.floor(rng() * list.length)];

  const today = new Date();
  const entries: Entry[] = [];
  let idCounter = 0;
  const nextId = () => `demo-${++idCounter}`;

  // ---- 1) Planeja os dias trabalhados e a quilometragem diária ----
  type DayPlan = { date: Date; km: number; worked: boolean };
  const plan: DayPlan[] = [];
  for (let i = DEMO_DAYS - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dow = date.getDay(); // 0 = domingo
    const isToday = i === 0;
    const workProb = dow === 0 ? 0.35 : dow === 6 ? 0.9 : 0.93;
    const worked = isToday || rng() < workProb;
    plan.push({ date, km: worked ? Math.round(between(105, 185)) : 0, worked });
  }

  const totalKm = plan.reduce((acc, d) => acc + d.km, 0);
  const finalOdometer = 48250;
  let odometer = finalOdometer - totalKm;

  // ---- 2) Lançamentos diários ----
  const FUEL_EFFICIENCY = 11.4; // km/L (média do carro fictício)
  const TANK_TRIGGER_KM = 330; // abastece a cada ~330 km rodados
  let kmSinceFuel = 0;
  let isFirstFuel = true;
  const oilChangeOdometer = finalOdometer - 9300; // vence daqui ~700 km (alerta na tela de Revisão)
  let oilDone = false;
  let airFilterDone = false;
  let pastilhasDone = false;
  let pneusDone = false;

  const stamp = (d: Date, hh: number, mm: number) =>
    `${format(d, 'yyyy/MM/dd')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;

  plan.forEach((day, idx) => {
    const dateStr = format(day.date, 'yyyy/MM/dd');
    const dow = day.date.getDay();
    const isToday = idx === plan.length - 1;

    if (!day.worked) {
      return;
    }

    odometer += day.km;
    kmSinceFuel += day.km;

    // --- Fechamento do dia (ganhos por plataforma) ---
    const weekendBoost = dow === 5 || dow === 6 ? 1.15 : 1;
    const dailyTotal = round2(between(255, 395) * weekendBoost * (isToday ? 0.62 : 1));
    const onlyOne = rng() < 0.12;
    const uberShare = onlyOne ? (rng() < 0.5 ? 1 : 0) : between(0.5, 0.68);
    const uberValor = round2(dailyTotal * uberShare);
    const noveValor = round2(dailyTotal - uberValor);

    const ganhos: Record<string, number> = {};
    const ganhosDetalhes: Record<string, { corridas: number; tempoMinutos: number; kmRodado: number }> = {};
    let totalCorridas = 0;
    let totalMinutos = 0;

    const addPlatform = (id: string, valor: number, share: number) => {
      if (valor <= 0) return;
      const corridas = Math.max(2, Math.round(valor / between(14, 19)));
      const tempoMinutos = Math.round(day.km * share * between(2.3, 2.9) + corridas * 1.5);
      ganhos[id] = valor;
      ganhosDetalhes[id] = {
        corridas,
        tempoMinutos,
        kmRodado: Math.round(day.km * share),
      };
      totalCorridas += corridas;
      totalMinutos += tempoMinutos;
    };

    const uberKmShare = uberValor > 0 && noveValor > 0 ? uberValor / (uberValor + noveValor) : uberValor > 0 ? 1 : 0;
    addPlatform('uber', uberValor, uberKmShare);
    addPlatform('99', noveValor, 1 - uberKmShare);

    entries.push({
      id: nextId(),
      data: dateStr,
      createdAt: stamp(day.date, 22, 10 + Math.floor(between(0, 40))),
      tipo: 'Ganhos',
      categoriaId: '10',
      valor: round2(uberValor + noveValor),
      km: odometer,
      kmRodado: day.km,
      ganhos,
      ganhosDetalhes,
      totalCorridas,
      tempoTrabalhoMinutos: totalMinutos,
      tempoTrabalho: formatMinutesToDisplay(totalMinutos),
      ...(rng() < 0.18 && !isToday
        ? { reembolsos: { ref_pedagio: round2(between(6, 14)) } }
        : {}),
    } as Entry);

    // --- Abastecimento (ciclo cheio a cheio para o cálculo de consumo) ---
    if (!isToday && (kmSinceFuel >= TANK_TRIGGER_KM || (isFirstFuel && idx > 1))) {
      const liters = isFirstFuel
        ? round2(between(30, 38))
        : round2((kmSinceFuel / FUEL_EFFICIENCY) * between(0.97, 1.03));
      const price = round2(between(6.19, 6.49));
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 17, 5 + Math.floor(between(0, 40))),
        tipo: 'Despesa',
        categoriaId: '1',
        valor: round2(liters * price),
        km: odometer,
        combustivel: 'Gasolina',
        combustivelPrincipal: 'Gasolina',
        tanqueVazio: true,
        quantidade: liters,
        valorUnitario: price,
        bandeiraPosto: pick(['Ipiranga', 'Petrobras / BR', 'Shell']),
        obs: '',
        ratings: {
          servico: 4 + Math.round(rng()),
          higiene: 4 + Math.round(rng()),
          atendimento: 4 + Math.round(rng()),
        },
      } as Entry);
      kmSinceFuel = 0;
      isFirstFuel = false;
    }

    // --- Alimentação (quase todo dia) ---
    if (rng() < 0.85) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 13, Math.floor(between(0, 50))),
        tipo: 'Despesa',
        categoriaId: '6',
        valor: round2(between(22, 42)),
        obs: pick(['Almoço', 'Marmita', 'Lanche e café', 'Almoço no posto']),
      } as Entry);
    }

    // --- Despesas ocasionais ---
    if (rng() < 0.2) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 15, Math.floor(between(0, 50))),
        tipo: 'Despesa',
        categoriaId: '4',
        valor: round2(between(6, 14)),
        obs: 'Pedágio',
      } as Entry);
    }
    if (rng() < 0.09 && !isToday) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 9, 30),
        tipo: 'Despesa',
        categoriaId: '2',
        valor: pick([35, 40, 45, 60]),
        obs: 'Lavagem simples',
      } as Entry);
    }
    if (rng() < 0.07 && !isToday) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 12, 20),
        tipo: 'Despesa',
        categoriaId: '11',
        valor: pick([8, 10, 12, 15]),
        obs: 'Estacionamento',
      } as Entry);
    }

    // --- Manutenções (uma vez cada, quando o odômetro chega no ponto desejado) ---
    if (!oilDone && odometer >= oilChangeOdometer) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 10, 15),
        tipo: 'Despesa',
        categoriaId: '7',
        valor: 289.9,
        km: odometer,
        obs: 'Óleo 5W30 sintético + filtro de óleo',
      } as Entry);
      oilDone = true;
    }
    if (!airFilterDone && odometer >= finalOdometer - 5200) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 10, 40),
        tipo: 'Despesa',
        categoriaId: '3_3',
        valor: 68,
        km: odometer,
        obs: 'Filtro de ar do motor',
      } as Entry);
      airFilterDone = true;
    }
    if (!pastilhasDone && odometer >= finalOdometer - 7800) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 11, 5),
        tipo: 'Despesa',
        categoriaId: '3_1',
        valor: 340,
        km: odometer,
        obs: 'Pastilhas dianteiras',
      } as Entry);
      pastilhasDone = true;
    }
    if (!pneusDone && odometer >= finalOdometer - 8600) {
      entries.push({
        id: nextId(),
        data: dateStr,
        createdAt: stamp(day.date, 14, 0),
        tipo: 'Despesa',
        categoriaId: '3_2',
        valor: 1680,
        km: odometer,
        obs: 'Jogo de 4 pneus',
      } as Entry);
      pneusDone = true;
    }
  });

  // ---- 3) Pagamentos de custos fixos (um por mês, nos dias de vencimento já passados) ----
  const payFixed = (categoriaId: string, valor: number, dueDay: number, label: string) => {
    for (let m = 0; m < 4; m++) {
      const ref = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      const payDate = new Date(ref.getFullYear(), ref.getMonth(), Math.min(dueDay, lastDay));
      if (payDate > today) continue;
      if (payDate < subDays(today, DEMO_DAYS - 1)) continue;
      entries.push({
        id: nextId(),
        data: format(payDate, 'yyyy/MM/dd'),
        createdAt: stamp(payDate, 8, 0),
        tipo: 'Despesa',
        categoriaId,
        valor,
        obs: label,
        referenciaMes: format(ref, 'yyyy-MM'),
      } as Entry);
    }
  };
  payFixed('12', 1150, 10, 'Financiamento');
  payFixed('5', 260, 15, 'Seguro Uber');

  // ---- 4) Ordenação (mais recente primeiro, como no app real) ----
  entries.sort((a, b) => {
    const ka = `${a.data.replace(/\//g, '-')} ${a.createdAt.split(' ')[1] || '00:00:00'}`;
    const kb = `${b.data.replace(/\//g, '-')} ${b.createdAt.split(' ')[1] || '00:00:00'}`;
    return kb.localeCompare(ka);
  });

  return {
    entries,
    fixedCosts: DEMO_FIXED_COSTS,
    categories: DEFAULT_CATEGORIES,
    earningCategories: DEFAULT_EARNING_CATEGORIES,
    refundCategories: DEFAULT_REFUND_CATEGORIES,
    currentKm: odometer,
    targetKm: odometer + 2500,
    workDaysPerMonth: 24,
    combustivelPrincipal: 'Gasolina',
    maintenanceIntervals: DEMO_MAINTENANCE_INTERVALS,
    trialStartDate: addDays(today, -3).toISOString(),
    hasSeenTutorial: true,
    tutorialOptOut: true,
  };
}

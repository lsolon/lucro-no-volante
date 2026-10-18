import { useMemo } from 'react';
import { motion } from 'motion/react';
import { addMonths, differenceInDays } from 'date-fns';
import { 
  Fuel, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  History,
  Info,
  Settings
} from 'lucide-react';
import { cn, formatNumberBR, formatDateBR } from '../lib/utils';
import { Entry, MaintenanceInterval } from '../types';
import { getCategoryStyle } from '../lib/category-styles';

interface MaintenanceViewProps {
  currentKm: number;
  maintenanceIntervals: MaintenanceInterval[];
  entries: Entry[];
  categories: { id: string; nome: string }[];
  onNavigateToSettings?: () => void;
}

export default function MaintenanceView({ 
  currentKm, 
  maintenanceIntervals, 
  entries, 
  categories,
  onNavigateToSettings
}: MaintenanceViewProps) {
  const maintenanceStatus = useMemo(() => {
    let standardItems = maintenanceIntervals.map(interval => {
      const lastEntry = entries.find(e => {
        const cat = categories.find(c => c.id === e.categoriaId);
        const name = cat?.nome.toLowerCase() || '';
        const itemName = interval.item.toLowerCase();
        
        if (itemName.includes('óleo') || itemName.includes('oleo')) {
          return (name === 'troca de oleo' || name === 'troca de óleo') && e.km;
        }
        
        return name.includes(itemName) && e.km;
      });

      const hasInterval = Boolean(interval.intervaloKm && interval.intervaloKm > 0);

      if (!hasInterval) {
        return {
          ...interval,
          remaining: null,
          percent: 0,
          lastKm: lastEntry?.km || null,
          data: lastEntry?.data,
          noInterval: true
        };
      }

      if (!lastEntry || !lastEntry.km) return { ...interval, remaining: null, percent: 0, lastKm: null };

      const nextChange = lastEntry.km + interval.intervaloKm;
      const remaining = nextChange - currentKm;
      const percent = Math.max(0, Math.min(100, (remaining / interval.intervaloKm) * 100));
      
      return { ...interval, remaining, percent, lastKm: lastEntry.km, data: lastEntry.data };
    });

    const hasOilInterval = maintenanceIntervals.some(i => i.item.toLowerCase().includes('óleo') || i.item.toLowerCase().includes('oleo'));
    
    if (!hasOilInterval) {
      const lastOilEntry = entries.find(e => {
        const cat = categories.find(c => c.id === e.categoriaId);
        const name = cat?.nome.toLowerCase() || '';
        return (name === 'troca de oleo' || name === 'troca de óleo') && e.km;
      });

      if (lastOilEntry && lastOilEntry.km) {
        if (!lastOilEntry.garantiaKm && lastOilEntry.manutencaoItem !== 'Sim') {
          const nextChange = lastOilEntry.km + 10000;
          const remaining = nextChange - currentKm;
          const percent = Math.max(0, Math.min(100, (remaining / 10000) * 100));
          
          standardItems.push({
            id: 'default-oil-change',
            item: 'Troca de Óleo',
            intervaloKm: 10000,
            remaining,
            percent,
            lastKm: lastOilEntry.km,
            data: lastOilEntry.data
          });
        }
      }
    }

    const initialDynamicItems = entries
      .filter(e => e.manutencaoItem || e.garantiaKm || e.garantiaMeses)
      .map(e => {
        let itemName = 'Manutenção';
        if (e.manutencaoItem && e.manutencaoItem !== 'Sim') {
          itemName = e.manutencaoItem;
        } else {
          const cat = categories.find(c => c.id === e.categoriaId);
          itemName = cat?.nome || 'Manutenção';
          if (e.obs) {
            const obsClean = e.obs.split('- Parcela')[0].trim();
            if (obsClean) {
              itemName += ` (${obsClean.slice(0, 30)}${obsClean.length > 30 ? '...' : ''})`;
            }
          }
        }
        
        let remainingKm = null;
        let percentKm = null;
        if (e.garantiaKm && e.km) {
          const nextChange = e.km + e.garantiaKm;
          remainingKm = nextChange - currentKm;
          percentKm = Math.max(0, Math.min(100, (remainingKm / e.garantiaKm) * 100));
        }

        let remainingDays = null;
        let percentDays = null;
        if (e.garantiaMeses && e.data) {
          const entryDate = new Date(e.data.replace(/-/g, '/'));
          const targetDate = addMonths(entryDate, e.garantiaMeses);
          remainingDays = differenceInDays(targetDate, new Date());
          
          const totalDays = differenceInDays(targetDate, entryDate);
          if (totalDays > 0) {
            percentDays = Math.max(0, Math.min(100, (remainingDays / totalDays) * 100));
          }
        }

        let percent = percentKm !== null ? percentKm : (percentDays !== null ? percentDays : 0);
        if (percentKm !== null && percentDays !== null) {
          percent = Math.min(percentKm, percentDays);
        }

        let remaining = null;
        if (remainingKm !== null) {
          remaining = remainingKm;
        } else if (remainingDays !== null) {
          remaining = remainingDays * 33; 
        }

        const noInterval = !e.garantiaKm && !e.garantiaMeses;

        return {
          id: e.id,
          item: itemName,
          intervaloKm: e.garantiaKm,
          garantiaMeses: e.garantiaMeses,
          remaining,
          percent,
          lastKm: e.km,
          data: e.data,
          remainingKm,
          remainingDays,
          isDynamic: true,
          noInterval
        };
      });

    const dynamicItemsMap = new Map();
    initialDynamicItems.forEach(item => {
      if (!dynamicItemsMap.has(item.item)) {
        dynamicItemsMap.set(item.item, item);
      }
    });
    
    const finalDynamicItems = Array.from(dynamicItemsMap.values());

    return [...standardItems, ...finalDynamicItems];
  }, [maintenanceIntervals, entries, categories, currentKm]);

  const noIntervalItems = maintenanceStatus.filter(item => item.noInterval || (!item.intervaloKm && !item.garantiaMeses));
  const itemsWithInterval = maintenanceStatus.filter(item => !item.noInterval && Boolean(item.intervaloKm || item.garantiaMeses));

  const criticalItems = itemsWithInterval.filter(item => item.remaining !== null && item.remaining < 500);
  const warningItems = itemsWithInterval.filter(item => item.remaining !== null && item.remaining >= 500 && item.remaining < 1500);
  const healthyItems = itemsWithInterval.filter(item => item.remaining === null || item.remaining >= 1500);

  return (
    <div className="bg-[#1a1a1a] text-white p-4 rounded-3xl space-y-6 pb-20">
      <div className="bg-[#2a2a2a] p-6 rounded-3xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/10 rounded-xl">
            <Fuel className="text-white size-6" />
          </div>
          <h2 className="font-bold text-xl">Manutenção e Revisão</h2>
        </div>
        <p className="text-sm text-slate-400 font-medium">
          Acompanhe o estado de conservação e as próximas revisões do seu veículo.
        </p>
        
        <div className="mt-6 flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">KM Atual do Veículo</p>
            <p className="text-2xl font-black">{formatNumberBR(currentKm)} <span className="text-sm text-slate-400">km</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Status Geral</p>
            <div className="flex items-center gap-1 justify-end">
              {criticalItems.length > 0 ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <AlertCircle size={14} /> Crítico
                </span>
              ) : (warningItems.length > 0 || noIntervalItems.length > 0) ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertCircle size={14} /> Atenção
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} /> Em dia
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {noIntervalItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={14} /> Itens sem Intervalo Definido
            </h3>
            {onNavigateToSettings && (
              <button 
                onClick={onNavigateToSettings}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                <Settings size={12} /> Configurar
              </button>
            )}
          </div>
          {noIntervalItems.map((item, idx) => (
            <MaintenanceCard 
              key={`no-int-${item.id}-${idx}`} 
              item={item} 
              currentKm={currentKm}
              onNavigateToSettings={onNavigateToSettings}
            />
          ))}
        </div>
      )}

      {criticalItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest px-1 flex items-center gap-2">
            <AlertCircle size={14} /> Itens Críticos
          </h3>
          {criticalItems.map((item, idx) => (
            <MaintenanceCard 
              key={`crit-${item.id}-${idx}`} 
              item={item} 
              currentKm={currentKm}
              onNavigateToSettings={onNavigateToSettings}
            />
          ))}
        </div>
      )}

      {warningItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest px-1 flex items-center gap-2">
            <Info size={14} /> Atenção Necessária
          </h3>
          {warningItems.map((item, idx) => (
            <MaintenanceCard 
              key={`warn-${item.id}-${idx}`} 
              item={item} 
              currentKm={currentKm}
              onNavigateToSettings={onNavigateToSettings}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
          <CheckCircle2 size={14} /> Itens em Dia / Sem Registro
        </h3>
        {healthyItems.map((item, idx) => (
          <MaintenanceCard 
            key={`healthy-${item.id}-${idx}`} 
            item={item} 
            currentKm={currentKm}
            onNavigateToSettings={onNavigateToSettings}
          />
        ))}
      </div>
      
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
        <History className="text-blue-500 shrink-0" size={20} />
        <p className="text-xs text-blue-700 font-medium leading-relaxed">
          Dica: Para atualizar um item, registre uma nova despesa com a categoria correspondente e informe a quilometragem atual do veículo.
        </p>
      </div>
    </div>
  );
}

function MaintenanceCard({ 
  item, 
  currentKm,
  onNavigateToSettings 
}: { 
  item: any; 
  currentKm: number;
  onNavigateToSettings?: () => void;
}) {
  const style = getCategoryStyle(item.item);
  const hasNoInterval = Boolean(item.noInterval || (!item.intervaloKm && !item.garantiaMeses));
  const isCritical = !hasNoInterval && item.remaining !== null && item.remaining < 500;
  const isWarning = hasNoInterval || (item.remaining !== null && item.remaining >= 500 && item.remaining < 1500);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-[#2a2a2a] p-5 rounded-3xl shadow-sm border transition-all duration-300",
        isCritical ? "border-rose-900/50" : 
        hasNoInterval ? "border-amber-500/30 bg-amber-950/10" :
        isWarning ? "border-amber-900/50" : "border-white/5"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl",
            isCritical ? "bg-rose-900/40 text-rose-400" : 
            isWarning ? "bg-amber-900/40 text-amber-400" : "bg-white/10 text-white"
          )}>
            {style.icon}
          </div>
          <div>
            <h3 className="font-bold text-white">{item.item}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {item.intervaloKm && item.garantiaMeses ? `Garantia: ${formatNumberBR(item.intervaloKm)} km / ${item.garantiaMeses} meses` : 
               item.intervaloKm ? `Intervalo: ${formatNumberBR(item.intervaloKm)} km` :
               item.garantiaMeses ? `Garantia: ${item.garantiaMeses} meses` :
               <span className="text-amber-400 font-bold">Defina o intervalo</span>}
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-600" />
      </div>
      
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {hasNoInterval ? "Status" : (item.remaining !== null ? "Restam" : "Status")}
          </p>
          {hasNoInterval ? (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-base sm:text-lg font-black text-amber-400">Defina o intervalo</span>
              {onNavigateToSettings && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToSettings();
                  }}
                  className="px-2 py-0.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold rounded-lg border border-amber-400/30 transition-all cursor-pointer"
                >
                  Configurações
                </button>
              )}
            </div>
          ) : (
            <p className={cn(
              "text-2xl font-black tracking-tight",
              isCritical ? "text-rose-400" : 
              isWarning ? "text-amber-400" : "text-emerald-400"
            )}>
              {item.remainingKm !== undefined && item.remainingKm !== null ? `${formatNumberBR(item.remainingKm)} km` : 
               item.remainingDays !== undefined && item.remainingDays !== null ? `${item.remainingDays} dias` : 
               item.remaining !== null ? `${formatNumberBR(item.remaining)} km` : "Sem registro"}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {item.isDynamic ? "Último Registro" : "Última Revisão"}
          </p>
          <p className="font-bold text-slate-300">
            {item.lastKm !== null && item.lastKm !== undefined ? `${formatNumberBR(item.lastKm)} km` : 
             item.data ? formatDateBR(item.data) : "---"}
          </p>
        </div>
      </div>

      {!hasNoInterval && item.remaining !== null && (
        <div className="h-3 bg-black/30 rounded-full overflow-hidden p-0.5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${item.percent}%` }}
            className={cn(
              "h-full rounded-full shadow-sm transition-colors duration-500",
              item.percent < 10 ? "bg-rose-600" : 
              item.percent < 30 ? "bg-amber-500" : "bg-emerald-500"
            )}
          />
        </div>
      )}
    </motion.div>
  );
}

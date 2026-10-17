import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  CheckCircle2, 
  ChevronRight, 
  Car, 
  BarChart3, 
  Settings, 
  Fuel,
  Target,
  ArrowRight,
  AlertCircle,
  Share2,
  Smartphone,
  Download,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { PolicyModal } from './PolicyModal';

interface LandingPageProps {
  onLogin: () => void;
  error?: string | null;
}

export default function LandingPage({ onLogin, error }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [showTaxExample, setShowTaxExample] = useState(false);
  const [modalType, setModalType] = useState<'terms' | 'privacy' | null>(null);

  const handleShare = async () => {
    const shareData = {
      title: 'LucroNoVolante',
      text: 'Motorista, pare de apenas dirigir e comece a lucrar! Conheça o LucroNoVolante, o app de gestão financeira para motoristas de aplicativo.',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        alert('Link do app copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-700">
      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-4 sm:px-6 py-3 sm:py-4",
        scrolled ? "bg-white/80 backdrop-blur-md border-b border-slate-100 py-2.5 sm:py-3" : "bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img 
              src="/logo.webp" 
              alt="Logo" 
              className="size-8 sm:size-10 rounded-lg shadow-md shrink-0"
            />
            <span className="font-black text-base sm:text-xl tracking-tight text-slate-800 truncate">LucroNoVolante</span>
          </div>
          <button 
            onClick={onLogin}
            className="bg-slate-900 text-white px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-md shadow-slate-200 shrink-0 whitespace-nowrap"
          >
            Entrar no App
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6">
              <Zap size={14} />
              Feito para motoristas de app, táxi e entregadores
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tighter mb-6">
              Pare de apenas dirigir. <br />
              <span className="text-blue-600">Comece a lucrar.</span>
            </h1>
            <p className="text-lg text-slate-500 mb-8 max-w-lg leading-relaxed">
              A ferramenta definitiva para motoristas de aplicativo, Táxi e entregadores. Controle seus ganhos, despesas e manutenções em tempo real com inteligência financeira.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start w-full">
              <div className="relative group flex-1 max-w-[240px]">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <button 
                  onClick={onLogin}
                  className="relative w-full bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all flex flex-col items-center justify-center gap-1 shadow-xl"
                >
                  <span className="flex items-center gap-2">Teste Grátis <ArrowRight size={18} /></span>
                  <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest text-blue-50">30 dias liberados</span>
                </button>
              </div>

              <div className="relative group flex-1 max-w-[240px]">
                <button 
                  onClick={onLogin}
                  className="relative w-full bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all flex flex-col items-center justify-center gap-1 shadow-xl"
                >
                  <span className="flex items-center gap-2">Assinar Premium</span>
                  <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest text-emerald-50">R$ 97,00 / ano</span>
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold"
              >
                <AlertCircle className="size-5 shrink-0" />
                {error}
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-blue-600/5 rounded-[40px] blur-3xl" />
            <div className="relative bg-slate-900 rounded-[44px] p-3 sm:p-4 shadow-2xl border-4 border-slate-800 max-w-sm mx-auto">
              {/* Speaker / Camera Notch */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-3.5 bg-slate-950 rounded-full z-20 flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-slate-800 mr-2" />
                <div className="w-6 h-1 rounded-full bg-slate-800" />
              </div>

              {/* Screen Mockup */}
              <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-[32px] p-3.5 pt-9 text-white overflow-hidden shadow-inner border border-slate-800/80 space-y-3">
                {/* Header Mock */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                      <Car size={14} className="text-white" />
                    </div>
                    <div>
                      <p className="font-black text-xs text-white leading-none">LucroNoVolante</p>
                      <p className="text-[9px] text-slate-400 font-bold">Painel de Hoje</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Ao Vivo
                  </span>
                </div>

                {/* Cards Ganho Bruto e Custos */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ganho bruto</span>
                      <TrendingUp size={12} className="text-blue-400" />
                    </div>
                    <p className="text-base font-black text-white">R$ 412,00</p>
                    <p className="text-[8px] text-slate-400 font-medium">Uber · 99 · InDrive</p>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Custos</span>
                      <Fuel size={12} className="text-amber-400" />
                    </div>
                    <p className="text-base font-black text-white">R$ 138,50</p>
                    <p className="text-[8px] text-slate-400 font-medium">Combustível + Rua</p>
                  </div>
                </div>

                {/* Card Lucro Real (Destaque em Verde) */}
                <div className="bg-gradient-to-br from-emerald-500/20 via-emerald-600/30 to-teal-500/10 border-2 border-emerald-400/60 rounded-2xl p-3.5 shadow-lg shadow-emerald-950/40 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Lucro real</span>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 uppercase tracking-wider">Líquido</span>
                  </div>
                  <p className="text-3xl font-black text-emerald-300 tracking-tight">R$ 273,50</p>
                  <p className="text-[9px] text-emerald-200/80 font-medium mt-0.5">
                    Total limpo no bolso descontando todos os custos.
                  </p>
                </div>

                {/* Barra de Progresso Meta do Dia 78% */}
                <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Target size={13} className="text-blue-400" />
                      <span className="text-[10px] font-bold text-slate-200">Meta do dia</span>
                    </div>
                    <span className="text-xs font-black text-blue-400">78%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full shadow-sm"
                      style={{ width: '78%' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-slate-400 font-medium">
                    <span>Faltam R$ 78,00 para bater a meta</span>
                    <span>Meta: R$ 350,00</span>
                  </div>
                </div>

                {/* Mini Bottom Nav Mock */}
                <div className="pt-2 border-t border-slate-800/60 flex justify-around items-center text-slate-500 text-[9px] font-bold">
                  <div className="flex flex-col items-center gap-0.5 text-blue-400">
                    <BarChart3 size={13} />
                    <span>Painel</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Fuel size={13} />
                    <span>Postos</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Settings size={13} />
                    <span>Revisão</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-slate-50 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-4">
              Tudo o que você precisa para dominar as ruas
            </h2>
            <p className="text-slate-500 font-medium">
              Desenvolvido por quem entende a realidade do motorista brasileiro.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-3 bg-gradient-to-br from-purple-600 to-indigo-700 p-10 rounded-[32px] shadow-2xl text-white flex flex-col md:flex-row items-center gap-8">
              <div className="p-4 bg-white/10 rounded-2xl">
                <CheckCircle2 className="size-12 text-white" />
              </div>
              <div className="flex-grow">
                <h3 className="text-2xl font-black mb-2 tracking-tight">Facilite seu Imposto de Renda</h3>
                <p className="text-purple-100 leading-relaxed font-medium text-lg mb-4">
                  Guarde fotos das notas e comprovantes no app e tenha seus números organizados para o carnê-leão e a declaração anual.
                </p>
                <button 
                  onClick={() => setShowTaxExample(true)}
                  className="bg-white text-purple-700 px-6 py-3 rounded-full font-black text-sm hover:bg-purple-50 transition-colors"
                >
                  Ver Exemplo
                </button>
              </div>
            </div>

            {showTaxExample && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowTaxExample(false)}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-8 rounded-3xl max-w-lg w-full text-slate-800 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-2xl font-black mb-4">Exemplo de Uso e Impostos</h3>
                  <div className="space-y-4 text-slate-600">
                    <p className="text-sm font-medium">Veja como você organiza suas despesas e comprovantes:</p>
                    
                    {/* Card de Nota Fiscal desenhado em JSX */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="font-black text-xs text-slate-900">DANFE NFC-e · Posto Exemplo</p>
                            <p className="text-[10px] text-slate-400 font-medium">Comprovante de Abastecimento</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Nota Anexada
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data</p>
                          <p className="font-bold text-slate-800">20/04/2026</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Categoria</p>
                          <p className="font-bold text-slate-800">Combustível</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor</p>
                          <p className="font-black text-slate-900 text-sm">R$ 150,00</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <p className="font-bold text-blue-900 flex items-center gap-2 mb-2 text-sm">
                        <Car className="size-5 shrink-0" /> Regra especial:
                      </p>
                      <p className="text-xs sm:text-sm text-blue-900 leading-relaxed font-medium">
                        Para o IR, a Receita considera tributável 60% do valor bruto no transporte de passageiros (Uber, 99, táxi) e 10% no transporte de cargas e entregas. Confirme sempre com seu contador.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowTaxExample(false)}
                    className="w-full mt-6 bg-blue-600 text-white rounded-full py-3 font-bold hover:bg-blue-700 transition-colors"
                  >
                    Entendido
                  </button>
                </motion.div>
              </div>
            )}

            <FeatureCard 
              icon={<TrendingUp className="text-emerald-600" />}
              title="Lucro Real"
              description="Saiba exatamente quanto sobra no seu bolso após descontar combustível, aluguel e manutenção."
            />
            <FeatureCard 
              icon={<Target className="text-blue-600" />}
              title="Metas Inteligentes"
              description="Defina quanto quer ganhar e o app calcula sua meta diária baseada nos seus custos reais."
            />
            <FeatureCard 
              icon={<Fuel className="text-amber-600" />}
              title="Mapa de Combustível"
              description="Encontre os postos com melhor custo-benefício baseados nos seus próprios registros."
            />
            <FeatureCard 
              icon={<Settings className="text-slate-600" />}
              title="Gestão de Revisão"
              description="Alertas automáticos de troca de óleo, pneus e correias baseados na sua kilometragem."
            />
            <FeatureCard 
              icon={<BarChart3 className="text-indigo-600" />}
              title="Relatórios Detalhados"
              description="Visualize seu desempenho e detalhamento exato por plataforma (Uber, 99, InDrive). Otimize sua jornada com dados reais."
            />
            <FeatureCard 
              icon={<Shield className="text-rose-600" />}
              title="Dados na Nuvem"
              description="Nunca perca seus registros. Seus dados são salvos com segurança e acessíveis de qualquer lugar."
            />
            <FeatureCard 
              icon={<Smartphone className="text-blue-600" />}
              title="Instale no Celular"
              description="Use como um aplicativo nativo. Baixe direto do navegador para sua tela de início."
            />
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto bg-blue-600 rounded-[40px] p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 left-10"><Car size={100} /></div>
            <div className="absolute bottom-10 right-10"><TrendingUp size={100} /></div>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-4xl font-black mb-12 tracking-tight">O motorista que se organiza, lucra mais.</h2>
            <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/10">
                <p className="text-3xl sm:text-4xl font-black mb-1">30 dias grátis</p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Acesso completo para testar</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/10">
                <p className="text-3xl sm:text-4xl font-black mb-1">R$ 8/mês</p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">No plano anual (R$ 97/ano)</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/10">
                <p className="text-3xl sm:text-4xl font-black mb-1">Uber, 99 e InDrive</p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Multiplataforma integrado</p>
              </div>
            </div>
            <button 
              onClick={handleShare}
              className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-black text-lg hover:bg-blue-50 transition-all shadow-xl flex items-center justify-center gap-2 mx-auto"
            >
              <Share2 size={20} />
              Convidar um Amigo Motorista
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.webp" 
              alt="Logo" 
              className="size-8 rounded-lg"
            />
            <span className="font-black text-lg tracking-tighter text-slate-800">LucroNoVolante</span>
          </div>
          <div className="text-center md:text-left">
            <p className="text-slate-400 text-sm font-medium">
              © 2026 LucroNoVolante. Todos os direitos reservados.
            </p>
            <p className="text-slate-500 text-xs font-medium mt-1">
              App Routine Tech · <a href="mailto:contato@routinetech.com.br" className="underline hover:text-blue-600 transition-colors">contato@routinetech.com.br</a>
            </p>
          </div>
          <div className="flex gap-6">
            <button onClick={() => setModalType('terms')} className="text-slate-400 hover:text-slate-600 text-sm font-bold uppercase tracking-widest">Termos</button>
            <button onClick={() => setModalType('privacy')} className="text-slate-400 hover:text-slate-600 text-sm font-bold uppercase tracking-widest">Privacidade</button>
          </div>
        </div>
      </footer>
      <PolicyModal isOpen={!!modalType} onClose={() => setModalType(null)} type={modalType || 'privacy'} />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="p-3 bg-slate-50 rounded-2xl w-fit mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">{title}</h3>
      <p className="text-slate-500 leading-relaxed font-medium">
        {description}
      </p>
    </div>
  );
}

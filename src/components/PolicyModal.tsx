import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, FileText } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export function PolicyModal({ isOpen, onClose, type }: PolicyModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white p-8 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto text-slate-800 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black flex items-center gap-3 text-blue-900">
                {type === 'terms' ? <FileText className="text-blue-600" /> : <Shield className="text-blue-600" />}
                {type === 'terms' ? 'Termos de Uso' : 'Política de Privacidade (LGPD)'}
              </h2>
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500">
                <X size={20} />
              </button>
            </div>
            
            <div className="border-t-4 border-blue-600 pt-6">
              {type === 'privacy' ? (
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p><strong>1. Introdução e Conformidade LGPD</strong></p>
                  <p>No LucroNoVolante, levamos a sério a sua privacidade e a segurança dos seus dados pessoais, em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>
                  
                  <p><strong>2. Armazenamento Seguro na Nuvem (Firebase / Google Cloud)</strong></p>
                  <p>Os seus registros financeiros, metas e informações de perfil são armazenados com segurança e criptografia na infraestrutura do Firebase (Google Cloud), garantindo proteção, integridade e alta disponibilidade dos dados.</p>
                  
                  <p><strong>3. Processamento de Pagamentos (Mercado Pago)</strong></p>
                  <p>Todas as transações e assinaturas são processadas com segurança pela plataforma do Mercado Pago. O LucroNoVolante não tem acesso e não armazena números de cartões de crédito ou dados bancários sensíveis.</p>
                  
                  <p><strong>4. Uso de Localização Geográfica</strong></p>
                  <p>A permissão de localização (GPS) é opcional e utilizada exclusivamente para a marcação de postos e consulta de preços no Mapa de Combustível. Não realizamos rastreamento contínuo em segundo plano e não compartilhamos sua localização com terceiros.</p>
                  
                  <p><strong>5. Seus Direitos e Exclusão de Dados</strong></p>
                  <p>Você é o único titular de suas informações. A qualquer momento, você pode solicitar a consulta, retificação, exportação ou exclusão definitiva de sua conta e de todos os dados armazenados enviando uma mensagem para <strong>contato@routinetech.com.br</strong>.</p>
                </div>
              ) : (
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p><strong>1. Aceitação dos Termos</strong></p>
                  <p>Ao utilizar o aplicativo LucroNoVolante, você declara estar de acordo com estes Termos de Uso.</p>
                  
                  <p><strong>2. Assinatura Anual e Valores</strong></p>
                  <p>O aplicativo opera no modelo de assinatura anual no valor de R$ 97,00 (equivalente a cerca de R$ 8,08/mês), oferecendo período de teste gratuito de 30 dias para novos usuários.</p>
                  
                  <p><strong>3. Cancelamento a Qualquer Momento</strong></p>
                  <p>Você pode cancelar sua assinatura a qualquer momento diretamente pelo app ou pelo suporte, sem multas, carências ou taxas de rescisão.</p>
                  
                  <p><strong>4. Direito de Arrependimento de 7 Dias (Art. 49 do CDC)</strong></p>
                  <p>Em conformidade com o artigo 49 do Código de Defesa do Consumidor (Lei nº 8.078/1990), você tem até 7 (sete) dias corridos após a contratação para exercer o direito de arrependimento, com reembolso integral de quaisquer valores eventualmente pagos.</p>
                  
                  <p><strong>5. Processamento Seguro pelo Mercado Pago</strong></p>
                  <p>Todos os pagamentos e renovações são processados pela plataforma parceira Mercado Pago, garantindo conformidade e segurança bancária.</p>
                  
                  <p><strong>6. Limitação de Responsabilidade</strong></p>
                  <p>O LucroNoVolante é uma ferramenta tecnológica de organização, cálculo e gestão financeira pessoal. O aplicativo não presta serviços de consultoria contábil, fiscal ou tributária e não substitui o trabalho ou aconselhamento de um contador profissional.</p>
                  
                  <p><strong>7. Contato e Atendimento</strong></p>
                  <p>Para suporte, dúvidas, cancelamentos ou solicitações sobre estes termos, entre em contato pelo e-mail <strong>contato@routinetech.com.br</strong> (App Routine Tech).</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={onClose}
              className="w-full mt-8 bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              Fechar
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

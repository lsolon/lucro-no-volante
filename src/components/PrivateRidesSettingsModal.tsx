import React, { useState } from 'react';
import { X, Check, Save, AlertCircle, Key, Car, Percent, Clock, DollarSign, MessageSquare, ShieldAlert } from 'lucide-react';
import { PrivateRidesSettings } from '../types';
import { validatePixKey, PixKeyType } from '../lib/pix';

interface PrivateRidesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrivateRidesSettings;
  onSave: (newSettings: PrivateRidesSettings) => Promise<void>;
}

export default function PrivateRidesSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave
}: PrivateRidesSettingsModalProps) {
  const [form, setForm] = useState<PrivateRidesSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validação da chave Pix se fornecida
    if (form.pixKey) {
      const val = validatePixKey(form.pixKey, form.pixKeyType);
      if (!val.valid) {
        setError(val.message || 'Formato de Chave Pix inválido.');
        return;
      }
      if (!form.pixReceiverName.trim()) {
        setError('Informe o nome do recebedor da chave Pix (nome completo).');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(form);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-[32px] max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-tight">Configurações de Particulares</h2>
              <p className="text-xs text-slate-400">Pix, veículo, folga e regras de agendamento</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          {/* Seção 1: Chave Pix do Motorista */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <DollarSign size={14} className="text-blue-600" />
              <span>1. Chave Pix para Recebimento do Sinal</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Tipo de Chave</label>
                <select
                  value={form.pixKeyType}
                  onChange={(e) => setForm({ ...form, pixKeyType: e.target.value as PixKeyType })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Chave Pix</label>
                <input
                  type="text"
                  value={form.pixKey}
                  onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
                  placeholder={
                    form.pixKeyType === 'cpf' ? '000.000.000-00' :
                    form.pixKeyType === 'telefone' ? '(21) 99999-9999' :
                    form.pixKeyType === 'email' ? 'exemplo@gmail.com' : 'Sua chave Pix'
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Nome do Recebedor</label>
                <input
                  type="text"
                  value={form.pixReceiverName}
                  onChange={(e) => setForm({ ...form, pixReceiverName: e.target.value })}
                  placeholder="Seu nome completo"
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Cidade do Recebedor</label>
                <input
                  type="text"
                  value={form.pixReceiverCity || ''}
                  onChange={(e) => setForm({ ...form, pixReceiverCity: e.target.value })}
                  placeholder="Ex: RIO DE JANEIRO"
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic">
              * O valor pago pelo passageiro cai 100% direto na sua conta bancária sem qualquer intermediador.
            </p>
          </div>

          {/* Seção 2: Dados do Veículo */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <Car size={14} className="text-blue-600" />
              <span>2. Dados do Veículo (visíveis ao passageiro)</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Modelo</label>
                <input
                  type="text"
                  value={form.carModel || ''}
                  onChange={(e) => setForm({ ...form, carModel: e.target.value })}
                  placeholder="Ex: Corolla"
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Cor</label>
                <input
                  type="text"
                  value={form.carColor || ''}
                  onChange={(e) => setForm({ ...form, carColor: e.target.value })}
                  placeholder="Ex: Prata"
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Placa</label>
                <input
                  type="text"
                  value={form.carPlate || ''}
                  onChange={(e) => setForm({ ...form, carPlate: e.target.value.toUpperCase() })}
                  placeholder="ABC-1234"
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Parâmetros Financeiros e Prazos */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <Clock size={14} className="text-blue-600" />
              <span>3. Parâmetros de Cálculo e Prazos</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">% do Sinal de Reserva</label>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={form.depositPercent}
                    onChange={(e) => setForm({ ...form, depositPercent: Number(e.target.value) || 50 })}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Folga antes do embarque</label>
                <div className="relative">
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={form.bookingBufferMinutes}
                    onChange={(e) => setForm({ ...form, bookingBufferMinutes: Number(e.target.value) || 15 })}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">min</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Tarifa Mínima</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    min={10}
                    step={1}
                    value={form.minimumFare}
                    onChange={(e) => setForm({ ...form, minimumFare: Number(e.target.value) || 25 })}
                    className="w-full p-3 pl-9 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Valor/hora padrão (meta)</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    min={10}
                    step={1}
                    value={form.defaultHourlyRate}
                    onChange={(e) => setForm({ ...form, defaultHourlyRate: Number(e.target.value) || 30 })}
                    className="w-full p-3 pl-9 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">/h</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Validade do Orçamento</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={48}
                    value={form.budgetValidityHours}
                    onChange={(e) => setForm({ ...form, budgetValidityHours: Number(e.target.value) || 2 })}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">horas</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Prazo devolução sinal</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={form.cancellationRefundHours}
                    onChange={(e) => setForm({ ...form, cancellationRefundHours: Number(e.target.value) || 24 })}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">horas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 4: Mensagem de WhatsApp (REGRA 6) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <MessageSquare size={14} className="text-blue-600" />
              <span>4. Mensagem Personalizada do WhatsApp</span>
            </div>

            <textarea
              value={form.whatsappMessageTemplate || ''}
              onChange={(e) => setForm({ ...form, whatsappMessageTemplate: e.target.value })}
              rows={3}
              placeholder="Olá, {nome}! Segue o link com as informações da sua viagem agendada: {link}. Aguardo a confirmação!"
              className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none leading-relaxed"
            />
            <p className="text-[10px] text-slate-400">
              Variáveis disponíveis: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">{"{nome}"}</code> e <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">{"{link}"}</code>.
            </p>
          </div>

          <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 text-[11px] text-blue-700 leading-relaxed">
            <strong>Privacidade do Motorista:</strong> O passageiro nunca terá acesso aos seus custos de combustível, manutenção ou comparativos com plataformas de aplicativo.
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
          >
            {saving ? (
              'Salvando...'
            ) : (
              <>
                <Save size={18} />
                Salvar Configurações
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}

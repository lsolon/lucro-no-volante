/**
 * Utilitário de Geração de Pix EMV (BR Code Estático)
 * Padrão Banco Central do Brasil
 */

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface PixPayloadParams {
  key: string;
  name: string; // Nome do recebedor (max 25 caracteres, sem acentos)
  city?: string; // Cidade (max 15 caracteres, sem acentos, padrão 'BRASIL')
  amount: number; // Valor em reais
  txid?: string; // Identificador da transação (alfanumérico, sem caracteres especiais, max 25)
  description?: string; // Descrição opcional (atenção à REGRA 6: nunca citar plataformas)
}

/**
 * Remove acentos e caracteres especiais para compatibilidade com o padrão EMV
 */
export function sanitizeText(text: string, maxLength: number): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, '') // apenas letras, números e espaços
    .trim()
    .toUpperCase();
  return normalized.slice(0, maxLength);
}

/**
 * Formata campo TLV (Tag, Length, Value)
 */
function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Calcula o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 */
export function calculateCRC16(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Valida o formato da chave Pix
 */
export function validatePixKey(key: string, type: PixKeyType): { valid: boolean; message?: string } {
  const clean = key.trim();
  if (!clean) {
    return { valid: false, message: 'Chave Pix não pode estar vazia.' };
  }

  switch (type) {
    case 'cpf': {
      const digits = clean.replace(/\D/g, '');
      if (digits.length !== 11) {
        return { valid: false, message: 'CPF deve conter exatamente 11 dígitos numéricos.' };
      }
      return { valid: true };
    }
    case 'cnpj': {
      const digits = clean.replace(/\D/g, '');
      if (digits.length !== 14) {
        return { valid: false, message: 'CNPJ deve conter exatamente 14 dígitos numéricos.' };
      }
      return { valid: true };
    }
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clean)) {
        return { valid: false, message: 'E-mail informado é inválido.' };
      }
      return { valid: true };
    }
    case 'telefone': {
      const digits = clean.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        return { valid: false, message: 'Telefone deve ter DDD e número (10 ou 11 dígitos, ou com DDI +55).' };
      }
      return { valid: true };
    }
    case 'aleatoria': {
      // UUID v4 format ou 32/36 caracteres
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const cleanNoHyphens = clean.replace(/-/g, '');
      if (!uuidRegex.test(clean) && cleanNoHyphens.length !== 32) {
        return { valid: false, message: 'Chave aleatória EVP deve ser um UUID válido (32 a 36 caracteres).' };
      }
      return { valid: true };
    }
    default:
      return { valid: true };
  }
}

/**
 * Limpa e padroniza a chave Pix para inclusão no payload EMV
 */
export function formatPixKeyForPayload(key: string, type: PixKeyType): string {
  const clean = key.trim();
  if (type === 'cpf' || type === 'cnpj') {
    return clean.replace(/\D/g, '');
  }
  if (type === 'telefone') {
    let digits = clean.replace(/\D/g, '');
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
      digits = '55' + digits;
    }
    return '+' + digits;
  }
  return clean;
}

/**
 * Gera o payload Pix Copia e Cola no padrão BACEN
 */
export function generatePixPayload(params: PixPayloadParams): string {
  const {
    key,
    name,
    city = 'BRASIL',
    amount,
    txid = '***',
    description
  } = params;

  // Formato da Chave (Tag 26 - Merchant Account Info)
  let subTag26 = formatTLV('00', 'br.gov.bcb.pix') + formatTLV('01', key);
  if (description) {
    const cleanDesc = sanitizeText(description, 30);
    if (cleanDesc) {
      subTag26 += formatTLV('02', cleanDesc);
    }
  }

  const cleanName = sanitizeText(name, 25) || 'RECEBEDOR';
  const cleanCity = sanitizeText(city, 15) || 'BRASIL';
  const cleanTxid = (txid ? txid.replace(/[^a-zA-Z0-9]/g, '') : '***').slice(0, 25) || '***';

  const amountStr = amount.toFixed(2);

  let raw = 
    formatTLV('00', '01') + // Payload Format Indicator
    formatTLV('26', subTag26) + // Merchant Account Information
    formatTLV('52', '0000') + // Merchant Category Code
    formatTLV('53', '986') + // Transaction Currency (986 = BRL)
    formatTLV('54', amountStr) + // Transaction Amount
    formatTLV('58', 'BR') + // Country Code
    formatTLV('59', cleanName) + // Merchant Name
    formatTLV('60', cleanCity) + // Merchant City
    formatTLV('62', formatTLV('05', cleanTxid)) + // Additional Data Field (txid)
    '6304'; // CRC16 Tag + Length placeholder

  const crc = calculateCRC16(raw);
  return raw + crc;
}

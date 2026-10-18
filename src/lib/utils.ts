import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseEntryDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== 'string') return new Date();
  
  // Handle yyyy/MM/dd or yyyy-MM-dd date-only strings to avoid UTC shifts
  const dateOnlyMatch = dateStr.match(/^(\d{4})[/-](\d{2})[/-](\d{2})(?:T| )?.*$/);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10) - 1;
    const day = parseInt(dateOnlyMatch[3], 10);
    return new Date(year, month, day);
  }

  // Handle dd/MM/yyyy or dd-MM-yyyy format 
  const brDateMatch = dateStr.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:T| )?.*$/);
  if (brDateMatch) {
    const day = parseInt(brDateMatch[1], 10);
    const month = parseInt(brDateMatch[2], 10) - 1;
    const year = parseInt(brDateMatch[3], 10);
    return new Date(year, month, day);
  }

  return parseISO(dateStr);
}

export function cleanObject<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item)) as any;
  }

  // Only recurse into plain objects. 
  // Firestore sentinels (FieldValue) and other special objects should be left as is.
  if (typeof obj !== 'object' || obj.constructor !== Object) {
    return obj;
  }

  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    const val = (obj as any)[key];
    if (val !== undefined && val !== null) {
      newObj[key] = cleanObject(val);
    }
  });
  return newObj as T;
}

/**
 * Compresses a base64 image string to be under a certain size limit.
 * Firestore document limit is 1MB, so we aim for much less (e.g., 500KB).
 */
export async function compressImage(base64Str: string, maxWidth = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(base64Str);
  });
}

/**
 * Recursively truncates strings in an object if they exceed a certain length.
 * This is a safety measure for Firestore's 1MB limit.
 */
export function truncateLargeFields<T>(obj: T, maxLength = 500000): T {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => truncateLargeFields(item, maxLength)) as any;
  }

  // Only recurse into plain objects. 
  // Firestore sentinels (FieldValue) and other special objects should be left as is.
  if (obj.constructor !== Object) {
    return obj;
  }

  const newObj = { ...obj };

  Object.keys(newObj).forEach(key => {
    const val = (newObj as any)[key];
    if (typeof val === 'string' && val.length > maxLength && key !== 'photoUrl') {
      console.warn(`Field "${key}" truncated because it exceeded ${maxLength} characters.`);
      (newObj as any)[key] = val.substring(0, maxLength) + '... [TRUNCATED]';
    } else if (typeof val === 'object' && val !== null) {
      (newObj as any)[key] = truncateLargeFields(val, maxLength);
    }
  });

  return newObj as T;
}

/**
 * Converte string de tempo (ex: "06:30", "6h30", "6.5", "6h 30m") em minutos totais.
 */
export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const str = timeStr.trim();
  if (str.includes(':')) {
    const [h, m] = str.split(':').map(v => parseInt(v, 10) || 0);
    return (h * 60) + m;
  }
  const hMatch = str.match(/(\d+)\s*h/i);
  const mMatch = str.match(/(\d+)\s*m/i);
  if (hMatch || mMatch) {
    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    const m = mMatch ? parseInt(mMatch[1], 10) : 0;
    return (h * 60) + m;
  }
  const num = parseFloat(str.replace(',', '.'));
  if (!isNaN(num)) {
    return Math.round(num * 60);
  }
  return 0;
}

/**
 * Converte minutos para o formato estrito HH:MM (ex: 390 -> "06:30").
 */
export function formatMinutesToHHMM(minutes?: number): string {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Normaliza qualquer representação de tempo para o formato HH:MM (ex: "6:30" -> "06:30", "6" -> "06:00").
 */
export function formatTimeToHHMM(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const mins = parseTimeToMinutes(trimmed);
  if (mins > 0) {
    return formatMinutesToHHMM(mins);
  }
  return trimmed;
}

/**
 * Aplica máscara de digitação para HH:MM conforme o usuário digita.
 */
export function maskTimeInput(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * Formata minutos em formato estrito HH:MM (ex: "06:30").
 */
export function formatMinutesToDisplay(minutes?: number): string {
  return formatMinutesToHHMM(minutes);
}

/**
 * Formata número com padrão pt-BR (ex: "232.335 km", "6,87 m³", "12,60 km/m³").
 */
export function formatNumberBR(value: number | undefined | null, decimals?: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  if (decimals !== undefined) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }
  return new Intl.NumberFormat('pt-BR').format(value);
}

/**
 * Converte qualquer formato de data (YYYY-MM-DD, YYYY/MM/DD) para dd/mm/aaaa.
 */
export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim().split(' ')[0].replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY/MM/DD -> DD/MM/YYYY
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    if (parts[2].length === 4) {
      // DD/MM/YYYY
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
  }
  return dateStr;
}

/**
 * Retorna uma chave uniforme YYYY-MM-DD HH:mm:ss para ordenação cronológica precisa
 */
export function getEntryDateTimeSortKey(entry: { data?: string; createdAt?: string }): string {
  const dateStr = entry.data ? entry.data.replace(/\//g, '-').trim() : '0000-00-00';
  let timeStr = '00:00:00';
  if (entry.createdAt) {
    const raw = entry.createdAt.trim();
    if (raw.includes('T')) {
      const parts = raw.split('T');
      if (parts[1]) {
        timeStr = parts[1].substring(0, 8);
      }
    } else if (raw.includes(' ')) {
      const parts = raw.split(' ');
      if (parts[1]) {
        timeStr = parts[1].substring(0, 8);
      }
    } else if (raw.includes(':')) {
      timeStr = raw.substring(0, 8);
    }
  }
  return `${dateStr} ${timeStr}`;
}

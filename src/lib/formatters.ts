import { SUPPORTED_CURRENCIES } from '../constants';

export function formatArea(sqm: number, unit: 'metric' | 'imperial'): string {
  if (!sqm) return `0 ${unit === 'metric' ? 'm²' : 'sqft'}`;
  if (unit === 'imperial') {
    // 1 sqm = 10.7639 sqft
    const sqft = sqm * 10.7639;
    return `${Math.round(sqft)} sqft`;
  }
  return `${sqm} m²`;
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, exchangeRates?: Record<string, number>): number {
  if (fromCurrency === toCurrency) return amount;
  
  const rates = exchangeRates || {};
  
  // Convert to EUR first
  const rateToEur = rates[fromCurrency] || 1;
  const amountInEur = amount * rateToEur;
  
  // Convert from EUR to target
  const rateFromEurToTarget = rates[toCurrency] || 1;
  return amountInEur / rateFromEurToTarget;
}

export function formatCurrency(amount: number, currencyCode: string = 'EUR'): string {
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  const symbol = currencyInfo ? currencyInfo.symbol : '€';
  
  return new Intl.NumberFormat(currencyCode === 'USD' ? 'en-US' : 'nl-NL', {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount).replace(/\u00A0/, ' '); // ensure normal space
}

export function formatDate(dateInput: string | Date | number, format: 'DD/MM/YYYY' | 'MM/DD/YYYY'): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  if (format === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`;
  }
  return `${day}/${month}/${year}`;
}

export function formatDateShort(dateInput: string | Date | number, locale: string = 'nl-BE'): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short'
  }).format(d);
}

export function formatTime(dateInput: string | Date | number, format: '12h' | '24h'): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');

  if (format === '12h') {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strHours = hours.toString().padStart(2, '0');
    return `${strHours}:${minutes} ${ampm}`;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

export function timeSince(dateInput: string | Date | number): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  
  if (seconds < 60) return "nu";
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "j";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mnd";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "u";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "min";
  
  return Math.floor(seconds) + "s";
}

export function formatDateTime(dateInput: string | Date | number, dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY', timeFormat: '12h' | '24h'): string {
  return `${formatDate(dateInput, dateFormat)} ${formatTime(dateInput, timeFormat)}`;
}

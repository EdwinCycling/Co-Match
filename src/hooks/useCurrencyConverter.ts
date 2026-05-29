import { useSettings } from '../contexts/SettingsContext';
import { convertCurrency, formatCurrency } from '../lib/formatters';
import { SUPPORTED_CURRENCIES } from '../constants';

export function useCurrencyConverter() {
  const { currency, exchangeRates } = useSettings();
  
  return {
    toDisplay: (eurValue: number | undefined | null) => {
      if (!eurValue && eurValue !== 0) return 0;
      return Math.round(convertCurrency(eurValue, 'EUR', currency, exchangeRates));
    },
    toEur: (displayValue: number | undefined | null) => {
      if (!displayValue && displayValue !== 0) return 0;
      return Math.round(convertCurrency(displayValue, currency, 'EUR', exchangeRates));
    },
    format: (amount: number | undefined | null) => {
      if (!amount && amount !== 0) return formatCurrency(0, currency);
      return formatCurrency(amount, currency);
    },
    formatEur: (eurValue: number | undefined | null) => {
      if (!eurValue && eurValue !== 0) return formatCurrency(0, currency);
      const converted = Math.round(convertCurrency(eurValue, 'EUR', currency, exchangeRates));
      return formatCurrency(converted, currency);
    },
    symbol: SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '€',
    currency,
    exchangeRates,
  };
}

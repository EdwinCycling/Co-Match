export const APP_VERSION = '0.9260529.5';
export const COPYRIGHT_YEAR = '2026';

export const SUPPORTED_CURRENCIES = [
  // Europa
  { code: 'EUR', symbol: '€', label: 'Euro', region: 'Europa' },
  { code: 'GBP', symbol: '£', label: 'British Pound', region: 'Europa' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc', region: 'Europa' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona', region: 'Europa' },
  { code: 'NOK', symbol: 'kr', label: 'Norwegian Krone', region: 'Europa' },
  { code: 'DKK', symbol: 'kr', label: 'Danish Krone', region: 'Europa' },
  { code: 'PLN', symbol: 'zł', label: 'Polish Zloty', region: 'Europa' },
  { code: 'HUF', symbol: 'Ft', label: 'Hungarian Forint', region: 'Europa' },
  { code: 'CZK', symbol: 'Kč', label: 'Czech Koruna', region: 'Europa' },
  { code: 'ISK', symbol: 'kr', label: 'Icelandic Króna', region: 'Europa' },
  { code: 'RON', symbol: 'lei', label: 'Romanian Leu', region: 'Europa' },
  { code: 'BGN', symbol: 'лв', label: 'Bulgarian Lev', region: 'Europa' },
  { code: 'TRY', symbol: '₺', label: 'Turkish Lira', region: 'Europa' },
  
  // Amerika
  { code: 'USD', symbol: '$', label: 'US Dollar', region: 'Amerika' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', region: 'Amerika' },
  { code: 'MXN', symbol: '$', label: 'Mexican Peso', region: 'Amerika' },
  { code: 'COP', symbol: '$', label: 'Colombian Peso', region: 'Amerika' },
  { code: 'PEN', symbol: 'S/', label: 'Peruvian Sol', region: 'Amerika' },
  { code: 'ARS', symbol: '$', label: 'Argentine Peso', region: 'Amerika' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real', region: 'Amerika' },
  { code: 'CLP', symbol: '$', label: 'Chilean Peso', region: 'Amerika' },
  { code: 'CRC', symbol: '₡', label: 'Costa Rican Colón', region: 'Amerika' },
  { code: 'GTQ', symbol: 'Q', label: 'Guatemalan Quetzal', region: 'Amerika' },
  { code: 'BOB', symbol: 'Bs.', label: 'Bolivian Boliviano', region: 'Amerika' },
  { code: 'UYU', symbol: '$U', label: 'Uruguayan Peso', region: 'Amerika' },
  { code: 'DOP', symbol: 'RD$', label: 'Dominican Peso', region: 'Amerika' },

  // Azië
  { code: 'THB', symbol: '฿', label: 'Thai Baht', region: 'Azië' },
  { code: 'VND', symbol: '₫', label: 'Vietnamese Dong', region: 'Azië' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah', region: 'Azië' },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit', region: 'Azië' },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso', region: 'Azië' },
  { code: 'LAK', symbol: '₭', label: 'Lao Kip', region: 'Azië' },
  { code: 'KHR', symbol: '៛', label: 'Cambodian Riel', region: 'Azië' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', region: 'Azië' },
  { code: 'KRW', symbol: '₩', label: 'South Korean Won', region: 'Azië' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan', region: 'Azië' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar', region: 'Azië' },
  { code: 'TWD', symbol: 'NT$', label: 'Taiwanese Dollar', region: 'Azië' },

  // Oceanië & Zuid-Azië
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', region: 'Oceanië' },
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar', region: 'Oceanië' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', region: 'Azië' },
  { code: 'NPR', symbol: 'रू', label: 'Nepalese Rupee', region: 'Azië' },
  { code: 'LKR', symbol: 'Rs', label: 'Sri Lankan Rupee', region: 'Azië' },

  // Afrika & Midden-Oosten
  { code: 'ZAR', symbol: 'R', label: 'South African Rand', region: 'Afrika' },
  { code: 'MAD', symbol: 'MAD', label: 'Moroccan Dirham', region: 'Afrika' },
  { code: 'EGP', symbol: 'E£', label: 'Egyptian Pound', region: 'Afrika' },
  { code: 'TZS', symbol: 'TSh', label: 'Tanzanian Shilling', region: 'Afrika' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling', region: 'Afrika' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham', region: 'Midden-Oosten' },
  { code: 'ILS', symbol: '₪', label: 'Israeli Shekel', region: 'Midden-Oosten' },
];

// Default fallback exchange rates (EUR as base)
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  'EUR': 1,
  'GBP': 1.17,
  'CHF': 1.03,
  'SEK': 0.086,
  'NOK': 0.086,
  'DKK': 0.13,
  'PLN': 0.23,
  'HUF': 0.0026,
  'CZK': 0.040,
  'ISK': 0.0067,
  'RON': 0.20,
  'BGN': 0.51,
  'TRY': 0.029,

  'USD': 0.92, 
  'CAD': 0.67,
  'MXN': 0.055,
  'COP': 0.00024,
  'PEN': 0.25,
  'ARS': 0.001, 
  'BRL': 0.18,
  'CLP': 0.001,
  'CRC': 0.0018,
  'GTQ': 0.12,
  'BOB': 0.13,
  'UYU': 0.024,
  'DOP': 0.016,

  'THB': 0.026,
  'VND': 0.000037,
  'IDR': 0.000058,
  'MYR': 0.20,
  'PHP': 0.016,
  'LAK': 0.000044,
  'KHR': 0.00023,
  'JPY': 0.006,
  'KRW': 0.00068,
  'CNY': 0.13,
  'SGD': 0.69,
  'TWD': 0.029,

  'AUD': 0.61,
  'NZD': 0.55,
  'INR': 0.011,
  'NPR': 0.007,
  'LKR': 0.003,

  'ZAR': 0.05,
  'MAD': 0.092,
  'EGP': 0.02,
  'TZS': 0.00036,
  'KES': 0.007,
  'AED': 0.25,
  'ILS': 0.25,
};

export const CREDIT_COSTS = {
  VIEW_DETAILS: 10,
  AI_MATCH: 15,
  START_CHAT: 25,
  AUDIO_MESSAGE: 15,
  VIDEO_MEETING: 0,
  UNLOCK_ALL: 25,
  EXTRA_PROPERTIES_BUNDLE: 25,
  WEEKLY_HIGHLIGHT: 15,
};

export const CREDIT_PACKAGES = [
  { id: 'pack_100', credits: 100, price: 3, labelKey: 'credit.pack_starter' }
];

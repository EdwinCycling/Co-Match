import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

export type ThemeType = 
  | 'rustic'
  | 'nordic'
  | 'midnight'
  | 'terracotta'
  | 'royal'
  | 'candy'
  | 'forest'
  | 'digital'
  | 'sunset'
  | 'industrial'
  | 'vintage';

export type UnitType = 'metric' | 'imperial';
export type DateFormatType = 'DD/MM/YYYY' | 'MM/DD/YYYY';
export type TimeFormatType = '12h' | '24h';
export type CurrencyType = 
  | 'EUR' | 'GBP' | 'CHF' | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'HUF' | 'CZK' | 'ISK' | 'RON' | 'BGN' | 'TRY'
  | 'USD' | 'CAD' | 'MXN' | 'COP' | 'PEN' | 'ARS' | 'BRL' | 'CLP' | 'CRC' | 'GTQ' | 'BOB' | 'UYU' | 'DOP'
  | 'THB' | 'VND' | 'IDR' | 'MYR' | 'PHP' | 'LAK' | 'KHR' | 'JPY' | 'KRW' | 'CNY' | 'SGD' | 'TWD'
  | 'AUD' | 'NZD' | 'INR' | 'NPR' | 'LKR'
  | 'ZAR' | 'MAD' | 'EGP' | 'TZS' | 'KES' | 'AED' | 'ILS';

interface SettingsContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  unit: UnitType;
  setUnit: (unit: UnitType) => void;
  dateFormat: DateFormatType;
  setDateFormat: (format: DateFormatType) => void;
  timeFormat: TimeFormatType;
  setTimeFormat: (format: TimeFormatType) => void;
  currency: CurrencyType;
  setCurrency: (currency: CurrencyType) => void;
  newsletterEnabled: boolean;
  setNewsletterEnabled: (enabled: boolean) => void;
  smartMatchAlertEnabled: boolean;
  setSmartMatchAlertEnabled: (enabled: boolean) => void;
  smartMatchAlertHour: number | null;
  setSmartMatchAlertHour: (hour: number | null) => void;
  chatMailAlertEnabled: boolean;
  setChatMailAlertEnabled: (enabled: boolean) => void;
  providerChatMailAlertOption: 'only_first_chat_ever' | 'each_seeker_first_chat' | 'always';
  setProviderChatMailAlertOption: (option: 'only_first_chat_ever' | 'each_seeker_first_chat' | 'always') => void;
  exchangeRates: Record<string, number>;
  saveSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

import { subscribeToExchangeRates } from '../services/currencyService';
import { DEFAULT_EXCHANGE_RATES } from '../constants';
import { saveUserSettings } from '../services/userService';
import { APP_LANGUAGE_STORAGE_KEY } from '../config/appLanguages';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  console.log("=== [DEBUG] SettingsProvider rendering start ===");
  const { i18n } = useTranslation();
  const [theme, setThemeState] = useState<ThemeType>('rustic');
  const [unit, setUnitState] = useState<UnitType>('metric');
  const [dateFormat, setDateFormatState] = useState<DateFormatType>('DD/MM/YYYY');
  const [timeFormat, setTimeFormatState] = useState<TimeFormatType>('24h');
  const [currency, setCurrencyState] = useState<CurrencyType>('EUR');
  const [newsletterEnabled, setNewsletterEnabledState] = useState<boolean>(true);
  const [smartMatchAlertEnabled, setSmartMatchAlertEnabledState] = useState<boolean>(false);
  const [smartMatchAlertHour, setSmartMatchAlertHourState] = useState<number | null>(null);
  const [chatMailAlertEnabled, setChatMailAlertEnabledState] = useState<boolean>(true);
  const [providerChatMailAlertOption, setProviderChatMailAlertOptionState] = useState<'only_first_chat_ever' | 'each_seeker_first_chat' | 'always'>('always');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_EXCHANGE_RATES);

  // Subscribe to exchange rates from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToExchangeRates((rates) => {
      setExchangeRates(rates);
    });
    return () => unsubscribe();
  }, []);

  // Load from local storage immediately on boot
  useEffect(() => {
    const localTheme = localStorage.getItem('app_theme') as ThemeType;
    const localUnit = localStorage.getItem('app_unit') as UnitType;
    const localDateFormat = localStorage.getItem('app_date_format') as DateFormatType;
    const localTimeFormat = localStorage.getItem('app_time_format') as TimeFormatType;
    const localCurrency = localStorage.getItem('app_currency') as CurrencyType;
    const localNewsletter = localStorage.getItem('app_newsletter');
    const localSmartAlert = localStorage.getItem('app_smart_match_alert');
    const localSmartAlertHour = localStorage.getItem('app_smart_match_alert_hour');
    const localChatAlert = localStorage.getItem('app_chat_match_alert');
    const localProviderChatOption = localStorage.getItem('app_provider_chat_match_option');
    const localLang = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);

    if (localTheme) setThemeState(localTheme);
    if (localUnit) setUnitState(localUnit);
    if (localDateFormat) setDateFormatState(localDateFormat);
    if (localTimeFormat) setTimeFormatState(localTimeFormat);
    if (localCurrency) setCurrencyState(localCurrency);
    if (localNewsletter !== null) setNewsletterEnabledState(localNewsletter === 'true');
    if (localSmartAlert !== null) setSmartMatchAlertEnabledState(localSmartAlert === 'true');
    if (localSmartAlertHour !== null) setSmartMatchAlertHourState(localSmartAlertHour === 'null' ? null : Number(localSmartAlertHour));
    if (localChatAlert !== null) setChatMailAlertEnabledState(localChatAlert === 'true');
    if (localProviderChatOption !== null) setProviderChatMailAlertOptionState(localProviderChatOption as any);
    if (localLang) {
      i18n.changeLanguage(localLang);
    }
  }, []); // Run only once on mount to initialize from localStorage

  // Load from Firestore when auth state changes (and user is not test/anonymous)
  useEffect(() => {
    const loadUserSettings = async () => {
      const user = auth.currentUser;
      if (user && !user.isAnonymous && localStorage.getItem('isTestLogin') !== 'true') {
        try {
          console.log(`-> (SettingsContext) Attempting getDoc on path: /users/${user.uid}/settings/preferences`);
          const paramsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
          const snap = await getDoc(paramsRef);
          if (snap.exists()) {
            console.log("-> (SettingsContext) Settings found! Applying...");
            const data = snap.data();
            if (data.theme) {
              setThemeState(data.theme);
              localStorage.setItem('app_theme', data.theme);
            }
            if (data.unit) {
              setUnitState(data.unit);
              localStorage.setItem('app_unit', data.unit);
            }
            if (data.dateFormat) {
              setDateFormatState(data.dateFormat);
              localStorage.setItem('app_date_format', data.dateFormat);
            }
            if (data.timeFormat) {
              setTimeFormatState(data.timeFormat);
              localStorage.setItem('app_time_format', data.timeFormat);
            }
            if (data.currency) {
              setCurrencyState(data.currency);
              localStorage.setItem('app_currency', data.currency);
            }
            if (data.newsletterEnabled !== undefined) {
              setNewsletterEnabledState(data.newsletterEnabled);
              localStorage.setItem('app_newsletter', String(data.newsletterEnabled));
            }
            if (data.smartMatchAlertEnabled !== undefined) {
              setSmartMatchAlertEnabledState(data.smartMatchAlertEnabled);
              localStorage.setItem('app_smart_match_alert', String(data.smartMatchAlertEnabled));
            }
            if (data.chatMailAlertEnabled !== undefined) {
              setChatMailAlertEnabledState(data.chatMailAlertEnabled);
              localStorage.setItem('app_chat_match_alert', String(data.chatMailAlertEnabled));
            }
            if (data.providerChatMailAlertOption !== undefined) {
              setProviderChatMailAlertOptionState(data.providerChatMailAlertOption);
              localStorage.setItem('app_provider_chat_match_option', data.providerChatMailAlertOption);
            }
            if (data.smartMatchAlertHour !== undefined) {
              setSmartMatchAlertHourState(data.smartMatchAlertHour);
              localStorage.setItem('app_smart_match_alert_hour', data.smartMatchAlertHour === null ? 'null' : String(data.smartMatchAlertHour));
            }
            if (data.language) {
              i18n.changeLanguage(data.language);
              localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, data.language);
            }
          } else {
             console.log("-> (SettingsContext) No settings found in Firestore.");
          }
        } catch (error) {
          console.error("-> (SettingsContext) Could not load settings", error);
        }
      }
    };

    const unsubscribe = auth.onAuthStateChanged(loadUserSettings);
    return () => unsubscribe();
  }, []); // auth listener handles its own updates

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t: ThemeType) => {
    setThemeState(t);
    localStorage.setItem('app_theme', t);
  };

  const setUnit = (u: UnitType) => {
    setUnitState(u);
    localStorage.setItem('app_unit', u);
  };

  const setDateFormat = (f: DateFormatType) => {
    setDateFormatState(f);
    localStorage.setItem('app_date_format', f);
  };

  const setTimeFormat = (f: TimeFormatType) => {
    setTimeFormatState(f);
    localStorage.setItem('app_time_format', f);
  };

  const setCurrency = (c: CurrencyType) => {
    setCurrencyState(c);
    localStorage.setItem('app_currency', c);
  };

  const setNewsletterEnabled = (enabled: boolean) => {
    setNewsletterEnabledState(enabled);
    localStorage.setItem('app_newsletter', String(enabled));
  };

  const setSmartMatchAlertEnabled = (enabled: boolean) => {
    setSmartMatchAlertEnabledState(enabled);
    localStorage.setItem('app_smart_match_alert', String(enabled));
  };

  const setSmartMatchAlertHour = (hour: number | null) => {
    setSmartMatchAlertHourState(hour);
    localStorage.setItem('app_smart_match_alert_hour', hour === null ? 'null' : String(hour));
  };

  const setChatMailAlertEnabled = (enabled: boolean) => {
    setChatMailAlertEnabledState(enabled);
    localStorage.setItem('app_chat_match_alert', String(enabled));
  };

  const setProviderChatMailAlertOption = (option: 'only_first_chat_ever' | 'each_seeker_first_chat' | 'always') => {
    setProviderChatMailAlertOptionState(option);
    localStorage.setItem('app_provider_chat_match_option', option);
  };

  const saveSettings = async () => {
    const user = auth.currentUser;
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, i18n.language);
    
    // Only save to firestore if actual user mode
    if (user && !user.isAnonymous && localStorage.getItem('isTestLogin') !== 'true') {
      try {
        const response = await saveUserSettings({
          theme,
          unit,
          dateFormat,
          timeFormat,
          currency,
          newsletterEnabled,
          smartMatchAlertEnabled,
          smartMatchAlertHour,
          chatMailAlertEnabled,
          providerChatMailAlertOption,
          language: i18n.language,
        });

        setSmartMatchAlertHourState(response.smartMatchAlertHour);
        localStorage.setItem(
          'app_smart_match_alert_hour',
          response.smartMatchAlertHour === null ? 'null' : String(response.smartMatchAlertHour)
        );

      } catch (error) {
        console.error("Could not save settings to DB", error);
        throw error;
      }
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      theme, setTheme, 
      unit, setUnit, 
      dateFormat, setDateFormat, 
      timeFormat, setTimeFormat, 
      currency, setCurrency, 
      newsletterEnabled, setNewsletterEnabled,
      smartMatchAlertEnabled, setSmartMatchAlertEnabled,
      smartMatchAlertHour, setSmartMatchAlertHour,
      chatMailAlertEnabled, setChatMailAlertEnabled,
      providerChatMailAlertOption, setProviderChatMailAlertOption,
      exchangeRates, saveSettings 
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

function readStoredSettings(): SettingsContextType {
  const smartMatchAlertHourRaw = localStorage.getItem('app_smart_match_alert_hour');

  return {
    theme: (localStorage.getItem('app_theme') as ThemeType) || 'rustic',
    setTheme: () => {},
    unit: (localStorage.getItem('app_unit') as UnitType) || 'metric',
    setUnit: () => {},
    dateFormat: (localStorage.getItem('app_date_format') as DateFormatType) || 'DD/MM/YYYY',
    setDateFormat: () => {},
    timeFormat: (localStorage.getItem('app_time_format') as TimeFormatType) || '24h',
    setTimeFormat: () => {},
    currency: (localStorage.getItem('app_currency') as CurrencyType) || 'EUR',
    setCurrency: () => {},
    newsletterEnabled: localStorage.getItem('app_newsletter') !== 'false',
    setNewsletterEnabled: () => {},
    smartMatchAlertEnabled: localStorage.getItem('app_smart_match_alert') === 'true',
    setSmartMatchAlertEnabled: () => {},
    smartMatchAlertHour:
      smartMatchAlertHourRaw === null || smartMatchAlertHourRaw === 'null'
        ? null
        : Number(smartMatchAlertHourRaw),
    setSmartMatchAlertHour: () => {},
    chatMailAlertEnabled: localStorage.getItem('app_chat_match_alert') !== 'false',
    setChatMailAlertEnabled: () => {},
    providerChatMailAlertOption:
      (localStorage.getItem('app_provider_chat_match_option') as SettingsContextType['providerChatMailAlertOption']) ||
      'always',
    setProviderChatMailAlertOption: () => {},
    exchangeRates: DEFAULT_EXCHANGE_RATES,
    saveSettings: async () => {},
  };
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context) {
    return context;
  }

  if (import.meta.env.DEV) {
    console.warn('[SettingsContext] useSettings called outside SettingsProvider; using stored defaults.');
  }

  return readStoredSettings();
}

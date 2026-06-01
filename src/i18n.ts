import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
  APP_LANGUAGE_RESOURCES,
  APP_LANGUAGE_CODES,
  APP_LANGUAGE_STORAGE_KEY,
  createAppLanguageFallbackChain,
} from './config/appLanguages';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: APP_LANGUAGE_RESOURCES,
    fallbackLng: createAppLanguageFallbackChain,
    supportedLngs: APP_LANGUAGE_CODES,
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: APP_LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    returnEmptyString: false,
    returnNull: false,
  });

export default i18n;

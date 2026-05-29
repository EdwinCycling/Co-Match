import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import nlBE from './locales/nl-BE.json';
import nl from './locales/nl.json';
import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';

const resources = {
  'nl-BE': { translation: nlBE },
  'nl': { translation: nl },
  'fr': { translation: fr },
  'en': { translation: en },
  'es': { translation: es }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'nl',
    supportedLngs: ['nl-BE', 'nl', 'en', 'fr', 'es'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'app_lang', // Use the same key as our components
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already does escaping
    },
  });

export default i18n;

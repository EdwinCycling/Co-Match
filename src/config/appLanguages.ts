import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import nl from '../locales/nl.json';
import nlBE from '../locales/nl-BE.json';

export type AppLanguageCode = 'nl' | 'nl-BE' | 'en' | 'fr' | 'es';

type TranslationResource = Record<string, unknown>;

export interface AppLanguageDefinition {
  code: AppLanguageCode;
  label: string;
  shortLabel: string;
  translation: TranslationResource;
}

export const APP_LANGUAGE_STORAGE_KEY = 'app_lang';
export const APP_LANGUAGE_FALLBACK: AppLanguageCode = 'nl';

export const APP_LANGUAGES: AppLanguageDefinition[] = [
  {
    code: 'nl',
    label: 'Nederlands',
    shortLabel: 'NL',
    translation: nl,
  },
  {
    code: 'nl-BE',
    label: 'Vlaams',
    shortLabel: 'BE',
    translation: nlBE,
  },
  {
    code: 'en',
    label: 'English',
    shortLabel: 'EN',
    translation: en,
  },
  {
    code: 'fr',
    label: 'Français',
    shortLabel: 'FR',
    translation: fr,
  },
  {
    code: 'es',
    label: 'Español',
    shortLabel: 'ES',
    translation: es,
  },
];

export const APP_LANGUAGE_CODES = APP_LANGUAGES.map((language) => language.code);

export const APP_LANGUAGE_RESOURCES = Object.fromEntries(
  APP_LANGUAGES.map((language) => [
    language.code,
    { translation: language.translation },
  ])
);

export function findAppLanguage(code: string | null | undefined): AppLanguageDefinition | undefined {
  if (!code) return undefined;

  return APP_LANGUAGES.find(
    (language) => code === language.code || code.startsWith(`${language.code}-`)
  );
}

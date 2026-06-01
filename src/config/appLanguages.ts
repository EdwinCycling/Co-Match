export type AppLanguageCode = string;

type TranslationResource = Record<string, unknown>;

export interface AppLanguageDefinition {
  code: AppLanguageCode;
  label: string;
  nativeLabel: string;
  englishLabel: string;
  shortLabel: string;
  searchText: string;
  translation: TranslationResource;
}

const localeModules = import.meta.glob('../locales/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, TranslationResource>;

const LANGUAGE_LABEL_OVERRIDES: Record<string, Partial<AppLanguageDefinition>> = {
  en: { label: 'English', nativeLabel: 'English', englishLabel: 'English', shortLabel: 'EN' },
  nl: { label: 'Nederlands', nativeLabel: 'Nederlands', englishLabel: 'Dutch', shortLabel: 'NL' },
  'nl-BE': { label: 'Vlaams', nativeLabel: 'Vlaams', englishLabel: 'Flemish', shortLabel: 'BE' },
  'pt-br': { label: 'Portugues (Brasil)', nativeLabel: 'Portugues (Brasil)', englishLabel: 'Portuguese (Brazil)', shortLabel: 'BR' },
  'zh-hans': { label: 'Jianti Zhongwen', nativeLabel: 'Jianti Zhongwen', englishLabel: 'Chinese (Simplified)', shortLabel: 'ZH' },
  'zh-tw': { label: 'Fantizi Zhongwen', nativeLabel: 'Fantizi Zhongwen', englishLabel: 'Chinese (Traditional)', shortLabel: 'TW' },
};

export const APP_LANGUAGE_STORAGE_KEY = 'app_lang';
export const APP_LANGUAGE_FALLBACK: AppLanguageCode = 'nl';
export const APP_LANGUAGE_CONTENT_FALLBACK: AppLanguageCode = 'en';

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizeLanguageCode(code: string | null | undefined) {
  if (!code) {
    return '';
  }

  return code
    .replace(/_/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }

      if (part.length === 2) {
        return part.toUpperCase();
      }

      if (part.length === 4) {
        return titleCase(part);
      }

      return part.toLowerCase();
    })
    .join('-');
}

function getLanguageFileCode(filePath: string) {
  const filename = filePath.split('/').pop() || '';
  return filename.replace(/\.json$/i, '');
}

function toDisplayLocale(code: string) {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) {
    return '';
  }

  if (normalized.toLowerCase() === 'zh-hans') {
    return 'zh-Hans';
  }

  if (normalized.toLowerCase() === 'zh-tw') {
    return 'zh-TW';
  }

  return normalized;
}

function getDisplayName(code: string, displayLocale: string) {
  try {
    const displayNames = new Intl.DisplayNames([displayLocale], { type: 'language' });
    return displayNames.of(toDisplayLocale(code)) || '';
  } catch {
    return '';
  }
}

function buildShortLabel(code: string) {
  const parts = code.split('-').filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 1].slice(0, 2).toUpperCase();
  }

  return parts[0]?.slice(0, 2).toUpperCase() || '??';
}

function buildLanguageDefinition(code: string, translation: TranslationResource): AppLanguageDefinition {
  const override = LANGUAGE_LABEL_OVERRIDES[code] || {};
  const englishLabel = override.englishLabel || getDisplayName(code, 'en') || code;
  const nativeLocale = toDisplayLocale(code) || 'en';
  const nativeLabel = override.nativeLabel || getDisplayName(code, nativeLocale) || englishLabel;
  const label = override.label || nativeLabel || englishLabel;
  const shortLabel = override.shortLabel || buildShortLabel(code);

  return {
    code,
    label,
    nativeLabel,
    englishLabel,
    shortLabel,
    searchText: `${code} ${label} ${nativeLabel} ${englishLabel}`.toLowerCase(),
    translation,
  };
}

export const APP_LANGUAGES: AppLanguageDefinition[] = Object.entries(localeModules)
  .map(([filePath, translation]) => buildLanguageDefinition(getLanguageFileCode(filePath), translation))
  .sort((left, right) => {
    if (left.code === APP_LANGUAGE_FALLBACK) return -1;
    if (right.code === APP_LANGUAGE_FALLBACK) return 1;
    if (left.code === APP_LANGUAGE_CONTENT_FALLBACK) return -1;
    if (right.code === APP_LANGUAGE_CONTENT_FALLBACK) return 1;

    return left.label.localeCompare(right.label, 'en', { sensitivity: 'base' });
  });

export const APP_LANGUAGE_CODES = APP_LANGUAGES.map((language) => language.code);

export const APP_LANGUAGE_RESOURCES = Object.fromEntries(
  APP_LANGUAGES.map((language) => [
    language.code,
    { translation: language.translation },
  ])
);

export function findAppLanguage(code: string | null | undefined): AppLanguageDefinition | undefined {
  const normalizedCode = normalizeLanguageCode(code);
  if (!normalizedCode) {
    return undefined;
  }

  return APP_LANGUAGES.find((language) => {
    const normalizedLanguageCode = normalizeLanguageCode(language.code);
    return normalizedCode === normalizedLanguageCode
      || normalizedCode.startsWith(`${normalizedLanguageCode}-`)
      || normalizedLanguageCode.startsWith(`${normalizedCode}-`);
  });
}

export function resolveAppLanguageCode(code: string | null | undefined): AppLanguageCode {
  return findAppLanguage(code)?.code || APP_LANGUAGE_FALLBACK;
}

export function createAppLanguageFallbackChain(code: string | null | undefined) {
  const resolved = resolveAppLanguageCode(code);
  return [...new Set([
    resolved,
    APP_LANGUAGE_CONTENT_FALLBACK,
    APP_LANGUAGE_FALLBACK,
  ])];
}

import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import {
  APP_LANGUAGES,
  AppLanguageCode,
} from '../config/appLanguages';

interface LanguageSelectListProps {
  selectedCode: string;
  onSelect: (languageCode: AppLanguageCode) => void;
  maxHeightClassName?: string;
  showSearch?: boolean;
}

export default function LanguageSelectList({
  selectedCode,
  onSelect,
  maxHeightClassName = 'max-h-80',
  showSearch = true,
}: LanguageSelectListProps) {
  const [query, setQuery] = useState('');

  const filteredLanguages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return APP_LANGUAGES;
    }

    return APP_LANGUAGES.filter((language) => language.searchText.includes(normalizedQuery));
  }, [query]);

  return (
    <div className="space-y-3">
      {showSearch && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search language or code"
            className="w-full bg-surface-container-lowest border border-outline/40 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium text-on-surface outline-none focus:border-primary"
          />
        </div>
      )}

      <div className={`overflow-y-auto pr-1 custom-scrollbar ${maxHeightClassName}`}>
        <div className="space-y-1">
          {filteredLanguages.map((language) => {
            const isSelected = selectedCode === language.code || selectedCode.startsWith(`${language.code}-`);

            return (
              <button
                key={language.code}
                onClick={() => onSelect(language.code)}
                className={`w-full text-left px-4 py-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline/30 bg-surface-container-lowest hover:border-primary/30 hover:bg-primary/5 text-on-surface'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{language.label}</div>
                  <div className="text-[11px] font-medium opacity-70 truncate">
                    {language.englishLabel !== language.label ? `${language.englishLabel} • ` : ''}
                    {language.code}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                    {language.shortLabel}
                  </span>
                  {isSelected && <Check size={16} />}
                </div>
              </button>
            );
          })}

          {filteredLanguages.length === 0 && (
            <div className="px-4 py-6 text-center text-sm font-medium text-on-surface-variant">
              No language found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

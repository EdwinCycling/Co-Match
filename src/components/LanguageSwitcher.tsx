import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Languages } from 'lucide-react';
import {
  APP_LANGUAGE_FALLBACK,
  APP_LANGUAGE_STORAGE_KEY,
  findAppLanguage,
} from '../config/appLanguages';
import LanguageSelectList from './LanguageSelectList';
import { auth } from '../lib/firebase';
import { updateUserLanguage } from '../services/userService';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeLang = i18n.resolvedLanguage || i18n.language || '';
  const currentLang = findAppLanguage(activeLang) || findAppLanguage(APP_LANGUAGE_FALLBACK)!;

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode).then(() => {
      localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, langCode);
      setIsOpen(false);

      if (auth.currentUser) {
        updateUserLanguage(langCode).catch(e => console.warn('Could not sync language:', e));
      }
    }).catch(err => {
      console.error('Error changing language:', err);
      setIsOpen(false);
    });
  };

  const handleMouseEnter = () => {
    if (window.matchMedia('(pointer: fine)').matches) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (window.matchMedia('(pointer: fine)').matches) {
      setIsOpen(false);
    }
  };

  return (
    <div 
       ref={switcherRef}
       className="relative w-fit inline-block text-left"
       onMouseEnter={handleMouseEnter}
       onMouseLeave={handleMouseLeave}
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-2.5 border border-outline/30 text-on-surface hover:bg-surface-container-high transition-all font-bold text-xs cursor-pointer select-none"
      >
        <Languages size={14} />
        <span className="uppercase tracking-widest">{currentLang.shortLabel}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="absolute left-0 md:left-auto md:right-0 top-full pt-2 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-[22rem] bg-surface rounded-2xl shadow-xl border border-outline overflow-hidden p-3"
            >
              <LanguageSelectList
                selectedCode={activeLang}
                onSelect={changeLanguage}
                maxHeightClassName="max-h-96"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

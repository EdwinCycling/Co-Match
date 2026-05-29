import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

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

  const languages = [
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'nl-BE', label: 'Vlaams', flag: '🇧🇪' }
  ];

  const activeLang = i18n.resolvedLanguage || i18n.language || '';
  const currentLang = languages.find(l => activeLang === l.code || activeLang.startsWith(l.code)) || languages[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode).then(() => {
      localStorage.setItem('app_lang', langCode);
      setIsOpen(false);
      
      // Sync with Firestore if logged in (in background)
      import('../lib/firebase').then(({ auth, db }) => {
        if (auth.currentUser) {
          import('firebase/firestore').then(({ doc, updateDoc, serverTimestamp }) => {
            updateDoc(doc(db, 'users', auth.currentUser.uid), {
              language: langCode,
              updatedAt: serverTimestamp()
            }).catch(e => console.warn('Could not sync language:', e));
          });
        }
      });
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
        <span>{currentLang.flag}</span>
        <span className="uppercase tracking-widest">{currentLang.code.split('-')[0]}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="absolute left-0 md:left-auto md:right-0 top-full pt-2 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-48 bg-white rounded-2xl shadow-xl border border-outline overflow-hidden py-2"
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full text-left px-4 py-3 hover:bg-primary/5 text-sm font-bold flex items-center justify-between group ${activeLang.startsWith(lang.code) ? 'text-primary bg-primary/5' : 'text-on-surface'}`}
                >
                  <div className="flex items-center gap-3">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </div>
                  {activeLang.startsWith(lang.code) && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

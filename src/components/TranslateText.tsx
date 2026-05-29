import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { translateText as doTranslate } from '../services/translateService';
import { checkRateLimit } from '../lib/rateLimit';

interface TranslateTextProps {
  text: string;
  className?: string;
}

export default function TranslateText({ text, className = "" }: TranslateTextProps) {
  const { i18n, t } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Map I18n codes to full names for the AI prompt
  const langMap: Record<string, string> = {
    'nl': 'Dutch',
    'nl-BE': 'Dutch (Flemish)',
    'en': 'English',
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese'
  };

  const handleTranslate = async () => {
    if (translatedText) {
      setShowOriginal(!showOriginal);
      return;
    }

    if (!checkRateLimit('translate', 20, 24 * 60 * 60 * 1000)) {
      toast.error(t('common.rate_limit_exceeded', 'Je hebt de limiet bereikt voor deze actie. Probeer het later opnieuw.'));
      return;
    }

    const MAX_CHARS = 2000; // Maximale lengte beperken om tokens te besparen
    const textToTranslate = text;
    
    if (textToTranslate.length > MAX_CHARS) {
        toast.error(t('common.translation_too_long', `Tekst is te lang (max ${MAX_CHARS} tekens)`));
        // We besluiten om af te breken in plaats van half te vertalen, tenzij afkappen gewenst is.
        // We kunnen afkappen om toch de eerste 2000 tekens te vertalen
        // textToTranslate = textToTranslate.substring(0, MAX_CHARS) + "..."; 
        return;
    }

    setIsTranslating(true);
    try {
      const targetLang = langMap[i18n.language] || 'English';
      const result = await doTranslate(textToTranslate, targetLang);
      setTranslatedText(result);
      setShowOriginal(false);
    } catch (error) {
      console.error("Translation failed:", error);
      toast.error(t('common.translation_failed', 'Vertalen is helaas mislukt. Probeer later opnieuw.'));
    } finally {
      setIsTranslating(false);
    }
  };

  if (!text) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative group">
        <AnimatePresence mode="wait">
          <motion.div
            key={showOriginal || !translatedText ? 'original' : 'translated'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-on-surface-variant leading-relaxed text-sm md:text-base whitespace-pre-line"
          >
            {showOriginal || !translatedText ? text : translatedText}
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        onClick={handleTranslate}
        disabled={isTranslating}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
      >
        {isTranslating ? (
          <Loader2 size={14} className="animate-spin" />
        ) : translatedText && !showOriginal ? (
          <Check size={14} />
        ) : (
          <Languages size={14} />
        )}
        
        {isTranslating 
          ? t('common.translating', 'Bezig met vertalen...') 
          : translatedText && !showOriginal 
            ? t('common.translate_show_original', 'Toon origineel')
            : t('common.translate_to_my_lang', 'Vertaal naar mijn taal')
        }
      </button>
    </div>
  );
}

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CREDIT_COSTS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  titleKey: string;
}

export default function GenericInfoModal({ isOpen, onClose, titleKey }: Props) {
  const { t } = useTranslation();

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-background rounded-3xl shadow-2xl z-[101] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-outline">
              <h2 className="text-2xl font-display font-bold text-on-background">{t(titleKey)}</h2>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="text-on-surface-variant leading-relaxed text-lg whitespace-pre-line space-y-4">
                {t(titleKey + '_content', { 
                  defaultValue: t('footer.modal_content'),
                  credits: CREDIT_COSTS.UNLOCK_ALL 
                })}
              </div>
            </div>
            
            <div className="p-6 border-t border-outline flex justify-end bg-surface">
              <button 
                onClick={onClose}
                className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all"
              >
                {t('footer.ok')}
              </button>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}

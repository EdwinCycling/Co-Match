import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Home, Coins, ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { buyExtraPropertyLimitBundle } from '../services/creditService';
import { CREDIT_COSTS } from '../constants';

interface PropertyBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLimit: number;
}

const PropertyBundleModal: React.FC<PropertyBundleModalProps> = ({ isOpen, onClose, currentLimit }) => {
  const { t } = useTranslation();
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;

    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        setCredits(snap.data().credits || 0);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`));

    return () => unsubscribe();
  }, [isOpen]);

  const handleBuy = async () => {
    const cost = CREDIT_COSTS.EXTRA_PROPERTIES_BUNDLE || 25;
    if (credits < cost) {
      toast.error(t('credit.insufficient_credits', 'Onvoldoende credits! Waardeer je credits op.'));
      return;
    }

    setLoading(true);
    try {
      const success = await buyExtraPropertyLimitBundle();
      if (success) {
        onClose();
      }
    } catch (e) {
      console.error(e);
      toast.error('Er is een fout opgetreden.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTopup = () => {
    window.dispatchEvent(new CustomEvent('open-credits-modal'));
  };

  const cost = CREDIT_COSTS.EXTRA_PROPERTIES_BUNDLE || 25;
  const hasEnough = credits >= cost;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-background text-on-background w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-outline overflow-hidden"
          >
            <button
              onClick={onClose}
              className="cm-modal-close-button absolute top-6 right-6 p-2 z-10"
            >
              <X size={20} />
            </button>

            <div className="p-8 md:p-10">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                <Home size={32} />
              </div>

              <h2 className="text-2xl md:text-3xl font-display font-black text-on-background mb-3">
                {t('dashboard.provider.bundle.title', 'Extra woningen toevoegen')}
              </h2>
              
              <p className="text-on-surface-variant font-medium leading-relaxed mb-6">
                {t('dashboard.provider.bundle.desc', 'Je hebt de huidige limiet aan woningen bereikt. Wil je meer woningen plaatsen? Per 3 extra woningen rekenen we een eenmalig tarief van 25 credits.')}
              </p>

              {/* Status Indicator */}
              <div className="bg-surface-container-low border border-outline/30 p-5 rounded-3xl flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 mb-0.5">
                    {t('dashboard.provider.bundle.current_limit', 'Huidige limiet: {{max}} woningen', { max: currentLimit })}
                  </p>
                  <p className="text-xl font-black text-on-surface flex items-center gap-1.5">
                    <Coins className="text-primary" size={20} />
                    {credits} {t('credits.label', 'Credits')}
                  </p>
                </div>
                <span className="px-4 py-2 bg-primary/10 text-primary font-black rounded-xl text-xs uppercase tracking-widest">
                  Cost: {cost} Credits
                </span>
              </div>

              <div className="space-y-4">
                {hasEnough ? (
                  <button
                    onClick={handleBuy}
                    disabled={loading}
                    className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Sparkles size={18} />
                        {t('dashboard.provider.bundle.buy_now', 'Koop 3 extra woningen voor 25 credits')}
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-medium leading-relaxed">
                       {t('dashboard.provider.bundle.insufficient', 'Onvoldoende credits! Je hebt momenteel <strong>{{credits}} credits</strong>. Een bundel kost 25 credits.', { credits: credits })}
                    </div>
                    <button
                      onClick={handleOpenTopup}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs cursor-pointer"
                    >
                      <Coins size={18} />
                      {t('dashboard.provider.bundle.buy_credits', 'Credits aanschaffen')}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl font-bold border-2 border-outline hover:bg-surface-container transition-all text-xs uppercase tracking-widest"
                >
                  {t('dashboard.provider.max_properties_cancel', 'Annuleren')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PropertyBundleModal;

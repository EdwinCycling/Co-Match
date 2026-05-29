import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Coins, X, ArrowRight, Sparkles, ShoppingCart, MessageSquare, Search, BrainCircuit, ShieldCheck, Mic, Users, Home, FileText, GitCompare } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { CREDIT_COSTS, CREDIT_PACKAGES } from '../constants';
import { useCurrencyConverter } from '../hooks/useCurrencyConverter';
import { toast } from 'react-hot-toast';

export default function CreditsFloatingButton() {
  const { t } = useTranslation();
  const currencyConverter = useCurrencyConverter();
  const [credits, setCredits] = useState<number>(0);
  const [showModal, setShowModal] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'seeker' | 'provider' | undefined>();
  const [isShifted, setIsShifted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const userRoleRef = React.useRef<string | null>(null);

  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  useEffect(() => {
    const handleOpenModal = (e?: any) => {
      if (e?.detail?.tab) {
        setModalInitialTab(e.detail.tab);
      } else if (userRoleRef.current === 'huis_aanbieder') {
        setModalInitialTab('provider');
      } else {
        setModalInitialTab('seeker');
      }
      setShowModal(true);
    };
    const handleShift = (e: any) => setIsShifted(e.detail);
    const handleVisibility = (e: any) => setIsVisible(e.detail);
    
    window.addEventListener('open-credits-modal', handleOpenModal);
    window.addEventListener('shift-credits', handleShift);
    window.addEventListener('toggle-credits-visibility', handleVisibility);

    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        setCredits(userData.credits || 0);
        setUserRole(userData.role || null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`));

    return () => {
      window.removeEventListener('open-credits-modal', handleOpenModal);
      window.removeEventListener('shift-credits', handleShift);
      window.removeEventListener('toggle-credits-visibility', handleVisibility);
      unsubscribe();
    };
  }, []);

  const reallyVisible = isVisible && auth.currentUser && (userRole === 'huis_zoeker' || userRole === 'huis_aanbieder');

  return (
    <>
      <AnimatePresence>
        {reallyVisible && (
          /* Floating Button - Visible on Desktop hover, and Mobile Landscape (icon only) */
          <div 
            className={`fixed right-6 md:right-10 z-[40] flex transition-all duration-500 ${isShifted ? 'bottom-28 md:bottom-32' : 'bottom-6 md:bottom-10'}`}
          >
            <motion.button
              initial="hidden"
              animate="visible"
              exit="hidden"
              whileHover="hover"
              whileTap="tap"
              variants={{
                hidden: { opacity: 0, scale: 0.5, y: 20 },
                visible: { opacity: 1, scale: 1, y: 0 },
                hover: { opacity: 1, scale: 1, y: 0 },
                tap: { scale: 0.95 }
              }}
              onClick={() => setShowModal(true)}
              className="bg-white text-primary p-1.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] flex flex-row-reverse items-center border-2 border-primary/10 hover:border-primary/30 transition-all font-black text-sm group overflow-hidden cursor-pointer"
            >
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white group-hover:rotate-12 transition-transform shrink-0 shadow-lg">
            <Coins size={24} />
          </div>
          
          <motion.div
            variants={{
              hidden: { width: 0, opacity: 0, marginRight: 0, paddingLeft: 0 },
              visible: { width: 0, opacity: 0, marginRight: 0, paddingLeft: 0 },
              hover: { width: "auto", opacity: 1, marginRight: 12, paddingLeft: 24 }
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex items-center whitespace-nowrap overflow-hidden"
          >
            <div className="flex flex-col items-end leading-none">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black opacity-60 mb-0.5">
                {t('credits.your_balance', 'Your Balance')}
              </span>
              <span className="text-on-background uppercase tracking-widest text-sm font-black">
                {credits} {t('credits.label', 'Credits')}
              </span>
            </div>
          </motion.div>
        </motion.button>
      </div>
      )}
    </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <CreditsModal 
            credits={credits} 
            initialTab={modalInitialTab}
            onClose={() => setShowModal(false)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}

import { createPortal } from 'react-dom';

function CreditsModal({ credits, onClose, initialTab }: { credits: number, onClose: () => void, initialTab?: 'seeker' | 'provider' }) {
  const { t } = useTranslation();
  const [activePricingTab, setActivePricingTab] = useState<'seeker' | 'provider'>(initialTab || 'seeker');
  const currencyConverter = useCurrencyConverter();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleBuyPack = async (packId: string) => {
    // Fake Stripe flow: direct credits update for now
    const pack = CREDIT_PACKAGES.find(p => p.id === packId);
    if (!pack) return;

    try {
      const { addCredits } = await import('../services/creditService');
      const success = await addCredits(pack.credits, `Purchased ${t(pack.labelKey)}`);
      if (success) {
        toast.success(`Succesvol ${pack.credits} credits aangeschaft!`);
        onClose(); // Sluit modal zodat ze verder kunnen gaan met ontgrendelen
      } else {
        toast.error('Kan credits niet toevoegen, log eerst in.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Er ging iets fout!');
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-[3rem] w-full max-w-xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] border border-outline"
      >
        {/* Header */}
        <div className="p-8 border-b border-outline/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <Coins size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-display font-black text-on-background uppercase tracking-tight">{t('credits.modal_title', 'My Credits')}</h2>
              <p className="text-on-surface-variant font-medium text-sm">{t('credits.modal_desc', 'Manage your balance and unlock options')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-surface-container rounded-full transition-all text-on-surface-variant"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-10">
          {/* Current Balance Card */}
          <div className="bg-primary p-8 rounded-[2.5rem] text-white flex flex-col items-center justify-center gap-4 relative overflow-hidden shadow-xl shadow-primary/20">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
             <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-12 -mb-12" />
             
             <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{t('credit.current_balance')}</span>
             <div className="flex items-center gap-4">
                <Coins size={48} className="text-white/40" />
                <span className="text-6xl font-black">{credits}</span>
             </div>
          </div>

          {/* Cost Info Section with Beautiful Seeker/Provider Pricing Toggle Switch */}
          <div className="space-y-6">
            <div className="flex bg-surface-container-high p-1.5 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setActivePricingTab('seeker')}
                className={`flex-1 py-3 text-center rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                  activePricingTab === 'seeker'
                    ? 'bg-white text-primary shadow-sm font-black'
                    : 'text-on-surface-variant hover:text-on-surface font-bold'
                }`}
              >
                {t('how_it_works.tabs.seeker', 'Ik zoek een woning')}
              </button>
              <button
                type="button"
                onClick={() => setActivePricingTab('provider')}
                className={`flex-1 py-3 text-center rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                  activePricingTab === 'provider'
                    ? 'bg-white text-primary shadow-sm font-black'
                    : 'text-on-surface-variant hover:text-on-surface font-bold'
                }`}
              >
                {t('how_it_works.tabs.provider', 'Ik heb een woning')}
              </button>
            </div>

            <div className="bg-slate-950 text-white p-8 rounded-[2rem] space-y-4 shadow-xl border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Coins size={120} />
              </div>
              {activePricingTab === 'seeker' ? (
                <>
                  <h4 className="font-black uppercase text-xs tracking-widest border-b border-white/10 pb-4 text-primary">
                    {t('how_it_works.seeker.costs.title', 'Prijsmodel Zoeker')}
                  </h4>
                  <div className="space-y-4 text-xs text-slate-300">
                    <div className="flex justify-between items-start gap-4">
                      <span className="leading-relaxed">{t('how_it_works.seeker.costs.free')}</span>
                      <span className="text-primary font-black uppercase tracking-widest shrink-0 text-[10px] bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        {t('common.free', 'Gratis')}
                      </span>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex justify-between items-start gap-4">
                      <span className="leading-relaxed">{t('how_it_works.seeker.costs.premium')}</span>
                      <span className="text-slate-200 font-extrabold whitespace-nowrap shrink-0 text-[10px] bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                        25 credits
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="font-black uppercase text-xs tracking-widest border-b border-white/10 pb-4 text-primary">
                    {t('how_it_works.provider.costs.title', 'Prijsmodel Aanbieder')}
                  </h4>
                  <div className="space-y-4 text-xs text-slate-300">
                    <div className="flex justify-between items-start gap-4">
                      <span className="leading-relaxed">{t('how_it_works.provider.costs.free')}</span>
                      <span className="text-primary font-black uppercase tracking-widest shrink-0 text-[10px] bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        {t('common.free', 'Gratis')}
                      </span>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex flex-col gap-1">
                      <span className="leading-relaxed text-slate-400">{t('how_it_works.provider.costs.trust')}</span>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex justify-between items-start gap-4">
                      <span className="leading-relaxed">{t('how_it_works.provider.costs.premium')}</span>
                      <span className="text-slate-200 font-extrabold whitespace-nowrap shrink-0 text-[10px] bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                        25 credits
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {t('credit.info_more') && (
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed italic p-4 bg-surface-container-low rounded-2xl border border-outline/10">
                {t('credit.info_more')}
              </p>
            )}
          </div>

          {/* Pricing Pack */}
          <div className="space-y-4 pt-4 border-t border-outline/30">
             <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
               <ShoppingCart size={16} className="text-primary" />
               {t('credit.topup_credits')}
             </h3>
             {CREDIT_PACKAGES.map(pack => (
               <button 
                 key={pack.id}
                 onClick={() => handleBuyPack(pack.id)}
                 className="w-full group p-6 bg-surface-container-highest rounded-2xl border-2 border-transparent hover:border-primary transition-all text-left flex items-center justify-between shadow-sm hover:shadow-md"
               >
                 <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Coins size={28} />
                   </div>
                   <div>
                      <h4 className="font-black text-lg text-on-surface">{t(pack.labelKey)}</h4>
                      <p className="text-sm font-bold text-primary">{pack.credits} {t('credits.label', 'Credits')}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-on-surface">{currencyConverter.formatEur(pack.price)}</span>
                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform shadow-lg shadow-primary/20">
                       <ArrowRight size={20} />
                    </div>
                 </div>
                </button>
             ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-outline/30 flex justify-end bg-surface-container-lowest">
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-surface-container hover:bg-surface-container-high rounded-xl font-bold transition-all text-on-surface text-sm uppercase tracking-widest"
          >
            {t('common.close', 'Sluiten')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

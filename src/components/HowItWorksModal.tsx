import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Home, 
  Search, 
  UserPlus, 
  ShieldCheck, 
  MessageSquare, 
  Dna, 
  MousePointer2, 
  Layout, 
  Wallet,
  CheckCircle2,
  Lock,
  ArrowRight,
  HelpingHand
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'seeker' | 'provider';
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, initialTab = 'seeker' }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'seeker' | 'provider'>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setActiveTab(initialTab);
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
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
            className="relative w-full max-w-5xl max-h-[90vh] bg-background text-on-background rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-outline/20 shrink-0 bg-surface/80 backdrop-blur-sm">
              <h2 className="text-2xl font-black tracking-tight text-on-background">
                {t('how_it_works.modal.title')}
              </h2>
              <button 
                onClick={onClose}
                className="p-2 text-on-surface-variant hover:text-on-background hover:bg-surface-container rounded-full transition-colors"
                id="close-how-it-works-modal"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-surface-container mx-6 mt-6 rounded-2xl shrink-0">
              <button
                onClick={() => setActiveTab('seeker')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'seeker' 
                    ? 'bg-surface text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                id="tab-how-it-works-seeker"
              >
                <Search size={18} />
                {t('how_it_works.tabs.seeker')}
              </button>
              <button
                onClick={() => setActiveTab('provider')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'provider' 
                    ? 'bg-surface text-secondary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                id="tab-how-it-works-provider"
              >
                <Home size={18} />
                {t('how_it_works.tabs.provider')}
              </button>
            </div>

            {/* Scrollable Content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 space-y-12">
              <AnimatePresence mode="wait">
                {activeTab === 'seeker' ? (
                  <motion.div
                    key="seeker-content"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-16 pb-10"
                  >
                    {/* Header Section */}
                    <div className="max-w-2xl space-y-6">
                      <h3 className="text-4xl font-black text-on-background tracking-tight leading-none">
                        {t('how_it_works.seeker.title')}
                      </h3>
                      <p className="text-xl text-on-surface-variant leading-relaxed">
                        {t('how_it_works.seeker.intro')}
                      </p>
                    </div>

                    {/* Steps */}
                    <div className="space-y-24">
                      {/* Step 1 */}
                      <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div className="space-y-8">
                          <div className="inline-flex items-center gap-4">
                            <span className="flex items-center justify-center w-10 h-10 bg-primary text-on-primary rounded-full font-black text-lg shadow-lg shadow-primary/20">1</span>
                            <h4 className="text-2xl font-black text-on-background uppercase tracking-wide">{t('how_it_works.seeker.step1.title')}</h4>
                          </div>
                          <div className="space-y-4">
                            <div className="flex gap-4 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                              <Dna className="text-primary shrink-0" size={24} />
                              <p className="text-on-surface leading-relaxed">{t('how_it_works.seeker.step1.desc1')}</p>
                            </div>
                            <div className="flex gap-4 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                              <UserPlus className="text-primary shrink-0" size={24} />
                              <p className="text-on-surface leading-relaxed">{t('how_it_works.seeker.step1.desc2')}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-primary/5 border-2 border-primary/10 rounded-[2rem] p-8 space-y-6">
                          <div className="flex items-center gap-4 text-primary mb-4">
                            <CheckCircle2 size={32} />
                            <h5 className="text-lg font-black uppercase tracking-widest">{t('how_it_works.seeker.types.title')}</h5>
                          </div>
                          <div className="space-y-3">
                            {[
                              'how_it_works.seeker.types.cohousing',
                              'how_it_works.seeker.types.hospita',
                              'how_it_works.seeker.types.sublet',
                              'how_it_works.seeker.types.expat',
                              'how_it_works.seeker.types.free',
                            ].map((key) => (
                              <div key={key} className="flex gap-3 text-sm text-on-surface bg-surface p-3 rounded-xl shadow-sm border border-primary/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>{t(key)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="relative order-2 md:order-1">
                          <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
                          <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-surface shadow-2xl bg-surface-container flex items-center justify-center p-8">
                             <div className="flex flex-col items-center gap-4">
                               <div className="flex gap-2">
                                  <motion.div animate={{ x: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="w-12 h-16 bg-surface rounded-xl shadow-lg border border-outline/20" />
                                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0.5 }} className="w-12 h-16 bg-primary rounded-xl shadow-xl border-2 border-surface -translate-y-2" />
                                  <motion.div animate={{ x: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2, delay: 1 }} className="w-12 h-16 bg-surface rounded-xl shadow-lg border border-outline/20" />
                               </div>
                               <p className="font-black text-primary uppercase text-[10px] tracking-[0.2em]">Match Discovery</p>
                             </div>
                          </div>
                        </div>
                        <div className="space-y-8 order-1 md:order-2">
                          <div className="inline-flex items-center gap-4">
                            <span className="flex items-center justify-center w-10 h-10 bg-primary text-on-primary rounded-full font-black text-lg shadow-lg shadow-primary/20">2</span>
                            <h4 className="text-2xl font-black text-on-background uppercase tracking-wide">{t('how_it_works.seeker.step2.title')}</h4>
                          </div>
                          <div className="space-y-6">
                            <div className="flex gap-4 items-start">
                              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                <MousePointer2 size={24} />
                              </div>
                              <div>
                                <p className="text-on-surface leading-relaxed">{t('how_it_works.seeker.step2.desc1')}</p>
                              </div>
                            </div>
                            <div className="flex gap-4 items-start">
                              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                <Search size={24} />
                              </div>
                              <div>
                                <p className="text-on-surface leading-relaxed">{t('how_it_works.seeker.step2.desc2')}</p>
                              </div>
                            </div>
                            <div className="flex gap-4 items-start">
                              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                <HelpingHand size={24} />
                              </div>
                              <div>
                                <p className="text-on-surface leading-relaxed">{t('how_it_works.seeker.step2.desc3')}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="bg-surface-container-low rounded-[3rem] p-10 border border-outline/20">
                        <div className="grid md:grid-cols-2 gap-16">
                          <div className="space-y-8">
                            <div className="inline-flex items-center gap-4">
                              <span className="flex items-center justify-center w-10 h-10 bg-primary text-on-primary rounded-full font-black text-lg shadow-lg shadow-primary/20">3</span>
                              <h4 className="text-2xl font-black text-on-background uppercase tracking-wide">{t('how_it_works.seeker.step3.title')}</h4>
                            </div>
                            <div className="space-y-6 text-lg text-on-surface-variant leading-relaxed">
                              <p className="font-medium text-on-surface">{t('how_it_works.seeker.step3.desc1')}</p>
                              <div className="space-y-4">
                                <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                                   <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                   {t('how_it_works.seeker.step3.desc2')}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                                   <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                   {t('how_it_works.seeker.step3.desc3')}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                             <div className="bg-surface p-6 rounded-3xl border border-outline/20 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-black text-on-background uppercase text-xs tracking-widest">{t('how_it_works.seeker.features.title')}</h5>
                                  <CheckCircle2 className="text-green-500" size={20} />
                                </div>
                                <div className="space-y-3">
                                   <div className="p-3 bg-green-50 rounded-xl text-xs font-bold text-green-700 flex items-center gap-2">
                                      <Dna size={14} />
                                      {t('how_it_works.seeker.features.factor')}
                                   </div>
                                   <div className="p-3 bg-blue-50 rounded-xl text-xs font-bold text-blue-700 flex items-center gap-2">
                                      <MessageSquare size={14} />
                                      {t('how_it_works.seeker.features.ghosting')}
                                   </div>
                                </div>
                             </div>

                             <div className="bg-gray-900 text-white p-8 rounded-[2rem] space-y-4">
                                <h5 className="font-black uppercase text-sm tracking-widest border-b border-white/10 pb-4">{t('how_it_works.seeker.costs.title')}</h5>
                                <div className="space-y-4 text-xs text-gray-400">
                                   <div className="flex justify-between items-start">
                                      <span className="leading-relaxed">{t('how_it_works.seeker.costs.free')}</span>
                                      <span className="text-primary font-black uppercase tracking-tighter ml-4 shrink-0">{t('common.free', 'Gratis')}</span>
                                   </div>
                                   <div className="pt-4 border-t border-white/10 flex justify-between items-start">
                                      <span className="leading-relaxed">{t('how_it_works.seeker.costs.premium')}</span>
                                      <span className="text-gray-300 font-bold whitespace-nowrap ml-4 shrink-0">25 credits</span>
                                   </div>
                                </div>
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Seeker Control Footer */}
                    <div className="bg-gray-900 text-white p-10 rounded-[2.5rem] relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/3 -translate-y-1/3">
                          <ShieldCheck size={260} />
                       </div>
                       <div className="relative z-10 space-y-6 max-w-xl">
                          <h4 className="text-3xl font-black">{t('how_it_works.seeker.control.title')}</h4>
                          <p className="text-xl text-gray-400 leading-relaxed">{t('how_it_works.seeker.control.desc')}</p>
                       </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="provider-content"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-16 pb-10"
                  >
                    {/* Header */}
                    <div className="max-w-2xl space-y-6">
                      <h3 className="text-4xl font-black text-on-background tracking-tight leading-none">
                        {t('how_it_works.provider.title')}
                      </h3>
                      <p className="text-xl text-on-surface-variant leading-relaxed">
                        {t('how_it_works.provider.intro')}
                      </p>
                    </div>

                    {/* Step - detailed provider steps */}
                    <div className="space-y-24">
                      {/* Step 1 */}
                      <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div className="space-y-8">
                          <div className="inline-flex items-center gap-4">
                            <span className="flex items-center justify-center w-10 h-10 bg-secondary text-on-primary rounded-full font-black text-lg">1</span>
                            <h4 className="text-2xl font-black text-on-background uppercase tracking-wide">{t('how_it_works.provider.step1.title')}</h4>
                          </div>
                          <div className="space-y-4">
                            <div className="flex gap-4 p-5 bg-surface-container-low rounded-2xl border border-outline/20">
                              <Layout className="text-secondary shrink-0" size={24} />
                              <p className="text-on-surface leading-relaxed">{t('how_it_works.provider.step1.desc1')}</p>
                            </div>
                            <div className="flex gap-4 p-5 bg-surface-container-low rounded-2xl border border-outline/20">
                              <Dna className="text-secondary shrink-0" size={24} />
                              <p className="text-on-surface leading-relaxed">{t('how_it_works.provider.step1.desc2')}</p>
                            </div>
                            <div className="flex gap-4 p-5 bg-surface-container-low rounded-2xl border border-outline/20">
                              <UserPlus className="text-secondary shrink-0" size={24} />
                              <p className="text-on-surface leading-relaxed">{t('how_it_works.provider.step1.desc3')}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-secondary/5 border-2 border-secondary/10 rounded-[2rem] p-8 space-y-6">
                          <div className="flex items-center gap-4 text-secondary mb-4">
                            <CheckCircle2 size={32} />
                            <h5 className="text-lg font-black uppercase tracking-widest">{t('how_it_works.provider.types.title')}</h5>
                          </div>
                          <div className="space-y-3">
                            {[
                              'how_it_works.provider.types.cohousing',
                              'how_it_works.provider.types.hospita',
                              'how_it_works.provider.types.sublet',
                              'how_it_works.provider.types.expat',
                              'how_it_works.provider.types.free',
                            ].map((key) => (
                              <div key={key} className="flex gap-3 text-sm text-on-surface bg-surface p-3 rounded-xl shadow-sm border border-secondary/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 shrink-0" />
                                <span>{t(key)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="relative order-2 md:order-1">
                          <div className="absolute inset-0 bg-secondary/20 blur-[100px] rounded-full" />
                          <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-surface shadow-2xl bg-surface-container flex items-center justify-center p-8">
                            <div className="text-center space-y-4">
                              <MousePointer2 className="mx-auto text-secondary animate-bounce" size={48} />
                              <p className="font-black text-secondary uppercase tracking-widest">Interactive Selection</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-8 order-1 md:order-2">
                          <div className="inline-flex items-center gap-4">
                            <span className="flex items-center justify-center w-10 h-10 bg-secondary text-on-primary rounded-full font-black text-lg">2</span>
                            <h4 className="text-2xl font-black text-on-background uppercase tracking-wide">{t('how_it_works.provider.step2.title')}</h4>
                          </div>
                          <div className="space-y-6">
                            <div className="group">
                              <p className="text-lg text-on-surface-variant mb-2 font-medium">{t('how_it_works.provider.step2.desc1')}</p>
                            </div>
                            <div className="flex gap-4 items-start">
                              <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                                <ShieldCheck size={24} />
                              </div>
                              <div>
                                <p className="text-on-surface leading-relaxed">{t('how_it_works.provider.step2.desc2')}</p>
                              </div>
                            </div>
                            <div className="flex gap-4 items-start">
                              <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                                <MessageSquare size={24} />
                              </div>
                              <div>
                                <p className="text-on-surface leading-relaxed">{t('how_it_works.provider.step2.desc3')}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="bg-surface-container-low rounded-[3rem] p-10 border border-outline/20">
                        <div className="grid md:grid-cols-2 gap-16">
                          <div className="space-y-8">
                            <div className="inline-flex items-center gap-4">
                              <span className="flex items-center justify-center w-10 h-10 bg-secondary text-on-primary rounded-full font-black text-lg">3</span>
                              <h4 className="text-2xl font-black text-on-background uppercase tracking-wide">{t('how_it_works.provider.step3.title')}</h4>
                            </div>
                            <div className="space-y-6 text-lg text-on-surface-variant leading-relaxed">
                              <p>{t('how_it_works.provider.step3.desc1')}</p>
                              <div className="flex items-center gap-3 text-secondary font-black bg-surface py-3 px-5 rounded-2xl border border-secondary/20 self-start inline-flex">
                                <Lock size={20} />
                                {t('how_it_works.provider.step3.desc2')}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface p-6 rounded-3xl border border-outline/20 shadow-sm space-y-4">
                              <Dna className="text-secondary" size={24} />
                              <h5 className="font-black text-on-background uppercase text-xs tracking-widest">Double Matching</h5>
                              <p className="text-xs text-on-surface-variant leading-relaxed">{t('how_it_works.provider.control.double_match')}</p>
                            </div>
                            <div className="bg-surface p-6 rounded-3xl border border-outline/20 shadow-sm space-y-4">
                              <X className="text-rose-500" size={24} />
                              <h5 className="font-black text-on-background uppercase text-xs tracking-widest">Direct Control</h5>
                              <p className="text-xs text-on-surface-variant leading-relaxed">{t('how_it_works.provider.control.pause')}</p>
                            </div>
                            <div className="col-span-2 bg-gray-900 text-white p-6 rounded-3xl space-y-4">
                              <h5 className="font-black uppercase text-sm tracking-widest border-b border-white/10 pb-4">{t('how_it_works.provider.costs.title')}</h5>
                              <div className="space-y-4 text-xs text-gray-400">
                                <div className="flex justify-between items-start">
                                  <span className="leading-relaxed">{t('how_it_works.provider.costs.free')}</span>
                                  <span className="text-primary font-black uppercase tracking-tighter ml-4 shrink-0">{t('common.free', 'Gratis')}</span>
                                </div>
                                <div className="pt-4 border-t border-white/10 flex flex-col gap-1">
                                  <span className="leading-relaxed text-gray-300">{t('how_it_works.provider.costs.trust')}</span>
                                </div>
                                <div className="pt-4 border-t border-white/10 flex justify-between items-start">
                                   <span className="leading-relaxed">{t('how_it_works.provider.costs.premium')}</span>
                                   <span className="text-gray-300 font-bold whitespace-nowrap ml-4 shrink-0">25 credits</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pro Tip */}
                    <div className="bg-primary/5 rounded-3xl p-8 border border-primary/20 flex flex-col md:flex-row gap-8 items-center">
                      <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center text-primary shadow-sm shrink-0 border border-primary/10">
                        <ArrowRight size={32} />
                      </div>
                      <div className="flex-1 text-center md:text-left space-y-2">
                        <h4 className="text-lg font-black text-on-background uppercase tracking-widest">{t('how_it_works.provider.tip.title')}</h4>
                        <p className="text-on-surface-variant leading-relaxed">
                          {t('how_it_works.provider.tip.body')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-outline/20 flex justify-end shrink-0 bg-surface/80">
               <button 
                onClick={onClose}
                className="px-8 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-colors"
                id="cta-close-modal"
               >
                 {t('common.close')}
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

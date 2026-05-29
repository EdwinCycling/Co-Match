import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { HowItWorksModal } from './HowItWorksModal';
import { ArrowRight, HelpingHand, Search, Home, ShieldCheck } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'seeker' | 'provider'>('seeker');

  const openModal = (tab: 'seeker' | 'provider') => {
    setInitialTab(tab);
    setModalOpen(true);
  };

  return (
    <section className="py-24 bg-white relative overflow-hidden" id="how-it-works-section">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gray-50 -skew-x-12 translate-x-1/4 -z-10" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Text Content */}
          <div className="space-y-10">
            <div className="inline-block px-6 py-2 bg-primary/10 text-primary rounded-full text-sm font-black uppercase tracking-widest">
              Ontdek de revolutie
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight">
              {t('how_it_works.teaser.title')}
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed max-w-3xl mx-auto px-4">
              {t('how_it_works.teaser.subtitle')} 
              <span className="block mt-6 text-gray-400 text-lg md:text-xl font-medium">
                Geen eindeloze rijen contacten, maar diepgaande connecties die verder gaan dan alleen een dak boven je hoofd.
              </span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-6">
              <button
                onClick={() => openModal('seeker')}
                className="group flex items-center justify-between gap-6 px-10 py-5 bg-gray-900 text-white rounded-[2rem] font-bold transition-all hover:bg-gray-800 hover:-translate-y-1 shadow-2xl shadow-gray-200"
                id="how-it-works-cta-seeker"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                    <Search size={22} />
                  </div>
                  <span className="text-lg">{t('how_it_works.tabs.seeker')}</span>
                </div>
                <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => openModal('provider')}
                className="group flex items-center justify-between gap-6 px-10 py-5 bg-white text-gray-900 rounded-[2rem] font-bold transition-all hover:bg-gray-50 border-2 border-gray-100 hover:-translate-y-1 shadow-xl hover:border-primary/20"
                id="how-it-works-cta-provider"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gray-100 rounded-xl group-hover:bg-secondary/20 transition-colors">
                    <Home size={22} />
                  </div>
                  <span className="text-lg">{t('how_it_works.tabs.provider')}</span>
                </div>
                <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
          </div>
        </div>
      </div>

      <HowItWorksModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        initialTab={initialTab}
      />
    </section>
  );
};

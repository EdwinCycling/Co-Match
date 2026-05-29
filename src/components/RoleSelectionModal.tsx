import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Home, Search, Heart, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

interface RoleSelectionModalProps {
  onSelectRole: (role: string) => void;
  onLogout: () => void;
  userName: string;
}

export default function RoleSelectionModal({ onSelectRole, onLogout, userName }: RoleSelectionModalProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleSelect = async (role: string) => {
    setIsSubmitting(true);
    try {
      await onSelectRole(role);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-background rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative border border-outline"
      >
        {/* Language switcher absolute in top-right corner of the modal */}
        <div className="absolute top-6 right-6 z-50">
          <LanguageSwitcher />
        </div>

        <div className="flex flex-col md:flex-row overflow-hidden rounded-[2.5rem]">
          {/* Welcome Text Section */}
          <div className="p-8 md:p-12 md:w-1/2 flex flex-col justify-center bg-surface-container-lowest">
            <div className="w-16 h-16 bg-primary-container text-primary rounded-2xl flex items-center justify-center mb-6">
              <Heart size={32} />
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-black text-on-background mb-4">
              {t('role.welcome_title', 'Welkom bij Co-Math!')}
            </h2>
            <p className="text-on-surface-variant font-medium text-lg mb-6 leading-relaxed">
              {t('role.welcome_desc', 'We zijn ontzettend blij dat je er bent. Samen bouwen we aan een nieuwe manier van wonen en samenleven.')}
            </p>
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-8 h-8 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <p className="text-sm font-medium text-on-surface-variant">{t('role.feat_connection', 'Co-housing helpt de verbinding te maken op een eenvoudige manier waarbij jouw persoonlijke voorkeuren de boventoon voeren.')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <p className="text-sm font-medium text-on-surface-variant">{t('role.feat_housing_shortage', 'Door woningen te delen pakken we samen de woningnood aan op een leuke, duurzame en slimme manier.')}</p>
              </div>
            </div>
          </div>

          {/* Action Section */}
          <div className="p-8 md:p-12 md:w-1/2 flex flex-col justify-center bg-white border-l border-outline/30">
            <h3 className="font-display text-xl font-bold text-on-surface mb-6">{t('role.question', 'Hoe wil je Co-Match gebruiken?')}</h3>
            
            <div className="flex flex-col gap-4">
              <button 
                disabled={isSubmitting}
                onClick={() => handleSelect('huis_zoeker')}
                className="group w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-outline hover:border-primary transition-all text-left bg-surface-container-lowest hover:bg-primary/5 relative overflow-hidden disabled:opacity-50"
              >
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Search size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-on-surface">{t('role.seeker_title', 'Ik ben op zoek naar een woning.')}</h4>
                  <p className="text-sm text-on-surface-variant font-medium">{t('role.seeker_desc', 'Ik ben op zoek naar een woning of co-housing project.')}</p>
                </div>
              </button>

              <button 
                disabled={isSubmitting}
                onClick={() => handleSelect('huis_aanbieder')}
                className="group w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-outline hover:border-secondary transition-all text-left bg-surface-container-lowest hover:bg-secondary/5 relative overflow-hidden disabled:opacity-50"
              >
                <div className="w-14 h-14 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Home size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-on-surface">{t('role.provider_title', 'Ik wil een woonruimte aanbieden.')}</h4>
                  <p className="text-sm text-on-surface-variant font-medium">{t('role.provider_desc', 'Ik heb een woning of kamer beschikbaar om te delen.')}</p>
                </div>
              </button>
            </div>

            <p className="mt-8 text-xs text-on-surface-variant/70 font-medium leading-relaxed italic text-center">
               {t('role.footer_note', '* Let op: Op dit moment kun je per account maximaal één rol aannemen in ons platform. We doen dit om ervaringen veilig en gefocust te houden. Je kunt deze keuze later niet eenvoudig terugdraaien.')}
            </p>

            <button 
              onClick={onLogout}
              className="mt-8 text-sm font-bold text-on-surface-variant/60 hover:text-error transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <span>{t('nav.logout', 'Log uit')}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

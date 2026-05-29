import React, { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Mail, Linkedin, Camera, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';

interface TrustBadgeProps {
  level: number; // 1 to 4
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ level, size = 'sm', className = '', onClick }) => {
  const { t } = useTranslation();
  const Icon = level >= 3 ? ShieldCheck : level === 2 ? Shield : ShieldAlert;
  const colorClass = level >= 3 ? 'text-green-500 bg-green-500/10' : level === 2 ? 'text-blue-500 bg-blue-500/10' : 'text-gray-500 bg-gray-500/10';
  const sizeClass = size === 'sm' ? 'px-2 py-1 flex-row text-[10px]' : size === 'md' ? 'px-3 py-1.5 flex-row text-xs' : 'px-4 py-2 flex-col justify-center text-sm w-full';
  const iconSize = size === 'sm' ? 12 : size === 'md' ? 16 : 32;
  const label = level === 4 
    ? t('verification.level4.name', 'Identity Checked') 
    : level === 3 
      ? t('verification.level3.name', 'Live Verified') 
      : level === 2 
        ? t('verification.level2.name', 'Professional') 
        : t('verification.level1.name', 'Standard');

  return (
    <div 
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-105 ${colorClass} ${sizeClass} ${className}`}
      title={t('verification.click_to_view', 'Meer info over verificatie')}
    >
      <Icon size={iconSize} />
      <span>{label}</span>
    </div>
  );
};

export const TrustPopup: React.FC<{ isOpen: boolean, onClose: () => void; providerLevel: number }> = ({ isOpen, onClose, providerLevel }) => {
  const { t } = useTranslation();

  React.useEffect(() => {
     if (isOpen) {
        document.body.style.overflow = 'hidden';
     } else {
        document.body.style.overflow = 'unset';
     }
     return () => {
        document.body.style.overflow = 'unset';
     };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface w-full max-w-lg rounded-3xl p-8 relative shadow-2xl border border-outline/10 text-on-surface text-center overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
           <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-surface-container rounded-full hover:bg-surface-container-high transition-colors">
              <Check size={20} />
           </button>
           <div className="mb-6 inline-flex p-4 rounded-full bg-primary/10 text-primary">
              <ShieldCheck size={40} />
           </div>
           <h2 className="text-2xl font-black mb-2">{t('verification.title', 'De Trust Ladder')}</h2>
           <p className="text-sm font-medium text-on-surface-variant mb-8 leading-relaxed">
             {t('verification.desc', 'Wij bestrijden fraude door woningaanbieders te verplichten hun betrouwbaarheid te bewijzen. Hoe hoger het niveau, hoe veiliger de keuze.')}
           </p>

           <div className="space-y-4 text-left">
              {[
                  { level: 1, label: t('verification.level1.name', 'Standard'), desc: t('verification.level1.desc', 'Geregistreerd via Google of e-mail. Dit is de basis.'), icon: Mail, achieved: providerLevel >= 1 },
                  { level: 2, label: t('verification.level2.name', 'Professional'), desc: t('verification.level2.desc', 'Zakelijke of professionele identiteit gekoppeld met LinkedIn. Minder kans op bots.'), icon: Linkedin, achieved: providerLevel >= 2 },
                  { level: 3, label: t('verification.level3.name', 'Live Verified'), desc: t('verification.level3.desc', 'Heeft via de app live toegang tot de woning/facturen bewezen met AI anti-fraude check.'), icon: Camera, achieved: providerLevel >= 3 },
                  { level: 4, label: t('verification.level4.name', 'Identity Check'), desc: t('verification.level4.desc', 'Officiële check met paspoort en selfie (Coming Soon).'), icon: ShieldCheck, achieved: providerLevel >= 4 },
              ].map(lvl => (
                 <div key={lvl.level} className={`p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${lvl.achieved ? 'border-primary bg-primary/5' : 'border-outline/10 bg-surface-container-lowest opacity-60'}`}>
                    <div className={`p-2 rounded-xl mt-1 ${lvl.achieved ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                       <lvl.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm tracking-wide uppercase">{lvl.label} {lvl.level === 4 && <span className="text-[10px] text-primary bg-primary/20 px-2 py-0.5 rounded-full ml-2 lowercase">coming soon</span>}</h4>
                        {lvl.achieved && <Check size={14} className="text-primary" />}
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium mt-1">{lvl.desc}</p>
                    </div>
                    {lvl.achieved && (
                      <span className="text-[10px] font-black uppercase text-primary self-center bg-primary/10 px-2 py-1 rounded-lg">
                        {t('common.achieved', 'Behaald')}
                      </span>
                    )}
                 </div>
              ))}
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

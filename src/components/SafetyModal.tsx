import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Lock, EyeOff, Handshake, ShieldAlert, CheckCircle2, UserCheck, Smartphone, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SafetyModal: React.FC<SafetyModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  const safetyPrinciples = [
    {
      icon: EyeOff,
      title: t('footer.safety.p1.title'),
      desc: t('footer.safety.p1.desc'),
      color: "text-blue-500",
      bgColor: "bg-blue-50"
    },
    {
      icon: Handshake,
      title: t('footer.safety.p2.title'),
      desc: t('footer.safety.p2.desc'),
      color: "text-purple-500",
      bgColor: "bg-purple-50"
    },
    {
      icon: ShieldAlert,
      title: t('footer.safety.p3.title'),
      desc: t('footer.safety.p3.desc'),
      color: "text-red-500",
      bgColor: "bg-red-50"
    }
  ];

  const trustLevels = [
    {
      level: 1,
      title: t('footer.safety.trust.l1.title'),
      desc: t('footer.safety.trust.l1.desc'),
      icon: CheckCircle2,
      color: "text-gray-400"
    },
    {
      level: 2,
      title: t('footer.safety.trust.l2.title'),
      desc: t('footer.safety.trust.l2.desc'),
      icon: UserCheck,
      color: "text-blue-400"
    },
    {
      level: 3,
      title: t('footer.safety.trust.l3.title'),
      desc: t('footer.safety.trust.l3.desc'),
      icon: Smartphone,
      color: "text-primary"
    },
    {
      level: 4,
      title: t('footer.safety.trust.l4.title'),
      desc: t('footer.safety.trust.l4.desc'),
      icon: FileText,
      color: "text-green-500"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-8 md:p-12 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Lock size={32} />
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
                    {t('footer.safety')}
                  </h2>
                  <p className="text-gray-500 font-medium">Veiligheid en privacy staan bij ons op één.</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-4 hover:bg-gray-100 rounded-2xl transition-all group"
              >
                <X size={24} className="text-gray-400 group-hover:text-gray-900" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-16">
              {/* Intro */}
              <div className="max-w-3xl">
                 <p className="text-xl text-gray-600 leading-relaxed font-medium">
                   {t('footer.safety.intro')}
                 </p>
              </div>

              {/* Principles Grid */}
              <div className="grid md:grid-cols-3 gap-8">
                {safetyPrinciples.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all space-y-6">
                    <div className={`w-14 h-14 ${item.bgColor} ${item.color} rounded-2xl flex items-center justify-center`}>
                      <item.icon size={28} />
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-lg font-black text-gray-900 leading-tight">{item.title}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust Ladder */}
              <div className="bg-gray-900 rounded-[3rem] p-8 md:p-12 text-white space-y-12">
                 <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                          <ShieldCheck size={12} />
                          Zekerheid voorop
                       </div>
                       <h3 className="text-3xl font-black">{t('footer.safety.trust.title')}</h3>
                       <p className="text-gray-400 max-w-xl">{t('footer.safety.trust.desc')}</p>
                    </div>
                    <div className="text-right hidden md:block">
                       <p className="text-primary text-5xl font-black">1-4</p>
                       <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Levels van vertrouwen</p>
                    </div>
                 </div>

                 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {trustLevels.map((lvl) => (
                      <div key={lvl.level} className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4 group hover:bg-white/10 transition-all">
                        <div className="flex justify-between items-start">
                          <div className={`p-3 rounded-xl bg-white/5 ${lvl.color}`}>
                            <lvl.icon size={20} />
                          </div>
                          <span className="text-2xl font-black text-white/20 group-hover:text-primary transition-colors">L{lvl.level}</span>
                        </div>
                        <div>
                          <h5 className="font-black text-sm mb-1">{lvl.title}</h5>
                          <p className="text-xs text-gray-500 leading-relaxed font-medium">{lvl.desc}</p>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Footer text */}
              <div className="text-center pt-8">
                 <p className="text-sm text-gray-400 font-medium">
                   Heb je vragen over ons veiligheidsbeleid? <button className="text-primary font-black hover:underline">Neem contact met ons op</button>.
                 </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

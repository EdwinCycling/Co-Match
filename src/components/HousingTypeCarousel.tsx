import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  Home, 
  Palmtree, 
  Briefcase, 
  Building,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

interface HousingType {
  id: string;
  titleKey: string;
  descKey: string;
  benefitsKey: string[];
  defaultTitle: string;
  defaultDesc: string;
  defaultBenefits: string[];
  icon: any;
  color: string;
  bg: string;
}

const housingTypes: HousingType[] = [
  {
    id: 'cohousing',
    titleKey: 'housing.cohousing.title',
    descKey: 'housing.cohousing.desc',
    benefitsKey: ['housing.cohousing.b1', 'housing.cohousing.b2', 'housing.cohousing.b3'],
    defaultTitle: 'Cohousing / Woongroep',
    defaultDesc: 'Een kamer in een gedeelde woning of project waar je samenleeft met gelijkgestemden.',
    defaultBenefits: ['Sociale verbinding', 'Gedeelde kwaliteitsruimtes', 'Duurzamer & betaalbaarder'],
    icon: Users,
    color: 'text-primary',
    bg: 'bg-primary/10'
  },
  {
    id: 'hospita',
    titleKey: 'housing.hospita.title',
    descKey: 'housing.hospita.desc',
    benefitsKey: ['housing.hospita.b1', 'housing.hospita.b2', 'housing.hospita.b3'],
    defaultTitle: 'Hospita / Inwonen',
    defaultDesc: 'Inwonen bij een particuliere verhuurder die zelf ook in de woning verblijft.',
    defaultBenefits: ['Persoonlijk & kleinschalig', 'Veilig & vertrouwd gevoel', 'Ideale start voor jongeren'],
    icon: Home,
    color: 'text-amber-600',
    bg: 'bg-amber-500/10'
  },
  {
    id: 'vakantie',
    titleKey: 'housing.vakantie.title',
    descKey: 'housing.vakantie.desc',
    benefitsKey: ['housing.vakantie.b1', 'housing.vakantie.b2', 'housing.vakantie.b3'],
    defaultTitle: 'Vakantie woning / Onderhuur',
    defaultDesc: 'Een woning die tijdelijk te huur is voor een bepaalde periode (minimaal 1 maand).',
    defaultBenefits: ['Maandelijks opzegbaar', 'Volledig gemeubileerd', 'Ideaal voor tijdelijke rust'],
    icon: Palmtree,
    color: 'text-sky-600',
    bg: 'bg-sky-500/10'
  },
  {
    id: 'huisbewaring',
    titleKey: 'housing.huisbewaring.title',
    descKey: 'housing.huisbewaring.desc',
    benefitsKey: ['housing.huisbewaring.b1', 'housing.huisbewaring.b2', 'housing.huisbewaring.b3'],
    defaultTitle: 'Huisbewaring / Expat',
    defaultDesc: 'Woning voor langere tijd (6+ mnd) wegens tijdelijk vertrek van de eigenaar.',
    defaultBenefits: ['Zekerheid voor langere termijn', 'Volwaardige eigen woning', 'Woning blijft bewoond'],
    icon: Briefcase,
    color: 'text-indigo-600',
    bg: 'bg-indigo-500/10'
  },
  {
    id: 'vrij',
    titleKey: 'housing.vrij.title',
    descKey: 'housing.vrij.desc',
    benefitsKey: ['housing.vrij.b1', 'housing.vrij.b2', 'housing.vrij.b3'],
    defaultTitle: 'Vrije verhuur',
    defaultDesc: 'Een zelfstandige woning die regulier verhuurd wordt voor onbeperkte tijd.',
    defaultBenefits: ['Volledige privacy', 'Onbeperkte huurperiode', 'Normaal huurcontract'],
    icon: Building,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10'
  }
];

export const HousingTypeCarousel = () => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const next = () => setIndex((prev) => (prev + 1) % housingTypes.length);
  const prev = () => setIndex((prev) => (prev - 1 + housingTypes.length) % housingTypes.length);

  return (
    <section className="py-24 px-6 overflow-hidden bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-primary font-black uppercase tracking-[0.2em] text-xs"
          >
            {t('housing.header_tag', 'Diversiteit in Wonen')}
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-display font-bold text-on-surface"
          >
            {t('housing.header_title', 'Ontdek jouw perfecte match')}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-on-surface-variant max-w-2xl mx-auto font-medium"
          >
            {t('housing.header_desc', 'Of je nu op zoek bent naar gezelligheid of juist volledige privacy, Co-Match biedt verschillende woonvormen die passen bij jouw levensfase.')}
          </motion.p>
        </div>

        <div className="relative h-[550px] md:h-[500px] flex items-center justify-center perspective-[1000px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <button 
              onClick={prev}
              className="absolute left-0 md:left-4 z-40 w-12 h-12 bg-surface rounded-full shadow-lg border border-outline flex items-center justify-center text-on-surface hover:text-primary transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={next}
              className="absolute right-0 md:right-4 z-40 w-12 h-12 bg-surface rounded-full shadow-lg border border-outline flex items-center justify-center text-on-surface hover:text-primary transition-all active:scale-95"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="relative w-full h-full flex items-center justify-center">
            <AnimatePresence mode="popLayout">
              {housingTypes.map((item, i) => {
                const isCenter = i === index;
                const isLeft = i === (index - 1 + housingTypes.length) % housingTypes.length;
                const isRight = i === (index + 1) % housingTypes.length;
                
                if (!isCenter && !isLeft && !isRight) return null;

                let x = 0;
                let rotateY = 0;
                let z = 0;
                let opacity = 0;
                let scale = 0.8;
                let zIndex = 0;

                if (isCenter) {
                  x = 0;
                  rotateY = 0;
                  z = 100;
                  opacity = 1;
                  scale = 1;
                  zIndex = 30;
                } else if (isLeft) {
                  x = -320;
                  rotateY = 45;
                  z = -100;
                  opacity = 0.4;
                  scale = 0.8;
                  zIndex = 20;
                } else if (isRight) {
                  x = 320;
                  rotateY = -45;
                  z = -100;
                  opacity = 0.4;
                  scale = 0.8;
                  zIndex = 20;
                }

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.5, x: isLeft ? -500 : isRight ? 500 : 0 }}
                    animate={{ 
                      opacity, 
                      scale, 
                      x, 
                      rotateY,
                      z,
                      zIndex
                    }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 300, 
                      damping: 30 
                    }}
                    className="absolute w-full max-w-[340px] md:max-w-[420px] pointer-events-none"
                    onClick={() => {
                       if (isLeft) prev();
                       if (isRight) next();
                    }}
                    style={{ pointerEvents: isCenter ? 'auto' : 'auto', cursor: isCenter ? 'default' : 'pointer' }}
                  >
                    <div className="bg-surface rounded-[2.5rem] shadow-2xl border border-outline overflow-hidden h-full group">
                      <div className={`p-8 ${item.bg} flex flex-col items-center gap-6`}>
                        <div className={`w-20 h-20 ${item.bg} ${item.color} rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                          <item.icon size={40} />
                        </div>
                        <h3 className="text-2xl font-display font-bold text-on-surface text-center">
                          {t(item.titleKey, item.defaultTitle)}
                        </h3>
                      </div>
                      <div className="p-8 space-y-6">
                        <p className="text-on-surface-variant font-medium leading-relaxed text-center">
                          {t(item.descKey, item.defaultDesc)}
                        </p>
                        <div className="space-y-3 pt-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center opacity-60">
                            {t('common.benefits', 'Voordelen')}
                          </p>
                          {item.benefitsKey.map((benefitKey, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-sm font-bold text-on-surface bg-surface-container-low p-3 rounded-xl border border-outline/30">
                              <CheckCircle2 size={16} className={item.color} />
                              <span>{t(benefitKey, item.defaultBenefits[idx])}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, ExternalLink, LifeBuoy, Info, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export interface ExpertLink {
  id: string;
  country: string;
  category: string;
  title: string;
  description: string;
  url: string;
  order_index: number;
  isActive: boolean;
  linkType?: 'lead' | 'info';
}

interface ExpertHubProps {
  country: string;
  isFavorite?: boolean;
  isProvider?: boolean;
  forceShow?: boolean;
  variant?: 'default' | 'compact' | 'header' | 'none';
  openExternally?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const COUNTRIES = [
  'Nederland', 'België', 'Duitsland', 'Frankrijk', 'Spanje', 'Italië', 'Verenigd Koninkrijk',
  'Bulgarije', 'Cyprus', 'Denemarken', 'Estland', 'Finland', 'Griekenland', 'Hongarije', 
  'Ierland', 'Kroatië', 'Letland', 'Litouwen', 'Luxemburg', 'Malta', 'Oostenrijk', 
  'Polen', 'Portugal', 'Roemenië', 'Slovenië', 'Slowakije', 'Tsjechië', 'Zweden', 
  'Zwitserland', 'Noorwegen'
];

export function ExpertHub({ country, isFavorite, isProvider, forceShow, variant = 'default', openExternally, onOpenChange }: ExpertHubProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<ExpertLink[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ExpertLink | null>(null);
  const [activeCountry, setActiveCountry] = useState(country || 'Nederland');
  const [activeCategory, setActiveCategory] = useState<string>('Alle categorieën');
  
  // Sync internal open state with external prop if provided
  useEffect(() => {
    if (openExternally !== undefined && openExternally !== isOpen) {
      setIsOpen(openExternally);
    }
  }, [openExternally]);

  // Notify parent if open state changes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
  }, [isOpen]);
  
  // Opt in state
  const [showOptIn, setShowOptIn] = useState(false);

  useEffect(() => {
    // Reset category when country changes to ensure all links are shown initially or filtered correctly
    setActiveCategory('Alle categorieën');
  }, [activeCountry]);

  useEffect(() => {
    // Update local state if prop changes (initially)
    if (country && country !== activeCountry) {
      setActiveCountry(country);
    }
  }, [country]);

  useEffect(() => {
    // Only fetch if modal is open or about to be (to save reads)
    if (!activeCountry || !isOpen) return;

    const fetchLinks = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'expert_links'),
          where('country', '==', activeCountry),
          where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        const fetchedLinks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ExpertLink[];
        
        fetchedLinks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        
        setLinks(fetchedLinks);
      } catch (error) {
        console.error("Error fetching expert links:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
  }, [activeCountry, isOpen]);

  // Seeker condition for showing the trigger AT ALL
  if (!forceShow && !isProvider && !isFavorite) {
    return null;
  }

  const groupedLinks = links.reduce((acc, link) => {
    if (!acc[link.category]) {
      acc[link.category] = [];
    }
    acc[link.category].push(link);
    return acc;
  }, {} as Record<string, ExpertLink[]>);

  // Get available categories for the dropdown
  const availableCategories = Object.keys(groupedLinks).filter(cat => groupedLinks[cat].length > 0);
  const showCategoryFilter = availableCategories.length > 1;

  const categories = ['Juristen', 'Verzekeraars', 'Hypotheekadviseurs', 'Notarissen', 'Verhuizers', 'Overige'];
  
  // Filter groups based on selected category if filter is shown
  const orderedGroups = categories.map(cat => ({
    name: cat,
    items: groupedLinks[cat] || []
  })).filter(group => {
    if (group.items.length === 0) return false;
    if (activeCategory !== 'Alle categorieën' && group.name !== activeCategory) return false;
    return true;
  });

  const handleInfoClick = (link: ExpertLink) => {
    setSelectedLink(link);
    setShowOptIn(true);
  };

  const handleOptIn = () => {
    toast.success(
      t('expert.opt_in_success', 'Bedankt! We hebben je gegevens veilig doorgestuurd. Zij nemen snel contact op.'),
      { duration: 4000 }
    );
    setShowOptIn(false);
    setSelectedLink(null);
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen || showOptIn) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, showOptIn]);

  const renderTrigger = () => {
    if (variant === 'none') {
      return null;
    }

    if (variant === 'header') {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl font-black text-[10px] md:text-sm uppercase tracking-widest hover:bg-primary/20 transition-all shadow-sm"
        >
          <LifeBuoy size={16} />
          <span className="hidden sm:inline">{activeCountry} Partner Netwerk</span>
          <span className="sm:hidden">Partners</span>
        </button>
      );
    }

    if (isProvider || variant === 'compact') {
      return (
        <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant/30 flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 text-primary font-bold">
            <LifeBuoy size={20} />
            <span>Expert Hub</span>
          </div>
          <p className="text-sm text-on-surface-variant flex-1">
            {t('expert.provider_desc', 'Vind direct gecertificeerde partners voor juridisch advies, contracten, etc.')}
          </p>
          <button
            onClick={() => setIsOpen(true)}
            className="mt-2 text-sm font-black uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
          >
            {t('expert.open_hub', 'Open partners')} &rarr;
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full p-4 mt-6 rounded-2xl bg-gradient-to-r from-primary-container/40 to-surface-container hover:bg-primary-container/60 transition-colors border border-primary/20 group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <LifeBuoy size={20} />
          </div>
          <div className="text-left">
            <div className="font-bold text-on-surface">
              {t('expert.seeker_btn_title', 'Hulp nodig? / Expert Advies')}
            </div>
            <div className="text-xs text-on-surface-variant">
              {t('expert.seeker_btn_subtitle', `Vind gecertificeerde partners in ${activeCountry}`)}
            </div>
          </div>
        </div>
        <div className="text-primary font-black uppercase text-[10px] tracking-widest px-3 py-1.5 rounded-lg bg-white/50">
          {t('expert.open_partners', 'Open Partners')}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* The Trigger */}
      {renderTrigger()}

      {/* The Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center px-4 md:px-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-scrim/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden h-[85vh] flex flex-col"
            >
              <div className="p-6 md:p-10 border-b border-outline-variant/20 sticky top-0 bg-surface/95 backdrop-blur-md z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                      <LifeBuoy size={24} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-display font-black text-on-surface tracking-tight">
                      {t('expert.modal_title', 'Hulp bij je woonmatch')}
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-12 h-12 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all shadow-sm active:scale-95"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex flex-col md:flex-row gap-6 md:items-end">
                  {/* Country Selector Inside Modal */}
                  <div className="flex flex-col gap-2 flex-1 max-w-md">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 opacity-70">
                      {t('expert.selected_country', 'Geselecteerd land')}
                    </label>
                    <div className="relative group">
                      <select
                        value={activeCountry}
                        onChange={(e) => setActiveCountry(e.target.value)}
                        className="w-full px-6 py-4 bg-surface-container rounded-[1.25rem] border border-outline-variant outline-none focus:border-primary text-sm font-bold appearance-none cursor-pointer hover:bg-surface-container-high transition-all"
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant transition-transform group-hover:rotate-12">
                        <LifeBuoy size={18} className="opacity-40" />
                      </div>
                    </div>
                  </div>

                  {/* Category Filter - Only shows if multiple categories exist */}
                  {showCategoryFilter && (
                    <div className="flex flex-col gap-2 flex-1 max-w-md">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 opacity-70">
                        {t('expert.filter_category', 'Categorie filter')}
                      </label>
                      <div className="relative group">
                        <select
                          value={activeCategory}
                          onChange={(e) => setActiveCategory(e.target.value)}
                          className="w-full px-6 py-4 bg-surface-container rounded-[1.25rem] border border-outline-variant outline-none focus:border-primary text-sm font-bold appearance-none cursor-pointer hover:bg-surface-container-high transition-all"
                        >
                          <option value="Alle categorieën">{t('expert.all_categories', 'Alle categorieën')}</option>
                          {availableCategories.sort().map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant transition-transform group-hover:scale-110">
                          <Info size={18} className="opacity-40" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12 custom-scrollbar bg-surface-container-lowest">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full" 
                    />
                    <p className="text-sm font-black text-on-surface-variant uppercase tracking-widest">Zoeken naar expertise...</p>
                  </div>
                ) : orderedGroups.length > 0 ? (
                  orderedGroups.map((group) => (
                    <div key={group.name} className="space-y-8">
                      <div className="flex items-center gap-4">
                         <h3 className="font-black text-primary uppercase tracking-widest text-xs md:text-sm whitespace-nowrap">
                           {group.name}
                         </h3>
                         <div className="h-px w-full bg-gradient-to-r from-primary/10 to-transparent" />
                      </div>
                      <div className="grid grid-cols-1 gap-6 md:gap-8">
                        {group.items.map((link, i) => (
                          <div 
                            key={link.id || i} 
                            className="rounded-3xl p-6 md:p-8 border border-outline-variant/30 flex flex-col hover:shadow-xl hover:-translate-y-0.5 transition-all group relative overflow-hidden bg-white shadow-sm w-full"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[80px] -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
                            
                            <div className="relative z-10 flex-1">
                              <h4 className="font-display font-black text-xl md:text-2xl text-on-surface mb-3 tracking-tight group-hover:text-primary transition-colors">
                                 {link.title}
                              </h4>
                              <p className="text-sm md:text-base text-on-surface-variant mb-6 leading-relaxed font-medium">
                                {link.description}
                              </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 mt-auto relative z-10">
                              {link.linkType !== 'info' && (
                                <button
                                  onClick={() => handleInfoClick(link)}
                                  className="flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all text-xs font-black uppercase tracking-widest shadow-sm"
                                >
                                  <Info size={18} />
                                  {t('expert.info_btn', 'Meer info')}
                                </button>
                              )}
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-[1.5] min-h-[48px] flex items-center justify-center gap-2 py-3 px-8 rounded-2xl transition-all text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg active:scale-[0.98] ${
                                  link.linkType === 'info' 
                                  ? 'bg-primary text-on-primary hover:bg-primary-dark' 
                                  : 'bg-on-surface text-surface hover:bg-on-surface/90'
                                }`}
                                title="Opent in nieuw tabblad"
                              >
                                {link.linkType === 'info' ? t('expert.visit_website_btn', 'Website bezoeken') : t('expert.website_btn', 'Website')}
                                <ExternalLink size={18} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant/30">
                      <LifeBuoy size={32} />
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">Geen partners gevonden</p>
                      <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
                        In {activeCountry} hebben we momenteel nog geen actieve partners. Probeer een ander land of check later opnieuw.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Opt-In Modal */}
      <AnimatePresence>
        {showOptIn && selectedLink && (
          <div className="fixed inset-0 z-[2100] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-scrim/60 backdrop-blur-md"
              onClick={() => setShowOptIn(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl p-6 md:p-8 shadow-2xl"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-display font-black text-on-surface mb-3 tracking-tight">
                {t('expert.opt_in_title', 'Veilig & Eenvoudig contact')}
              </h3>
              <p className="text-[13px] text-on-surface-variant mb-6 leading-relaxed font-medium">
                {t('expert.opt_in_desc_secure', 'Via ons Partner Netwerk kun je op een zeer veilige en eenvoudige manier in contact komen met gecertificeerde aanbieders. Mogen we je naam en e-mailadres doorsturen naar **{{partner}}**? Zij nemen dan vrijblijvend contact met je op om je verder te helpen.', { 
                  partner: selectedLink.title 
                }).split('**').map((part: string, i: number) => i % 2 === 1 ? <strong key={i} className="text-primary">{part}</strong> : part)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOptIn(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-sm text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleOptIn}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-sm text-on-primary bg-primary hover:bg-primary/90 transition-colors"
                >
                  Ja, stuur info
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from 'motion/react';
import { MapPin, Sparkles, User, Info, Check, X, AlertCircle, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrencyConverter } from '../hooks/useCurrencyConverter';

interface Property {
  id: string;
  title: string;
  city: string;
  neighborhood?: string;
  price: number;
  priceType?: 'fixed' | 'range' | 'tbd';
  minPrice?: number;
  maxPrice?: number;
  features: any;
  teaserImageId?: string;
  images?: any[];
  displayLat?: number;
  displayLng?: number;
  status?: 'available' | 'paused';
  monthlyAvailability?: Record<string, string>;
}

interface VibeHousingProps {
  properties: Property[];
  seekerProfile: any;
  seekerLocation: { lat: number; lng: number } | null;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  calculateMatchScore: (p: Property) => number;
  onMatch: (prop: Property) => void;
  onLike: (prop: Property) => void;
  onClose: () => void;
  onShowDetails: (prop: Property) => void;
  onEditProfile: () => void;
}

export default function VibeHousing({
  properties,
  seekerProfile,
  seekerLocation,
  calculateDistance,
  calculateMatchScore,
  onMatch,
  onLike,
  onClose,
  onShowDetails,
  onEditProfile
}: VibeHousingProps) {
  const { t } = useTranslation();
  const [deck, setDeck] = useState<(Property & { matchScore: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Prevent scrolling on body when vibe is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    // 1. Filter and Calculate Matches
    const filterAndScore = () => {
      if (!seekerProfile) return [];
      
      const rad = seekerProfile.radius || 50;
      const budgetMin = seekerProfile.budget_min || 0;
      const budgetMax = seekerProfile.budget_max || 999999;
      const userGoals = seekerProfile.goal || [];

      const filtered = properties.filter(prop => {
        if (prop.status === 'paused') return false;

        // Mandatoy Hard exclusion: Goal (Must match seeker's goal)
        if (seekerProfile.goal?.length > 0 && prop.features?.goal) {
          const pGoal = prop.features.goal;
          if (!seekerProfile.goal.includes(pGoal)) return false;
        }

        // Distance and type filters are removed as per request
        // but they are used for scoring and sorting later.

        return true;
      });

      // Score candidates
      const scored = filtered.map(prop => {
        const percentage = calculateMatchScore(prop);
        return { ...prop, matchScore: percentage };
      });

      // Sort: Highest match scores first
      scored.sort((a, b) => b.matchScore - a.matchScore);
      return scored.slice(0, 50); // Beperk Swipe-lijst tot "pakketten van 50" voor prestaties
    };

    setDeck(filterAndScore());
    setLoading(false);
  }, [properties, seekerProfile, seekerLocation, calculateDistance]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (deck.length === 0) return;
    const currentCard = deck[0];
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(direction === 'right' ? [50, 50, 50] : 50);
    }

    if (direction === 'right') {
      onLike(currentCard);
      onShowDetails(currentCard);
      // Wait slightly so the modal opens before we remove the card from the stack
      setTimeout(() => setDeck(prev => prev.slice(1)), 300);
    } else {
      setDeck(prev => prev.slice(1));
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-black">
         <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (deck.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-background px-6">
        <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mb-6">
          <Sparkles size={40} className="text-primary/50" />
        </div>
        <h2 className="text-2xl font-black text-on-background mb-2">{t('vibe.no_homes_found', 'Geen woningen gevonden...')}</h2>
        <p className="text-on-surface-variant text-center font-medium max-w-sm mb-8">
          {t('vibe.no_homes_desc', 'Er zijn momenteel geen woningen beschikbaar die direct aan jouw criteria voldoen. Verander je profiel: pas je regio, budget of type woning aan om meer resultaten te zien.')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={onEditProfile} className="px-8 py-4 bg-primary text-white rounded-2xl font-black tracking-widest shadow-lg hover:bg-primary/90 transition-colors">
            {t('vibe.edit_profile', 'Profiel aanpassen')}
          </button>
          <button onClick={onClose} className="px-8 py-4 bg-surface-container-high text-on-surface rounded-2xl font-black tracking-widest shadow-sm hover:bg-surface-container-highest transition-colors">
            {t('vibe.view_list', 'Lijstweergave bekijken')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden select-none overscroll-none touch-none">
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={onClose} className="cm-modal-close-button p-3 bg-surface/20 text-white border-white/25 hover:bg-surface/30 backdrop-blur-md">
          <X size={24} />
        </button>
        <div className="flex items-center gap-2 text-white/80 font-black uppercase tracking-widest text-sm">
          <Sparkles size={16} className="text-primary" />
          {t('vibe.title', 'HouseVibe')}
        </div>
        <div className="w-12" /> {/* spacer */}
      </div>

      {/* Card Deck Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        {deck.map((prop, index) => {
          if (index > 2) return null; // Only render top 3 cards for performance
          const isTop = index === 0;
          return (
             <SwipeCard 
               key={prop.id}
               prop={prop}
               index={index}
               isTop={isTop}
               onSwipe={handleSwipe}
               onShowDetails={() => onShowDetails(prop)}
             />
          );
        })}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 inset-x-0 p-8 flex justify-center gap-6 z-20 bg-gradient-to-t from-black to-transparent">
        <button 
          onClick={() => handleSwipe('left')}
          className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-error border border-error/50 hover:bg-error/20 hover:scale-110 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
        >
          <X size={32} />
        </button>
        <button 
          onClick={() => onShowDetails(deck[0])}
          className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 mt-2 hover:bg-white/20 hover:scale-110 transition-all"
        >
          <Info size={24} />
        </button>
        <button 
          onClick={() => handleSwipe('right')}
          className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-primary border border-primary/50 hover:bg-primary/20 hover:scale-110 transition-all shadow-[0_0_20px_var(--color-primary)] opacity-90"
        >
          <Check size={32} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function SwipeCard({ prop, index, isTop, onSwipe, onShowDetails }: { prop: Property & { matchScore: number }, index: number, isTop: boolean, onSwipe: (dir: 'left'|'right') => void, onShowDetails: () => void }) {
  const { t } = useTranslation();
  const currencyConverter = useCurrencyConverter();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Magic parallax and rotation values
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const scale = isTop ? 1 : 1 - (index * 0.05);
  const yOffset = isTop ? 0 : index * 20;

  // Visual cues based on distance dragged
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const greenOverlayMsg = useTransform(x, [0, 150], [0, 0.4]);
  const redOverlayMsg = useTransform(x, [-150, 0], [0.4, 0]);

  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      scale: isTop ? 1 : 1 - (index * 0.05),
      y: isTop ? 0 : index * 20,
      opacity: 1 - (index * 0.2),
      transition: { type: 'spring', stiffness: 300, damping: 20 }
    });
  }, [index, isTop, controls]);

  const handleDragEnd = (e: any, info: PanInfo) => {
    const threshold = 100;
    const velocityThreshold = 500;
    
    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      // Swipe Right
      controls.start({ x: 500, opacity: 0, scale: 0.9, transition: { duration: 0.4 } }).then(() => onSwipe('right'));
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      // Swipe Left
      controls.start({ x: -500, opacity: 0, scale: 0.9, transition: { duration: 0.4 } }).then(() => onSwipe('left'));
    } else {
      // Return to center
      controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  const getRingColor = (score: number) => {
    if (score >= 90) return 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)] text-amber-400';
    if (score >= 75) return 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)] text-emerald-400';
    return 'border-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.5)] text-orange-400';
  };

  const ringStyle = getRingColor(prop.matchScore);
  const teaserImage = prop.images?.find(i => i.id === prop.teaserImageId)?.url || prop.images?.[0]?.url;

  return (
    <motion.div
      className="absolute w-full max-w-md h-[75vh] md:h-[85vh] rounded-[2.5rem] bg-surface-container overflow-hidden shadow-2xl origin-bottom cursor-grab active:cursor-grabbing"
      style={{
        zIndex: 10 - index,
        x,
        y,
        rotate,
      }}
      initial={{ scale: 0.8, y: 100, opacity: 0 }}
      animate={controls}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 0.98 }}
    >
      {/* Background Image Wrapper for Parallax effect */}
      <motion.div 
        className="absolute inset-0 w-full h-full bg-surface-container-highest pointer-events-none"
        style={{
          x: useTransform(x, [-200, 200], [20, -20]),
          y: useTransform(y, [-200, 200], [20, -20]),
        }}
      >
        {teaserImage ? (
          <img src={teaserImage} className="w-full h-full object-cover scale-110" alt={prop.title} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black"><Sparkles className="text-white/20 w-20 h-20" /></div>
        )}
      </motion.div>

      {/* Action Overlays (Red/Green hint flashes) */}
      <motion.div style={{ opacity: greenOverlayMsg }} className="absolute inset-0 bg-emerald-500/30 backdrop-blur-[2px] z-10 pointer-events-none" />
      <motion.div style={{ opacity: redOverlayMsg }} className="absolute inset-0 bg-error/30 backdrop-blur-[2px] z-10 pointer-events-none" />

      <motion.div style={{ opacity: likeOpacity, rotate: -20 }} className="absolute top-16 left-8 border-4 border-emerald-400 text-emerald-400 font-black text-4xl px-4 py-2 rounded-xl z-20 pointer-events-none shadow-lg">
        {t('vibe.yes', 'JA')}
      </motion.div>
      <motion.div style={{ opacity: nopeOpacity, rotate: 20 }} className="absolute top-16 right-8 border-4 border-error text-error font-black text-4xl px-4 py-2 rounded-xl z-20 pointer-events-none shadow-lg">
        {t('vibe.no', 'NEE')}
      </motion.div>

      {/* Main Gradient overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-8 z-10 pointer-events-none">
        
        {/* Match Ring */}
        <div className="absolute top-12 right-8 flex flex-col items-center pointer-events-auto z-20">
          <div className={`w-20 h-20 rounded-full border-4 bg-black/60 backdrop-blur-md flex items-center justify-center font-black text-2xl ${ringStyle}`}>
            {prop.matchScore}%
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-white mt-2 drop-shadow-md">{t('vibe.match_dna', 'Match DNA')}</p>
        </div>

        {/* Info Overlays using Glassmorphism */}
        <div 
          className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-3xl shadow-xl space-y-3 pointer-events-auto cursor-pointer z-20 hover:bg-white/20 transition-colors" 
          onClick={(e) => { 
            e.stopPropagation(); 
            onShowDetails(); 
          }}
          onPointerDown={(e) => {
            // Stop propagation only for clicks, let Framer Motion handle drag starts if needed
            // Actually, for Framer Motion drag to work from a child, we often need to NOT stop propagation
          }}
        >
          <div>
            <h2 className="text-2xl font-display font-black text-white drop-shadow-md leading-tight">{prop.title}</h2>
            <p className="text-white/80 font-bold flex items-center flex-wrap gap-1.5 mt-1 text-sm">
              <MapPin size={14} className="shrink-0" /> 
              <span>{prop.city}</span>
              {prop.features?.goal && <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-white/20 text-white rounded-md ml-1">{String(t(`prop.goal.${prop.features.goal}`, prop.features.goal))}</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap text-xs font-bold text-white mb-2">
            <span className="bg-primary/80 backdrop-blur px-3 py-1.5 rounded-xl border border-primary/50 shadow-md">
              {prop.priceType === 'tbd' ? t('vibe.price_tbd', 'Prijs n.t.b.') : prop.priceType === 'range' ? `${currencyConverter.formatEur(prop.minPrice)} - ${currencyConverter.formatEur(prop.maxPrice)}` : `${currencyConverter.formatEur(prop.price)}`}
            </span>
            <span className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-xl border border-white/10 shadow-md">
              {prop.features?.area_private || 0} m²
            </span>
            <span className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-xl border border-white/10 shadow-md flex items-center gap-1">
              <User size={12} /> {prop.features?.bedrooms || 0}
            </span>
            {prop.features?.goal === 'vakantie_onderhuur' && prop.monthlyAvailability && (
              <span className="bg-success text-white px-3 py-1.5 rounded-xl border border-success/50 shadow-md flex items-center gap-1">
                <Calendar size={12} /> {t('prop.availability.diverse_months', 'Diverse maanden')}
              </span>
            )}
          </div>
          {prop.features?.free_text_description && (
             <p className="text-white/90 text-xs italic font-medium line-clamp-2">"{prop.features.free_text_description}"</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

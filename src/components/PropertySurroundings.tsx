import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  ShoppingBag, 
  TreePine, 
  Bus, 
  Dumbbell, 
  Coffee,
  ChevronLeft,
  ChevronRight,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { checkRateLimit } from '../lib/rateLimit';
import { fetchGeoapifyPlaces } from '../services/placesService';

interface Place {
  id: string;
  name: string;
  address: string;
  distance: number;
  category: string;
  lat?: number;
  lon?: number;
}

interface CategoryGroup {
  id: string;
  label: string;
  icon: any;
  categories: string;
  color: string;
  bg: string;
}

const CATEGORIES: CategoryGroup[] = [
  { id: 'cafe', label: 'Restaurants', icon: Coffee, categories: 'catering.restaurant', color: 'text-amber-600', bg: 'bg-amber-50' }
];

export function PropertySurroundings({ lat, lon }: { lat: number; lon: number }) {
  const { t } = useTranslation();
  const [activeCatIndex, setActiveCatIndex] = useState(0);
  const [places, setPlaces] = useState<Record<string, Place[]>>({});
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    // Scroll to container when expanded
    setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    const fetchAllCategories = async () => {
      setLoading(true);
      const results: Record<string, Place[]> = {};

      for (const group of CATEGORIES) {
        try {
          const data = await fetchGeoapifyPlaces({
            categories: group.categories,
            lon,
            lat,
            radius: 5000,
            limit: 5,
            bias: `proximity:${lon},${lat}`,
          });
          results[group.id] = data.features.map((f: any) => ({
            id: f.properties.place_id,
            name: f.properties.name || f.properties.street || 'Onbekend',
            address: f.properties.address_line2 || f.properties.city || '',
            distance: f.properties.distance || 0,
            category: group.id,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0]
          })).filter((p: any) => p.name !== 'Onbekend');
        } catch (e) {
          console.error(`Error fetching ${group.id}:`, e);
        }
      }
      setPlaces(results);
      setLoading(false);
    };

    fetchAllCategories();
  }, [lat, lon, isExpanded]);

  const activeGroup = CATEGORIES[activeCatIndex];
  const activePlaces = places[activeGroup.id] || [];

  return (
    <div className="w-full space-y-4" ref={containerRef}>
      {/* Collapsed Header */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-surface-container/50 hover:bg-surface-container border border-outline/30 rounded-3xl p-6 flex items-center justify-between transition-all group shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
             <MapPin size={24} />
          </div>
          <div className="text-left">
            <h4 className="text-lg font-display font-black text-on-background">Wat is er in de buurt?</h4>
            <p className="text-xs text-on-surface-variant font-medium">Ontdek voorzieningen en interessante plekken rondom de woning</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-60 group-hover:opacity-100 transition-opacity">
            {isExpanded ? 'Inklappen' : 'Bekijk omgeving'}
          </span>
          <div className="p-2 rounded-full bg-white border border-outline/50 shadow-sm">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface-container-lowest border border-outline/50 rounded-[2.5rem] p-6 md:p-10 space-y-8 shadow-xl">
              
              {/* Category Carousel Navigation */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat, idx) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCatIndex(idx)}
                      className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                        activeCatIndex === idx 
                        ? `${cat.bg} ${cat.color} border-current shadow-sm` 
                        : 'bg-white text-on-surface-variant border-outline/30 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <cat.icon size={14} />
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="hidden md:flex gap-2">
                   <button 
                     onClick={() => setActiveCatIndex((prev) => (prev - 1 + CATEGORIES.length) % CATEGORIES.length)}
                     className="p-2 rounded-full border border-outline/50 hover:bg-surface-container transition-colors shadow-sm"
                   >
                     <ChevronLeft size={20} />
                   </button>
                   <button 
                     onClick={() => setActiveCatIndex((prev) => (prev + 1) % CATEGORIES.length)}
                     className="p-2 rounded-full border border-outline/50 hover:bg-surface-container transition-colors shadow-sm"
                   >
                     <ChevronRight size={20} />
                   </button>
                </div>
              </div>

              {/* Active Category View */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeGroup.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className={`w-14 h-14 rounded-2xl ${activeGroup.bg} ${activeGroup.color} flex items-center justify-center shadow-inner`}>
                          <activeGroup.icon size={28} />
                        </div>
                        <h3 className="text-2xl font-display font-black text-on-background">{activeGroup.label}</h3>
                        <p className="text-sm text-on-surface-variant leading-relaxed">
                          We hebben de dichtstbijzijnde {activeGroup.label.toLowerCase()} voor je in kaart gebracht. Alle plekken bevinden zich in de directe omgeving van de woning.
                        </p>
                      </div>

                      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-start gap-3">
                         <Info size={16} className="text-primary shrink-0 mt-0.5" />
                         <p className="text-[10px] font-bold text-on-surface-variant leading-normal">
                           Om de privacy van de aanbieder te beschermen tonen we alleen de naam van deze voorzieningen, zonder het exacte adres van de woning prijs te geven op de kaart.
                         </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-20 bg-surface-container-low rounded-2xl animate-pulse border border-outline/20" />
                        ))
                      ) : activePlaces.length > 0 ? (
                        activePlaces.map((place) => (
                          <a 
                            key={place.id}
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.address}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white p-4 rounded-2xl border border-outline/30 shadow-sm flex items-center justify-between group hover:border-primary/40 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-xl ${activeGroup.bg} ${activeGroup.color} flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity`}>
                                  <activeGroup.icon size={18} />
                               </div>
                               <div>
                                  <h5 className="font-bold text-on-background text-sm group-hover:text-primary transition-colors">{place.name}</h5>
                                  <p className="text-[10px] font-medium text-on-surface-variant/70 mb-1">
                                    {place.address}
                                  </p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">
                                    In de buurt van de woning
                                  </p>
                               </div>
                            </div>
                            <ExternalLink size={14} className="text-outline/30 group-hover:text-primary transition-colors" />
                          </a>
                        ))
                      ) : (
                        <div className="h-40 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline/30 flex flex-col items-center justify-center text-center p-6 space-y-2">
                           <div className="text-on-surface-variant opacity-20">
                             <activeGroup.icon size={40} />
                           </div>
                           <p className="text-xs font-bold text-on-surface-variant italic">Geen resultaten gevonden voor deze categorie in de buurt.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

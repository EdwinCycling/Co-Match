import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Coffee, Utensils, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { checkRateLimit } from '../lib/rateLimit';
import { fetchGeoapifyPlaces } from '../services/placesService';

interface Place {
  id: string;
  name: string;
  street: string;
  city: string;
  category: 'cafe' | 'restaurant';
}

interface MeetingPlaceSuggesterProps {
  lon: number;
  lat: number;
  onSuggest: (text: string) => void;
  initialMinimized?: boolean;
}

export function MeetingPlaceSuggester({ lon, lat, onSuggest, initialMinimized = true }: MeetingPlaceSuggesterProps) {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(2000);
  const [isMinimized, setIsMinimized] = useState(initialMinimized);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchPlaces = async (radius: number): Promise<Place[]> => {
      const data = await fetchGeoapifyPlaces({
        categories: 'catering.cafe,catering.restaurant',
        lon,
        lat,
        radius,
        limit: 10
      });
      
      return data.features.map((f: any) => ({
        id: f.properties.place_id,
        name: f.properties.name || f.properties.street || t('common.unknown', 'Onbekend'),
        street: f.properties.street || f.properties.formatted?.split(',')[0] || '',
        city: f.properties.city || f.properties.suburb || f.properties.county || '',
        category: (f.properties.categories?.includes('catering.cafe') ? 'cafe' : 'restaurant') as Place['category'],
      })).filter((p: Place) => p.name !== t('common.unknown', 'Onbekend'));
    };

    const loadData = async () => {
      // Rate limit: Max 100 location searches per hour
      if (!checkRateLimit('meeting_places', 100, 60 * 60 * 1000)) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(false);
      try {
        let results = await fetchPlaces(2000);
        if (results.length === 0) {
          results = await fetchPlaces(5000);
          if (isMounted) setSearchRadius(5000);
        } else {
          if (isMounted) setSearchRadius(2000);
        }
        
        if (isMounted) {
          setPlaces(results);
        }
      } catch (err) {
        console.error('Error fetching places:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [lon, lat]);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % places.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + places.length) % places.length);
  };

  const GoogleMapsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
      <circle cx="12" cy="9" r="2.5" fill="#FFFFFF"/>
    </svg>
  );

  return (
    <div className={`rounded-3xl border border-amber-100/50 shadow-sm transition-all duration-300 backdrop-blur-md ${isMinimized ? 'bg-amber-50/70 p-2 opacity-80 hover:opacity-100 hover:bg-amber-50/90' : 'bg-amber-50/95 p-4 !opacity-100 border-l-4 border-l-primary shadow-amber-900/10'}`}>
      <div className="flex justify-between items-center mb-1.5">
        <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-primary">
          <MapPin size={14} className="animate-bounce" />
          {t('meeting.tip_meeting_places', 'Tip: Ontmoetingsplekken')}{searchRadius > 2000 && ' (5km+)'}
        </h4>
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-[10px] font-bold text-primary hover:underline px-2 py-0.5"
        >
          {isMinimized ? t('common.show_tips', 'Toon tips') : t('common.hide', 'Verberg')}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="flex items-start gap-3 mb-4 text-[10px] text-amber-900 bg-amber-100/80 p-3 rounded-2xl border border-amber-200 shadow-sm">
            <div className="bg-amber-500 text-white p-1 rounded-lg shrink-0">
               <AlertCircle size={14} />
            </div>
            <p className="font-bold leading-tight">
              <span className="font-black text-amber-600 uppercase text-[9px] block mb-0.5">{t('common.safety', 'Veiligheid')}</span> 
              {t('meeting.safety_tip', 'Spreek altijd eerst op neutraal terrein af (zoals een café). Wissel niet direct privé-gegevens uit.')}
            </p>
          </div>

          {(!loading && places.length === 0) ? (
            <div className="text-[10px] text-on-surface-variant p-2 bg-surface rounded-lg border border-outline text-center">
              {t('meeting.no_places', 'Geen plekken gevonden binnen 5km.')}
            </div>
          ) : loading ? (
            <div className="flex gap-2">
              <div className="w-full bg-surface rounded-xl p-2 border border-outline animate-pulse">
                 <div className="h-3 bg-outline/50 rounded w-2/3 mb-2"></div>
                 <div className="h-6 bg-outline/50 rounded-lg w-full"></div>
              </div>
            </div>
          ) : (
            <div className="relative flex items-center justify-center gap-2">
              {places.length > 1 && (
                <button 
                  onClick={handlePrev}
                  className="w-8 h-8 rounded-full bg-surface border border-outline flex items-center justify-center shadow-sm shrink-0 hover:bg-surface-container transition-colors text-on-surface-variant"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              
              <div className="w-full bg-white rounded-2xl p-4 border border-outline shadow-sm flex flex-col hover:border-primary/50 transition-all duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8" />
                
                <div className="flex gap-3 items-start mb-3 relative z-10">
                  <div className="bg-primary/10 p-2.5 rounded-xl text-primary shrink-0 shadow-inner">
                    {places[activeIndex].category === 'cafe' ? <Coffee size={20} /> : <Utensils size={20} />}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5 mb-0.5">
                       <h5 className="font-display font-bold text-on-surface text-sm truncate" title={places[activeIndex].name}>{places[activeIndex].name}</h5>
                       <span className="text-[8px] font-black uppercase bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/10 shrink-0">
                          {places[activeIndex].category === 'cafe' ? t('common.cafe', 'Café') : t('common.food', 'Eten')}
                       </span>
                    </div>
                    {(places[activeIndex].street || places[activeIndex].city) && (
                      <div className="flex items-center gap-1 text-[10px] text-on-surface-variant font-medium opacity-80">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate" title={`${places[activeIndex].street}, ${places[activeIndex].city}`}>
                           {places[activeIndex].street}{places[activeIndex].city ? `, ${places[activeIndex].city}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-auto relative z-10 flex gap-2">
                   <button
                    onClick={() => {
                        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(places[activeIndex].name + ' ' + (places[activeIndex].street || '') + ' ' + (places[activeIndex].city || ''))}`;
                        window.open(mapsLink, '_blank');
                    }}
                    className="p-2 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container transition-all border border-outline/30 shrink-0 flex items-center justify-center"
                    title={t('common.view_map', 'Bekijk op Google Maps')}
                  >
                    <GoogleMapsIcon />
                  </button>
                  <button
                    onClick={() => {
                        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(places[activeIndex].name + ' ' + (places[activeIndex].street || '') + ' ' + (places[activeIndex].city || ''))}`;
                        onSuggest(t('meeting.suggest_message', 'Hé! Zullen we afspreken bij {{name}}{{cityText}}?\nBekijk op kaart: {{mapsLink}}', { name: places[activeIndex].name, cityText: places[activeIndex].city ? ` in ${places[activeIndex].city}` : '', mapsLink }));
                    }}
                    className="flex-grow text-[10px] font-black uppercase tracking-widest text-on-primary bg-primary hover:bg-primary-dark py-2 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <ChevronRight size={14} />
                    {t('common.suggest', 'Stel voor')}
                  </button>
                </div>
              </div>

              {places.length > 1 && (
                <button 
                  onClick={handleNext}
                  className="w-8 h-8 rounded-full bg-surface border border-outline flex items-center justify-center shadow-sm shrink-0 hover:bg-surface-container transition-colors text-on-surface-variant"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          )}
          
          {places.length > 1 && (
            <div className="flex justify-center mt-2 gap-1">
              {places.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex ? 'bg-primary w-3' : 'bg-outline/50'}`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

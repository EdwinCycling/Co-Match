import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Maximize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { AutocompleteInput } from './AutocompleteInput';

// Fix Leaflet icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  lat: number;
  lng: number;
  radius: number;
  initialSearch?: string;
  onChange: (lat: number, lng: number, radius: number, city?: string, country?: string) => void;
}

function LocationMarker({ lat, lng, radius, onChange }: MapPickerProps) {
  const map = useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng, radius);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return (
    <>
      <Marker position={[lat, lng]} />
      <Circle 
        center={[lat, lng]} 
        radius={radius * 1000} 
        pathOptions={{ 
          fillColor: 'var(--cm-primary)', 
          color: 'var(--cm-primary)', 
          fillOpacity: 0.2,
          weight: 1
        }} 
      />
    </>
  );
}

function MapUpdater({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function MapPicker({ lat, lng, radius, initialSearch = '', onChange, cityOnly = true }: MapPickerProps & { cityOnly?: boolean }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(initialSearch);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (initialSearch && !search) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);
  
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isExpanded]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        onChange(parseFloat(data[0].lat), parseFloat(data[0].lon), radius);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
    setLoading(false);
  };

  const MapContent = (isModal = false) => (
    <div className={`rounded-3xl overflow-hidden border-2 border-outline relative z-10 ${isModal ? 'h-[60vh]' : 'h-64'}`}>
      <MapContainer 
        center={[lat, lng]} 
        zoom={11} 
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker lat={lat} lng={lng} radius={radius} onChange={onChange} />
        <MapUpdater lat={lat} lng={lng} />
      </MapContainer>
      <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-outline flex items-center gap-2 shadow-sm pointer-events-none">
        <MapPin size={14} className="text-primary" />
        <span className="text-[10px] font-black uppercase tracking-tighter">Pinpoint je plek</span>
      </div>
      {!isModal && (
        <button 
          onClick={() => setIsExpanded(true)}
          className="absolute bottom-4 right-4 z-[400] bg-white hover:bg-surface-container p-2 rounded-xl border border-outline shadow-lg transition-all"
        >
          <Maximize2 size={18} className="text-primary" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.ideal_location')}</label>
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <AutocompleteInput 
              value={search}
              cityOnly={cityOnly}
              onChange={(val) => setSearch(val)}
              onLocationSelect={(city, country, newLat, newLng) => {
                onChange(newLat, newLng, radius, city, country);
              }}
              placeholder={t('seeker.map_placeholder')}
              className="bg-surface-container-low border border-outline rounded-2xl"
            />
          </div>
        </div>
      </div>

      {MapContent()}

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.radius')}</label>
          <span className="text-xs font-bold text-primary">{radius} {t('seeker.radius_km')}</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="100" 
          step="1"
          value={radius}
          onChange={(e) => onChange(lat, lng, parseInt(e.target.value))}
          className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary" 
        />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-outline overflow-hidden relative"
            >
              <div className="p-6 border-b border-outline flex justify-between items-center bg-surface-container-low">
                <div>
                  <h3 className="text-xl font-display font-black uppercase tracking-tight">{t('seeker.ideal_location')}</h3>
                  <p className="text-xs text-on-surface-variant font-medium">{t('seeker.ideal_location_desc')}</p>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="p-3 hover:bg-surface-container rounded-full transition-all text-on-surface-variant"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6">
                {MapContent(true)}
                
                <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-black uppercase tracking-widest text-primary">{t('seeker.radius')}</label>
                    <span className="text-lg font-black text-primary">{radius} {t('seeker.radius_km')}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    step="1"
                    value={radius}
                    onChange={(e) => onChange(lat, lng, parseInt(e.target.value))}
                    className="w-full h-3 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary" 
                  />
                </div>
              </div>

              <div className="p-6 bg-surface-container-low border-t border-outline flex justify-end">
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="bg-primary text-on-primary px-10 py-3 rounded-2xl font-bold shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';

export function AutocompleteInput({ 
  value, 
  onChange, 
  onLocationSelect,
  placeholder, 
  className = "",
  showIcon = true,
  cityOnly = false,
  disabled = false
}: { 
  value: string; 
  onChange: (val: string) => void; 
  onLocationSelect?: (city: string, country: string, lat: number, lng: number) => void;
  placeholder: string;
  className?: string;
  showIcon?: boolean;
  cityOnly?: boolean;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFilter(value);
  }, [value]);

  const [lastSearched, setLastSearched] = useState('');

  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    if (query === lastSearched) return;
    
    setIsLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
      const response = await fetch(url, {
        headers: { 
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
          'User-Agent': 'CoMatchApp/1.0'
        }
      });
      const data = await response.json();
      setSuggestions(data);
      setLastSearched(query);
    } catch (error) {
      console.error("Geocoding error:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && filter.length >= 3 && filter !== lastSearched) {
        searchLocation(filter);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [filter, isOpen, lastSearched]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        {showIcon && <Search size={18} className="absolute left-4 text-on-surface-variant/50" />}
        <input 
          type="text" 
          value={filter}
          onFocus={() => !disabled && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onChange={(e) => {
            setFilter(e.target.value);
            onChange(e.target.value);
          }}
          className={`w-full bg-transparent border-none outline-none font-bold text-sm py-3 ${showIcon ? 'pl-12' : 'pl-4'} pr-10 ${disabled ? 'cursor-not-allowed opacity-55' : ''}`} 
          placeholder={placeholder} 
          disabled={disabled}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-[150] top-full left-0 right-0 mt-2 bg-white border border-outline rounded-2xl shadow-xl max-h-64 overflow-y-auto no-scrollbar overflow-hidden"
          >
            {suggestions.map((o) => {
              const name = o.display_name;
              const city = o.address.city || o.address.town || o.address.village || o.address.municipality || '';
              const country = o.address.country || '';
              
              return (
                <button 
                  key={o.place_id} 
                  type="button"
                  onClick={() => {
                    const finalVal = city || name.split(',')[0];
                    setFilter(finalVal);
                    onChange(finalVal);
                    if (onLocationSelect) {
                      onLocationSelect(city, country, parseFloat(o.lat), parseFloat(o.lon));
                    }
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-5 py-3 hover:bg-primary/5 border-b border-outline/30 last:border-0 transition-colors"
                >
                  <div className="font-bold text-sm text-on-surface">{city || name.split(',')[0]}</div>
                  <div className="text-[10px] text-on-surface-variant truncate">{name}</div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

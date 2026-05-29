import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

export function TypeAheadSelect({ 
  value, 
  onChange, 
  options,
  placeholder, 
  className = "",
  inputClassName = "w-full bg-surface-container-low border-2 border-outline/50 rounded-2xl p-4 pr-12 font-bold outline-none focus:border-primary transition-all",
  required = false
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: DropdownOption[];
  placeholder: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize filter based on value
  useEffect(() => {
    const selectedOption = options.find(o => o.value === value);
    if (selectedOption) {
      setFilter(selectedOption.label);
    } else {
      setFilter('');
    }
  }, [value, options]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset filter if not selected
        const selectedOption = options.find(o => o.value === value);
        if (selectedOption) {
          setFilter(selectedOption.label);
        } else {
          setFilter('');
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        <input 
          type="text" 
          value={filter}
          onFocus={() => {
            setIsOpen(true);
            setFilter('');
          }}
          onChange={(e) => {
            setFilter(e.target.value);
            setIsOpen(true);
          }}
          required={required && !value}
          className={inputClassName}
          placeholder={placeholder} 
        />
        <ChevronDown 
          size={20} 
          className={`absolute right-4 text-on-surface-variant transition-transform pointer-events-none ${isOpen ? 'rotate-180' : ''}`} 
        />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-[150] top-full left-0 right-0 mt-2 bg-white border border-outline rounded-2xl shadow-xl max-h-64 overflow-y-auto no-scrollbar overflow-hidden"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((o) => (
                <button 
                  key={o.value} 
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setFilter(o.label);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-5 py-3 hover:bg-primary/5 border-b border-outline/30 last:border-0 transition-colors flex justify-between items-center"
                >
                  <span className="font-bold text-sm text-on-surface">{o.label}</span>
                  {value === o.value && <Check size={16} className="text-primary" />}
                </button>
              ))
            ) : (
              <div className="px-5 py-4 text-sm text-on-surface-variant">Geen resultaten gevonden</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

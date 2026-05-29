import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar as CalendarIcon, Info, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

interface Property {
  id: string;
  title: string;
  images?: any[];
  teaserImageId?: string;
  monthlyAvailability?: Record<string, string>;
  features?: any;
  status?: 'available' | 'paused' | 'rented';
  isActive?: boolean;
}

interface AvailabilityHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onPropertiesUpdated: () => void;
}

const STATUS_OPTIONS = [
  { id: 'available', color: 'bg-white text-on-surface border-outline', labelKey: 'availability.available' },
  { id: 'consultation', color: 'bg-[#ffeedd] text-[#cc6600] border-[#ffcc99]', labelKey: 'availability.consultation' },
  { id: 'occupied', color: 'bg-[#ffdddd] text-[#cc0000] border-[#ff9999]', labelKey: 'availability.occupied' },
  { id: 'not_for_rent_month', color: 'bg-surface-variant text-on-surface-variant border-outline-variant', labelKey: 'availability.not_for_rent_month' },
  { id: 'not_available', color: 'bg-surface-container-high text-on-surface-variant border-outline-variant opacity-80', labelKey: 'availability.not_available' },
];

const getStatusOption = (id: string | undefined) => {
  if (!id) return STATUS_OPTIONS[4]; // Default to 'not_available'
  return STATUS_OPTIONS.find(opt => opt.id === id) || STATUS_OPTIONS[4];
};

export default function AvailabilityHubModal({ isOpen, onClose, properties, onPropertiesUpdated }: AvailabilityHubModalProps) {
  const { t, i18n } = useTranslation();
  const [months, setMonths] = useState<{ key: string; label: string; year: number }[]>([]);
  const [activePopover, setActivePopover] = useState<{ propertyId: string; monthKey: string } | null>(null);
  const [localProperties, setLocalProperties] = useState(properties);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    setLocalProperties(properties);
  }, [properties]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const generatedMonths = [];
      const current = new Date();
      current.setDate(1); 

      for (let i = 0; i < 12; i++) {
        const d = new Date(current.getFullYear(), current.getMonth() + i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        // Use i18n.language for correct month names
        const monthName = d.toLocaleString(i18n.language, { month: 'short' });
        generatedMonths.push({
          key: monthKey,
          label: monthName,
          year: d.getFullYear(),
        });
      }
      setMonths(generatedMonths);
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, i18n.language]);

  const handleStatusChange = async (propertyId: string, monthKey: string, newStatus: string) => {
    setActivePopover(null);
    const property = localProperties.find(p => p.id === propertyId);
    if (!property) return;

    const currentAvail = property.monthlyAvailability || {};
    const newAvail = { ...currentAvail, [monthKey]: newStatus };

    // Update local state immediately for optimistic UI
    setLocalProperties(prev => prev.map(p => p.id === propertyId ? { ...p, monthlyAvailability: newAvail } : p));
    
    try {
      await updateDoc(doc(db, 'properties', propertyId), {
        monthlyAvailability: newAvail
      });
      // Optionally notify parent after successful update
      // onPropertiesUpdated(); 
    } catch (error) {
      console.error("Error updating availability", error);
      toast.error(t('dash.error_generic', 'Er is een fout opgetreden.'));
      setLocalProperties(properties); // Revert on error
    }
  };

  const isVakantieWoning = (p: Property) => {
    // Gebruik 'goal' vakantie_onderhuur voor vakantiewoningen (door user benoemd als 'Type')
    // We versoepelen het filter door p.status checks te verwijderen, zodat alle vakantiewoningen beheerd kunnen worden
    return p.features?.goal === 'vakantie_onderhuur';
  };

  const handleBatchStatusChange = async (monthKey: string, newStatus: string) => {
    setActivePopover(null);
    
    try {
      // Update alle gefilterde woningen locally first
      const filteredProperties = localProperties.filter(isVakantieWoning);
      const updatedProps = localProperties.map(p => {
        if (filteredProperties.some(fp => fp.id === p.id)) {
          const newAvail = { ...(p.monthlyAvailability || {}), [monthKey]: newStatus };
          return { ...p, monthlyAvailability: newAvail };
        }
        return p;
      });
      setLocalProperties(updatedProps);
      
      const updates = filteredProperties.map(async (property) => {
        const currentAvail = property.monthlyAvailability || {};
        const newAvail = { ...currentAvail, [monthKey]: newStatus };
        return updateDoc(doc(db, 'properties', property.id), {
          monthlyAvailability: newAvail
        });
      });
      
      await Promise.all(updates);
      toast.success(t('availability.batch_saved', 'Status voor alle woningen in deze maand bijgewerkt'));
      // onPropertiesUpdated();
    } catch (error) {
      console.error("Error updating batch availability", error);
      toast.error(t('dash.error_generic', 'Er is een fout opgetreden.'));
      setLocalProperties(properties);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-2 md:p-6"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background rounded-[2rem] shadow-2xl border border-outline w-full h-full max-h-full flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex-none p-4 md:p-6 border-b border-outline mb-0 bg-surface">
            <div className="flex justify-between items-start md:items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-sm">
                  <CalendarIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-display font-black text-on-background">
                    {t('availability.modal_title', 'Availability Calendar - next 12 months')}
                  </h3>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-3 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors self-start"
              >
                <X size={24} />
              </button>
            </div>

            {/* Legend */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 md:p-4 mt-2">
              <div className="flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center text-sm">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Info size={16} />
                  <span>{t('availability.legend_title', 'Tip:')} {t('availability.legend_tip', 'Kies \'In overleg\' als je de woning op meerdere plekken aanbiedt.')}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {STATUS_OPTIONS.map(opt => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border ${opt.color}`}></div>
                      <span className="text-xs font-semibold text-on-surface-variant flex-1">{t(opt.labelKey)}</span>
                    </div>
                  ))}
                  <div className="text-xs text-on-surface-variant opacity-80 italic mt-1 md:mt-0 w-full md:w-auto">
                    {t('availability.legend_empty_warning', "Maanden die er bijkomen worden standaard als 'Niet in verhuur' getoond voor de veligheid.")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Content */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto bg-surface-container-lowest scrollbar-thin scrollbar-thumb-outline-variant hover:scrollbar-thumb-primary scrollbar-track-transparent" 
            onClick={() => setActivePopover(null)}
          >
            <div className="min-w-max mx-auto max-w-7xl">
              {/* Header Row */}
              <div className="flex border-b border-outline sticky top-0 bg-surface z-20">
                <div className="w-80 min-w-[20rem] max-w-[20rem] flex-shrink-0 p-4 font-bold text-on-surface-variant text-sm uppercase tracking-wide border-r border-outline sticky left-0 bg-surface shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-30 flex justify-between items-center">
                  <span>{t('availability.property', 'Woning')}</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); scroll('left'); }}
                      className="p-1 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); scroll('right'); }}
                      className="p-1 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                {months.map(m => (
                  <div key={m.key} className="w-32 min-w-[8rem] flex-shrink-0 p-4 text-center border-r border-outline border-opacity-50 cursor-pointer hover:bg-surface-container transition-colors relative group"
                       onClick={(e) => {
                         e.stopPropagation();
                         setActivePopover(activePopover?.monthKey === `${m.key}-batch` ? null : { propertyId: 'batch', monthKey: `${m.key}-batch` });
                       }}>
                    <div className="font-black text-on-surface">{m.label}</div>
                    <div className="text-xs text-on-surface-variant font-bold">{m.year}</div>
                    
                    {/* Batch Popover */}
                    {activePopover?.monthKey === `${m.key}-batch` && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 bg-surface rounded-2xl shadow-xl border border-outline w-48 p-2 flex flex-col gap-1 mt-2"
                           onClick={(e) => e.stopPropagation()}>
                        <div className="text-[10px] font-black uppercase tracking-widest px-2 py-1 text-on-surface-variant mb-1">
                          {t('availability.batch_update', 'Hele maand updaten')}
                        </div>
                        {STATUS_OPTIONS.map(statusOpt => (
                          <button
                            key={statusOpt.id}
                            onClick={(e) => { e.stopPropagation(); handleBatchStatusChange(m.key, statusOpt.id); }}
                            className={`px-3 py-2 text-xs font-bold text-left rounded-xl hover:brightness-95 transition-all ${statusOpt.color}`}
                          >
                            {t(statusOpt.labelKey)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Property Rows */}
              {localProperties.filter(isVakantieWoning).map(property => {
                const teaserImage = property.images && property.images.length > 0 
                  ? property.images.find((i: any) => i.id === property.teaserImageId) || property.images[0] 
                  : null;

                return (
                  <div key={property.id} className="flex border-b border-outline hover:bg-surface-container-low/50 transition-colors">
                    {/* Fixed Title Column */}
                    <div className="w-80 min-w-[20rem] max-w-[20rem] flex-shrink-0 p-3 border-r border-outline sticky left-0 bg-surface shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-10 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container overflow-hidden flex-shrink-0">
                        {teaserImage ? (
                          <img src={teaserImage.url} alt={property.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-outline-variant font-bold text-xs bg-surface-variant">Img</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <div className="font-bold text-sm text-on-surface leading-tight break-words">
                          {property.title}
                        </div>
                        <div className={`inline-flex items-center w-fit px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                          property.status === 'available' 
                            ? 'bg-success/10 text-success border-success/20' 
                            : 'bg-error/10 text-error border-error/20'
                        }`}>
                          {property.status === 'available' ? 'Actief' : 'Gepauzeerd'}
                        </div>
                      </div>
                    </div>

                    {/* Months Cells */}
                    {months.map(m => {
                      const currentStatusId = property.monthlyAvailability?.[m.key] || 'not_available';
                      const opt = getStatusOption(currentStatusId);
                      const isPopoverActive = activePopover?.propertyId === property.id && activePopover?.monthKey === m.key;

                      return (
                        <div key={m.key} className="w-32 min-w-[8rem] flex-shrink-0 p-2 border-r border-outline border-opacity-50 relative flex items-center justify-center cursor-pointer group">
                          
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePopover(isPopoverActive ? null : { propertyId: property.id, monthKey: m.key });
                            }}
                            className={`w-full h-full min-h-[3rem] ${opt.color} border-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center text-center p-1 transition-all group-hover:brightness-95`}
                          >
                            <span>{t(opt.labelKey)}</span>
                            <ChevronDown size={12} className="opacity-50 mt-0.5" />
                          </div>

                          {/* Popover */}
                          {isPopoverActive && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface rounded-2xl shadow-xl border border-outline w-48 p-2 flex flex-col gap-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                              <div className="text-[10px] font-black uppercase tracking-widest px-2 py-1 text-on-surface-variant mb-1">
                                {m.label} {m.year}
                              </div>
                              {STATUS_OPTIONS.map(statusOpt => (
                                <button
                                  key={statusOpt.id}
                                  onClick={() => handleStatusChange(property.id, m.key, statusOpt.id)}
                                  className={`px-3 py-2 text-xs font-bold text-left rounded-xl hover:brightness-95 transition-all outline outline-1 outline-transparent hover:outline-primary/20 ${statusOpt.color} ${currentStatusId === statusOpt.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                                >
                                  {t(statusOpt.labelKey)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

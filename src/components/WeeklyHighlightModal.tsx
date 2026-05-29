import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Newspaper, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  ArrowRight,
  TrendingUp,
  Info
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { deductCredits } from '../services/creditService';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Property } from './ProviderDashboard';

interface WeeklyHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const WeeklyHighlightModal: React.FC<WeeklyHighlightModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [globalCount, setGlobalCount] = useState<number>(0);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Native calculations for Monday date representation (YYYY-MM-DD)
  const getWeekId = (offsetWeeks: number = 0) => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff + offsetWeeks * 7));
    monday.setHours(0, 0, 0, 0);
    
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const activeWeekId = getWeekId(0);
  const upcomingWeekId = getWeekId(1); // De week na de actieve week (komende week)

  const formatWeekDisplay = (weekIdStr: string) => {
    const [year, month, day] = weekIdStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('nl', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // 1. Listen to current user's properties in real-time
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'properties'),
      where('ownerId', '==', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Property[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Property));
      setProperties(fetched);
    }, (error) => {
      console.error("Error listening to user properties:", error);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to user credits in real-time
  useEffect(() => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserCredits(snap.data().credits || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. Listen to global highlights taken for the upcoming week
  useEffect(() => {
    const q = query(
      collection(db, 'properties'),
      where('highlightWeeks', 'array-contains', upcomingWeekId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGlobalCount(snapshot.size);
    }, (error) => {
      console.error("Error fetching global highlights:", error);
    });
    return () => unsubscribe();
  }, [upcomingWeekId]);

  // Determine if this provider already has a property highlighted for next week
  const providerHighlightedProperty = properties.find(p => 
    p.highlightWeeks && p.highlightWeeks.includes(upcomingWeekId)
  );

  const availableSpots = Math.max(0, 10 - globalCount);

  // Filter properties of this provider that could be highlighted
  const highlightableProperties = properties.filter(p => p.status === 'available');

  // Set default selected property if not set
  useEffect(() => {
    if (highlightableProperties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(highlightableProperties[0].id);
    }
  }, [highlightableProperties, selectedPropertyId]);

  const handleOpenCredits = () => {
    window.dispatchEvent(new Event('open-credits-modal'));
  };

  const handleHighlightProperty = async () => {
    if (!auth.currentUser) return;
    if (!selectedPropertyId) {
      toast.error("Selecteer a.b.v. een woning.");
      return;
    }

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    if (!selectedProperty) return;

    setIsSubmitting(true);
    try {
      // 1. Credit check (15 credits needed)
      if (userCredits < 15) {
        toast.error("Onvoldoende credits! Je hebt 15 credits nodig.");
        setIsSubmitting(false);
        return;
      }

      // 2. Double check rules
      if (providerHighlightedProperty) {
        toast.error("Je hebt al een woning geselecteerd voor de komende week.");
        setIsSubmitting(false);
        return;
      }

      if (availableSpots <= 0) {
        toast.error("Helaas, alle plekken zijn al volgeboekt.");
        setIsSubmitting(false);
        return;
      }

      // 3. Deduct Credits
      const reason = `Wekelijkse Digest Highlight voor woning: ${selectedProperty.title} (Week van ${upcomingWeekId})`;
      const success = await deductCredits(15, reason);
      if (!success) {
        setIsSubmitting(false);
        return;
      }

      // 4. Update Property (add upcomingWeekId to highlightWeeks list)
      const propertyRef = doc(db, 'properties', selectedProperty.id);
      await updateDoc(propertyRef, {
        highlightWeeks: arrayUnion(upcomingWeekId),
        updatedAt: serverTimestamp()
      });

      toast.success(`Gelukt! '${selectedProperty.title}' is succesvol gehighlight voor de komende week.`);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error("Fout tijdens toevoegen van highlight:", error);
      toast.error("Er is een fout opgetreden bij het verwerken van de transactie.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#090D16]/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface border border-surface-container-highest shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-surface-container-high px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Newspaper size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-on-surface">
                  Wekelijkse Digest Highlight
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  Zet jouw woning in de spotlight voor maximaal bereik
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Explanation */}
            <div className="rounded-2xl bg-surface-container-low p-4 border border-surface-container-high space-y-3">
              <div className="flex gap-2.5 items-start">
                <Sparkles className="text-amber-500 fill-amber-500/10 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Een woning aanbieder kan zijn woning in onze <strong>Weekly Digest</strong> e-mail en op de homepage laten highlighten. Dit trekt extra veel geïnteresseerde co-housing partners aan!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-surface-container-high text-xs text-on-surface-variant font-medium">
                <div className="flex items-center gap-1.5">
                  <Coins size={14} className="text-primary" />
                  <span>Kosten: 15 credits per woning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-primary" />
                  <span>Maximaal 1 woning per week</span>
                </div>
              </div>
            </div>

            {/* Current Spotlight Status */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-medium text-on-surface">
                <span>Plekken voor de komende week:</span>
                <span className="text-xs underline bg-primary/5 text-primary py-0.5 px-2 rounded-full">
                  Komende week ({formatWeekDisplay(upcomingWeekId)})
                </span>
              </div>

              {/* Spots Counter Widget */}
              <div className="rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 text-center relative overflow-hidden">
                <div className="flex justify-around items-center">
                  <div className="space-y-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Inzetbaar</span>
                    <p className="text-3xl font-display font-black text-on-surface">10</p>
                  </div>
                  <div className="h-8 w-px bg-surface-container-high" />
                  <div className="space-y-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Bezet</span>
                    <p className="text-3xl font-display font-black text-amber-500">{globalCount}</p>
                  </div>
                  <div className="h-8 w-px bg-surface-container-high" />
                  <div className="space-y-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Vrij</span>
                    <p className={`text-3xl font-display font-black ${availableSpots > 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {availableSpots}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${(globalCount / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Status Message */}
              {availableSpots > 0 ? (
                <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 rounded-xl p-3 flex gap-2 items-center text-xs font-semibold">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>Er zijn nog {availableSpots} van de 10 plekken vrij voor de week van {formatWeekDisplay(upcomingWeekId)}.</span>
                </div>
              ) : (
                <div className="bg-amber-500/5 text-amber-600 border border-amber-500/10 rounded-xl p-3 space-y-2 text-xs font-medium">
                  <div className="flex gap-2 items-center font-bold">
                    <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                    <span>Alle 10 plekken voor de komende week zijn al bezet!</span>
                  </div>
                  <p className="pl-6 text-on-surface-variant leading-relaxed">
                    Volgende week zijn er weer nieuwe kansen. De plekken voor de week daarna vallen vrij vanaf: <strong className="text-on-surface">{formatWeekDisplay(upcomingWeekId)} om 0:00 uur CET</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Selector or Status */}
            {providerHighlightedProperty ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center space-y-2">
                <span className="inline-block px-2.5 py-1 text-[11px] font-black tracking-wider uppercase rounded-full bg-amber-500/15 text-amber-600">
                  Reeds Geactiveerd (Orange Tag)
                </span>
                <p className="text-sm font-medium text-on-surface">
                  Je hebt al een woning gehighlight voor de week van {formatWeekDisplay(upcomingWeekId)}:
                </p>
                <p className="font-bold text-primary text-base">
                  &ldquo;{providerHighlightedProperty.title}&rdquo;
                </p>
                <p className="text-xs text-on-surface-variant leading-relaxed pt-1">
                  Je kunt maximaal 1 woning per week in de digest laten highlighten. In het dashboard zie je deze woning gemarkeerd met een <strong>oranje tag</strong>.
                </p>
              </div>
            ) : availableSpots === 0 ? (
              <div className="rounded-2xl border border-surface-container-high bg-surface-container-low p-4 text-center">
                <Info size={20} className="mx-auto text-on-surface-variant mb-2" />
                <p className="text-sm font-medium text-on-surface-variant">
                  Je kunt momenteel geen woning aanmelden omdat alle 10 plekken लिए voor komende week zijn bezet. Probeer het opnieuw zodra de nieuwe week start!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-on-surface">Highlight Woning Selecteren</h4>

                {highlightableProperties.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-surface-container-high p-4 text-center text-xs text-on-surface-variant">
                    Je hebt momenteel geen beschikbare woningen om te highlighten. Maak eerst een woning aan of zet je woningen op &quot;beschikbaar&quot;.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Kies een woning:
                    </label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full rounded-xl border border-surface-container-high bg-surface px-3 py-2.5 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
                    >
                      {highlightableProperties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.city || "Geen stad"})
                        </option>
                      ))}
                    </select>

                    {/* Credit overview card */}
                    <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3.5 border border-surface-container-high">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Jouw Saldo</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-lg font-black ${userCredits >= 15 ? "text-on-surface" : "text-red-500"}`}>
                            {userCredits}
                          </span>
                          <span className="text-xs text-on-surface-variant font-semibold">Credits</span>
                        </div>
                      </div>
                      <ArrowRight className="text-on-surface-variant shrink-0" size={16} />
                      <div className="space-y-0.5 text-right">
                        <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Benodigd</span>
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-lg font-black text-primary">15</span>
                          <span className="text-xs text-primary font-semibold">Credits</span>
                        </div>
                      </div>
                    </div>

                    {userCredits < 15 && (
                      <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3 space-y-2 text-xs">
                        <p className="text-red-500 font-bold flex gap-1.5 items-center">
                          <AlertTriangle size={15} />
                          Onvoldoende credits!
                        </p>
                        <p className="text-on-surface-variant">
                          Je hebt minimaal 15 credits nodig. Klik hieronder om extra credits op te laden.
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenCredits}
                          className="text-primary font-bold hover:underline"
                        >
                          Klik hier om credits te kopen &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-surface-container-high bg-surface-container-low px-6 py-4 flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition disabled:opacity-50"
            >
              Annuleren
            </button>
            {!providerHighlightedProperty && availableSpots > 0 && highlightableProperties.length > 0 && (
              <button
                onClick={handleHighlightProperty}
                disabled={isSubmitting || userCredits < 15}
                className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50 active:scale-95 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verwerken...</span>
                  </>
                ) : (
                  <span>Highlight Activeren (15 credits)</span>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

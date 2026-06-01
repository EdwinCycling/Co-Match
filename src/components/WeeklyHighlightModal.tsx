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
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { deductCredits } from '../services/creditService';
import { toast } from 'react-hot-toast';
import { useTranslation, Trans } from 'react-i18next';
import type { Property } from './ProviderDashboard';
import { addPropertyHighlightWeek } from '../services/propertyService';
import { CREDIT_COSTS } from '../constants';

const HIGHLIGHT_SPOT_CAPACITY = 10;
const HIGHLIGHT_CREDIT_COST = CREDIT_COSTS.WEEKLY_HIGHLIGHT;

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
  const { t, i18n } = useTranslation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [globalCount, setGlobalCount] = useState<number>(0);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  const upcomingWeekId = getWeekId(1);

  const formatWeekDisplay = (weekIdStr: string) => {
    const [year, month, day] = weekIdStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
  };

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

  const providerHighlightedProperty = properties.find(p => 
    p.highlightWeeks && p.highlightWeeks.includes(upcomingWeekId)
  );

  const availableSpots = Math.max(0, HIGHLIGHT_SPOT_CAPACITY - globalCount);
  const highlightableProperties = properties.filter(p => p.status === 'available');
  const upcomingWeekLabel = formatWeekDisplay(upcomingWeekId);

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
      toast.error(t('weeklyHighlight.toast_select_property'));
      return;
    }

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    if (!selectedProperty) return;

    setIsSubmitting(true);
    try {
      if (userCredits < HIGHLIGHT_CREDIT_COST) {
        toast.error(t('weeklyHighlight.toast_insufficient', { credits: HIGHLIGHT_CREDIT_COST }));
        setIsSubmitting(false);
        return;
      }

      if (providerHighlightedProperty) {
        toast.error(t('weeklyHighlight.toast_already_highlighted'));
        setIsSubmitting(false);
        return;
      }

      if (availableSpots <= 0) {
        toast.error(t('weeklyHighlight.toast_all_full'));
        setIsSubmitting(false);
        return;
      }

      const reason = t('weeklyHighlight.credit_reason', {
        title: selectedProperty.title,
        weekId: upcomingWeekId,
      });
      const success = await deductCredits(HIGHLIGHT_CREDIT_COST, reason);
      if (!success) {
        setIsSubmitting(false);
        return;
      }

      await addPropertyHighlightWeek(selectedProperty.id, upcomingWeekId);

      toast.success(t('weeklyHighlight.toast_success', { title: selectedProperty.title }));
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error adding highlight:", error);
      toast.error(t('weeklyHighlight.toast_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#090D16]/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface border border-surface-container-highest shadow-2xl flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between border-b border-surface-container-high px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Newspaper size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-on-surface">
                  {t('weeklyHighlight.title')}
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  {t('weeklyHighlight.subtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="rounded-2xl bg-surface-container-low p-4 border border-surface-container-high space-y-3">
              <div className="flex gap-2.5 items-start">
                <Sparkles className="text-amber-500 fill-amber-500/10 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  <Trans i18nKey="weeklyHighlight.desc" components={{ strong: <strong /> }} />
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-surface-container-high text-xs text-on-surface-variant font-medium">
                <div className="flex items-center gap-1.5">
                  <Coins size={14} className="text-primary" />
                  <span>{t('weeklyHighlight.cost', { credits: HIGHLIGHT_CREDIT_COST })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-primary" />
                  <span>{t('weeklyHighlight.max_one_per_week')}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-medium text-on-surface">
                <span>{t('weeklyHighlight.spots_label')}</span>
                <span className="text-xs underline bg-primary/5 text-primary py-0.5 px-2 rounded-full">
                  {t('weeklyHighlight.coming_week', { date: upcomingWeekLabel })}
                </span>
              </div>

              <div className="rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 text-center relative overflow-hidden">
                <div className="flex justify-around items-center">
                  <div className="space-y-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">{t('weeklyHighlight.capacity_total')}</span>
                    <p className="text-3xl font-display font-black text-on-surface">{HIGHLIGHT_SPOT_CAPACITY}</p>
                  </div>
                  <div className="h-8 w-px bg-surface-container-high" />
                  <div className="space-y-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">{t('weeklyHighlight.occupied')}</span>
                    <p className="text-3xl font-display font-black text-amber-500">{globalCount}</p>
                  </div>
                  <div className="h-8 w-px bg-surface-container-high" />
                  <div className="space-y-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">{t('weeklyHighlight.available')}</span>
                    <p className={`text-3xl font-display font-black ${availableSpots > 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {availableSpots}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${(globalCount / HIGHLIGHT_SPOT_CAPACITY) * 100}%` }}
                  />
                </div>
              </div>

              {availableSpots > 0 ? (
                <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 rounded-xl p-3 flex gap-2 items-center text-xs font-semibold">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>
                    {t('weeklyHighlight.spots_remaining', {
                      available: availableSpots,
                      total: HIGHLIGHT_SPOT_CAPACITY,
                      date: upcomingWeekLabel,
                    })}
                  </span>
                </div>
              ) : (
                <div className="bg-amber-500/5 text-amber-600 border border-amber-500/10 rounded-xl p-3 space-y-2 text-xs font-medium">
                  <div className="flex gap-2 items-center font-bold">
                    <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                    <span>{t('weeklyHighlight.all_full_title', { total: HIGHLIGHT_SPOT_CAPACITY })}</span>
                  </div>
                  <p className="pl-6 text-on-surface-variant leading-relaxed">
                    <Trans
                      i18nKey="weeklyHighlight.all_full_desc"
                      values={{ date: upcomingWeekLabel }}
                      components={{ strong: <strong className="text-on-surface" /> }}
                    />
                  </p>
                </div>
              )}
            </div>

            {providerHighlightedProperty ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center space-y-2">
                <span className="inline-block px-2.5 py-1 text-[11px] font-black tracking-wider uppercase rounded-full bg-amber-500/15 text-amber-600">
                  {t('weeklyHighlight.already_active_badge')}
                </span>
                <p className="text-sm font-medium text-on-surface">
                  {t('weeklyHighlight.already_active_desc', { date: upcomingWeekLabel })}
                </p>
                <p className="font-bold text-primary text-base">
                  &ldquo;{providerHighlightedProperty.title}&rdquo;
                </p>
                <p className="text-xs text-on-surface-variant leading-relaxed pt-1">
                  <Trans i18nKey="weeklyHighlight.already_active_hint" components={{ strong: <strong /> }} />
                </p>
              </div>
            ) : availableSpots === 0 ? (
              <div className="rounded-2xl border border-surface-container-high bg-surface-container-low p-4 text-center">
                <Info size={20} className="mx-auto text-on-surface-variant mb-2" />
                <p className="text-sm font-medium text-on-surface-variant">
                  {t('weeklyHighlight.cannot_apply_full', { total: HIGHLIGHT_SPOT_CAPACITY })}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-on-surface">{t('weeklyHighlight.select_title')}</h4>

                {highlightableProperties.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-surface-container-high p-4 text-center text-xs text-on-surface-variant">
                    {t('weeklyHighlight.no_properties')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      {t('weeklyHighlight.choose_property')}
                    </label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full rounded-xl border border-surface-container-high bg-surface px-3 py-2.5 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
                    >
                      {highlightableProperties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.city || t('weeklyHighlight.no_city')})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3.5 border border-surface-container-high">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{t('weeklyHighlight.your_balance')}</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-lg font-black ${userCredits >= HIGHLIGHT_CREDIT_COST ? "text-on-surface" : "text-red-500"}`}>
                            {userCredits}
                          </span>
                          <span className="text-xs text-on-surface-variant font-semibold">{t('weeklyHighlight.credits')}</span>
                        </div>
                      </div>
                      <ArrowRight className="text-on-surface-variant shrink-0" size={16} />
                      <div className="space-y-0.5 text-right">
                        <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{t('weeklyHighlight.required')}</span>
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-lg font-black text-primary">{HIGHLIGHT_CREDIT_COST}</span>
                          <span className="text-xs text-primary font-semibold">{t('weeklyHighlight.credits')}</span>
                        </div>
                      </div>
                    </div>

                    {userCredits < HIGHLIGHT_CREDIT_COST && (
                      <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3 space-y-2 text-xs">
                        <p className="text-red-500 font-bold flex gap-1.5 items-center">
                          <AlertTriangle size={15} />
                          {t('weeklyHighlight.insufficient_title')}
                        </p>
                        <p className="text-on-surface-variant">
                          {t('weeklyHighlight.insufficient_desc', { credits: HIGHLIGHT_CREDIT_COST })}
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenCredits}
                          className="text-primary font-bold hover:underline"
                        >
                          {t('weeklyHighlight.buy_credits_link')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-surface-container-high bg-surface-container-low px-6 py-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition disabled:opacity-50"
            >
              {t('weeklyHighlight.cancel')}
            </button>
            {!providerHighlightedProperty && availableSpots > 0 && highlightableProperties.length > 0 && (
              <button
                type="button"
                onClick={handleHighlightProperty}
                disabled={isSubmitting || userCredits < HIGHLIGHT_CREDIT_COST}
                className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50 active:scale-95 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('weeklyHighlight.processing')}</span>
                  </>
                ) : (
                  <span>{t('weeklyHighlight.activate_btn', { credits: HIGHLIGHT_CREDIT_COST })}</span>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

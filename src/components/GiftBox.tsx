import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, X, Sparkles, Share2, Check, ArrowRight, Video, Layers, Volume2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import ModalPopup from './ModalPopup';

interface GiftItem {
  id: string;
  title: string;
  message: string;
  targetAudience: 'all' | 'huis_zoeker' | 'huis_aanbieder';
  startDate: string;
  isHighPriority: boolean;
  type?: 'new' | 'improvement';
  imageUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface GiftBoxProps {
  user: any;
  userRole: string | null;
}

interface SparkParticle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
}

export default function GiftBox({ user, userRole }: GiftBoxProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [openedIds, setOpenedIds] = useState<string[]>([]);
  const [isWiggling, setIsWiggling] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const [particles, setParticles] = useState<SparkParticle[]>([]);
  const [deepLinkedId, setDeepLinkedId] = useState<string | null>(null);
  const [explosionOrigin, setExplosionOrigin] = useState({ x: 0, y: 0 });
  const [shareLinkModal, setShareLinkModal] = useState<{ link: string; message: string } | null>(null);
  const autoUnboxChecked = useRef(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  // Load user's opened gifts from localStorage
  useEffect(() => {
    if (user) {
      try {
        const stored = localStorage.getItem(`opened_gifts_${user.uid}`);
        if (stored) {
          setOpenedIds(JSON.parse(stored));
        } else {
          setOpenedIds([]);
        }
      } catch (e) {
        console.error("Error parsing opened gifts:", e);
      }
    }
  }, [user]);

  // Keep saved opened gifts updated in localStorage
  const saveOpenedIds = (ids: string[]) => {
    if (user) {
      setOpenedIds(ids);
      localStorage.setItem(`opened_gifts_${user.uid}`, JSON.stringify(ids));
    }
  };

  // Watch for gifts in Firestore real-time
  useEffect(() => {
    if (!user) return;

    const giftsQuery = query(collection(db, 'gifts'), orderBy('startDate', 'desc'));
    
    const unsubscribe = onSnapshot(giftsQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem));
      
      // Filter based on drop date and targetAudience (role)
      const nowStr = new Date().toISOString(); // Compare in ISO
      const activeItems = items.filter(item => {
        // Drop Date compare (compare strictly as strings YYYY-MM-DDTHH:mm or ISO)
        // If start date is formatted as local YYYY-MM-DDTHH:mm, we can compare it
        const currentISO = new Date().toISOString();
        const startISO = new Date(item.startDate).toISOString();
        
        const isStarted = startISO <= currentISO;
        const matchesAudience = item.targetAudience === 'all' || item.targetAudience === userRole || userRole === 'admin';
        
        return isStarted && matchesAudience;
      });

      setGifts(activeItems);

      // Deep linking check
      const params = new URLSearchParams(window.location.search);
      const giftParam = params.get('giftId');
      if (giftParam && activeItems.some(item => item.id === giftParam)) {
        setDeepLinkedId(giftParam);
        setIsOpen(true);
        // Clear query parameter silently
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      }

      // Check auto-unbox for High Priority unopened gifts (only once on load)
      if (!autoUnboxChecked.current && activeItems.length > 0) {
        autoUnboxChecked.current = true;
        
        try {
          const stored = localStorage.getItem(`opened_gifts_${user.uid}`);
          const opened = stored ? JSON.parse(stored) : [];
          
          const hasUnopenedHighPriority = activeItems.some(
            item => item.isHighPriority && !opened.includes(item.id)
          );
          
          if (hasUnopenedHighPriority) {
            // Trigger automatic unbox with delayed timing
            setTimeout(() => {
              triggerPopAnimation();
              setIsOpen(true);
            }, 1500);
          }
        } catch (err) {
          console.error("Error auto-unboxing:", err);
        }
      }
    }, (error) => {
      console.error("Error listening to gifts:", error);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // Wiggle trigger effect: check for unopened gifts and wiggle every 30 seconds
  useEffect(() => {
    const checkUnopenedAndWiggle = () => {
      const unopenedCount = gifts.filter(g => !openedIds.includes(g.id)).length;
      if (unopenedCount > 0) {
        setIsWiggling(true);
        setTimeout(() => setIsWiggling(false), 1500);
      }
    };

    // Initial check after 5 seconds, then every 30 seconds
    const initialTimer = setTimeout(checkUnopenedAndWiggle, 5000);
    const interval = setInterval(checkUnopenedAndWiggle, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [gifts, openedIds]);

  const resolveExplosionOrigin = () => {
    const button = triggerButtonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      setExplosionOrigin({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      return;
    }

    setExplosionOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  };

  // Fireworks only for unopened gifts — rendered above the blurred overlay via portal
  const triggerPopAnimation = () => {
    if (gifts.filter(g => !openedIds.includes(g.id)).length === 0) {
      return;
    }

    resolveExplosionOrigin();
    setIsExploding(true);
    
    // Generate 45 neat radiant sparkles
    const newParticles: SparkParticle[] = Array.from({ length: 45 }).map((_, i) => ({
      id: Math.random() + i,
      angle: (i / 45) * 360 + (Math.random() * 24 - 12),
      distance: 90 + Math.random() * 140,
      size: 4 + Math.random() * 7,
      color: ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#6366f1"][i % 6],
      delay: Math.random() * 0.15,
    }));
    
    setParticles(newParticles);
    
    // Reset explosion visual state
    setTimeout(() => {
      setIsExploding(false);
    }, 1200);
  };

  const handleIconClick = () => {
    const willOpen = !isOpen;
    const hasUnopened = gifts.some(g => !openedIds.includes(g.id));
    if (willOpen && hasUnopened) {
      triggerPopAnimation();
    }
    setIsOpen(willOpen);
  };

  const markAllAsRead = () => {
    const allIds = gifts.map(g => g.id);
    saveOpenedIds(allIds);
    toast.success(t('gifts.toast_all_read', 'Alle cadeautjes gemarkeerd als geopend!'));
  };

  const toggleOpenedStatus = (id: string) => {
    if (openedIds.includes(id)) {
      const updated = openedIds.filter(x => x !== id);
      saveOpenedIds(updated);
    } else {
      const updated = [...openedIds, id];
      saveOpenedIds(updated);
    }
  };

  const handleShare = async (gift: GiftItem) => {
    // Generate direct share deep link
    const deepLink = `${window.location.origin}${window.location.pathname}?giftId=${gift.id}`;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(deepLink);
        toast.success(t('gifts.share_success', "Deellink gekopieerd naar klembord! Deel het met je collega's."), {
          style: { background: '#10b981', color: '#fff' }
        });
      } else {
        // Fallback for non-secure contexts (like some iframes)
        const textArea = document.createElement("textarea");
        textArea.value = deepLink;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            toast.success(t('gifts.share_success', "Deellink gekopieerd naar klembord! Deel het met je collega's."), {
              style: { background: '#10b981', color: '#fff' }
            });
          } else {
            throw new Error('execCommand returned false');
          }
        } catch (error) {
          console.error('Fallback copy fails', error);
          // Let the outer catch block handle showing the modal for manual copy
          throw error;
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      setShareLinkModal({
        link: deepLink,
        message: t('gifts.share_fail', 'Kopieer deze link handmatig:'),
      });
    }
  };

  const unopenedGiftsCount = gifts.filter(g => !openedIds.includes(g.id)).length;

  return (
    <>
      <ModalPopup
        isOpen={!!shareLinkModal}
        title={t('gifts.share_modal_title', 'Deel link')}
        message={shareLinkModal?.message || ''}
        copyValue={shareLinkModal?.link}
        copyButtonText={t('common.copy', 'Kopiëren')}
        onClose={() => setShareLinkModal(null)}
      />
    <div className="relative flex items-center justify-center">
      {/* Trigger Button */}
      <button
        ref={triggerButtonRef}
        id="gift-trigger-button"
        onClick={handleIconClick}
        className={`relative p-2.5 rounded-xl transition-all duration-300 focus:outline-none flex items-center justify-center ${
          isOpen 
            ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20' 
            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary active:scale-95'
        }`}
        title={t('gifts.trigger_tooltip', 'Ontdek nieuwe features!')}
      >
        <motion.div
          animate={isWiggling ? { 
            rotate: [0, -14, 14, -14, 14, -8, 8, -4, 4, 0],
            scale: [1, 1.2, 1.2, 1.2, 1.2, 1.1, 1.1, 1, 1, 1] 
          } : {}}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        >
          <Gift size={22} className={unopenedGiftsCount > 0 ? "text-primary hover:text-primary" : ""} />
        </motion.div>

        {/* Heartbeat Badge */}
        <AnimatePresence>
          {unopenedGiftsCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 font-sans font-black text-[9px] text-white items-center justify-center shadow-md">
                {unopenedGiftsCount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Slideout Frosted Glass Overlay & Panel */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isExploding && (
            <div
              key="gift-fireworks"
              className="fixed pointer-events-none z-[100002] overflow-visible"
              style={{
                left: explosionOrigin.x,
                top: explosionOrigin.y,
                transform: 'translate(-50%, -50%)',
              }}
              aria-hidden
            >
              {particles.map((p) => {
                const rad = (p.angle * Math.PI) / 180;
                const targetX = Math.cos(rad) * p.distance;
                const targetY = Math.sin(rad) * p.distance;

                return (
                  <motion.div
                    key={p.id}
                    initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                    animate={{
                      x: targetX,
                      y: targetY,
                      scale: [1, 1.2, 0.4],
                      opacity: [1, 1, 0],
                      rotate: [0, 180, 360 + Math.random() * 360],
                    }}
                    transition={{
                      duration: 0.8 + Math.random() * 0.4,
                      delay: p.delay,
                      ease: 'easeOut',
                    }}
                    className="absolute rounded-full"
                    style={{
                      width: p.size,
                      height: p.size,
                      backgroundColor: p.color,
                      boxShadow: `0 0 10px ${p.color}`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Dark blur-overlay */}
              <motion.div
                key="giftbox-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100000] cursor-pointer"
              />

              {/* Sliding Panel */}
              <motion.div
                key="giftbox-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 190 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background/90 text-on-background backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.15)] z-[100001] border-l border-outline/20 flex flex-col overflow-hidden"
              >
              {/* Header */}
              <div className="p-6 border-b border-outline/20 flex items-center justify-between bg-surface/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Sparkles size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black text-on-background">{t('gifts.header_title', 'Feature Gifts')}</h2>
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{t('gifts.unboxing', 'Jouw interactieve updates')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unopenedGiftsCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high font-bold transition-all"
                      title={t('gifts.mark_all_read_desc', 'Markeer alle als geopend')}
                    >
                      {t('gifts.mark_all_read', 'Alles gelezen')}
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Feed Card List Container */}
              <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 flex flex-col pb-24">
                {gifts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center text-3xl">
                      🦖
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-on-surface">{t('gifts.none_found_title', 'Geen cadeautjes gevonden')}</h4>
                      <p className="text-sm text-on-surface-variant mt-1">{t('gifts.none_found_desc', 'We hebben momenteel geen actieve updates voor je gepland. Kom snel terug!')}</p>
                    </div>
                  </div>
                ) : (
                  gifts.map((gift) => {
                    const isOpened = openedIds.includes(gift.id);
                    const isDeepLinked = gift.id === deepLinkedId;
                    
                    return (
                      <motion.div
                        key={gift.id}
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-300 flex flex-col ${
                          isOpened 
                            ? 'bg-surface-container-low border-outline/20 shadow-sm opacity-80' 
                            : isDeepLinked
                              ? 'bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border-purple-300 ring-2 ring-purple-600/20 shadow-xl'
                              : 'bg-surface border-outline shadow-md hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        {/* Shimmer sparkle decoration for unopened items */}
                        {!isOpened && (
                          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 via-transparent to-transparent pointer-events-none rounded-bl-3xl" />
                        )}

                        {/* Card Hero Image */}
                        {gift.imageUrl && (
                          <div className="h-44 w-full relative overflow-hidden bg-surface-container border-b border-outline/20">
                            <img 
                              src={gift.imageUrl} 
                              alt={gift.title} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            {!isOpened && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                            )}
                          </div>
                        )}

                        {/* Top Accent Strip */}
                        {!isOpened && !gift.imageUrl && (
                          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
                        )}

                        {/* Card Body */}
                        <div className="p-6 space-y-4">
                          {/* Vibrant Gradient Badge */}
                          <div className="flex flex-wrap items-center gap-2">
                            {gift.isHighPriority && (
                              <span className="bg-red-500 text-white font-black text-[9px] tracking-widest px-2.5 py-0.5 rounded-full uppercase shadow-sm">
                                {t('gifts.high_priority', '🔥 HIGH PRIORITY')}
                              </span>
                            )}
                            {(gift.type || 'new') === 'new' ? (
                              <span className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black text-[10px] tracking-widest px-2.5 py-0.5 rounded-full uppercase shadow-md shadow-pink-500/10 flex items-center gap-1">
                                <span>🎁</span> {t('gifts.tag_new', 'NEW')}
                              </span>
                            ) : (
                              <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black text-[10px] tracking-widest px-2.5 py-0.5 rounded-full uppercase shadow-md shadow-blue-500/10 flex items-center gap-1">
                                <span>🚀</span> {t('gifts.tag_improvement', 'IMPROVEMENT')}
                              </span>
                            )}

                            {/* Unread dot indicator */}
                            {!isOpened && (
                              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>

                          {/* Title */}
                          <h3 className={`text-lg font-display font-black leading-snug tracking-tight ${
                            isOpened ? 'text-on-surface-variant' : 'text-on-background group-hover:text-primary transition-colors'
                          }`}>
                            {gift.title}
                          </h3>

                          {/* Message Body with clean styling & supports whitespace preservation */}
                          <p className={`text-sm leading-relaxed font-medium whitespace-pre-line ${
                            isOpened ? 'text-on-surface-variant/80' : 'text-on-surface-variant'
                          }`}>
                            {gift.message}
                          </p>

                          {/* Actions Panel */}
                          <div className="pt-4 border-t border-outline/20 flex items-center justify-between gap-4">
                            {/* Mark as read button */}
                            <button
                              onClick={() => toggleOpenedStatus(gift.id)}
                              className={`flex-1 px-4 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all text-center flex items-center justify-center gap-2 ${
                                isOpened 
                                  ? 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant' 
                                  : 'bg-primary hover:bg-primary/95 text-on-primary hover:scale-[1.02] shadow-md shadow-primary/10'
                              }`}
                            >
                              {isOpened ? (
                                <>
                                  <Check size={14} />
                                  {t('gifts.reopen', 'Heropenen')}
                                </>
                              ) : (
                                <>
                                  {t('gifts.mark_read_action', '🎉 HIERMEE BEKEND!')}
                                </>
                              )}
                            </button>

                            {/* Share button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShare(gift);
                              }}
                              className="px-3.5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary text-on-surface-variant border border-outline/20 active:scale-95 transition-all flex items-center justify-center"
                              title={t('gifts.share_tooltip', 'Deel deze update')}
                            >
                              <Share2 size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Bottom footer bar */}
              <div className="absolute bottom-0 left-0 w-full p-4 border-t border-outline/20 bg-surface/80 backdrop-blur-xl flex items-center justify-center text-[10px] uppercase font-black tracking-widest text-on-surface-variant">
                {t('gifts.footer_text', 'Met liefde gemaakt voor onze gebruikers ❤️')}
              </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
    </>
  );
}

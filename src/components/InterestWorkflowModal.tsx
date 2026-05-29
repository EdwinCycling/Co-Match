import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { 
  X, 
  Sparkles, 
  MessageSquare, 
  Eye, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle,
  TrendingUp,
  Lock,
  Heart,
  Coins,
  User
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, onSnapshot, getDoc } from 'firebase/firestore';
import { generateMatchReport, getExistingMatch, generateMakelaarReport, getExistingMakelaarReport } from '../services/matchService';
import { deductCredits } from '../services/creditService';
import { toast } from 'react-hot-toast';
import { CREDIT_COSTS } from '../constants';
import { TrustBadge, TrustPopup } from './TrustBadge';
import { PropertySurroundings } from './PropertySurroundings';
import MakelaarReportModal from './MakelaarReportModal';

interface PropertyImage {
  id: string;
  url: string;
  category?: string;
  description?: string;
}

interface Property {
  id: string;
  ownerId?: string;
  title: string;
  city: string;
  neighborhood?: string;
  displayLat?: number;
  displayLng?: number;
  price: number;
  minPrice?: number;
  maxPrice?: number;
  priceType?: 'fixed' | 'range' | 'tbd';
  currentInquiries?: number;
  maxInquiries?: number;
  images?: PropertyImage[];
  teaserImageId?: string;
  features?: {
    type?: string;
    goal?: string;
    bedrooms?: number;
    area_private?: number;
    [key: string]: any;
  };
}

interface InterestWorkflowModalProps {
  prop: Property;
  seekerProfile: any;
  onClose: () => void;
  onOpenFullDetails: () => void;
  onOpenChat: () => void;
  onMatchGenerated: (report: string) => void;
}

export default function InterestWorkflowModal({
  prop,
  seekerProfile,
  onClose,
  onOpenFullDetails,
  onOpenChat,
  onMatchGenerated
}: InterestWorkflowModalProps) {
  const { t, i18n } = useTranslation();
  const [existingMatch, setExistingMatch] = useState<any>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [isGeneratingMatch, setIsGeneratingMatch] = useState(false);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [showUnlockOverlay, setShowUnlockOverlay] = useState(false);
  const [pendingAction, setPendingAction] = useState<'details' | 'match' | 'chat' | null>(null);
  const [localUnlocked, setLocalUnlocked] = useState(false);
  const [showDirectChatLoading, setShowDirectChatLoading] = useState(false);
  const [hasInquired, setHasInquired] = useState(false);
  const [chatData, setChatData] = useState<any>(null);
  const [providerProfile, setProviderProfile] = useState<any>(null);
  const [showTrustPopup, setShowTrustPopup] = useState(false);
  const [existingMakelaarReport, setExistingMakelaarReport] = useState<any>(null);
  const [isGeneratingMakelaar, setIsGeneratingMakelaar] = useState(false);
  const [loadingMakelaar, setLoadingMakelaar] = useState(true);
  const [showMakelaarModal, setShowMakelaarModal] = useState(false);

  useEffect(() => {
    if (prop.ownerId) {
      const fetchProvider = async () => {
        try {
          const snap = await getDoc(doc(db, 'providers', prop.ownerId));
          if (snap.exists()) {
            setProviderProfile(snap.data());
          }
        } catch (e) {
          console.error("Error fetching provider profile in interest workflow:", e);
        }
      };
      fetchProvider();
    }
  }, [prop.ownerId]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, []);

  // Realtime credit balance checken van ingelogde gebruiker
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        setUserCredits(snap.data().credits || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  // Realtime checken of deze zoeker al gereageerd heeft/chat heeft aangemaakt voor deze specifieke woning
  useEffect(() => {
    if (!auth.currentUser || !prop.id) return;
    const chatId = `${auth.currentUser.uid}_${prop.id}`;
    const unsubscribe = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      setHasInquired(snap.exists());
      if (snap.exists()) {
        setChatData(snap.data());
      } else {
        setChatData(null);
      }
    });
    return () => unsubscribe();
  }, [prop.id]);

  // Checken of de woning al is unlocked in het profiel
  const isCurrentlyUnlocked = localUnlocked || seekerProfile?.unlocked_all_options?.includes(prop.id) || seekerProfile?.unlocked_details?.includes(prop.id);

  useEffect(() => {
    const fetchMatchAndMakelaar = async () => {
      if (auth.currentUser && prop.id) {
        try {
          const match = await getExistingMatch(auth.currentUser.uid, prop.id);
          setExistingMatch(match);
        } catch (e) {
          console.error("Error loading match in interest workflow:", e);
        }
        
        try {
          const makelaar = await getExistingMakelaarReport(prop.id);
          setExistingMakelaarReport(makelaar);
        } catch (e) {
          console.error("Error loading makelaar report:", e);
        }
      }
      setLoadingMatch(false);
      setLoadingMakelaar(false);
    };
    fetchMatchAndMakelaar();
  }, [prop.id]);

  // Afhandeling betaling van credits om de drie opties te unlocken
  const handleConfirmUnlock = async () => {
    if (!auth.currentUser) {
      toast.error(t('common.login_required', 'Log in om acties uit te voeren'));
      return;
    }

    if (userCredits < CREDIT_COSTS.UNLOCK_ALL) {
      // Open de credits modal, laat de overlay open
      window.dispatchEvent(new CustomEvent('open-credits-modal'));
      return;
    }

    try {
      const success = await deductCredits(CREDIT_COSTS.UNLOCK_ALL, `Volledige ontgrendeling (details, match & chat) voor ${prop.title}`);
      if (!success) {
        toast.error('Er is iets misgegaan bij het afschrijven van je credits.');
        return;
      }

      // Opslaan in database dat deze woning volledig is ontgrendeld (en gelijk favoriet maken)
      const seekerRef = doc(db, 'seeker_profiles', auth.currentUser.uid);
      await updateDoc(seekerRef, {
        unlocked_all_options: arrayUnion(prop.id),
        unlocked_details: arrayUnion(prop.id),
        unlocked_matches: arrayUnion(prop.id),
        favorites: arrayUnion(prop.id)
      });

      setLocalUnlocked(true);
      setShowUnlockOverlay(false);
      setPendingAction(null);

      toast.success('Woning met succes volledig ontgrendeld!');

    } catch (e) {
      console.error("Error setting unlocked all status:", e);
      toast.error('Er is een fout opgetreden bij het ontgrendelen.');
    }
  };

  const runGenerateMatch = async () => {
    setIsGeneratingMatch(true);
    try {
      const match = await generateMatchReport(auth.currentUser!.uid, prop.id, i18n.language || 'nl') as any;
      setExistingMatch(match);
      onMatchGenerated(match.report);
      toast.success(t('property.details.gen_success', 'AI Match Rapport succesvol gegenereerd!'));
    } catch (error: any) {
      toast.error(error.message || t('property.details.gen_error', 'Er trad een fout op bij het genereren van het AI rapport.'));
      console.error(error);
    }
    setIsGeneratingMatch(false);
  };

  const runGenerateMakelaar = async () => {
    setIsGeneratingMakelaar(true);
    try {
      const report = await generateMakelaarReport(prop.id, i18n.language || 'nl') as any;
      setExistingMakelaarReport(report);
      toast.success(t('makelaar_success', 'Makelaar rapport succesvol gegenereerd!'));
      setShowMakelaarModal(true);
    } catch (error: any) {
      toast.error(error.message || t('makelaar_error', 'Er trad een fout op bij het opstellen van het makelaars rapport.'));
      console.error(error);
    }
    setIsGeneratingMakelaar(false);
  };

  // Chat-flow: als er nog geen AI-rapport is, gaan we die eerst maken!
  const runDirectChatFlow = async () => {
    if (!auth.currentUser) return;
    
    // Checken of er al een match-rapport ligt
    let matchReportToUse = existingMatch?.report;

    if (!matchReportToUse) {
      // Tussenlaag tonen om AI Match Rapport eerst te genereren
      setShowDirectChatLoading(true);
      try {
        const match = await generateMatchReport(auth.currentUser.uid, prop.id, i18n.language || 'nl') as any;
        setExistingMatch(match);
        matchReportToUse = match.report;
        onMatchGenerated(match.report);
      } catch (err) {
        console.error("Error automatching before chat:", err);
      }
      setShowDirectChatLoading(false);
    }

    // Direct doorsturen naar de chat
    onOpenChat();
  };

  const handleActionClick = (action: 'details' | 'match' | 'chat') => {
    if (!auth.currentUser) {
      toast.error(t('common.login_required', 'Log in om verder te gaan'));
      return;
    }

    if (!isCurrentlyUnlocked) {
      setPendingAction(action);
      setShowUnlockOverlay(true);
    } else {
      if (action === 'details') {
        onOpenFullDetails();
      } else if (action === 'match') {
        if (existingMatch) {
          onMatchGenerated(existingMatch.report);
        } else {
          runGenerateMatch();
        }
      } else if (action === 'chat') {
        runDirectChatFlow();
      }
    }
  };

  // Dynamisch of sfeervol berekenen van reactie status op basis van currentInquiries
  const inquiriesCount = prop.currentInquiries || 0;
  
  const getInquiriesIndicatorText = () => {
    if (inquiriesCount === 0) {
      return (
        <span>
          Als je nu reageert, ben jij de <strong className="text-[#3b82f6] dark:text-[#60a5fa] font-black">nummer één</strong> reactie van deze woning!
        </span>
      );
    } else if (inquiriesCount < 3) {
      return (
        <span>
          Als je nu reageert, behoor je direct tot de <strong className="text-emerald-600 dark:text-emerald-400 font-black">top drie</strong> reacties!
        </span>
      );
    } else if (inquiriesCount < 10) {
      return (
        <span>
          Als je nu reageert, behoor je tot de <strong className="text-amber-600 dark:text-amber-400 font-black">top tien</strong> geïnteresseerden!
        </span>
      );
    } else {
      return (
        <span>
          Als je nu reageert, behoor je tot de selecte <strong className="text-[#e23c72] font-black">top {inquiriesCount < 25 ? '25' : 'actieve'}</strong> geïnteresseerden!
        </span>
      );
    }
  };

  const messages = chatData?.messages || [];
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageByProvider = lastMessage && lastMessage.senderId !== auth.currentUser?.uid && lastMessage.senderId !== 'system';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-2xl flex items-center justify-center p-4 md:p-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-background rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-outline relative"
      >
        {/* Sluitknop */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-3 bg-surface-container-low hover:bg-surface-container hover:scale-105 rounded-full text-on-surface transition-all shadow-md z-20"
        >
          <X size={20} />
        </button>

        <div className="flex-grow overflow-y-auto p-6 md:p-10 space-y-4">
          {/* Header en Uitleg */}
          <div className="space-y-3 max-w-3xl">
            <h2 id="interest-workflow-title" className="text-3xl md:text-4xl font-display font-black text-on-background leading-tight">
              {isCurrentlyUnlocked 
                ? t('workflow.title_unlocked', 'Jouw potentiele woning!') 
                : t('workflow.title', 'Je hebt interesse in deze woning!')}
            </h2>
            <h3 className="text-3xl md:text-4xl font-display font-black text-primary leading-tight -mt-1">
              {prop.title}
            </h3>
            
            <div className="space-y-4">
              <p id="interest-workflow-desc" className="text-base text-on-surface-variant leading-relaxed">
                {isCurrentlyUnlocked 
                  ? t('workflow.description_unlocked', 'Ontdek deze woning, maak een AI matching rapport of kom in contact met de aanbieder, veel plezier...')
                  : t('workflow.description_old', 'Ontgrendel deze woning om direct toegang te krijgen tot alle afgeschermde details, het uitgebreide AI-matchrapport te kunnen lezen, en direct in contact te komen met de aanbieder. ')}
              </p>
              {!isCurrentlyUnlocked && (
                <p id="interest-workflow-steps" className="text-base text-on-surface-variant font-medium leading-relaxed bg-primary/5 p-4 rounded-xl border border-primary/10">
                  {t('workflow.description_steps', 'Geweldig, je hebt een mogelijke match gevonden! Om het maximale uit Co-Match te halen en jouw kans op een succesvolle match te vergroten, hebben we een natuurlijk stappenplan voor je klaargezet. Ontdek eerst alle details bij stap 1, duik daarna in stap 2 voor jouw persoonlijke AI-matchrapport (zodat je precies weet waarom dit jouw ideale plek is), en gebruik deze inzichten bij stap 3 om direct en zelfverzekerd contact op te nemen met de aanbieder. Zo ben je optimaal voorbereid op een eerste kennismaking. Veel succes!')}
                </p>
              )}
            </div>

            {/* Veiligheids- en kostennotitie */}
            <div className="bg-surface-container-low rounded-3xl p-6 border border-outline/20 space-y-3 shadow-inner">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-on-background text-sm">Controle, veiligheid & exclusiviteit</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Uiteindelijk kun je in een veilige chatomgeving met elkaar chatten. Wij wisselen nooit privégegevens uit en uiteindelijk vragen we wel een kleine vergoeding voor. En waarom doen we dat? Omdat we enigszins ook onze kosten moeten dekken, maar aan de andere kant ook graag alleen serieuze mensen willen hebben die we aanbieden bij de woningaanbieder. We limiteren daarom ook het aantal mensen dat kan reageren.
                  </p>
                </div>
              </div>
            </div>

            {/* Indicator positieuitleg - ALLEEN tonen als de gebruiker nog niet gereageerd heeft */}
            {!hasInquired && (
              <div className="flex items-center gap-3 px-5 py-4 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-2xl transition-colors">
                <TrendingUp size={20} className="text-amber-500 shrink-0" />
                <p className="text-xs md:text-sm font-medium text-amber-900/90 dark:text-amber-100/90">
                  {getInquiriesIndicatorText()}
                </p>
              </div>
            )}
          </div>

          {/* Drie Kaarten */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            
            {/* Kaart 1: Alle details bekijken */}
            <motion.div
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleActionClick('details')}
              className={`group cursor-pointer rounded-[2rem] p-6 flex flex-col h-full justify-between gap-6 transition-all shadow-sm relative overflow-hidden border ${
                isCurrentlyUnlocked 
                ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 shadow-md ring-2 ring-blue-400/20' 
                : 'bg-surface-container-lowest border-outline/30 hover:shadow-xl hover:border-primary/40'
              }`}
            >
              <div className="absolute top-4 right-4">
                {isCurrentlyUnlocked ? (
                  <div className="px-3 py-1 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm animate-fade-in">
                    {t('common.available', 'Beschikbaar')}
                  </div>
                ) : (
                  <div className="text-on-surface-variant/40 group-hover:text-primary/40 transition-colors">
                    <Lock size={16} />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${isCurrentlyUnlocked ? 'bg-blue-500/20 text-blue-600' : 'bg-primary/10 text-primary'}`}>
                  <Eye size={22} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-xs font-black">1</span>
                    <h3 className={`text-xl font-display font-black group-hover:text-primary transition-colors ${isCurrentlyUnlocked ? 'text-blue-900 dark:text-white' : 'text-on-background'}`}>
                      Alle details bekijken
                    </h3>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Krijg direct 100% toegang tot alle specificaties, kenmerken en gedetailleerde weergaven van de woning die de aanbieder heeft vrijgegeven.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-4 border-t border-outline/10 text-xs font-black uppercase tracking-widest text-primary">
                <span>Bekijk Nu</span>
                <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
              </div>
            </motion.div>

            {/* Kaart 2: AI Match Rapport */}
            {existingMatch ? (
              /* AI Match Rapport Mock-up wanneer het al bestaat */
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleActionClick('match')}
                className="group cursor-pointer bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 rounded-[2rem] p-6 flex flex-col h-full justify-between gap-6 hover:shadow-xl hover:border-amber-500/80 transition-all shadow-md ring-2 ring-amber-400/20"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-[#f59e0b] flex items-center justify-center shadow-inner">
                      <Sparkles size={22} className="animate-pulse" />
                    </div>
                    <div className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
                      {t('common.available', 'Beschikbaar')}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-amber-500/15 text-[#d97706] flex items-center justify-center text-xs font-black">2</span>
                      <h3 className="text-xl font-display font-black text-[#d97706] group-hover:text-[#b45309] transition-colors">
                        AI Match Rapport
                      </h3>
                    </div>
                    
                    {/* Mock-up van het matchingrapport */}
                    <div className="bg-amber-500/5 rounded-2xl p-3 border border-amber-500/10 space-y-2 select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Matchingscore</span>
                        <span className="text-xs font-black text-[#d97706]">98%</span>
                      </div>
                      <div className="w-full bg-amber-200/40 rounded-full h-1.5">
                        <div className="bg-[#f59e0b] h-1.5 rounded-full" style={{ width: '98%' }}></div>
                      </div>
                      <div className="text-[9px] text-amber-800/80 dark:text-amber-200/80 italic font-medium truncate">
                        "Jouw profiel past uitstekend bij deze woning"
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-amber-500/10 text-xs font-black uppercase tracking-widest text-[#d97706]">
                  <span>Rapport Openen</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
                </div>
              </motion.div>
            ) : (
              /* AI Match Rapport genereren wanneer het nog niet bestaat */
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleActionClick('match')}
                className={`group cursor-pointer rounded-[2rem] p-6 flex flex-col h-full justify-between gap-6 transition-all shadow-sm relative overflow-hidden border ${
                  isCurrentlyUnlocked 
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 shadow-md ring-2 ring-amber-400/20' 
                  : 'bg-surface-container-lowest border-outline/30 hover:shadow-xl hover:border-amber-500/40'
                }`}
              >
                <div className="absolute top-4 right-4">
                  {isCurrentlyUnlocked ? (
                    <div className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm animate-fade-in">
                      {t('common.available', 'Beschikbaar')}
                    </div>
                  ) : (
                    <div className="text-on-surface-variant/40 group-hover:text-primary/40 transition-colors">
                      <Lock size={16} />
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${isCurrentlyUnlocked ? 'bg-amber-500/20 text-[#d97706]' : 'bg-[#2563eb]/10 text-[#2563eb]'}`}>
                    <Sparkles size={22} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center text-xs font-black">2</span>
                      <h3 className={`text-xl font-display font-black group-hover:text-[#2563eb] transition-colors ${isCurrentlyUnlocked ? 'text-amber-900 dark:text-white' : 'text-on-background'}`}>
                        AI Match Rapport
                      </h3>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Laat AI een diepgaande matchanalyse maken. Vergelijk al je wensen direct op elk detail en ontvang aanvullende compatibiliteitsinformatie.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-outline/10 text-xs font-black uppercase tracking-widest text-[#2563eb]">
                  {isGeneratingMatch ? (
                    <span className="animate-pulse">Analyseren...</span>
                  ) : (
                    <span>Maak AI Match</span>
                  )}
                  <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
                </div>
              </motion.div>
            )}

            {/* Kaart 3: In contact komen */}
            <motion.div
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleActionClick('chat')}
              className={`group cursor-pointer rounded-[2rem] p-6 flex flex-col h-full justify-between gap-6 transition-all shadow-sm relative overflow-hidden border ${
                isCurrentlyUnlocked 
                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500 shadow-md ring-2 ring-emerald-400/20' 
                : 'bg-surface-container-lowest border-outline/30 hover:shadow-xl hover:border-emerald-500/40'
              }`}
            >
              <div className="absolute top-4 right-4">
                {isCurrentlyUnlocked ? (
                  <div className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm animate-fade-in">
                    {t('common.available', 'Beschikbaar')}
                  </div>
                ) : (
                  <div className="text-on-surface-variant/40 group-hover:text-primary/40 transition-colors">
                    <Lock size={16} />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${isCurrentlyUnlocked ? 'bg-emerald-500/20 text-emerald-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                  <MessageSquare size={22} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-black">3</span>
                    <h3 className={`text-xl font-display font-black group-hover:text-emerald-600 transition-colors ${isCurrentlyUnlocked ? 'text-emerald-900 dark:text-white' : 'text-on-background'}`}>
                      In contact komen
                    </h3>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Stuur een direct, veilig chatbericht naar de woningaanbieder om kennis te maken of vorderingen te maken.
                  </p>
                  
                  {lastMessageByProvider && lastMessage && (
                    <div className="mt-3 bg-white/95 dark:bg-slate-900/90 rounded-2xl p-3 border border-emerald-200 dark:border-emerald-800 shadow-sm space-y-1 animate-in fade-in duration-300">
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        <MessageSquare size={10} className="fill-current" />
                        <span>Laatste bericht aanbieder:</span>
                      </div>
                      <p className="text-[11px] text-emerald-900 dark:text-emerald-100 font-medium italic line-clamp-2 leading-relaxed">
                        "{lastMessage.text}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-4 border-t border-outline/10 text-xs font-black uppercase tracking-widest text-emerald-600">
                <span>Start Chat</span>
                <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
              </div>
            </motion.div>

          </div>

          {/* Vierde venster: Informatie over de woningaanbieder (indien ontgrendeld) */}
          {isCurrentlyUnlocked && providerProfile && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 border-2 border-primary/20 rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start md:items-center w-full shadow-lg"
            >
              <div className="shrink-0 relative group">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] bg-white flex items-center justify-center overflow-hidden border-2 border-primary/10 shadow-md group-hover:scale-105 transition-transform">
                  {providerProfile.photoUrl ? (
                    <img src={providerProfile.photoUrl} alt="Aanbieder" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-display font-black text-3xl">
                      {providerProfile.firstName?.[0] || 'A'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4 w-full">
                <div className="flex flex-row items-center justify-between gap-4 w-full">
                   <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{t('workflow.meet_provider', 'Maak kennis met de woningaanbieder(s)')}</p>
                      <h4 className="text-2xl md:text-3xl font-display font-black text-on-background">
                         {providerProfile.firstName}
                      </h4>
                      <button 
                        onClick={() => setShowTrustPopup(true)} 
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                         <ShieldCheck size={12} />
                         {t('trust.ladder_info', 'Verification Level')} {providerProfile.verificationLevel || 1} • <span className="opacity-70">Wat betekent dit?</span>
                      </button>
                   </div>
                   {providerProfile.country && (
                     <div className="text-right">
                       <span className="px-4 py-2 bg-white border border-outline rounded-full text-xs font-bold text-on-surface-variant shadow-sm">
                         {providerProfile.country === 'NL' ? 'Nederland' : 
                          providerProfile.country === 'BE' ? 'België' : 
                          providerProfile.country === 'DE' ? 'Duitsland' : 
                          providerProfile.country === 'FR' ? 'Frankrijk' : 
                          providerProfile.country === 'ES' ? 'Spanje' : 
                          providerProfile.country}
                       </span>
                     </div>
                   )}
                </div>

                {providerProfile.description && (
                  <div className="bg-white/80 p-6 rounded-[2rem] border border-primary/5 relative shadow-sm">
                     <p className="text-sm md:text-base text-on-surface-variant leading-relaxed whitespace-pre-wrap italic font-medium">
                        "{providerProfile.description}"
                     </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Makelaar Rapport Venster (indien ontgrendeld) */}
          {isCurrentlyUnlocked && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-purple-50/50 dark:bg-purple-900/10 border-2 border-purple-200 dark:border-purple-800 rounded-[2.5rem] p-6 md:p-8 flex flex-col gap-6 w-full shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-800/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <User size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl md:text-2xl font-display font-black text-purple-900 dark:text-purple-100">
                      {t('makelaar_title', 'Co-Match Makelaar')}
                    </h4>
                    <p className="text-xs font-bold uppercase tracking-widest text-purple-600/70 dark:text-purple-400/70">
                      {t('makelaar_subtitle', 'Het makelaar rapport')}
                    </p>
                  </div>
                </div>
              </div>

              {!existingMakelaarReport ? (
                <div className="bg-white/80 dark:bg-slate-900/50 rounded-3xl p-8 text-center space-y-6 shadow-sm border border-purple-100 dark:border-purple-800/30">
                  <div className="w-20 h-20 mx-auto bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                    <Sparkles size={32} className="text-purple-500" />
                  </div>
                  <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-on-background">{t('makelaar_make_report_btn', 'Laat de makelaar een rapport maken')}</h3>
                    <p className="text-sm text-on-surface-variant">
                      {t('makelaar_description', 'Onze Co-Match-makelaar analyseert de woning en het profiel van de aanbieder om een objectief verhaal te schrijven. Speciaal voor jou samengesteld.')}
                    </p>
                  </div>
                  
                  <button
                    onClick={runGenerateMakelaar}
                    disabled={isGeneratingMakelaar || loadingMakelaar}
                    className="mx-auto w-full max-w-xs bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-6 py-4 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingMakelaar ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        <span>{t('makelaar_generating', 'Rapport opstellen...')}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>{t('makelaar_make_btn', 'Maak Makelaar Rapport')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-white/95 dark:bg-slate-900/90 rounded-3xl p-6 md:p-8 text-center space-y-4 shadow-sm border border-purple-100 dark:border-purple-800/30">
                   <div className="w-16 h-16 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                     <User size={28} />
                   </div>
                   <h3 className="text-xl font-bold">Het rapport is klaar!</h3>
                   <p className="text-sm text-on-surface-variant max-w-sm mx-auto">Bekijk de objectieve inzichten van de Co-Match makelaar.</p>
                   <button
                     onClick={() => setShowMakelaarModal(true)}
                     className="mx-auto w-full max-w-xs bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-6 py-4 transition-all shadow-md flex items-center justify-center gap-2"
                   >
                     <Eye size={18} />
                     <span>Bekijk Makelaar Rapport</span>
                   </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Vijfde venster: Omgeving van de woning (indien ontgrendeld) */}
          {isCurrentlyUnlocked && prop.displayLat && prop.displayLng && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full"
            >
              <PropertySurroundings lat={prop.displayLat} lon={prop.displayLng} />
            </motion.div>
          )}

          {/* Show Trust Popup if needed */}
          <TrustPopup 
            isOpen={showTrustPopup} 
            onClose={() => setShowTrustPopup(false)} 
            providerLevel={providerProfile?.verificationLevel || 1}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-outline flex justify-end items-center bg-surface-container-lowest sticky bottom-0 shrink-0 w-full z-10 gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button 
            onClick={onClose} 
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border border-outline rounded-xl px-6 py-4 transition-all text-sm text-center"
          >
            {isCurrentlyUnlocked ? 'Sluiten' : 'Nee, bedankt'}
          </button>
        </div>

        {/* Realtime of automatische LAAD-tussenlaag voor AI match voorbereiden voor chat */}
        <AnimatePresence>
          {showDirectChatLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md z-[120] flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
                <motion.div 
                  animate={{ scale: [1, 1.15, 1] }} 
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-primary/5 rounded-full" 
                />
                <Sparkles size={36} className="text-primary animate-pulse" />
              </div>
              <h3 className="text-2xl font-display font-black text-white mb-4">
                Genereert eerst jouw AI-matchingrapport...
              </h3>
              <p className="text-slate-300 text-sm max-w-md mb-6 leading-relaxed">
                We bereiden eerst de perfecte match-analyse voor, zodat de aanbieder direct een geverifieerd en compleet beeld van jullie connectie heeft. Een moment geduld, we sturen je hierna direct door naar de chat!
              </p>
              <div className="max-w-xs w-full bg-white/10 rounded-full h-2 relative overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ left: '-100%' }}
                  animate={{ left: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="absolute bg-primary h-full w-[40%] rounded-full" 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prachtige AI Match Generatie Loader (Freeze Blur background) */}
        <AnimatePresence>
          {isGeneratingMatch && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[140] bg-[#020617]/90 backdrop-blur-2xl flex items-center justify-center p-4 cursor-wait rounded-[2.5rem]"
            >
              <div className="flex flex-col items-center text-center space-y-12">
                <div className="relative">
                  <div className="absolute inset-[-20px] border-4 border-primary/20 rounded-full animate-ping" />
                  <div className="absolute inset-[-40px] border-4 border-primary/10 rounded-full animate-ping [animation-delay:0.5s]" />
                  <div className="w-40 h-40 border-8 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="text-primary">
                      <Sparkles size={64} />
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-4 max-w-sm">
                  <h3 className="text-4xl font-display font-black text-white tracking-tight">AI maakt matchrapport...</h3>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="h-full w-1/2 bg-primary" />
                  </div>
                  <p className="text-white/80 font-bold text-lg">Onze AI vergelijkt jouw unieke zoekprofiel met alle specificaties van dit huis...</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Makelaar Rapport Loader (Gekopieerd van AI match) */}
        <AnimatePresence>
          {isGeneratingMakelaar && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[140] bg-[#020617]/90 backdrop-blur-2xl flex items-center justify-center p-4 cursor-wait rounded-[2.5rem]"
            >
              <div className="flex flex-col items-center text-center space-y-12">
                <div className="relative">
                  <div className="absolute inset-[-20px] border-4 border-purple-500/20 rounded-full animate-ping" />
                  <div className="absolute inset-[-40px] border-4 border-purple-500/10 rounded-full animate-ping [animation-delay:0.5s]" />
                  <div className="w-40 h-40 border-8 border-purple-500/20 border-t-purple-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="text-purple-600">
                      <Sparkles size={64} />
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-4 max-w-sm">
                  <h3 className="text-4xl font-display font-black text-white tracking-tight">Makelaar schrijft rapport...</h3>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="h-full w-1/2 bg-purple-600" />
                  </div>
                  <p className="text-white/80 font-bold text-lg">Onze Co-Match-makelaar analyseert de data en schrijft een warm, objectief rapport...</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
           {showMakelaarModal && existingMakelaarReport && (
              <MakelaarReportModal 
                report={existingMakelaarReport.report}
                property={prop}
                onClose={() => setShowMakelaarModal(false)}
              />
           )}
        </AnimatePresence>

        {/* Betaling autorisatie / Unlock Overlay */}
        <AnimatePresence>
          {showUnlockOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/95 backdrop-blur-md z-[115] flex flex-col items-center justify-start md:justify-center overflow-y-auto py-8 px-4 md:p-6 custom-scrollbar"
            >
              <div className="max-w-md w-full bg-background rounded-[2.5rem] p-6 md:p-8 border border-outline shadow-2xl space-y-6 text-center animate-in scale-in duration-300 my-auto shrink-0">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto shadow-inner group">
                  <Coins className="text-primary animate-bounce" size={36} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-black text-on-background">
                    Ontgrendel alle opties
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Krijg in één keer volledige toegang tot deze woning! Dit omvat alle gedetailleerde weergaven, een gepersonaliseerd AI-matchingrapport en directe veilige chatmogelijkheden.
                  </p>
                </div>

                <div className="bg-surface-container p-5 rounded-2xl border border-outline/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-on-surface-variant">
                    <span>Kosten ontgrendelen:</span>
                    <span className="text-primary font-black">{CREDIT_COSTS.UNLOCK_ALL} credits</span>
                  </div>
                  <div className="w-full border-t border-outline/10 my-2" />
                  <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
                    <span>Jouw huidige saldo:</span>
                    <span className={userCredits < CREDIT_COSTS.UNLOCK_ALL ? 'text-error font-black' : 'text-emerald-600'}>
                      {userCredits} credits
                    </span>
                  </div>
                </div>

                {userCredits >= CREDIT_COSTS.UNLOCK_ALL ? (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleConfirmUnlock}
                      className="w-full py-4 bg-primary hover:bg-primary-dark hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl font-black text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Lock size={16} className="fill-current" />
                      Akkoord & Ontgrendelen voor {CREDIT_COSTS.UNLOCK_ALL} credits
                    </button>
                    <button
                      onClick={() => {
                        setShowUnlockOverlay(false);
                        setPendingAction(null);
                      }}
                      className="w-full py-3 hover:bg-surface-container rounded-xl font-bold text-on-surface-variant text-sm transition-all border border-outline"
                    >
                      Annuleren
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 rounded-xl text-left text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                      <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
                      <p>
                        Onvoldoende credits! Je hebt momenteel <strong>{userCredits} credits</strong>. Om deze woning te ontgrendelen heb je minimaal {CREDIT_COSTS.UNLOCK_ALL} credits nodig. Klik hieronder om extra credits aan te schaffen.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleConfirmUnlock}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl font-black text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Coins size={16} />
                        Credits Aanschaffen
                      </button>
                      <button
                        onClick={() => {
                          setShowUnlockOverlay(false);
                          setPendingAction(null);
                        }}
                        className="w-full py-3 hover:bg-surface-container rounded-xl font-bold text-on-surface-variant text-sm transition-all border border-outline"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

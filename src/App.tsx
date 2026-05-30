import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Handshake, 
  ShieldCheck, 
  MessageSquare, 
  Quote, 
  Share2, 
  Globe, 
  Menu, 
  X, 
  User as UserIcon,
  LogOut,
  ChevronDown,
  FlaskConical,
  Settings,
  Activity,
  HelpCircle,
  Newspaper
} from 'lucide-react';
import { auth, signInWithGoogle, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { Coins } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import CreditsFloatingButton from './components/CreditsFloatingButton';
import GiftBox from './components/GiftBox';
import { HowItWorksSection } from './components/HowItWorksSection';
import { HousingTypeCarousel } from './components/HousingTypeCarousel';

// Static imports for all views and components to bundle into a single consolidated file and prevent 429 Too Many Requests in browser
import ProviderDashboard from './components/ProviderDashboard';
import SeekerDashboard from './components/SeekerDashboard';
import AdminDashboard from './components/AdminDashboard';
import UserProfilePage from './components/UserProfilePage';

// Static imports for modals to save network connections
import UserSettingsModal from './components/UserSettingsModal';
import GenericInfoModal from './components/GenericInfoModal';
import AccountModal from './components/AccountModal';
import RoleSelectionModal from './components/RoleSelectionModal';

import { WeeklyHighlightModal } from './components/WeeklyHighlightModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { StoriesModal } from './components/StoriesModal';
import { ContactModal } from './components/ContactModal';
import { SafetyModal } from './components/SafetyModal';
import { APP_VERSION, CREDIT_PACKAGES } from './constants';
import { Toaster, toast } from 'react-hot-toast';
import './i18n';

const CookieBanner = () => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('cookiesAccepted')) {
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  if (!show) return null;
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          className="fixed bottom-0 left-0 w-full md:max-h-[50vh] overflow-y-auto bg-white border-t border-outline shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[99999]"
        >
           <div className="max-w-4xl mx-auto p-6 md:p-8 flex flex-col items-start gap-6">
              <div className="flex-1 space-y-4">
                <h3 className="text-2xl font-bold font-display text-on-surface">{t('cookies.title')}</h3>
                <p className="text-on-surface-variant text-base font-medium leading-relaxed max-w-2xl">
                  {t('cookies.desc')}
                </p>
              </div>
              <div className="flex gap-4 w-full md:w-auto mt-4">
                <button 
                  onClick={() => { localStorage.setItem('cookiesAccepted', 'true'); setShow(false); }}
                  className="flex-1 md:flex-none px-8 py-4 bg-primary text-white rounded-xl font-black uppercase text-sm tracking-widest whitespace-nowrap hover:bg-primary/95 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
                >
                  {t('cookies.accept')}
                </button>
                <button 
                  onClick={() => { localStorage.setItem('cookiesAccepted', 'true'); setShow(false); }}
                  className="flex-1 md:flex-none px-8 py-4 bg-surface-container text-on-surface font-bold rounded-xl transition-all hover:bg-surface-container-high"
                >
                  {t('cookies.decline')}
                </button>
              </div>
           </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { LanguageSwitcher } from './components/LanguageSwitcher';

import SeekerChatsModal from './components/SeekerChatsModal';
import ProviderAllChatsModal from './components/ProviderAllChatsModal';
import PropertyLimitModal from './components/PropertyLimitModal';

import PWAInstallPrompt from './components/PWAInstallPrompt';
import { syncUserProfile, updateUserRole } from './services/userService';

export default function App() {
  console.log("=== [DEBUG] App component rendering start ===");
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (footerRef.current && !footerRef.current.contains(event.target as Node)) {
        setIsFooterExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isUserSuspended, setIsUserSuspended] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isSeekerChatsModalOpen, setIsSeekerChatsModalOpen] = useState(false);
  const [isProviderChatsModalOpen, setIsProviderChatsModalOpen] = useState(false);
  const [isProviderHelpOpen, setIsProviderHelpOpen] = useState(false);
  const [isWeeklyHighlightModalOpen, setIsWeeklyHighlightModalOpen] = useState(false);
  const [availableHighlightSpots, setAvailableHighlightSpots] = useState(10);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [infoModalKey, setInfoModalKey] = useState<string | null>(null);
  const [showPricesModal, setShowPricesModal] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isStoriesOpen, setIsStoriesOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [isVibeActive, setIsVibeActive] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [adminBypassFreeze, setAdminBypassFreeze] = useState(false);

  // Admin messages and app freeze states
  const [activeAdminMessages, setActiveAdminMessages] = useState<any[]>([]);
  const [appStopConfig, setAppStopConfig] = useState<any>(null);
  const [appStopReady, setAppStopReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dismissedMessages, setDismissedMessages] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('dismissed_admin_messages') || '[]');
    } catch {
      return [];
    }
  });

  const isAdminUser = userRole === 'admin' || user?.email === 'edwin@editsolutions.nl';

  // Clock interval for active message check
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen to app stop configuration on mount (guest or user)
  useEffect(() => {
    const sUnsubscribe = onSnapshot(doc(db, 'settings', 'app_stop'), (snapshot) => {
      if (snapshot.exists()) {
        setAppStopConfig(snapshot.data());
      } else {
        setAppStopConfig(null);
      }
      setAppStopReady(true);
    }, (error) => {
      console.error("Error listening to app stop:", error);
      setAppStopReady(true);
    });

    return () => sUnsubscribe();
  }, []);

  // Listen to admin messages real-time (requires user)
  useEffect(() => {
    if (!user) {
      setActiveAdminMessages([]);
      return;
    }

    try {
      const mUnsubscribe = onSnapshot(collection(db, 'admin_messages'), (snapshot) => {
        const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setActiveAdminMessages(msgs);
      }, (error) => {
        console.error("Error listening to admin messages:", error);
      });

      return () => {
        mUnsubscribe();
      };
    } catch (e) {
      console.error("Error setting up message listener in App:", e);
    }
  }, [user]);

  // Listen to global highlights taken for the upcoming week and update available spots
  useEffect(() => {
    if (!user || userRole !== 'huis_aanbieder') return;
    
    // Native calculation for upcoming week Monday (offsetWeeks = 1)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff + 7));
    monday.setHours(0, 0, 0, 0);
    
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    const upcomingWeekId = `${yyyy}-${mm}-${dd}`;

    const q = query(
      collection(db, 'properties'),
      where('highlightWeeks', 'array-contains', upcomingWeekId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAvailableHighlightSpots(Math.max(0, 10 - snapshot.size));
    }, (error) => {
      console.error("Error watching global highlights in App.tsx:", error);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // Handle dismiss click
  const handleDismissMessage = (id: string) => {
    const updated = [...dismissedMessages, id];
    setDismissedMessages(updated);
    sessionStorage.setItem('dismissed_admin_messages', JSON.stringify(updated));
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Co-Match',
      text: 'Vind je ideale huisgenoot of woning op basis van leefstijl DNA!',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        toast.success(t('common.link_copied', { defaultValue: 'Link gekopieerd naar klembord!' }));
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  // Track unread chats for seekers and providers
  useEffect(() => {
    if (!user || (userRole !== 'huis_zoeker' && userRole !== 'huis_aanbieder')) {
      setUnreadChatsCount(0);
      return;
    }

    try {
      const q = query(
        collection(db, 'chats'),
        where(userRole === 'huis_aanbieder' ? 'providerId' : 'seekerId', '==', user.uid),
        where('status', '==', 'active')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let count = 0;
        snapshot.docs.forEach(d => {
          const data = d.data();
          const hasUnread = data.messages?.some((m: any) => m.senderId !== user.uid && !m.read);
          if (hasUnread) count++;
        });
        setUnreadChatsCount(count);
      }, (error) => {
        console.error("Error listening to unread chats:", error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Error setting up chat listener:", e);
    }
  }, [user?.uid, userRole]);

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setActivePage('dashboard');
      if (e.detail?.propertyId) {
        // Give dashboard time to mount and register its own listener
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-property-chat-internal', { detail: e.detail }));
        }, 200);
      }
    };
    window.addEventListener('open-property-chat', handleOpenChat);

    const handleVibeStatus = (e: any) => {
      setIsVibeActive(e.detail?.isVibeActive || false);
    };
    window.addEventListener('vibe-status-changed', handleVibeStatus);

    const handleOpenProviderChat = (e: any) => {
      setActivePage('dashboard');
      if (e.detail?.chatId) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-provider-chat-internal', { detail: e.detail }));
        }, 200);
      }
    };
    window.addEventListener('open-provider-chat', handleOpenProviderChat);

    return () => {
      window.removeEventListener('open-property-chat', handleOpenChat);
      window.removeEventListener('vibe-status-changed', handleVibeStatus);
      window.removeEventListener('open-provider-chat', handleOpenProviderChat);
    };
  }, []);

  useEffect(() => {
    let unsubUserDoc: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Luister real-time naar veranderingen in het gebruikersprofiel
        const userRef = doc(db, 'users', currentUser.uid);
        
        unsubUserDoc = onSnapshot(userRef, (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            let role = userData.role || 'unassigned';
            
            if (userData.language && userData.language !== i18n.language) {
              i18n.changeLanguage(userData.language);
            }
            
            if (currentUser.email === 'edwin@editsolutions.nl') {
               role = 'admin';
            }
            setUserRole(role);
            setIsUserSuspended(!!userData.isSuspended);
            setLoading(false);
          } else {
            syncUserProfile().then((result) => {
              setUserRole(result.role || 'unassigned');
              setIsUserSuspended(false);
              setLoading(false);
            }).catch((err) => {
              console.error("Failed to bootstrap profile:", err);
              setUserRole('unassigned');
              setIsUserSuspended(false);
              setLoading(false);
            });
          }
        }, (error: any) => {
          console.error("Failed realtime onSnapshot for /users/" + currentUser.uid, error);
          setUserRole('unassigned');
          setIsUserSuspended(false);
          setLoading(false);
        });

      } else {
        setUser(null);
        setUserRole(null);
        setIsUserSuspended(false);
        setLoading(false);
        if (unsubUserDoc) {
          unsubUserDoc();
          unsubUserDoc = undefined;
        }
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  useEffect(() => {
    let unsubscribePhoto: (() => void) | undefined;
    if (user && userRole) {
      if (userRole === 'huis_zoeker') {
        const docRef = doc(db, 'seeker_profiles', user.uid);
        unsubscribePhoto = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
             setProfilePhotoUrl(docSnap.data().photo_url || docSnap.data().photoURL || null);
          }
        });
      } else if (userRole === 'huis_aanbieder') {
        const docRef = doc(db, 'providers', user.uid);
        unsubscribePhoto = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
             setProfilePhotoUrl(docSnap.data().photoUrl || null);
          }
        });
      } else {
        setProfilePhotoUrl(null);
      }
    } else {
      setProfilePhotoUrl(null);
    }
    return () => {
      if (unsubscribePhoto) unsubscribePhoto();
    }
  }, [user, userRole]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      toast.success(t('auth.login_success', { defaultValue: 'Succesvol ingelogd!' }));
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
         toast.error(`Domein is niet geautoriseerd in Firebase Auth. Voeg ${window.location.hostname} toe aan de Authorized Domains in de Firebase Console.`);
      } else {
         toast.error('Login mislukt: ' + error.message);
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('dismissed_admin_messages');
    setDismissedMessages([]);
    return signOut(auth);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleSelectRole = async (role: string) => {
    if (!user) return;
    try {
      console.log("Updating role for user", user.uid, "to", role);
      const result = await updateUserRole(role as 'huis_zoeker' | 'huis_aanbieder');
      setUserRole(result.role);
      toast.success("Rol succesvol opgeslagen!");
    } catch (e: any) {
      console.error("Fout bij rolopslaan:", e);
      toast.error('Er ging iets mis bij het opslaan van je rol: ' + e.message);
      throw e;
    }
  };

  const isAppStopped = (() => {
    // If not config yet, or disabled, or admin bypassing
    if (!appStopConfig || !appStopConfig.isEnabled || !appStopConfig.startDate || adminBypassFreeze) return false;
    
    // If we are definitely an admin, don't stop
    if (isAdminUser) return false;

    // Create a normalized "now" string
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getDate()).padStart(2, '0');
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const currentStr = `${year}-${month}-${day}T${hours}:${minutes}`;

    const startStr = appStopConfig.startDate; 
    
    if (currentStr < startStr) return false;

    if (appStopConfig.duration) {
      const parts = appStopConfig.duration.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const startDate = new Date(startStr);
        const durationMs = (parts[0] * 60 + parts[1]) * 60 * 1000;
        const endDate = new Date(startDate.getTime() + durationMs);
        if (currentTime > endDate) return false;
      }
    }

    return true;
  })();

  const messagesToDisplay = activeAdminMessages.filter(msg => {
    if (msg.isDisabled || isAdminUser) return false;
    
    // Check target audience
    if (msg.targetAudience !== 'all' && msg.targetAudience !== userRole) {
      return false;
    }

    // Create a normalized "now" string for easy comparison (YYYY-MM-DDTHH:mm)
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getDate()).padStart(2, '0');
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const currentStr = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Check dates (Stated time is taken literally as browser time)
    if (currentStr < msg.startDate) return false;

    if (msg.endDate) {
      if (currentStr > msg.endDate) return false;
    }

    // Check if dismissed
    if (dismissedMessages.includes(msg.id)) return false;

    return true;
  });

  useEffect(() => {
    if (isSeekerChatsModalOpen || isProviderChatsModalOpen) {
      window.dispatchEvent(new Event('chat-opened'));
    } else {
      window.dispatchEvent(new Event('chat-closed'));
    }
  }, [isSeekerChatsModalOpen, isProviderChatsModalOpen]);

  if (isUserSuspended && !isAdminUser) {
    return (
      <div className="fixed inset-0 z-[1000000] bg-black/45 backdrop-blur-md flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-lg bg-white border border-outline rounded-[2.5rem] p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-red-100 text-[#ef4444] rounded-3xl flex items-center justify-center mx-auto">
            <X size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl md:text-3xl font-black text-on-surface tracking-tight leading-none">
              Account Gedeactiveerd
            </h1>
            <p className="text-xs font-black uppercase tracking-widest text-[#ef4444]">
              Toegang tijdelijk beperkt
            </p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl border border-outline/5 text-sm font-medium text-on-surface-variant leading-relaxed">
            Je account is op non-actief gesteld door de beheerder. Al je woningen zijn momenteel onzichtbaar voor anderen en je hebt geen toegang tot de functies van deze applicatie. Neem voor vragen contact op met support.
          </div>
          <button 
            onClick={handleLogout}
            className="w-full bg-[#3c372b] text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Meld af
          </button>
        </div>
      </div>
    );
  }

  if (isAppStopped) {
    return (
      <div className="fixed inset-0 z-[1000000] bg-black/40 backdrop-blur-md flex flex-col justify-start items-center">
        <div className="w-full h-1/2 bg-[#ef4444] text-white flex flex-col items-center justify-center p-8 md:p-12 text-center shadow-2xl relative select-none animate-in slide-in-from-top duration-500">
          <div className="max-w-3xl space-y-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-4xl animate-bounce">⚠️</span>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight leading-none drop-shadow-md">
              Applicatie Tijdelijk Gestopt
            </h1>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/20 shadow-xl max-w-xl mx-auto space-y-4">
              <p className="text-lg md:text-xl font-bold leading-relaxed break-words whitespace-pre-wrap drop-shadow-sm opacity-95">
                {appStopConfig.message || "De applicatie is tijdelijk onderbroken voor gepland onderhoud. Onze excuses voor het ongemak."}
              </p>
            </div>
            
            {isAdminUser ? (
              <button 
                onClick={() => setAdminBypassFreeze(true)}
                className="mt-8 bg-white text-red-600 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl active:scale-95"
              >
                ADMIN NEGEER BLOKKADE (TESTEN)
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4 mt-8">
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-white text-red-600 px-10 py-5 rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.2)] flex items-center gap-3"
                >
                  <Activity size={20} className="animate-pulse" />
                  CONTROLEER STATUS OPNIEUW
                </button>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Vernieuw de pagina om te zien of de blokkade is opgeheven</p>
              </div>
            )}
          </div>
        </div>
        <div className="w-full h-1/2 pointer-events-none" />
      </div>
    );
  }

  if (loading || !appStopReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
          />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary animate-pulse">Status Controleren...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Toaster position="bottom-right" toastOptions={{ duration: 3000, style: { background: '#3c372b', color: '#fff', fontSize: '12px', fontWeight: 'bold', borderRadius: '1rem' } }} containerStyle={{ zIndex: 9999999 }} />
      <CookieBanner />
      <PWAInstallPrompt 
        user={user} 
        userRole={userRole} 
      />

      {/* Admin Message Broadcast Box */}
      {user && messagesToDisplay.length > 0 && (
        <div className="w-full relative z-[55] flex flex-col divide-y divide-white/10 shadow-sm animate-in slide-in-from-top duration-300">
          {messagesToDisplay.map((msg) => (
            <div 
              key={msg.id} 
              className={`w-full flex justify-between items-center px-6 py-3.5 text-xs font-bold relative transition-all duration-300 ${
                msg.type === 'error' ? 'bg-[#ef4444] text-white' :
                msg.type === 'warning' ? 'bg-[#f59e0b] text-white' :
                'bg-[#3b82f6] text-white'
              }`}
            >
              <div className="flex items-center gap-3 pr-8 flex-1 max-w-7xl mx-auto w-full">
                <span className="text-sm">
                  {msg.type === 'error' ? '🚨' : msg.type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span className="leading-snug break-words whitespace-pre-wrap">{msg.text}</span>
              </div>
              <button
                onClick={() => handleDismissMessage(msg.id)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white/20 transition-all text-white active:scale-95 cursor-pointer flex items-center justify-center"
                title="Sluiten"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navbar */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-outline shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-12 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
            {!isVibeActive && (
              <span className="text-2xl font-bold font-display text-on-background tracking-tight">Co-Match</span>
            )}
          </div>

          <nav className="hidden md:flex gap-8 items-center text-on-surface-variant font-medium">
            {user && userRole !== 'huis_zoeker' && userRole !== 'admin' ? (
              <>
                {userRole !== 'huis_aanbieder' && (
                  <a href="#" className="hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); setActivePage('dashboard'); }}>{t('nav.dashboard')}</a>
                )}
                {userRole !== 'huis_aanbieder' && (
                  <a href="#" className="hover:text-primary transition-colors">{t('nav.explore')}</a>
                )}
                {userRole !== 'huis_aanbieder' && (
                  <a href="#" className="hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); setInfoModalKey('footer.modal_content'); }}>{t('nav.messages')}</a>
                )}
                {userRole !== 'huis_aanbieder' && (
                  <a href="#" className="hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); setInfoModalKey('footer.prices'); }}>{t('nav.prices')}</a>
                )}
              </>
            ) : null}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            {user && userRole === 'huis_zoeker' && (
              <button
                onClick={() => setIsSeekerChatsModalOpen(true)}
                className="relative p-2.5 rounded-xl transition-all duration-300 text-on-surface-variant hover:bg-surface-container-high hover:text-primary active:scale-95 group"
                title={t('nav.messages', 'Berichten')}
              >
                <div className="flex items-center justify-center">
                  <MessageSquare size={22} className={unreadChatsCount > 0 ? "text-primary" : ""} />
                </div>
                
                <AnimatePresence>
                  {unreadChatsCount > 0 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 font-sans font-black text-[9px] text-white items-center justify-center shadow-md">
                        {unreadChatsCount}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            )}

            {user && userRole === 'huis_aanbieder' && (
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => setIsProviderHelpOpen(true)}
                  className="p-2.5 rounded-xl transition-all duration-300 text-on-surface-variant hover:bg-surface-container-high hover:text-primary active:scale-95 cursor-pointer"
                  title={t('nav.provider_help', 'Vraag stellen aan Co-Match')}
                >
                  <div className="flex items-center justify-center">
                    <HelpCircle size={22} />
                  </div>
                </button>
                <button
                  onClick={() => setIsWeeklyHighlightModalOpen(true)}
                  className="relative p-2.5 rounded-xl transition-all duration-300 text-on-surface-variant hover:bg-surface-container-high hover:text-primary active:scale-95 cursor-pointer"
                  title="Wekelijkse Digest Highlight"
                >
                  <div className="flex items-center justify-center">
                    <Newspaper size={22} />
                  </div>
                  <AnimatePresence>
                    {availableHighlightSpots > 0 && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center"
                      >
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 font-sans font-black text-[9px] text-white items-center justify-center shadow-md">
                          {availableHighlightSpots}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                <button
                  onClick={() => setIsProviderChatsModalOpen(true)}
                  className="relative p-2.5 rounded-xl transition-all duration-300 text-on-surface-variant hover:bg-surface-container-high hover:text-primary active:scale-95 group"
                  title={t('nav.messages', 'Berichten')}
                >
                  <div className="flex items-center justify-center">
                    <MessageSquare size={22} className={unreadChatsCount > 0 ? "text-primary" : ""} />
                  </div>
                  
                  <AnimatePresence>
                    {unreadChatsCount > 0 && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center"
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 font-sans font-black text-[9px] text-white items-center justify-center shadow-md">
                          {unreadChatsCount}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                <GiftBox user={user} userRole={userRole} />
              </div>
            )}

            {user && userRole !== 'huis_aanbieder' && (
              <GiftBox user={user} userRole={userRole} />
            )}

            <div className="hidden md:flex items-center gap-4">
              {!user && <LanguageSwitcher />}

              {user ? (
                <div 
                  className="flex items-center gap-4 relative"
                  onMouseEnter={() => setIsUserMenuOpen(true)}
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-primary overflow-hidden border border-outline hover:ring-2 hover:ring-primary/50 transition-all focus:outline-none"
                  >
                    {(profilePhotoUrl || user.photoURL) ? (
                      <img src={profilePhotoUrl || user.photoURL || undefined} alt={user.displayName || ''} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={20} />
                    )}
                  </button>
                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 top-full pt-2 z-50 flex flex-col"
                      >
                       <div className="w-48 bg-white rounded-xl shadow-xl border border-outline overflow-hidden py-2 flex flex-col">
              {userRole !== 'admin' && (
                <>
                  <button
                    onClick={() => { 
                      if (userRole === 'huis_zoeker') {
                        window.dispatchEvent(new Event('open-seeker-profile'));
                      } else {
                        window.dispatchEvent(new Event('open-provider-profile'));
                      }
                      setIsUserMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold text-left w-full text-on-surface"
                  >
                    <UserIcon size={18} />
                    {t('nav.your_profile', { defaultValue: 'Jouw profiel' })}
                  </button>
                  <button
                    onClick={() => { window.dispatchEvent(new Event('open-credits-modal')); setIsUserMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold text-left w-full text-on-surface"
                  >
                    <Coins size={18} />
                    {t('nav.your_credits', { defaultValue: 'Jouw credits' })}
                  </button>
                  <button
                    onClick={() => { setIsAccountModalOpen(true); setIsUserMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold text-left w-full text-on-surface"
                  >
                    <UserIcon size={18} />
                    {t('nav.your_account', { defaultValue: 'Jouw account' })}
                  </button>
                </>
              )}
                        <button
                          onClick={() => { setIsSettingsOpen(true); setIsUserMenuOpen(false); }}
                          className="flex items-center gap-2 px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold text-left w-full text-on-surface"
                        >
                          <Settings size={18} />
                          {t('nav.settings', { defaultValue: 'Settings' })}
                        </button>
                        <div className="h-px bg-outline/50 w-full my-1" />
                        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold text-left w-full text-error">
                           <LogOut size={18} />
                           {t('nav.logout')}
                        </button>
                       </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <button 
                    onClick={handleLogin}
                    className="flex items-center gap-3 bg-white border border-outline px-6 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all font-bold text-sm text-on-background active:scale-95"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {t('nav.login')}
                  </button>
                </>
              )}
            </div>
            
            <button 
              className="md:hidden p-2 text-on-surface-variant"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="md:hidden border-t border-outline overflow-visible bg-white z-50"
                    >
                      <div className="flex flex-col p-6 gap-4 font-bold text-on-surface-variant">
                        {!user && (
                          <div className="mb-4">
                            <LanguageSwitcher />
                          </div>
                        )}
                        {user ? (
                          <div className="flex flex-col gap-3">
                            {userRole !== 'admin' && (
                              <>
                                <button
                                  onClick={() => { 
                                    if (userRole === 'huis_zoeker') {
                                      window.dispatchEvent(new Event('open-seeker-profile'));
                                    } else {
                                      window.dispatchEvent(new Event('open-provider-profile'));
                                    }
                                    setIsMenuOpen(false);
                                  }}
                                  className="w-full text-left py-3"
                                >
                                  {t('nav.your_profile', { defaultValue: 'Jouw profiel' })}
                                </button>
                                <button
                                   onClick={() => { window.dispatchEvent(new Event('open-credits-modal')); setIsMenuOpen(false); }}
                                   className="w-full text-left py-3"
                                >
                                   {t('nav.your_credits', { defaultValue: 'Jouw credits' })}
                                </button>
                                <button
                                   onClick={() => { setIsAccountModalOpen(true); setIsMenuOpen(false); }}
                                   className="w-full text-left py-3"
                                >
                                   {t('nav.your_account', { defaultValue: 'Jouw account' })}
                                </button>
                                <button
                                   onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }}
                                   className="w-full text-left py-3"
                                >
                                   {t('nav.settings', { defaultValue: 'Settings' })}
                                </button>
                              </>
                            )}
                            <button onClick={handleLogout} className="w-full text-left py-3 text-error">
                               {t('nav.logout', { defaultValue: 'Uitloggen' })}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <button onClick={handleLogin} className="bg-primary text-on-primary py-3 rounded-xl font-bold">{t('nav.login')}</button>
                          </div>
                        )}
                        <div className="h-px bg-outline/50 w-full my-2" />
                        {user && userRole !== 'huis_zoeker' && userRole !== 'admin' ? (
                           <>
                            <a href="#" className="hover:text-primary py-2" onClick={(e) => { e.preventDefault(); setActivePage('dashboard'); setIsMenuOpen(false); }}>{t('nav.dashboard')}</a>
                            {userRole !== 'huis_aanbieder' && (
                              <a href="#" className="hover:text-primary py-2" onClick={(e) => { e.preventDefault(); setIsMenuOpen(false); }}>{t('nav.explore')}</a>
                            )}
                            <a href="#" className="hover:text-primary py-2" onClick={(e) => { e.preventDefault(); setInfoModalKey('footer.modal_content'); setIsMenuOpen(false); }}>{t('nav.messages')}</a>
                            {userRole !== 'huis_aanbieder' && (
                              <a href="#" className="hover:text-primary py-2" onClick={(e) => { e.preventDefault(); setInfoModalKey('footer.prices'); setIsMenuOpen(false); }}>{t('nav.prices')}</a>
                            )}
                          </>
                        ) : null}
                      </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {user ? (
        <div className="flex-grow flex flex-col pb-16">
          {userRole === 'unassigned' && (
            <RoleSelectionModal 
              onSelectRole={handleSelectRole} 
              onLogout={handleLogout}
              userName={user.displayName?.split(' ')[0] || 'Nieuwe Gebruiker'} 
            />
          )}
          <Suspense fallback={
            <div className="flex-grow flex items-center justify-center p-12 text-center flex-col gap-6">
               <div className="w-16 h-16 border-4 border-primary border-t-transparent animate-spin rounded-full" />
               <p className="text-on-surface-variant font-medium">Bezig met laden...</p>
            </div>
          }>
            {activePage === 'profile' ? (
              <UserProfilePage onBack={() => setActivePage('dashboard')} />
            ) : userRole === 'huis_aanbieder' ? (
              <ProviderDashboard />
            ) : userRole === 'huis_zoeker' ? (
              <SeekerDashboard onNavigate={setActivePage} />
            ) : userRole === 'admin' ? (
              <ErrorBoundary>
                <AdminDashboard />
              </ErrorBoundary>
            ) : !userRole ? (
              <div className="flex-grow flex items-center justify-center p-12 text-center flex-col gap-6">
                 <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                 <p className="text-on-surface-variant font-medium">Bezig met laden van je profiel...</p>
                 <button onClick={handleLogout} className="text-primary font-bold underline">Opnieuw proberen / Uitloggen</button>
              </div>
            ) : null}
          </Suspense>
        </div>
      ) : (
        <LandingPage t={t} onStartProfile={handleLogin} />
      )}

      {/* Footer */}
      <footer 
        ref={footerRef}
        onMouseEnter={() => {
          if (user) {
            setIsFooterExpanded(true);
          }
        }}
        onMouseLeave={() => {
          if (user) {
            setIsFooterExpanded(false);
          }
        }}
        onClick={() => {
          if (user) {
            setIsFooterExpanded(!isFooterExpanded);
          }
        }}
        className={
          user 
            ? `fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-outline shadow-[0_-8px_30px_rgba(0,0,0,0.06)] transition-all duration-500 ease-in-out ${
                isFooterExpanded ? 'py-8 max-h-[85vh] overflow-y-auto' : 'py-1 md:py-2 h-[42px] overflow-hidden bg-slate-50 hover:bg-white cursor-pointer select-none'
              }`
            : 'bg-white py-20 border-t border-outline'
        }
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-full flex flex-col justify-between">
          <div className={
            user && !isFooterExpanded 
              ? 'hidden' 
              : 'grid grid-cols-1 md:grid-cols-3 gap-16 mb-20'
          }>
            <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
              {!isVibeActive && (
                <span className="text-2xl font-bold font-display text-primary mb-6 block">Co-Match</span>
              )}
              <p className="text-on-surface-variant leading-relaxed mb-8">
                {t('footer.mission')}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleShare(); }}
                  className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>
            
            <div onClick={(e) => e.stopPropagation()}>
              <h4 className="font-bold text-on-surface mb-6">{t('footer.discover')}</h4>
              <ul className="space-y-4 text-on-surface-variant font-medium">
                <li><button onClick={(e) => { e.stopPropagation(); setIsHowItWorksOpen(true); }} className="hover:text-primary transition-colors text-left">{t('footer.how_it_works')}</button></li>
                <li><button onClick={(e) => { e.stopPropagation(); setShowPricesModal(true); }} className="hover:text-primary transition-colors text-left">{t('nav.prices')}</button></li>
                <li><button onClick={(e) => { e.stopPropagation(); setIsStoriesOpen(true); }} className="hover:text-primary transition-colors text-left">{t('footer.stories')}</button></li>
              </ul>
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <h4 className="font-bold text-on-surface mb-6">{t('footer.support')}</h4>
              <ul className="space-y-4 text-on-surface-variant font-medium">
                <li><button onClick={(e) => { e.stopPropagation(); setIsSafetyOpen(true); }} className="hover:text-primary transition-colors text-left">{t('footer.safety')}</button></li>
                {user && (
                   <li><button onClick={(e) => { e.stopPropagation(); setIsContactOpen(true); }} className="hover:text-primary transition-colors text-left font-black">{t('footer.contact')}</button></li>
                )}
              </ul>
            </div>
          </div>

          <div className={
            user && !isFooterExpanded
              ? 'flex flex-row justify-between items-center text-xs text-on-surface-variant font-medium h-[26px] md:h-[30px]'
              : 'pt-10 border-t border-outline flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-on-surface-variant font-medium'
          }>
            <div className="flex flex-row items-center gap-2 md:gap-4 truncate" onClick={(e) => { if (user) { e.stopPropagation(); setIsFooterExpanded(!isFooterExpanded); } }}>
              {!isVibeActive && (
                <span className="font-black text-primary shrink-0">Co-Match</span>
              )}
              {!isVibeActive && <span className="hidden sm:inline text-outline/50">•</span>}
              <span className="truncate">{t('footer.copyright')}</span>
              <span className="hidden md:inline text-outline/50">•</span>
              <span className="text-[10px] opacity-65 shrink-0 hidden sm:inline">v{APP_VERSION}</span>
            </div>

            {/* Elegante open/sluit indicator in het midden */}
            {user && (
              <div 
                className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-wider bg-primary/5 hover:bg-primary/10 px-3 py-1 rounded-full transition-all shrink-0 cursor-pointer animate-pulse"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFooterExpanded(!isFooterExpanded);
                }}
              >
                <span>{isFooterExpanded ? "Inklappen ▾" : "Menu & Info ▴"}</span>
              </div>
            )}

            <div className="flex gap-4 sm:gap-8 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={(e) => { e.stopPropagation(); setInfoModalKey('footer.terms'); }} className="hover:text-primary transition-colors text-left text-xs sm:text-sm">{t('footer.terms')}</button>
              <button onClick={(e) => { e.stopPropagation(); setInfoModalKey('footer.privacy'); }} className="hover:text-primary transition-colors text-left text-xs sm:text-sm">{t('footer.privacy')}</button>
              <button onClick={(e) => { e.stopPropagation(); setInfoModalKey('footer.cookies'); }} className="hover:text-primary transition-colors text-left text-xs sm:text-sm">{t('footer.cookies')}</button>
            </div>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}>
        {isAccountModalOpen && (
          <AccountModal onClose={() => setIsAccountModalOpen(false)} />
        )}
        {isSeekerChatsModalOpen && (
          <SeekerChatsModal onClose={() => setIsSeekerChatsModalOpen(false)} />
        )}
        {isProviderChatsModalOpen && (
          <ProviderAllChatsModal onClose={() => setIsProviderChatsModalOpen(false)} />
        )}
        {isProviderHelpOpen && (
          <PropertyLimitModal isOpen={isProviderHelpOpen} onClose={() => setIsProviderHelpOpen(false)} />
        )}
        {isWeeklyHighlightModalOpen && (
          <WeeklyHighlightModal 
            isOpen={isWeeklyHighlightModalOpen} 
            onClose={() => {
              setIsWeeklyHighlightModalOpen(false);
              window.dispatchEvent(new CustomEvent('refresh-provider-properties'));
            }} 
          />
        )}
        <UserSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userRole={userRole || undefined} />
        <GenericInfoModal isOpen={!!infoModalKey} onClose={() => setInfoModalKey(null)} titleKey={infoModalKey || 'footer.modal_title'} />
        <HowItWorksModal isOpen={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
        <StoriesModal isOpen={isStoriesOpen} onClose={() => setIsStoriesOpen(false)} />
        <SafetyModal isOpen={isSafetyOpen} onClose={() => setIsSafetyOpen(false)} />
        {user && (
          <ContactModal 
            isOpen={isContactOpen} 
            onClose={() => setIsContactOpen(false)} 
            userEmail={user.email || ''}
            uid={user.uid}
          />
        )}
      </Suspense>
      
      <AnimatePresence>
        {showPricesModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPricesModal(false)}
              className="fixed inset-0 bg-on-background/40 backdrop-blur-sm z-[100] cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[101] flex flex-col overflow-hidden m-4"
            >
              <div className="flex items-center justify-between p-6 border-b border-outline">
                <h2 className="text-2xl font-display font-bold text-on-background">{t('credit.topup_credits')}</h2>
                <button 
                  onClick={() => setShowPricesModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                  <Coins size={40} />
                </div>
                <h3 className="text-2xl font-display font-black text-center">{t('credit.choose_package')}</h3>
                <p className="text-on-surface-variant leading-relaxed text-center font-medium">
                  {t('credit.modal_desc_brief')}
                </p>
                
                <div className="grid gap-4">
                   {CREDIT_PACKAGES.map(pack => (
                     <button 
                       key={pack.id}
                       onClick={() => toast.error("Stripe integratie komt later!")}
                       className="group p-6 bg-surface-container rounded-3xl border-2 border-transparent hover:border-primary transition-all text-left flex items-center justify-between"
                     >
                       <div>
                         <h4 className="font-bold text-lg">{t(pack.labelKey)}</h4>
                         <p className="text-primary font-black">{pack.credits} Credits</p>
                       </div>
                       <span className="text-2xl font-black">€{pack.price}</span>
                     </button>
                   ))}
                </div>

                <div className="bg-surface-container-low p-6 rounded-3xl border border-outline/50 space-y-3">
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{t('credit.why_credits')}</p>
                  <ul className="text-sm space-y-2 text-on-surface-variant font-medium">
                    <li className="flex items-center gap-2">• {t('credit.benefit_no_sub')}</li>
                    <li className="flex items-center gap-2">• {t('credit.benefit_pay_per_use')}</li>
                    <li className="flex items-center gap-2">• {t('credit.benefit_unlimited')}</li>
                  </ul>
                </div>
              </div>
              <div className="p-6 border-t border-outline flex justify-end bg-surface">
                <button 
                  onClick={() => setShowPricesModal(false)}
                  className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all"
                >
                  {t('credit.understood')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {(userRole === 'huis_zoeker' || userRole === 'huis_aanbieder') && <CreditsFloatingButton />}
    </div>
  );
}

function LandingPage({ t, onStartProfile }: { t: any, onStartProfile: () => void }) {
  return (
    <main className="flex-grow">
      {/* Hero Section */}
      <section className="relative w-full min-h-[700px] md:min-h-[900px] flex flex-col items-center justify-center px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2070" 
            alt="Hero background" 
            className="w-full h-full object-cover object-center scale-105"
          />
          <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center gap-12">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-6 px-4"
          >
            <h1 className="font-display text-5xl md:text-7xl font-bold text-white leading-[1.1] drop-shadow-lg whitespace-pre-line">
              {t('landing.hero_title')}
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto drop-shadow-md font-medium">
              {t('landing.hero_subtitle')}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white p-8 md:p-12 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-outline text-center relative overflow-hidden"
          >
            {/* Background design accent */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-tertiary" />
            
            <div className="space-y-8">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Globe size={32} />
              </div>
              
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-primary/60">{t('landing.community_badge')}</p>
                <h2 className="text-3xl font-display font-black text-on-background">{t('landing.community_title')}</h2>
                <p className="text-lg text-on-surface-variant font-medium leading-relaxed">
                  {t('landing.community_desc')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="p-4 bg-surface-container rounded-2xl flex items-start gap-3 border border-outline/30">
                  <span className="text-xl">🌍</span>
                  <p className="text-sm font-bold text-on-surface">{t('landing.feat_explore')}</p>
                </div>
                <div className="p-4 bg-surface-container rounded-2xl flex items-start gap-3 border border-outline/30">
                  <span className="text-xl">✨</span>
                  <p className="text-sm font-bold text-on-surface">{t('landing.feat_free')}</p>
                </div>
                <div className="p-4 bg-surface-container rounded-2xl flex items-start gap-3 border border-outline/30">
                  <span className="text-xl">⚡</span>
                  <p className="text-sm font-bold text-on-surface">{t('landing.feat_direct')}</p>
                </div>
                <div className="p-4 bg-surface-container rounded-2xl flex items-start gap-3 border border-outline/30">
                  <span className="text-xl">🤝</span>
                  <p className="text-sm font-bold text-on-surface">{t('landing.feat_community')}</p>
                </div>
              </div>

              <button 
                onClick={onStartProfile}
                className="group w-full bg-primary hover:bg-primary/95 text-on-primary font-black text-xl py-6 rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-4"
              >
                {t('landing.login_register')}
                <Handshake className="group-hover:translate-x-1 transition-transform" size={24} />
              </button>

              <div className="flex items-center justify-center gap-3 pt-2">
                <span className="h-px w-8 bg-outline/50" />
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
                  {t('landing.gmail_required')}
                </p>
                <span className="h-px w-8 bg-outline/50" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-20">
          <span className="text-primary font-bold tracking-[0.2em] uppercase text-xs">{t('vision.tag')}</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-on-surface">{t('vision.title')}</h2>
          <p className="text-lg text-on-surface-variant leading-relaxed font-medium">
            {t('vision.desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:h-[650px]">
          <div className="md:col-span-7 bg-white rounded-[2.5rem] shadow-sm border border-outline overflow-hidden relative group">
            <img 
              src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=2000" 
              alt="People matching" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white/95 backdrop-blur-md p-8 rounded-[2rem] max-w-md shadow-2xl border border-outline"
              >
                <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-primary mb-6">
                  <Handshake size={24} />
                </div>
                <h3 className="font-display text-2xl font-bold text-on-surface mb-3">{t('feat.matching.title')}</h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  {t('feat.matching.desc')}
                </p>
              </motion.div>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col gap-8">
            <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-outline p-10 flex flex-col justify-center relative overflow-hidden group">
              <div className="w-14 h-14 rounded-2xl bg-primary-container text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck size={30} />
              </div>
              <h3 className="font-display text-2xl font-bold text-on-background mb-4">{t('feat.verified.title')}</h3>
              <p className="text-on-surface-variant leading-relaxed font-medium">
                {t('feat.verified.desc')}
              </p>
            </div>

            <div className="flex-1 bg-primary text-white rounded-[2.5rem] shadow-xl p-10 flex flex-col justify-center group scale-100 hover:scale-[1.02] transition-transform duration-500">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare size={30} />
              </div>
              <h3 className="font-display text-2xl font-bold mb-4">{t('feat.contact.title')}</h3>
              <p className="text-white/80 leading-relaxed font-medium">
                {t('feat.contact.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <HousingTypeCarousel />

      {/* Quote Section */}
      <section className="bg-white py-24 px-6 border-y border-outline">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-10">
          <Quote size={48} className="text-primary/30" strokeWidth={3} />
          <blockquote className="font-display text-2xl md:text-4xl font-bold italic text-on-surface leading-snug">
            {t('quote.text')}
          </blockquote>
          <div className="flex items-center gap-4 mt-4">
            <div className="w-16 h-16 rounded-full border-2 border-primary/20 overflow-hidden shadow-lg">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200" 
                alt="Emma" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <p className="font-bold text-on-surface text-lg">{t('quote.author')}</p>
              <p className="text-on-surface-variant text-sm font-bold">{t('quote.location')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorksSection />
    </main>
  );
}

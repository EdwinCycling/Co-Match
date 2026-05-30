import React, { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search,
  Activity,
  Heart,
  MessageSquare,
  User,
  Filter,
  MapPin,
  Euro,
  Layout,
  Sparkles,
  AlertCircle,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Info,
  Calendar,
  Home,
  BedDouble,
  Maximize2,
  Sofa,
  Star,
  Check,
  PlusSquare,
  Sun,
  DoorOpen,
  ChefHat,
  Wind,
  Thermometer,
  TreePine,
  Car,
  Dog,
  Paintbrush,
  Users,
  Map as MapIcon,
  Image as ImageIcon,
  Minimize2,
  Wifi,
  Waves,
  Flame,
  Palmtree,
  Coffee,
  Utensils,
  Compass,
} from "lucide-react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  limit,
  where,
  serverTimestamp,
  onSnapshot,
  increment,
  query,
  collection,
  getDocs,
} from "firebase/firestore";
import { toast } from "react-hot-toast";
import { LANGUAGES_SORTED } from "../data/languages";
import SeekerProfileEditor from "./SeekerProfileEditor";
import { AutocompleteInput } from "./AutocompleteInput";

import { WorldGlobeModal } from "./WorldGlobeModal";
import {
  generateMatchReport,
  getExistingMatch,
} from "../services/matchService";
import { deductCredits } from "../services/creditService";
import { CREDIT_COSTS } from "../constants";
import MatchReportModal from "./MatchReportModal";
import InterestWorkflowModal from "./InterestWorkflowModal";
import VibeHousing from "./VibeHousing";
import TranslateText from "./TranslateText";
import { useCurrencyConverter } from "../hooks/useCurrencyConverter";
import { useSettings } from "../contexts/SettingsContext";
import { formatDate } from "../lib/formatters";
import { ExpertHub } from "./ExpertHub";
import { TrustBadge, TrustPopup } from "./TrustBadge";
import { MosaicGallery } from "./MosaicGallery";
import CoHarmonyAnalysis, { calculateCHAScore } from "./CoHarmonyAnalysis";

interface Property {
  id: string;
  ownerId?: string;
  title: string;
  city: string;
  country?: string;
  neighborhood?: string;
  price: number;
  priceType?: "fixed" | "range" | "tbd";
  minPrice?: number;
  maxPrice?: number;
  priceDescription?: string;
  features: any;
  teaserImageId?: string;
  images?: any[];
  displayLat?: number;
  displayLng?: number;
  displayRadius?: number;
  status?: "available" | "paused";
  monthlyAvailability?: Record<string, string>;
  highlightWeeks?: string[];
  ownerSuspended?: boolean;
}


export interface PropertyImage {
  id?: string;
  url: string;
  category?: string;
  description?: string;
}

export const isPropertyEnabled = (property: Property) => {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const status = property.monthlyAvailability?.[monthKey];
  return status === 'available' || status === 'free';
};


function FullScreenGallery({
  images,
  initialIdx,
  onClose,
}: {
  images: any[];
  initialIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const { t } = useTranslation();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx((idx + 1) % images.length);
  };
  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx((idx - 1 + images.length) % images.length);
  };

  const img = images[idx];
  if (!img) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="cm-modal-close-button absolute top-6 right-6 p-3 bg-surface/95 text-on-surface hover:bg-surface-container z-10 backdrop-blur-md"
      >
        <X size={24} />
      </button>

      <div
        className="relative w-full max-w-6xl max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={img.url}
          className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          alt=""
        />

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all shadow-xl"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={next}
              className="absolute right-4 p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all shadow-xl"
            >
              <ChevronRight size={32} />
            </button>
          </>
        )}

        {(img.category || img.description) && (
          <div className="absolute bottom-4 inset-x-0 flex justify-center w-full">
            <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl text-center shadow-xl border border-white/10 max-w-2xl w-auto">
              {img.category && (
                <div className="text-primary font-black text-[10px] uppercase tracking-widest mb-1">
                  {
                    t(
                      `prop.media.cat.${img.category.toLowerCase()}`,
                      img.category as any,
                    ) as string
                  }
                </div>
              )}
              {img.description && (
                <div className="text-white font-medium text-sm">
                  {img.description}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div
          className="absolute bottom-8 font-black text-white/50 tracking-widest text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {idx + 1} / {images.length}
        </div>
      )}
    </motion.div>
  );
}

export default function SeekerDashboard({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const { t, i18n } = useTranslation();

  // Custom helper to translate Dutch and English texts seamlessly
  const currentLang = i18n.language?.startsWith("nl") ? "nl" : "en";
  const lt = (nlText: string, enText: string) => {
    return currentLang === "nl" ? nlText : enText;
  };

  const matchGoal = (filterGoal: string, propGoal: string): boolean => {
    if (!filterGoal || !propGoal) return false;
    const fg = filterGoal.toLowerCase();
    const pg = propGoal.toLowerCase();
    
    if (fg === pg) return true;
    if (fg === "huisbewaring" && pg === "huisbewaring_expat") return true;
    if (fg === "huisbewaring_expat" && pg === "huisbewaring") return true;
    return false;
  };

  const matchType = (filterType: string, propType: string): boolean => {
    if (!filterType || !propType) return false;
    const ft = filterType.toLowerCase();
    const pt = propType.toLowerCase();
    
    if (ft === pt) return true;
    if ((ft === "huis" || ft === "woonhuis" || ft === "woning" || ft === "house") && 
        (pt === "huis" || pt === "woning" || pt === "woonhuis" || pt === "house")) return true;
    if ((ft === "kamer" || ft === "room") && (pt === "kamer" || pt === "room")) return true;
    if ((ft === "appartement" || ft === "apartment") && (pt === "appartement" || pt === "apartment")) return true;
    if (ft === "studio" && pt === "studio") return true;
    return false;
  };

  const filtersRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showGlobeModal) return; // Prevent closing filters while interacting with globe
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currencyConverter = useCurrencyConverter();
  const { dateFormat } = useSettings();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [isMinimalComplete, setIsMinimalComplete] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  const [showFullDetails, setShowFullDetails] = useState<Property | null>(null);
  const [returnToWorkflowOnClose, setReturnToWorkflowOnClose] = useState(false);
  const [showInterestWorkflow, setShowInterestWorkflow] =
    useState<Property | null>(null);
  const [matchReport, setMatchReport] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [showDirectChat, setShowDirectChat] = useState(false);
  useEffect(() => {
    if (showDirectChat) {
      window.dispatchEvent(new Event('chat-opened'));
    } else {
      window.dispatchEvent(new Event('chat-closed'));
    }
  }, [showDirectChat]);

  const [chatsStatus, setChatsStatus] = useState<
    Record<string, { isNew: boolean }>
  >({});
  const [providersMap, setProvidersMap] = useState<Record<string, any>>({});
  const [showPausedNotice, setShowPausedNotice] = useState(false);

  const [searchCity, setSearchCity] = useState("");
  const [searchCountry, setSearchCountry] = useState("Nederland");
  const [seekerLocation, setSeekerLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [seekerRadius, setSeekerRadius] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "vibe" | "discover" | "favorites" | "inspiratie" | "cha"
  >("vibe");
  const itemsPerPage = activeTab === "favorites" ? 10 : 3;

  useEffect(() => {
    setCurrentPage(1);
    // Track tab clicks for PWA install prompt logic (min 2 clicks)
    window.dispatchEvent(new Event('pwa-tab-click'));
    
    // Dispatch event to hide Co-Match logo in App header when in vibe mode
    window.dispatchEvent(new CustomEvent('vibe-status-changed', { 
      detail: { isVibeActive: activeTab === 'vibe' } 
    }));
  }, [activeTab, searchTerm]);
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedIdsForComparison, setSelectedIdsForComparison] = useState<
    string[]
  >([]);
  const [galleryImages, setGalleryImages] = useState<PropertyImage[] | null>(
    null,
  );
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [seekerProfile, setSeekerProfile] = useState<any>(null);
  
  interface ActiveFilters {
    city: string;
    lat: number | null;
    lng: number | null;
    minPrice: number;
    maxPrice: number;
    goals: string[];
    types: string[];
    useProfileSettings: boolean;
    showAllProperties: boolean;
  }

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    city: "",
    lat: null,
    lng: null,
    minPrice: 0,
    maxPrice: 5000,
    goals: [],
    types: [],
    useProfileSettings: false,
    showAllProperties: false,
  });

  const [tempFilters, setTempFilters] = useState<ActiveFilters>({
    city: "",
    lat: null,
    lng: null,
    minPrice: 0,
    maxPrice: 5000,
    goals: [],
    types: [],
    useProfileSettings: false,
    showAllProperties: false,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showGlobeModal, setShowGlobeModal] = useState(false);

  const handleOpenFilters = () => {
    setTempFilters({ ...activeFilters });
    setShowFilters(true);
  };

  const [minTrustLevel, setMinTrustLevel] = useState<number | null>(null);
  const [providerVerificationLevel, setProviderVerificationLevel] = useState<
    number | null
  >(null);
  const [showTrustPopup, setShowTrustPopup] = useState(false);

  const calculateMatchScore = (p: Property) => {
    if (!seekerProfile) return 0;

    // Use Co-Harmony Analysis score if the user has completed it
    if (seekerProfile.has_completed_cha && seekerProfile.harmony_answers) {
      return calculateCHAScore(seekerProfile.harmony_answers, p);
    }

    let score = 0;
    let totalWeight = 0;

    // Goal match (High weight)
    if (p.features?.goal && seekerProfile.goal && seekerProfile.goal.length > 0) {
      const hasGoalMatch = seekerProfile.goal.some((fg: string) => matchGoal(fg, p.features.goal));
      if (hasGoalMatch) {
        score += 40;
      }
    }
    totalWeight += 40;

    // Locatie & Afstand (Straal) Match (Option A)
    if (
      p.displayLat &&
      p.displayLng &&
      seekerProfile.lat &&
      seekerProfile.lng
    ) {
      const distance = calculateDistance(
        seekerProfile.lat,
        seekerProfile.lng,
        p.displayLat,
        p.displayLng,
      );
      const radius = seekerProfile.radius || 10;
      if (distance <= radius) {
        score += 25;
      } else if (distance <= radius * 1.5) {
        score += 15;
      } else if (distance <= radius * 2) {
        score += 5;
      }
    } else if (p.city && seekerProfile.city) {
      if (
        p.city.trim().toLowerCase() === seekerProfile.city.trim().toLowerCase()
      ) {
        score += 25;
      } else if (
        p.country &&
        seekerProfile.country &&
        p.country.trim().toLowerCase() ===
          seekerProfile.country.trim().toLowerCase()
      ) {
        score += 10;
      }
    }
    totalWeight += 25;

    // Price match
    const seekerBudget = seekerProfile.budget_max || seekerProfile.budget;
    if (p.price && seekerBudget) {
      if (p.price <= seekerBudget) score += 20;
      else if (p.price <= seekerBudget * 1.2) score += 10;
    }
    totalWeight += 20;

    // Property type match
    if (p.features?.type && seekerProfile.property_type && seekerProfile.property_type.length > 0) {
      const hasTypeMatch = seekerProfile.property_type.some((ft: string) => matchType(ft, p.features.type));
      if (hasTypeMatch) {
        score += 15;
      }
    }
    totalWeight += 15;

    // Normalize to 100
    const finalScore =
      totalWeight > 0
        ? Math.min(100, Math.round((score / totalWeight) * 100))
        : 0;
    // Add some random variety for vibe if scores are identical (prevents NaN if id is not hex-parsable)
    const propId = p.id || "";
    const parsedHexVal = propId ? parseInt(propId.substring(0, 2), 16) : NaN;
    const addedVariety = !isNaN(parsedHexVal)
      ? parsedHexVal % 5
      : (propId ? (propId.charCodeAt(0) % 5) : 0);
    return finalScore > 0 ? Math.min(100, finalScore + addedVariety) : 0;
  };

  useEffect(() => {
    // Toggle credits visibility when matching
    window.dispatchEvent(
      new CustomEvent("toggle-credits-visibility", { detail: !isMatching }),
    );
  }, [isMatching]);

  const latestPropertiesRef = React.useRef(properties);
  React.useEffect(() => {
    latestPropertiesRef.current = properties;
  }, [properties]);

  const latestOpenReportRef = React.useRef<any>(null);
  React.useEffect(() => {
    latestOpenReportRef.current = openReport;
  }); // runs on every render to keep it up to date

  useEffect(() => {
    const handleSwitch = () => {
      setActiveTab("favorites");
      setMatchReport(null);
      setSelectedProperty(null);
      setShowFullDetails(null);
      setShowDirectChat(false);
    };
    window.addEventListener("switch-to-favorites", handleSwitch);

    const handleSwitchDiscover = () => {
      setActiveTab("discover");
      setMatchReport(null);
      setSelectedProperty(null);
      setShowFullDetails(null);
      setShowDirectChat(false);
    };
    window.addEventListener("switch-to-discover", handleSwitchDiscover);

    const handleOpenChat = (e: any) => {
      const { propertyId, isAlreadyUnlocked } = e.detail;
      const prop = latestPropertiesRef.current.find(p => p.id === propertyId);
      if (prop) {
        latestOpenReportRef.current?.(prop, true, isAlreadyUnlocked);
      } else {
        // If not in current list, try to fetch it
        getDoc(doc(db, "properties", propertyId)).then(snap => {
          if (snap.exists()) {
            latestOpenReportRef.current?.({ id: snap.id, ...snap.data() } as Property, true, isAlreadyUnlocked);
          }
        });
      }
    };
    window.addEventListener("open-property-chat", handleOpenChat);
    window.addEventListener("open-property-chat-internal", handleOpenChat);

    const handleOpenProfile = () => {
      setIsEditorOpen(true);
    };
    window.addEventListener("open-seeker-profile", handleOpenProfile);

    return () => {
      window.removeEventListener("switch-to-favorites", handleSwitch);
      window.removeEventListener("switch-to-discover", handleSwitchDiscover);
      window.removeEventListener("open-property-chat", handleOpenChat);
      window.removeEventListener("open-property-chat-internal", handleOpenChat);
      window.removeEventListener("open-seeker-profile", handleOpenProfile);
    };
  }, []);

  useEffect(() => {
    if (
      showEncouragement ||
      selectedProperty ||
      showFullDetails ||
      matchReport ||
      isEditorOpen ||
      activeTab === "vibe"
    ) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "auto";
      document.documentElement.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "auto";
      document.documentElement.style.overflow = "unset";
    };
  }, [
    showEncouragement,
    selectedProperty,
    showFullDetails,
    matchReport,
    isEditorOpen,
    activeTab,
  ]);

  useEffect(() => {
    let unsubsProfile: (() => void) | undefined;
    
    // Listen to Firebase Auth state changes so we are 100% sure the profile and properties load correctly
    // especially on page load when the user is authenticated asynchronously.
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        checkProfileStatus(true);
        unsubsProfile = onSnapshot(doc(db, 'seeker_profiles', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSeekerProfile(data);
            setHasProfile(data.has_completed_minimal === true);
            setIsMinimalComplete(data.has_completed_minimal === true);
            setFavoriteIds(Array.from(new Set(data.favorites || [])) as string[]);
            if (data.lat && data.lng) {
              setSeekerLocation({ lat: data.lat, lng: data.lng });
            }
          }
        });
      } else {
        if (unsubsProfile) {
          unsubsProfile();
          unsubsProfile = undefined;
        }
      }
    });

    // Also run immediately if auth.currentUser is already present
    if (auth.currentUser) {
      checkProfileStatus(true);
      unsubsProfile = onSnapshot(doc(db, 'seeker_profiles', auth.currentUser.uid), (docSnap) => {
         if (docSnap.exists()) {
            const data = docSnap.data();
            setSeekerProfile(data);
            setHasProfile(data.has_completed_minimal === true);
            setIsMinimalComplete(data.has_completed_minimal === true);
            setFavoriteIds(Array.from(new Set(data.favorites || [])) as string[]);
            if (data.lat && data.lng) {
              setSeekerLocation({ lat: data.lat, lng: data.lng });
            }
          }
      });
    }

    return () => {
      unsubscribeAuth();
      if (unsubsProfile) unsubsProfile();
    };
  }, []);

  // Automatischer refresh / verversing wanneer de zoeker wisselt naar de 'discover' (ontdekken) tab
  useEffect(() => {
    if (activeTab === "discover" && auth.currentUser) {
      checkProfileStatus(true);
    }
  }, [activeTab]);

  // Fetch favorites when profile status is checked or tab switched
  useEffect(() => {
    if (auth.currentUser) {
      fetchFavorites();
    }
  }, [auth.currentUser, isMinimalComplete, activeTab, favoriteIds, properties]);

  // Handle switch to favorites event
  useEffect(() => {
    const handleSwitch = () => setActiveTab("favorites");
    window.addEventListener("switch-to-favorites", handleSwitch);
    return () =>
      window.removeEventListener("switch-to-favorites", handleSwitch);
  }, []);

  // Listen to all seeker's chats for notifications
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("seekerId", "==", auth.currentUser.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const status: Record<string, { isNew: boolean }> = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          // Simple "isNew" logic: if last sender was NOT the user, consider it new/unread for user
          status[data.propertyId] = {
            isNew:
              data.lastSenderId !== auth.currentUser?.uid &&
              data.messages?.length > 0,
          };
        });
        setChatsStatus(status);
      },
      (error) => handleFirestoreError(error, OperationType.GET, "chats"),
    );

    return () => unsubscribe();
  }, [auth.currentUser]);

  const getPaginationRange = (current: number, total: number) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    range.push(1);
    for (let i = current - delta; i <= current + delta; i++) {
      if (i < total && i > 1) {
        range.push(i);
      }
    }
    if (total > 1) {
      range.push(total);
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const checkProfileStatus = async (shouldFetchProperties = false) => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, "seeker_profiles", auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSeekerProfile(data);
        setHasProfile(data.has_completed_minimal === true);
        setIsMinimalComplete(data.has_completed_minimal === true);
        setSearchCity(data.city || "");
        setSearchCountry(data.country || "Nederland");
        setFavoriteIds(Array.from(new Set(data.favorites || [])) as string[]);
        if (data.lat && data.lng) {
          setSeekerLocation({ lat: data.lat, lng: data.lng });
        }
        if (data.radius !== undefined) {
          setSeekerRadius(data.radius);
        }

        if (shouldFetchProperties) {
          fetchSampleProperties(activeFilters.showAllProperties ? undefined : data.city, data);
        }
      } else {
        setHasProfile(false);
        setIsMinimalComplete(false);
        setFavoriteIds([]);
        if (shouldFetchProperties) {
          fetchSampleProperties();
        }
      }
    } catch (error) {
      console.error("Error checking profile status:", error);
      setHasProfile(false);
      setFavoriteIds([]);
    }
  };

  const fetchFavorites = async () => {
    if (!auth.currentUser || favoriteIds.length === 0) {
      setFavorites([]);
      return;
    }

    try {
      // Find which favorites we already have in our properties state
      const existingFavs = properties.filter((p) => favoriteIds.includes(p.id));
      const existingIds = existingFavs.map((p) => p.id);
      const missingIds = favoriteIds.filter((id) => !existingIds.includes(id));

      if (missingIds.length > 0) {
        const fetchedMissing: Property[] = [];

        // Fetch missing in chunks of 30 (Firestore limit for 'in' queries)
        for (let i = 0; i < missingIds.length; i += 30) {
          const chunk = missingIds.slice(i, i + 30);
          const q = query(
            collection(db, "properties"),
            where("__name__", "in", chunk),
          );
          const snap = await getDocs(q);
          snap.docs.forEach((doc) => {
            fetchedMissing.push({ id: doc.id, ...doc.data() } as Property);
          });
        }

        // Merge and maintain order of favoriteIds
        const allFavs = [...existingFavs, ...fetchedMissing];
        const sortedFavs = favoriteIds
          .map((id) => allFavs.find((p) => p.id === id))
          .filter(Boolean) as Property[];

        setFavorites(sortedFavs);
      } else {
        // Just maintain order
        const sortedFavs = favoriteIds
          .map((id) => existingFavs.find((p) => p.id === id))
          .filter(Boolean) as Property[];
        setFavorites(sortedFavs);
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  };

  function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371; // Earth ratio in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.round(d / 10) * 10; // Round per 10km for privacy
  }

  const isVakantieWoning = (p: Property) => {
    // Gebruik 'goal' vakantie_onderhuur voor vakantiewoningen zoals gevraagd (moet nu op Type/Goal filtering)
    return p.features?.goal === 'vakantie_onderhuur' && (p.status === 'available' || p.status === 'paused');
  };

  const getPropertyStatusLabel = (property: Property) => {
    // Current month key (YYYY-MM)
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const status = property.monthlyAvailability?.[monthKey];

    if (status === 'available') return t('availability.available', 'Beschikbaar');
    if (status === 'consultation') return t('availability.consultation', 'In overleg');
    // Default if no month record found (as specified in the prompt requirement)
    return t('availability.not_available', 'Niet in verhuur');
  };


  const fetchSampleProperties = async (city?: string, profile?: any) => {
    const currentProfile = profile || seekerProfile;
    setLoading(true);
    try {
      let q;
      if (city) {
        const capitalizedCity = city.charAt(0).toUpperCase() + city.slice(1);
        q = query(
          collection(db, "properties"),
          where("isActive", "==", true),
          where("city", "in", [city, capitalizedCity]),
          limit(100),
        );
      } else {
        q = query(
          collection(db, "properties"),
          where("isActive", "==", true),
          limit(150),
        );
      }

      const snapshot = await getDocs(q);
      let fetched = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...(doc.data() as any) }) as Property,
      );

      // We removed the upfront filtering to ensure favorites are not lost if they don't match
      // the current search goal. Filtering is now handled in the computed filteredProperties logic.

      const genericImages = [
        {
          id: "img_test_1",
          url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "img_test_2",
          url: "https://images.unsplash.com/photo-1502672260266-1c1c24226133?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "img_test_3",
          url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "img_test_4",
          url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "img_test_5",
          url: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "img_test_6",
          url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "img_test_7",
          url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=800",
        },
      ];

      const enrichPropertiesWithImages = (props: Property[]) => {
        return props.map((prop) => {
          if (!prop.images || prop.images.length === 0) {
            const char0 = prop.id.charCodeAt(0) || 0;
            const char1 = prop.id.charCodeAt(1) || 1;
            const numImages = (char0 % 3) + 1; // 1, 2 or 3
            const startIndex = char1 % genericImages.length;
            const images = [];
            for (let i = 0; i < numImages; i++) {
              images.push(
                genericImages[(startIndex + i) % genericImages.length],
              );
            }
            // Trigger background update if admin
            if (auth.currentUser?.email === "edwin@editsolutions.nl") {
              updateDoc(doc(db, "properties", prop.id), {
                images: images,
                teaserImageId: images[0].id,
              }).catch(() => {});
            }
            return {
              ...prop,
              images,
              teaserImageId: images[0].id,
            };
          }
          return prop;
        });
      };

      const enrichedFetched = enrichPropertiesWithImages(fetched);

      // If we searched by city but got nothing, try to fetch all again so the user isn't stuck
      if (city && enrichedFetched.length === 0) {
        const fallBackQ = query(
          collection(db, "properties"),
          where("isActive", "==", true),
          limit(100),
        );
        const fallBackSnapshot = await getDocs(fallBackQ);
        const fallBackFetched = fallBackSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Property,
        );
        setProperties(enrichPropertiesWithImages(fallBackFetched));
      } else {
        setProperties(enrichedFetched);
      }

      const uniqueOwnerIds = Array.from(
        new Set(
          (fetched.length > 0 ? fetched : properties)
            .map((p) => p.ownerId)
            .filter(Boolean),
        ),
      );
      
      const newProviders: Record<string, any> = {};
      const fetchPromises = uniqueOwnerIds
        .filter((oid) => !providersMap[oid as string])
        .map(async (oid) => {
          try {
            const oSnap = await getDoc(doc(db, "providers", oid as string));
            if (oSnap.exists()) {
              newProviders[oid as string] = oSnap.data();
            }
          } catch (err) {
            console.warn("Could not fetch user data for provider", oid, err);
          }
        });
        
      await Promise.all(fetchPromises);

      if (Object.keys(newProviders).length > 0) {
        setProvidersMap((prev) => ({ ...prev, ...newProviders }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "properties");
    }
    setLoading(false);
  };

  const handleLocationChange = async (city: string, country: string) => {
    if (!isMinimalComplete) return; // Prevent change if profile is not complete
    setSearchCity(city);
    setSearchCountry(country);

    if (auth.currentUser) {
      try {
        await setDoc(
          doc(db, "seeker_profiles", auth.currentUser.uid),
          {
            city,
            country,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        console.error("Error saving search location:", error);
      }
    }

    // In a real app we would refetch properties based on city/country here
  };

  const handleCardClick = (prop: Property) => {
    const hasContact =
      !!chatsStatus[prop.id] ||
      seekerProfile?.unlocked_chats?.includes(prop.id);
    if (prop.status === "paused" && !hasContact) {
      setShowPausedNotice(true);
      return;
    }
    if (!isMinimalComplete) {
      setShowEncouragement(true);
    } else {
      const isUnlocked =
        seekerProfile?.unlocked_all_options?.includes(prop.id) ||
        seekerProfile?.unlocked_details?.includes(prop.id);
      if (isUnlocked) {
        setShowInterestWorkflow(prop);
      } else {
        setSelectedProperty(prop);
      }
    }
  };

  const openReport = async (prop: Property, directChat = false, forceUnlocked = false) => {
    if (!auth.currentUser) return;

    // Check if property is paused
    const hasContact =
      forceUnlocked ||
      !!chatsStatus[prop.id] ||
      seekerProfile?.unlocked_chats?.includes(prop.id);
    if (prop.status === "paused" && !hasContact) {
      setShowPausedNotice(true);
      return;
    }

    // Prepare state immediately to show something is happening
    setSelectedProperty(prop);
    if (directChat) setShowDirectChat(true);

    // Check if chat is already unlocked
    const isChatUnlocked =
      forceUnlocked ||
      seekerProfile?.unlocked_chats?.includes(prop.id) ||
      !!chatsStatus[prop.id];

    if (directChat && !isChatUnlocked) {
      const confirmed = await window.confirm(
        t(
          "seeker.start_chat_confirm",
          "Dit kost credits om een chat te starten. Doorgaan?",
        ),
      );
      if (!confirmed) {
        setSelectedProperty(null);
        setShowDirectChat(false);
        return;
      }

      const success = await deductCredits(
        CREDIT_COSTS.START_CHAT,
        `Chat gestart met ${prop.title}`,
      );
      if (!success) {
        setSelectedProperty(null);
        setShowDirectChat(false);
        window.dispatchEvent(new Event("open-credits-modal"));
        return;
      }

      // Update local profile and firestore
      try {
        const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
        await updateDoc(ref, {
          unlocked_chats: arrayUnion(prop.id),
        });
      } catch (e) {
        console.error("Error updating unlocked chats:", e);
      }
    }

    // Automatically add to favorites
    try {
      const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
      await updateDoc(ref, { favorites: arrayUnion(prop.id) });
      setFavoriteIds((prev) =>
        prev.includes(prop.id) ? prev : [...prev, prop.id],
      );
    } catch (e) {
      console.error("Error auto-favoriting:", e);
    }

    setIsMatching(true);
    try {
      const existing = (await getExistingMatch(
        auth.currentUser.uid,
        prop.id,
      )) as any;
      if (existing && existing.report) {
        setMatchReport(existing.report);
      } else {
        const report = (await generateMatchReport(
          auth.currentUser.uid,
          prop.id,
          i18n.language || 'nl'
        )) as any;
        if (report && report.report) {
          setMatchReport(report.report);
        } else {
          // Fallback if AI fails but we want to chat
          if (directChat) {
            setMatchReport(
              t(
                "report.chat_only_notice",
                "AI Analyse tijdelijk niet beschikbaar, maar je kunt wel direct contact opnemen.",
              ),
            );
          } else {
            alert(
              t(
                "seeker.report_error",
                "Fout bij het genereren van het rapport.",
              ),
            );
          }
        }
      }
    } catch (e) {
      console.error(e);
      if (directChat) {
        setMatchReport(
          t(
            "report.chat_only_notice",
            "Er trad een fout op bij het laden, maar de chat is wel beschikbaar.",
          ),
        );
      }
    } finally {
      setIsMatching(false);
    }
  };

  if (loading && hasProfile === null) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Filter properties based on tab and alphabetical/distance sort
  const filteredProperties = (
    activeTab === "discover" ? properties : favorites
  ).filter((p) => {
    // Sluit woningen van gesuspendeerde eigenaren uit
    if (p.ownerSuspended) {
      return false;
    }
    // Only apply filters on the discover tab
    if (activeTab === "discover") {
      // 1. If "Alle huizen" is selected, bypass all filters
      if (activeFilters.showAllProperties) {
        return true;
      }

      // 2. If filtering on profile settings is selected (strict profile parameters check with smart fallback)
      if (activeFilters.useProfileSettings) {
        // Budget check (supporting both budget_max and budget)
        const maxBudget = seekerProfile?.budget_max || seekerProfile?.budget;
        const pPrice = p.price || p.minPrice || p.maxPrice || 0;
        if (maxBudget && maxBudget > 0 && pPrice > maxBudget) {
          // Allow up to a 10% overflow buffer to keep results friendly and prevent an empty page
          if (pPrice > maxBudget * 1.1) {
            return false;
          }
        }

        // Goal check (supporting strings or arrays safely with normalization)
        const profileGoals = Array.isArray(seekerProfile?.goal)
          ? seekerProfile.goal
          : seekerProfile?.goal
            ? [seekerProfile.goal]
            : [];
        const validGoals = profileGoals.filter(Boolean);
        if (validGoals.length > 0) {
          // If the property has an explicit goal, match it. If the property goal is completely missing,
          // don't immediately exclude it, but keep it as a potential option to avoid empty list.
          if (p.features?.goal) {
            const hasMatchingGoal = validGoals.some(fg => matchGoal(fg, p.features.goal));
            if (!hasMatchingGoal) {
              return false;
            }
          }
        }

        // Property type check (supporting strings or arrays safely with normalization)
        const profileTypes = Array.isArray(seekerProfile?.property_type)
          ? seekerProfile.property_type
          : seekerProfile?.property_type
            ? [seekerProfile.property_type]
            : [];
        const validTypes = profileTypes.filter(Boolean);
        if (validTypes.length > 0) {
          // If the property has an explicit type, match it. If missing, don't immediately exclude.
          if (p.features?.type) {
            const hasMatchingType = validTypes.some(ft => matchType(ft, p.features.type));
            if (!hasMatchingType) {
              return false;
            }
          }
        }

        // We do NOT filter out properties in other cities if "Mijn profiel" is active;
        // instead, the list naturally sorts them by distance to the user's focus coordinates.
        return true;
      }

      // 3. Apply handmatige (manual) filters

      // City search (intelligent city match) - only if coordinates are NOT selected
      if (activeFilters.city && !activeFilters.lat && !activeFilters.lng) {
        const filterCityLower = activeFilters.city.toLowerCase();
        const propCityLower = p.city ? p.city.toLowerCase() : "";
        if (!propCityLower.includes(filterCityLower)) {
          return false;
        }
      }

      // Budget match (minPrice & maxPrice)
      const price = p.price || p.minPrice || p.maxPrice || 0;
      if (price < activeFilters.minPrice || price > activeFilters.maxPrice) {
        return false;
      }

      // Goal match (multi-check with normalization)
      if (activeFilters.goals.length > 0) {
        if (!p.features?.goal) {
          return false;
        }
        const hasMatchingGoal = activeFilters.goals.some(fg => matchGoal(fg, p.features.goal));
        if (!hasMatchingGoal) {
          return false;
        }
      }

      // Property type match (multi-check with normalization)
      if (activeFilters.types.length > 0) {
        if (!p.features?.type) {
          return false;
        }
        const hasMatchingType = activeFilters.types.some(ft => matchType(ft, p.features.type));
        if (!hasMatchingType) {
          return false;
        }
      }

      // General trust level check (can be combined with manual filters)
      if (minTrustLevel !== null) {
        const trustLevel = providersMap[p.ownerId]?.verificationLevel || 1;
        if (trustLevel < minTrustLevel) return false;
      }
    }
    return true;
  });

  // Always sort by distance if location is known
  filteredProperties.sort((a, b) => {
    const activeLat = activeFilters.lat || (activeFilters.useProfileSettings || activeFilters.showAllProperties ? seekerProfile?.lat : null) || seekerLocation?.lat;
    const activeLng = activeFilters.lng || (activeFilters.useProfileSettings || activeFilters.showAllProperties ? seekerProfile?.lng : null) || seekerLocation?.lng;

    const distA =
      activeLat && activeLng && a.displayLat && a.displayLng
        ? calculateDistance(
            activeLat,
            activeLng,
            a.displayLat,
            a.displayLng,
          )
        : 999999;
    const distB =
      activeLat && activeLng && b.displayLat && b.displayLng
        ? calculateDistance(
            activeLat,
            activeLng,
            b.displayLat,
            b.displayLng,
          )
        : 999999;

    if (distA !== distB) return distA - distB;

    // Secondary sort: match score
    return calculateMatchScore(b) - calculateMatchScore(a);
  });

  const toggleSelectionForComparison = (id: string) => {
    setSelectedIdsForComparison((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    if (seekerProfile) {
      setSearchCity(seekerProfile.city || "");
      if (seekerProfile.lat && seekerProfile.lng) {
        setSeekerLocation({ lat: seekerProfile.lat, lng: seekerProfile.lng });
      } else {
        setSeekerLocation(null);
      }
    }
  };

  return (
    <main className="flex-grow bg-background overflow-x-hidden">
      {/* Search Header */}
      <section className="bg-white border-b border-outline py-6 md:py-10 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 md:gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-4xl font-display font-bold text-on-background">
              {activeTab === "discover" ? (
                <>
                  {(seekerProfile?.nickname || seekerProfile?.firstname) ? (
                    <>
                      <span className="hidden sm:inline">Hallo {seekerProfile.nickname || seekerProfile.firstname}, dit is ons aanbod</span>
                      <span className="sm:hidden">{t("dash.our_offer", { defaultValue: "Ons aanbod" })}</span>
                    </>
                  ) : (
                    t("dash.our_offer", { defaultValue: "Ons aanbod" })
                  )}
                </>
              ) : activeTab === "favorites"
                  ? t("dash.your_favorites", {
                      defaultValue: "Jouw favorieten",
                    })
                  : t("dash.your_matches")}
            </h1>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Tabs and Partners */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-1 bg-surface-container rounded-2xl p-1 border border-outline overflow-x-auto scrollbar-hide whitespace-nowrap">
                <button
                  onClick={() => {
                    if (activeTab === "vibe") { setRefreshKey(prev => prev + 1); }
                    setActiveTab("vibe");
                    fetchSampleProperties(activeFilters.showAllProperties ? undefined : (searchCity || seekerProfile?.city), seekerProfile);
                  }}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-1.5 px-3 md:px-6 py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === "vibe" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <span className="text-base md:text-lg leading-none">🔥</span>
                  <span className="hidden md:inline">{t("dashboard.tabs.vibe")}</span>
                </button>
                <button
                  onClick={() => {
                    if (activeTab === "discover") { setRefreshKey(prev => prev + 1); }
                    setActiveTab("discover");
                    fetchSampleProperties(activeFilters.showAllProperties ? undefined : (searchCity || seekerProfile?.city), seekerProfile);
                  }}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-1.5 px-3 md:px-6 py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === "discover" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Search size={14} className="md:w-4 md:h-4" />
                  <span className="hidden md:inline">{t("dashboard.tabs.discover")}</span>
                </button>
                <button
                  onClick={() => {
                    if (activeTab === "favorites") { setRefreshKey(prev => prev + 1); }
                    setActiveTab("favorites");
                    fetchSampleProperties(activeFilters.showAllProperties ? undefined : (searchCity || seekerProfile?.city), seekerProfile);
                  }}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-1.5 px-3 md:px-6 py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === "favorites" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Heart
                    size={14}
                    className="md:w-4 md:h-4"
                    fill={activeTab === "favorites" ? "currentColor" : "none"}
                  />
                  <span className="hidden md:inline">
                    {t("seeker.favorites")}
                  </span>
                  {favoriteIds.length > 0 && (
                    <span
                      className={`${activeTab === "favorites" ? "bg-primary/10" : "bg-surface-container-high"} text-on-surface w-4 h-4 md:w-5 md:h-5 rounded-full text-[9px] md:text-[10px] flex items-center justify-center font-black`}
                    >
                      {favoriteIds.length}
                    </span>
                  )}
                </button>
                {/* Inspiratie Tab */}
                <button
                  onClick={() => {
                    if (activeTab === "inspiratie") { setRefreshKey(prev => prev + 1); }
                    setActiveTab("inspiratie");
                    fetchSampleProperties(activeFilters.showAllProperties ? undefined : (searchCity || seekerProfile?.city), seekerProfile);
                  }}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-1.5 px-3 md:px-6 py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === "inspiratie" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Sparkles size={14} className="md:w-4 md:h-4" />
                  <span className="hidden md:inline">{t("dashboard.tabs.inspiratie", "Inspiratie")}</span>
                </button>

                {/* Co-Harmony Analysis (CHA) Tab - For all devices */}
                <button
                  onClick={() => {
                    if (activeTab === "cha") { setRefreshKey(prev => prev + 1); }
                    setActiveTab("cha");
                    fetchSampleProperties(activeFilters.showAllProperties ? undefined : (searchCity || seekerProfile?.city), seekerProfile);
                  }}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-1.5 px-3 md:px-6 py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === "cha" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Activity size={14} className="md:w-4 md:h-4" />
                  <span className="hidden md:inline">{t("dashboard.tabs.cha", "CHA")}</span>
                </button>
              </div>
            </div>

            {/* Filter icoon - Pas zichtbaar na voltooien van je profiel */}
            {isMinimalComplete && activeTab === "discover" && (
              <div 
                ref={filtersRef} 
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  onMouseEnter={() => {
                    if (!showFilters) {
                      handleOpenFilters();
                    }
                  }}
                  className={`h-11 w-11 flex items-center justify-center rounded-2xl border transition-all cursor-pointer ${
                    showFilters
                      ? "bg-primary border-primary text-on-primary shadow-md"
                      : "bg-surface-container border-outline text-primary hover:bg-surface-container-high hover:scale-105"
                  }`}
                  title={lt("Filters aanpassen", "Adjust filters")}
                >
                  <Filter size={18} />
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-full pt-2 z-50 w-80 sm:w-96 text-on-background"
                    >
                      <div className="bg-white rounded-3xl border border-outline p-6 shadow-2xl space-y-5">
                      <div className="flex items-center justify-between border-b border-outline/30 pb-3">
                        <h3 className="font-display font-black text-xs uppercase tracking-widest text-primary flex items-center gap-1.5">
                          <span>⚙️</span> {lt("Selecteer Filters", "Select Filters")}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowFilters(false)}
                          className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-black/5"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Filtermodus Segmenteerder */}
                      <div className="bg-surface-container p-1 rounded-2xl flex border border-outline/30 text-[10px] uppercase font-black tracking-wider text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setTempFilters(prev => ({
                              ...prev,
                              useProfileSettings: false,
                              showAllProperties: false
                            }));
                          }}
                          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${(!tempFilters.useProfileSettings && !tempFilters.showAllProperties) ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          {lt("Handmatig", "Manual")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTempFilters(prev => ({
                              ...prev,
                              city: "",
                              lat: null,
                              lng: null,
                              minPrice: 0,
                              maxPrice: 5000,
                              goals: [],
                              types: [],
                              useProfileSettings: true,
                              showAllProperties: false
                            }));
                          }}
                          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${tempFilters.useProfileSettings ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          {lt("Mijn Profiel", "My Profile")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTempFilters(prev => ({
                              ...prev,
                              city: "",
                              lat: null,
                              lng: null,
                              minPrice: 0,
                              maxPrice: 5000,
                              goals: [],
                              types: [],
                              useProfileSettings: false,
                              showAllProperties: true
                            }));
                          }}
                          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${tempFilters.showAllProperties ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          {lt("Alle Huizen", "All Houses")}
                        </button>
                      </div>

                      {/* 1. Plaats (intelligent zoeken) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "text-on-surface-variant/30" : "text-on-surface-variant/60"}`}>
                            {lt("Plaats", "Location")}
                          </span>
                          {tempFilters.city && !tempFilters.useProfileSettings && !tempFilters.showAllProperties && (
                            <button
                              type="button"
                              onClick={() => setTempFilters(prev => ({ ...prev, city: "", lat: null, lng: null }))}
                              className="text-[10px] text-primary font-black hover:underline mr-1"
                            >
                              {lt("Geselecteerde plaats wissen", "Clear selected location")}
                            </button>
                          )}
                        </div>
                        <div className={(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "opacity-35 pointer-events-none" : ""}>
                          <AutocompleteInput
                            value={tempFilters.city}
                            onChange={(val) => setTempFilters(prev => ({ ...prev, city: val }))}
                            onLocationSelect={(city, country, lat, lng) => {
                              setTempFilters(prev => ({
                                ...prev,
                                city,
                                lat,
                                lng
                              }));
                            }}
                            placeholder={lt("Type een stad...", "Type a city...")}
                            showIcon={true}
                            cityOnly={true}
                            className="w-full text-xs text-on-surface animate-fade-in"
                            disabled={tempFilters.useProfileSettings || tempFilters.showAllProperties}
                          />
                        </div>

                        {/* Beautiful interactive Large 3D Globe Button banner */}
                        <div className={(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "opacity-35 pointer-events-none" : ""}>
                          <button
                            type="button"
                            disabled={tempFilters.useProfileSettings || tempFilters.showAllProperties}
                            onClick={() => setShowGlobeModal(true)}
                            className="w-full border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 active:scale-95 transition-all p-4 rounded-2xl flex flex-col items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm hover:shadow-lg cursor-pointer group relative overflow-hidden"
                            title={lt("Open 3D Wereldbol", "Open 3D Globe")}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Pulsing indicator circle */}
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                              
                              <span className="text-3xl transition-transform duration-1000 group-hover:rotate-[360deg] ease-in-out inline-block">🌍</span>
                              
                              <div className="flex flex-col items-start">
                                <span className="text-xs font-black tracking-wider text-primary group-hover:text-primary-dark transition-colors">
                                  {lt("KIES VIA 3D WERELDBOL / KAART", "CHOOSE VIA 3D GLOBE / MAP")}
                                </span>
                                <span className="text-[8px] bg-primary text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse mt-0.5">
                                  {lt("👉 TIK HIER OM TE OPENEN 👈", "👉 TAP HERE TO OPEN 👈")}
                                </span>
                              </div>
                            </div>
                            
                            <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-primary transition-all text-center leading-normal mt-1 border-t border-outline/20 pt-1 w-full">
                              {tempFilters.city ? lt(`Nu geselecteerd: ${tempFilters.city} (klik om te wijzigen)`, `Selected: ${tempFilters.city} (click to edit)`) : lt("Klik hier om een plek op de interactieve 3D aarde te kiezen!", "Click here to choose a place on the interactive 3D Earth!")}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* 2. Geld (min/max met mooie slider) */}
                      <div className="space-y-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider block ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "text-on-surface-variant/30" : "text-on-surface-variant/60"}`}>
                          {lt("Maandbudget", "Monthly Rent")}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 space-y-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest block ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "text-on-surface-variant/30" : "text-on-surface-variant/40"}`}>
                              {lt("Min budget", "Min budget")}
                            </span>
                            <div className={`flex items-center bg-surface-container rounded-xl px-3 py-1.5 border border-outline ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "opacity-45" : ""}`}>
                              <span className="text-xs text-on-surface-variant mr-1">€</span>
                              <input
                                type="number"
                                value={(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "" : tempFilters.minPrice}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setTempFilters(prev => ({ ...prev, minPrice: val }));
                                }}
                                disabled={tempFilters.useProfileSettings || tempFilters.showAllProperties}
                                className="w-full bg-transparent text-xs font-bold outline-none border-none text-on-surface"
                              />
                            </div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest block ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "text-on-surface-variant/30" : "text-on-surface-variant/40"}`}>
                              {lt("Max budget", "Max budget")}
                            </span>
                            <div className={`flex items-center bg-surface-container rounded-xl px-3 py-1.5 border border-outline ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "opacity-45" : ""}`}>
                              <span className="text-xs text-on-surface-variant mr-1">€</span>
                              <input
                                type="number"
                                value={(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "" : tempFilters.maxPrice}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setTempFilters(prev => ({ ...prev, maxPrice: val }));
                                }}
                                disabled={tempFilters.useProfileSettings || tempFilters.showAllProperties}
                                className="w-full bg-transparent text-xs font-bold outline-none border-none text-on-surface"
                              />
                            </div>
                          </div>
                        </div>
                        {/* Slider */}
                        <div className={`pt-1.5 ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "opacity-20 select-none" : ""}`}>
                          <input
                            type="range"
                            min="0"
                            max="5000"
                            step="50"
                            value={tempFilters.maxPrice}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setTempFilters(prev => ({ ...prev, maxPrice: val }));
                            }}
                            disabled={tempFilters.useProfileSettings || tempFilters.showAllProperties}
                            className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                          <div className="flex justify-between text-[8px] font-mono font-black text-on-surface-variant/40 mt-1 uppercase tracking-wider">
                            <span>{lt("Min budget", "Min budget")}</span>
                            <span>{lt(`Tot €${tempFilters.maxPrice} / mnd`, `Up to €${tempFilters.maxPrice} / mo`)}</span>
                            <span>€5000+</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Doel (Woonvorm) */}
                      <div className="space-y-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider block ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "text-on-surface-variant/30" : "text-on-surface-variant/60"}`}>
                          {lt("Woonvorm", "Housing Goal")}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: "cohousing", label: lt("Cohousing", "Cohousing") },
                            { key: "hospita", label: lt("Hospita / Inwonen", "Homestay / Co-living") },
                            { key: "vrije_verhuur", label: lt("Vrije verhuur", "Private rental") },
                            { key: "vakantie_onderhuur", label: lt("Vakantie/Onderhuur", "Sublet / Holiday") },
                            { key: "huisbewaring", label: lt("Huisbewaring / Expat", "House sitting / Expat") }
                          ].map(goal => {
                            const isChecked = tempFilters.goals.includes(goal.key);
                            return (
                              <label
                                key={goal.key}
                                className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all select-none ${
                                  (tempFilters.useProfileSettings || tempFilters.showAllProperties)
                                    ? "opacity-30 pointer-events-none bg-surface-container-low border-outline/10 text-on-surface-variant/35"
                                    : isChecked
                                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                                      : "bg-surface-container-low border-outline/50 hover:border-outline text-on-surface-variant"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={tempFilters.useProfileSettings || tempFilters.showAllProperties}
                                  onChange={() => {
                                    const newGoals = isChecked
                                      ? tempFilters.goals.filter(g => g !== goal.key)
                                      : [...tempFilters.goals, goal.key];
                                    setTempFilters(prev => ({ ...prev, goals: newGoals }));
                                  }}
                                  className="sr-only"
                                />
                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${isChecked ? "bg-primary border-primary text-white" : "border-outline text-transparent"}`}>
                                  <Check size={8} strokeWidth={4} />
                                </div>
                                {goal.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. Type (Woningtype) */}
                      <div className="space-y-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider block ${(tempFilters.useProfileSettings || tempFilters.showAllProperties) ? "text-on-surface-variant/30" : "text-on-surface-variant/60"}`}>
                          {lt("Woningtype", "Property Type")}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: "Kamer", label: lt("Kamer", "Room") },
                            { key: "Studio", label: lt("Studio", "Studio") },
                            { key: "Appartement", label: lt("Appartement", "Apartment") },
                            { key: "Huis", label: lt("Woonhuis", "House") }
                          ].map(type => {
                            const isChecked = tempFilters.types.includes(type.key);
                            return (
                              <label
                                key={type.key}
                                className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all select-none ${
                                  (tempFilters.useProfileSettings || tempFilters.showAllProperties)
                                    ? "opacity-30 pointer-events-none bg-surface-container-low border-outline/10 text-on-surface-variant/35"
                                    : isChecked
                                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                                      : "bg-surface-container-low border-outline/50 hover:border-outline text-on-surface-variant"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={tempFilters.useProfileSettings || tempFilters.showAllProperties}
                                  onChange={() => {
                                    const newTypes = isChecked
                                      ? tempFilters.types.filter(t => t !== type.key)
                                      : [...tempFilters.types, type.key];
                                    setTempFilters(prev => ({ ...prev, types: newTypes }));
                                  }}
                                  className="sr-only"
                                />
                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${isChecked ? "bg-primary border-primary text-white" : "border-outline text-transparent"}`}>
                                  <Check size={8} strokeWidth={4} />
                                </div>
                                {type.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Buttons (Annuleren & Toepassen) */}
                      <div className="flex gap-2 border-t border-outline/30 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowFilters(false);
                          }}
                          className="flex-1 py-3 text-center rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-outline/30"
                        >
                          {lt("Annuleren", "Cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilters({ ...tempFilters });
                            setShowFilters(false);
                            // Direct opnieuw huizen ophalen op basis van de update
                            const activeCity = tempFilters.showAllProperties ? undefined : (tempFilters.city || searchCity || seekerProfile?.city);
                            fetchSampleProperties(activeCity, seekerProfile);
                          }}
                          className="flex-1 py-3 text-center rounded-xl bg-primary text-on-primary text-[10px] font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-md cursor-pointer"
                        >
                          {lt("Toepassen", "Apply")}
                        </button>
                      </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div key={refreshKey} className="max-w-7xl mx-auto py-8 md:py-12 px-4 md:px-6">
        {activeTab === "vibe" && isMinimalComplete && (
          <VibeHousing
            properties={properties}
            seekerProfile={seekerProfile}
            seekerLocation={seekerLocation}
            calculateDistance={calculateDistance}
            calculateMatchScore={calculateMatchScore}
            onMatch={(prop) => openReport(prop)}
            onLike={async (prop) => {
              if (!auth.currentUser) return;
              try {
                const isFav = favoriteIds.includes(prop.id);
                if (!isFav) {
                  const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
                  await updateDoc(ref, { favorites: arrayUnion(prop.id) });
                  setFavoriteIds((prev) =>
                    prev.includes(prop.id) ? prev : [...prev, prop.id],
                  );
                  toast.success(t("seeker.added_to_favorites"), {
                    duration: 2000,
                    position: "bottom-center",
                    style: {
                      background: "var(--color-primary)",
                      color: "#fff",
                      fontWeight: "bold",
                      borderRadius: "1rem",
                    },
                  });
                }
              } catch (e) {
                console.error("Error adding to favorites from vibe:", e);
              }
            }}
            onClose={() => setActiveTab("discover")}
            onEditProfile={() => setIsEditorOpen(true)}
            onShowDetails={(prop) => {
              const hasContact =
                !!chatsStatus[prop.id] ||
                seekerProfile?.unlocked_chats?.includes(prop.id);
              if (prop.status === "paused" && !hasContact) {
                setShowPausedNotice(true);
              } else {
                const isUnlocked =
                  seekerProfile?.unlocked_all_options?.includes(prop.id) ||
                  seekerProfile?.unlocked_details?.includes(prop.id);
                if (isUnlocked) {
                  setShowInterestWorkflow(prop);
                } else {
                  setSelectedProperty(prop);
                }
              }
            }}
          />
        )}

        {activeTab === "vibe" && !isMinimalComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 p-10 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden bg-primary text-on-primary"
          >
            <div className="relative z-10 space-y-4 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-white/20 w-fit px-3 py-1 rounded-full">
                <Sparkles size={14} />
                Match Chance
              </div>
              <h2 className="text-3xl font-display font-bold leading-tight">
                {t("seeker.banner_title_incomplete")}
              </h2>
              <p className="opacity-90 font-medium">
                {t("seeker.banner_desc_incomplete")}
              </p>
            </div>
            <button
              onClick={() => setIsEditorOpen(true)}
              className="relative z-10 bg-white text-primary px-10 py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all flex-shrink-0 group"
            >
              {t("seeker.banner_btn_incomplete")}
              <ArrowRight
                size={20}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-32 -mb-32" />
          </motion.div>
        )}

        {activeTab !== "vibe" &&
          activeTab === "discover" &&
          !isMinimalComplete &&
          !searchTerm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12 p-10 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden bg-primary text-on-primary"
            >
              <div className="relative z-10 space-y-4 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-white/20 w-fit px-3 py-1 rounded-full">
                  <Sparkles size={14} />
                  Match Chance
                </div>
                <h2 className="text-3xl font-display font-bold leading-tight">
                  {t("seeker.banner_title_incomplete")}
                </h2>
                <p className="opacity-90 font-medium">
                  {t("seeker.banner_desc_incomplete")}
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(true)}
                className="relative z-10 bg-white text-primary px-10 py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all flex-shrink-0 group"
              >
                {t("seeker.banner_btn_incomplete")}
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-32 -mb-32" />
            </motion.div>
          )}

        {/* Results Grid */}
        {(activeTab === "discover" || activeTab === "favorites") &&
          (() => {
            const indexOfLastItem = currentPage * itemsPerPage;
            const indexOfFirstItem = indexOfLastItem - itemsPerPage;
            const currentProperties = filteredProperties.slice(
              indexOfFirstItem,
              indexOfLastItem,
            );
            const totalPages = Math.ceil(
              filteredProperties.length / itemsPerPage,
            );

            return (
              <>
                {isMatching && (
                  <div className="col-span-full mb-8 bg-primary/10 p-6 rounded-3xl flex items-center justify-center gap-4 border border-primary/20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
                    />
                    <span className="font-bold text-primary">
                      {t("seeker.ai_match_preparing")}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {loading ? (
                    Array(itemsPerPage)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-[2.5rem] border border-outline h-96 animate-pulse"
                        />
                      ))
                  ) : currentProperties.length > 0 ? (
                    currentProperties.map((prop) => (
                      <PropertyPreviewCard
                        key={prop.id}
                        prop={prop}
                        onClick={() => handleCardClick(prop)}
                        isLocked={!isMinimalComplete}
                        isPropertyUnlocked={
                          !!(
                            seekerProfile?.unlocked_details?.includes(prop.id) ||
                            seekerProfile?.unlocked_all_options?.includes(prop.id) ||
                            seekerProfile?.unlocked_chats?.includes(prop.id) ||
                            seekerProfile?.unlocked_matches?.includes(prop.id) ||
                            chatsStatus[prop.id]
                          )
                        }
                        isFavorite={favoriteIds.includes(prop.id)}
                        showActions={activeTab === "favorites"}
                        hasNewChat={chatsStatus[prop.id]?.isNew}
                        hasChat={
                          !!chatsStatus[prop.id] ||
                          seekerProfile?.unlocked_chats?.includes(prop.id)
                        }
                        hasReport={seekerProfile?.unlocked_matches?.includes(
                          prop.id,
                        )}
                        onOpenReport={() => openReport(prop)}
                        onOpenChat={() => openReport(prop, true)}
                        onToggleFavorite={async () => {
                          if (!auth.currentUser) return;
                          const isFav = favoriteIds.includes(prop.id);
                          const ref = doc(
                            db,
                            "seeker_profiles",
                            auth.currentUser.uid,
                          );
                          try {
                            if (isFav) {
                              const newFavs = favoriteIds.filter(
                                (id) => id !== prop.id,
                              );
                              await updateDoc(ref, { favorites: newFavs });
                              setFavoriteIds((prev) =>
                                prev.filter((id) => id !== prop.id),
                              );
                            } else {
                              await updateDoc(ref, {
                                favorites: arrayUnion(prop.id),
                              });
                              setFavoriteIds((prev) =>
                                prev.includes(prop.id)
                                  ? prev
                                  : [...prev, prop.id],
                              );
                            }
                          } catch (e) {
                            console.error("Error toggling favorite:", e);
                          }
                        }}
                        seekerLocation={seekerLocation}
                        seekerRadius={seekerRadius}
                        calculateDistance={calculateDistance}
                        onSelectForComparison={() =>
                          toggleSelectionForComparison(prop.id)
                        }
                        isSelectedForComparison={selectedIdsForComparison.includes(
                          prop.id,
                        )}
                        providerVerificationLevel={
                          providersMap[prop.ownerId]?.verificationLevel || 1
                        }
                        onOpenTrustPopup={(lvl) => {
                          setProviderVerificationLevel(lvl);
                          setShowTrustPopup(true);
                        }}
                        matchScore={calculateMatchScore(prop)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant/30">
                        {activeTab === "favorites" ? (
                          <Heart size={40} />
                        ) : (
                          <Search size={40} />
                        )}
                      </div>
                      <p className="text-on-surface-variant font-bold">
                        {activeTab === "favorites"
                          ? t("seeker.no_favorites")
                          : searchTerm
                            ? t("seeker.no_results", { term: searchTerm })
                            : t("seeker.no_properties")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-12 pb-8">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="p-3 md:px-6 font-bold rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors disabled:bg-surface-container-low disabled:text-on-surface-variant/60 flex items-center gap-2"
                      >
                        <ChevronLeft size={20} />
                        <span className="hidden sm:inline">
                          {t("seeker.prev")}
                        </span>
                      </button>

                      <div className="flex gap-1.5 items-center overflow-x-auto scrollbar-hide py-1 max-w-[280px] sm:max-w-none">
                        {getPaginationRange(currentPage, totalPages).map(
                          (p, i) =>
                            p === "..." ? (
                              <span
                                key={`dots-${i}`}
                                className="px-2 text-on-surface-variant font-black"
                              >
                                ...
                              </span>
                            ) : (
                              <button
                                key={`page-${p}`}
                                onClick={() => setCurrentPage(p as number)}
                                className={`min-w-[40px] h-10 px-3 rounded-2xl font-bold transition-colors flex-shrink-0 ${
                                  currentPage === p
                                    ? "bg-primary text-on-primary shadow-md"
                                    : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                                }`}
                              >
                                {p}
                              </button>
                            ),
                        )}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="p-3 md:px-6 font-bold rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors disabled:bg-surface-container-low disabled:text-on-surface-variant/60 flex items-center gap-2"
                      >
                        <span className="hidden sm:inline">
                          {t("seeker.next")}
                        </span>
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Improved Profile Nudge - Subtler link below pagination */}
                {activeTab === "discover" &&
                  isMinimalComplete &&
                  !searchTerm &&
                  currentProperties.length > 0 && (
                    <div className="mt-8 flex justify-center">
                      <button
                        onClick={() => setIsEditorOpen(true)}
                        className="flex items-center gap-2 group text-on-surface-variant hover:text-primary transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <Sparkles
                            size={14}
                            className="group-hover:scale-110 transition-transform"
                          />
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                            {t("seeker.banner_title_complete")}
                          </span>
                          <span className="text-xs font-bold border-b border-transparent group-hover:border-primary/30">
                            {t("seeker.banner_btn_complete")}{" "}
                            {t("seeker.banner_desc_complete_short")}
                          </span>
                        </div>
                      </button>
                    </div>
                  )}

                {/* Expert Hub / Partner Network */}
                {seekerProfile && (
                  <div className="mt-16 pt-16 border-t border-outline/30">
                    <div className="flex flex-col gap-2 mb-8">
                      <h3 className="text-2xl md:text-3xl font-display font-black text-on-background">
                        Partner Netwerk
                      </h3>
                      <p className="text-on-surface-variant font-medium">
                        Hulp nodig bij je zoektocht of verhuizing? Bekijk onze
                        geselecteerde partners.
                      </p>
                    </div>
                    <div className="max-w-2xl">
                      <ExpertHub
                        forceShow={true}
                        country={seekerProfile?.country || "Nederland"}
                      />
                    </div>
                  </div>
                )}
              </>
            );
          })()}

        {/* Inspiratie Tab Content */}
        {activeTab === "inspiratie" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 hidden md:block" // Force hide on mobile per request
          >
            <div className="mb-8">
              <h2 className="text-3xl font-display font-black text-on-background">
                Laat je inspireren
              </h2>
              <p className="text-on-surface-variant font-medium mt-2">
                Ontdek droomwoningen op een newline manier.
              </p>
            </div>
            <MosaicGallery
              images={properties
                .filter((p) => {
                  // Only show properties matching the goal
                  if (seekerProfile?.goal?.length > 0 && p.features?.goal) {
                    if (!seekerProfile.goal.includes(p.features.goal))
                      return false;
                  }
                  return p.teaserImageId || (p.images && p.images.length > 0);
                })
                .slice(0, 20) // show up to 20 images
                .map((p) => {
                  const img =
                    p.images?.find((i) => i.id === p.teaserImageId) ||
                    p.images?.[0];
                  return {
                    id: p.id,
                    url: img?.url || "",
                    title:
                      p.title + (img?.category ? ` - ${img.category}` : ""),
                    onClick: () => {
                      const isLocked = !isMinimalComplete;
                      if (!isLocked) {
                        handleCardClick(p);
                      } else {
                        setIsEditorOpen(true);
                      }
                    },
                  };
                })}
            />
          </motion.div>
        )}

        {/* Co-Harmony Analysis (CHA) Tab Content */}
        {activeTab === "cha" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <CoHarmonyAnalysis
              properties={properties}
              seekerProfile={seekerProfile}
              onViewDetails={(prop) => handleCardClick(prop)}
              onOpenChat={(prop) => openReport(prop, true)}
              favoriteIds={favoriteIds}
              onToggleFavorite={async (prop) => {
                if (!auth.currentUser) return;
                try {
                  const isFav = favoriteIds.includes(prop.id);
                  const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
                  if (isFav) {
                    const newFavs = favoriteIds.filter(id => id !== prop.id);
                    await updateDoc(ref, { favorites: newFavs });
                    setFavoriteIds(newFavs);
                    toast.success(t("seeker.removed_from_favorites"));
                  } else {
                    await updateDoc(ref, { favorites: arrayUnion(prop.id) });
                    setFavoriteIds(prev => [...prev, prop.id]);
                    toast.success(t("seeker.added_to_favorites"));
                  }
                } catch (e) {
                  console.error("Error toggling favorite in CHA:", e);
                }
              }}
              chatsStatus={chatsStatus}
              onComplete={(harmonyIndex) => {
                setSeekerProfile((prev: any) =>
                  prev
                    ? {
                        ...prev,
                        harmony_index: harmonyIndex,
                        has_completed_cha: true,
                      }
                    : prev
                );
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Comparison Tool Bar */}
      <AnimatePresence>
        {activeTab === "favorites" && selectedIdsForComparison.length >= 2 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 inset-x-0 z-40 flex justify-center px-6"
          >
            <div className="bg-primary text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-6 border border-white/20 backdrop-blur-xl">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                  {t("seeker.comparison.selecting")}
                </span>
                <span className="text-sm font-bold">
                  {selectedIdsForComparison.length}{" "}
                  {t("seeker.comparison.homes")}
                </span>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <button
                onClick={() => setShowComparison(true)}
                className="bg-white text-primary px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                {t("seeker.comparison.btn")}
              </button>
              <button
                onClick={() => setSelectedIdsForComparison([])}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title={t("common.cancel", "Annuleren")}
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Modal */}
      <AnimatePresence>
        {showComparison && (
          <ComparisonModal
            properties={properties.filter((p) =>
              selectedIdsForComparison.includes(p.id),
            )}
            onClose={() => setShowComparison(false)}
            chatsStatus={chatsStatus}
            seekerProfile={seekerProfile}
            providersMap={providersMap}
            calculateMatchScore={calculateMatchScore}
          />
        )}
      </AnimatePresence>

      {/* Full Screen Gallery */}
      <AnimatePresence>
        {galleryImages && (
          <FullScreenGallery
            images={galleryImages}
            initialIdx={galleryIdx}
            onClose={() => setGalleryImages(null)}
          />
        )}
      </AnimatePresence>

      {/* Encouragement Modal */}
      <AnimatePresence>
        {showEncouragement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowEncouragement(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl border border-outline relative text-center space-y-8"
            >
              <button
                onClick={() => setShowEncouragement(false)}
                className="absolute top-8 right-8 p-3 hover:bg-surface-container rounded-full transition-all text-on-surface-variant"
              >
                <X size={20} />
              </button>

              <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto rotate-12 group-hover:rotate-0 transition-transform">
                <Sparkles size={48} />
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-display font-black uppercase tracking-tight text-on-background">
                  {t("seeker.modal_title")}
                </h3>
                <p className="text-on-surface-variant font-medium leading-relaxed">
                  {t("seeker.modal_desc")}
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowEncouragement(false);
                    setIsEditorOpen(true);
                  }}
                  className="w-full bg-primary text-on-primary py-5 rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-lg"
                >
                  {t("seeker.modal_btn_confirm")}
                </button>
                <button
                  onClick={() => setShowEncouragement(false)}
                  className="w-full py-4 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  {t("seeker.modal_btn_cancel")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Property Teaser Modal */}
      <AnimatePresence>
        {selectedProperty && !showFullDetails && !showInterestWorkflow && (
          <PropertyTeaserModal
            prop={selectedProperty}
            onClose={() => setSelectedProperty(null)}
            hasChat={
              !!chatsStatus[selectedProperty.id] ||
              seekerProfile?.unlocked_chats?.includes(selectedProperty.id)
            }
            seekerLocation={seekerLocation}
            calculateDistance={calculateDistance}
            onShowInterestWorkflow={() => {
              setShowInterestWorkflow(selectedProperty);
            }}
            isFavorite={favoriteIds.includes(selectedProperty.id)}
            onToggleFavorite={async () => {
              if (!auth.currentUser) return;
              const isFav = favoriteIds.includes(selectedProperty.id);
              const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
              try {
                if (isFav) {
                  const newFavs = favoriteIds.filter(
                    (id) => id !== selectedProperty.id,
                  );
                  await updateDoc(ref, { favorites: newFavs });
                  setFavoriteIds((prev) =>
                    prev.filter((id) => id !== selectedProperty.id),
                  );
                } else {
                  await updateDoc(ref, {
                    favorites: arrayUnion(selectedProperty.id),
                  });
                  setFavoriteIds((prev) =>
                    prev.includes(selectedProperty.id)
                      ? prev
                      : [...prev, selectedProperty.id],
                  );
                }
              } catch (e) {
                console.error("Error toggling favorite:", e);
              }
            }}
            onShowGallery={(imgs, idx) => {
              setGalleryImages(imgs);
              setGalleryIdx(idx);
            }}
          />
        )}

        {showFullDetails && (
          <PropertyFullDetailsModal
            prop={showFullDetails}
            isFavorite={favoriteIds.includes(showFullDetails.id)}
            onClose={() => {
              const currentProp = showFullDetails;
              setShowFullDetails(null);
              setSelectedProperty(null);
              if (currentProp && returnToWorkflowOnClose) {
                setShowInterestWorkflow(currentProp);
              }
              setReturnToWorkflowOnClose(false);
            }}
            seekerLocation={seekerLocation}
            calculateDistance={calculateDistance}
            onMatchGenerated={(report) => {
              setMatchReport(report);
            }}
            seekerProfile={seekerProfile}
            onToggleFavorite={async () => {
              if (!auth.currentUser) return;
              const isFav = favoriteIds.includes(showFullDetails.id);
              const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
              try {
                if (isFav) {
                  const newFavs = favoriteIds.filter(
                    (id) => id !== showFullDetails.id,
                  );
                  await updateDoc(ref, { favorites: newFavs });
                  setFavoriteIds((prev) =>
                    prev.filter((id) => id !== showFullDetails.id),
                  );
                } else {
                  await updateDoc(ref, {
                    favorites: arrayUnion(showFullDetails.id),
                  });
                  setFavoriteIds((prev) =>
                    prev.includes(showFullDetails.id)
                      ? prev
                      : [...prev, showFullDetails.id],
                  );
                }
              } catch (e) {
                console.error("Error toggling favorite:", e);
              }
            }}
            onShowGallery={(imgs, idx) => {
              setGalleryImages(imgs);
              setGalleryIdx(idx);
            }}
          />
        )}
      </AnimatePresence>

      {/* Interest Workflow Modal */}
      <AnimatePresence>
        {showInterestWorkflow && (
          <InterestWorkflowModal
            prop={showInterestWorkflow}
            seekerProfile={seekerProfile}
            onClose={() => setShowInterestWorkflow(null)}
            onOpenFullDetails={async () => {
              if (!auth.currentUser) return;

              const isUnlocked = seekerProfile?.unlocked_details?.includes(
                showInterestWorkflow.id,
              );

              if (!isUnlocked) {
                const confirmed = await deductCredits(
                  CREDIT_COSTS.VIEW_DETAILS,
                  `Details bekeken van ${showInterestWorkflow.title}`,
                );
                if (!confirmed) return;

                try {
                  const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
                  await updateDoc(ref, {
                    unlocked_details: arrayUnion(showInterestWorkflow.id),
                    favorites: arrayUnion(showInterestWorkflow.id)
                  });
                  if (!favoriteIds.includes(showInterestWorkflow.id)) {
                    setFavoriteIds(prev => [...prev, showInterestWorkflow.id]);
                  }
                } catch (e) {
                  console.error("Error updating unlocked details:", e);
                }
              }

              setShowFullDetails(showInterestWorkflow);
              setReturnToWorkflowOnClose(true);
              setShowInterestWorkflow(null);
            }}
            onOpenChat={() => {
              setSelectedProperty(showInterestWorkflow);
              setShowDirectChat(true);
              setReturnToWorkflowOnClose(true);
              setShowInterestWorkflow(null);
            }}
            onMatchGenerated={(report) => {
              setMatchReport(report);
              setSelectedProperty(showInterestWorkflow);
              setReturnToWorkflowOnClose(true);
              setShowInterestWorkflow(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Match Report Modal */}
      <AnimatePresence>
        {(matchReport || showDirectChat) &&
          (showFullDetails || selectedProperty) && (
            <MatchReportModal
              report={matchReport || ""}
              property={selectedProperty || showFullDetails}
              onClose={() => {
                const currentProp = selectedProperty || showFullDetails;
                setMatchReport(null);
                setShowDirectChat(false);
                setShowFullDetails(null);
                setSelectedProperty(null);
                if (currentProp && returnToWorkflowOnClose) {
                  setShowInterestWorkflow(currentProp);
                }
                setReturnToWorkflowOnClose(false);
              }}
              initialShowContact={showDirectChat}
            />
          )}
      </AnimatePresence>

      {/* World Globe Picker Modal */}
      {showGlobeModal && (
        <Suspense fallback={null}>
          <WorldGlobeModal
            isOpen={showGlobeModal}
            onClose={() => {
              setShowGlobeModal(false);
              setShowFilters(true);
            }}
            initialLat={tempFilters.lat}
            initialLng={tempFilters.lng}
            onConfirm={(city, lat, lng) => {
              setTempFilters(prev => ({
                ...prev,
                city,
                lat,
                lng
              }));
              setShowGlobeModal(false);
              setShowFilters(true);
            }}
          />
        </Suspense>
      )}

      <TrustPopup
        isOpen={showTrustPopup}
        onClose={() => setShowTrustPopup(false)}
        providerLevel={providerVerificationLevel || 1}
      />

      {/* Paused Property Notice */}
      <AnimatePresence>
        {showPausedNotice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl text-center border border-outline/30"
            >
              <div className="w-20 h-20 bg-amber-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={40} className="text-amber-600" />
              </div>
              <h3 className="text-2xl font-display font-black text-on-surface mb-4 leading-tight">
                {t("property.paused.title")}
              </h3>
              <p className="text-on-surface-variant mb-8 leading-relaxed font-medium">
                {t("property.paused.message")}
              </p>
              <button
                onClick={() => setShowPausedNotice(false)}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
              >
                {t("common.close", "Sluiten")}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Editor */}
      <AnimatePresence>
        {isEditorOpen && (
          <SeekerProfileEditor
            onClose={() => setIsEditorOpen(false)}
            onComplete={() => {
              setIsEditorOpen(false);
              setHasProfile(true);
              checkProfileStatus(true); // Refresh state and properties
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

const PropertyPreviewCard: React.FC<{
  prop: Property;
  onClick: () => void;
  isLocked: boolean;
  isPropertyUnlocked?: boolean;
  isFavorite?: boolean;
  showActions?: boolean;
  hasNewChat?: boolean;
  hasChat?: boolean;
  hasReport?: boolean;
  onOpenReport?: () => void;
  onOpenChat?: () => void;
  onToggleFavorite?: () => void;
  seekerLocation?: { lat: number; lng: number } | null;
  seekerRadius?: number | null;
  calculateDistance?: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => number;
  onSelectForComparison?: () => void;
  isSelectedForComparison?: boolean;
  providerVerificationLevel?: number;
  onOpenTrustPopup?: (level: number) => void;
  matchScore?: number;
}> = ({
  prop,
  onClick,
  isLocked,
  isPropertyUnlocked,
  isFavorite,
  showActions,
  hasNewChat,
  hasChat,
  hasReport,
  onOpenReport,
  onOpenChat,
  onToggleFavorite,
  seekerLocation,
  seekerRadius,
  calculateDistance,
  onSelectForComparison,
  isSelectedForComparison,
  providerVerificationLevel = 1,
  onOpenTrustPopup,
  matchScore,
}) => {
  const { t } = useTranslation();
  const currencyConverter = useCurrencyConverter();
  const teaserImage =
    prop.images?.find((img) => img.id === prop.teaserImageId) ||
    prop.images?.[0];
  const distance =
    seekerLocation && prop.displayLat && prop.displayLng && calculateDistance
      ? calculateDistance(
          seekerLocation.lat,
          seekerLocation.lng,
          prop.displayLat,
          prop.displayLng,
        )
      : null;

  const isWithinRadius =
    distance !== null && seekerRadius !== null && distance <= seekerRadius;

  const showBottomActions = !isLocked;

  return (
    <motion.div
      whileHover={isLocked ? {} : { y: -5 }}
      onClick={(e) => {
        // Only trigger main click if not clicking sub-buttons
        if (!(e.target as HTMLElement).closest("button")) {
          onClick();
        }
      }}
      className={`relative rounded-[3rem] border overflow-hidden group transition-all duration-300 flex flex-col h-full cursor-pointer hover:shadow-xl ${
        isLocked ? "grayscale-[0.5] hover:grayscale-0 shadow-sm" : "shadow-sm"
      } ${
        isSelectedForComparison
          ? "ring-4 ring-primary border-transparent"
          : isWithinRadius
            ? "bg-primary/5 border-primary/40"
            : "bg-white border-outline"
      }`}
    >
      {/* Top Action Overlay (Favorite & Selection) */}
      <div
        className={`absolute top-4 ${prop.status === "paused" ? "right-[5rem] sm:right-[6rem]" : "right-4"} z-40 flex items-center gap-2 transition-all duration-500`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.();
          }}
          className={`p-3 backdrop-blur rounded-full transition-all shadow-md border ${isFavorite ? "bg-error text-on-primary border-error scale-110" : "bg-surface/95 border-outline/40 text-on-surface hover:bg-surface-container hover:scale-110"}`}
        >
          <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
        </button>

        {showActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectForComparison?.();
            }}
          >
            <div
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${isSelectedForComparison ? "bg-primary border-primary text-on-primary scale-110 shadow-lg" : "bg-surface/95 border-outline/40 text-on-surface backdrop-blur-md shadow-sm hover:bg-surface-container hover:scale-105"}`}
            >
              {isSelectedForComparison ? (
                <Check size={24} strokeWidth={4} />
              ) : (
                <div className="w-4 h-4 rounded-full border border-primary/20" />
              )}
            </div>
          </button>
        )}
      </div>

      <div className="relative aspect-video overflow-hidden bg-surface-container-low">
        {teaserImage && teaserImage.url ? (
          <img
            src={teaserImage.url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-outline-variant">
            <Layout size={40} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 z-0" />

        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          {hasNewChat && !showBottomActions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat?.();
              }}
              className="bg-error text-white p-2 rounded-full shadow-lg animate-bounce flex items-center justify-center border-2 border-white hover:scale-110 transition-transform cursor-pointer"
              title={t("nav.chat")}
            >
              <MessageSquare size={16} fill="currentColor" />
            </button>
          )}

          <div className="bg-surface/95 backdrop-blur-md px-4 py-2 rounded-2xl text-[11px] font-black shadow-lg border border-outline/40 text-on-surface">
            {prop.priceType === "tbd"
              ? t("prop.money.tbd", "Nader te bepalen")
              : prop.priceType === "range"
                ? `${currencyConverter.formatEur(prop.minPrice)} - ${currencyConverter.formatEur(prop.maxPrice)}/mnd`
                : `${currencyConverter.formatEur(prop.price)}/mnd`}
          </div>
        </div>

        {matchScore !== undefined && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md px-3 py-2 rounded-2xl flex flex-col items-center justify-center border-2 shadow-xl border-amber-400 text-amber-400">
            <span className="text-sm font-black leading-none">
              {matchScore}%
            </span>
            <span className="text-[7px] font-black uppercase tracking-widest mt-0.5 opacity-80">
              Match
            </span>
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          {distance !== null && (
            <div className="bg-black/70 backdrop-blur-md px-3 py-2 rounded-2xl text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2 border border-white/10 shadow-lg">
              <MapPin size={12} />
              {t("seeker.distance_approx", { dist: distance })}
            </div>
          )}
        </div>

        {isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-on-background/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/90 p-3 rounded-2xl shadow-xl text-primary flex items-center gap-2 font-bold text-xs uppercase tracking-widest">
              <AlertCircle size={16} />
              {t("seeker.profile_required_teaser")}
            </div>
          </div>
        )}

        {prop.status === "paused" && (
          <div className="absolute top-0 right-0 overflow-hidden w-32 h-32 pointer-events-none z-10 opacity-60">
            <div
              className={`absolute top-6 -right-10 ${hasChat ? "bg-slate-400 text-slate-100" : "bg-orange-500 text-white"} py-1.5 w-[160px] text-center transform rotate-45 shadow-lg flex flex-col items-center justify-center`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                {t("property.paused.banner")}
              </span>
              <span className="text-[7px] font-medium leading-none opacity-90 mt-0.5">
                {t("property.paused.banner_sub")}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 space-y-4 flex-grow">
        <div className="flex justify-between items-start">
          <div className="flex-grow">
            <h3 className="text-xl font-display font-bold text-on-background group-hover:text-primary transition-colors">
              {prop.title}
            </h3>
            <p className="text-on-surface-variant text-sm flex items-center flex-wrap gap-1 font-medium mt-1">
              <MapPin size={14} className="text-primary shrink-0" />
              <span>
                {prop.city}
                {prop.neighborhood ? `, ${prop.neighborhood}` : ""}
              </span>
              {prop.features?.goal && (
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-secondary/10 text-secondary rounded-md ml-1">
                  {String(
                    t(`prop.goal.${prop.features.goal}`, prop.features.goal),
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-outline/30">
          <div className="flex flex-col items-center gap-1">
            <User size={14} className="text-primary/50" />
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-tighter">
              {prop.features?.bedrooms || 0}{" "}
              {t("property.details.bedrooms_short")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 px-4 border-l border-outline/30">
            <Layout size={14} className="text-primary/50" />
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-tighter">
              {prop.features?.area_private || 0} m²
            </span>
          </div>
          {prop.features?.goal === "vakantie_onderhuur" &&
            prop.monthlyAvailability && (
              <div className="flex flex-col items-center gap-1 px-4 border-l border-outline/30 flex-grow">
                <Calendar size={14} className="text-primary/50" />
                <div className="flex gap-0.5 mt-0.5 overflow-hidden w-full justify-center">
                  {(() => {
                    const now = new Date();
                    const dots = [];
                    for (let i = 0; i < 12; i++) {
                      const d = new Date(
                        now.getFullYear(),
                        now.getMonth() + i,
                        1,
                      );
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      const status = prop.monthlyAvailability[key];
                      
                      let dotColor = "bg-surface-container-high";
                      let tooltip = t("availability.not_available");
                      if (status === "free" || status === "available") {
                        dotColor = "bg-success shadow-[0_0_4px_rgba(34,197,94,0.4)]";
                        tooltip = t("availability.available");
                      } else if (status === "consultation") {
                        dotColor = "bg-[#cc6600]";
                        tooltip = t("availability.consultation");
                      } else if (status === "occupied") {
                        dotColor = "bg-[#cc0000]";
                        tooltip = t("availability.occupied");
                      } else if (status === "not_for_rent_month") {
                        dotColor = "bg-surface-variant";
                        tooltip = t("availability.not_for_rent_month");
                      }

                      dots.push(
                        <div
                          key={key}
                          className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                          title={tooltip}
                        />,
                      );
                    }
                    return dots;
                  })()}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(() => {
                    const monthKeysShort = [
                      "jan",
                      "feb",
                      "mar",
                      "apr",
                      "may",
                      "jun",
                      "jul",
                      "aug",
                      "sep",
                      "oct",
                      "nov",
                      "dec",
                    ];
                    const now = new Date();
                    const availableMonths = [];
                    for (let i = 0; i < 12; i++) {
                      const d = new Date(
                        now.getFullYear(),
                        now.getMonth() + i,
                        1,
                      );
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      const status = prop.monthlyAvailability?.[key];
                      if ((status === "free" || status === "available")) {
                        availableMonths.push(
                          t(
                            `prop.availability.month_${monthKeysShort[d.getMonth()]}`,
                          ).substring(0, 3),
                        );
                      }
                    }
                    return availableMonths.map((m, i) => (
                      <span
                        key={i}
                        className="text-[8px] font-black text-primary uppercase tracking-tighter bg-primary/10 px-1 rounded-sm"
                      >
                        {m}
                      </span>
                    ));
                  })()}
                </div>
              </div>
            )}
        </div>

        {prop.features?.goal === "vakantie_onderhuur" && (
          <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10 space-y-2 mt-2 animate-in fade-in-50 duration-300">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-bold text-[10px] uppercase tracking-wider">
              <Compass size={12} className="text-amber-500 shrink-0" />
              <span>{t('seeker.card.vacation_summary', 'Vakantiefaciliteiten')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Pool */}
              {prop.features?.vacation_pool && prop.features.vacation_pool !== 'no' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-450 rounded-lg text-[9px] font-black uppercase tracking-tight border border-sky-150 dark:border-sky-500/10">
                  <Waves size={10} className="text-sky-500 shrink-0" />
                  <span>
                    {prop.features.vacation_pool === 'private' 
                      ? t('common.private_dutch', 'Privé Zwembad') 
                      : t('common.shared_dutch', 'Gedeeld Zwembad')}
                  </span>
                </div>
              )}

              {/* Sauna */}
              {prop.features?.vacation_sauna && prop.features.vacation_sauna !== 'no' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-450 rounded-lg text-[9px] font-black uppercase tracking-tight border border-orange-150 dark:border-orange-500/10">
                  <Flame size={10} className="text-orange-500 shrink-0" />
                  <span>
                    {prop.features.vacation_sauna === 'private' 
                      ? t('common.private_sauna', 'Privé Sauna') 
                      : t('common.shared_sauna', 'Gedeelde Sauna')}
                  </span>
                </div>
              )}

              {/* Outdoor kitchen */}
              {prop.features?.vacation_outdoor_kitchen && prop.features.vacation_outdoor_kitchen !== 'no' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-450 rounded-lg text-[9px] font-black uppercase tracking-tight border border-emerald-150 dark:border-emerald-500/10">
                  <ChefHat size={10} className="text-emerald-500 shrink-0" />
                  <span>
                    {prop.features.vacation_outdoor_kitchen === 'private' 
                      ? t('common.private_kitchen', 'Privé Buitenkeuken') 
                      : t('common.shared_kitchen', 'Gedeelde Buitenkeuken')}
                  </span>
                </div>
              )}

              {/* Resort */}
              {prop.features?.vacation_resort && prop.features.vacation_resort !== 'no' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-450 rounded-lg text-[9px] font-black uppercase tracking-tight border border-teal-150 dark:border-teal-500/10">
                  <Palmtree size={10} className="text-teal-500 shrink-0" />
                  <span>
                    {prop.features.vacation_resort === 'yes_fac' 
                      ? t('common.resort_fac', 'Vakantiepark + Fac.') 
                      : t('common.resort_nofac', 'Rustig Vakantiepark')}
                  </span>
                </div>
              )}

              {/* Beach Distance */}
              {prop.features?.vacation_beach_dist !== undefined && prop.features.vacation_beach_dist !== '' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-450 rounded-lg text-[9px] font-black uppercase tracking-tight border border-amber-150 dark:border-amber-500/10">
                  <Sun size={10} className="text-amber-500 shrink-0 animate-pulse" />
                  <span>{prop.features.vacation_beach_dist} km {t('prop.extra.beach_short', 'strand')}</span>
                </div>
              )}

              {/* Airport Distance */}
              {prop.features?.vacation_airport_dist !== undefined && prop.features.vacation_airport_dist !== '' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-450 rounded-lg text-[9px] font-black uppercase tracking-tight border border-purple-150 dark:border-purple-500/10">
                  <Compass size={10} className="text-purple-500 shrink-0" />
                  <span>{prop.features.vacation_airport_dist} km {t('prop.extra.airport_short', 'vliegveld')}</span>
                </div>
              )}

              {/* Meals */}
              {(prop.features?.vacation_breakfast || prop.features?.vacation_lunch || prop.features?.vacation_dinner) && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-450 rounded-lg text-[9px] font-black uppercase tracking-tight border border-pink-150 dark:border-pink-500/10">
                  <Utensils size={10} className="text-pink-500 shrink-0" />
                  <span>
                    {(() => {
                      const meals = [];
                      if (prop.features.vacation_breakfast) meals.push(t('prop.extra.breakfast_short', 'Ontbijt'));
                      if (prop.features.vacation_lunch) meals.push(t('prop.extra.lunch_short', 'Lunch'));
                      if (prop.features.vacation_dinner) meals.push(t('prop.extra.dinner_short', 'Diner'));
                      return meals.join('/') || t('prop.extra.meals_short', 'Maaltijden');
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {showBottomActions && (
          <div className="flex flex-wrap gap-2 pt-4">
            {!hasChat && (
              <button
                onClick={onOpenReport}
                className="flex-grow flex items-center justify-center gap-2 bg-primary/10 text-primary py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
              >
                <Sparkles size={14} />
                {t("property.match_report", "Rapport")}
              </button>
            )}
            {hasChat && (
              <button
                onClick={onOpenChat}
                className="flex-grow flex items-center justify-center gap-2 bg-secondary text-on-secondary py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
              >
                <MessageSquare size={14} />
                {t("nav.chat", "Chat")}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-6 md:px-8 py-4 bg-surface-container-low/50 flex items-center justify-between">
        <TrustBadge
          level={providerVerificationLevel}
          onClick={(e) => {
            e.stopPropagation();
            onOpenTrustPopup?.(providerVerificationLevel);
          }}
        />
        <div className="text-primary font-bold text-sm flex items-center gap-1">
          {isPropertyUnlocked ? t("seeker.view_details") : t("seeker.view")}
          <ChevronRight size={16} />
        </div>
      </div>
    </motion.div>
  );
};

function ComparisonModal({
  properties,
  onClose,
  chatsStatus,
  seekerProfile,
  providersMap,
  calculateMatchScore,
}: {
  properties: Property[];
  onClose: () => void;
  chatsStatus: Record<string, any>;
  seekerProfile: any;
  providersMap?: Record<string, any>;
  calculateMatchScore: (p: Property) => number;
}) {
  const { t } = useTranslation();
  const { dateFormat } = useSettings();
  const currencyConverter = useCurrencyConverter();

  // Helper to check if user has "Full Access" to a property
  const hasFullAccess = (propId: string) => {
    // Has access if:
    // 1. Started a chat
    if (chatsStatus[propId] || seekerProfile?.unlocked_chats?.includes(propId))
      return true;

    // 2. Is a premium user
    if (
      seekerProfile?.subscription_status === "active" ||
      seekerProfile?.is_premium
    )
      return true;

    // 3. Unlocked specific details or match report
    if (
      seekerProfile?.unlocked_details?.includes(propId) ||
      seekerProfile?.unlocked_matches?.includes(propId)
    )
      return true;

    return false;
  };

  const isHidden = (p: Property, category: string) => {
    if (p.features?.visibility && p.features.visibility[category] === false)
      return true;
    if (
      category === "tenant_prefs" &&
      p.features?.visibility?.preferences === false
    )
      return true;
    return false;
  };

  const rows = [
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("prop.basis.price", "Huurprijs"),
      isSensitive: false,
      getValue: (p: Property) =>
        p.priceType === "tbd"
          ? t("prop.price_tbd")
          : `${currencyConverter.formatEur(p.price || p.minPrice)}/mnd`,
    },
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("property.details.area", "Oppervlakte"),
      isSensitive: false,
      getValue: (p: Property) =>
        p.features?.area_private ? `${p.features.area_private} m²` : "",
    },
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("property.details.bedrooms", "Slaapkamers"),
      isSensitive: false,
      getValue: (p: Property) => p.features?.bedrooms || "",
    },
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("prop.basis.type", "Type"),
      isSensitive: false,
      getValue: (p: Property) =>
        p.features?.type
          ? t(`prop.type.${p.features.type}`, p.features.type)
          : "",
    },
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("prop.basis.furnished", "Gemeubileerd"),
      isSensitive: false,
      getValue: (p: Property) =>
        p.features?.furnished
          ? t(`prop.furnished.${p.features.furnished}`, p.features.furnished)
          : "",
    },
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("property.details.available_from", "Beschikbaar vanaf"),
      isSensitive: false,
      getValue: (p: Property) =>
        p.features?.available_from
          ? formatDate(new Date(p.features.available_from), dateFormat)
          : t("common.unknown", "Onbekend"),
    },
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("property.details.domicile", "Inschrijving (Domicilie)"),
      isSensitive: false,
      getValue: (p: Property) =>
        p.features?.domicile
          ? t(`common.${p.features.domicile}`, p.features.domicile)
          : "",
    },
    {
      group: t("prop.category.basis", "Basisinformatie"),
      label: t("property.details.goal", "Doel"),
      isSensitive: false,
      getValue: (p: Property) =>
        p.features?.goal
          ? t(`prop.goal.${p.features.goal}`, p.features.goal)
          : "",
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("seeker.comparison.language", "Taal Match"),
      isSensitive: false,
      getValue: (p: Property) => {
        const provLang = p.ownerId
          ? providersMap?.[p.ownerId]?.preferredLanguage
          : undefined;
        const seekLang = seekerProfile?.preferredLanguage;
        if (!provLang || !seekLang) return t("common.unknown", "Onbekend");
        if (provLang === seekLang)
          return (
            <span className="text-primary font-bold">
              {provLang} ({t("seeker.comparison.match", "Match!")})
            </span>
          );
        return (
          <span className="text-error font-medium">
            {provLang} ({t("seeker.comparison.differs", "Wijkt af")})
          </span>
        );
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("seeker.comparison.dna_match", "Match DNA"),
      isSensitive: false,
      getValue: (p: Property) => {
        const score = calculateMatchScore(p);
        return (
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-xl text-white font-black text-xs ${score >= 80 ? "bg-success" : score >= 60 ? "bg-amber-500" : "bg-orange-500"}`}
            >
              {score}%
            </div>
          </div>
        );
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("property.details.outdoor_space", "Buitenruimte"),
      isSensitive: true,
      categoryId: "outside",
      getValue: (p: Property) => {
        const out = [];
        if (p.features?.has_garden) out.push(t("prop.outdoor.garden", "Tuin"));
        if (p.features?.has_balcony)
          out.push(t("prop.outdoor.balcony", "Balkon"));
        if (p.features?.has_terrace)
          out.push(t("prop.outdoor.terrace", "Terras"));
        if (p.features?.has_roof_terrace)
          out.push(t("prop.outdoor.roof_terrace", "Dakterras"));
        return out.length > 0 ? out.join(", ") : "-";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("prop.extra.smoking", "Roken in huis"),
      isSensitive: true,
      categoryId: "extra",
      getValue: (p: Property) => {
        if (p.features?.smoking_allowed === true) return t('common.yes', 'Ja');
        if (p.features?.smoking_allowed === false) return t('common.no', 'Nee');
        return "-";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("prop.layout.sanitary", "Sanitair"),
      isSensitive: true,
      categoryId: "sanitary",
      getValue: (p: Property) => {
        if (!p.features?.sanitary_details) return "-";
        return Object.entries(p.features.sanitary_details)
          .map(
            ([k, v]) =>
              `${t(`prop.layout.${k}`, k)} (${t(`common.${v as string}`, v as string)})`,
          )
          .join(", ");
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("feature.kitchen_type", "Keuken type"),
      isSensitive: true,
      categoryId: "kitchen",
      getValue: (p: Property) =>
        p.features?.kitchen_type
          ? t(
              `prop.kitchen.${p.features.kitchen_type}`,
              p.features.kitchen_type,
            )
          : "",
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("prop.kitchen.appliances", "Keukenapparatuur"),
      isSensitive: true,
      categoryId: "kitchen",
      getValue: (p: Property) => {
        if (!p.features?.kitchen_gear) return "-";
        return Object.entries(p.features.kitchen_gear)
          .map(
            ([k, v]) =>
              `${t(`prop.kitchen_gear.${k}`, k)} (${t(`common.${v as string}`, v as string)})`,
          )
          .join(", ");
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("feature.condition_state", "Staat van woning"),
      isSensitive: true,
      categoryId: "condition",
      getValue: (p: Property) =>
        p.features?.condition_state
          ? t(
              `prop.condition.${p.features.condition_state}`,
              p.features.condition_state,
            )
          : "",
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: "Zwembad",
      isSensitive: true,
      categoryId: "vacation_specs",
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur") return "-";
        const val = p.features?.vacation_pool;
        if (val === 'private') return "Privé";
        if (val === 'shared') return "Gedeeld";
        return "Nee";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: "Buitenkeuken",
      isSensitive: true,
      categoryId: "vacation_specs",
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur") return "-";
        const val = p.features?.vacation_outdoor_kitchen;
        if (val === 'private') return "Privé";
        if (val === 'shared') return "Gedeeld";
        return "Nee";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: "Vakantiepark",
      isSensitive: true,
      categoryId: "vacation_specs",
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur") return "-";
        const val = p.features?.vacation_resort;
        if (val === 'yes_no_fac') return "Ja, zonder faciliteiten";
        if (val === 'yes_fac') return "Ja, met faciliteiten";
        return "Nee";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: "Sauna",
      isSensitive: true,
      categoryId: "vacation_specs",
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur") return "-";
        const val = p.features?.vacation_sauna;
        if (val === 'private') return "Privé";
        if (val === 'shared') return "Gedeeld";
        return "Nee";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: "Afstand tot strand",
      isSensitive: true,
      categoryId: "vacation_specs",
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur" || p.features?.vacation_beach_dist === undefined || p.features?.vacation_beach_dist === '') return "-";
        return `${p.features.vacation_beach_dist} km`;
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: "Afstand tot luchthaven",
      isSensitive: true,
      categoryId: "vacation_specs",
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur" || p.features?.vacation_airport_dist === undefined || p.features?.vacation_airport_dist === '') return "-";
        return `${p.features.vacation_airport_dist} km`;
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: "Maaltijdmogelijkheden",
      isSensitive: true,
      categoryId: "vacation_specs",
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur") return "-";
        const meals = [];
        if (p.features?.vacation_breakfast) meals.push("Ontbijt");
        if (p.features?.vacation_lunch) meals.push("Lunch");
        if (p.features?.vacation_dinner) meals.push("Diner");
        return meals.length > 0 ? meals.join(", ") : "Geen";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("prop.availability.title", "Beschikbaarheid"),
      isSensitive: false,
      getValue: (p: Property) => {
        if (p.features?.goal !== "vakantie_onderhuur" || !p.monthlyAvailability)
          return "-";
        const freeMonths = Object.entries(p.monthlyAvailability).filter(
          ([_, status]) => (status === "free" || status === "available" || status === "consultation"),
        ).length;
        return `${freeMonths} ${t("prop.availability.months_available", "maanden vrij")}`;
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("prop.parking.label", "Auto Parkeren"),
      isSensitive: true,
      categoryId: "parking",
      getValue: (p: Property) =>
        p.features?.parking
          ? t(`prop.park.${p.features.parking}`, p.features.parking)
          : "",
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("feature.parking_types", "Type Parkeerplaats"),
      isSensitive: true,
      categoryId: "parking",
      getValue: (p: Property) => {
        if (!p.features?.parking_types?.length) return "-";
        return p.features.parking_types
          .map((v: string) => {
            if (v === "bike_storage")
              return t("prop.storage.bicycle", "Fietsenstalling");
            if (v === "scooter_storage")
              return t("prop.storage.scooter", "Scooterstalling");
            if (v === "motorcycle_storage")
              return t("prop.storage.motorcycle", "Motorstalling");
            if (v === "covered_storage")
              return t("prop.parking.covered_desc", "Overdekt");
            if (v === "ev_charger")
              return t("prop.storage.ev_charger", "Laadpaal");
            return v;
          })
          .join(", ");
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("prop.safety.title", "Veiligheid"),
      isSensitive: true,
      categoryId: "safety",
      getValue: (p: Property) => {
        const out = [];
        if (p.features?.smoke_detector)
          out.push(t("prop.safety.smoke_detector", "Rookmelder"));
        if (p.features?.carbon_monoxide_detector)
          out.push(t("prop.safety.carbon_monoxide", "Koolmonoxidemelder"));
        if (p.features?.fire_extinguisher)
          out.push(t("prop.safety.fire_extinguisher", "Brandblusser"));
        if (p.features?.first_aid_kit)
          out.push(t("prop.safety.first_aid", "EHBO Kit"));
        if (p.features?.alarm_system)
          out.push(t("prop.safety.alarm", "Alarmsysteem"));
        return out.length > 0 ? out.join(", ") : "-";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("feature.pets", "Huisdieren"),
      isSensitive: true,
      categoryId: "pets",
      getValue: (p: Property) => {
        const petsVal = p.features?.pets;
        let baseLabel = "-";
        if (petsVal === "yes") baseLabel = t("common.yes", "Ja");
        else if (petsVal === "no") baseLabel = t("common.no", "Nee");
        else if (petsVal === "consult")
          baseLabel = t("common.in_consultation", "In overleg");

        let base = baseLabel;
        if (p.features?.tenant_pets_allowed?.length) {
          const allowed = p.features.tenant_pets_allowed
            .map((pet: string) => t(`prop.pets.${pet.toLowerCase()}`, pet))
            .join(", ");
          base += ` (${t("prop.pets.allowed", "Toegestaan")}: ${allowed})`;
        }
        return base;
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("feature.laundry", "Wassen & Droger"),
      isSensitive: true,
      categoryId: "laundry",
      getValue: (p: Property) => {
        if (!p.features?.laundry) return "-";
        const res = [];
        if (
          p.features.laundry.washing_machine &&
          p.features.laundry.washing_machine !== "none"
        )
          res.push(
            `${t("prop.laundry.washing_machine", "Wasmachine")} (${t(`common.${p.features.laundry.washing_machine}`, p.features.laundry.washing_machine)})`,
          );
        if (p.features.laundry.dryer && p.features.laundry.dryer !== "none")
          res.push(
            `${t("prop.laundry.dryer", "Droger")} (${t(`common.${p.features.laundry.dryer}`, p.features.laundry.dryer)})`,
          );
        return res.length > 0 ? res.join(", ") : "-";
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("prop.category.surroundings", "Omgeving"),
      isSensitive: true,
      categoryId: "surroundings",
      getValue: (p: Property) => {
        if (!p.features?.surroundings) return "-";
        const active = Object.entries(p.features.surroundings).filter(
          ([_k, v]: [string, any]) => v.present,
        );
        if (active.length === 0) return "-";
        return active
          .map(([k, v]: [string, any]) => {
            let distStr = v.distance || "?";
            if (distStr === "< 5 min") distStr = t("prop.dist.walk", "< 5 min");
            else if (distStr === "5-10 min")
              distStr = t("prop.dist.close", "5-10 min");
            else if (distStr === "10-20 min")
              distStr = t("prop.dist.reachable", "10-20 min");
            else if (distStr === "> 20 min")
              distStr = t("prop.dist.far", "> 20 min");

            const surroundingsMap: Record<string, string> = {
              nature: t("prop.surroundings.nature", "Natuur"),
              train: t("prop.surroundings.train", "Treinstation"),
              bus: t("prop.surroundings.bus", "Bushalte"),
              shops: t("prop.surroundings.shops", "Winkels"),
              supermarket: t("prop.surroundings.supermarket", "Supermarkt"),
              park: t("prop.surroundings.park", "Park"),
              city_center: t("prop.surroundings.city_center", "Stadscentrum"),
              highway: t("prop.surroundings.highway", "Snelweg")
            };
            const localizedKey = surroundingsMap[k] || t(`prop.surroundings.${k}`, k);

            return `${localizedKey} (${distStr}${v.name ? ` - ${v.name}` : ""})`;
          })
          .join(", ");
      },
    },
    {
      group: t("prop.category.details", "Gedetailleerde Informatie"),
      label: t("seeker.comparison.description", "Omschrijving"),
      isSensitive: true,
      getValue: (p: Property) =>
        p.features?.free_text_description ? (
          <details className="mt-1 group">
            <summary className="text-xs font-bold text-primary cursor-pointer hover:underline list-none flex items-center justify-between outline-none">
              {t("common.read_more", "Lees meer")}
              <ChevronRight
                size={14}
                className="group-open:rotate-90 transition-transform"
              />
            </summary>
            <div className="pt-2 text-sm whitespace-pre-line text-on-surface">
              {p.features.free_text_description}
            </div>
          </details>
        ) : (
          "-"
        ),
    },
  ];

  let currentGroup = "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-on-background/80 backdrop-blur-xl flex flex-col p-4 md:p-10"
    >
      <div className="max-w-7xl mx-auto w-full flex-grow flex flex-col bg-white rounded-[3rem] shadow-2xl overflow-hidden relative border border-white/20">
        {/* Header */}
        <div className="p-8 border-b border-outline/30 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-display font-black text-on-background">
              {t("seeker.comparison.title", "Woningen Vergelijken")}
            </h2>
            <p className="text-on-surface-variant font-medium">
              {t(
                "seeker.comparison.desc",
                "Bekijk je favorieten naast elkaar om de beste keuze te maken.",
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-4 bg-surface-container rounded-full hover:scale-105 transition-all text-on-surface"
          >
            <X size={24} />
          </button>
        </div>

        {/* Comparison Table */}
        <div className="flex-grow overflow-x-auto overflow-y-auto">
          <div className="min-w-[800px] p-8 pb-32">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-4 w-1/4 bg-surface-container-lowest sticky left-0 z-20 border-b-2 border-outline/30" />
                  {properties.map((p) => (
                    <th
                      key={p.id}
                      className="p-4 border-b-2 border-outline/30 align-top z-10 w-[200px]"
                    >
                      <div className="space-y-4">
                        <div className="aspect-video rounded-2xl overflow-hidden bg-surface-container-low">
                          {p.images?.[0]?.url && (
                            <img
                              src={p.images[0].url}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-lg line-clamp-2 h-14">
                            {p.title}
                          </h4>
                          <p className="text-xs text-on-surface-variant flex items-center gap-1">
                            <MapPin size={12} className="text-primary" />
                            {p.city}
                          </p>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const showGroupHeader = row.group !== currentGroup;
                  if (showGroupHeader) {
                    currentGroup = row.group;
                  }

                  return (
                    <React.Fragment key={idx}>
                      {showGroupHeader && (
                        <tr>
                          <td
                            colSpan={properties.length + 1}
                            className="p-4 bg-surface-container/50 border-y border-outline/30 text-primary font-black uppercase tracking-widest text-sm pt-8 sticky left-0 z-10"
                          >
                            {row.group}
                          </td>
                        </tr>
                      )}
                      <tr className="group border-b border-outline/10 hover:bg-surface-container/30 transition-colors">
                        <td className="p-6 font-black text-[11px] uppercase tracking-widest text-on-surface-variant bg-surface-container-lowest sticky left-0 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.03)]">
                          {row.label}
                        </td>
                        {properties.map((p) => {
                          const isHiddenByProvider = row.categoryId
                            ? isHidden(p, row.categoryId)
                            : false;
                          const isLocked =
                            row.isSensitive && !hasFullAccess(p.id);

                          let content;
                          if (isHiddenByProvider) {
                            content = (
                              <span className="opacity-50 flex items-center gap-1">
                                <X size={14} />{" "}
                                {t(
                                  "seeker.comparison.hidden",
                                  "Verborgen door aanbieder",
                                )}
                              </span>
                            );
                          } else if (isLocked) {
                            content = "🔒";
                          } else {
                            content = row.getValue(p) || "-";
                          }

                          return (
                            <td
                              key={p.id}
                              className="p-6 text-center md:text-left align-top"
                            >
                              <div
                                className={`text-sm font-bold flex flex-col ${isLocked || isHiddenByProvider ? "text-primary" : "text-on-surface"}`}
                              >
                                {content}
                                {isLocked && !isHiddenByProvider && (
                                  <div className="mt-2 flex items-center md:justify-start justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary/60">
                                    <Sparkles size={10} />
                                    {t(
                                      "seeker.comparison.unlock_required",
                                      "Match vereist",
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-surface-container-low/30 border-t border-outline/30 flex justify-center">
          <button
            onClick={onClose}
            className="px-12 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            {t("common.close", "Sluiten")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PropertyTeaserModal({
  prop,
  onClose,
  seekerLocation,
  calculateDistance,
  onShowInterestWorkflow,
  isFavorite,
  onToggleFavorite,
  onShowGallery,
  hasChat,
}: {
  prop: Property;
  onClose: () => void;
  seekerLocation?: { lat: number; lng: number } | null;
  calculateDistance?: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => number;
  onShowInterestWorkflow: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onShowGallery?: (images: PropertyImage[], startIdx: number) => void;
  hasChat?: boolean;
}) {
  const { t } = useTranslation();
  const { dateFormat } = useSettings();
  const currencyConverter = useCurrencyConverter();
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.dispatchEvent(new CustomEvent("shift-credits", { detail: true }));
    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
      window.dispatchEvent(new CustomEvent("shift-credits", { detail: false }));
    };
  }, []);

  const teaserImage =
    prop.images?.find((img) => img.id === prop.teaserImageId) ||
    prop.images?.[0];
  const allImages = prop.images || [];

  const distance =
    seekerLocation && prop.displayLat && prop.displayLng && calculateDistance
      ? calculateDistance(
          seekerLocation.lat,
          seekerLocation.lng,
          prop.displayLat,
          prop.displayLng,
        )
      : null;

  const freeText = prop.features?.free_text_description || "";
  const teaserText =
    freeText.length > 400 ? freeText.substring(0, 400) + "...(meer)" : freeText;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background md:rounded-[3rem] w-full max-w-[1920px] h-full md:h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-outline relative"
      >
        <div className="flex-grow overflow-y-auto">
          {/* Header */}
          <div className="relative h-64 md:h-80 w-full bg-surface-container-low">
            {teaserImage && teaserImage.url ? (
              <img
                src={teaserImage.url}
                alt="Teaser"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-outline-variant">
                <Layout size={48} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite?.();
                }}
                className={`p-3 backdrop-blur rounded-full transition-all shadow-md bg-white/90 ${isFavorite ? "scale-110" : "hover:scale-105"}`}
              >
                <Heart
                  size={20}
                  fill={isFavorite ? "#ef4444" : "none"}
                  stroke={isFavorite ? "#ef4444" : "currentColor"}
                  className={isFavorite ? "text-[#ef4444]" : "text-on-surface"}
                />
              </button>
              <button
                onClick={onClose}
                className="cm-modal-close-button p-3 bg-surface/95 text-on-surface hover:scale-105 backdrop-blur"
              >
                <X size={20} />
              </button>
            </div>

            {prop.status === "paused" && (
              <div className="absolute top-0 left-0 overflow-hidden w-40 h-40 pointer-events-none z-10">
                <div
                  className={`absolute top-8 -left-12 ${hasChat ? "bg-slate-400 text-slate-100" : "bg-orange-500 text-white"} py-2 w-[200px] text-center transform -rotate-45 shadow-xl flex flex-col items-center justify-center scale-110`}
                >
                  <span className="text-xs font-black uppercase tracking-widest leading-none">
                    {t("property.paused.banner")}
                  </span>
                  <span className="text-[8px] font-medium leading-none opacity-90 mt-0.5 uppercase tracking-tighter">
                    {t("property.paused.banner_sub")}
                  </span>
                </div>
              </div>
            )}
            {/* Title Overlay */}
            <div className="absolute bottom-4 left-6 right-6 flex flex-col gap-1">
              {(teaserImage?.description || teaserImage?.category) && (
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl w-fit max-w-[80%] border border-white/10 mb-2">
                  <p className="text-white font-bold text-sm leading-tight">
                    {teaserImage?.description || ""}{" "}
                    {teaserImage?.category
                      ? `(${t(`prop.media.cat.${teaserImage.category.toLowerCase()}`, teaserImage.category)})`
                      : ""}
                  </p>
                </div>
              )}
              <h2 className="text-3xl font-display font-black text-white drop-shadow-lg">
                {prop.title || t("property.details.title")}
              </h2>
              <div className="flex items-center gap-2 text-white/90 font-medium">
                <MapPin size={16} />
                {prop.city} {prop.neighborhood ? `- ${prop.neighborhood}` : ""}
              </div>
            </div>
          </div>

          {/* Photo collage simplified to trigger gallery */}
          {allImages.length > 0 && (
            <div className="px-6 md:px-10 pt-6">
              <div
                className="relative h-20 md:h-24 w-full flex gap-2 overflow-x-auto hide-scrollbar cursor-pointer"
                onClick={() => onShowGallery?.(allImages, 0)}
              >
                {allImages.map((img, i) => (
                  <div
                    key={i}
                    className="h-full aspect-video shrink-0 rounded-xl overflow-hidden bg-surface-container border border-outline/20 group/teaser-img relative shadow-sm"
                  >
                    <img
                      src={img.url}
                      className="w-full h-full object-cover group-hover/teaser-img:scale-105 transition-transform duration-500"
                    />
                    {(img.category || img.description) && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-sm p-1.5 translate-y-full group-hover/teaser-img:translate-y-0 transition-transform duration-300 z-10">
                        <p className="text-[7px] font-black text-primary uppercase tracking-widest truncate">
                          {img.category
                            ? (t(
                                `prop.media.cat.${img.category.toLowerCase()}`,
                                img.category as any,
                              ) as string)
                            : ""}
                        </p>
                        {img.description && (
                          <p className="text-[9px] text-white font-medium truncate italic leading-tight">
                            {img.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-r from-transparent via-transparent to-background/80 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 flex items-center px-4 bg-white/20 backdrop-blur-sm rounded-l-2xl border-l border-white/30 text-xs font-black uppercase tracking-widest text-primary">
                  +{allImages.length} {t("property.teaser.photos")}
                </div>
              </div>
            </div>
          )}

          <div className="p-6 md:p-10 space-y-10">
            {/* Top Info Bar */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="text-3xl font-black text-primary">
                {prop.priceType === "tbd"
                  ? t("prop.price_tbd", "Prijs n.t.b.")
                  : prop.priceType === "range"
                    ? `${currencyConverter.formatEur(prop.minPrice)} - ${currencyConverter.formatEur(prop.maxPrice)}/mnd`
                    : `${currencyConverter.formatEur(prop.price)}/mnd`}
              </div>
              {/* Distance */}
              {distance !== null && (
                <div className="flex items-center gap-3 p-4 bg-primary/5 text-primary rounded-2xl font-bold w-fit">
                  <MapPin size={20} />
                  {t("property.teaser.dist_approx", { dist: distance })}
                </div>
              )}
            </div>

            {/* Basis Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {prop.features?.type && (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <Home size={20} className="text-primary" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("prop.basis.type")}
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      {String(
                        t(
                          `prop.type.${prop.features.type}`,
                          prop.features.type,
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
              {prop.features?.goal === "vakantie_onderhuur" &&
              prop.monthlyAvailability ? (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <Calendar size={20} className="text-primary" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("prop.category.availability", "Beschikbaarheid")}
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      {
                        Object.values(prop.monthlyAvailability).filter(
                          (v) => (v === "free" || v === "available" || v === "consultation"),
                        ).length
                      }{" "}
                      maanden
                    </div>
                  </div>
                </div>
              ) : prop.features?.available_from ? (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <Calendar size={20} className="text-primary" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("property.details.available_from")}
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      {prop.features.available_from
                        ? formatDate(
                            new Date(prop.features.available_from),
                            dateFormat,
                          )
                        : "-"}
                    </div>
                  </div>
                </div>
              ) : null}
              {prop.features?.bedrooms !== undefined && (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <BedDouble size={20} className="text-primary" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("property.details.bedrooms")}
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      {prop.features.bedrooms}
                    </div>
                  </div>
                </div>
              )}
              {prop.features?.area_private !== undefined && (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <Maximize2 size={20} className="text-primary" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("property.details.area")}
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      {prop.features.area_private} m²{" "}
                      {prop.features.area_shared
                        ? `(+${prop.features.area_shared}m² gedeeld)`
                        : ""}
                    </div>
                  </div>
                </div>
              )}
              {prop.features?.furnished && (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <Sofa size={20} className="text-primary" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("prop.basis.furnished")}
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      {String(
                        t(
                          `prop.furnished.${prop.features.furnished}`,
                          prop.features.furnished,
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
              {prop.features?.domicile && (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <span className="text-primary font-bold">Dom</span>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("property.details.domicile")}
                    </div>
                    <div className="text-sm font-bold text-on-surface capitalize">
                      {String(
                        t(
                          `common.${prop.features.domicile}`,
                          prop.features.domicile,
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
              {prop.features?.goal && (
                <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <span className="text-primary font-bold">Doel</span>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {t("property.details.goal")}
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      {String(
                        t(
                          `prop.goal.${prop.features.goal}`,
                          prop.features.goal,
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Monthly Availability Section */}
            {prop.features?.goal === "vakantie_onderhuur" &&
              prop.monthlyAvailability && (
                <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-primary/20">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-on-background">
                        {t("prop.availability.title")}
                      </h3>
                      <p className="text-sm text-on-surface-variant font-medium">
                        {t(
                          "prop.availability.seeker_desc",
                          "Beschikbare maanden voor deze woning",
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {(() => {
                      const monthKeysShort = [
                        "jan",
                        "feb",
                        "mar",
                        "apr",
                        "may",
                        "jun",
                        "jul",
                        "aug",
                        "sep",
                        "oct",
                        "nov",
                        "dec",
                      ];
                      const now = new Date();
                      const months = [];
                      for (let i = 0; i < 12; i++) {
                        const d = new Date(
                          now.getFullYear(),
                          now.getMonth() + i,
                          1,
                        );
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        const monthName = t(
                          `prop.availability.month_${monthKeysShort[d.getMonth()]}`,
                        );
                        const year = d.getFullYear();
                        months.push({ key, name: monthName, year });
                      }

                      return months.map((m) => {
                        let statusId = prop.monthlyAvailability?.[m.key] || 'not_available';
                        if (statusId === 'free') statusId = 'available';
                        
                        let bgClass = "bg-surface-container-high text-on-surface-variant border-outline-variant opacity-80";
                        let dotClass = "bg-on-surface-variant";
                        let labelKey = "availability.not_available";

                        if (statusId === 'available') {
                          bgClass = "bg-white border-outline text-on-surface shadow-sm";
                          dotClass = "bg-success";
                          labelKey = "availability.available";
                        } else if (statusId === 'consultation') {
                          bgClass = "bg-[#ffeedd] text-[#cc6600] border-[#ffcc99] shadow-sm";
                          dotClass = "bg-[#cc6600]";
                          labelKey = "availability.consultation";
                        } else if (statusId === 'occupied') {
                          bgClass = "bg-[#ffdddd] text-[#cc0000] border-[#ff9999] opacity-80";
                          dotClass = "bg-[#cc0000]";
                          labelKey = "availability.occupied";
                        } else if (statusId === 'not_for_rent_month') {
                          bgClass = "bg-surface-variant text-on-surface-variant border-outline-variant";
                          dotClass = "bg-on-surface-variant";
                          labelKey = "availability.not_for_rent_month";
                        }

                        return (
                          <div
                            key={m.key}
                            className={`flex flex-col p-4 rounded-2xl border transition-all ${bgClass}`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                              {m.year}
                            </span>
                            <span className="text-sm font-black uppercase tracking-tight">
                              {m.name}
                            </span>
                            <div className="mt-2 flex items-center gap-1.5">
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${dotClass} ${statusId === 'available' ? 'animate-pulse' : ''}`}
                              />
                              <span className="text-[9px] font-black uppercase tracking-widest">
                                {t(labelKey)}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

            {/* Photo collage moved into pictures column in teased version, here we show title/description for all photos */}
            {allImages.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-on-background px-4">
                  {t("property.teaser.photos")}
                </h3>
                <div
                  className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 pt-0 cursor-pointer"
                  onClick={() => onShowGallery?.(allImages, 0)}
                >
                  {allImages.slice(0, 6).map((img, idx) => (
                    <div
                      key={img.id ? `modal-img-${img.id}` : `teaser-img-${idx}`}
                      className="aspect-square bg-surface-container-low relative group/img rounded-xl overflow-hidden"
                    >
                      <img
                        src={img.url}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />

                      {(img.category || img.description) && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-2 transform translate-y-full group-hover/img:translate-y-0 transition-transform">
                          {img.category && (
                            <p className="text-[8px] font-black uppercase text-primary tracking-widest line-clamp-1">
                              {
                                t(
                                  `prop.media.cat.${img.category.toLowerCase()}`,
                                  img.category as any,
                                ) as string
                              }
                            </p>
                          )}
                          {img.description && (
                            <p className="text-[10px] text-white font-medium line-clamp-1 italic">
                              {img.description}
                            </p>
                          )}
                        </div>
                      )}

                      {idx === 5 && allImages.length > 6 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-black text-xl">
                            +{allImages.length - 6}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text Teaser */}
            {freeText && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <MessageSquare size={20} className="text-primary" />
                  {t("property.teaser.welcome_msg")}
                </h3>
                <div className="bg-surface-container-low p-6 rounded-3xl relative">
                  <TranslateText text={freeText} />
                </div>
              </div>
            )}

            {/* Map display */}
            {prop.displayLat && prop.displayLng && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <MapPin size={20} className="text-primary" />
                  {t("property.details.location")}{" "}
                  {prop.displayRadius ? `(binnen ${prop.displayRadius}m)` : ""}
                </h3>
                <div className="h-64 bg-surface-container-low rounded-3xl overflow-hidden relative z-0 border border-outline/30 shadow-inner">
                  <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMapType(prev => prev === 'streets' ? 'satellite' : 'streets')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur border border-outline/50 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider hover:bg-surface-container-low transition-all shadow-md text-on-surface hover:scale-105"
                    >
                      {mapType === 'streets' ? <ImageIcon size={12} /> : <MapIcon size={12} />}
                      {mapType === 'streets' ? t('map.satellite', 'Satelliet') : t('map.streets', 'Kaart')}
                    </button>
                  </div>
                  <MapContainer
                    key={mapType}
                    center={[prop.displayLat, prop.displayLng]}
                    zoom={prop.displayRadius ? 12 : 13}
                    scrollWheelZoom={false}
                    zoomControl={true}
                    style={{ width: "100%", height: "100%", zIndex: 0 }}
                  >
                    {mapType === 'streets' ? (
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    ) : (
                      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    )}
                    {prop.displayRadius ? (
                      <Circle
                        center={[prop.displayLat, prop.displayLng]}
                        radius={prop.displayRadius}
                        pathOptions={{
                          color: "#2563eb",
                          fillColor: "#3b82f6",
                          fillOpacity: 0.2,
                        }}
                      />
                    ) : (
                      <Circle
                        center={[prop.displayLat, prop.displayLng]}
                        radius={100}
                        pathOptions={{
                          color: "#2563eb",
                          fillColor: "#3b82f6",
                          fillOpacity: 0.2,
                        }}
                      />
                    )}
                  </MapContainer>
                </div>
              </div>
            )}

            {/* End of content */}

            <div className="h-4"></div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-outline flex flex-col md:flex-row justify-end items-center bg-surface-container-lowest sticky bottom-0 shrink-0 w-full z-10 gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-4 hover:bg-surface-container-low rounded-xl font-bold transition-all text-on-surface-variant text-center"
            >
              {t("common.close")}
            </button>
            <button
              onClick={onShowInterestWorkflow}
              className="flex-[2] md:flex-none px-8 py-4 bg-primary text-white rounded-xl font-black text-sm whitespace-nowrap shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-center"
            >
              {t("property.teaser.have_interest", "Heb je interesse?")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PropertyFullDetailsModal({
  prop,
  isFavorite,
  onClose,
  seekerLocation,
  calculateDistance,
  onMatchGenerated,
  onToggleFavorite,
  onShowGallery,
  seekerProfile,
}: {
  prop: Property;
  isFavorite?: boolean;
  onClose: () => void;
  seekerLocation?: { lat: number; lng: number } | null;
  calculateDistance?: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => number;
  onMatchGenerated: (report: string) => void;
  onToggleFavorite?: () => void;
  onShowGallery?: (images: PropertyImage[], startIdx: number) => void;
  seekerProfile?: any;
}) {
  const { t, i18n } = useTranslation();
  const currencyConverter = useCurrencyConverter();
  const [isMatching, setIsMatching] = useState(false);
  const [existingMatch, setExistingMatch] = useState<any>(null);
  const [showMatchWarning, setShowMatchWarning] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.dispatchEvent(new CustomEvent("shift-credits", { detail: true }));
    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
      window.dispatchEvent(new CustomEvent("shift-credits", { detail: false }));
    };
  }, []);

  useEffect(() => {
    const fetchMatch = async () => {
      if (auth.currentUser) {
        const match = await getExistingMatch(auth.currentUser.uid, prop.id);
        if (match) {
          setExistingMatch(match);
        }
      }
    };
    fetchMatch();
  }, [prop.id]);

  const allImages =
    prop.images && prop.images.length > 0
      ? prop.images
      : prop.teaserImageId
        ? [
            {
              id: prop.teaserImageId,
              url:
                prop.images?.find((i) => i.id === prop.teaserImageId)?.url ||
                "",
            },
          ]
        : [];
  const activeImage = allImages[activeImageIdx] || allImages[0];

  const handleCreateMatchAction = () => {
    if (existingMatch) {
      onMatchGenerated(existingMatch.report);
    } else {
      setShowMatchWarning(true);
    }
  };

  const handleConfirmMatch = async () => {
    setShowMatchWarning(false);
    if (!auth.currentUser) return;

    // Deduct credits for AI Match
    const confirmed = await deductCredits(
      CREDIT_COSTS.AI_MATCH,
      `AI Match Rapport gegenereerd voor ${prop.title}`,
    );
    if (!confirmed) return;

    setIsMatching(true);
    try {
      const match = (await generateMatchReport(
        auth.currentUser.uid,
        prop.id,
        i18n.language || 'nl'
      )) as any;
      onMatchGenerated(match.report);
      setExistingMatch(match);

      // Update unlocked matches
      const ref = doc(db, "seeker_profiles", auth.currentUser.uid);
      await updateDoc(ref, {
        unlocked_matches: arrayUnion(prop.id),
      });
    } catch (error) {
      alert(t("chat.error_send")); // Using a generic send error for now or add report.error_gen
      console.error(error);
    }
    setIsMatching(false);
  };

  const distance =
    seekerLocation && prop.displayLat && prop.displayLng && calculateDistance
      ? calculateDistance(
          seekerLocation.lat,
          seekerLocation.lng,
          prop.displayLat,
          prop.displayLng,
        )
      : null;

  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const freeText = prop.features?.free_text_description || "";

  const StarDisplay = ({ value, size = 12 }: { value: number; size?: number }) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={size}
            fill={s <= value ? "currentColor" : "none"}
            className={`${s <= value ? "text-primary fill-primary" : "text-outline/30"}`}
          />
        ))}
      </div>
    );
  };

  const depositDetails = prop.features?.deposit;
  const additionalCostsDetails = prop.features?.additional_costs;
  const priceDescDetails = prop.priceDescription || prop.features?.priceDescription;

  const hasDepositDetails = depositDetails !== undefined && depositDetails !== null && depositDetails > 0;
  const hasAddCostsDetails = additionalCostsDetails !== undefined && additionalCostsDetails !== null && additionalCostsDetails > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background md:bg-black/60 backdrop-blur-md flex items-center justify-center p-0 md:p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white md:rounded-[3rem] w-full h-full md:w-[95vw] md:max-w-[1920px] md:h-[95vh] flex flex-col shadow-2xl overflow-hidden relative"
      >
        <div className="flex-grow overflow-y-auto w-full custom-scrollbar flex flex-col">
          <div className="flex flex-col md:flex-row w-full">
            {/* Left Column: Pictures */}
            <div className="md:w-1/2 flex flex-col bg-surface-container-lowest border-b md:border-b-0 md:border-r border-outline/30 w-full shrink-0">
              {allImages.length > 0 ? (
                <div className="relative h-[40vh] md:h-[50vh] shrink-0 bg-black w-full">
                  {activeImage && activeImage.url ? (
                    <img
                      src={activeImage.url}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={() => onShowGallery?.(allImages, activeImageIdx)}
                    />
                  ) : null}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite?.();
                      }}
                      className={`p-3 backdrop-blur rounded-full transition-all shadow-md bg-white/90 ${isFavorite ? "scale-110" : "hover:scale-105"}`}
                    >
                      <Heart
                        size={20}
                        fill={isFavorite ? "#ef4444" : "none"}
                        stroke={isFavorite ? "#ef4444" : "currentColor"}
                        className={
                          isFavorite ? "text-[#ef4444]" : "text-on-surface"
                        }
                      />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-3 bg-white/90 backdrop-blur rounded-full text-on-surface hover:scale-105 transition-all shadow-md md:hidden"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  {/* Title Overlay */}
                  {(activeImage?.description || activeImage?.category) && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6">
                      <p className="text-white font-bold text-lg drop-shadow-md">
                        {activeImage?.description || ""}{" "}
                        {activeImage?.category
                          ? `(${t(`prop.media.cat.${activeImage.category.toLowerCase()}`, activeImage.category)})`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[30vh] md:h-[50vh] bg-surface-container-low flex items-center justify-center w-full">
                  <Layout size={48} className="text-outline-variant" />
                </div>
              )}

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="p-4 flex gap-3 overflow-x-auto snap-x hide-scrollbar bg-surface-container-lowest shrink-0 w-full">
                  {allImages.map((img, idx) => (
                    <button
                      key={img.id ? `thumb-${img.id}` : `thumb-idx-${idx}`}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`shrink-0 w-24 h-24 rounded-2xl overflow-hidden snap-start transition-all border-4 relative group/thumb ${idx === activeImageIdx ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                    >
                      {img && img.url ? (
                        <img
                          src={img.url}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      {img.category && (
                        <div className="absolute top-1 left-1 bg-black/40 backdrop-blur-sm px-1.5 rounded-md text-[8px] text-white font-black uppercase tracking-tighter">
                          {
                            t(
                              `prop.media.cat.${img.category.toLowerCase()}`,
                              img.category as any,
                            ) as string
                          }
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Key Details */}
            <div className="md:w-1/2 p-6 md:p-10 flex flex-col gap-6 w-full shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-widest mb-4">
                    {t("property.details.premium_access")}
                  </div>
                  <h2 className="text-4xl font-display font-black text-on-background mb-2 leading-tight">
                    {prop.title || t("property.details.title")}
                  </h2>
                  <p className="text-xl text-on-surface-variant font-medium flex items-center gap-2">
                    <MapPin size={20} />
                    {prop.city}{" "}
                    {prop.neighborhood ? `- ${prop.neighborhood}` : ""}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-3 bg-surface-container hover:bg-surface-container-high rounded-full text-on-surface transition-all hidden md:block"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex flex-col gap-3 pb-6 border-b border-outline/30">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-4xl font-black text-primary">
                    {prop.priceType === "tbd"
                      ? t("prop.price_tbd", "Prijs n.t.b.")
                      : prop.priceType === "range"
                        ? `${currencyConverter.formatEur(prop.minPrice)} - ${currencyConverter.formatEur(prop.maxPrice)}/mnd`
                        : `${currencyConverter.formatEur(prop.price)}/mnd`}
                  </div>
                  {distance !== null && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-xl font-bold">
                      <MapPin size={18} />
                      {t("property.details.distance", { dist: distance })}
                    </div>
                  )}
                </div>

                {/* Borg en bijkomende kosten regeltje met eventuele toelichting */}
                {(hasDepositDetails || hasAddCostsDetails || priceDescDetails) && (
                  <div className="flex flex-col gap-2 mt-2 bg-surface-container-lowest border border-outline/30 rounded-2xl p-4 shadow-sm text-sm">
                    {(hasDepositDetails || hasAddCostsDetails) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-bold text-on-surface">
                        {hasDepositDetails && (
                          <span className="flex items-center gap-1">
                            <span className="text-on-surface-variant font-medium text-xs uppercase tracking-wider">{t("prop.money.deposit", "Borg")}:</span>
                            <span className="text-primary">{currencyConverter.formatEur(depositDetails)}</span>
                          </span>
                        )}
                        {hasDepositDetails && hasAddCostsDetails && <span className="text-outline/30 select-none">|</span>}
                        {hasAddCostsDetails && (
                          <span className="flex items-center gap-1">
                            <span className="text-on-surface-variant font-medium text-xs uppercase tracking-wider">{t("prop.money.additional_costs", "Bijkomende kosten")}:</span>
                            <span className="text-primary">{currencyConverter.formatEur(additionalCostsDetails)}</span>
                          </span>
                        )}
                      </div>
                    )}
                    {priceDescDetails && (
                      <div className="text-xs text-on-surface-variant font-medium italic border-t border-outline/20 pt-1.5 leading-relaxed">
                        {priceDescDetails}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {prop.features?.type && (
                  <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                      {t("prop.basis.type")}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">
                        {String(
                          t(
                            `prop.type.${prop.features.type}`,
                            prop.features.type,
                          ),
                        )}
                      </span>
                      <Home size={16} className="text-primary/50" />
                    </div>
                  </div>
                )}
                {prop.features?.goal === "vakantie_onderhuur" &&
                prop.monthlyAvailability ? (
                  <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                      {t("prop.category.availability", "Beschikbaarheid")}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">
                        {
                          Object.values(prop.monthlyAvailability).filter(
                            (v) => (v === "free" || v === "available" || v === "consultation"),
                          ).length
                        }{" "}
                        maanden
                      </span>
                      <Calendar size={16} className="text-primary/50" />
                    </div>
                  </div>
                ) : prop.features?.available_from ? (
                  <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                      {t("property.details.available", "Beschikbaar vanaf")}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">
                        {prop.features.available_from}
                      </span>
                      <Calendar size={16} className="text-primary/50" />
                    </div>
                  </div>
                ) : null}
                {prop.features?.bedrooms !== undefined && (
                  <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                      {t("property.details.bedrooms")}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">
                        {prop.features.bedrooms}
                      </span>
                      <BedDouble size={16} className="text-primary/50" />
                    </div>
                  </div>
                )}
                {prop.features?.area_private !== undefined && (
                  <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                      {t("property.details.area")}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">
                        {prop.features.area_private} m²{" "}
                        {prop.features.area_shared
                          ? `(+ ${prop.features.area_shared}m²)`
                          : ""}
                      </span>
                      <Maximize2 size={16} className="text-primary/50" />
                    </div>
                  </div>
                )}
                {prop.features?.domicile && (
                  <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                      {t("property.details.domicile")}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold capitalize">
                        {String(
                          t(
                            `common.${prop.features.domicile}`,
                            prop.features.domicile,
                          ),
                        )}
                      </span>
                      <span className="text-primary/50 font-bold">Dom</span>
                    </div>
                  </div>
                )}
                {prop.features?.goal && (
                  <div className="bg-surface-container-lowest border border-outline/30 p-4 rounded-2xl shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                      {t("property.details.goal")}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">
                        {{
                          cohousing: t("prop.goal.cohousing"),
                          hospita: t("prop.goal.hospita"),
                          vakantie_onderhuur: t("prop.goal.vakantie_onderhuur"),
                          huisbewaring_expat: t("prop.goal.huisbewaring_expat"),
                          vrije_verhuur: t("prop.goal.vrije_verhuur"),
                        }[prop.features.goal as string] || prop.features.goal}
                      </span>
                      <span className="text-primary/50 font-bold">Doel</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-grow"></div>

              {/* End of right column */}
            </div>
          </div>

          {/* Monthly Availability Section for Vacation Homes - Moved here to be more prominent */}
          {prop.features?.goal === "vakantie_onderhuur" &&
            prop.monthlyAvailability && (
              <div className="w-full p-8 md:p-10 bg-primary/5 border-y border-outline/30">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black text-on-surface uppercase tracking-tight">
                      {t("prop.availability.title")}
                    </h3>
                    <p className="text-sm font-bold text-on-surface-variant">
                      {t("prop.availability.desc")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {(() => {
                    const monthKeysShort = [
                      "jan",
                      "feb",
                      "mar",
                      "apr",
                      "may",
                      "jun",
                      "jul",
                      "aug",
                      "sep",
                      "oct",
                      "nov",
                      "dec",
                    ];
                    const now = new Date();
                    const months = [];
                    for (let i = 0; i < 12; i++) {
                      const d = new Date(
                        now.getFullYear(),
                        now.getMonth() + i,
                        1,
                      );
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      const monthName = t(
                        `prop.availability.month_${monthKeysShort[d.getMonth()]}`,
                      );
                      const year = d.getFullYear();
                      months.push({ key, name: monthName, year });
                    }

                    return months.map((m) => {
                      const statusId = prop.monthlyAvailability?.[m.key] || "not_available";
                      
                      let bgClass = "bg-surface-container-high text-on-surface-variant border-outline-variant opacity-80";
                      let dotColor = "bg-on-surface-variant";
                      let labelKey = "availability.not_available";

                      if (statusId === "available" || statusId === "free") {
                        bgClass = "bg-white border-outline text-on-surface shadow-sm";
                        dotColor = "bg-success animate-pulse";
                        labelKey = "availability.available";
                      } else if (statusId === "consultation") {
                        bgClass = "bg-[#ffeedd] text-[#cc6600] border-[#ffcc99] shadow-sm";
                        dotColor = "bg-[#cc6600]";
                        labelKey = "availability.consultation";
                      } else if (statusId === "occupied") {
                        bgClass = "bg-[#ffdddd] text-[#cc0000] border-[#ff9999] opacity-80";
                        dotColor = "bg-[#cc0000]";
                        labelKey = "availability.occupied";
                      } else if (statusId === "not_for_rent_month") {
                        bgClass = "bg-surface-variant text-on-surface-variant border-outline-variant";
                        dotColor = "bg-on-surface-variant";
                        labelKey = "availability.not_for_rent_month";
                      }

                      return (
                        <div
                          key={m.key}
                          className={`flex flex-col p-4 rounded-2xl border transition-all ${bgClass}`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                            {m.year}
                          </span>
                          <span className="text-sm font-black uppercase tracking-tight text-inherit">
                            {m.name}
                          </span>
                          <div className="mt-2 flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-inherit">
                              {t(labelKey)}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

          {/* Below the fold: Additional Details spanning full width */}
          <div className="w-full p-6 md:p-10 border-t border-outline/30 bg-surface-container-lowest grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Monthly Availability section has been moved up */}

            {freeText && (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-4">
                <h3 className="text-2xl font-display font-black flex items-center gap-2">
                  <MessageSquare className="text-primary" />{" "}
                  {t("property.details.description_provider")}
                </h3>
                <div className="bg-primary/5 p-8 rounded-[2rem] text-on-surface-variant leading-relaxed text-base">
                  <TranslateText text={freeText} />
                </div>
              </div>
            )}

            {/* Map */}
            {prop.displayLat && prop.displayLng && (
              <div className={`col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-4 ${isMapFullscreen ? "fixed inset-0 z-[9999] bg-white p-4" : ""}`}>
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-display font-black flex items-center gap-2">
                    <MapPin className="text-primary" />
                    {t("property.details.location")}{" "}
                    {prop.displayRadius ? `(binnen ${prop.displayRadius}m)` : ""}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMapType(prev => prev === 'streets' ? 'satellite' : 'streets')}
                      className="px-4 py-2 bg-white border border-outline/50 rounded-xl text-xs font-bold shadow-sm hover:bg-surface-container-low transition-colors flex items-center gap-2"
                    >
                      {mapType === 'streets' ? <ImageIcon size={14} /> : <MapIcon size={14} />}
                      {mapType === 'streets' ? t('map.satellite', 'Satelliet') : t('map.streets', 'Kaart')}
                    </button>
                    <button
                      onClick={() => setIsMapFullscreen(prev => !prev)}
                      className="p-2 bg-white border border-outline/50 rounded-xl shadow-sm hover:bg-surface-container-low transition-colors"
                      title={isMapFullscreen ? t('common.exit_fullscreen', 'Sluit fullscreen') : t('common.fullscreen', 'Fullscreen')}
                    >
                      {isMapFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                  </div>
                </div>
                <div className={`${isMapFullscreen ? "flex-grow" : "h-80"} w-full bg-surface-container-low rounded-3xl overflow-hidden relative z-0 shadow-inner border border-outline/50`}>
                  <MapContainer
                    key={`${mapType}-${isMapFullscreen}`}
                    center={[prop.displayLat, prop.displayLng]}
                    zoom={prop.displayRadius ? 14 : 15}
                    scrollWheelZoom={isMapFullscreen}
                    style={{ width: "100%", height: "100%", zIndex: 0 }}
                  >
                    {mapType === 'streets' ? (
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    ) : (
                      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    )}
                    {prop.displayRadius ? (
                      <Circle
                        center={[prop.displayLat, prop.displayLng]}
                        radius={prop.displayRadius}
                        pathOptions={{
                          color: "#2563eb",
                          fillColor: "#3b82f6",
                          fillOpacity: 0.2,
                        }}
                      />
                    ) : (
                      <Circle
                        center={[prop.displayLat, prop.displayLng]}
                        radius={100}
                        pathOptions={{
                          color: "#2563eb",
                          fillColor: "#3b82f6",
                          fillOpacity: 0.2,
                        }}
                      />
                    )}
                  </MapContainer>
                </div>
              </div>
            )}

            {/* Dynamic Detail Categories */}
            {(() => {
              const isUnlocked =
                seekerProfile?.unlocked_details?.includes(prop.id) ||
                seekerProfile?.unlocked_all_options?.includes(prop.id);

              const visibilityCategories = [
                {
                  id: "tenant_prefs",
                  label: t("prop.category.tenant_prefs"),
                  icon: Heart,
                },
                {
                  id: "composition",
                  label: t("prop.category.composition"),
                  icon: Users,
                },
                {
                  id: "layout",
                  label: t("prop.category.layout"),
                  icon: Layout,
                },
                {
                  id: "vacation_specs",
                  label: t("prop.category.vacation_specs"),
                  icon: Sun,
                },
                {
                  id: "entrance",
                  label: t("prop.category.entrance"),
                  icon: DoorOpen,
                },
                {
                  id: "kitchen",
                  label: t("prop.category.kitchen"),
                  icon: ChefHat,
                },
                {
                  id: "laundry",
                  label: t("prop.category.laundry"),
                  icon: Wind,
                },
                {
                  id: "climate",
                  label: t("prop.category.climate"),
                  icon: Thermometer,
                },
                {
                  id: "media",
                  label: t("prop.category.media"),
                  icon: Wifi,
                },
                {
                  id: "outside",
                  label: t("prop.category.outside"),
                  icon: TreePine,
                },
                {
                  id: "extra",
                  label: t("prop.category.extra"),
                  icon: PlusSquare,
                },
                {
                  id: "safety",
                  label: t("prop.category.safety"),
                  icon: ShieldCheck,
                },
                {
                  id: "parking",
                  label: t("prop.category.parking"),
                  icon: Car,
                },
                { id: "pets", label: t("prop.category.pets"), icon: Dog },
                {
                  id: "surroundings",
                  label: t("prop.category.surroundings"),
                  icon: MapPin,
                },
                {
                  id: "condition",
                  label: t("prop.category.condition"),
                  icon: Paintbrush,
                },
              ];

              const categoryMappings: Record<string, string[]> = {
                basis: ["type", "subtype", "prop_composition"],
                address: ["city", "neighborhood", "street_type"],
                period: ["available_from", "min_stay", "max_stay", "is_indefinite"],
                money: ["rent_price", "deposit", "inclusive_costs", "utilities_estimate"],
                composition: [
                  "occupancy",
                  "current_genders",
                  "composition_residents",
                  "composition_looking_for",
                ],
                layout: [
                  "bedrooms",
                  "area_private",
                  "area_shared",
                  "furnished",
                  "total_floors",
                ],
                vacation_specs: [
                  "pool",
                  "beach_distance",
                  "sauna",
                  "gym",
                  "bbq",
                  "playground",
                  "bicycles",
                  "ski_distance",
                ],
                entrance: [
                  "entrance_type",
                  "floor",
                  "has_elevator",
                  "wheelchair_accessible",
                ],
                kitchen: ["kitchen_type", "kitchen_utensils", "kitchen_gear"],
                laundry: ["laundry"],
                climate: [
                  "heating_types",
                  "has_ac",
                  "ventilation",
                  "solar_panels",
                ],
                media: [
                  "has_wifi",
                  "free_internet",
                  "internet",
                  "tv",
                  "streaming_services",
                  "streaming_other",
                  "internet_details",
                  "tv_details",
                  "smart_home",
                ],
                outside: [
                  "has_garden",
                  "has_balcony",
                  "has_terrace",
                  "has_roof_terrace",
                ],
                extra: ["smoking_allowed"],
                safety: [
                  "smoke_detector",
                  "carbon_monoxide_detector",
                  "fire_extinguisher",
                  "first_aid_kit",
                  "alarm_system",
                ],
                parking: ["parking", "parking_types", "ev_charging"],
                pets: ["pets", "tenant_pets_allowed", "landlord_pets"],
                surroundings: [
                  "street_type",
                  "surroundings",
                  "nearby_facilities",
                  "location_description",
                ],
                condition: ["condition_state", "condition_modifications"],
                tenant_prefs: [
                  "pref_languages",
                  "languages",
                  "preferred_language",
                  "age_min",
                  "age_max",
                  "pref_garden_maintenance",
                  "pref_sporty",
                  "pref_cooking",
                  "pref_irregular_hours",
                  "pref_retired",
                  "pref_tv_english",
                  "pref_tv_scandi",
                  "pref_bingewatch",
                  "pref_board_games",
                  "pref_quiet_evenings",
                  "pref_tidy",
                  "pref_creative",
                  "pref_political",
                  "pref_handyman",
                  "pref_renovation",
                  "pref_smoking",
                ],
              };

              const keyTranslation: Record<string, string> = {
                entrance_type: t("feature.entrance_type"),
                floor: t("feature.floor"),
                has_elevator: t("feature.has_elevator"),
                wheelchair_accessible: t("feature.wheelchair_accessible"),
                bedrooms: t("feature.bedrooms"),
                area_private: t("feature.area_private"),
                area_shared: t("feature.area_shared"),
                furnished: t("feature.furnished"),
                kitchen_gear: t("prop.kitchen.appliances", "Keukenapparatuur"),
                laundry: t("feature.laundry", "Wassen & Drogen"),
                kitchen_type: t("feature.kitchen_type"),
                total_floors: t("feature.total_floors"),
                heating_types: t("feature.heating_types"),
                parking: t("prop.parking.label", "Auto Parkeren"),
                street_type: t("prop.surroundings.location_type", "Ligging woning"),
                surroundings: t("prop.category.surroundings", "Voorzieningen nabij"),
                domicile: t("feature.domicile"),
                has_wifi: t("prop.internet.wifi", "Wifi"),
                free_internet: t("prop.internet.free", "Gratis internet"),
                wifi: t("feature.wifi"),
                balcony: t("feature.balcony"),
                garden: t("feature.garden"),
                internet: t("feature.internet"),
                tv: t("feature.tv"),
                streaming_services: t("feature.streaming_services"),
                streaming_other: t("feature.streaming_other", "Overige abonnementen"),
                has_ac: t("feature.has_ac"),
                ventilation: t("feature.ventilation"),
                outside_usage: t("feature.outside_usage"),
                parking_types: t("feature.parking_types", "Type Parkeerplaats"),
                pets: t("feature.pets"),
                tenant_pets_allowed: t("feature.tenant_pets_allowed", "Toegestane huisdieren"),
                landlord_pets: t("feature.landlord_pets", "Huisdieren in woning"),
                available_from: t("prop.period.available_from"),
                min_stay: t("prop.period.min_stay"),
                max_stay: t("prop.period.max_stay"),
                is_indefinite: t("prop.period.indefinite"),
                rent_price: t("prop.money.rent"),
                deposit: t("prop.money.deposit"),
                inclusive_costs: t("prop.money.inclusive"),
                utilities_estimate: t("prop.money.utilities"),
                smoking_allowed: t("prop.extra.smoking"),
                pool: t("prop.extra.pool"),
                beach_distance: t("prop.extra.beach"),
                sauna: t("prop.extra.sauna"),
                gym: t("prop.extra.gym"),
                bbq: t("prop.extra.bbq"),
                playground: t("prop.extra.playground"),
                bicycles: t("prop.extra.bicycles"),
                ski_distance: t("prop.extra.ski"),
                location_description: t("prop.surroundings.description", "Woning bevindt zich in"),
                composition_residents: t("feature.composition_residents"),
                composition_looking_for: t("feature.composition_looking_for"),
                condition_state: t("feature.condition_state"),
                condition_modifications: t("feature.condition_modifications"),
                pref_languages: t("prop.preference.pref_languages", "Voorkeurstalen huurder"),
                preferred_language: t("prop.preference.preferred_language", "Voorkeurstaal"),
                occupancy: t("feature.occupancy"),
                current_genders: t("feature.current_genders"),
                age_min: t("feature.age_min"),
                age_max: t("feature.age_max"),
                goal: t("feature.goal"),
                type: t("feature.type"),
                additional_costs: t("feature.additional_costs"),
                pet_policy: t("feature.pet_policy"),
                sanitary_details: t("prop.layout.sanitary", "Sanitair"),
                kitchen_utensils: t("prop.kitchen.utensils", "Keukengerei"),
                has_garden: t("prop.outdoor.garden", "Tuin"),
                has_balcony: t("prop.outdoor.balcony", "Balkon"),
                has_terrace: t("prop.outdoor.terrace", "Terras"),
                has_roof_terrace: t("prop.outdoor.roof_terrace", "Dakterras"),
                smoke_detector: t("prop.safety.smoke_detector", "Rookmelder"),
                carbon_monoxide_detector: t("prop.safety.carbon_monoxide", "Koolmonoxidemelder"),
                fire_extinguisher: t("prop.safety.fire_extinguisher", "Brandblusser"),
                first_aid_kit: t("prop.safety.first_aid", "EHBO Kit"),
                alarm_system: t("prop.safety.alarm", "Alarmsysteem"),
                pref_sporty: t("prop.preference.pref_sporty"),
                pref_cooking: t("prop.preference.pref_cooking"),
                pref_irregular_hours: t("prop.preference.pref_irregular_hours"),
                pref_retired: t("prop.preference.pref_retired"),
                pref_tv_english: t("prop.preference.pref_tv_english"),
                pref_tv_scandi: t("prop.preference.pref_tv_scandi"),
                pref_bingewatch: t("prop.preference.pref_bingewatch"),
                pref_board_games: t("prop.preference.pref_board_games"),
                pref_quiet_evenings: t("prop.preference.pref_quiet_evenings"),
                pref_tidy: t("prop.preference.pref_tidy"),
                pref_creative: t("prop.preference.pref_creative"),
                pref_political: t("prop.preference.pref_political"),
                pref_handyman: t("prop.preference.pref_handyman"),
                pref_renovation: t("prop.preference.pref_renovation"),
                pref_garden_maintenance: t("prop.prefs.garden_maintenance", "Tuinonderhoud"),
              };

              const formatKey = (key: string) =>
                keyTranslation[key] ||
                key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

              const formatVal = (val: any, fieldKey?: string): React.ReactNode => {
                if (val === undefined || val === null || val === "") return "-";
                if (val === "Yes" || val === "yes")
                  return String(t("common.yes", "Ja"));
                if (val === "No" || val === "no") return String(t("common.no", "Nee"));
                if (typeof val === "boolean") {
                  if (fieldKey && ["has_garden", "has_balcony", "has_terrace", "has_roof_terrace"].includes(fieldKey)) {
                    if (!val) return String(t("common.no", "Nee"));
                    const usage = prop.features?.outside_usage?.[fieldKey] || "prive";
                    const isShared = usage === "gedeeld" || usage === "shared";
                    const usageLabel = isShared ? t("common.shared", "Gedeeld") : t("common.private", "Privé");
                    return (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold uppercase text-primary text-right">{String(t("common.yes", "Ja"))}</span>
                        <span className="text-[10px] font-extrabold opacity-75 uppercase tracking-wider text-right text-secondary">
                          ({usageLabel})
                        </span>
                      </div>
                    );
                  }
                  return val ? String(t("common.yes", "Ja")) : String(t("common.no", "Nee"));
                }

                if (fieldKey === "pref_languages" || fieldKey === "languages") {
                  if (!val || !Array.isArray(val) || val.length === 0) return "-";
                  return (
                    <div className="flex flex-col gap-1.5 items-end">
                      {val.map((lang: any, idx: number) => {
                        const langName =
                          LANGUAGES_SORTED.find(
                            (l) => l.id === (lang.code || lang.id),
                          )?.name || (lang.code || lang.id);
                        const rating = lang.rating !== undefined ? Number(lang.rating) : 3;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[11px] font-bold">{langName}</span>
                            <StarDisplay value={rating} size={10} />
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                if (fieldKey === "preferred_language") {
                  const langName =
                    LANGUAGES_SORTED.find((l) => l.id === val)?.name ||
                    (val as string);
                  return langName || "-";
                }

                if (Array.isArray(val)) {
                  if (val.length === 0) return "-";
                  if (typeof val[0] === "object" && val[0] !== null) {
                    return val
                      .map((item: any) => {
                        if (item && item.type) {
                          const typeStr =
                            item.type === "any"
                              ? t(
                                  "prop.composition.all_welcome",
                                  "Iedereen welkom",
                                )
                              : t(`prop.composition.${item.type}`, item.type);
                          const ageStr = item.age ? ` (${item.age})` : "";
                          const exclStr = item.isExcluded
                            ? ` - ${t("common.exclude", "Niet welkom")}`
                            : "";
                          return `${typeStr}${ageStr}${exclStr}`;
                        }
                        return t("common.not_available");
                      })
                      .join(", ");
                  }
                  return val
                    .map((v) => {
                      const str = String(v);
                      if (fieldKey === "parking_types") {
                        if (str === "bike_storage")
                          return t("prop.storage.bicycle", "Fietsenstalling");
                        if (str === "scooter_storage")
                          return t("prop.storage.scooter", "Scooterstalling");
                        if (str === "motorcycle_storage")
                          return t("prop.storage.motorcycle", "Motorstalling");
                        if (str === "covered_storage")
                          return t("prop.parking.covered_desc", "Overdekt");
                        if (str === "ev_charger")
                          return t("prop.storage.ev_charger", "Laadpaal");
                      }
                      if (
                        fieldKey === "tenant_pets_allowed" ||
                        fieldKey === "landlord_pets"
                      ) {
                        return t(`prop.pets.${str.toLowerCase()}`, str);
                      }
                      if (fieldKey === "condition_modifications") {
                        return t(`prop.condition.${str}`, str);
                      }
                      return t(`seeker.item.${str}`, str.replace(/_/g, " "));
                    })
                    .join(", ");
                }

                // Star rating for preferences if value is 1-5
                if (
                  typeof val === "number" &&
                  val >= 1 &&
                  val <= 5 &&
                  (fieldKey?.includes("pref_") || fieldKey?.includes("rating"))
                ) {
                  return <StarDisplay value={val} />;
                }

                if (typeof val === "object") {
                  if (fieldKey === "laundry") {
                    const res = [];
                    if (val.washing_machine && val.washing_machine !== "none")
                      res.push(
                        `${t("prop.laundry.washing_machine", "Wasmachine")} (${t(`common.${val.washing_machine}`, val.washing_machine)})`,
                      );
                    if (val.dryer && val.dryer !== "none")
                      res.push(
                        `${t("prop.laundry.dryer", "Droger")} (${t(`common.${val.dryer}`, val.dryer)})`,
                      );
                    return res.length > 0 ? res.join(", ") : "-";
                  }
                  if (fieldKey === "kitchen_gear") {
                    return (
                      <div className="flex flex-col items-end gap-1">
                        {Object.entries(val).map(([k, usage]) => {
                          if (['gas_stove', 'induction_hob'].includes(k)) return null;
                          return (
                            <span key={k} className="text-[11px] leading-tight text-right">
                               <span className="opacity-70">{t(`prop.kitchen_gear.${k}`, k)}</span>
                               <span className="ml-1 text-primary font-black uppercase text-[10px]">({t(`common.${usage as string}`, usage as string)})</span>
                            </span>
                          );
                        })}
                      </div>
                    );
                  }
                  if (fieldKey === "sanitary_details") {
                    return (
                      <div className="flex flex-col items-end gap-1">
                        {Object.entries(val).map(([k, usage]) => (
                          <span key={k} className="text-[11px] leading-tight text-right">
                             <span className="opacity-70">{t(`prop.layout.${k}`, k)}</span>
                             <span className="ml-1 text-primary font-black uppercase text-[10px]">({t(`common.${usage as string}`, usage as string)})</span>
                          </span>
                        ))}
                      </div>
                    );
                  }
                  if (fieldKey === "street_type") {
                    return String(t(`prop.omgeving.${val}`, val as string));
                  }
                  if (fieldKey === "surroundings" || fieldKey === "nearby_facilities") {
                    const active = Object.entries(val).filter(
                      ([_k, v]: [string, any]) => v.present,
                    );
                    if (active.length === 0) return "-";
                    return (
                      <div className="flex flex-col items-end gap-1.5">
                        {active.map(([k, v]: [string, any]) => {
                          let distStr = v.distance || "?";
                          if (distStr === "< 5 min")
                            distStr = String(t("prop.dist.walk", "< 5 min"));
                          else if (distStr === "5-10 min")
                            distStr = String(t("prop.dist.close", "5-10 min"));
                          else if (distStr === "10-20 min")
                            distStr = String(t("prop.dist.reachable", "10-20 min"));
                          else if (distStr === "> 20 min")
                            distStr = String(t("prop.dist.far", "> 20 min"));

                          const surroundingsMap: Record<string, string> = {
                            nature: t("prop.surroundings.nature", "Natuur"),
                            train: t("prop.surroundings.train", "Treinstation"),
                            bus: t("prop.surroundings.bus", "Bushalte"),
                            shops: t("prop.surroundings.shops", "Winkels"),
                            supermarket: t("prop.surroundings.supermarket", "Supermarkt"),
                            park: t("prop.surroundings.park", "Park"),
                            city_center: t("prop.surroundings.city_center", "Stadscentrum"),
                            highway: t("prop.surroundings.highway", "Snelweg")
                          };
                          const localizedKey = surroundingsMap[k] || String(t(`prop.nearby.${k}`, k));

                          return (
                            <span key={k} className="text-[11px] leading-tight text-right">
                              <span className="font-bold">{localizedKey}</span>
                              <div className="text-[10px] opacity-70">
                                {distStr}{v.name ? ` - ${v.name}` : ""}
                              </div>
                            </span>
                          );
                        })}
                      </div>
                    );
                  }
                  return "-";
                }

                const strVal = String(val).replace(/_/g, " ");
                if (strVal === "[object Object]")
                  return "-";

                // Special handling for Yes/No strings
                if (strVal.toLowerCase() === "no") return String(t("common.no", "Nee"));
                if (strVal.toLowerCase() === "yes")
                  return String(t("common.yes", "Ja"));

                if (
                  fieldKey === "kitchen_type" ||
                  fieldKey === "kitchen_utensils"
                ) {
                  const tKey =
                    fieldKey === "kitchen_utensils"
                      ? `prop.kitchen.utensils_${val}`
                      : `prop.kitchen.${val}`;
                  return String(t(tKey, strVal));
                }
                if (fieldKey === "condition_state") {
                  return String(t(`prop.condition.${val}`, strVal));
                }
                if (fieldKey === "pets") {
                  if (val === "consult")
                    return String(t("common.in_consultation", "In overleg"));
                }
                if (fieldKey === "parking") {
                  return String(t(`prop.park.${val}`, strVal));
                }

                return String(t(`seeker.item.${val}`, String(t(`prop.${val}`, strVal))));
              };

              let hiddenCount = 0;

              return (
                <>
                  {visibilityCategories.map((cat) => {
                    // Check visibility
                    if (cat.id === "vacation_specs" && prop.features?.goal !== 'vakantie_onderhuur') {
                      return null;
                    }
                    if (
                      !isUnlocked &&
                      (prop.features?.visibility?.[cat.id] === false || (cat.id === "composition" && prop.features?.visibility?.composition === false))
                    ) {
                      // Category explicitly hidden
                      hiddenCount++;
                      return null;
                    }
                    if (
                      !isUnlocked &&
                      cat.id === "tenant_prefs" &&
                      prop.features?.visibility?.preferences === false
                    ) {
                      hiddenCount++;
                      return null;
                    }

                    // Get available fields for this category
                    const fields = categoryMappings[cat.id] || [];
                    const activeFields = fields.filter((f) => {
                      const v = prop.features?.[f];
                      return (
                        v !== undefined &&
                        v !== null &&
                        v !== "" &&
                        (!Array.isArray(v) || v.length > 0)
                      );
                    });

                    if (activeFields.length === 0) return null;

                    const Icon = cat.icon;

                    const isFullWidth = cat.id === "tenant_prefs" || cat.id === "surroundings" || cat.id === "vacation_specs";

                    return (
                      <div key={cat.id} className={`flex flex-col gap-4 ${isFullWidth ? "col-span-1 md:col-span-2 lg:col-span-3 mb-10" : "col-span-1 mb-10 h-full"}`}>
                        <h3 className="text-xl font-display font-black flex items-center gap-2">
                          <Icon className="text-primary" /> {cat.label}
                        </h3>
                        <div className={`bg-white p-6 rounded-3xl shadow-sm border border-outline/50 flex-grow h-full ${isFullWidth ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-12 gap-y-4" : "space-y-3"}`}>
                          {activeFields.map((f) => (
                            <div
                              key={f}
                              className={`flex justify-between items-start border-b border-outline/30 pb-2 last:border-0 last:pb-0 gap-4 ${isFullWidth ? "pb-4 mb-2" : ""}`}
                            >
                              <span className="text-on-surface-variant font-bold text-sm max-w-[60%] leading-tight pt-0.5">
                                {formatKey(f)}
                              </span>
                              <span className="font-bold text-sm text-right capitalize max-w-[60%] leading-tight break-words flex justify-end">
                                {formatVal(prop.features[f], f)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {hiddenCount > 0 && !isUnlocked && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-6 opacity-60 font-bold text-sm bg-surface-container-low rounded-xl mb-10">
                      <p>
                        {t("property.details.hidden_notice", {
                          count: hiddenCount,
                        })}
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="mt-8">
            <ExpertHub
              isFavorite={isFavorite}
              country={
                prop.features?.goal === "international"
                  ? "Nederland"
                  : "Nederland"
              }
            />
          </div>
        </div>

        {/* Global Footer */}
        <div className="p-4 md:p-6 border-t border-outline flex flex-col md:flex-row justify-end items-center bg-surface-container-lowest sticky bottom-0 shrink-0 w-full z-10 gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="flex gap-3 w-full md:w-auto justify-end">
            <button
              onClick={onClose}
              className="w-full md:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black text-sm uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all text-center cursor-pointer"
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        {/* Warning Modal */}
        <AnimatePresence>
          {showMatchWarning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 rounded-[3rem]"
              onClick={() => setShowMatchWarning(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background rounded-[3rem] p-12 max-w-md w-full shadow-2xl border border-outline relative text-center space-y-8"
              >
                <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto transition-transform">
                  <Sparkles size={48} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-2xl font-display font-black uppercase tracking-tight text-on-background">
                    {t("property.details.warning_title")}
                  </h3>
                  <p className="text-on-surface-variant font-medium leading-relaxed">
                    {t("property.details.warning_desc")}
                  </p>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <button
                    onClick={handleConfirmMatch}
                    className="w-full bg-primary text-on-primary py-5 rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-lg"
                  >
                    {t("property.details.btn_generate")}
                  </button>
                  <button
                    onClick={() => setShowMatchWarning(false)}
                    className="w-full py-4 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container transition-all"
                  >
                    {t("property.details.btn_wait")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Modal */}
        <AnimatePresence>
          {isMatching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[9999] bg-on-background/90 backdrop-blur-2xl flex items-center justify-center p-4 cursor-wait rounded-[3rem]"
            >
              <div className="flex flex-col items-center text-center space-y-12">
                <div className="relative">
                  <div className="absolute inset-[-20px] border-4 border-primary/20 rounded-full animate-ping" />
                  <div className="absolute inset-[-40px] border-4 border-primary/10 rounded-full animate-ping [animation-delay:0.5s]" />
                  <div className="w-40 h-40 border-8 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="text-primary"
                    >
                      <Sparkles size={64} />
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-4 max-w-sm">
                  <h3 className="text-4xl font-display font-black text-white tracking-tight">
                    {t("property.details.loading_title")}
                  </h3>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="h-full w-1/2 bg-primary"
                    />
                  </div>
                  <p className="text-white/80 font-bold text-lg">
                    {t("property.details.loading_desc")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Home, 
  Euro, 
  Layout, 
  DoorOpen, 
  ChefHat, 
  Mic,
  Wifi, 
  Wind, 
  Thermometer,
  TreePine, 
  ShieldCheck, 
  Car, 
  Dog, 
  MapPin,
  Trash2,
  Edit2,
  Copy,
  Check,
  Paintbrush,
  ShieldAlert,
  AlertCircle,
  ChevronRight,
  Info,
  X,
  MessageSquare,
  Image as ImageIcon,
  Star,
  CheckCircle2,
  Lock,
  Eye,
  Menu,
  Square,
  Bed,
  Map as MapIcon,
  Layers,
  Plus as PlusIcon,
  Minus,
  Maximize2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  Users,
  Globe,
  FileText,
  EyeOff,
  Save,
  Search,
  LocateFixed,
  Mail,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { LANGUAGES_SORTED } from '../data/languages';
import { ProviderProfileModal } from './ProviderProfileModal';
import { ExpertHub } from './ExpertHub';

// Fix for default marker icons in Leaflet with Vite
// Using CDN URLs to avoid local asset resolution issues in linting
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;
import { toast } from 'react-hot-toast';
import { db, auth, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { useSettings } from '../contexts/SettingsContext';
import { formatDate } from '../lib/formatters';

export interface PropertyImage {
  id: string;
  url: string;
  category: string;
  description?: string;
}

export interface Property {
  id: string;
  ownerId: string;
  title: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  displayLat?: number;
  displayLng?: number;
  displayRadius?: number;
  description?: string;
  price: number;
  minPrice?: number;
  maxPrice?: number;
  priceType?: 'fixed' | 'range' | 'tbd';
  priceDescription?: string;
  location: string;
  status: 'available' | 'paused' | 'rented';
  isActive?: boolean;
  maxInquiries?: number;
  currentInquiries?: number;
  features: any;
  completion: number;
  createdAt?: any;
  images?: PropertyImage[];
  teaserImageId?: string;
  monthlyAvailability?: Record<string, string>;
  visibility?: any;
  highlightWeeks?: string[];
  ownerSuspended?: boolean;
}

const validateText = (text: string, t: any) => {
  if (!text) return null;
  
  // Normalized text for smarter detection (remove spaces and common obfuscation)
  const normalized = text.toLowerCase().replace(/[\s\(\)\[\]\-]/g, '');
  const emailObfuscated = normalized.replace(/at|\[at\]|\(at\)/g, '@').replace(/dot|\[dot\]|\(dot\)/g, '.');
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  
  // Phone regex: check for sequences of 8+ digits
  const phoneNumbers = normalized.match(/\d{8,}/g);
  let hasPhone = !!phoneNumbers;

  if (emailRegex.test(text) || emailRegex.test(emailObfuscated)) return t('validation.email_not_allowed', 'Email addresses are not allowed.');
  if (hasPhone) return t('validation.phone_not_allowed', 'Phone numbers are not allowed.');
  return null;
};

import { useCurrencyConverter } from '../hooks/useCurrencyConverter';
import ProviderChatsModal from './ProviderChatsModal';
import { VerificationModal } from './VerificationModal';
import PropertyLimitModal from './PropertyLimitModal';
import PropertyBundleModal from './PropertyBundleModal';
import { TrustBadge, TrustPopup } from './TrustBadge';
import { Linkedin, ExternalLink } from 'lucide-react';
import { getDoc } from 'firebase/firestore';
import AvailabilityHubModal from './AvailabilityHubModal';

const ReactivationAlert: React.FC<{ 
  properties: Property[], 
  onReactivate: (prop: Property) => void,
  onIncreaseLimit: (prop: Property) => void,
  providerChats: any[]
}> = ({ properties, onReactivate, onIncreaseLimit, providerChats }) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [mutedPropIds, setMutedPropIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('muted_reactivation_prompts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleMuteProperty = (propId: string) => {
    const updated = [...mutedPropIds, propId];
    setMutedPropIds(updated);
    try {
      localStorage.setItem('muted_reactivation_prompts', JSON.stringify(updated));
      toast.success(t('dash.reactivate_muted_success', 'Meldingen voor deze woning zijn permanent verborgen.'));
    } catch (e) {
      console.error(e);
    }
  };
  
  const propertiesNeedingAttention = properties.filter(p => 
    p.status === 'paused' && 
    (p.currentInquiries || 0) < (p.maxInquiries || 10) &&
    !mutedPropIds.includes(p.id)
  );

  if (propertiesNeedingAttention.length === 0 || dismissed) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-white border-2 border-primary/20 p-6 rounded-3xl shadow-2xl w-[calc(100%-2rem)] max-w-lg mx-4"
    >
      <button 
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors cursor-pointer"
      >
        <X size={20} />
      </button>
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
          <MessageSquare />
        </div>
        <div className="flex-grow">
          <h4 className="font-display font-black text-on-background">{t('dash.reactivate_title', 'Woning weer activeren?')}</h4>
          <p className="text-sm text-on-surface-variant mb-4">
            {t('dash.reactivate_desc', 'Eén van je woningen heeft minder dan het maximaal aantal reacties. Wil je deze weer actief zetten?')}
          </p>
          <div className="flex flex-col gap-2.5 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {propertiesNeedingAttention.map(p => {
              const actualCount = Math.max(p.currentInquiries || 0, providerChats.filter(c => c.propertyId === p.id).length);
              return (
              <div key={`attention-${p.id}`} className="flex flex-col gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="font-bold text-sm truncate">{p.title}</div>
                <div className="text-xs font-bold text-primary">{actualCount} / {p.maxInquiries || 10} {t('dash.responses', 'reacties')}</div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onReactivate(p)}
                    className="flex-grow py-3 bg-primary text-on-primary rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    {t('dash.btn_activate', 'Nu Activeren')}
                  </button>
                  <button 
                    onClick={() => onIncreaseLimit(p)}
                    className="flex-grow py-3 border border-primary text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary/5 active:scale-95 cursor-pointer"
                  >
                    {t('dash.btn_limit_plus', 'Limiet verhogen')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleMuteProperty(p.id)}
                  className="w-full py-2 text-[9px] font-black uppercase tracking-wider text-on-surface-variant/70 hover:text-red-700 transition-colors bg-black/5 hover:bg-red-50 rounded-lg cursor-pointer text-center"
                >
                  ✕ {t('dash.btn_mute_property', 'Niet meer tonen voor deze woning')}
                </button>
              </div>
            )})}
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              onClick={() => setDismissed(true)}
              className="px-6 py-2.5 bg-surface-variant text-on-surface hover:bg-surface-container-high rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer"
            >
              {t('common.close', 'Sluiten')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function ProviderDashboard() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [copyingProp, setCopyingProp] = useState<Property | null>(null);
  const [deletingPropId, setDeletingPropId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [providerProfile, setProviderProfile] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showTrustPopup, setShowTrustPopup] = useState(false);
  const [chattingProp, setChattingProp] = useState<Property | null>(null);
  useEffect(() => {
    if (chattingProp) {
      window.dispatchEvent(new Event('chat-opened'));
    } else {
      window.dispatchEvent(new Event('chat-closed'));
    }
  }, [chattingProp]);
  const [providerChats, setProviderChats] = useState<any[]>([]);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [showAvailabilityHub, setShowAvailabilityHub] = useState(false);

  // Ref to hold properties for the event listener
  const latestPropertiesRef = React.useRef(properties);
  React.useEffect(() => {
    latestPropertiesRef.current = properties;
  }, [properties]);

  useEffect(() => {
    const handleOpenProviderChat = (e: any) => {
      const { propertyId, chatId } = e.detail;
      const prop = latestPropertiesRef.current.find(p => p.id === propertyId);
      if (prop) {
        setChattingProp(prop);
        if (chatId) {
          // Tell ProviderChatsModal to select this chat via custom event since we don't want to refactor props
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('provider-chat-preselect', { detail: { chatId } }));
          }, 100);
        }
      }
    };
    window.addEventListener('open-provider-chat-internal', handleOpenProviderChat);
    return () => window.removeEventListener('open-provider-chat-internal', handleOpenProviderChat);
  }, []);

  const getActualInquiries = (propId: string) => {
    return providerChats.filter(chat => chat.propertyId === propId).length;
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'chats'),
      where('providerId', '==', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProviderChats(chats);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'chats'));
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`));
    return () => unsubscribe();
  }, [auth.currentUser]);

  const fetchProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const { getDoc, doc } = await import('firebase/firestore');
      const profileSnap = await getDoc(doc(db, 'providers', auth.currentUser.uid));
      if (profileSnap.exists()) {
        setProviderProfile(profileSnap.data());
      }
    } catch (error) {
      console.error('Error fetching provider profile:', error);
    }
  };

  const fetchProperties = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'properties'), 
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const fetched: Property[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Property));

      const genericImages = [
        { id: 'img_test_1', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800' },
        { id: 'img_test_2', url: 'https://images.unsplash.com/photo-1502672260266-1c1c24226133?auto=format&fit=crop&q=80&w=800' },
        { id: 'img_test_3', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800' },
        { id: 'img_test_4', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=800' },
        { id: 'img_test_5', url: 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&q=80&w=800' },
        { id: 'img_test_6', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800' },
        { id: 'img_test_7', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=800' }
      ];

      const enrichedFetched = fetched.map(prop => {
        if (!prop.images || prop.images.length === 0) {
          const char0 = prop.id.charCodeAt(0) || 0;
          const char1 = prop.id.charCodeAt(1) || 1;
          const numImages = (char0 % 3) + 1; // 1, 2 or 3
          const startIndex = char1 % genericImages.length;
          const images = [];
          for (let i = 0; i < numImages; i++) {
            images.push(genericImages[(startIndex + i) % genericImages.length]);
          }
          return {
            ...prop,
            images,
            teaserImageId: images[0].id
          };
        }
        return prop;
      });

      setProperties(enrichedFetched);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'properties');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProperties();
    fetchProfile();

    const handleOpenProfile = () => {
      setShowProfileModal(true);
    };
    window.addEventListener('open-provider-profile', handleOpenProfile);
    window.addEventListener('refresh-provider-properties', fetchProperties);

    return () => {
      window.removeEventListener('open-provider-profile', handleOpenProfile);
      window.removeEventListener('refresh-provider-properties', fetchProperties);
    };
  }, []);

  const totalUnread = providerChats.reduce((acc, chat) => {
    const msgs = chat.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && lastMsg.senderId !== auth.currentUser?.uid && !lastMsg.read) {
      return acc + 1;
    }
    return acc;
  }, 0);

   const handleSaveProfile = async (data: any) => {
    if (!auth.currentUser) return;
    
    // Track action for PWA install prompt logic
    window.dispatchEvent(new Event('pwa-provider-action'));

    try {
      const { setDoc, doc, getDoc, serverTimestamp } = await import('firebase/firestore');
      await setDoc(doc(db, 'providers', auth.currentUser.uid), {
        ...data,
        updatedAt: serverTimestamp(),
        createdAt: providerProfile?.createdAt || serverTimestamp()
      }, { merge: true });
      
      // Under water check for 5 credits upon completing profile (having first name)
      const isComplete = !!(data && data.firstName);
      if (isComplete) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (!userData.hasReceivedCompletionCredits) {
            await setDoc(userRef, {
              credits: (userData.credits || 0) + 5,
              hasReceivedCompletionCredits: true,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        }
      }

      // Update local state and trigger refresh
      setProviderProfile({ ...data });
      await fetchProfile();
      await fetchProperties();
      
      setShowProfileModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'providers');
    }
  };

  const calculateCompletion = (data: any): number => {
    const checks = [
      () => !!(data.title && data.title !== 'Nieuwe Woning'),
      () => !!(data.description && data.description.trim().length > 0),
      () => !!(data.features?.goal),
      () => !!(data.features?.type),
      () => !!data.city,
      () => !!(data.images && data.images.length > 0),
      () => {
        const pt = data.priceType || 'fixed';
        if (pt === 'tbd') return true;
        if (pt === 'range' && data.minPrice > 0 && data.maxPrice > 0) return true;
        if (pt === 'fixed' && data.price > 0) return true;
        return false;
      }
    ];

    let filled = 0;
    checks.forEach(c => { if (c()) filled++; });

    return Math.round((filled / checks.length) * 100);
  };

  const handleAddProperty = async (force = false) => {
    if (!auth.currentUser) return;
    
    // Track action for PWA install prompt logic
    window.dispatchEvent(new Event('pwa-provider-action'));

    const maxProperties = userData?.max_properties || 3;
    if (properties.length >= maxProperties) {
      setShowBundleModal(true);
      return;
    }

    const isProfileComplete = !!(providerProfile && providerProfile.firstName);
    
    if (!isProfileComplete && !force) {
      setShowProfileModal(true);
      return;
    }
    
    try {
      const newPropData = {
        ownerId: auth.currentUser.uid,
        title: '',
        address: '',
        city: '',
        neighborhood: '',
        location: '',
        price: 0,
        status: 'available',
        maxInquiries: 10,
        currentInquiries: 0,
        isActive: false,
        deposit: 0,
        features: {
          is_indefinite: true
        },
        completion: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'properties'), newPropData);
      const newProp = { id: docRef.id, ...newPropData } as Property;
      setProperties([newProp, ...properties]);
      setEditingProp(newProp);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'properties');
    }
  };

  const handleReactivate = async (p: Property) => {
    // Track action for PWA install prompt logic
    window.dispatchEvent(new Event('pwa-provider-action'));
    try {
      await updateDoc(doc(db, 'properties', p.id), {
        status: 'available',
        updatedAt: serverTimestamp()
      });
      fetchProperties();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `properties/${p.id}`);
    }
  };

  const handleIncreaseLimit = async (p: Property) => {
    // Track action for PWA install prompt logic
    window.dispatchEvent(new Event('pwa-provider-action'));
    try {
      const newMax = Math.min(50, (p.maxInquiries || 10) + 10);
      await updateDoc(doc(db, 'properties', p.id), {
        maxInquiries: newMax,
        status: 'available',
        updatedAt: serverTimestamp()
      });
      fetchProperties();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `properties/${p.id}`);
    }
  };

  const handleDeleteProperty = async () => {
    if (!deletingPropId) return;
    try {
      await deleteDoc(doc(db, 'properties', deletingPropId));
      setProperties(properties.filter(p => p.id !== deletingPropId));
      setDeletingPropId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `properties/${deletingPropId}`);
    }
  };

  const handleDuplicateProperty = async (newName: string, selectedSections: string[]) => {
    if (!copyingProp || !auth.currentUser) return;
    
    const maxProperties = userData?.max_properties || 3;
    if (properties.length >= maxProperties) {
      setShowBundleModal(true);
      return;
    }
    
    try {
      const newPropData: any = {
        ownerId: auth.currentUser.uid,
        title: newName,
        isActive: false, 
        status: 'available',
        maxInquiries: 10,
        currentInquiries: 0,
        price: 0,
        priceType: 'fixed',
        location: '',
        features: {},
        images: [],
        teaserImageId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (selectedSections.includes('basic')) {
        newPropData.address = copyingProp.address || '';
        newPropData.city = copyingProp.city || '';
        newPropData.neighborhood = copyingProp.neighborhood || '';
        newPropData.location = copyingProp.location || '';
        if (copyingProp.features?.goal) newPropData.features.goal = copyingProp.features.goal;
        if (copyingProp.features?.type) newPropData.features.type = copyingProp.features.type;
      }

      if (selectedSections.includes('money')) {
        newPropData.price = copyingProp.price || 0;
        newPropData.priceType = copyingProp.priceType || 'fixed';
        if (copyingProp.minPrice !== undefined) newPropData.minPrice = copyingProp.minPrice;
        if (copyingProp.maxPrice !== undefined) newPropData.maxPrice = copyingProp.maxPrice;
        if (copyingProp.priceDescription !== undefined) newPropData.priceDescription = copyingProp.priceDescription;
        
        // Copy money-related features
        if (copyingProp.features?.additional_costs !== undefined) newPropData.features.additional_costs = copyingProp.features.additional_costs;
        if (copyingProp.features?.deposit !== undefined) newPropData.features.deposit = copyingProp.features.deposit;
      }

      if (selectedSections.includes('media')) {
        newPropData.images = copyingProp.images || [];
        newPropData.teaserImageId = copyingProp.teaserImageId || '';
      }

      if (selectedSections.includes('location')) {
        if (copyingProp.displayLat !== undefined) newPropData.displayLat = copyingProp.displayLat;
        if (copyingProp.displayLng !== undefined) newPropData.displayLng = copyingProp.displayLng;
        if (copyingProp.displayRadius !== undefined) newPropData.displayRadius = copyingProp.displayRadius;
      }

      if (selectedSections.includes('personal_text')) {
        const descVal = copyingProp.description || copyingProp.features?.free_text_description || '';
        newPropData.description = descVal;
        newPropData.features.free_text_description = descVal;
      }

      if (selectedSections.includes('privacy')) {
        newPropData.visibility = copyingProp.visibility || {
          basic_info: true,
          location: true,
          price: true,
          features: true,
          rules: true,
          images: true,
          provider_profile: true
        };
      }

      const featureMappings: Record<string, string[]> = {
        entrance: ['entrance_type', 'floor', 'has_elevator', 'elevator', 'wheelchair_accessible'],
        layout: ['bedrooms', 'area_private', 'area_shared', 'furnished', 'sanitary_details', 'kitchen_gear', 'laundry', 'kitchen_type', 'kitchen_utensils', 'total_floors'],
        amenities: ['heating_types', 'parking', 'surroundings', 'domicile', 'wifi', 'balcony', 'garden', 'internet', 'tv', 'streaming_services', 'has_ac', 'ventilation', 'outside_usage', 'parking_types', 'internet_details', 'tv_details', 'pets', 'tenant_pets_allowed', 'landlord_pets'],
        period: ['available_from', 'min_stay', 'max_stay', 'is_indefinite'],
        residents: ['composition_residents'],
        looking_for: ['composition_looking_for', 'looking_for_total_min', 'looking_for_total_max'],
        condition: ['condition_state', 'condition_modifications'],
        tenant_prefs: ['pref_languages', 'pref_garden_maintenance', 'pref_sporty', 'pref_cooking', 'pref_irregular_hours', 'pref_retired', 'pref_tv_english', 'pref_tv_scandi', 'pref_bingewatch', 'pref_board_games', 'pref_quiet_evenings', 'pref_tidy', 'pref_creative', 'pref_political', 'pref_handyman', 'pref_renovation', 'pref_smoking']
      };

      selectedSections.forEach(section => {
        if (featureMappings[section]) {
          featureMappings[section].forEach(key => {
            if (copyingProp.features[key] !== undefined) {
              newPropData.features[key] = copyingProp.features[key];
            }
          });
        }
      });

      newPropData.completion = calculateCompletion(newPropData);

      const docRef = await addDoc(collection(db, 'properties'), newPropData);
      setProperties([{ id: docRef.id, ...newPropData }, ...properties]);
      setCopyingProp(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'properties');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-12 py-8 md:py-12 w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 md:mb-12">
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-3">
             <h2 className="text-3xl md:text-4xl font-display font-black text-on-background leading-tight">{t('dashboard.provider.title')}</h2>
             <span className="px-3 py-1.5 bg-surface-container-high border border-outline/30 text-on-surface text-xs font-black rounded-full shadow-sm">
               {properties.length} / {userData?.max_properties || 3} {t('common.properties', 'woningen')}
             </span>
           </div>
           <TrustBadge 
              level={userData?.verificationLevel || 1} 
              size="md" 
              onClick={() => setShowVerificationModal(true)} 
              className="w-fit"
           />
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {!!(providerProfile && providerProfile.firstName) && (
            <>
              {properties.length > 0 && (
                <button 
                  onClick={() => setShowAvailabilityHub(true)}
                  className="flex-grow md:flex-none bg-surface-container-high text-on-surface px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02] active:scale-95 transition-all outline outline-1 outline-outline"
                >
                  <Calendar size={18} />
                  {t('provider.manage_availability', 'Beschikbaarheid beheren')}
                </button>
              )}
              <button 
                onClick={() => handleAddProperty()}
                className="flex-grow md:flex-none bg-primary text-on-primary px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Plus size={18} />
                {t('dashboard.provider.add_new')}
              </button>
            </>
          )}
        </div>
      </div>

      {totalUnread > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-primary/10 border-2 border-primary/20 rounded-[2rem] flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center relative">
              <MessageSquare size={24} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black">{totalUnread}</div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-on-surface">{t('dash.new_messages_title', 'Nieuwe reacties!')}</h3>
              <p className="text-on-surface-variant font-medium text-sm">{t('dash.new_messages_desc', 'Je hebt {{count}} nieuwe ongelezen bericht(en) van geïnteresseerde zoekers.', { count: totalUnread })}</p>
            </div>
          </div>
          <p className="hidden md:block text-xs font-black uppercase tracking-widest text-primary italic">Bekijk details hieronder</p>
        </motion.div>
      )}

      {!providerProfile || !providerProfile.firstName ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 p-10 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden bg-primary text-on-primary"
        >
          <div className="relative z-10 space-y-4 max-w-2xl text-center md:text-left">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-white/20 w-fit px-3 py-1 rounded-full mx-auto md:mx-0">
              <ShieldCheck size={14} />
              {t('provider.profile_required_badge', 'Step 1: Profile')}
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold leading-tight">
              {t('provider.profile_required_title', 'Complete your profile first')}
            </h2>
            <p className="opacity-90 font-medium text-sm md:text-base">
              {t('provider.profile_required_desc', 'To add a property we need some basic details from you. This helps house seekers know who they are contacting.')}
            </p>
          </div>
          <button 
            onClick={() => {
              setShowProfileModal(true);
            }}
            className="relative z-10 bg-white text-primary px-8 md:px-10 py-4 md:py-5 rounded-2xl font-bold shadow-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all flex-shrink-0 group mx-auto md:mx-0"
          >
            {t('provider.profile_required_btn', 'Fill in profile')}
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-32 -mb-32" />
        </motion.div>
      ) : properties.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-outline shadow-sm mb-12">
          <Home size={64} className="mx-auto text-outline-variant mb-6" />
          <p className="text-on-surface-variant font-medium">{t('dashboard.provider.empty', "You haven't added any properties yet.")}</p>
          <button 
            onClick={() => handleAddProperty()}
            className="mt-6 px-8 py-3 bg-primary text-on-primary rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-primary/20"
          >
            {t('dashboard.provider.add_first', 'Add your first property')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <AnimatePresence>
            {properties.map(prop => {
              const propChats = providerChats.filter(c => c.propertyId === prop.id);
              const totalChats = propChats.length;
              let unreadCount = 0;
              let unreadAudioCount = 0;
              propChats.forEach(chat => {
                const msgs = chat.messages || [];
                const unreadMsgs = msgs.filter((m: any) => m.senderId !== auth.currentUser?.uid && !m.read);
                if (unreadMsgs.length > 0) {
                  unreadCount++; // We still only count 1 per chat
                  if (unreadMsgs.some((m: any) => m.hasAudio)) {
                    unreadAudioCount++;
                  }
                }
              });

              return (
                <PropertyCard 
                  key={`list-${prop.id}`} 
                  prop={prop} 
                  actualInquiries={getActualInquiries(prop.id)}
                  chatStats={{ totalChats, unreadCount, unreadAudioCount }}
                  onEdit={() => setEditingProp(prop)} 
                  onDelete={() => setDeletingPropId(prop.id)} 
                  onCopy={() => {
                    const maxProperties = userData?.max_properties || 3;
                    if (properties.length >= maxProperties) {
                      setShowBundleModal(true);
                      return;
                    }
                    setCopyingProp(prop);
                  }}
                  onChat={() => setChattingProp(prop)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Bottom Section: Expert Hub & Trust Center */}
      {providerProfile && providerProfile.firstName && (
        <div className="mt-16 pt-16 border-t border-outline/30 mb-20 animate-in fade-in slide-in-from-bottom-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 xl:gap-24">
            
            {/* PARTNER NETWORK */}
            <div className="flex flex-col h-full">
              <div className="flex flex-col gap-2 mb-8">
                <h3 className="text-2xl md:text-3xl font-display font-black text-on-background">{t('dashboard.provider.partner_title')}</h3>
                <p className="text-on-surface-variant font-medium">{t('dashboard.provider.partner_desc')}</p>
              </div>
              <div className="max-w-md flex-1">
                <ExpertHub variant="compact" forceShow={true} isProvider={true} country={providerProfile?.country || "Nederland"} />
              </div>
            </div>

            {/* TRUST CENTER */}
            <div className="flex flex-col h-full">
               <div className="flex flex-col gap-2 mb-8">
                 <h3 className="text-2xl md:text-3xl font-display font-black text-on-background flex items-center gap-3">
                   <ShieldCheck className="text-primary w-8 h-8 md:w-10 md:h-10" /> {t('dashboard.provider.trust_center_title')}
                 </h3>
                 <p className="text-on-surface-variant font-medium">{t('dashboard.provider.trust_center_desc')}</p>
               </div>
               <div className="max-w-md w-full bg-surface-container rounded-[2.5rem] p-8 md:p-10 border-2 border-outline/10 shadow-xl shadow-black/5 relative overflow-hidden flex flex-col justify-between" style={{ minHeight: '340px' }}>
                  {/* Background decoration */}
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

                  <div className="relative z-10 mb-8">
                     <h4 className="font-black text-xl mb-2">{t('dashboard.provider.status_title')}</h4>
                     <p className="text-sm text-on-surface-variant font-medium mb-6 leading-relaxed">
                        {t('dashboard.provider.status_desc')}
                     </p>
                     <div className="bg-white/50 p-6 rounded-3xl border border-outline/10 backdrop-blur-sm">
                        <TrustBadge 
                          level={userData?.verificationLevel || 1} 
                          size="lg" 
                          onClick={() => setShowTrustPopup(true)}
                          className="w-full justify-center shadow-sm bg-white" 
                        />
                     </div>
                  </div>
                  
                  <button 
                     onClick={() => setShowVerificationModal(true)}
                     className="w-full py-5 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-3 uppercase tracking-wide cursor-pointer relative z-10"
                  >
                     <ShieldCheck size={24} />
                     {t('dashboard.provider.open_trust_center')}
                  </button>
               </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingPropId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setDeletingPropId(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-outline text-center"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold text-on-background mb-2">{t('dash.delete_title', 'Delete property?')}</h3>
              <p className="text-on-surface-variant mb-8">{t('dash.delete_desc', 'Are you sure you want to delete this property? This cannot be undone.')}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeletingPropId(null)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold border border-outline hover:bg-surface-container-low transition-all"
                >
                  {t('dash.cancel', 'Cancel')}
                </button>
                <button 
                  onClick={handleDeleteProperty}
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-error text-on-error hover:opacity-90 shadow-lg shadow-error/20 transition-all"
                >
                  {t('dash.confirm_delete', 'Delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate Property Modal */}
      <AnimatePresence>
        {copyingProp && (
          <DuplicateModal 
            prop={copyingProp}
            onClose={() => setCopyingProp(null)}
            onConfirm={handleDuplicateProperty}
            properties={properties}
          />
        )}
      </AnimatePresence>

      {/* Provider Chats Modal */}
      <AnimatePresence>
        {chattingProp && (
          <ProviderChatsModal
            property={chattingProp}
            onClose={() => setChattingProp(null)}
          />
        )}
      </AnimatePresence>

      {/* Property Editor Modal */}
      <AnimatePresence>
        {editingProp && (
          <PropertyEditor 
            prop={editingProp} 
            onClose={() => {
              setEditingProp(null);
              fetchProperties();
            }} 
            onDeletePrompt={() => {
              setEditingProp(null);
              setDeletingPropId(editingProp.id);
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Provider Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <ProviderProfileModal 
            onClose={() => setShowProfileModal(false)}
            onSave={handleSaveProfile}
            existingProfile={providerProfile}
            createdAt={auth.currentUser?.metadata.creationTime}
            lastLogin={auth.currentUser?.metadata.lastSignInTime}
            userVerificationLevel={userData?.verificationLevel || 1}
            onOpenVerification={() => setShowVerificationModal(true)}
          />
        )}
      </AnimatePresence>

      <VerificationModal 
        isOpen={showVerificationModal} 
        onClose={() => setShowVerificationModal(false)} 
        userVerificationLevel={userData?.verificationLevel || 1} 
        onVerificationUpdate={(lvl) => setUserData({ ...userData, verificationLevel: Math.max(userData?.verificationLevel || 1, lvl) })} 
        userEmail={auth.currentUser?.email || ''} 
        userName={providerProfile?.firstName ? `${providerProfile.firstName} ${providerProfile.lastName || ''}`.trim() : ''} 
      />

      <TrustPopup 
        isOpen={showTrustPopup} 
        onClose={() => setShowTrustPopup(false)} 
        providerLevel={userData?.verificationLevel || 1} 
      />

      <ReactivationAlert 
        properties={properties}
        onReactivate={handleReactivate}
        onIncreaseLimit={handleIncreaseLimit}
        providerChats={providerChats}
      />

      <PropertyLimitModal 
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
      />

      <PropertyBundleModal 
        isOpen={showBundleModal}
        onClose={() => setShowBundleModal(false)}
        currentLimit={userData?.max_properties || 3}
      />

      <AvailabilityHubModal 
        isOpen={showAvailabilityHub}
        onClose={() => setShowAvailabilityHub(false)}
        properties={properties}
        onPropertiesUpdated={fetchProperties}
      />
    </div>
  );
}

function DuplicateModal({ prop, onClose, onConfirm, properties }: { 
  prop: Property, 
  onClose: () => void, 
  onConfirm: (name: string, sections: string[]) => void,
  properties: Property[]
}) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState(`${prop.title} (Copy)`);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);
  
  const sections = [
    { id: 'basic', label: t('dash.section_basic', 'Basisgegevens (Adres, Stad)') },
    { id: 'money', label: t('dash.section_money', 'Huur & Prijs') },
    { id: 'media', label: t('dash.section_media', 'Foto\'s') },
    { id: 'location', label: t('dash.section_location', 'Locatie op kaart') },
    { id: 'entrance', label: t('dash.section_entrance', 'Toegang & Verdieping') },
    { id: 'layout', label: t('dash.section_layout', 'Indeling & Oppervlakte') },
    { id: 'amenities', label: t('dash.section_amenities', 'Voorzieningen') },
    { id: 'period', label: t('dash.section_period', 'Beschikbaarheid') },
    { id: 'residents', label: t('dash.section_residents', 'Huidige bewoners') },
    { id: 'looking_for', label: t('dash.section_looking_for', 'Profiel gewenste huurder') },
    { id: 'condition', label: t('dash.section_condition', 'Staat & Aanpassingen') },
    { id: 'tenant_prefs', label: t('dash.section_tenant_prefs', 'Huurdersvoorkeuren') },
    { id: 'personal_text', label: t('dash.section_personal_text', 'Persoonlijke tekst') },
    { id: 'privacy', label: t('dash.section_privacy', 'Privacy & Zichtbaarheid') },
  ];

  const [selectedSections, setSelectedSections] = useState<string[]>(sections.map(s => s.id));

  const handleToggleSection = (id: string) => {
    setSelectedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (selectedSections.length === sections.length) {
      setSelectedSections([]);
    } else {
      setSelectedSections(sections.map(s => s.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const isNameTaken = properties.some(p => p.title.toLowerCase() === newName.trim().toLowerCase());
    if (isNameTaken) {
      setError(t('dash.copy_error_name'));
      return;
    }

    onConfirm(newName.trim(), selectedSections);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-outline"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-sm">
               <Copy size={20} />
             </div>
             <h3 className="text-2xl font-display font-bold text-on-background">{t('dash.copy_property')}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('dash.copy_name')}</label>
            <input 
              type="text"
              autoFocus
              value={newName}
              onChange={e => { setNewName(e.target.value); setError(''); }}
              className={`w-full bg-surface-container-low border ${error ? 'border-error' : 'border-outline'} rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold text-lg`}
              placeholder="E.g.: New Property Name"
            />
            {error && <p className="text-error text-xs font-bold pl-1">{error}</p>}
          </div>

          <div className="space-y-3">
             <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('dash.copy_sections')}</label>
                <button 
                  type="button"
                  onClick={handleToggleAll}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {t('dash.copy_select_all')}
                </button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2 border border-outline/30 rounded-2xl bg-surface-container-low shadow-inner">
               {sections.map(section => (
                 <label 
                   key={section.id} 
                   className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                     selectedSections.includes(section.id) 
                       ? 'bg-white border-primary/30 shadow-sm' 
                       : 'bg-transparent border-transparent text-on-surface-variant'
                   }`}
                 >
                   <input 
                     type="checkbox"
                     checked={selectedSections.includes(section.id)}
                     onChange={() => handleToggleSection(section.id)}
                     className="w-5 h-5 accent-primary rounded-md"
                   />
                   <span className="text-xs font-bold">{section.label}</span>
                 </label>
               ))}
             </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl font-bold border border-outline hover:bg-surface-container-low transition-colors"
            >
              {t('dash.copy_cancel')}
            </button>
            <button 
              type="submit"
              disabled={!newName.trim() || selectedSections.length === 0}
              className="flex-1 px-6 py-4 rounded-2xl font-bold bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {t('dash.copy_confirm')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

const PropertyCard: React.FC<{ 
  prop: Property, 
  actualInquiries?: number,
  chatStats?: { totalChats: number, unreadCount: number, unreadAudioCount?: number },
  onEdit: () => void, 
  onDelete: () => void,
  onCopy: () => void,
  onChat: () => void
}> = ({ prop, actualInquiries, chatStats, onEdit, onDelete, onCopy, onChat }) => {
  const { t } = useTranslation();
  const { dateFormat } = useSettings();
  const currencyConverter = useCurrencyConverter();
  
  // Native calculations for Monday date representations
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
  const upcomingWeekId = getWeekId(1);

  const formatWeekDisplay = (weekIdStr: string) => {
    const [year, month, day] = weekIdStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('nl', { day: 'numeric', month: 'short' });
  };

  const teaserImage = prop.images?.find(img => img.id === prop.teaserImageId) || prop.images?.[0];

  const startDate = prop.createdAt?.toDate ? formatDate(prop.createdAt.toDate(), dateFormat) : t('common.not_applicable', 'N.v.t.');

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-[2rem] border border-outline shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300 flex flex-col h-full min-h-[520px]"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-container-low transition-all duration-500">
        {(teaserImage && teaserImage.url) ? (
          <img src={teaserImage.url} alt={prop.title} className="w-full h-full object-contain bg-black/5 transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-outline-variant">
            <ImageIcon size={48} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        
        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md flex items-center gap-1.5 ${
            prop.isActive 
              ? 'bg-success/90 text-white' 
              : 'bg-surface-container-highest/90 text-on-surface'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${prop.isActive ? 'bg-white animate-pulse' : 'bg-on-surface/50'}`} />
            {prop.isActive ? t('dash.status_active') : t('dash.status_inactive')}
          </div>

          {prop.highlightWeeks?.includes(activeWeekId) && (
            <div className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 w-max">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>In Digest: deze week ({formatWeekDisplay(activeWeekId)})</span>
            </div>
          )}

          {prop.highlightWeeks?.includes(upcomingWeekId) && (
            <div className="px-3 py-1 bg-orange-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 w-max">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>In Digest: volgende week ({formatWeekDisplay(upcomingWeekId)})</span>
            </div>
          )}
        </div>

      <div className="absolute top-4 right-4 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
        <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="p-2 bg-white/90 backdrop-blur-sm text-primary rounded-lg shadow-lg hover:bg-white transition-all">
          <Copy size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 bg-white/90 backdrop-blur-sm text-primary rounded-lg shadow-lg hover:bg-white transition-all">
          <Edit2 size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-white/90 backdrop-blur-sm text-error rounded-lg shadow-lg hover:bg-white transition-all">
          < Trash2 size={16} />
        </button>
      </div>

      {prop.status === 'paused' && (
        <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 md:w-32 md:h-32 pointer-events-none z-10">
          <div className="absolute top-4 -right-12 md:top-6 md:-right-10 bg-orange-500 text-white py-1 md:py-1.5 w-[140px] md:w-[160px] text-center transform rotate-45 shadow-lg flex flex-col items-center justify-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest leading-none">{t('dash.pause', 'Pauze')}</span>
            <span className="text-[6px] md:text-[7px] font-medium leading-none opacity-90 mt-0.5 whitespace-nowrap">{t('dash.pause_desc', 'Kom later terug')}</span>
          </div>
        </div>
      )}
    </div>
      <div className="p-5 md:p-8 flex-grow flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl md:text-2xl font-display font-black text-on-background line-clamp-2">{prop.title}</h3>
          {prop.features?.goal && (
             <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-secondary/10 text-secondary rounded-lg w-fit mt-1">
               {t(`prop.goal.${prop.features.goal}`)}
             </span>
          )}
        </div>
        
        <p className="text-on-surface-variant text-xs md:text-sm flex items-center gap-2">
          <MapPin size={16} className="text-primary shrink-0" />
          <span className="truncate font-medium">{prop.city ? `${prop.city}${prop.neighborhood ? `, ${prop.neighborhood}` : ''}` : (prop.location || 'Locatie niet opgegeven')}</span>
        </p>

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-2.5 text-sm font-bold text-on-surface-variant">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Euro size={16} />
          </div>
          <span>{prop.priceType === 'tbd' ? t('prop.money.tbd', 'Nader te bepalen') : currencyConverter.formatEur(prop.price)}/mnd</span>
        </div>
        
        {prop.features?.goal === 'vakantie_onderhuur' && prop.monthlyAvailability ? (
          <div className="flex items-center gap-2.5 text-sm font-bold text-on-surface-variant">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Calendar size={16} />
            </div>
            <span>{t('prop.availability.diverse_months', 'Diverse maanden')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-sm font-bold text-on-surface-variant">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Layout size={16} />
            </div>
            <span>{t('dash.start_date')}: {startDate}</span>
          </div>
        )}

        <div className="flex items-center gap-2.5 text-sm font-bold text-on-surface-variant">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <MessageSquare size={16} />
          </div>
          <span>{Math.max(prop.currentInquiries || 0, actualInquiries || 0)} / {prop.maxInquiries || 10} {t('dash.responses', 'reacties')}</span>
        </div>
      </div>

      {prop.features?.free_text_description && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }} 
            className="group/book flex items-center gap-3 p-3 bg-primary/5 hover:bg-primary/10 rounded-2xl transition-all cursor-pointer border border-primary/20 hover:border-primary/40 w-full"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover/book:scale-110 transition-transform">
              <FileText size={18} />
            </div>
            <div className="text-left flex-grow overflow-hidden">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary">{t('dash.section_personal_text_short', 'Persoonlijke Tekst')}</div>
              <div className="text-xs text-on-surface-variant line-clamp-1 font-medium italic">{prop.features.free_text_description}</div>
            </div>
            <ChevronRight size={16} className="text-primary/50 group-hover/book:text-primary transition-colors" />
          </button>
        </div>
      )}
    </div>
    <div className="px-5 md:px-8 py-3 md:py-4 flex justify-between items-center mt-auto border-t border-outline/30 bg-surface">
      {chatStats && chatStats.totalChats > 0 ? (
        <button 
          onClick={onChat}
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl transition-all font-bold group/chat text-xs md:text-sm ${chatStats.unreadCount > 0 ? 'bg-primary text-on-primary hover:bg-primary/90 shadow-md' : 'bg-primary/10 hover:bg-primary/20 text-primary'}`}
          >
            <div className="relative">
              <MessageSquare size={18} />
              {chatStats.unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full animate-pulse border border-white" />
              )}
            </div>
            {chatStats.unreadAudioCount !== undefined && chatStats.unreadAudioCount > 0 && (
              <div className="flex items-center justify-center w-5 h-5 bg-white text-primary rounded-full shadow-sm ml-1">
                <Mic size={12} className="animate-pulse" />
              </div>
            )}
            <span>{chatStats.totalChats} {chatStats.totalChats === 1 ? t('dash.candidate', 'Kandidaat') : t('dash.candidates', 'Kandidaten')}</span>
          </button>
        ) : (
          <div className="text-xs text-on-surface-variant/50 font-bold flex items-center gap-2">
            <MessageSquare size={16} />
            {t('dash.no_chats', 'Geen chats')}
          </div>
        )}

        <button onClick={onEdit} className="text-primary font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all ml-auto">
          {t('dash.details', 'Details')}
          <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function MapUpdater({ center, zoom = 13 }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.5,
      easeLinearity: 0.25
    });
  }, [center, map, zoom]);
  return null;
}

function PropertyPreview({ prop, onClose }: { prop: Partial<Property>, onClose: () => void }) {
  const { t } = useTranslation();
  const currencyConverter = useCurrencyConverter();
  const teaserImage = prop.images?.find(img => img.id === prop.teaserImageId) || prop.images?.[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-outline"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 text-on-surface rounded-full flex items-center justify-center hover:bg-white transition-all shadow-lg"
        >
          <X size={20} />
        </button>

        <div className="relative h-48 bg-surface-container-low">
          {(teaserImage && teaserImage.url) ? (
            <img 
              src={teaserImage.url} 
              alt={prop.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-outline-variant gap-2">
              <ImageIcon size={32} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t('prop.preview.no_photo')}</span>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg">
            {currencyConverter.formatEur(prop.price)}{prop.priceType === 'range' ? '+' : ''} / mnd
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <h3 className="text-xl font-display font-black text-on-surface leading-tight mb-1">{prop.title || t('prop.preview.title')}</h3>
            <p className="text-xs font-bold text-on-surface-variant flex items-center gap-1 uppercase tracking-tight">
               <MapPin size={12} className="text-primary" />
               {prop.city || 'Locatie onbekend'}
            </p>
          </div>

          <div className="flex gap-4 border-y border-outline/30 py-4 justify-around">
            <div className="flex flex-col items-center gap-1">
              <Square className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-tighter">{prop.features?.area_private || 0} m²</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Bed className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-tighter">{prop.features?.bedrooms || 0} slpkr</span>
            </div>
          </div>
          
          <div className="pt-2 flex items-center justify-between">
             <div className="flex flex-col">
               <span className="text-[10px] uppercase font-black tracking-widest text-primary mb-0.5">Status</span>
               <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${prop.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                 <span className="text-xs font-bold text-on-surface">{prop.isActive ? t('prop.preview.available', { defaultValue: 'Nu beschikbaar' }) : t('prop.preview.offline', { defaultValue: 'Tijdelijk offline' })}</span>
               </div>
             </div>
             <button className="bg-primary text-on-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">
               {t('prop.preview.view', { defaultValue: 'Bekijken' })}
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ImageCropperModal({ 
  src, 
  onComplete, 
  onCancel 
}: { 
  src: string, 
  onComplete: (croppedDataUrl: string) => void, 
  onCancel: () => void 
}) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<Crop>();
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(1.5); // Default to 3:2

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        aspect || 1,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
    setImgRef(e.currentTarget);
  };

  useEffect(() => {
    if (imgRef) {
      const { width, height } = imgRef;
      const initialCrop = centerCrop(
        makeAspectCrop(
          { unit: '%', width: 90 },
          aspect || 1,
          width,
          height
        ),
        width,
        height
      );
      setCrop(initialCrop);
    }
  }, [aspect]);

  const getCroppedImg = () => {
    if (!imgRef || !crop) return;
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.naturalWidth / imgRef.width;
    const scaleY = imgRef.naturalHeight / imgRef.height;
    
    let pixelX, pixelY, pixelWidth, pixelHeight;
    if (crop.unit === '%') {
      pixelX = (crop.x / 100) * imgRef.naturalWidth;
      pixelY = (crop.y / 100) * imgRef.naturalHeight;
      pixelWidth = (crop.width / 100) * imgRef.naturalWidth;
      pixelHeight = (crop.height / 100) * imgRef.naturalHeight;
    } else {
      pixelX = crop.x * scaleX;
      pixelY = crop.y * scaleY;
      pixelWidth = crop.width * scaleX;
      pixelHeight = crop.height * scaleY;
    }

    canvas.width = Math.max(1, pixelWidth);
    canvas.height = Math.max(1, pixelHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      imgRef,
      pixelX,
      pixelY,
      pixelWidth,
      pixelHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    onComplete(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] overflow-hidden max-w-3xl w-full shadow-2xl">
        <div className="p-8 border-b border-outline flex justify-between items-center">
          <div>
             <h3 className="text-xl font-display font-black uppercase tracking-tight">{t('prop.editor.edit_photo', 'Foto bewerken')}</h3>
             <p className="text-xs text-on-surface-variant font-medium mt-1">{t('prop.editor.edit_photo_desc', 'Versleep het kader om de foto bij te snijden')}</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-surface-container rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="px-8 py-4 bg-surface-container-low flex gap-4 overflow-x-auto border-b border-outline">
           {[
             { label: t('common.aspect_3_2', '3:2 (Standard)'), val: 1.5 },
             { label: '4:3', val: 4/3 },
             { label: t('common.aspect_1_1', '1:1 (Square)'), val: 1 },
             { label: t('common.aspect_16_9', '16:9 (Wide)'), val: 16/9 },
             { label: t('common.aspect_free', 'Free'), val: undefined }
           ].map(opt => (
             <button 
               key={opt.label}
               onClick={() => setAspect(opt.val)}
               className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${aspect === opt.val ? 'bg-primary text-on-primary border-primary shadow-md' : 'bg-white border-outline hover:border-primary/50 text-on-surface-variant'}`}
             >
               {opt.label}
             </button>
           ))}
        </div>

        <div className="p-4 md:p-8 flex justify-center bg-surface-container-lowest custom-scrollbar" style={{ maxHeight: '60vh' }}>
          <ReactCrop 
            crop={crop} 
            onChange={c => setCrop(c)} 
            aspect={aspect}
            keepSelection
            className="flex items-center justify-center max-h-full"
          >
            <img 
              src={src} 
              onLoad={onImageLoad} 
              style={{ maxHeight: 'calc(60vh - 4rem)' }}
              className="max-w-full object-contain rounded-xl" 
              alt="Crop target" 
            />
          </ReactCrop>
        </div>
        <div className="p-8 border-t border-outline flex justify-end gap-4 bg-white">
          <button 
            onClick={onCancel}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Annuleren
          </button>
          <button 
            onClick={getCroppedImg}
            className="px-10 py-3 bg-primary text-on-primary rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

const compressImage = (base64: string, maxWidth = 1200, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
  });
};

const StarRating = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`p-1.5 transition-all ${star <= value ? 'text-amber-400 scale-110 drop-shadow-sm' : 'text-outline hover:text-amber-300 hover:text-amber-200 hover:scale-105'}`}
        >
          <Star size={28} className={star <= value ? "fill-amber-400" : ""} />
        </button>
      ))}
    </div>
  )
};

function AdminProviderInfo({ prop }: { prop: any }) {
  const { t } = useTranslation();
  const [ownerData, setOwnerData] = useState<any>(null);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOwnerAndVerification = async () => {
      if (!prop.ownerId) {
        setLoading(false);
        return;
      }
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const ownerSnap = await getDoc(doc(db, 'users', prop.ownerId));
        if (ownerSnap.exists()) {
          setOwnerData(ownerSnap.data());
        }

        // Fetch private verification data
        const verificationSnap = await getDoc(doc(db, 'users', prop.ownerId, 'settings', 'verification'));
        if (verificationSnap.exists()) {
          setVerificationData(verificationSnap.data());
        }
      } catch (e) {
        console.error('Failed to fetch admin details:', e);
      }
      setLoading(false);
    };
    fetchOwnerAndVerification();
  }, [prop.ownerId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline shadow-sm">
          <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4">{t('admin.provider_info', 'Aanbieder Informatie')}</h4>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-outline/10 rounded-xl w-full"></div>
            </div>
          ) : ownerData ? (
            <div className="flex items-center gap-4">
              <img src={ownerData.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-primary/20 shadow-sm" />
              <div>
                <p className="font-bold text-on-surface">{ownerData.displayName}</p>
                <div className="flex items-center gap-2">
                  <a 
                    href={`mailto:${ownerData.email}`}
                    className="text-xs text-primary hover:underline font-medium flex items-center gap-1.5"
                  >
                    <Mail size={14} className="text-primary/70" />
                    {ownerData.email}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs font-bold text-error">Geen eigenaar data gevonden</p>
          )}
        </div>

        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline shadow-sm">
          <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Trust & LinkedIn Check</h4>
          {loading ? (
             <div className="animate-pulse h-10 bg-outline/10 rounded-xl w-full"></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Huidig Niveau</span>
                <TrustBadge level={ownerData?.verificationLevel || 1} size="sm" />
              </div>
              
              {verificationData?.linkedinUrl ? (
                <div className="pt-2 border-t border-outline/10 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Gekoppeld LinkedIn Account</p>
                  <a 
                    href={verificationData.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-2 break-all"
                  >
                    <Linkedin size={16} />
                    {verificationData.linkedinUrl}
                  </a>
                  {verificationData.level2?.aiResult && (
                    <div className="mt-2 p-3 bg-white/50 rounded-xl text-[11px] border border-outline/5">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold">AI Score: {verificationData.level2.aiResult.score}/100</span>
                        <span className={`font-black uppercase ${verificationData.level2.aiResult.status === 'APPROVED' ? 'text-success' : 'text-error'}`}>
                          {verificationData.level2.aiResult.status}
                        </span>
                      </div>
                      <p className="text-on-surface-variant italic leading-tight">"{verificationData.level2.aiResult.reason}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">Nog geen LinkedIn gekoppeld.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PropertyEditor({ prop, onClose, onDeletePrompt, isAdmin }: { prop: Property, onClose: () => void, onDeletePrompt?: () => void, isAdmin?: boolean }) {
  const { t } = useTranslation();
  const { dateFormat, timeFormat } = useSettings();
  const currencyConverter = useCurrencyConverter();
  const [formData, setFormData] = useState(prop);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full relative">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                    <ShieldAlert size={32} />
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-2">{t('messages.mobile_not_available_title', 'Alleen op desktop')}</h3>
                <p className="text-on-surface-variant">
                    {t('messages.not_available_on_mobile', 'Het maken en onderhouden van woningen is nog niet beschikbaar op mobiele telefoons. Gebruik een desktop voor deze actie.')}
                </p>
            </div>
        </div>
    );
  }

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([52.3676, 4.9041]);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [lastGeocodedLocation, setLastGeocodedLocation] = useState(`${prop.city || ''}|${prop.address || ''}`);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [selectedExample, setSelectedExample] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basis');
  const [editorMode, setEditorMode] = useState<'selector' | 'short' | 'free_text' | 'full' | 'visibility' | 'admin_info'>('selector');
  const [showToast, setShowToast] = useState(false);
  const [visibilitySettings, setVisibilitySettings] = useState<Record<string, boolean>>(
    prop.features.visibility || { tenant_prefs: false }
  );
  const [citySearch, setCitySearch] = useState(prop.city || '');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<{name: string, lat: number, lng: number}[]>([]);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [showPIIConfirmation, setShowPIIConfirmation] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollContent, setCanScrollContent] = useState(false);
  const [canScrollSidebar, setCanScrollSidebar] = useState(false);
  const contentScrollRef = React.useRef<HTMLDivElement>(null);
  const sidebarScrollRef = React.useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const hasMore = el.scrollHeight > el.clientHeight + el.scrollTop + 20;
      setCanScrollMore(hasMore);
    }
  };

  const checkContentScroll = () => {
    const el = contentScrollRef.current;
    if (el) {
      const hasMore = el.scrollHeight > el.clientHeight + el.scrollTop + 20;
      setCanScrollContent(hasMore);
    }
  };

  const checkSidebarScroll = () => {
    const el = sidebarScrollRef.current;
    if (el) {
      const hasMore = el.scrollHeight > el.clientHeight + el.scrollTop + 20;
      setCanScrollSidebar(hasMore);
    }
  };

  useEffect(() => {
    if (editorMode === 'selector') {
      checkScroll();
      window.addEventListener('resize', checkScroll);
      return () => window.removeEventListener('resize', checkScroll);
    }
  }, [editorMode]);

  useEffect(() => {
    if (editorMode === 'full' || editorMode === 'short') {
      checkContentScroll();
      checkSidebarScroll();
      window.addEventListener('resize', checkContentScroll);
      window.addEventListener('resize', checkSidebarScroll);
      return () => {
        window.removeEventListener('resize', checkContentScroll);
        window.removeEventListener('resize', checkSidebarScroll);
      };
    }
  }, [editorMode, activeTab]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (citySearch.length > 2 && showCitySuggestions) {
        setIsSearchingCities(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(citySearch)}&addressdetails=1&limit=5&featuretype=city`);
          const data = await response.json();
          const suggestions = data.map((item: any) => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          }));
          setCitySuggestions(suggestions);
        } catch (error) {
          console.error('Error fetching cities:', error);
        } finally {
          setIsSearchingCities(false);
        }
      } else {
        setCitySuggestions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [citySearch, showCitySuggestions]);

  useEffect(() => {
    // Location is already handled via city search selection
    if (formData.city) {
      setLastGeocodedLocation(`${formData.city.toLowerCase()}|${(formData.address || '').toLowerCase()}`);
    }
  }, [formData.city, formData.address]);

  useEffect(() => {
    if (formData.displayLat && formData.displayLng) {
      setMapCenter([formData.displayLat, formData.displayLng]);
    }
  }, [formData.displayLat, formData.displayLng]);

  const shiftLocation = (latDir: number, lngDir: number) => {
    const step = 0.001; // ~100m
    setFormData(prev => ({
      ...prev,
      displayLat: (prev.displayLat || mapCenter[0]) + (latDir * step),
      displayLng: (prev.displayLng || mapCenter[1]) + (lngDir * step)
    }));
  };

  const updateRadius = (delta: number) => {
    setFormData(prev => ({
      ...prev,
      displayRadius: Math.max(200, (prev.displayRadius || 500) + delta)
    }));
  };

  const allCategories = [
    { id: 'basis', icon: Home, label: t('prop.category.basis', 'Basis') },
    { id: 'address', icon: Lock, label: t('prop.category.address', 'Address & Map') },
    { id: 'media_files', icon: ImageIcon, label: t('prop.category.media_files', 'Photos') },
    { id: 'period', icon: MapIcon, label: t('prop.category.period', 'Period') },
    { id: 'availability', icon: Calendar, label: t('prop.category.availability', 'Beschikbaarheid') },
    { id: 'money', icon: Euro, label: t('prop.category.money', 'Price & Costs') },
    { id: 'tenant_prefs', icon: Star, label: t('prop.category.tenant_prefs', 'Matching & Profiles') },
    { id: 'composition', icon: Users, label: t('prop.category.composition', 'Resident Mix') },
    { id: 'layout', icon: Layout, label: t('prop.category.layout', 'Layout') },
    { id: 'vacation_specs', icon: Layers, label: t('prop.category.vacation_specs', 'Vakantiegegevens') },
    { id: 'entrance', icon: DoorOpen, label: t('prop.category.entrance', 'Entrance') },
    { id: 'kitchen', icon: ChefHat, label: t('prop.category.kitchen', 'Kitchen') },
    { id: 'laundry', icon: Wind, label: t('prop.category.laundry', 'Laundry') },
    { id: 'climate', icon: Thermometer, label: t('prop.category.climate', 'Climate') },
    { id: 'media', icon: Wifi, label: t('prop.category.media', 'Media & Tech') },
    { id: 'outside', icon: TreePine, label: t('prop.category.outside', 'Outdoor space') },
    { id: 'safety', icon: ShieldCheck, label: t('prop.category.safety', 'Safety') },
    { id: 'parking', icon: Car, label: t('prop.category.parking', 'Parking') },
    { id: 'pets', icon: Dog, label: t('prop.category.pets', 'Pets') },
    { id: 'surroundings', icon: MapPin, label: t('prop.category.surroundings', 'Surroundings') },
    { id: 'condition', icon: Paintbrush, label: t('prop.category.condition', 'Condition') },
    { id: 'extra', icon: Star, label: t('prop.category.extra', 'Extra') }
  ];

  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const categories = (() => {
    let list = allCategories;
    
    if (formData.features?.goal !== 'vakantie_onderhuur') {
      list = list.filter(c => c.id !== 'vacation_specs');
    }
    
    if (editorMode === 'short') {
      // Explicitly pick the sections for Quick Start
      const shortIds = ['basis', 'address', 'media_files', 'money'];
      if (formData.features?.goal === 'vakantie_onderhuur') {
        shortIds.push('availability');
      } else {
        shortIds.push('period');
      }
      list = allCategories.filter(c => shortIds.includes(c.id));
      // Sort them to match the typical flow
      const order = ['basis', 'address', 'media_files', 'period', 'availability', 'money'];
      list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    } else {
      if (formData.features?.goal === 'vakantie_onderhuur') {
        list = list.filter(c => c.id !== 'period');
      } else {
        list = list.filter(c => c.id !== 'availability');
      }
    }
    return list;
  })();

  const calculateCompletion = (data: any): number => {
    const checks = [
      () => !!(data.title && data.title !== 'Nieuwe Woning'),
      () => !!((data.description && data.description.trim().length > 0) || (data.features?.free_text_description && data.features.free_text_description.trim().length > 0)),
      () => !!(data.features?.goal),
      () => !!(data.features?.type),
      () => !!data.city,
      () => !!(data.images && data.images.length > 0),
      () => {
        const pt = data.priceType || 'fixed';
        if (pt === 'tbd') return true;
        if (pt === 'range' && data.minPrice > 0 && data.maxPrice > 0) return true;
        if (pt === 'fixed' && data.price > 0) return true;
        return false;
      }
    ];

    let filled = 0;
    checks.forEach(c => { if (c()) filled++; });

    return Math.round((filled / checks.length) * 100);
  };

  const getShortCompletion = (data: any): number => {
    const f = data.features || {};
    const checks = [
      () => !!(data.title && data.title !== 'Nieuwe Woning'), // naam
      () => !!((data.description && data.description.trim().length > 0) || (f.free_text_description && f.free_text_description.trim().length > 0)), // perssonlijke tekst
      () => !!f.goal, // doel
      () => !!f.type, // type
      () => !!data.city, // stad
      () => !!(data.images && data.images.length > 0), // minimaal 1 foto
      () => { // bedrag
        const pt = data.priceType || 'fixed';
        if (pt === 'tbd') return true;
        if (pt === 'range' && data.minPrice > 0 && data.maxPrice > 0) return true;
        if (pt === 'fixed' && data.price > 0) return true;
        return false;
      }
    ];

    let filled = 0;
    checks.forEach(c => { if (c()) filled++; });
    return Math.round((filled / checks.length) * 100);
  };

  const sanitizeText = (text: string) => {
    // Sanitize input: remove script tags and weird characters, keep basic punctuation
    return text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
               .replace(/[^\w\s.,?!-]/gi, (c) => {
                 // Allow common accented characters for Dutch/French etc. if needed, 
                 // but for now stick to basics + common ones.
                 if (/[à-ÿÀ-ß]/.test(c)) return c;
                 return '';
               }).trim();
  };

  const handleUpdate = async (stayOnPage = false, isStatusChange = false) => {
    setSaving(true);
    try {
      // Validation Logic
      if (!formData.title || formData.title.trim().length === 0) {
        alert(t('prop.editor.alert_title_required', 'Vul een naam in voor de woning.'));
        setSaving(false);
        return;
      }
      
      const currentShortCompletion = getShortCompletion(formData);
      
      // If trying to activate but short completion is not 100%
      if (formData.isActive && currentShortCompletion < 100) {
        alert(t('prop.editor.alert_short_incomplete', 'Je kunt de woning pas activeren als de Snelle Start 100% voltooid is.'));
        setSaving(false);
        return;
      }

      if (!formData.title || formData.title.trim().length < 2) {
        alert(t('prop.editor.alert_title_too_short', 'The property name is required (minimum 2 characters).'));
        setSaving(false);
        return;
      }
      
      const numFields = [
        { val: formData.price, label: t('prop.money.monthly_amount', 'Maandelijkse huur'), min: 0 },
        { val: formData.features.area_private, label: t('prop.layout.area_private', 'Oppervlakte kamer'), min: 1 },
        { val: formData.features.area_shared, label: t('prop.layout.area_shared', 'Oppervlakte gedeeld'), min: 0 },
        { val: formData.features.bedrooms, label: t('prop.layout.bedrooms', 'Slaapkamers'), min: 0 },
        { val: formData.features.residents, label: t('prop.composition.residents', 'Bewoners'), min: 1 },
        { val: formData.features.total_floors, label: t('prop.layout.floors', 'Verdiepingen'), min: 1 },
        { val: formData.features.floor, label: t('prop.entrance.floor', 'Verdieping'), min: 0 },
      ];

        if (formData.features.goal === 'huisbewaring_expat') {
          if (!formData.features.min_stay || formData.features.min_stay <= 0) {
            alert(t('prop.editor.alert_min_stay_required', 'Minimale huurperiode is verplicht voor vakantie/onderverhuur en huisbewaring.'));
            setSaving(false);
            return;
          }
          if (!formData.features.max_stay || formData.features.max_stay <= 0) {
            alert(t('prop.editor.alert_max_stay_required', 'Maximale huurperiode is verplicht voor vakantie/onderverhuur en huisbewaring.'));
            setSaving(false);
            return;
          }
        }

        // Availability tab handling for vakantie_onderhuur
        let updatedFormData = { ...formData };
        if (formData.features.goal === 'vakantie_onderhuur') {
          const hasAvailability = formData.monthlyAvailability && Object.values(formData.monthlyAvailability).some(v => (v === 'free' || v === 'available' || v === 'consultation'));
          if (!hasAvailability && formData.isActive) {
            updatedFormData.isActive = false; // Auto pause
            alert(t('prop.editor.auto_paused', 'Woning heeft geen beschikbare maanden en is automatisch gepauzeerd.'));
          }
        }

      for (const field of numFields) {
        if (field.val !== undefined && field.val < field.min) {
          throw new Error(t('prop.editor.field_too_low', `${field.label} cannot be less than ${field.min}.`, { field: field.label, min: field.min }));
        }
      }

      const completion = calculateCompletion(updatedFormData);
      const updateData = {
        ...updatedFormData,
        features: {
          ...updatedFormData.features,
          visibility: visibilitySettings
        },
        title: sanitizeText(updatedFormData.title),
        address: updatedFormData.address ? sanitizeText(updatedFormData.address) : '',
        city: updatedFormData.city ? sanitizeText(updatedFormData.city) : '',
        neighborhood: updatedFormData.neighborhood ? sanitizeText(updatedFormData.neighborhood) : '',
        completion,
        updatedAt: serverTimestamp()
      };
      
      const id = updateData.id;
      // @ts-ignore
      delete updateData.id;

      // Check payload size (Firestore limit is 1MB)
      const size = new Blob([JSON.stringify(updateData)]).size;
      if (size > 900000) {
        throw new Error(t('prop.editor.payload_too_big', 'The advertisement has become too large (probably due to large photos). Remove some photos or use smaller files.'));
      }
      
      await updateDoc(doc(db, 'properties', id), updateData);
      
      if (isStatusChange) {
        toast.success(t('prop.editor.status_saved', 'Status saved'));
      } else {
        toast.success(t('prop.editor.saved', 'Saved'));
      }
      
      if (!stayOnPage) {
        if (editorMode !== 'selector') {
          setEditorMode('selector');
        } else {
          onClose();
        }
      }
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('too large')) {
        alert(error.message);
      } else if (error.code === 'permission-denied' || error.name === 'FirebaseError') {
        handleFirestoreError(error, OperationType.UPDATE, `properties/${prop.id}`);
      } else {
        // Local error or other
        console.error('Update error:', error);
        alert(error.rawError?.message || error.message || t('common.error_occurred', 'An error occurred while saving.'));
      }
    }
    setSaving(false);
  };

  const updateFeature = (key: string, value: any) => {
    setFormData({
      ...formData,
      features: { ...formData.features, [key]: value }
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const currentCount = (formData.images || []).length;
    const remainingCount = 15 - currentCount;
    if (remainingCount <= 0) {
      toast.error(t('prop.editor.upload_limit', 'Maximum aantal foto\'s bereikt'));
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingCount);
    
    // If only one file and not already uploading, we can keep the crop flow
    if (filesToProcess.length === 1 && !uploading) {
        const file = filesToProcess[0];
        if (!file.type.startsWith('image/')) {
            toast.error(t('prop.editor.select_valid_image'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => setCroppingImage(e.target?.result as string);
        reader.readAsDataURL(file);
    } else {
        // Multiple files or manual drop: process them directly
        setUploading(true);
        for (const file of filesToProcess) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const reader = new FileReader();
                const dataUrl = await new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
                
                const compressedUrl = await compressImage(dataUrl, 1200, 0.7);
                const imageId = Math.random().toString(36).substr(2, 9);
                const storageRef = ref(storage, `properties/${prop.id}/${imageId}.jpg`);
                await uploadString(storageRef, compressedUrl, 'data_url');
                const downloadUrl = await getDownloadURL(storageRef);
                
                const newImage: PropertyImage = {
                    id: imageId,
                    url: downloadUrl,
                    category: 'living',
                    description: ''
                };
                
                setFormData(prev => ({
                    ...prev,
                    images: [...(prev.images || []), newImage],
                    teaserImageId: prev.teaserImageId || newImage.id
                }));
            } catch (err) {
                console.error("Upload error:", err);
            }
        }
        setUploading(false);
    }
  };

  const handleAddImage = () => {
    if ((formData.images || []).length >= 5) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: any) => handleFiles(e.target.files);
    input.click();
  };

  const onCropComplete = async (croppedUrl: string) => {
    setUploading(true);
    try {
      const compressedUrl = await compressImage(croppedUrl, 1200, 0.7);
      
      const imageId = editingImageId || Math.random().toString(36).substr(2, 9);
      const storageRef = ref(storage, `properties/${prop.id}/${imageId}.jpg`);
      
      // Upload to Firebase Storage
      await uploadString(storageRef, compressedUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      
      if (editingImageId) {
        const images = (formData.images || []).map(img => 
          img.id === editingImageId ? { ...img, url: downloadUrl } : img
        );
        setFormData({ ...formData, images });
      } else {
        const newImage: PropertyImage = {
          id: imageId,
          url: downloadUrl,
          category: 'interior',
          description: ''
        };
        const images = [...(formData.images || []), newImage];
        setFormData({ 
          ...formData, 
          images,
          teaserImageId: formData.teaserImageId || newImage.id
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Er is een fout opgetreden bij het uploaden van de afbeelding.');
    } finally {
      setUploading(false);
      setCroppingImage(null);
      setEditingImageId(null);
    }
  };

  const updateImage = (id: string, updates: Partial<PropertyImage>) => {
    const images = (formData.images || []).map(img => 
      img.id === id ? { ...img, ...updates } : img
    );
    setFormData({ ...formData, images });
  };

  const removeImage = async (id: string) => {
    try {
      const imgToRemove = formData.images?.find(i => i.id === id);
      if (imgToRemove && imgToRemove.url.includes('firebasestorage')) {
        // Only try to delete if it's stored in Firebase Storage
        const storageRef = ref(storage, `properties/${prop.id}/${id}.jpg`);
        await deleteObject(storageRef).catch(e => console.warn('Object already deleted or not found in storage', e));
      }
    } catch (e) {
      console.warn('Silent error during storage deletion', e);
    }

    const images = (formData.images || []).filter(img => img.id !== id);
    let teaserId = formData.teaserImageId;
    if (teaserId === id) {
      teaserId = images.length > 0 ? images[0].id : undefined;
    }
    setFormData({ ...formData, images, teaserImageId: teaserId });
  };

  const setTeaser = (id: string) => {
    setFormData({ ...formData, teaserImageId: id });
  };

  const cleanDescription = (text: string) => {
    // Remove emojis and special chars, max 80 chars
    return text.replace(/[^\w\s.,?!-]/gi, '').slice(0, 80);
  };

  const isShortComplete = getShortCompletion(formData) === 100;
  const isBasisComplete = (() => {
    const f = formData.features || {};
    const hasTitle = !!(formData.title && formData.title.trim() !== '' && formData.title !== 'Nieuwe Woning');
    const hasGoal = !!f.goal;
    const hasType = !!f.type;
    const hasCity = !!formData.city;
    const hasPrice = formData.priceType === 'tbd' || (formData.priceType === 'fixed' && formData.price > 0) || (formData.priceType === 'range' && formData.minPrice > 0 && formData.maxPrice > 0);
    
    return hasTitle && hasGoal && hasType && hasCity && hasPrice;
  })();

  useEffect(() => {
    // Auto-deactivate if active but short completion is incomplete
    if (prop.isActive && getShortCompletion(prop) < 100) {
      setFormData(prev => ({ ...prev, isActive: false }));
      // We don't auto-save here as it might be confusing, but the state is prepared
    }
  }, []);

  const handleStatusChange = async (newStatus: 'available' | 'paused', newIsActive: boolean) => {
    if (newIsActive && getShortCompletion(formData) < 100) {
      alert('Je kunt de woning pas activeren als de Snelle Start 100% voltooid is.');
      return;
    }

    const updatedData = { ...formData, status: newStatus, isActive: newIsActive };
    setFormData(updatedData);
    
    // Direct save
    setSaving(true);
    try {
      const completion = calculateCompletion(updatedData);
      const updateData = {
        ...updatedData,
        completion,
        updatedAt: serverTimestamp()
      };
      const id = updateData.id;
      delete updateData.id;
      await updateDoc(doc(db, 'properties', id), updateData);
      
      toast.success(t('prop.editor.status_updated'));
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(t('prop.editor.status_update_failed'));
    } finally {
      setSaving(false);
    }
  };

  if (editorMode === 'selector') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl relative border border-outline flex flex-col max-h-[95vh] overflow-hidden"
        >
          <button 
            onClick={onClose} 
            className="absolute top-8 right-8 z-[20] flex items-center gap-2 p-3 hover:bg-surface-container-low rounded-full transition-colors text-on-surface-variant"
          >
            <X size={28} />
          </button>
          
          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="p-8 overflow-y-auto custom-scrollbar flex-grow relative"
          >
            <div className="text-center mb-12">
              <h2 id="provider-editor-title" className="text-4xl font-display font-black text-on-background mb-4 uppercase tracking-tight">
                {isShortComplete && formData.title && formData.title !== 'Nieuwe Woning'
                  ? formData.title
                  : t('prop.editor.title')}
              </h2>
              <p className="text-xl text-on-surface-variant max-w-2xl mx-auto">{t('prop.editor.subtitle')}</p>
              {isShortComplete && (formData.completion < 50 || !(formData.features?.free_text_description?.trim())) && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-xl border border-success/20 shadow-sm">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-bold">{t('prop.editor.short_complete_banner', 'Je snelle start is 100% compleet! Je kunt nu de andere secties bewerken.')}</span>
                </motion.div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 max-w-6xl mx-auto">
              <button 
                onClick={() => setEditorMode('short')} 
                className={`flex flex-col items-center text-center p-8 border-2 rounded-[3rem] transition-all group relative min-h-[320px] shadow-sm ${
                  isShortComplete 
                    ? 'bg-primary/5 border-primary shadow-primary/5' 
                    : 'bg-white border-outline/40 hover:border-primary/50 hover:bg-primary/[0.02]'
                }`}
              >
                {isShortComplete && (
                  <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-success/10 text-success px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} /> {t('common.filled')}
                  </div>
                )}
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 text-primary group-hover:scale-105 transition-transform border border-outline/30">
                  <Layout size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-1 text-on-surface">{t('prop.editor.mode.short')}</h3>
                <p className="text-sm font-medium leading-relaxed text-on-surface-variant mb-6 flex-grow max-w-[160px]">{t('prop.editor.mode.short_desc')}</p>
                
                { !isShortComplete && (
                  <>
                    <div className="w-full h-1 bg-surface-container rounded-full mb-3 overflow-hidden max-w-[180px]">
                      <div className={`h-full transition-all duration-500 ${isShortComplete ? 'bg-success' : 'bg-primary'}`} style={{ width: `${getShortCompletion(formData)}%` }} />
                    </div>
                    
                    <div className={`text-[9px] font-black uppercase tracking-widest mb-6 ${isShortComplete ? 'text-success' : 'text-primary'}`}>
                      {getShortCompletion(formData)}% {t('prop.editor.filled_label')}
                    </div>
                  </>
                )}

                <div className="mt-auto w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[10px] shadow-lg group-hover:bg-primary-dark transition-all uppercase tracking-widest">
                  {isShortComplete ? t('prop.editor.btn_edit') : t('prop.editor.btn_start')}
                </div>
              </button>

              {/* Persoonlijke Tekst */}
              <button 
                disabled={!isShortComplete} 
                onClick={() => setEditorMode('free_text')} 
                className={`flex flex-col items-center text-center p-8 border-2 rounded-[3rem] transition-all group relative min-h-[320px] shadow-sm ${
                  !isShortComplete ? 'opacity-40 cursor-not-allowed bg-surface-container/30 border-outline/20 grayscale' : 
                  formData.features?.free_text_description ? 'bg-primary/5 border-primary shadow-primary/5' : 'bg-white border-outline/40 hover:border-primary/50 hover:bg-primary/[0.02]'
                }`}
              >
                {formData.features?.free_text_description && (
                  <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-success/10 text-success px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} /> {t('common.filled')}
                  </div>
                )}
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 text-primary group-hover:scale-105 transition-transform border border-outline/30">
                  <FileText size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-1 text-on-surface">{t('prop.editor.mode.free_text')}</h3>
                <p className="text-sm font-medium leading-relaxed text-on-surface-variant mb-6 flex-grow max-w-[160px]">{t('prop.editor.mode.free_text_desc')}</p>

                <div className={`mt-auto w-full py-3.5 rounded-xl font-bold text-[10px] shadow-lg transition-all uppercase tracking-widest ${isShortComplete ? 'bg-primary text-on-primary group-hover:bg-primary-dark' : 'bg-surface-container text-on-surface-variant'}`}>
                  {t('prop.editor.btn_edit')}
                </div>
              </button>

              {/* Compleet Profiel */}
              <button 
                disabled={!isShortComplete} 
                onClick={() => setEditorMode('full')} 
                className={`flex flex-col items-center text-center p-8 border-2 rounded-[3rem] transition-all group relative min-h-[320px] shadow-sm ${
                  !isShortComplete ? 'opacity-40 cursor-not-allowed bg-surface-container/30 border-outline/20 grayscale' : 
                  (calculateCompletion(formData) > 80) ? 'bg-primary/5 border-primary shadow-primary/5' : 'bg-white border-outline/40 hover:border-primary/50 hover:bg-primary/[0.02]'
                }`}
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 text-primary group-hover:scale-105 transition-transform border border-outline/30">
                  <Star size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-1 text-on-surface">{t('prop.editor.mode.full')}</h3>
                <p className="text-sm font-medium leading-relaxed text-on-surface-variant mb-6 flex-grow max-w-[160px]">{t('prop.editor.mode.full_desc')}</p>
                <div className={`mt-auto w-full py-3.5 rounded-xl font-bold text-[10px] shadow-lg transition-all uppercase tracking-widest ${isShortComplete ? 'bg-primary text-on-primary group-hover:bg-primary-dark' : 'bg-surface-container text-on-surface-variant'}`}>
                  {t('prop.editor.btn_edit')}
                </div>
              </button>

              {/* Zichtbaarheid & Privacy (Visibility & Privacy) */}
              <button 
                disabled={!isShortComplete}
                onClick={() => setEditorMode('visibility')} 
                className={`flex flex-col items-center text-center p-8 border-2 rounded-[3rem] transition-all group relative min-h-[320px] shadow-sm ${
                  !isShortComplete ? 'opacity-40 cursor-not-allowed bg-surface-container/30 border-outline/20 grayscale' : 
                  'bg-white border-outline/40 hover:border-primary/50 hover:bg-primary/[0.02]'
                }`}
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 text-primary group-hover:scale-105 transition-transform border border-outline/30">
                  <Lock size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-1 text-on-surface">{t('prop.editor.mode.visibility', 'Zichtbaarheid & Privacy')}</h3>
                <p className="text-sm font-medium leading-relaxed text-on-surface-variant mb-6 flex-grow max-w-[160px]">{t('prop.editor.mode.visibility_desc', 'Bepaal welke info zoekers mogen zien.')}</p>
                <div className={`mt-auto w-full py-3.5 rounded-xl font-bold text-[10px] shadow-lg transition-all uppercase tracking-widest ${isShortComplete ? 'bg-primary text-on-primary group-hover:bg-primary-dark' : 'bg-surface-container text-on-surface-variant'}`}>
                  {t('prop.editor.btn_edit', 'Bewerken')}
                </div>
              </button>

              {/* Admin Info */}
              {isAdmin && (
                <button 
                  onClick={() => setEditorMode('admin_info' as any)} 
                  className="flex flex-col items-center text-center p-8 border-2 rounded-[3rem] transition-all group relative min-h-[320px] shadow-sm bg-white border-outline/40 hover:border-primary/50 hover:bg-primary/[0.02]"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 text-primary group-hover:scale-105 transition-transform border border-outline/30">
                    <ShieldCheck size={24} />
                  </div>
                  <h3 className="font-display font-bold text-xl mb-1 text-on-surface">{t('prop.editor.admin_title', 'Admin Info')}</h3>
                  <p className="text-sm font-medium leading-relaxed text-on-surface-variant mb-6 flex-grow max-w-[160px]">{t('prop.editor.admin_desc', 'Provider info, statuses and metadata.')}</p>
                  <div className="mt-auto w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[10px] shadow-lg transition-all uppercase tracking-widest">
                    {t('prop.editor.btn_view', 'VIEW')}
                  </div>
                </button>
              )}
            </div>

            <div className="max-w-4xl mx-auto space-y-8">
              {/* Status Selector at bottom */}
              <div className={`w-full p-1.5 rounded-[2rem] border transition-all flex items-center justify-center gap-4 ${isShortComplete ? 'bg-[#fcfbf9] border-[#e8e4db]' : 'bg-surface-container-low border-outline/20 opacity-40 grayscale'}`}>
                  <button 
                    disabled={!isShortComplete}
                    onClick={() => handleStatusChange('available', true)}
                    className={`flex-1 py-4 rounded-[1.5rem] text-[11px] font-black transition-all flex items-center justify-center gap-3 ${!isShortComplete ? 'cursor-not-allowed' : formData.status === 'available' && formData.isActive ? 'bg-green-500 text-white shadow-xl scale-[1.02]' : 'text-on-surface-variant hover:bg-green-50'}`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${formData.status === 'available' && formData.isActive ? 'bg-white shadow-[0_0_8px_white]' : 'bg-green-500'}`} />
                    {t('prop.editor.status_active')}
                  </button>
                  <button 
                    disabled={!isShortComplete}
                    onClick={() => handleStatusChange('paused', true)}
                    className={`flex-1 py-4 rounded-[1.5rem] text-[11px] font-black transition-all flex items-center justify-center gap-3 ${!isShortComplete ? 'cursor-not-allowed' : formData.status === 'paused' && formData.isActive ? 'bg-orange-500 text-white shadow-xl scale-[1.02]' : 'text-on-surface-variant hover:bg-orange-50'}`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${formData.status === 'paused' && formData.isActive ? 'bg-white shadow-[0_0_8px_white]' : 'bg-orange-500'}`} />
                    {t('prop.editor.status_pause')}
                  </button>
                  <button 
                    onClick={() => handleStatusChange('available', false)}
                    className={`flex-1 py-4 rounded-[1.5rem] text-[11px] font-black transition-all flex items-center justify-center gap-3 ${!formData.isActive ? 'bg-[#3c372b] text-white shadow-xl scale-[1.02]' : 'text-on-surface-variant hover:bg-surface-container'}`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${!formData.isActive ? 'bg-white shadow-[0_0_8px_white]' : 'bg-[#3c372b]'}`} />
                    {t('prop.editor.status_inactive')}
                  </button>
              </div>

              {/* Locked Footer */}
                {!isShortComplete && (
                  <div className="w-full py-4 bg-[#fef2f2] border border-[#fecaca] rounded-2xl flex items-center justify-center gap-2 text-[#b91c1c] text-[10px] font-bold uppercase tracking-[0.2em]">
                    <Lock size={14} />
                    {t('prop.editor.complete_short_first')}
                  </div>
                )}

                {/* Footer buttons */}
                <div className="flex justify-between items-center pt-8 border-t border-outline/20">
                  <button
                    onClick={async () => {
                      if (onDeletePrompt) {
                        onDeletePrompt();
                      } else if (window.confirm(t('dash.confirm_delete_msg', 'Weet je zeker dat je deze woning wilt verwijderen? Dit kan niet ongedaan worden gemaakt.'))) {
                        try {
                          const { deleteDoc, doc } = await import('firebase/firestore');
                          await deleteDoc(doc(db, 'properties', prop.id));
                          onClose();
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `properties/${prop.id}`);
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-[#fef2f2] text-[#b91c1c] font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-[#fee2e2] transition-all border border-[#fecaca]"
                  >
                    <Trash2 size={14} />
                    {t('dash.confirm_delete_btn')}
                  </button>
                  {/* Keep close right aligned if needed, though there is an X button at the top too. We will just leave it empty on the right just in case they meant the delete button itself, or add a Close button */}
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-surface-variant text-on-surface hover:bg-surface-container-high font-black uppercase tracking-widest text-[10px] rounded-xl transition-all"
                  >
                    {t('common.close', 'Sluiten')}
                  </button>
                </div>
            </div>

                    <AnimatePresence>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            );
          }

  if (editorMode === 'visibility') {
    const visibilityCategories = allCategories.slice(allCategories.findIndex(c => c.id === 'composition'));
    
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative border border-outline flex flex-col max-h-[90vh]">
          <div className="p-8 border-b border-outline flex justify-between items-center bg-surface-container-lowest">
            <div>
              <h2 className="text-2xl font-display font-black text-on-background">{t('prop.editor.visibility.title')}</h2>
              <p className="text-sm text-on-surface-variant">{t('prop.editor.visibility.subtitle')}</p>
            </div>
            <button onClick={() => setEditorMode('selector')} className="p-2 rounded-full hover:bg-surface-container transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-8 overflow-y-auto flex-grow custom-scrollbar">
            <div className="bg-primary/5 p-6 rounded-2xl mb-8 border border-primary/10">
              <div className="flex gap-4 items-start">
                <ShieldCheck size={24} className="text-primary mt-1" />
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {t('prop.editor.visibility.desc')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {visibilityCategories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setVisibilitySettings(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group text-left shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors border border-outline">
                      <cat.icon size={20} />
                    </div>
                    <span className="font-bold text-on-surface">{cat.label}</span>
                  </div>
                  <div 
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                      visibilitySettings[cat.id] === false 
                        ? 'bg-error/10 text-error border border-error/20' 
                        : 'bg-success/10 text-success border border-success/20'
                    }`}
                  >
                    {visibilitySettings[cat.id] === false ? <EyeOff size={14} /> : <Eye size={14} />}
                    {visibilitySettings[cat.id] === false ? t('prop.editor.visibility.toggle_off') : t('prop.editor.visibility.toggle_on')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-8 border-t border-outline bg-surface-container-lowest flex justify-end gap-4 rounded-b-[2.5rem]">
            <button 
              onClick={() => setEditorMode('selector')}
              className="px-8 py-3 font-bold hover:bg-surface-container rounded-xl transition-all"
            >
              {t('common.close')}
            </button>
            <button 
              onClick={() => handleUpdate(true)}
              className="px-8 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all text-xs uppercase tracking-widest flex items-center gap-2"
            >
              <Save size={18} />
              {t('common.save')}
            </button>
          </div>
        </motion.div>

        {/* Global Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[200] bg-on-background text-background px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 border border-outline/20"
            >
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-on-primary">
                <CheckCircle2 size={16} />
              </div>
              {t('common.saved', 'Saved!')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (editorMode === 'admin_info' && isAdmin) {
    const AdminInfoContent = () => <AdminProviderInfo prop={prop} />;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl relative border border-outline flex flex-col max-h-[95vh] overflow-hidden">
          <div className="p-8 border-b border-outline flex items-center justify-between bg-surface-container-lowest">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setEditorMode('selector')}
                className="p-3 bg-surface-container-low hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h2 className="text-2xl font-display font-black text-on-background uppercase tracking-tight">{t('admin.admin_info', 'Admin Info')}</h2>
                <div className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mt-1">{t('admin.control_panel', 'Beheerderspaneel')}</div>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-8 custom-scrollbar">
            <AdminInfoContent />
            
            <div className="mt-8 space-y-6">
              <div className="bg-surface-container-low rounded-2xl p-6 border border-outline shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4">{t('admin.meta_data_prop', 'Meta Data (Woning)')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">{t('admin.prop_id', 'Woning ID')}</p>
                    <p className="font-bold text-on-surface font-mono text-sm">{prop.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">{t('admin.created_at', 'Aangemaakt op')}</p>
                    <p className="font-bold text-on-surface">
                      {prop.createdAt?.seconds ? `${formatDate(new Date(prop.createdAt.seconds * 1000), dateFormat)}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">{t('admin.updated_at', 'Laatst gewijzigd op')}</p>
                    <p className="font-bold text-on-surface">
                      {/* @ts-ignore */}
                      {prop.updatedAt?.seconds ? `${formatDate(new Date(prop.updatedAt.seconds * 1000), dateFormat)}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">Completion Score</p>
                    <p className="font-bold text-on-surface">{prop.completion || 0}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 border-t border-outline bg-surface-container-lowest flex justify-end gap-4 rounded-b-[2.5rem]">
            <button 
              onClick={() => setEditorMode('selector')}
              className="px-8 py-3 font-bold hover:bg-surface-container rounded-xl transition-all"
            >
              {t('common.close')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (editorMode === 'free_text') {
    const examples = [
      { id: 1, title: t('prop.editor.example.1.title'), text: t('prop.editor.example.1.text') },
      { id: 2, title: t('prop.editor.example.2.title'), text: t('prop.editor.example.2.text') },
      { id: 3, title: t('prop.editor.example.3.title'), text: t('prop.editor.example.3.text') },
    ];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative border border-outline flex flex-col max-h-[90vh]">
          <div className="p-8 border-b border-outline space-y-6">
            <div className="flex justify-between items-start gap-6">
              <div className="flex-grow">
                <h2 className="text-2xl font-display font-black text-on-background">{t('prop.editor.mode.free_text', 'Persoonlijke Tekst')}</h2>
                <p className="text-sm text-on-surface-variant">{t('prop.editor.max_chars', { count: 2000 })}</p>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      description: '',
                      features: {
                        ...prev.features,
                        free_text_description: ''
                      }
                    }));
                  }}
                  className="h-11 px-5 bg-error/5 text-error rounded-2xl font-black text-xs hover:bg-error/10 transition-all border border-error/10 flex items-center gap-2 whitespace-nowrap"
                >
                  <Trash2 size={16} />
                  {t('prop.editor.clear_text')}
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="h-11 px-5 bg-surface-container rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-surface-container-high transition-all border border-outline whitespace-nowrap"
                  >
                    <Copy size={16} className="text-primary" />
                    {t('prop.editor.example.title')}
                    <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full mt-2 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-outline p-2 z-50"
                      >
                        {examples.map(ex => (
                          <button 
                            key={ex.id}
                            onClick={() => {
                              setSelectedExample(ex.id);
                              setIsDropdownOpen(false);
                            }}
                            className="w-full text-left p-3 hover:bg-surface-container-low rounded-xl text-xs font-bold transition-colors truncate"
                          >
                            {ex.title}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={() => setEditorMode('selector')} 
                  className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors shrink-0"
                  title={t('common.close')}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-primary/10 shrink-0">
                  <AlertCircle size={20} className="text-primary" />
                </div>
                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  <span className="text-primary font-black uppercase tracking-widest text-[10px] mr-2">{t('prop.editor.privacy_tip_title')}:</span> {t('prop.editor.privacy_tip_desc')}
                </p>
              </div>
          </div>
          <div className="p-8 overflow-y-auto custom-scrollbar">
            <textarea 
              value={formData.features?.free_text_description || ''} 
              onChange={e => updateFeature('free_text_description', e.target.value.slice(0, 2000))}
              className={`w-full h-80 p-6 bg-surface-container-low rounded-3xl border-2 transition-all outline-none resize-none font-medium leading-relaxed border-outline/50 focus:border-primary focus:ring-primary/10`}
              placeholder={t('prop.editor.free_text_placeholder', 'Tell us here what you offer, who you are looking for and what makes the home special...')}
              maxLength={2000}
            />
            <div className="mt-3 flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold text-primary/70">
                {t('prop.editor.smiley_tip')}
              </div>
              <div className="text-xs font-bold text-on-surface-variant">
                {(formData.features?.free_text_description || '').length} / 2000
              </div>
            </div>
          </div>
          <div className="p-8 border-t border-outline flex justify-end gap-4">
            <button onClick={() => setEditorMode('selector')} className="px-6 py-3 font-bold hover:bg-surface-container-low rounded-xl transition-all">{t('common.close')}</button>
            <button 
              onClick={() => {
                const text = formData.features?.free_text_description || '';
                const validationError = validateText(text, t);

                if (validationError) {
                  setShowPIIConfirmation(true);
                } else {
                  handleUpdate(true);
                }
              }} 
              className="px-8 py-3 bg-primary text-on-primary font-bold rounded-xl shadow-lg hover:shadow-primary/30 flex items-center gap-2 transition-all"
            >
              {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
              {t('prop.save')}
            </button>
          </div>

          <AnimatePresence>
            {showPIIConfirmation && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white max-w-md w-full p-8 rounded-[2.5rem] shadow-2xl border border-outline text-center"
                >
                  <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-primary">
                    <ShieldAlert size={40} />
                  </div>
                  <h3 className="text-xl font-display font-black mb-4">{t('prop.editor.pii_warning_title', 'Privacy Waarschuwing')}</h3>
                  <p className="text-sm text-on-surface-variant font-medium leading-relaxed mb-8">
                    {t('prop.editor.pii_warning_desc', 'We hebben mogelijk contactgegevens (e-mail, telefoon) of prijzen in je tekst gevonden. Voor de beste AI match en jouw privacy raden we aan deze te verwijderen.')}
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => setShowPIIConfirmation(false)}
                      className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {t('prop.editor.pii_warning_fix', 'Aanpassen (Aanbevolen)')}
                    </button>
                    <button 
                      onClick={() => {
                        setShowPIIConfirmation(false);
                        handleUpdate(true);
                      }}
                      className="w-full py-3 text-on-surface-variant font-bold hover:bg-surface-container rounded-xl transition-all"
                    >
                      {t('prop.editor.pii_warning_ignore', 'Toch doorgaan')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Example Modal */}
          <AnimatePresence>
            {selectedExample && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="bg-white w-full max-w-xl p-8 rounded-[2rem] shadow-2xl border border-outline relative"
                >
                  <h3 className="text-xl font-display font-black mb-4">{examples.find(e => e.id === selectedExample)?.title}</h3>
                  <div className="bg-surface-container-low p-6 rounded-2xl border border-outline max-h-[40vh] overflow-y-auto text-sm leading-relaxed whitespace-pre-line mb-8">
                    {examples.find(e => e.id === selectedExample)?.text}
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedExample(null)} 
                      className="flex-1 py-3 rounded-xl font-bold border border-outline hover:bg-surface-container-low transition-colors"
                    >
                      {t('prop.editor.example.cancel')}
                    </button>
                    <button 
                      onClick={() => {
                        const exampleText = examples.find(e => e.id === selectedExample)?.text || '';
                        const current = formData.features?.free_text_description || '';
                        updateFeature('free_text_description', current ? `${current}\n\n${exampleText}` : exampleText);
                        setSelectedExample(null);
                      }}
                      className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Copy size={18} />
                      {t('prop.editor.example.copy')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Global Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[200] bg-on-background text-background px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 border border-outline/20"
            >
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-on-primary">
                <CheckCircle2 size={16} />
              </div>
              {t('common.saved', 'Saved!')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }


    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background w-full max-w-6xl h-full md:h-auto md:max-h-[90vh] rounded-none md:rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden border-none md:border md:border-outline"
        >
          {/* Sidebar Nav */}
          <div className={`${showMobileMenu ? 'flex' : 'hidden'} md:flex w-full md:w-80 shrink-0 bg-white border-r border-outline flex flex-col relative overflow-hidden z-20`}>
            <div 
              ref={sidebarScrollRef}
              onScroll={checkSidebarScroll}
              className="flex-grow p-6 md:p-8 flex flex-col gap-2 overflow-y-auto custom-scrollbar"
            >
              <div className="flex md:hidden justify-between items-center mb-6">
                <h3 className="font-display font-black text-xl uppercase tracking-tight">{t('common.menu', 'Menu')}</h3>
                <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-surface-container rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-2 pb-8">
                {editorMode === 'short' && (
                  <div className="mb-4">
                  <h3 className="text-xl font-display font-bold text-on-background mb-1">{t('prop.editor.mode.short')}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-grow h-1.5 bg-surface-container-low rounded-full">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 bg-primary" 
                        style={{ width: `${getShortCompletion(formData)}%` }} 
                      />
                    </div>
                    <span className="text-xs font-bold text-primary">
                      {getShortCompletion(formData)}%
                    </span>
                  </div>
                  {!isShortComplete ? (
                     <p className="text-[10px] font-bold text-error mt-2 uppercase tracking-tight italic">
                       {t('prop.editor.short_completion_tip')}
                     </p>
                  ) : (
                    <button 
                      onClick={() => setEditorMode('free_text')}
                      className="w-full mt-4 p-3 bg-primary text-on-primary rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-lg hover:shadow-primary/30 transition-all flex items-center justify-center gap-2"
                    >
                      <ArrowRight size={14} />
                      {t('prop.editor.btn_next_step')}
                    </button>
                  )}
                </div>
              )}
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => {
                    setActiveTab(cat.id);
                    setShowMobileMenu(false);
                    document.getElementById('content-scroll-area')?.scrollTo(0, 0);
                  }}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${activeTab === cat.id ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <cat.icon size={18} />
                  </div>
                  <span className="leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <AnimatePresence>
            {canScrollSidebar && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-20"
              >
                <div className="bg-primary text-on-primary p-1.5 rounded-full shadow-lg animate-bounce">
                  <ChevronDown size={16} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content Area */}
        <div className="flex-grow flex flex-col bg-background/50 overflow-hidden relative">
            {showPreview && <PropertyPreview prop={formData} onClose={() => setShowPreview(false)} />}
            
            <div className="flex justify-between items-center px-6 md:px-12 py-4 md:py-8 border-b border-outline bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4 min-w-0 mr-4">
                <button 
                  onClick={() => setShowMobileMenu(true)}
                  className="flex md:hidden p-2 bg-surface-container rounded-xl text-primary"
                >
                  <Menu size={20} />
                </button>
                <div className="min-w-0">
                  <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 block truncate">{t('prop.editor.label_title')}</label>
                  <h2 className="text-xl md:text-3xl font-display font-black text-on-background m-0 truncate">
                    {formData.title || t('prop.editor.new_title')}
                  </h2>
                </div>
              </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                  <button 
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-secondary/10 text-secondary rounded-xl md:rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest hover:bg-secondary/20 transition-all border border-secondary/20"
                  >
                    <Eye size={16} className="md:w-[18px] md:h-[18px]" />
                    <span className="hidden sm:inline">{t('prop.preview.button')}</span>
                  </button>
                  <div className="h-8 md:h-10 w-px bg-outline/30 mx-1 md:mx-2" />
                  <button 
                    onClick={() => setEditorMode('selector')} 
                    className="p-2 md:p-3 hover:bg-surface-container-low rounded-xl md:rounded-2xl transition-colors" 
                    title={t('common.close')}
                  >
                    <X size={20} className="md:w-6 md:h-6" />
                  </button>
                </div>
              </div>

              <div 
                id="content-scroll-area" 
                ref={contentScrollRef}
                onScroll={checkContentScroll}
                className="flex-grow overflow-y-auto p-6 md:p-12 relative custom-scrollbar"
              >
                {activeTab === 'basis' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex justify-between items-center">
                    <span>{t('prop.editor.label_title')} <span className="text-error">*</span></span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.title || ''} 
                    maxLength={100}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white border-2 border-outline/50 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl p-4 font-bold text-sm outline-none transition-all"
                    placeholder={t('prop.editor.placeholder_title')}
                  />
                  <p className="text-[10px] font-medium text-on-surface-variant mt-1.5 ml-2">{t('prop.editor.tip_title')}</p>
                </div>

                {/* Description added to Basis tab for better visibility in Quick Start */}
                <div className="space-y-2 pt-4 border-t border-outline/20">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex justify-between items-center">
                    <span>{t('prop.editor.mode.free_text', 'Omschrijving')} <span className="text-error">*</span></span>
                  </label>
                  <textarea 
                    value={formData.description || formData.features?.free_text_description || ''} 
                    maxLength={2000}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        description: val,
                        features: {
                          ...prev.features,
                          free_text_description: val
                        }
                      }));
                    }}
                    rows={4}
                    className="w-full bg-white border-2 border-outline/50 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl p-4 font-medium text-sm outline-none transition-all resize-none"
                    placeholder={t('prop.editor.placeholder_description', 'Vertel kort iets over de woning... (min. 10 tekens)')}
                  />
                  <div className="flex justify-between items-center mt-1.5 px-2">
                     <p className="text-[10px] font-medium text-on-surface-variant">{t('prop.editor.tip_description', 'Een goede omschrijving helpt bij de perfecte AI match.')}</p>
                     <span className={`text-[10px] font-black ${(formData.description || '').length > 0 ? 'text-success' : 'text-error'}`}>
                       {(formData.description || '').length} / 2000
                     </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8 pt-4 border-t border-outline/20">
                  <div className="space-y-4">
                    <label className="text-sm font-black uppercase tracking-widest text-on-surface-variant">{t('prop.editor.label_goal')} <span className="text-error">*</span></label>
                    <div className="flex flex-col gap-3">
                      {[
                        { id: 'cohousing', label: t('prop.goal.cohousing'), desc: t('prop.goal.cohousing_desc') },
                        { id: 'hospita', label: t('prop.goal.hospita'), desc: t('prop.goal.hospita_desc') },
                        { id: 'vakantie_onderhuur', label: t('prop.goal.vakantie_onderhuur'), desc: t('prop.goal.sublet_desc') },
                        { id: 'huisbewaring_expat', label: t('prop.goal.huisbewaring_expat'), desc: t('prop.goal.expat_desc') },
                        { id: 'vrije_verhuur', label: t('prop.goal.vrije_verhuur'), desc: t('prop.goal.free_desc') }
                      ].map(goal => (
                        <label key={goal.id} className="w-full flex items-start gap-4 p-5 bg-white border-2 border-outline/50 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:border-primary shadow-sm">
                          <input 
                            type="radio" 
                            name="goal" 
                            className="w-5 h-5 mt-0.5 accent-primary shrink-0" 
                            checked={formData.features.goal === goal.id}
                            onChange={() => updateFeature('goal', goal.id)}
                          />
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-on-surface">{goal.label}</span>
                            <span className="text-sm text-on-surface-variant font-medium">{goal.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.basis.type')} <span className="text-error">*</span></label>
                    <select 
                      value={formData.features.type || ''}
                      onChange={e => updateFeature('type', e.target.value)}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    >
                      <option value="">{t("common.select", "Selecteer...")}</option>
                      <option value="kamer">{t("prop.type.room", "Kamer")}</option>
                      <option value="studio">{t("prop.type.studio", "Studio")}</option>
                      <option value="appartement">{t("prop.type.apartment", "Appartement")}</option>
                      <option value="woning">{t("prop.type.house", "Huis")}</option>
                    </select>
                  </div>
                </div>

                <div className="bg-surface-container-low p-6 rounded-3xl border border-outline/50 space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant block">{t('prop.prefs.max_inquiries', 'Maximaal aantal reacties')}</label>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        const cur = formData.maxInquiries || 10;
                        let next = cur;
                        if (cur > 10) next = cur - 10;
                        else if (cur === 10) next = 5;
                        setFormData({...formData, maxInquiries: next});
                      }}
                      disabled={(formData.maxInquiries || 10) <= 5}
                      className="p-3 bg-white border-2 border-outline/50 rounded-xl hover:border-primary/30 transition-all disabled:opacity-30"
                      type="button"
                    >
                      <Minus size={20} />
                    </button>
                    <div className="flex-grow bg-white border-2 border-primary rounded-xl p-4 flex flex-col items-center justify-center">
                       <span className="text-2xl font-black text-primary">{formData.maxInquiries || 10}</span>
                       <span className="text-[10px] uppercase font-bold text-on-surface-variant">{t('prop.prefs.inquiries', 'reacties')}</span>
                    </div>
                    <button 
                      onClick={() => {
                        const cur = formData.maxInquiries || 10;
                        let next = cur;
                        if (cur < 10) next = 10;
                        else if (cur < 50) next = cur + 10;
                        setFormData({...formData, maxInquiries: next});
                      }}
                      disabled={(formData.maxInquiries || 10) >= 50}
                      className="p-3 bg-white border-2 border-outline/50 rounded-xl hover:border-primary/30 transition-all disabled:opacity-30"
                      type="button"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <p className="text-[10px] font-medium text-on-surface-variant italic">{t('prop.prefs.max_inquiries_tip', 'Na dit aantal reacties gaat de woning automatisch op pauze.')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.basis.domicile')}</label>
                    <select 
                      value={formData.features.domicile || ''}
                      onChange={e => updateFeature('domicile', e.target.value)}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    >
                      <option value="">{t("common.select", "Selecteer...")}</option>
                      <option value="ja">{t("common.yes", "Yes")}</option>
                      <option value="nee">{t("common.no", "No")}</option>
                      <option value="overleg">{t("common.in_consultation", "In consultation")}</option>
                      <option value="weet_ik_niet">{t("common.dont_know", "Don't know (yet)")}</option>
                    </select>
                    <p className="text-[10px] text-on-surface-variant font-medium">{t('prop.basis.domicile_desc')}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'address' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
                <div className="p-8 bg-primary/5 rounded-[2.5rem] flex flex-col md:flex-row gap-6 items-center border border-primary/10">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                    <Lock className="text-primary" size={32} />
                  </div>
                  <div>
                    <h5 className="text-lg font-display font-black text-primary mb-1 uppercase tracking-tight">{t('prop.editor.privacy_first', 'Privacy Voorop')}</h5>
                    <p className="text-sm text-on-surface-variant font-medium">{t('prop.editor.address_privacy_info')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('prop.editor.label_address_visible')} <span className="text-error">*</span></label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                            <Search size={18} />
                          </div>
                          <input 
                            type="text" 
                            value={citySearch} 
                            maxLength={100}
                            onChange={e => {
                              setCitySearch(e.target.value);
                              setShowCitySuggestions(true);
                            }}
                            onFocus={() => setShowCitySuggestions(true)}
                            className="w-full bg-white border-2 border-outline/50 rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold text-lg"
                            placeholder={t('prop.editor.placeholder_city')}
                          />
                          
                          <AnimatePresence>
                            {showCitySuggestions && (citySearch.length > 0 || isSearchingCities) && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute left-0 right-0 top-full mt-2 bg-white border border-outline rounded-2xl shadow-xl z-[1001] overflow-hidden"
                              >
                                {isSearchingCities && (
                                  <div className="px-6 py-4 flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    <span className="text-xs font-bold text-on-surface-variant">{t('prop.editor.searching_cities', 'Searching for cities...')}</span>
                                  </div>
                                )}
                                
                                {citySuggestions.map((city, i) => (
                                  <button
                                    key={`${city.lat}-${city.lng}-${i}`}
                                    onClick={() => {
                                      setFormData({ 
                                        ...formData, 
                                        city: city.name.split(',')[0],
                                        displayLat: city.lat,
                                        displayLng: city.lng
                                      });
                                      setMapCenter([city.lat, city.lng]);
                                      setCitySearch(city.name.split(',')[0]);
                                      setShowCitySuggestions(false);
                                    }}
                                    className="w-full text-left px-6 py-4 hover:bg-primary/5 transition-colors border-b border-outline/30 last:border-0 flex items-center justify-between group"
                                  >
                                    <div className="flex flex-col">
                                       <span className="font-bold text-sm text-on-surface group-hover:text-primary">{city.name.split(',')[0]}</span>
                                       <span className="text-[10px] text-on-surface-variant truncate max-w-[250px]">{city.name}</span>
                                    </div>
                                    <ChevronRight size={16} className="text-outline group-hover:text-primary transition-all shrink-0" />
                                  </button>
                                ))}

                                {!isSearchingCities && citySuggestions.length === 0 && citySearch.length > 2 && (
                                  <div className="px-6 py-4 text-xs font-bold text-on-surface-variant italic">
                                    No cities found.
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('prop.address.neighborhood', 'Wijk (Zichtbaar, optioneel)')}</label>
                          <input 
                            type="text" 
                            value={formData.neighborhood || ''} 
                            maxLength={100}
                            onChange={e => setFormData({...formData, neighborhood: sanitizeText(e.target.value)})}
                            className="w-full bg-white border-2 border-outline/50 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                            placeholder={t('prop.editor.placeholder_neighborhood', 'e.g.: Soho or Brooklyn')}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-surface-container-low rounded-[2rem] border border-outline/50 space-y-4">
                      <div className="flex items-center gap-3 text-primary mb-2">
                         <LocateFixed size={20} />
                         <h4 className="font-display font-black uppercase tracking-tight">{t('prop.editor.map_controls', 'Kaart Bediening')}</h4>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{t('prop.editor.map_controls_desc', 'Gebruik de pijltjes om de cirkel exact boven je woning te plaatsen, of pas de grootte aan.')}</p>
                      
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-12 pt-4">
                        <div className="grid grid-cols-3 gap-2 w-fit mx-auto sm:mx-0">
                          <div />
                          <button onClick={() => shiftLocation(1, 0)} className="w-12 h-12 flex items-center justify-center bg-white border-2 border-outline/50 rounded-[1rem] hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm"><ChevronUp size={20} /></button>
                          <div />
                          <button onClick={() => shiftLocation(0, -1)} className="w-12 h-12 flex items-center justify-center bg-white border-2 border-outline/50 rounded-[1rem] hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm"><ChevronLeft size={20} /></button>
                          <button 
                             onClick={() => {
                               if (formData.displayLat && formData.displayLng) {
                                 setMapCenter([formData.displayLat, formData.displayLng]);
                               }
                             }}
                             className="w-12 h-12 flex items-center justify-center bg-primary text-on-primary rounded-[1rem] shadow-lg hover:scale-105 active:scale-95 transition-all"
                             title={t('prop.editor.recenter_map', 'Recentreer op locatie')}
                          >
                             <LocateFixed size={20} />
                          </button>
                          <button onClick={() => shiftLocation(0, 1)} className="w-12 h-12 flex items-center justify-center bg-white border-2 border-outline/50 rounded-[1rem] hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm"><ChevronRight size={20} /></button>
                          <div />
                          <button onClick={() => shiftLocation(-1, 0)} className="w-12 h-12 flex items-center justify-center bg-white border-2 border-outline/50 rounded-[1rem] hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm"><ChevronDown size={20} /></button>
                          <div />
                        </div>

                        <div className="flex flex-col gap-3 w-full sm:w-64">
                           <button 
                             onClick={() => updateRadius(100)} 
                             className="flex items-center gap-4 px-6 py-4 bg-white border-2 border-outline/50 rounded-2xl hover:border-primary/30 transition-all shadow-sm group w-full"
                           >
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <PlusIcon size={16} />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest">{t('prop.editor.radius_larger', 'Groter')}</span>
                           </button>
                           <button 
                             onClick={() => updateRadius(-100)} 
                             className="flex items-center gap-4 px-6 py-4 bg-white border-2 border-outline/50 rounded-2xl hover:border-primary/30 transition-all shadow-sm group w-full"
                           >
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <Minus size={16} />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest">{t('prop.editor.radius_smaller', 'Kleiner')}</span>
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <div className="flex items-center gap-2">
                          <Eye size={16} className="text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant leading-tight">{t('prop.editor.map_live_preview', 'Live Kaartweergave')}</span>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => setMapType('street')} className={`p-2 rounded-xl transition-all border-2 ${mapType === 'street' ? 'bg-primary/5 border-primary/30 text-primary shadow-sm' : 'bg-white border-outline/30 text-outline hover:border-outline'}`}><MapIcon size={18} /></button>
                          <button onClick={() => setMapType('satellite')} className={`p-2 rounded-xl transition-all border-2 ${mapType === 'satellite' ? 'bg-primary/5 border-primary/30 text-primary shadow-sm' : 'bg-white border-outline/30 text-outline hover:border-outline'}`}><Layers size={18} /></button>
                       </div>
                    </div>

                    <div className="h-[500px] bg-surface-container rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative z-0 group">
                      <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                        <TileLayer
                          attribution='&copy; OpenStreetMap contributors'
                          url={mapType === 'street' 
                            ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          }
                        />
                        <Circle 
                          center={mapCenter} 
                          radius={formData.displayRadius || 500} 
                          pathOptions={{ color: 'var(--color-primary)', fillColor: 'var(--color-primary)', fillOpacity: 0.25, weight: 2 }}
                        />
                        <MapUpdater center={mapCenter} zoom={14} />
                      </MapContainer>
                      
                      <div className="absolute top-6 left-16 right-6 flex justify-between items-start pointer-events-none">
                         <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 pointer-events-auto">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{t('prop.editor.map_shown_location', 'Getoonde Locatie')}</p>
                            <p className="text-sm font-bold text-on-surface">{formData.city || t('prop.editor.choose_city_placeholder', 'Kies een stad...')}</p>
                            {formData.neighborhood && <p className="text-xs text-on-surface-variant font-medium">{formData.neighborhood}</p>}
                         </div>
                         <button 
                           onClick={() => setIsMapFullscreen(true)}
                           className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 text-primary pointer-events-auto hover:scale-110 active:scale-95 transition-all"
                         >
                           <Maximize2 size={24} />
                         </button>
                      </div>

                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3/4 bg-on-background/80 backdrop-blur-md text-background px-6 py-3 rounded-full text-center shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] font-bold">{t('prop.editor.map_drag_tip', 'Drag map to adjust display location')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'layout' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.layout.area_private', 'Woonoppervlakte prive (m²)')}</label>
                    <input 
                      type="number" 
                      value={formData.features.area_private === 0 ? '' : (formData.features.area_private || '')}
                      onChange={e => {
                        const val = e.target.value;
                        updateFeature('area_private', val === '' ? '' : Number(val));
                      }}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.layout.area_shared', 'Gedeelde oppervlakte (m²)')}</label>
                    <input 
                      type="number" 
                      value={formData.features.area_shared === 0 ? '' : (formData.features.area_shared || '')}
                      onChange={e => {
                        const val = e.target.value;
                        updateFeature('area_shared', val === '' ? '' : Number(val));
                      }}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.layout.bedrooms', 'Aantal slaapkamers voor huurder')}</label>
                    <input 
                      type="number" 
                      value={formData.features.bedrooms === 0 ? '' : (formData.features.bedrooms || '')}
                      onChange={e => {
                        const val = e.target.value;
                        updateFeature('bedrooms', val === '' ? '' : Number(val));
                      }}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.layout.total_floors', 'Aantal verdiepingen')}</label>
                    <input 
                      type="number" 
                      value={formData.features.total_floors === 0 ? '' : (formData.features.total_floors || '')}
                      onChange={e => {
                        const val = e.target.value;
                        updateFeature('total_floors', val === '' ? '' : Math.max(1, Number(val)));
                      }}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                      placeholder={t('prop.layout.floors_min_one', 'Minimaal 1')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.layout.furnishing', 'Inrichting / Meubilering')}</label>
                    <select 
                      value={formData.features.furnished || ''}
                      onChange={e => updateFeature('furnished', e.target.value)}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    >
                      <option value="">{t("common.select", "Maak een keuze...")}</option>
                      <option value="ongemeubileerd">{t("prop.furnished.unfurnished", "Ongemeubileerd")}</option>
                      <option value="deels">{t("prop.furnished.partly", "Deels gemeubileerd")}</option>
                      <option value="volledig">{t("prop.furnished.completely", "Volledig (instapklaar)")}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-outline/50">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.layout.sanitary')}</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'bathroom', label: t('prop.layout.bathroom') },
                      { id: 'toilet', label: t('prop.layout.toilet') }
                    ].map(type => {
                      const details = formData.features.sanitary_details || {};
                      const value = details[type.id] || 'none';
                      
                      return (
                        <div key={type.id} className="flex items-center justify-between p-4 bg-white border-2 border-outline/50 rounded-2xl shadow-sm">
                          <span className="font-bold text-sm">{type.label}</span>
                          <div className="flex bg-surface-container-low p-1 rounded-xl scale-90 md:scale-100">
                             {[
                               { label: t('common.none', 'None'), val: 'none' },
                               { label: t('common.private', 'Private'), val: 'prive' },
                               { label: t('common.shared', 'Shared'), val: 'gedeeld' }
                             ].map(opt => (
                               <button 
                                 key={opt.val}
                                 onClick={() => updateFeature('sanitary_details', { ...details, [type.id]: opt.val })}
                                 className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${value === opt.val ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-white'}`}
                               >
                                 {opt.label}
                               </button>
                             ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'vacation_specs' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-surface-container-low p-6 rounded-3xl border border-outline/50 space-y-6 animate-in duration-300">
                  
                  {/* Zwembad */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">Zwembad</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: 'Nee', value: 'no' },
                        { label: 'Gedeeld', value: 'shared' },
                        { label: 'Privé', value: 'private' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_pool" 
                            className="hidden" 
                            checked={(formData.features.vacation_pool || 'no') === opt.value}
                            onChange={() => updateFeature('vacation_pool', opt.value)}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Buitenkeuken */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">Buitenkeuken</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: 'Nee', value: 'no' },
                        { label: 'Gedeeld', value: 'shared' },
                        { label: 'Privé', value: 'private' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_outdoor_kitchen" 
                            className="hidden" 
                            checked={(formData.features.vacation_outdoor_kitchen || 'no') === opt.value}
                            onChange={() => updateFeature('vacation_outdoor_kitchen', opt.value)}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Vakantiepark */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">Vakantiepark</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: 'Nee', value: 'no' },
                        { label: 'Ja, zonder faciliteiten', value: 'yes_no_fac' },
                        { label: 'Ja, met faciliteiten', value: 'yes_fac' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[150px] flex items-center justify-center gap-2 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_resort" 
                            className="hidden" 
                            checked={(formData.features.vacation_resort || 'no') === opt.value}
                            onChange={() => updateFeature('vacation_resort', opt.value)}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Sauna */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">Sauna</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: 'Nee', value: 'no' },
                        { label: 'Gedeeld', value: 'shared' },
                        { label: 'Privé', value: 'private' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_sauna" 
                            className="hidden" 
                            checked={(formData.features.vacation_sauna || 'no') === opt.value}
                            onChange={() => updateFeature('vacation_sauna', opt.value)}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Afstanden */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-outline/30">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">Afstand tot strand (km)</label>
                      <input 
                        type="number" 
                        min="0"
                        max="30"
                        value={formData.features.vacation_beach_dist === undefined ? '' : formData.features.vacation_beach_dist}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            updateFeature('vacation_beach_dist', '');
                          } else {
                            const num = Math.min(30, Math.max(0, Number(val)));
                            updateFeature('vacation_beach_dist', num);
                          }
                        }}
                        className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold animate-in"
                        placeholder="Bijv. 5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">Afstand tot internationale luchthaven (km)</label>
                      <input 
                        type="number" 
                        min="0"
                        max="150"
                        value={formData.features.vacation_airport_dist === undefined ? '' : formData.features.vacation_airport_dist}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            updateFeature('vacation_airport_dist', '');
                          } else {
                            const num = Math.min(150, Math.max(0, Number(val)));
                            updateFeature('vacation_airport_dist', num);
                          }
                        }}
                        className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold animate-in"
                        placeholder="Bijv. 45"
                      />
                    </div>
                  </div>

                  {/* Maaltijden */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">Maaltijdmogelijkheden</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in">
                      {/* Ontbijt */}
                      <div className="flex flex-col gap-2 p-4 bg-white border border-outline rounded-2xl shadow-sm">
                        <span className="font-bold text-sm text-on-surface">Mogelijkheid tot ontbijt</span>
                        <div className="flex bg-surface-container rounded-xl p-1 text-[11px] font-bold">
                          {[
                            { label: 'Nee', value: false },
                            { label: 'Ja', value: true }
                          ].map(opt => (
                            <button 
                              key={String(opt.value)}
                              type="button"
                              onClick={() => updateFeature('vacation_breakfast', opt.value)}
                              className={`flex-1 py-1.5 rounded-lg transition-all ${!!formData.features.vacation_breakfast === opt.value ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lunch */}
                      <div className="flex flex-col gap-2 p-4 bg-white border border-outline rounded-2xl shadow-sm">
                        <span className="font-bold text-sm text-on-surface">Mogelijkheid tot lunch</span>
                        <div className="flex bg-surface-container rounded-xl p-1 text-[11px] font-bold">
                          {[
                            { label: 'Nee', value: false },
                            { label: 'Ja', value: true }
                          ].map(opt => (
                            <button 
                              key={String(opt.value)}
                              type="button"
                              onClick={() => updateFeature('vacation_lunch', opt.value)}
                              className={`flex-1 py-1.5 rounded-lg transition-all ${!!formData.features.vacation_lunch === opt.value ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Diner */}
                      <div className="flex flex-col gap-2 p-4 bg-white border border-outline rounded-2xl shadow-sm">
                        <span className="font-bold text-sm text-on-surface">Mogelijkheid tot diner</span>
                        <div className="flex bg-surface-container rounded-xl p-1 text-[11px] font-bold">
                          {[
                            { label: 'Nee', value: false },
                            { label: 'Ja', value: true }
                          ].map(opt => (
                            <button 
                              key={String(opt.value)}
                              type="button"
                              onClick={() => updateFeature('vacation_dinner', opt.value)}
                              className={`flex-1 py-1.5 rounded-lg transition-all ${!!formData.features.vacation_dinner === opt.value ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {activeTab === 'kitchen' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="bg-surface-container-low p-6 rounded-3xl border border-outline/50 space-y-6">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">{t('prop.kitchen.type')}</label>
                    <div className="flex gap-4">
                      {[
                        { label: t('prop.kitchen.shared'), value: 'shared' },
                        { label: t('prop.kitchen.private'), value: 'private' },
                        { label: t('prop.kitchen.none', 'Geen keuken'), value: 'none' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 flex items-center justify-center gap-2 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary shadow-sm border-2 border-outline/50">
                          <input 
                            type="radio" 
                            name="kitchen_type" 
                            className="hidden" 
                            checked={formData.features.kitchen_type === opt.value}
                            onChange={() => updateFeature('kitchen_type', opt.value)}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">{t('prop.kitchen.utensils')}</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: t('prop.kitchen.utensils_none'), value: 'none' },
                        { label: t('prop.kitchen.utensils_limited'), value: 'limited' },
                        { label: t('prop.kitchen.utensils_full'), value: 'full' }
                      ].map(opt => (
                        <label key={opt.value} className="flex flex-col items-center justify-center gap-1 p-3 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary shadow-sm border-2 border-outline/50">
                          <input 
                            type="radio" 
                            name="kitchen_utensils" 
                            className="hidden" 
                            checked={formData.features.kitchen_utensils === opt.value}
                            onChange={() => updateFeature('kitchen_utensils', opt.value)}
                          />
                          <span className="font-bold text-xs text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.kitchen.appliances', 'Kitchen Appliances')}</label>
                    <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">{t('prop.kitchen.specify_usage', 'Specify: Private or Shared')}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: 'dishwasher', label: t('prop.kitchen_gear.dishwasher', 'Vaatwasser') },
                      { key: 'microwave', label: t('prop.kitchen_gear.microwave', 'Magnetron') },
                      { key: 'oven', label: t('prop.kitchen_gear.oven', 'Oven') },
                      { key: 'refrigerator', label: t('prop.kitchen_gear.refrigerator', 'Koelkast') },
                      { key: 'freezer', label: t('prop.kitchen_gear.freezer', 'Vriezer') }
                    ].map(item => {
                      const gearObj = formData.features.kitchen_gear || {};
                      const isSelected = !!gearObj[item.key];
                      const usage = gearObj[item.key] || 'prive';

                      return (
                        <div key={item.key} className={`flex items-center justify-between p-4 bg-white border rounded-2xl transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-outline hover:bg-surface-container-low'}`}>
                          <label className="flex items-center gap-3 cursor-pointer flex-grow">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                const newGear = { ...gearObj };
                                if (e.target.checked) newGear[item.key] = 'prive';
                                else delete newGear[item.key];
                                updateFeature('kitchen_gear', newGear);
                              }}
                              className="w-5 h-5 rounded-md accent-primary"
                            />
                            <span className="font-bold text-sm">{item.label}</span>
                          </label>
                          
                          {isSelected && (
                            <div className="flex bg-white/50 p-1 rounded-xl border border-outline/50 scale-90 origin-right">
                              <button 
                                onClick={() => updateFeature('kitchen_gear', { ...gearObj, [item.key]: 'prive' })}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${usage === 'prive' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                              >
                                {t('common.private', 'Privé')}
                              </button>
                              <button 
                                onClick={() => updateFeature('kitchen_gear', { ...gearObj, [item.key]: 'gedeeld' })}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${usage === 'gedeeld' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                              >
                                {t('common.shared', 'Gedeeld')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'laundry' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {['washing_machine', 'dryer'].map(type => (
                    <div key={type} className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        {type === 'washing_machine' ? t('prop.laundry.washing_machine', 'Wasmachine') : t('prop.laundry.dryer', 'Droger')}
                      </label>
                      <div className="flex flex-col gap-2">
                        {[
                          { label: t('common.not_present', 'Niet aanwezig'), value: 'none' },
                          { label: t('common.private_use', 'Privé gebruik'), value: 'prive' },
                          { label: t('common.shared_use', 'Gedeeld gebruik'), value: 'gedeeld' }
                        ].map(opt => (
                          <label key={opt.value} className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                            <input 
                              type="radio" 
                              name={type} 
                              className="hidden" 
                              checked={(formData.features.laundry?.[type] || 'none') === opt.value}
                              onChange={() => {
                                const laundry = formData.features.laundry || {};
                                updateFeature('laundry', { ...laundry, [type]: opt.value });
                              }}
                            />
                            <span className="font-bold text-sm">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'period' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="p-4 md:p-8 bg-surface-container-low rounded-[1.5rem] md:rounded-[2rem] border border-outline/50">
                  <h4 className="text-xl font-display font-bold mb-6">{t('prop.period.availability', 'Beschikbaarheid')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-8 md:gap-y-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">{t('prop.period.available_from', 'Vanaf wanneer beschikbaar?')}</label>
                      <input 
                        type="date" 
                        value={formData.features.available_from || ''}
                        onChange={e => updateFeature('available_from', e.target.value)}
                        className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 h-[52px] focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                         {t('prop.period.min_stay', 'Minimale huurperiode (maanden)')} 
                         {(formData.features.goal === 'vakantie_onderhuur' || formData.features.goal === 'huisbewaring_expat') ? (
                           <span className="text-error ml-1">*</span>
                         ) : (
                           <span className="text-[10px] lowercase font-normal opacity-70 ml-1">({t('common.optional')})</span>
                         )}
                       </label>
                       <input 
                         type="number" 
                         value={formData.features.min_stay === 0 ? '' : (formData.features.min_stay || '')}
                         placeholder={t('prop.period.months_placeholder', 'Aantal maanden...')}
                         onChange={e => {
                            const valStr = e.target.value;
                            if (valStr === '') {
                              updateFeature('min_stay', '');
                              return;
                            }
                            const val = Number(valStr);
                            const minVal = val >= 1 ? val : 1;
                            setFormData(prev => {
                              const newFeatures = { ...prev.features, min_stay: minVal };
                              if (newFeatures.max_stay && newFeatures.max_stay < minVal) {
                                newFeatures.max_stay = minVal;
                              }
                              return { ...prev, features: newFeatures };
                            });
                         }}
                         className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 h-[52px] focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                       />
                     </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                        {t('prop.period.max_stay', 'Maximaal verblijf (maanden)')} 
                        {(formData.features.goal === 'vakantie_onderhuur' || formData.features.goal === 'huisbewaring_expat') ? (
                           <span className="text-error ml-1">*</span>
                        ) : (
                          <span className="text-[10px] lowercase font-normal opacity-70 ml-1">({t('common.optional')})</span>
                        )}
                      </label>
                      <input 
                        type="number" 
                        required={formData.features.goal === 'vakantie_onderhuur' || formData.features.goal === 'huisbewaring_expat'}
                        value={formData.features.max_stay || ''}
                        onChange={e => {
                           const val = e.target.value;
                           if (val === '') {
                             updateFeature('max_stay', '');
                             return;
                           }
                           
                           let numVal = Math.max(0, Number(val));
                           const minStay = formData.features.min_stay || 1;
                           if (numVal < minStay) numVal = minStay;
                           
                           setFormData(prev => ({
                             ...prev,
                             features: {
                               ...prev.features,
                               max_stay: numVal,
                               is_indefinite: val ? false : prev.features.is_indefinite
                             }
                           }));
                        }}
                        className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 h-[52px] focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                        placeholder={t('prop.period.months_placeholder', 'Aantal maanden...')}
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="h-4" /> {/* Spacer to align with labels above */}
                      {formData.features.goal !== 'vakantie_onderhuur' ? (
                        <label className="flex items-center gap-3 w-full cursor-pointer px-4 h-[52px] border-2 border-outline/50 rounded-xl bg-white shadow-sm hover:bg-surface-container-low transition-colors">
                           <input 
                             type="checkbox" 
                             checked={!!formData.features.is_indefinite}
                             onChange={e => {
                               const checked = e.target.checked;
                               setFormData(prev => ({
                                 ...prev,
                                 features: {
                                   ...prev.features,
                                   is_indefinite: checked,
                                   ...(checked ? { max_stay: '' } : {})
                                 }
                               }));
                             }}
                             className="w-5 h-5 rounded-md accent-primary"
                           />
                           <span className="text-sm font-bold">{t('prop.period.indefinite', 'Onbepaalde tijd / Geen maximum')}</span>
                        </label>
                      ) : (
                        <div className="h-[52px] px-4 flex items-center border-2 border-outline/10 bg-surface-container-low/30 rounded-xl w-full">
                          <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant/50">
                            {t('prop.period.fixed_only', 'Alleen vaste periode mogelijk')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'availability' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="p-8 bg-surface-container-low rounded-[2rem] border border-outline/50">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="text-xl font-display font-bold">{t('prop.availability.title_12_months', 'Beschikbaarheid komende 12 maanden')}</h4>
                      <p className="text-sm text-on-surface-variant mt-1">{t('prop.availability.desc')}</p>
                    </div>
                  </div>

                  {formData.status === 'paused' && (
                    <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl text-error font-medium flex items-center gap-2">
                       <AlertTriangle size={18} />
                       {t('prop.availability.paused_warning')}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {(() => {
                      const monthKeysShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                      const now = new Date();
                      const months = [];
                      for (let i = 0; i < 12; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const monthName = t(`prop.availability.month_${monthKeysShort[d.getMonth()]}`);
                        const year = d.getFullYear();
                        months.push({ key: monthKey, name: monthName, year });
                      }
                      
                      return months.map(m => {
                        const currentStatusId = formData.monthlyAvailability?.[m.key] || 'not_available';
                        const isSelected = currentStatusId !== 'not_available' && currentStatusId !== 'not_for_rent_month';
                        
                        let bgClass = "bg-surface-container-high text-on-surface-variant border-outline-variant";
                        let dotClass = "bg-on-surface-variant";
                        if (currentStatusId === 'available' || currentStatusId === 'free') {
                          bgClass = "bg-primary text-white border-primary shadow-md shadow-primary/20";
                          dotClass = "bg-white";
                        } else if (currentStatusId === 'consultation') {
                          bgClass = "bg-[#ffeedd] text-[#cc6600] border-[#ffcc99]";
                          dotClass = "bg-[#cc6600]";
                        } else if (currentStatusId === 'occupied') {
                          bgClass = "bg-[#ffdddd] text-[#cc0000] border-[#ff9999]";
                          dotClass = "bg-[#cc0000]";
                        }

                        return (
                          <div 
                            key={m.key} 
                            className={`flex flex-col p-4 rounded-2xl cursor-pointer border-2 transition-all group ${bgClass}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{m.year}</span>
                              <div className={`w-3 h-3 rounded-full flex items-center justify-center ${isSelected ? 'opacity-100' : 'opacity-30'} ${dotClass}`} />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight mb-3">{m.name}</span>
                            
                            <select
                              value={currentStatusId === 'free' ? 'available' : currentStatusId}
                              onChange={(e) => {
                                const newAvail = { ...(formData.monthlyAvailability || {}) };
                                newAvail[m.key] = e.target.value;
                                setFormData({ ...formData, monthlyAvailability: newAvail });
                              }}
                              className="text-xs font-bold rounded-lg px-2 py-1.5 w-full bg-white/20 text-current outline-none border border-transparent focus:border-current/30 cursor-pointer"
                            >
                              <option value="available" className="text-on-surface">{t('availability.available')}</option>
                              <option value="consultation" className="text-on-surface">{t('availability.consultation')}</option>
                              <option value="occupied" className="text-on-surface">{t('availability.occupied')}</option>
                              <option value="not_for_rent_month" className="text-on-surface">{t('availability.not_for_rent_month')}</option>
                              <option value="not_available" className="text-on-surface">{t('availability.not_available')}</option>
                            </select>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-4">
                    <button
                      onClick={() => {
                        const now = new Date();
                        const newAvail = { ...(formData.monthlyAvailability || {}) };
                        for (let i = 0; i < 12; i++) {
                          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                          if ([11, 0, 1].includes(d.getMonth())) {
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            newAvail[key] = newAvail[key] || 'free';
                          }
                        }
                        setFormData({ ...formData, monthlyAvailability: newAvail });
                      }}
                      className="px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
                    >
                      <PlusIcon size={14} />
                      {t('prop.availability.winter_months')}
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const newAvail = { ...(formData.monthlyAvailability || {}) };
                        for (let i = 0; i < 12; i++) {
                          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                          if ([5, 6, 7].includes(d.getMonth())) {
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            newAvail[key] = newAvail[key] || 'free';
                          }
                        }
                        setFormData({ ...formData, monthlyAvailability: newAvail });
                      }}
                      className="px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
                    >
                      <PlusIcon size={14} />
                      {t('prop.availability.summer_months')}
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const newAvail = { ...(formData.monthlyAvailability || {}) };
                        for (let i = 0; i < 12; i++) {
                          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                          newAvail[key] = 'free';
                        }
                        setFormData({ ...formData, monthlyAvailability: newAvail });
                      }}
                      className="px-6 py-3 bg-surface-container text-on-surface-variant font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-surface-container-high transition-all"
                    >
                      {t('prop.availability.select_all')}
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, monthlyAvailability: {} })}
                      className="px-6 py-3 bg-surface-container-low text-on-surface-variant font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-surface-container-high transition-all"
                    >
                      {t('prop.availability.clear_all')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'money' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="p-8 bg-surface-container-low rounded-[2rem] border border-outline/50">
                  <h4 className="text-xl font-display font-bold mb-6">{t('prop.money.title', 'Rent & Costs')}</h4>
                  <div className="space-y-6">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.price_type', 'Rent Type')} <span className="text-error">*</span></label>
                    <div className="flex gap-4">
                      {[
                        { label: t('prop.money.fixed', 'Vaste prijs'), value: 'fixed' },
                        
                        { label: t('prop.money.tbd', 'Nader te bepalen'), value: 'tbd' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 flex items-center justify-center p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary border-2 border-outline/50 shadow-sm text-center">
                          <input 
                            type="radio" 
                            name="priceType" 
                            className="hidden" 
                            checked={(formData.priceType || 'fixed') === opt.value}
                            onChange={() => setFormData({ ...formData, priceType: opt.value as any })}
                          />
                          <span className="font-bold text-xs">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 space-y-6">
                    {(formData.priceType || 'fixed') === 'fixed' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.monthly_amount', 'Monthly Rent')}</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                            <input 
                              type="number" 
                              value={formData.price === 0 ? '' : currencyConverter.toDisplay(formData.price || 0)} 
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '') {
                                  setFormData({...formData, price: 0});
                                  return;
                                }
                                setFormData({...formData, price: currencyConverter.toEur(Math.max(0, Number(val)))})
                              }}
                              className="w-full bg-white border-2 border-outline/50 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.additional_costs')}</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                            <input 
                              type="number" 
                              value={currencyConverter.toDisplay(formData.features.additional_costs || 0)} 
                              onChange={e => updateFeature('additional_costs', currencyConverter.toEur(Math.max(0, Number(e.target.value))))}
                              className="w-full bg-white border-2 border-outline/50 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {(formData.priceType === 'range') && (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.min_amount', 'Minimum Amount')}</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                                <input 
                                  type="number" 
                                  value={formData.minPrice !== undefined ? currencyConverter.toDisplay(formData.minPrice) : ''} 
                                  onChange={e => setFormData({...formData, minPrice: currencyConverter.toEur(Math.max(0, Number(e.target.value)))})}
                                  className="w-full bg-white border-2 border-outline/50 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.max_amount', 'Maximum Amount')}</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                                <input 
                                  type="number" 
                                  value={formData.maxPrice !== undefined ? currencyConverter.toDisplay(formData.maxPrice) : ''} 
                                  onChange={e => setFormData({...formData, maxPrice: currencyConverter.toEur(Math.max(0, Number(e.target.value)))})}
                                  className="w-full bg-white border-2 border-outline/50 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                                />
                              </div>
                            </div>
                          </div>

                        <div className="space-y-2 max-w-md">
                          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.additional_costs')}</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                            <input 
                              type="number" 
                              value={currencyConverter.toDisplay(formData.features.additional_costs || 0)} 
                              onChange={e => updateFeature('additional_costs', currencyConverter.toEur(Math.max(0, Number(e.target.value))))}
                              className="w-full bg-white border-2 border-outline/50 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {(formData.priceType || 'fixed') !== 'tbd' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.deposit', 'Deposit (Money)')}</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                            <input 
                              type="number" 
                              value={formData.features.deposit !== undefined ? currencyConverter.toDisplay(formData.features.deposit) : ''} 
                              onChange={e => updateFeature('deposit', currencyConverter.toEur(Math.max(0, Number(e.target.value))))}
                              className="w-full bg-white border-2 border-outline/50 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.money.description', 'Toelichting prijs & kosten')}</label>
                      <textarea 
                        value={formData.priceDescription || ''} 
                        onChange={e => setFormData({...formData, priceDescription: e.target.value})}
                        placeholder={t('prop.money.description_placeholder', 'bijv.: inclusief GWL, internet en belastingen.')}
                        rows={3}
                        className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'media_files' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div>
                    <h4 className="font-bold text-lg mb-1">{t('prop.category.media_files')} <span className="text-error">*</span></h4>
                  </div>
                  <button 
                    onClick={handleAddImage}
                    disabled={uploading || (formData.images || []).length >= 5}
                    className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus size={18} />
                    )}
                    {uploading ? 'Uploaden...' : t('prop.media.add')}
                  </button>
                </div>

                <div 
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleFiles(e.dataTransfer.files);
                    }
                  }}
                  className="p-8 bg-surface-container-low border-2 border-dashed border-outline-variant rounded-[2rem] text-center hover:bg-primary/5 hover:border-primary/50 transition-all group"
                >
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <ImageIcon className="text-primary" size={32} />
                  </div>
                  <p className="font-bold text-on-surface mb-1">{t('prop.editor.drop_files')}</p>
                  <p className="text-xs text-on-surface-variant font-medium">
                    {t('prop.editor.upload_count', { count: (formData.images || []).length })}. {t('prop.editor.upload_tip')}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {(formData.images || []).map((img) => (
                    <motion.div 
                      key={img.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border-2 border-outline/50 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 shadow-sm flex flex-col md:flex-row gap-4 md:gap-8 group hover:border-primary/40 transition-all min-w-0 overflow-hidden"
                    >
                      <div className="relative w-full md:w-48 lg:w-64 h-44 rounded-xl md:rounded-2xl overflow-hidden shrink-0 bg-surface-container shadow-inner">
                        <img src={img.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                        <div className="absolute inset-0 border border-black/5 rounded-2xl pointer-events-none" />
                        {formData.teaserImageId === img.id && (
                          <div className="absolute top-3 left-3 bg-primary text-on-primary p-1.5 rounded-xl shadow-lg border border-white/20">
                            <Star size={14} fill="currentColor" />
                          </div>
                        )}
                      </div>

                      <div className="flex-grow flex flex-col justify-between min-w-0">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 items-start min-w-0">
                          <div className="space-y-2 min-w-0">
                            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1">{t('prop.media.category')}</label>
                            <select 
                              value={img.category}
                              onChange={(e) => updateImage(img.id, { category: e.target.value })}
                              className="w-full bg-surface-container-low border-2 border-outline/50 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer hover:bg-white"
                            >
                              <option value="exterior">{t('prop.media.cat.exterior')}</option>
                              <option value="living">{t('prop.media.cat.living')}</option>
                              <option value="bedroom">{t('prop.media.cat.bedroom')}</option>
                              <option value="kitchen">{t('prop.media.cat.kitchen')}</option>
                              <option value="bathroom">{t('prop.media.cat.bathroom')}</option>
                              <option value="environment">{t('prop.media.cat.environment')}</option>
                              <option value="other">{t('prop.media.cat.other')}</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1">{t('prop.media.description')} ({t('prop.editor.max_chars', { count: 80 })})</label>
                            <div className="relative">
                              <input 
                                type="text"
                                value={img.description}
                                onChange={(e) => updateImage(img.id, { description: cleanDescription(e.target.value).slice(0, 80) })}
                                className="w-full bg-surface-container-low border-2 border-outline/50 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all placeholder:font-normal"
                                placeholder={t('prop.editor.placeholder_description', 'e.g.: Bright living room with park view')}
                              />
                            </div>
                            <div className="flex justify-between items-center px-1">
                              <span className={`text-[9px] font-black ${img.description?.length === 80 ? 'text-error' : 'text-on-surface-variant/40'}`}>
                                {img.description?.length || 0}/80
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-outline/30">
                          <div className="flex items-center gap-6">
                            <button 
                              onClick={() => setTeaser(img.id)}
                              className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all ${formData.teaserImageId === img.id ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
                            >
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${formData.teaserImageId === img.id ? 'bg-primary border-primary text-on-primary' : 'border-outline/50'}`}>
                                <CheckCircle2 size={12} />
                              </div>
                              {t('prop.media.teaser')}
                            </button>
                            <button 
                              onClick={() => {
                                setEditingImageId(img.id);
                                setCroppingImage(img.url);
                              }}
                              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all group/btn"
                            >
                              <Edit2 size={16} className="group-hover/btn:scale-110 transition-transform" />
                              {t('prop.editor.btn_edit')}
                            </button>
                          </div>
                          <button 
                            onClick={() => removeImage(img.id)}
                            className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all"
                            title={t('common.delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'entrance' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.entrance.access', 'Toegang')}</label>
                    <select 
                      value={formData.features.entrance_type || ''}
                      onChange={e => updateFeature('entrance_type', e.target.value)}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    >
                      <option value="">{t("common.select", "Selecteer...")}</option>
                      <option value="eigen">{t("prop.entrance.own", "Eigen voordeur")}</option>
                      <option value="gedeeld">{t("prop.entrance.shared", "Gezamenlijke entree")}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.entrance.floor_label', 'Verdieping')}</label>
                    <input 
                      type="number" 
                      value={formData.features.floor || ''}
                      onChange={e => updateFeature('floor', e.target.value)}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                      placeholder={t('prop.entrance.floor_placeholder', '0 for ground floor')}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={!!formData.features.has_elevator}
                      onChange={e => updateFeature('has_elevator', e.target.checked)}
                      className="w-5 h-5 rounded-md accent-primary"
                    />
                    <span className="font-bold text-sm">{t('prop.entrance.elevator', 'Lift aanwezig')}</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={!!formData.features.wheelchair_accessible}
                      onChange={e => updateFeature('wheelchair_accessible', e.target.checked)}
                      className="w-5 h-5 rounded-md accent-primary"
                    />
                    <span className="font-bold text-sm">{t('prop.entrance.wheelchair')}</span>
                  </label>
                </div>
              </motion.div>
            )}

            {activeTab === 'composition' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="p-6 bg-primary-container/30 rounded-2xl flex gap-4 items-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Users className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-on-primary-container font-bold">{t('prop.composition.title')}</p>
                    <p className="text-xs text-on-primary-container/80">{t('prop.composition.desc')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(formData.features.composition_residents || []).map((resident: any, i: number) => (
                    <motion.div 
                      key={resident.id || `res-${i}`} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white border-2 border-outline/50 rounded-3xl items-center shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="md:col-span-6 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Type</label>
                        <select 
                          value={resident.type}
                          onChange={e => {
                            const newResidents = formData.features.composition_residents.map((r: any) => 
                              r.id === resident.id ? { ...r, type: e.target.value } : r
                            );
                            updateFeature('composition_residents', newResidents);
                          }}
                          className="w-full bg-surface-container-low border border-outline/30 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                        >
                          <option value="men">👨 {t('prop.composition.men')}</option>
                          <option value="residence_only">🔑 {t('prop.composition.residence_only', 'Alleen bewoning')}</option>
                          <option value="women">👩 {t('prop.composition.women')}</option>
                          <option value="owner">🏠 {t('prop.composition.owner', 'Eigenaar')}</option>
                          <option value="other">👤 {t('prop.composition.other')}</option>
                          <option value="children">👶 {t('prop.composition.children')}</option>
                        </select>
                      </div>

                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('prop.composition.age_range')}</label>
                        <select 
                          value={resident.age || ''}
                          onChange={e => {
                            const newResidents = formData.features.composition_residents.map((r: any) => 
                              r.id === resident.id ? { ...r, age: e.target.value } : r
                            );
                            updateFeature('composition_residents', newResidents);
                          }}
                          className="w-full bg-surface-container-low border border-outline/30 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                        >
                          <option value="">{t("prop.composition.select_age", "Selecteer leeftijd...")}</option>
                          {Array.from({ length: 20 }).map((_, i) => {
                            const start = i * 5;
                            const end = start + 4;
                            const value = i === 19 ? '95+' : `${start}-${end}`;
                            return <option key={value} value={value}>{value} {t("prop.composition.years", "jaar")}</option>;
                          })}
                        </select>
                      </div>

                      <div className="md:col-span-1 flex justify-end pt-5">
                        <button 
                          onClick={() => {
                            const newResidents = formData.features.composition_residents.filter((r: any) => r.id !== resident.id);
                            updateFeature('composition_residents', newResidents);
                          }}
                          className="p-2 text-outline hover:text-amber-300 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  <button 
                    onClick={() => {
                      const newResident = { id: Math.random().toString(36).substr(2, 9), type: 'women', count: 1, age: '' };
                      updateFeature('composition_residents', [...(formData.features.composition_residents || []), newResident]);
                    }}
                    className="w-full py-4 border-2 border-dashed border-outline/50 rounded-3xl text-on-surface-variant font-bold hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                  >
                    <PlusIcon size={20} />
                    {t('prop.composition.add')}
                  </button>
                </div>

                <div className="pt-10 border-t border-outline/30 mt-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
                      <Star size={24} fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-on-background">{t('prop.looking_for.title')}</h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{t('prop.looking_for.desc')}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-6 bg-surface-container shadow-inner rounded-3xl border border-outline/20">
                       <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 block">{t('prop.composition.total_looking_for', 'Maximum aantal gezochte medebewoners')}</label>
                       <div className="flex items-center gap-8">
                          <div className="flex-grow space-y-1">
                            <span className="text-[10px] font-bold text-on-surface-variant/60 ml-1">{t('prop.looking_for.max_set', 'Maximum (totaal)')}</span>
                            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-outline/30">
                              <button onClick={() => updateFeature('looking_for_total_max', Math.max(1, (formData.features.looking_for_total_max || 1) - 1))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low hover:bg-primary/10 text-primary transition-all"><Minus size={16} /></button>
                              <span className="font-black text-xl flex-grow text-center">{formData.features.looking_for_total_max || 1}</span>
                              <button onClick={() => updateFeature('looking_for_total_max', (formData.features.looking_for_total_max || 1) + 1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low hover:bg-primary/10 text-primary transition-all"><PlusIcon size={16} /></button>
                            </div>
                          </div>
                       </div>
                    </div>

                    {(formData.features.composition_looking_for || []).map((pref: any, i: number) => (
                      <motion.div 
                        key={pref.id || `pref-${i}`} 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`grid grid-cols-1 md:grid-cols-12 gap-6 p-6 border-2 rounded-[2.5rem] items-start shadow-sm hover:shadow-md transition-all group ${
                          pref.isExcluded 
                            ? 'bg-error/5 border-error/20' 
                            : 'bg-white border-outline/50'
                        }`}
                      >
                        <div className="md:col-span-3 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Type</label>
                          <select 
                            value={pref.type}
                            onChange={e => {
                              const newPrefs = formData.features.composition_looking_for.map((p: any) => 
                                p.id === pref.id ? { ...p, type: e.target.value } : p
                              );
                              updateFeature('composition_looking_for', newPrefs);
                            }}
                            className="w-full bg-surface-container-low border border-outline/30 rounded-2xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
                          >
                            <option value="any">{t("prop.composition.all_welcome", "✨ Iedereen welkom")}</option>
                            <option value="men">👨 {t('prop.composition.men')}</option>
                            <option value="residence_only">🔑 {t('prop.composition.residence_only', 'Alleen bewoning')}</option>
                            <option value="women">👩 {t('prop.composition.women')}</option>
                            <option value="owner">🏠 {t('prop.composition.owner')}</option>
                            <option value="other">👤 {t('prop.composition.other')}</option>
                            <option value="children">👶 {t('prop.composition.children')}</option>
                          </select>
                        </div>

                        <div className="md:col-span-3 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('prop.composition.age_range')}</label>
                          <select 
                            value={pref.age || ''}
                            onChange={e => {
                              const newPrefs = formData.features.composition_looking_for.map((p: any) => 
                                p.id === pref.id ? { ...p, age: e.target.value } : p
                              );
                              updateFeature('composition_looking_for', newPrefs);
                            }}
                            className="w-full bg-surface-container-low border border-outline/30 rounded-2xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
                          >
                            <option value="">{t("prop.composition.all_ages", "Alle leeftijden")}</option>
                            {Array.from({ length: 20 }).map((_, i) => {
                              const start = i * 5;
                              const end = start + 4;
                              const value = i === 19 ? '95+' : `${start}-${end}`;
                              return <option key={value} value={value}>{value} {t("prop.composition.years", "jaar")}</option>;
                            })}
                          </select>
                        </div>

                        <div className="md:col-span-3 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Status</label>
                          <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-outline/30 gap-1 shadow-inner h-[46px]">
                            <button 
                              onClick={() => {
                                const newPrefs = formData.features.composition_looking_for.map((p: any) => 
                                  p.id === pref.id ? { ...p, isExcluded: false } : p
                                );
                                updateFeature('composition_looking_for', newPrefs);
                              }}
                              className={`flex-1 py-1 px-2 border rounded-xl text-[9px] whitespace-nowrap font-black uppercase tracking-widest transition-all ${!pref.isExcluded ? 'bg-green-600 border-green-700 text-white shadow-md scale-[1.05]' : 'border-transparent text-on-surface-variant hover:bg-green-50'}`}
                            >
                              {t('common.include', 'Welkom')}
                            </button>
                            <button 
                              onClick={() => {
                                const newPrefs = formData.features.composition_looking_for.map((p: any) => 
                                  p.id === pref.id ? { ...p, isExcluded: true } : p
                                );
                                updateFeature('composition_looking_for', newPrefs);
                              }}
                              className={`flex-1 py-1 px-2 border rounded-xl text-[9px] whitespace-nowrap font-black uppercase tracking-widest transition-all ${pref.isExcluded ? 'bg-red-500 border-red-600 text-white shadow-md scale-[1.05]' : 'border-transparent text-on-surface-variant hover:bg-red-50'}`}
                            >
                              {t('common.exclude', 'Niet welkom')}
                            </button>
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center block">
                            Strictheid
                          </label>
                          <div className="flex justify-between items-center gap-1 mt-1 bg-surface-container-low p-1.5 rounded-2xl border border-outline/30 h-[46px]">
                             {[1, 2, 3, 4, 5].map(star => (
                               <button 
                                 key={star}
                                 onClick={() => {
                                   const newPrefs = formData.features.composition_looking_for.map((p: any) => 
                                     p.id === pref.id ? { ...p, strictness: star } : p
                                   );
                                   updateFeature('composition_looking_for', newPrefs);
                                 }}
                                 className="transition-all hover:scale-125"
                               >
                                 <Star 
                                   size={14} 
                                   className={`transition-colors ${pref.strictness >= star ? (pref.isExcluded ? 'text-error' : 'text-primary') : 'text-outline/40'}`}
                                   fill={pref.strictness >= star ? "currentColor" : "none"} 
                                 />
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="md:col-span-1 flex justify-end md:justify-center md:pt-6">
                          <button 
                            onClick={() => {
                              const newPrefs = formData.features.composition_looking_for.filter((p: any) => p.id !== pref.id);
                              updateFeature('composition_looking_for', newPrefs);
                            }}
                            className="p-3 text-outline hover:text-error hover:bg-error/10 rounded-2xl transition-all shadow-sm bg-surface-container"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </motion.div>
                    ))}

                    <button 
                      onClick={() => {
                        const newPref = { id: Math.random().toString(36).substr(2, 9), type: 'any', age: '', strictness: 3 };
                        updateFeature('composition_looking_for', [...(formData.features.composition_looking_for || []), newPref]);
                      }}
                      className="w-full py-5 border-2 border-dashed border-outline/50 rounded-3xl text-on-surface-variant font-bold hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                    >
                      <PlusIcon size={24} />
                      {t('prop.looking_for.add')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'media' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Internet</label>
                    <select 
                      value={formData.features.internet || ''}
                      onChange={e => updateFeature('internet', e.target.value)}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    >
                      <option value="">{t("common.select", "Selecteer...")}</option>
                      <option value="geen">{t("prop.wifi.none", "Geen")}</option>
                      <option value="basis">{t("prop.wifi.basic", "Basis internet")}</option>
                      <option value="snel">{t("prop.wifi.fast", "Snel (Glasvezel/Kabel)")}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">TV</label>
                    <select 
                      value={formData.features.tv || ''}
                      onChange={e => updateFeature('tv', e.target.value)}
                      className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                    >
                      <option value="">{t("common.select", "Selecteer...")}</option>
                      <option value="geen">{t("prop.tv.none", "Geen aansluiting")}</option>
                      <option value="kabel">{t("prop.tv.cable", "Kabelaansluiting")}</option>
                      <option value="smart">{t("prop.tv.smart", "Smart TV aanwezig")}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-outline/50 pt-4">
                  <label className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={!!formData.features.has_wifi}
                      onChange={e => updateFeature('has_wifi', e.target.checked)}
                      className="w-5 h-5 rounded-md accent-primary"
                    />
                    <span className="font-bold text-sm">{t('prop.internet.wifi', 'Wifi')}</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={!!formData.features.free_internet}
                      onChange={e => updateFeature('free_internet', e.target.checked)}
                      className="w-5 h-5 rounded-md accent-primary"
                    />
                    <span className="font-bold text-sm">{t('prop.internet.free', 'Gratis internet')}</span>
                  </label>
                </div>

                <div className="space-y-4 border-t border-outline/50 pt-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.category.media', 'Internet & Smart Home')}</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Netflix', 'HBO Max', 'Disney+', 'Amazon Prime', 'Viaplay', 'Apple TV', 'SkyShowtime'].map(service => (
                      <label key={service} className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                        <input 
                          type="checkbox" 
                          checked={(formData.features.streaming_services || []).includes(service)}
                          onChange={(e) => {
                            const services = formData.features.streaming_services || [];
                            if (e.target.checked) updateFeature('streaming_services', [...services, service]);
                            else updateFeature('streaming_services', services.filter((s: string) => s !== service));
                          }}
                          className="w-5 h-5 rounded-md accent-primary"
                        />
                        <span className="font-bold text-xs">{service}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all focus-within:border-primary focus-within:bg-primary/10 shadow-sm col-span-2">
                       <span className="font-bold text-xs whitespace-nowrap">{t('common.other', 'Anders')}:</span>
                       <input 
                         type="text" 
                         value={formData.features.streaming_other || ''}
                         onChange={e => updateFeature('streaming_other', e.target.value)}
                         maxLength={40}
                         className="flex-grow bg-transparent border-b border-outline/30 focus:border-primary outline-none px-2 py-1 text-sm font-medium"
                         placeholder={t('prop.editor.max_chars_limit', { max: 40, defaultValue: 'Max 40 karakters' })}
                       />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'climate' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.amenities.heating', 'Heating')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { id: 'centrale_verwarming', label: t('prop.heating.central', 'Central Heating') },
                      { id: 'vloerverwarming', label: t('prop.heating.underfloor', 'Underfloor Heating') },
                      { id: 'luchtverwarming', label: t('prop.heating.air', 'Air Heating') },
                      { id: 'electrisch', label: t('prop.heating.electrical', 'Electrical Heating') }
                    ].map(type => (
                      <label key={type.id} className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                        <input 
                          type="checkbox" 
                          checked={(formData.features.heating_types || []).includes(type.id)}
                          onChange={(e) => {
                            const types = formData.features.heating_types || [];
                            if (e.target.checked) updateFeature('heating_types', [...types, type.id]);
                            else updateFeature('heating_types', types.filter((t: string) => t !== type.id));
                          }}
                          className="w-5 h-5 rounded-md accent-primary"
                        />
                        <span className="font-bold text-sm">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-outline/50">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.amenities.ventilation', 'Ventilation & Cooling')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={!!formData.features.has_ac}
                        onChange={e => updateFeature('has_ac', e.target.checked)}
                        className="w-5 h-5 rounded-md accent-primary"
                      />
                      <span className="font-bold text-sm">{t('prop.ventilation.ac', 'Airconditioning')}</span>
                    </label>
                    <label className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={!!formData.features.ventilation}
                        onChange={e => updateFeature('ventilation', e.target.checked)}
                        className="w-5 h-5 rounded-md accent-primary"
                      />
                      <span className="font-bold text-sm">{t('prop.ventilation.mechanical', 'Mechanical Ventilation')}</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'outside' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.amenities.outdoor_type', 'Buitenruimte Type & Gebruik')}</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'has_garden', label: t('prop.outdoor.garden', 'Garden') },
                      { id: 'has_balcony', label: t('prop.outdoor.balcony', 'Balcony') },
                      { id: 'has_terrace', label: t('prop.outdoor.terrace', 'Terrace') },
                      { id: 'has_roof_terrace', label: t('prop.outdoor.roof_terrace', 'Roof Terrace') }
                    ].map(opt => {
                      const isSelected = !!formData.features[opt.id];
                      const usageMap = formData.features.outside_usage || {};
                      const usage = usageMap[opt.id] || 'prive';

                      return (
                        <div key={opt.id} className={`flex items-center justify-between p-4 bg-white border rounded-2xl transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-outline hover:bg-surface-container-low'}`}>
                          <label className="flex items-center gap-3 cursor-pointer flex-grow">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                updateFeature(opt.id, e.target.checked);
                                if (e.target.checked && !usageMap[opt.id]) {
                                  updateFeature('outside_usage', { ...usageMap, [opt.id]: 'prive' });
                                }
                              }}
                              className="w-5 h-5 rounded-md accent-primary"
                            />
                            <span className="font-bold text-sm">{opt.label}</span>
                          </label>
                          
                          {isSelected && (
                            <div className="flex bg-white/50 p-1 rounded-xl border border-outline/50 scale-90 origin-right">
                              <button 
                                onClick={() => updateFeature('outside_usage', { ...usageMap, [opt.id]: 'prive' })}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${usage === 'prive' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                              >
                                {t('common.private', 'Privé')}
                              </button>
                              <button 
                                onClick={() => updateFeature('outside_usage', { ...usageMap, [opt.id]: 'gedeeld' })}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${usage === 'gedeeld' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                              >
                                {t('common.shared', 'Gedeeld')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'safety' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'smoke_detector', label: t('prop.safety.smoke_detector', 'Smoke Detector') },
                    { id: 'carbon_monoxide_detector', label: t('prop.safety.carbon_monoxide', 'Carbon Monoxide Detector') },
                    { id: 'fire_extinguisher', label: t('prop.safety.fire_extinguisher', 'Fire Extinguisher') },
                    { id: 'first_aid_kit', label: t('prop.safety.first_aid', 'First Aid Kit') },
                    { id: 'alarm_system', label: t('prop.safety.alarm') }
                  ].map(opt => (
                    <label key={opt.id} className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={!!formData.features[opt.id]}
                        onChange={e => updateFeature(opt.id, e.target.checked)}
                        className="w-5 h-5 rounded-md accent-primary"
                      />
                      <span className="font-bold text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'parking' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.parking.label', 'Parking')}</label>
                  <select 
                    value={formData.features.parking || ''}
                    onChange={e => updateFeature('parking', e.target.value)}
                    className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                  >
                    <option value="">{t("common.select", "Selecteer...")}</option>
                    <option value="geen">{t("prop.park.none", "Geen parkeerplek")}</option>
                    <option value="prive">{t("prop.park.private", "Privé parkeerplek")}</option>
                    <option value="garage">{t("prop.park.garage", "Garage")}</option>
                    <option value="carport">{t("prop.park.carport", "Carport")}</option>
                  </select>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-outline/50">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.amenities.other_storage', 'Overige Opslag')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { id: 'bike_storage', label: t('prop.storage.bicycle', 'Bicycle Storage') },
                      { id: 'scooter_storage', label: t('prop.storage.scooter', 'Scooter Storage') },
                      { id: 'motorcycle_storage', label: t('prop.storage.motorcycle', 'Motorcycle Storage') },
                      { id: 'covered_storage', label: t('prop.parking.covered_desc') },
                      { id: 'ev_charger', label: t('prop.storage.ev_charger', 'EV Charging Point') }
                    ].map(type => (
                      <label key={type.id} className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                        <input 
                          type="checkbox" 
                          checked={(formData.features.parking_types || []).includes(type.id)}
                          onChange={(e) => {
                            const types = formData.features.parking_types || [];
                            if (e.target.checked) updateFeature('parking_types', [...types, type.id]);
                            else updateFeature('parking_types', types.filter((t: string) => t !== type.id));
                          }}
                          className="w-5 h-5 rounded-md accent-primary"
                        />
                        <span className="font-bold text-sm">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'pets' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant italic">{t('prop.pets.for_tenant', 'For the Tenant')}</label>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">{t('prop.pets.allowed_question', 'Pets allowed?')}</label>
                  <div className="flex gap-4">
                    {[
                      { label: t('common.no', 'No'), value: 'no' },
                      { label: t('common.in_consultation', 'In consultation'), value: 'consult' },
                      { label: t('common.yes', 'Yes'), value: 'yes' }
                    ].map(opt => (
                      <label key={opt.value} className="flex-1 flex items-center justify-center gap-2 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:border-primary border-2 border-outline/50 shadow-sm">
                        <input 
                          type="radio" 
                          name="pets" 
                          className="hidden" 
                          checked={formData.features.pets === opt.value}
                          onChange={() => updateFeature('pets', opt.value)}
                        />
                        <span className="font-bold text-sm text-center">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  
                  {formData.features.pets !== 'no' && (
                    <div className="pt-4">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">{t('prop.pets.which_allowed', 'Which pets are allowed?')}</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[t('prop.pets.dogs', 'Dogs'), t('prop.pets.cats', 'Cats'), t('prop.pets.birds', 'Birds'), t('prop.pets.rodents', 'Rodents'), t('prop.pets.aquarium', 'Aquarium'), t('prop.pets.reptiles', 'Reptiles')].map(pet => (
                          <label key={pet} className="flex items-center gap-2 p-3 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                            <input 
                              type="checkbox" 
                              checked={(formData.features.tenant_pets_allowed || []).includes(pet)}
                              onChange={(e) => {
                                const allowed = formData.features.tenant_pets_allowed || [];
                                if (e.target.checked) updateFeature('tenant_pets_allowed', [...allowed, pet]);
                                else updateFeature('tenant_pets_allowed', allowed.filter((p: string) => p !== pet));
                              }}
                              className="w-4 h-4 rounded-md accent-primary"
                            />
                            <span className="text-xs font-bold">{pet}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-8 border-t border-outline/50">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant italic">{t('prop.pets.in_house', 'In the Property')}</label>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">{t('prop.pets.landlord_pets_present_q', 'Are there any pets from the landlord present?')}</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[t('prop.pets.dogs', 'Dogs'), t('prop.pets.cats', 'Cats'), t('prop.pets.birds', 'Birds'), t('prop.pets.rodents', 'Rodents'), t('prop.pets.aquarium', 'Aquarium'), t('prop.pets.reptiles', 'Reptiles')].map(pet => (
                      <label key={pet} className="flex items-center gap-2 p-3 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                        <input 
                          type="checkbox" 
                          checked={(formData.features.landlord_pets || []).includes(pet)}
                          onChange={(e) => {
                            const pets = formData.features.landlord_pets || [];
                            if (e.target.checked) updateFeature('landlord_pets', [...pets, pet]);
                            else updateFeature('landlord_pets', pets.filter((p: string) => p !== pet));
                          }}
                          className="w-4 h-4 rounded-md accent-primary"
                        />
                        <span className="text-xs font-bold">{pet}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'surroundings' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.omgeving.locatie', 'Woning bevindt zich in')}</label>
                  <select 
                    value={formData.features.street_type || ''}
                    onChange={e => updateFeature('street_type', e.target.value)}
                    className="w-full bg-white border-2 border-outline/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold"
                  >
                    <option value="">{t("common.select", "Selecteer...")}</option>
                    <option value="rustig">{t("prop.omgeving.rustig", "Rustige straat")}</option>
                    <option value="levendig">{t("prop.omgeving.levendig", "Levendige straat")}</option>
                    <option value="druk">{t("prop.omgeving.druk", "Drukke straat")}</option>
                    <option value="winkelstraat">{t("prop.omgeving.winkelstraat", "Winkelstraat")}</option>
                  </select>
                </div>

                <div className="space-y-6 pt-4 border-t border-outline/50">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('prop.amenities.nearby', 'Nearby Facilities')}</label>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { id: 'train', label: t('prop.nearby.train', 'Train Station'), hasName: true },
                      { id: 'bus', label: t('prop.nearby.bus', 'Bus Stop / Metro') },
                      { id: 'shops', label: t('prop.nearby.shops', 'Shops / Supermarket') },
                      { id: 'nature', label: t('prop.nearby.nature', 'Nature / Park') }
                    ].map(opt => {
                      const envData = formData.features.surroundings || {};
                      const isPresent = envData[opt.id]?.present || false;
                      const distance = envData[opt.id]?.distance || '';
                      const name = envData[opt.id]?.name || '';

                      return (
                        <div key={opt.id} className={`p-4 bg-white border rounded-2xl transition-all ${isPresent ? 'border-primary bg-primary/5' : 'border-outline'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={isPresent}
                                onChange={(e) => updateFeature('surroundings', { 
                                  ...envData, 
                                  [opt.id]: { ...envData[opt.id], present: e.target.checked }
                                })}
                                className="w-5 h-5 rounded-md accent-primary"
                              />
                              <span className="font-bold text-sm">{opt.label}</span>
                            </label>
                            
                            {isPresent && (
                              <select 
                                value={distance}
                                onChange={(e) => updateFeature('surroundings', {
                                  ...envData,
                                  [opt.id]: { ...envData[opt.id], distance: e.target.value }
                                })}
                                className="bg-white border-2 border-outline/50 rounded-lg px-3 py-1.5 text-[10px] font-bold focus:ring-1 focus:ring-primary outline-none"
                              >
                                <option value="">{t("common.distance", "Distance...")}</option>
                                <option value="< 5 min">{t("prop.dist.walk", "Walking distance (< 5 min)")}</option>
                                <option value="5-10 min">{t("prop.dist.close", "Nearby (5-10 min)")}</option>
                                <option value="10-20 min">{t("prop.dist.reachable", "Reachable (10-20 min)")}</option>
                                <option value="> 20 min">{t("prop.dist.far", "Further away (> 20 min)")}</option>
                              </select>
                            )}
                          </div>
                          
                          {isPresent && opt.hasName && (
                            <div className="mt-2 pl-8">
                              <input 
                                type="text"
                                value={name}
                                onChange={(e) => updateFeature('surroundings', {
                                  ...envData,
                                  [opt.id]: { ...envData[opt.id], name: e.target.value }
                                })}
                                placeholder={t('prop.nearby.name_placeholder', 'Name of {{facility}} (optional)', { facility: opt.label.toLowerCase() })}
                                className="w-full bg-white border-2 border-outline/50 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'extra' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="p-8 bg-surface-container-low rounded-[2rem] border border-outline/50 space-y-8">
                  <div>
                    <h3 className="text-xl font-display font-bold mb-4">{t('prop.category.extra', 'Extra')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 bg-white border-2 border-outline/50 rounded-xl w-full">
                        <span className="font-bold text-sm tracking-tight text-on-surface">{t('prop.extra.smoking', 'Roken in huis')}</span>
                        <div className="flex gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="smoking_allowed"
                              checked={formData.features.smoking_allowed === true}
                              onChange={() => updateFeature('smoking_allowed', true)}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm font-bold">Ja</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer ml-4">
                            <input 
                              type="radio" 
                              name="smoking_allowed"
                              checked={formData.features.smoking_allowed === false}
                              onChange={() => updateFeature('smoking_allowed', false)}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm font-bold">Nee</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {formData.features.goal === 'vakantie_onderhuur' && (
                    <div className="pt-8 border-t border-outline/30">
                      <h3 className="text-xl font-display font-bold mb-4">{t('prop.extra.holidays_title', 'Vakantie & Ontspanning')}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { key: 'pool', label: t('prop.extra.pool', 'Zwembad') },
                          { key: 'beach', label: t('prop.extra.beach', 'Dichtbij strand') },
                          { key: 'sauna', label: t('prop.extra.sauna', 'Sauna') },
                          { key: 'gym', label: t('prop.extra.gym', 'Fitnessruimte') },
                          { key: 'bbq', label: t('prop.extra.bbq', 'BBQ aanwezig') },
                          { key: 'playground', label: t('prop.extra.playground', 'Speeltuin') },
                          { key: 'bicycles', label: t('prop.extra.bicycles', 'Fietsen beschikbaar') },
                          { key: 'ski', label: t('prop.extra.ski', 'Dichtbij ski-piste') }
                        ].map(item => (
                          <label key={item.key} className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm">
                            <input 
                              type="checkbox" 
                              checked={!!formData.features[item.key]}
                              onChange={(e) => updateFeature(item.key, e.target.checked)}
                              className="w-5 h-5 rounded-md accent-primary"
                            />
                            <span className="font-bold text-sm">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'condition' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
                    <Paintbrush size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-on-background">{t('prop.condition.title')}</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{t('prop.condition.desc')}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 block">{t('prop.condition.state')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'ready', label: t('prop.condition.ready'), icon: '✨' },
                      { id: 'work', label: t('prop.condition.work'), icon: '🧹' },
                      { id: 'restore', label: t('prop.condition.restore'), icon: '🔨' }
                    ].map(opt => (
                      <button 
                        key={opt.id}
                        onClick={() => updateFeature('condition_state', opt.id)}
                        className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border transition-all ${
                          formData.features.condition_state === opt.id 
                            ? 'bg-primary border-primary text-on-primary shadow-lg shadow-primary/20 scale-105 z-10' 
                            : 'bg-white border-outline hover:border-primary/50 text-on-surface-variant'
                        }`}
                      >
                        <span className="text-3xl">{opt.icon}</span>
                        <span className="text-xs font-black text-center uppercase tracking-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 pt-10 border-t border-outline/30">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 block">{t('prop.condition.modifications')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { id: 'wallpaper', label: t('prop.condition.wallpaper') },
                      { id: 'paint', label: t('prop.condition.paint') },
                      { id: 'flooring', label: t('prop.condition.flooring') },
                      { id: 'drilling', label: t('prop.condition.drilling') },
                      { id: 'other', label: t('prop.condition.other') }
                    ].map(opt => {
                      const modifications = formData.features.condition_modifications || [];
                      const isSelected = modifications.includes(opt.id);
                      
                      return (
                        <label 
                          key={opt.id}
                          className="flex items-center gap-3 p-4 bg-white border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary shadow-sm"
                        >
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newMods = e.target.checked 
                                ? [...modifications, opt.id]
                                : modifications.filter((m: string) => m !== opt.id);
                              updateFeature('condition_modifications', newMods);
                            }}
                            className="w-5 h-5 rounded-md accent-primary"
                          />
                          <span className="font-bold text-sm tracking-tight">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tenant_prefs' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
                    <Star size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-on-background">{t('prop.prefs.title')}</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{t('prop.prefs.desc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { id: 'pref_garden_maintenance', label: t('prop.prefs.garden_maintenance', 'Tuinonderhoud') },
                    { id: 'pref_sporty', label: t('prop.preference.pref_sporty', 'Sportief') },
                    { id: 'pref_cooking', label: t('prop.preference.pref_cooking', 'Houdt van koken') },
                    { id: 'pref_irregular_hours', label: t('prop.preference.pref_irregular_hours', 'Onregelmatige uren') },
                    { id: 'pref_retired', label: t('prop.preference.pref_retired', 'Gepensioneerd') },
                    { id: 'pref_tv_english', label: t('prop.preference.pref_tv_english', 'TV Engels / Internationaal') },
                    { id: 'pref_tv_scandi', label: t('prop.preference.pref_tv_scandi', 'TV Scandinavisch') },
                    { id: 'pref_bingewatch', label: t('prop.preference.pref_bingewatch', 'Bingewatcher') },
                    { id: 'pref_board_games', label: t('prop.preference.pref_board_games', 'Houdt van bordspellen') },
                    { id: 'pref_quiet_evenings', label: t('prop.preference.pref_quiet_evenings', 'Rustige avonden') },
                    { id: 'pref_tidy', label: t('prop.preference.pref_tidy', 'Netjes / Opgeruimd') },
                    { id: 'pref_creative', label: t('prop.preference.pref_creative', 'Creatief') },
                    { id: 'pref_political', label: t('prop.preference.pref_political', 'Politiek betrokken') },
                    { id: 'pref_handyman', label: t('prop.preference.pref_handyman', 'Handig') },
                    { id: 'pref_renovation', label: t('prop.preference.pref_renovation', 'Houdt van renoveren') }
                  ].map(opt => (
                    <div key={opt.id} className="flex flex-col gap-2 p-4 rounded-2xl border border-outline bg-white hover:border-primary/30 transition-all shadow-sm">
                      <span className="font-bold text-xs tracking-tight text-on-surface line-clamp-1" title={opt.label}>{opt.label}</span>
                      <StarRating 
                        value={formData.features[opt.id] || 0} 
                        onChange={(val) => updateFeature(opt.id, val === formData.features[opt.id] ? 0 : val)}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-6 mt-12 bg-surface-container-low p-6 rounded-3xl border border-outline">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-on-background uppercase tracking-wider text-sm">{t('prop.prefs.languages')}</h4>
                    </div>
                  </div>
                  
                  {/* List out selected languages */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(() => {
                      const selectedLangs = formData.features.pref_languages || [];
                      if (selectedLangs.length === 0) {
                        return <div className="col-span-full"><p className="text-sm font-bold text-on-surface-variant p-4 text-center border-2 border-dashed border-outline-variant rounded-2xl">{t('prop.prefs.lang_any')}</p></div>;
                      }
                      return selectedLangs.map((langObj: any, index: number) => {
                         const langName = LANGUAGES_SORTED.find(l => l.id === langObj.code)?.name || langObj.code;
                         return (
                           <div key={`${langObj.code}-${index}`} className="flex flex-col gap-3 p-4 rounded-2xl border border-outline bg-white shadow-sm hover:border-primary/30 transition-all">
                             <div className="flex items-center justify-between">
                               <span className="font-bold text-sm tracking-tight text-on-surface">{langName}</span>
                               <button 
                                 onClick={() => {
                                   const newLangs = [...selectedLangs];
                                   newLangs.splice(index, 1);
                                   updateFeature('pref_languages', newLangs);
                                 }}
                                 className="w-7 h-7 flex items-center justify-center bg-error/10 text-error rounded-full hover:bg-error/20 transition-colors shrink-0"
                               >
                                 <Trash2 size={14} />
                               </button>
                             </div>
                             <StarRating 
                               value={langObj.rating || 0} 
                               onChange={(val) => {
                                 const newLangs = [...selectedLangs];
                                 newLangs[index].rating = val === newLangs[index].rating ? 0 : val;
                                 updateFeature('pref_languages', newLangs);
                               }}
                             />
                           </div>
                         );
                      });
                    })()}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-outline/50 mt-4">
                    <select 
                      className="bg-white border border-outline rounded-xl px-4 py-2 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none text-on-surface"
                      value=""
                      onChange={(e) => {
                         if (!e.target.value) return;
                         const selectedLangs = formData.features.pref_languages || [];
                         if (!selectedLangs.find((l: any) => l.code === e.target.value)) {
                           updateFeature('pref_languages', [...selectedLangs, { code: e.target.value, rating: 3 }]);
                         }
                      }}
                    >
                      <option value="">+ {t('prop.prefs.lang_add')}</option>
                      {LANGUAGES_SORTED.map(lang => {
                        const selectedLangs = formData.features.pref_languages || [];
                        if (selectedLangs.find((l: any) => l.code === lang.id)) return null;
                        return <option key={lang.id} value={lang.id}>{lang.name}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          <AnimatePresence>
            {canScrollContent && ['short', 'full', 'free_text'].includes(editorMode) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-32 right-8 z-[20] pointer-events-none"
              >
                <div className="bg-primary text-on-primary p-2 rounded-full shadow-2xl animate-bounce border-2 border-white">
                  <ChevronDown size={20} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-12 flex justify-end gap-3 px-8 pb-10 pt-8 border-t border-outline bg-white/80 backdrop-blur-md sticky bottom-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <button 
              onClick={() => setEditorMode('selector')}
              className="px-8 py-3 rounded-2xl font-bold border-2 border-outline/50 text-on-surface-variant hover:bg-surface-container-low transition-all"
              title={t('common.close')}
            >
              {t('common.close')}
            </button>
            <button 
              onClick={() => handleUpdate(true)} 
              disabled={saving}
              className="px-12 py-3 rounded-2xl font-black bg-primary text-on-primary shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center gap-2 transition-all uppercase tracking-widest text-xs"
            >
              {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
              {t('prop.save')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Fullscreen Map Modal */}
      <AnimatePresence>
        {isMapFullscreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-on-background/80 backdrop-blur-xl p-4 md:p-12 flex items-center justify-center"
          >
            <motion.div 
              layoutId="map-fullscreen"
              className="bg-background w-full h-full rounded-[2.5rem] overflow-hidden flex flex-col border border-outline shadow-2xl relative"
            >
              <div className="absolute top-6 right-6 z-[2000] flex gap-2">
                <button 
                  onClick={() => setIsMapFullscreen(false)} 
                  className="bg-white border border-outline p-3 rounded-full shadow-lg hover:bg-surface-container-low transition-all text-on-surface"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="absolute top-6 left-6 z-[2000] flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur p-4 rounded-2xl border border-outline shadow-xl max-w-sm">
                   <h3 className="font-display font-bold text-lg mb-1">{t('prop.address.edit_title', 'Edit Location')}</h3>
                   <p className="text-xs text-on-surface-variant mb-4 font-medium">{t('prop.address.edit_desc', 'Use the buttons to refine the view.')}</p>
                   
                   <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                        <span className="text-xs font-bold uppercase tracking-wider">{t('prop.address.radius', 'Radius')}</span>
                        <div className="flex items-center gap-3">
                           <button onClick={() => updateRadius(-100)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-outline/50 rounded-lg transition-colors hover:bg-primary-container"><Minus size={14} /></button>
                           <span className="text-xs font-mono font-bold w-12 text-center">{formData.displayRadius}m</span>
                           <button onClick={() => updateRadius(100)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-outline/50 rounded-lg transition-colors hover:bg-primary-container"><PlusIcon size={14} /></button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                        <span className="text-xs font-bold uppercase tracking-wider">{t('prop.address.shift', 'Shift')}</span>
                        <div className="grid grid-cols-3 gap-1">
                          <div />
                          <button onClick={() => shiftLocation(1, 0)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-outline/50 rounded-lg transition-colors hover:bg-primary-container"><ChevronUp size={14} /></button>
                          <div />
                          <button onClick={() => shiftLocation(0, -1)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-outline/50 rounded-lg transition-colors hover:bg-primary-container"><ChevronLeft size={14} /></button>
                          <div className="flex items-center justify-center"><MapPin size={10} className="text-primary" /></div>
                          <button onClick={() => shiftLocation(0, 1)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-outline/50 rounded-lg transition-colors hover:bg-primary-container"><ChevronRight size={14} /></button>
                          <div />
                          <button onClick={() => shiftLocation(-1, 0)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-outline/50 rounded-lg transition-colors hover:bg-primary-container"><ChevronDown size={14} /></button>
                          <div />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setMapType('street')}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${mapType === 'street' ? 'bg-primary text-on-primary border-primary' : 'border-outline hover:bg-surface-container-low'}`}
                        >
                          {t('prop.address.map', 'Map')}
                        </button>
                        <button 
                          onClick={() => setMapType('satellite')}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${mapType === 'satellite' ? 'bg-primary text-on-primary border-primary' : 'border-outline hover:bg-surface-container-low'}`}
                        >
                          {t('prop.address.satellite', 'Satellite')}
                        </button>
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex-grow">
                <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url={mapType === 'street' 
                      ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    }
                  />
                  <Circle 
                    center={mapCenter} 
                    radius={formData.displayRadius || 500} 
                    pathOptions={{ color: 'var(--color-primary)', fillColor: 'var(--color-primary)', fillOpacity: 0.2 }}
                  />
                  <MapUpdater center={mapCenter} />
                </MapContainer>
              </div>

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-8 py-4 rounded-2xl border border-outline shadow-2xl z-[2000]">
                 <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">{t('prop.editor.map_preview_location', 'Preview Location')}</span>
                      <span className="font-bold text-primary">{formData.city}, {formData.neighborhood || t('common.entire_city', 'Entire City')}</span>
                    </div>
                    <button 
                      onClick={() => setIsMapFullscreen(false)}
                      className="bg-primary text-on-primary px-6 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90"
                    >
                      {t('common.done', 'Done')}
                    </button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {croppingImage && (
          <ImageCropperModal 
            src={croppingImage}
            onCancel={() => setCroppingImage(null)}
            onComplete={onCropComplete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

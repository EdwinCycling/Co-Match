import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, MapPin, Euro, Heart, Sparkles, CheckCircle2, ChevronRight, ChevronLeft,
  Save, Cigarette, Briefcase, Utensils, Moon, Layout, DoorOpen, ChefHat, Wifi, Wind, 
  Thermometer, TreePine, ShieldCheck, Car, Dog, AlertCircle, Plus, Trash2, Home,
  Building2, Compass, Accessibility, Camera, Upload, Image as ImageIcon,
  Search, Map as MapIcon, ChevronUp, ChevronDown, LocateFixed, Plus as PlusIcon, Minus, Eye, Layers, Maximize2
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { grantCompletionBonus, saveSeekerProfile } from '../services/userService';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useSettings } from '../contexts/SettingsContext';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useCurrencyConverter } from '../hooks/useCurrencyConverter';
import { TypeAheadSelect } from './TypeAheadSelect';
import { LANGUAGES } from '../lib/data';

function MapUpdater({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom());
  }, [center, map, zoom]);
  return null;
}

const compressImage = (base64: string, maxWidth = 800, quality = 0.7): Promise<string> => {
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

function ImageCropModal({ src, onComplete, onCancel }: { src: string, onComplete: (cropped: string) => void, onCancel: () => void }) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<Crop>();
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    );
    setCrop(initialCrop);
    setImgRef(e.currentTarget);
  };

  const getCroppedImg = () => {
    if (!imgRef || !crop) return;
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.naturalWidth / imgRef.width;
    const scaleY = imgRef.naturalHeight / imgRef.height;
    
    // Calculate actual pixel dimensions
    const pixelWidth = crop.unit === '%' ? (crop.width / 100) * imgRef.naturalWidth : crop.width * scaleX;
    const pixelHeight = crop.unit === '%' ? (crop.height / 100) * imgRef.naturalHeight : crop.height * scaleY;
    const pixelX = crop.unit === '%' ? (crop.x / 100) * imgRef.naturalWidth : crop.x * scaleX;
    const pixelY = crop.unit === '%' ? (crop.y / 100) * imgRef.naturalHeight : crop.y * scaleY;

    // Use a decent output size for profile pics (e.g., 400x400)
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth scaling
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
      400,
      400
    );

    onComplete(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      onClick={onCancel}
    >
      <div 
        className="bg-background rounded-[2.5rem] overflow-hidden max-w-2xl w-full shadow-2xl relative border border-outline"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-outline flex justify-between items-center">
          <div>
             <h3 className="text-xl font-display font-black uppercase tracking-tight">{t('seeker.photo_crop_title')}</h3>
             <p className="text-xs text-on-surface-variant font-medium mt-1">{t('seeker.photo_crop_desc')}</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-surface-container rounded-full"><X size={24} /></button>
        </div>
        <div className="p-4 md:p-8 flex justify-center bg-surface-container-lowest" style={{ maxHeight: '60vh' }}>
          <ReactCrop crop={crop} onChange={c => setCrop(c)} aspect={1} keepSelection className="flex items-center justify-center max-h-full">
            <img src={src} onLoad={onImageLoad} style={{ maxHeight: 'calc(60vh - 4rem)' }} className="max-w-full object-contain rounded-xl" alt="Crop target" />
          </ReactCrop>
        </div>
        <div className="p-8 border-t border-outline flex justify-end gap-4">
          <button onClick={onCancel} className="px-6 py-3 font-bold hover:bg-surface-container rounded-xl">{t('common.cancel')}</button>
          <button onClick={getCroppedImg} className="px-10 py-3 bg-primary text-on-primary rounded-xl font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all">{t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}

const COUNTRIES = ["Nederland", "België", "Duitsland", "Frankrijk", "Spanje", "Verenigd Koninkrijk"];
const CITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", "Haarlem", "Arnhem", "Amersfoort", "Antwerpen", "Gent", "Brugge", "Brussel"];

// Define the full structure expected for a seeker profile.
interface SeekerProfile {
  uid: string;
  nickname: string;
  introduction: string;
  photo_url?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  goal: string[];
  property_type: string[];
  country: string;
  city: string;
  preferredLanguage?: string;
  available_from: string;
  stay_duration_months: number;
  is_indefinite: boolean;
  budget_min: number;
  budget_max: number;
  single_occupancy: boolean;
  min_roommates: number;
  max_roommates: number;
  composition: { gender: string; age: number }[];
  
  vacation_pool?: string;
  vacation_outdoor_kitchen?: string;
  vacation_resort?: string;
  vacation_sauna?: string;
  vacation_beach_dist?: number | '';
  vacation_airport_dist?: number | '';
  vacation_breakfast?: boolean;
  vacation_lunch?: boolean;
  vacation_dinner?: boolean;
  
  has_completed_minimal: boolean;
  has_completed_extended: boolean;
  extended_completion_percentage: number;
  
  preferences: {
    area_private: number;
    bedrooms: number;
    furnished: string;
    sanitary: any;
    entrance: any;
    kitchen: any;
    laundry: any;
    heating: any;
    internet: any;
    outdoor: any;
    safety: any;
    parking: any;
    pets: any;
    surroundings: any;
    street: any;
    modifications: any;
    tenant_prefs: any;
  };
}

export default function SeekerProfileEditor({ onClose, onComplete }: { onClose: () => void, onComplete: () => void }) {
  const { t, i18n } = useTranslation();
  const currencyConverter = useCurrencyConverter();

  const validateText = (text: string) => {
    if (!text) return null;
    const normalized = text.toLowerCase().replace(/[\s\(\)\[\]\-]/g, '');
    const emailObfuscated = normalized.replace(/at|\[at\]|\(at\)/g, '@').replace(/dot|\[dot\]|\(dot\)/g, '.');
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneNumbers = normalized.match(/\d{8,}/g);
    if (emailRegex.test(text) || emailRegex.test(emailObfuscated)) return t('chat.error_invalid');
    if (phoneNumbers) return t('chat.error_invalid');
    return null;
  };

  const { theme, unit } = useSettings();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'basis' | 'voorstellen' | 'wensen' | 'vakantie' | 'extra'>('basis');
  const tabContainerRef = React.useRef<HTMLDivElement>(null);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Partial<SeekerProfile>>({
    nickname: '',
    introduction: '',
    photo_url: '',
    lat: 52.3676,
    lng: 4.9041,
    radius: 10,
    goal: [],
    property_type: [],
    country: 'Nederland',
    city: '',
    preferredLanguage: '',
    available_from: '',
    stay_duration_months: 0,
    is_indefinite: true,
    budget_min: undefined,
    budget_max: undefined,
    single_occupancy: true,
    min_roommates: 0,
    max_roommates: 0,
    composition: [{ gender: '', age: 25 }],
    vacation_pool: 'no',
    vacation_outdoor_kitchen: 'no',
    vacation_resort: 'no',
    vacation_sauna: 'no',
    vacation_beach_dist: '',
    vacation_airport_dist: '',
    vacation_breakfast: false,
    vacation_lunch: false,
    vacation_dinner: false,
    preferences: {
      area_private: 0,
      bedrooms: 1,
      furnished: 'either',
      sanitary: {},
      entrance: {},
      kitchen: {},
      laundry: {},
      heating: {},
      internet: {},
      outdoor: {},
      safety: {},
      parking: {},
      pets: {},
      surroundings: {},
      street: {},
      modifications: { free_text: '' },
      tenant_prefs: {}
    }
  });

  const [citySearch, setCitySearch] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<{name: string, lat: number, lng: number}[]>([]);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  
  const [mapCenter, setMapCenter] = useState<[number, number]>([52.3676, 4.9041]);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

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
          console.error("Error fetching city suggestions:", error);
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
    fetchProfile();
    // Freeze background
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Auto-save on tab change
  const [prevTab, setPrevTab] = useState(activeTab);
  useEffect(() => {
    if (prevTab !== activeTab) {
      handleSave(false);
      setPrevTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'seeker_profiles', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as SeekerProfile;
        setProfile((prev) => ({
          ...prev,
          ...data,
          preferences: { ...prev.preferences, ...data.preferences }
        }));
        if (data.city) setCitySearch(data.city);
        if (data.lat && data.lng) setMapCenter([data.lat, data.lng]);
      }
    } catch (error) {
      console.error("Error fetching seeker profile:", error);
    }
  };

  const calcMinimalCompletion = () => {
    let filled = 0;
    const items = [
      () => !!(profile.nickname && profile.nickname.trim().length > 0),
      () => !!(profile.city && profile.city.trim().length > 0),
      () => !!(profile.goal && profile.goal.length > 0),
      () => !!(profile.property_type && profile.property_type.length > 0)
    ];

    items.forEach(check => {
      if (check()) filled++;
    });

    return Math.round((filled / items.length) * 100);
  };

  const calcExtendedCompletion = () => {
    const extraCategories = [
      'entrance', 'kitchen', 'laundry', 'heating', 'internet', 'outdoor', 
      'safety', 'parking', 'pets', 'surroundings', 'street', 'modifications', 'tenant_prefs'
    ];
    
    // Total items across all categories for a more realistic percentage
    // This should match the number of questions in these categories
    const totalPossiblePoints = 40; 
    let answeredCount = 0;

    extraCategories.forEach(cat => {
      const categoryData = (profile.preferences as any)?.[cat];
      if (categoryData) {
        Object.entries(categoryData).forEach(([key, value]) => {
          if (key !== 'free_text' && value !== undefined && value !== null && value !== '') {
            answeredCount++;
          }
        });
      }
    });
    
    return Math.min(100, Math.round((answeredCount / totalPossiblePoints) * 100));
  };

  const handleSave = async (complete: boolean = false) => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const bMin = (profile.budget_min === undefined || profile.budget_min === null || profile.budget_min.toString() === '') ? 0 : profile.budget_min;
      const bMax = (profile.budget_max === undefined || profile.budget_max === null || profile.budget_max.toString() === '') ? 9999999 : profile.budget_max;

      const data = {
        ...profile,
        budget_min: bMin,
        budget_max: bMax,
        uid: auth.currentUser.uid,
        language: i18n.language,
        theme: theme,
        unit: unit,
        has_completed_minimal: calcMinimalCompletion() === 100,
        has_completed_extended: complete,
        extended_completion_percentage: calcExtendedCompletion(),
      };
      const isComplete = calcMinimalCompletion() === 100;
      await saveSeekerProfile(data as Record<string, unknown>, {
        language: i18n.language,
        theme,
        unit,
      });

      if (isComplete) {
        await grantCompletionBonus('seeker');
      }
      if (complete) {
        onComplete();
      } else {
        setToast({ message: t('seeker.toast_save_success'), type: 'success' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seeker_profiles/${auth.currentUser.uid}`);
    }
    setLoading(false);
  };

  const handlePrefChange = (category: keyof SeekerProfile['preferences'], key: string, value: any) => {
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences!,
        [category]: typeof value === 'object' && value !== null && key === ''
          ? value 
          : { ...(prev.preferences as any)?.[category], [key]: value }
      }
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setCroppingImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onCropComplete = async (croppedBase64: string) => {
    if (!auth.currentUser) return;
    setCroppingImage(null);
    setUploading(true);
    try {
      const compressed = await compressImage(croppedBase64, 400, 0.8);
      const storage = getStorage();
      const storageRef = ref(storage, `seeker_photos/${auth.currentUser.uid}`);
      await uploadString(storageRef, compressed, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);
      setProfile(prev => ({ ...prev, photo_url: downloadURL }));
      setToast({ message: t('seeker.toast_save_success'), type: 'success' });
    } catch (error) {
      console.error("Error uploading photo:", error);
      setToast({ message: t('common.error'), type: 'error' });
    }
    setUploading(false);
  };

  const removePhoto = async () => {
    if (!auth.currentUser) return;
    setUploading(true);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `seeker_photos/${auth.currentUser.uid}`);
      await deleteObject(storageRef);
      setProfile(prev => ({ ...prev, photo_url: '' }));
      setToast({ message: t('seeker.toast_save_success'), type: 'success' });
    } catch (error) {
      console.error("Error removing photo:", error);
      setProfile(prev => ({ ...prev, photo_url: '' }));
    }
    setUploading(false);
  };

  const minimalScore = calcMinimalCompletion();
  const extendedScore = calcExtendedCompletion();

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
        className="bg-background text-on-background md:rounded-[3rem] w-full max-w-5xl h-full md:h-[85vh] flex flex-col shadow-2xl border border-outline overflow-hidden"
      >
        <div className="p-6 border-b border-outline flex flex-col sm:flex-row sm:justify-between sm:items-center bg-surface-container-low gap-4 flex-shrink-0">
          <AnimatePresence>
            {toast && (
              <motion.div 
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className={`fixed top-10 left-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm ${
                  toast.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'
                }`}
              >
                {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                {toast.message}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-on-background">{t('seeker.editor_title')}</h2>
              <p className="text-on-surface-variant text-sm font-medium">{t('seeker.editor_subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold bg-surface text-on-surface p-2 rounded-2xl border border-outline">
            <div className={`px-3 py-1.5 rounded-xl ${minimalScore === 100 ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'}`}>
              Basis: {minimalScore}%
            </div>
            <div className={`px-3 py-1.5 rounded-xl ${extendedScore > 50 ? 'bg-secondary/20 text-secondary' : 'bg-secondary/10 text-secondary'}`}>
              Extra: {extendedScore}%
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-surface-container rounded-full transition-all text-on-surface-variant absolute top-6 right-6 sm:static">
            <X size={24} />
          </button>
        </div>

        <div className="relative flex items-center bg-surface-container-lowest border-b border-outline">
          {/* Left scroll button on mobile */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (tabContainerRef.current) {
                tabContainerRef.current.scrollBy({ left: -150, behavior: 'smooth' });
              }
            }}
            className="flex md:hidden items-center justify-center w-12 h-full bg-gradient-to-r from-background via-background/90 to-transparent text-primary hover:text-primary-dark absolute left-0 top-0 bottom-0 z-30 pl-2 shrink-0 cursor-pointer active:scale-110 transition-transform"
            aria-label="Scroll left"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Scrolling Tab Container */}
          <div 
            ref={tabContainerRef}
            className="flex-grow flex overflow-x-auto no-scrollbar flex-shrink-0 scroll-smooth px-12 md:px-6"
          >
            {(['basis', 'voorstellen', 'wensen', 'vakantie', 'extra'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab !== 'basis' && minimalScore < 100) {
                    setToast({ message: t('seeker.toast_minimal_required'), type: 'error' });
                    return;
                  }
                  setActiveTab(tab);
                }}
                className={`px-6 py-4 font-bold text-sm border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                } ${tab !== 'basis' && minimalScore < 100 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {tab === 'basis' ? t('seeker.tab_basis') : tab === 'voorstellen' ? t('seeker.tab_intro') : tab === 'wensen' ? t('seeker.tab_wishes') : tab === 'vakantie' ? t('seeker.tab_vacation', 'Vakantie') : t('seeker.tab_extra', 'Extra')}
              </button>
            ))}
          </div>

          {/* Right scroll button on mobile */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (tabContainerRef.current) {
                tabContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
              }
            }}
            className="flex md:hidden items-center justify-center w-12 h-full bg-gradient-to-l from-background via-background/90 to-transparent text-primary hover:text-primary-dark absolute right-0 top-0 bottom-0 z-30 pr-2 shrink-0 cursor-pointer active:scale-110 transition-transform"
            aria-label="Scroll right"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 md:p-8 bg-surface-container-lowest">
          {activeTab === 'basis' && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="flex flex-col sm:flex-row gap-8 items-center border-b border-outline pb-10">
                 <div className="relative group">
                   <div className="w-32 h-32 rounded-[2.5rem] bg-surface-container flex items-center justify-center overflow-hidden border-2 border-outline group-hover:border-primary transition-all shadow-inner">
                     {profile.photo_url ? (
                       <img src={profile.photo_url} className="w-full h-full object-cover" alt="Profile" />
                     ) : (
                       <ImageIcon size={48} className="text-on-surface-variant opacity-20" />
                     )}
                     {uploading && (
                       <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                         <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                       </div>
                     )}
                   </div>
                   <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-on-primary rounded-2xl flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all">
                     <Camera size={20} />
                     <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                   </label>
                   {profile.photo_url && (
                     <button onClick={removePhoto} className="absolute -top-2 -right-2 w-8 h-8 bg-error text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all">
                       <Trash2 size={16} />
                     </button>
                   )}
                 </div>
                 <div className="flex-1 text-center sm:text-left">
                    <h4 className="font-bold text-lg text-on-background">{t('seeker.photo_title')}</h4>
                    <p className="text-sm text-on-surface-variant font-medium">{t('seeker.photo_desc')}</p>
                    <p className="text-[10px] uppercase font-black tracking-widest text-primary mt-2 flex items-center gap-1 justify-center sm:justify-start">
                      <Sparkles size={12} /> {t('seeker.photo_optional')}
                    </p>
                 </div>
               </div>

               <div className="space-y-4">
                 <h4 className="font-bold text-lg text-on-background">{t('seeker.category_data')}</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_nickname')} <span className="text-error">*</span></label>
                      <input type="text" value={profile.nickname} onChange={e => setProfile({...profile, nickname: e.target.value})} className="w-full bg-surface-container-low border border-outline rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary outline-none font-bold" placeholder={t('seeker.placeholder_nickname')} />
                    </div>
                 </div>
               </div>
               <div className="space-y-4">
                 <h4 className="font-bold text-lg text-on-background">{t('seeker.category_goal_type')}</h4>
                 <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_searching_for')} <span className="text-error">*</span></label>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'cohousing', label: t('prop.goal.cohousing') },
                        { id: 'hospita', label: t('prop.goal.hospita') },
                        { id: 'vakantie_onderhuur', label: t('prop.goal.vakantie_onderhuur') },
                        { id: 'huisbewaring_expat', label: t('prop.goal.huisbewaring_expat') },
                        { id: 'vrije_verhuur', label: t('prop.goal.vrije_verhuur') }
                      ].map(g => (
                        <label key={g.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer ${profile.goal?.includes(g.id) ? 'bg-primary/10 text-primary border-primary' : 'bg-surface-container-low border-outline text-on-surface-variant hover:border-primary/50'}`}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 accent-primary"
                            checked={profile.goal?.includes(g.id) || false}
                            onChange={() => {
                              const goals = profile.goal || [];
                              setProfile({...profile, goal: goals.includes(g.id) ? goals.filter(x => x !== g.id) : [...goals, g.id]});
                            }}
                          />
                          {g.label}
                        </label>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-primary">{t('prop.basis.type')} <span className="text-error">*</span></label>
                    <div className="flex gap-2 flex-wrap">
                      {['room', 'studio', 'apartment', 'house'].map(typeKey => {
                        const isTypeActive = () => {
                          const types = profile.property_type || [];
                          const legacyVal = typeKey === 'room' ? 'Kamer' : typeKey === 'studio' ? 'Studio' : typeKey === 'apartment' ? 'Appartement' : 'Huis';
                          return types.includes(typeKey) || types.includes(legacyVal);
                        };
                        return (
                          <button 
                            key={typeKey} 
                            type="button"
                            onClick={() => {
                              const types = profile.property_type || [];
                              const legacyVal = typeKey === 'room' ? 'Kamer' : typeKey === 'studio' ? 'Studio' : typeKey === 'apartment' ? 'Appartement' : 'Huis';
                              let newTypes = types.filter(t => t !== typeKey && t !== legacyVal);
                              if (!isTypeActive()) {
                                newTypes.push(typeKey);
                              }
                              setProfile({...profile, property_type: newTypes});
                            }} 
                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isTypeActive() ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low border-outline text-on-surface-variant hover:border-primary/50'}`}
                          >
                            {t(`prop.type.${typeKey}`)}
                          </button>
                        );
                      })}
                    </div>
                 </div>
               </div>

               <div className="space-y-6">
                 <h4 className="font-bold text-lg text-on-background flex items-center gap-2"><MapPin size={20}/> {t('seeker.category_location')}</h4>
                 
                 <div className="space-y-4">
                    <div className="space-y-2 relative">
                        <label className="text-xs font-black uppercase tracking-widest text-primary ml-1">{t('seeker.label_city_search')} <span className="text-error">*</span></label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                            <Search size={18} />
                          </div>
                          <input 
                            type="text" 
                            value={citySearch} 
                            onChange={e => {
                              setCitySearch(e.target.value);
                              setShowCitySuggestions(true);
                            }}
                            onFocus={() => setShowCitySuggestions(true)}
                            className="w-full bg-surface border-2 border-outline/50 rounded-2xl pl-12 pr-4 py-4 text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold text-lg"
                            placeholder={t('seeker.placeholder_city_search', 'Typ een stad, bijv. Gent of Antwerpen...')}
                          />
                          
                          <AnimatePresence>
                            {showCitySuggestions && (citySearch.length > 0 || isSearchingCities) && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute left-0 right-0 top-full mt-2 bg-surface border border-outline rounded-2xl shadow-xl z-[1001] overflow-hidden"
                              >
                                {isSearchingCities && (
                                  <div className="px-6 py-4 flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    <span className="text-xs font-bold text-on-surface-variant">{t('seeker.loading', 'Zoeken naar steden...')}</span>
                                  </div>
                                )}
                                
                                {citySuggestions.map((cityObj, i) => (
                                  <button
                                    key={`${cityObj.lat}-${cityObj.lng}-${i}`}
                                    onClick={() => {
                                      setProfile({ 
                                        ...profile, 
                                        city: cityObj.name.split(',')[0],
                                        lat: cityObj.lat,
                                        lng: cityObj.lng
                                      });
                                      setMapCenter([cityObj.lat, cityObj.lng]);
                                      setCitySearch(cityObj.name.split(',')[0]);
                                      setShowCitySuggestions(false);
                                    }}
                                    className="w-full text-left px-6 py-4 hover:bg-primary/5 transition-colors border-b border-outline/30 last:border-0 flex items-center justify-between group"
                                  >
                                    <div className="flex flex-col">
                                       <span className="font-bold text-sm text-on-surface group-hover:text-primary">{cityObj.name.split(',')[0]}</span>
                                       <span className="text-[10px] text-on-surface-variant truncate max-w-[250px]">{cityObj.name}</span>
                                    </div>
                                    <ChevronRight size={16} className="text-outline group-hover:text-primary transition-all shrink-0" />
                                  </button>
                                ))}

                                {!isSearchingCities && citySuggestions.length === 0 && citySearch.length > 2 && (
                                  <div className="px-6 py-4 text-xs font-bold text-on-surface-variant italic">
                                    {t('seeker.no_results', 'Geen steden gevonden.')}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                    </div>

                    <div className="p-6 bg-surface-container-low rounded-[2rem] border border-outline/50 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary">{t('seeker.label_radius_with_city', { city: profile.city || t('common.selected_city', 'geselecteerde stad') })}</label>
                          <span className="text-lg font-bold text-on-surface">{profile.radius} km</span>
                        </div>
                        <div className="flex gap-2">
                           <button 
                             onClick={() => setProfile((prev) => ({ ...prev, radius: Math.max(1, (prev.radius || 10) - 1) }))} 
                             className="flex items-center gap-2 px-4 py-2 bg-surface border-2 border-outline/50 rounded-xl hover:border-primary/30 transition-all shadow-sm group"
                           >
                              <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <Minus size={14} />
                              </div>
                           </button>
                           <button 
                             onClick={() => setProfile((prev) => ({ ...prev, radius: Math.min(250, (prev.radius || 10) + 1) }))} 
                             className="flex items-center gap-2 px-4 py-2 bg-surface border-2 border-outline/50 rounded-xl hover:border-primary/30 transition-all shadow-sm group"
                           >
                              <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <PlusIcon size={14} />
                              </div>
                           </button>
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="250" 
                        value={profile.radius || 10} 
                        onChange={(e) => setProfile(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                        className="w-full h-1.5 bg-outline/30 rounded-full appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="h-[300px] rounded-[2rem] overflow-hidden border-2 border-outline shadow-inner relative group">
                        <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                          <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Circle 
                            center={mapCenter} 
                            radius={(profile.radius || 10) * 1000} 
                            pathOptions={{ color: 'var(--color-primary)', fillColor: 'var(--color-primary)', fillOpacity: 0.25, weight: 2 }}
                          />
                          <MapUpdater center={mapCenter} zoom={11} />
                        </MapContainer>
                        
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                           <div className="bg-surface/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-outline/50 pointer-events-auto">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t('common.selected', 'Geselecteerd')}</p>
                              <p className="text-sm font-bold text-on-surface">{profile.city || t('common.choose_city', 'Kies een stad...')}</p>
                           </div>
                        </div>

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-on-background/80 backdrop-blur-md text-background px-6 py-2 rounded-full text-center shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] font-bold">{t('seeker.map_illustrative_note', 'Ter illustratie van je zoekgebied')}</p>
                        </div>
                      </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_budget_min')}</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                        <input 
                          type="number" 
                          min="0" 
                          value={profile.budget_min === undefined ? '' : currencyConverter.toDisplay(profile.budget_min)} 
                          onChange={e => {
                            const val = e.target.value;
                            setProfile(prev => ({
                              ...prev, 
                              budget_min: val === '' ? ('' as any) : currencyConverter.toEur(parseInt(val))
                            }));
                          }} 
                          onBlur={e => {
                            let min = parseInt(e.target.value);
                            if (isNaN(min) || min < 0) min = 0;
                            min = currencyConverter.toEur(min);
                            setProfile(prev => ({
                              ...prev,
                              budget_min: min,
                              budget_max: Math.max(min + 1, prev.budget_max || 0)
                            }));
                          }}
                          className="w-full bg-surface-container-low border border-outline rounded-2xl pl-10 pr-5 py-4 focus:ring-2 focus:ring-primary outline-none font-bold" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_budget_max')}</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                        <input 
                          type="number" 
                          min={0}
                          value={profile.budget_max === undefined ? '' : currencyConverter.toDisplay(profile.budget_max)} 
                          onChange={e => {
                            const val = e.target.value;
                            setProfile(prev => ({
                              ...prev, 
                              budget_max: val === '' ? ('' as any) : currencyConverter.toEur(parseInt(val))
                            }));
                          }} 
                          onBlur={e => {
                            let max = parseInt(e.target.value);
                            const min = currencyConverter.toDisplay(profile.budget_min || 0);
                            if (isNaN(max)) max = min + 1;
                            if (max <= min) max = min + 1;
                            max = currencyConverter.toEur(max);
                            setProfile(prev => ({
                              ...prev,
                              budget_max: max
                            }));
                          }}
                          className={`w-full bg-surface-container-low border rounded-2xl pl-10 pr-5 py-4 focus:ring-2 focus:ring-primary outline-none font-bold ${ (profile.budget_max || 0) < (profile.budget_min || 0) ? 'border-error ring-1 ring-error' : 'border-outline' }`} 
                        />
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'voorstellen' && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20 flex gap-4 items-start">
                  <Sparkles className="text-primary flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h5 className="font-bold text-primary">{t('seeker.intro_tip_title')}</h5>
                    <p className="text-sm text-on-surface-variant font-medium">{t('seeker.intro_tip_desc')}</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-black uppercase tracking-widest text-primary ml-1">{t('seeker.label_intro')}</label>
                    <span className={`text-[10px] font-bold ${ (profile.introduction?.length || 0) > 1950 ? 'text-error' : 'text-on-surface-variant' }`}>
                      {profile.introduction?.length || 0} / 2000
                    </span>
                  </div>
                  <textarea value={profile.introduction} maxLength={2000} onChange={(e) => setProfile({ ...profile, introduction: e.target.value })} placeholder={t('seeker.placeholder_intro')} className="w-full bg-surface-container-low border border-outline rounded-[1.5rem] p-6 focus:ring-2 focus:ring-primary outline-none transition-all min-h-[250px] font-medium resize-none shadow-inner" />
                  {validateText(profile.introduction || '') && (
                    <div className="flex items-center gap-2 text-error text-xs font-bold bg-error/10 p-3 rounded-xl border border-error/20">
                      <AlertCircle size={14} /> {validateText(profile.introduction || '')}
                    </div>
                  )}
                  <p className="text-[10px] text-on-surface-variant uppercase font-black px-1">
                    {t('seeker.intro_privacy_note')}
                  </p>
               </div>
            </div>
          )}

          {activeTab === 'wensen' && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="space-y-4">
                 <h4 className="font-bold text-lg text-on-background">{t('seeker.category_period')}</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_available_from_short')}</label>
                      <input type="date" value={profile.available_from} onChange={e => setProfile({...profile, available_from: e.target.value})} className="w-full bg-surface-container-low border border-outline rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary outline-none font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-primary flex justify-between">
                        <span>{t('seeker.label_months_count')}</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={profile.is_indefinite} onChange={e => setProfile({...profile, is_indefinite: e.target.checked})} className="accent-primary" />
                          <span className="text-[10px]">{t('seeker.label_indefinite')}</span>
                        </label>
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        disabled={profile.is_indefinite} 
                        value={profile.stay_duration_months === undefined ? '' : profile.stay_duration_months} 
                        onChange={e => {
                          const val = e.target.value;
                          setProfile(prev => ({
                            ...prev, 
                            stay_duration_months: val === '' ? ('' as any) : parseInt(val)
                          }));
                        }} 
                        onBlur={e => {
                          let months = parseInt(e.target.value);
                          if (isNaN(months) || months < 1) months = 1;
                          setProfile(prev => ({
                            ...prev,
                            stay_duration_months: months
                          }));
                        }}
                        className="w-full bg-surface-container-low border border-outline rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary outline-none font-bold disabled:opacity-50" 
                      />
                    </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <h4 className="font-bold text-lg">{t('seeker.category_living_style')}</h4>
                 <div className="flex gap-4 p-4 border border-outline rounded-2xl bg-surface-container-low">
                   <label className="flex items-center gap-3 cursor-pointer">
                     <input type="radio" checked={profile.single_occupancy} onChange={() => setProfile({...profile, single_occupancy: true})} className="w-5 h-5 accent-primary" />
                     <span className="font-bold">{t('seeker.occupancy_single')}</span>
                   </label>
                   <label className="flex items-center gap-3 cursor-pointer">
                     <input type="radio" checked={!profile.single_occupancy} onChange={() => setProfile({...profile, single_occupancy: false})} className="w-5 h-5 accent-primary" />
                     <span className="font-bold">{t('seeker.occupancy_group')}</span>
                   </label>
                 </div>
                 {!profile.single_occupancy && (
                   <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{t('seeker.min_roommates')}</label>
                        <input type="number" min="0" value={profile.min_roommates} onChange={e => setProfile({...profile, min_roommates: parseInt(e.target.value)||0})} className="w-full bg-surface text-on-surface border border-outline rounded-xl px-4 py-3 font-bold text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{t('seeker.max_roommates')}</label>
                        <input type="number" min="1" value={profile.max_roommates} onChange={e => setProfile({...profile, max_roommates: parseInt(e.target.value)||0})} className="w-full bg-surface text-on-surface border border-outline rounded-xl px-4 py-3 font-bold text-sm" />
                      </div>
                   </div>
                 )}
                 <div className="space-y-3 mt-6">
                   <label className="text-xs font-black uppercase tracking-widest text-primary flex justify-between items-center">
                     <span>{t('seeker.composition_title')}</span>
                     <button onClick={() => setProfile({...profile, composition: [...(profile.composition || []), { gender: '', age: 25 }]})} className="text-primary hover:underline flex items-center gap-1">
                       <Plus size={14}/> {t('seeker.add_person')}
                     </button>
                   </label>
                   {profile.composition?.map((person, idx) => (
                     <div key={idx} className="flex gap-4 items-center bg-surface-container-low p-3 rounded-2xl border border-outline">
                       <span className="font-bold text-on-surface-variant w-6 text-center">{idx + 1}</span>
                      <select value={person.gender} onChange={e => { const n = [...(profile.composition || [])]; n[idx].gender = e.target.value; setProfile({...profile, composition: n}); }} className="flex-1 bg-surface text-on-surface border outline-none py-2 px-3 rounded-xl font-bold">
                         <option value="">{t('seeker.choose_gender')}</option>
                         <option value="Man">{t('seeker.gender_male')}</option>
                         <option value="Vrouw">{t('seeker.gender_female')}</option>
                         <option value="Kind">{t('seeker.gender_child')}</option>
                         <option value="Anders">{t('seeker.gender_other')}</option>
                       </select>
                      <input type="number" placeholder={t('seeker.age_placeholder')} value={person.age || ''} onChange={e => { const n = [...(profile.composition || [])]; n[idx].age = parseInt(e.target.value)||0; setProfile({...profile, composition: n}); }} className="w-20 bg-surface text-on-surface placeholder:text-on-surface-variant border outline-none py-2 px-3 rounded-xl font-bold" />
                       <button onClick={() => { const n = [...(profile.composition || [])]; n.splice(idx, 1); setProfile({...profile, composition: n}); }} className="text-error p-2 hover:bg-error/10 rounded-full"><Trash2 size={16}/></button>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="space-y-4 pt-10 border-t border-outline">
                 <h4 className="font-bold text-lg flex items-center gap-2"><Layout size={20}/> {t('seeker.category_layout', 'Ruimte & Indeling')}</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_area_min')}</label>
                       <input type="number" min="0" value={profile.preferences?.area_private || ''} onChange={e => handlePrefChange('area_private', '', parseInt(e.target.value)||0)} className="w-full bg-surface-container-low border border-outline rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary outline-none font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_bedrooms_count')}</label>
                       <input type="number" min="1" value={profile.preferences?.bedrooms || ''} onChange={e => handlePrefChange('bedrooms', '', parseInt(e.target.value)||1)} className="w-full bg-surface-container-low border border-outline rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary outline-none font-bold" />
                    </div>
                 </div>
                 <div className="space-y-2 mt-4">
                    <label className="text-xs font-black uppercase tracking-widest text-primary">{t('seeker.label_furnished')}</label>
                    <div className="flex gap-4">
                      {['yes', 'no', 'either'].map(f => (
                        <label key={f} className="flex-1 text-center cursor-pointer">
                          <input type="radio" name="furnished_pref" className="peer hidden" checked={profile.preferences?.furnished === f} onChange={() => handlePrefChange('furnished', '', f)} />
                          <div className="border border-outline bg-surface-container-low rounded-2xl py-3 font-bold peer-checked:bg-primary peer-checked:text-on-primary peer-checked:border-primary transition-all">
                            {f === 'yes' ? t('seeker.option_yes') : f === 'no' ? t('seeker.option_no') : t('seeker.option_either')}
                          </div>
                        </label>
                      ))}
                    </div>
                 </div>
               </div>
               <div className="space-y-4">
                 <h4 className="font-bold text-lg">{t('seeker.category_sanitary_kitchen')}</h4>
                 <div className="bg-surface-container-low p-6 rounded-3xl border border-outline space-y-6">
                   {[
                     { key: 'bathroom', label: t('seeker.val_bathroom') },
                     { key: 'shower', label: t('seeker.val_shower') },
                     { key: 'toilet', label: t('seeker.val_toilet') }
                   ].map((item) => {
                     const key = item.key;
                     const currentVal = profile.preferences?.sanitary?.[key] || 'either';
                     return (
                       <div key={key} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                         <span className="font-bold w-32">{item.label}</span>
                        <div className="flex rounded-xl overflow-hidden border border-outline bg-surface w-full md:w-auto">
                           {['private', 'shared', 'either'].map(type => (
                             <label key={type} className="flex-1 cursor-pointer">
                               <input type="radio" name={`san_${key}`} className="peer hidden" checked={currentVal === type} onChange={() => handlePrefChange('sanitary', key, type)} />
                              <div className="px-4 py-2 text-sm font-bold text-center peer-checked:bg-primary peer-checked:text-on-primary transition-colors">
                                 {type === 'private' ? t('seeker.sanitary_private') : type === 'shared' ? t('seeker.sanitary_shared') : t('seeker.sanitary_no_pref')}
                               </div>
                             </label>
                           ))}
                         </div>
                       </div>
                     );
                   })}

                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6 border-t border-outline">
                     <span className="font-bold w-40">{t('seeker.kitchen_pref')}</span>
                    <div className="flex rounded-xl overflow-hidden border border-outline bg-surface w-full md:w-auto">
                       {['private', 'shared', 'either'].map(type => (
                         <label key={type} className="flex-1 cursor-pointer">
                           <input type="radio" name="kitchen_type_pref" className="peer hidden" checked={(profile.preferences?.kitchen?.type || 'either') === type} onChange={() => handlePrefChange('kitchen', 'type', type)} />
                          <div className="px-4 py-2 text-sm font-bold text-center peer-checked:bg-primary peer-checked:text-on-primary transition-colors">
                             {type === 'private' ? t('seeker.kitchen_private') : type === 'shared' ? t('seeker.kitchen_shared') : t('seeker.sanitary_no_pref')}
                           </div>
                         </label>
                       ))}
                     </div>
                   </div>

                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6 border-t border-outline">
                     <span className="font-bold w-40">{t('seeker.washer_pref', 'Wasmachine')}</span>
                     <div className="flex rounded-xl overflow-hidden border border-outline bg-surface w-full md:w-auto">
                       {['private', 'shared', 'none'].map(type => (
                         <label key={type} className="flex-1 cursor-pointer">
                           <input type="radio" name="washer_type_pref" className="peer hidden" checked={(profile.preferences?.laundry?.washer || 'none') === type} onChange={() => handlePrefChange('laundry', 'washer', type)} />
                          <div className="px-4 py-2 text-sm font-bold text-center peer-checked:bg-primary peer-checked:text-on-primary transition-colors">
                             {type === 'private' ? t('seeker.laundry_private', 'Prive') : type === 'shared' ? t('seeker.laundry_shared', 'Gedeeld') : t('seeker.laundry_none', 'Niet nodig')}
                           </div>
                         </label>
                       ))}
                     </div>
                   </div>

                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                     <span className="font-bold w-40">{t('seeker.dryer_pref', 'Droger')}</span>
                     <div className="flex rounded-xl overflow-hidden border border-outline bg-surface w-full md:w-auto">
                       {['private', 'shared', 'none'].map(type => (
                         <label key={type} className="flex-1 cursor-pointer">
                           <input type="radio" name="dryer_type_pref" className="peer hidden" checked={(profile.preferences?.laundry?.dryer || 'none') === type} onChange={() => handlePrefChange('laundry', 'dryer', type)} />
                          <div className="px-4 py-2 text-sm font-bold text-center peer-checked:bg-primary peer-checked:text-on-primary transition-colors">
                             {type === 'private' ? t('seeker.laundry_private', 'Prive') : type === 'shared' ? t('seeker.laundry_shared', 'Gedeeld') : t('seeker.laundry_none', 'Niet nodig')}
                           </div>
                         </label>
                       ))}
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'vakantie' && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20 flex gap-4 items-start">
                  <Sparkles className="text-primary flex-shrink-0 mt-1" size={24} />
                  <div>
                     <h4 className="font-bold text-on-surface mb-1">{t('seeker.vacation_title', 'Vakantie & Recreatie Voorkeuren')}</h4>
                     <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                       {t('seeker.vacation_desc', 'Geef hier je specifieke wensen aan voor een vakantiewoning of recreatieverblijf. Dit helpt ons om de ideale match te berekenen!')}
                     </p>
                  </div>
               </div>

               <div className="bg-surface-container-low p-6 rounded-3xl border border-outline/50 space-y-6">
                  {/* Zwembad */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant block">{t('prop.extra.pool', 'Zwembad')}</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: t('common.no', 'Nee'), value: 'no' },
                        { label: t('common.shared_dutch', 'Gedeeld'), value: 'shared' },
                        { label: t('common.private_dutch', 'Privé'), value: 'private' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-4 bg-surface border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[input:checked]:bg-primary/10 has-[input:checked]:text-primary has-[input:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_pool_seeker" 
                            className="hidden" 
                            checked={(profile.vacation_pool || 'no') === opt.value}
                            onChange={() => setProfile({ ...profile, vacation_pool: opt.value })}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Buitenkeuken */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant block">{t('prop.extra.outdoor_kitchen', 'Buitenkeuken')}</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: t('common.no', 'Nee'), value: 'no' },
                        { label: t('common.shared_dutch', 'Gedeeld'), value: 'shared' },
                        { label: t('common.private_dutch', 'Privé'), value: 'private' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-4 bg-surface border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[input:checked]:bg-primary/10 has-[input:checked]:text-primary has-[input:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_outdoor_kitchen_seeker" 
                            className="hidden" 
                            checked={(profile.vacation_outdoor_kitchen || 'no') === opt.value}
                            onChange={() => setProfile({ ...profile, vacation_outdoor_kitchen: opt.value })}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Vakantiepark */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant block">{t('prop.extra.resort', 'Vakantiepark')}</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: t('common.no', 'Nee'), value: 'no' },
                        { label: t('common.yes_no_fac', 'Ja, zonder faciliteiten'), value: 'yes_no_fac' },
                        { label: t('common.yes_fac', 'Ja, met faciliteiten'), value: 'yes_fac' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[150px] flex items-center justify-center gap-2 p-4 bg-surface border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[input:checked]:bg-primary/10 has-[input:checked]:text-primary has-[input:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_resort_seeker" 
                            className="hidden" 
                            checked={(profile.vacation_resort || 'no') === opt.value}
                            onChange={() => setProfile({ ...profile, vacation_resort: opt.value })}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Sauna */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant block">{t('prop.extra.sauna', 'Sauna')}</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: t('common.no', 'Nee'), value: 'no' },
                        { label: t('common.shared_dutch', 'Gedeeld'), value: 'shared' },
                        { label: t('common.private_dutch', 'Privé'), value: 'private' }
                      ].map(opt => (
                        <label key={opt.value} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 p-4 bg-surface border-2 border-outline/50 rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[input:checked]:bg-primary/10 has-[input:checked]:text-primary has-[input:checked]:border-primary shadow-sm border-outline/50">
                          <input 
                            type="radio" 
                            name="vacation_sauna_seeker" 
                            className="hidden" 
                            checked={(profile.vacation_sauna || 'no') === opt.value}
                            onChange={() => setProfile({ ...profile, vacation_sauna: opt.value })}
                          />
                          <span className="font-bold text-sm text-center">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Afstanden */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-outline/30">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant block">{t('prop.extra.beach_dist', 'Afstand tot strand (km)')}</label>
                      <input 
                        type="number" 
                        min="0"
                        max="30"
                        value={profile.vacation_beach_dist === undefined ? '' : profile.vacation_beach_dist}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            setProfile({ ...profile, vacation_beach_dist: '' });
                          } else {
                            const num = Math.min(30, Math.max(0, Number(val)));
                            setProfile({ ...profile, vacation_beach_dist: num });
                          }
                        }}
                        className="w-full bg-surface text-on-surface placeholder:text-on-surface-variant border border-outline rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold animate-in"
                        placeholder="Bijv. 5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant block">{t('prop.extra.airport_dist', 'Afstand tot internationale luchthaven (km)')}</label>
                      <input 
                        type="number" 
                        min="0"
                        max="150"
                        value={profile.vacation_airport_dist === undefined ? '' : profile.vacation_airport_dist}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            setProfile({ ...profile, vacation_airport_dist: '' });
                          } else {
                            const num = Math.min(150, Math.max(0, Number(val)));
                            setProfile({ ...profile, vacation_airport_dist: num });
                          }
                        }}
                        className="w-full bg-surface text-on-surface placeholder:text-on-surface-variant border border-outline rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold animate-in"
                        placeholder="Bijv. 45"
                      />
                    </div>
                  </div>

                  {/* Maaltijden */}
                  <div className="space-y-4 pt-4 border-t border-outline/30">
                    <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant block">{t('prop.extra.meals', 'Maaltijdmogelijkheden')}</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Ontbijt */}
                      <div className="flex flex-col gap-2 p-4 bg-surface border border-outline rounded-2xl shadow-sm animate-in">
                        <span className="font-bold text-sm text-on-surface">{t('prop.extra.breakfast', 'Mogelijkheid tot ontbijt')}</span>
                        <div className="flex bg-surface-container rounded-xl p-1 text-[11px] font-bold">
                          {[
                            { label: t('common.no', 'Nee'), value: false },
                            { label: t('common.yes', 'Ja'), value: true }
                          ].map(opt => (
                            <button 
                              key={String(opt.value)}
                              type="button"
                              onClick={() => setProfile({ ...profile, vacation_breakfast: opt.value })}
                              className={`flex-1 py-1.5 rounded-lg transition-all ${!!profile.vacation_breakfast === opt.value ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lunch */}
                      <div className="flex flex-col gap-2 p-4 bg-surface border border-outline rounded-2xl shadow-sm animate-in">
                        <span className="font-bold text-sm text-on-surface">{t('prop.extra.lunch', 'Mogelijkheid tot lunch')}</span>
                        <div className="flex bg-surface-container rounded-xl p-1 text-[11px] font-bold">
                          {[
                            { label: t('common.no', 'Nee'), value: false },
                            { label: t('common.yes', 'Ja'), value: true }
                          ].map(opt => (
                            <button 
                              key={String(opt.value)}
                              type="button"
                              onClick={() => setProfile({ ...profile, vacation_lunch: opt.value })}
                              className={`flex-1 py-1.5 rounded-lg transition-all ${!!profile.vacation_lunch === opt.value ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Diner */}
                      <div className="flex flex-col gap-2 p-4 bg-surface border border-outline rounded-2xl shadow-sm animate-in">
                        <span className="font-bold text-sm text-on-surface">{t('prop.extra.dinner', 'Mogelijkheid tot diner')}</span>
                        <div className="flex bg-surface-container rounded-xl p-1 text-[11px] font-bold">
                          {[
                            { label: t('common.no', 'Nee'), value: false },
                            { label: t('common.yes', 'Ja'), value: true }
                          ].map(opt => (
                            <button 
                              key={String(opt.value)}
                              type="button"
                              onClick={() => setProfile({ ...profile, vacation_dinner: opt.value })}
                              className={`flex-1 py-1.5 rounded-lg transition-all ${!!profile.vacation_dinner === opt.value ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'extra' && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-5 bg-secondary/10 text-secondary border border-secondary/20 rounded-2xl flex items-start gap-4">
                <Sparkles className="mt-1 flex-shrink-0" size={24}/>
                <div>
                  <h4 className="font-display font-bold text-lg mb-1">{t('seeker.extra_tip_title')}</h4>
                  <p className="text-sm font-medium">{t('seeker.extra_tip_desc')}</p>
                </div>
              </div>

              {[
                { cat: 'entrance', icon: <DoorOpen/>, label: t('seeker.pref.entrance'), items: [
                  { id: 'elevator', label: t('seeker.item.elevator') },
                  { id: 'wheelchair', label: t('seeker.item.wheelchair') },
                  { id: 'ground_floor', label: t('seeker.item.ground_floor') },
                  { id: 'private_entrance', label: t('seeker.item.private_entrance') },
                  { id: 'quiet_street', label: t('seeker.item.quiet_street') },
                  { id: 'lively_street', label: t('seeker.item.lively_street') },
                  { id: 'busy_street', label: t('seeker.item.busy_street') },
                  { id: 'shopping_street', label: t('seeker.item.shopping_street') }
                ]},
                { cat: 'kitchen', icon: <ChefHat/>, label: t('seeker.pref.kitchen'), items: [
                  { id: 'dishwasher', label: t('seeker.item.dishwasher') },
                  { id: 'oven', label: t('seeker.item.oven') },
                  { id: 'microwave', label: t('seeker.item.microwave') },
                  { id: 'fridge', label: t('seeker.item.fridge', 'Koelkast') },
                  { id: 'freezer', label: t('seeker.item.freezer', 'Vriezer') }
                ]},
                { cat: 'heating', icon: <Thermometer/>, label: t('seeker.pref.climate'), items: [
                  { id: 'central_heating', label: t('seeker.item.central_heating') },
                  { id: 'airco', label: t('seeker.item.airco') },
                  { id: 'floor_heating', label: t('seeker.item.floor_heating') },
                  { id: 'ventilation', label: t('seeker.item.ventilation') }
                ]},
                { cat: 'internet', icon: <Wifi/>, label: t('seeker.pref.connectivity'), items: [
                  { id: 'fiber', label: t('seeker.item.fiber') },
                  { id: 'wifi', label: t('seeker.item.wifi', 'Wifi') },
                  { id: 'streaming', label: t('seeker.item.streaming') },
                  { id: 'cable_tv', label: t('seeker.item.cable_tv') }
                ]},
                { cat: 'outdoor', icon: <TreePine/>, label: t('seeker.pref.outdoor'), items: [
                  { id: 'garden', label: t('seeker.item.garden') },
                  { id: 'balcony', label: t('seeker.item.balcony') },
                  { id: 'roof_terrace', label: t('seeker.item.roof_terrace') },
                  { id: 'shared_outdoor', label: t('seeker.item.shared_outdoor') }
                ]},
                { cat: 'parking', icon: <Car/>, label: t('seeker.pref.mobility'), items: [
                  { id: 'private_parking', label: t('seeker.item.private_parking') },
                  { id: 'garage', label: t('seeker.item.garage') },
                  { id: 'carport', label: t('seeker.item.carport') },
                  { id: 'bike_shed', label: t('seeker.item.bike_shed') },
                  { id: 'scooter_shed', label: t('seeker.item.scooter_shed') },
                  { id: 'motor_shed', label: t('seeker.item.motor_shed') },
                  { id: 'covered_shed', label: t('seeker.item.covered_shed') },
                  { id: 'ev_charging', label: t('seeker.item.ev_charging') }
                ]},
                { cat: 'pets', icon: <Dog/>, label: t('seeker.pref.pets'), items: [
                  { id: 'own_pet', label: t('seeker.item.own_pet') },
                  { id: 'pet_roommate', label: t('seeker.item.pet_roommate') }
                ]},
                { cat: 'surroundings', icon: <Building2/>, label: t('seeker.pref.environment'), items: [
                  { id: 'shops_nearby', label: t('seeker.item.shops_nearby') },
                  { id: 'transport_nearby', label: t('seeker.item.transport_nearby') },
                  { id: 'nature_nearby', label: t('seeker.item.nature_nearby', 'Natuur / Park dichtbij') },
                  { id: 'schools_nearby', label: t('seeker.item.schools_nearby') }
                ]},
                { cat: 'modifications', icon: <Accessibility/>, label: t('seeker.pref.extra', 'Extra'), items: [
                  { id: 'smoke_free', label: t('seeker.item.smoke_free') }
                ]}
              ].map((group) => (
                <div key={group.cat} className="space-y-4">
                  <h4 className="font-bold text-md flex items-center gap-2 text-on-surface-variant">
                    {React.cloneElement(group.icon as React.ReactElement<any>, { size: 18 })} {group.label}
                  </h4>
                  <div className="space-y-3">
                    {group.items.map(item => {
                       const level = (profile.preferences as any)?.[group.cat]?.[item.id];
                       const isSpecialItem = ['quiet_street', 'lively_street', 'dead_end_street', 'busy_street', 'shopping_street', 'cooking_together'].includes(item.id);
                       return (
                         <div key={item.id} className="flex flex-col gap-2">
                           <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-surface border border-outline rounded-2xl gap-3">
                              <span className="text-sm font-bold text-on-surface ml-1">{item.label}</span>
                              <div className="flex bg-surface-container rounded-xl p-1 text-[10px]">
                                 {(['neutral', 'bonus', 'critical'] as const).map(l => {
                                   let label = l === 'neutral' ? t('seeker.pref_level_neutral', 'Niet nodig') : l === 'bonus' ? t('seeker.pref_level_bonus', 'Bonus') : t('seeker.pref_level_critical', 'Heel graag');
                                   
                                   if (['quiet_street', 'lively_street', 'busy_street', 'shopping_street'].includes(item.id)) {
                                     label = l === 'neutral' ? t('seeker.level.prefer_not', 'Liever niet') : l === 'bonus' ? t('seeker.level.no_preference', 'Prima') : t('seeker.level.love_it', 'Heel graag');
                                   } else if (item.id === 'pet_roommate') {
                                     label = l === 'neutral' ? t('seeker.pet.no', 'Nee') : l === 'bonus' ? t('seeker.pet.prefer_not', 'Liever niet') : t('seeker.pet.fine', 'Prima');
                                   }
                                   
                                   return (
                                     <button key={l} onClick={() => handlePrefChange(group.cat as any, item.id, l)} className={`px-3 py-1.5 rounded-lg font-black uppercase tracking-tighter transition-all ${level === l ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                                       {label}
                                     </button>
                                   );
                                 })}
                              </div>
                           </div>
                           {item.id === 'own_pet' && (level === 'bonus' || level === 'critical') && (
                             <div className="p-4 bg-surface-container-low border border-outline rounded-2xl animate-in fade-in slide-in-from-top-2">
                               <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-3">{t('seeker.pet_question')}</label>
                               <div className="flex flex-wrap gap-2">
                                 {[
                                   { id: 'dogs', label: t('seeker.pet.dogs') },
                                   { id: 'cats', label: t('seeker.pet.cats') },
                                   { id: 'birds', label: t('seeker.pet.birds') },
                                   { id: 'rodents', label: t('seeker.pet.rodents') },
                                   { id: 'aquarium', label: t('seeker.pet.aquarium') },
                                   { id: 'reptiles', label: t('seeker.pet.reptiles') }
                                 ].map(pet => (
                                   <label key={pet.id} className="flex items-center gap-2 px-3 py-2 bg-surface border border-outline rounded-xl cursor-pointer hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary text-sm font-bold shadow-sm">
                                     <input 
                                       type="checkbox" 
                                       checked={((profile.preferences as any)?.pet_types || []).includes(pet.id)}
                                       onChange={(e) => {
                                         const current = (profile.preferences as any)?.pet_types || [];
                                         if (e.target.checked) handlePrefChange('pet_types' as any, '', [...current, pet.id]);
                                         else handlePrefChange('pet_types' as any, '', current.filter((p: string) => p !== pet.id));
                                       }}
                                       className="w-4 h-4 rounded-md accent-primary"
                                     />
                                     <span>{pet.label}</span>
                                   </label>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-4">
                <h4 className="font-bold text-md flex items-center gap-2 text-on-surface-variant">
                  <Heart size={18}/> {t('seeker.skill_title')}
                </h4>
                <div className="space-y-3">
                  {[
                    { key: 'hobby_gardening', label: t('seeker.hobby_gardening'), levels: ['no', 'maybe', 'yes'] },
                    { key: 'hobby_handyman', label: t('seeker.hobby_handyman'), levels: ['no', 'maybe', 'yes'] },
                    { key: 'hobby_renovation', label: t('seeker.hobby_renovation'), levels: ['no', 'maybe', 'yes', 'no_problem'] },
                  ].map(skill => {
                    const currentVal = (profile.preferences as any)?.tenant_prefs?.[skill.key] || 'no';
                    return (
                      <div key={skill.key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-surface border border-outline rounded-2xl gap-3">
                        <span className="text-sm font-bold text-on-surface ml-1">{skill.label}</span>
                        <div className="flex bg-surface-container rounded-xl p-1 text-[10px]">
                          {skill.levels.map(l => (
                            <button key={l} onClick={() => handlePrefChange('tenant_prefs', skill.key, l)} className={`px-3 py-1.5 rounded-lg font-black uppercase tracking-tighter transition-all ${currentVal === l ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                              {l === 'no' ? t('seeker.skill_level_no') : l === 'maybe' ? t('seeker.skill_level_maybe') : l === 'yes' ? t('seeker.skill_level_yes') : t('seeker.skill_level_no_problem')}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-outline">
                 <h4 className="font-bold text-md text-on-surface-variant">{t('seeker.label_notes')}</h4>
                 <textarea className="w-full bg-surface-container-low border border-outline rounded-2xl p-4 font-medium outline-none h-32 tracking-tight" placeholder={t('seeker.placeholder_notes')} value={profile.preferences?.modifications?.free_text || ''} onChange={e => handlePrefChange('modifications', 'free_text', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-outline bg-surface-container-low flex justify-between items-center gap-4 flex-shrink-0">
          <div className="hidden sm:block">
            {activeTab !== 'basis' && (
              <button onClick={() => {
                const tabs = (['basis', 'voorstellen', 'wensen', 'vakantie', 'extra'] as const);
                const idx = tabs.indexOf(activeTab);
                setActiveTab(tabs[idx-1]);
              }} className="px-6 py-3 font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-all">{t('seeker.back')}</button>
            )}
          </div>
            <div className="flex gap-4 w-full sm:w-auto">
              {activeTab !== 'extra' && (
                <button onClick={() => {
                  if (activeTab === 'basis' && minimalScore < 100) {
                    setToast({ message: t('seeker.toast_minimal_required'), type: 'error' });
                    return;
                  }
                  const tabs = (['basis', 'voorstellen', 'wensen', 'vakantie', 'extra'] as const);
                  const idx = tabs.indexOf(activeTab);
                  setActiveTab(tabs[idx+1]);
                }} className="w-full sm:w-auto bg-surface-container px-6 py-3 rounded-xl font-bold hover:bg-surface-container-highest transition-all">{t('seeker.next')}</button>
              )}
              <button disabled={loading} onClick={() => handleSave(true)} className="w-full sm:w-auto bg-primary text-on-primary px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
                <Save size={18} /> {loading ? t('seeker.loading') : t('seeker.save_profile')}
              </button>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {croppingImage && (
          <ImageCropModal 
            src={croppingImage} 
            onCancel={() => setCroppingImage(null)} 
            onComplete={onCropComplete} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
